import {
    Timestamp,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    runTransaction,
    serverTimestamp,
    where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
    DEFAULT_INVENTORY_LOCATION,
    type InventoryBalance,
    type InventoryMovement,
    type RecordInventoryMovementInput,
} from "@/lib/inventory/types";

const BALANCES_COLLECTION = "inventoryBalances";
const MOVEMENTS_COLLECTION = "inventoryMovements";
const MOVEMENT_KEYS_COLLECTION = "inventoryMovementKeys";

function requiredText(value: string, fieldName: string) {
    const normalized = value.trim();
    if (!normalized) throw new Error(`${fieldName} kan ikkje vere tomt.`);
    return normalized;
}

function documentKey(...parts: string[]) {
    return parts.map((part) => encodeURIComponent(part.trim())).join("__");
}

function cleanOptionalText(value?: string) {
    const normalized = value?.trim();
    return normalized || undefined;
}

function validateMovement(input: RecordInventoryMovementInput) {
    if (
        !Number.isInteger(input.quantity) ||
        (input.quantity === 0 && input.type !== "opening_balance")
    ) {
        throw new Error(
            "Lagermengd må vere eit heilt tal. Berre startbehaldning kan vere null."
        );
    }

    return {
        ...input,
        sku: requiredText(input.sku, "SKU"),
        locationId: requiredText(
            input.locationId ?? DEFAULT_INVENTORY_LOCATION,
            "Lagerstad"
        ),
        idempotencyKey: requiredText(input.idempotencyKey, "Idempotensnøkkel"),
        productId: cleanOptionalText(input.productId),
        variantId: cleanOptionalText(input.variantId),
        productName: cleanOptionalText(input.productName),
        variantName: cleanOptionalText(input.variantName),
        sourceId: cleanOptionalText(input.sourceId),
        note: cleanOptionalText(input.note),
        createdBy: cleanOptionalText(input.createdBy),
    };
}

export type RecordInventoryMovementsResult = {
    recorded: Array<{
        movementId: string;
        sku: string;
        quantity: number;
        balanceAfter: number;
    }>;
    skipped: Array<{
        movementId?: string;
        sku: string;
        idempotencyKey: string;
    }>;
};

export async function recordInventoryMovement(
    input: RecordInventoryMovementInput
) {
    return recordInventoryMovements([input]);
}

export async function recordInventoryMovements(
    inputs: RecordInventoryMovementInput[]
): Promise<RecordInventoryMovementsResult> {
    if (inputs.length === 0) {
        return { recorded: [], skipped: [] };
    }

    const movements = inputs.map(validateMovement);
    const uniqueKeys = new Set<string>();

    for (const movement of movements) {
        if (uniqueKeys.has(movement.idempotencyKey)) {
            throw new Error(
                `Idempotensnøkkelen '${movement.idempotencyKey}' er brukt fleire gonger i same bokføring.`
            );
        }
        uniqueKeys.add(movement.idempotencyKey);
    }

    const prepared = movements.map((movement) => ({
        movement,
        movementRef: doc(collection(db, MOVEMENTS_COLLECTION)),
        keyRef: doc(
            db,
            MOVEMENT_KEYS_COLLECTION,
            documentKey(movement.idempotencyKey)
        ),
        balanceRef: doc(
            db,
            BALANCES_COLLECTION,
            documentKey(movement.locationId, movement.sku)
        ),
    }));

    return runTransaction(db, async (transaction) => {
        // Firestore krev at alle lesingar skjer før første skriving.
        const keySnapshots = await Promise.all(
            prepared.map((item) => transaction.get(item.keyRef))
        );

        const uniqueBalanceRefs = new Map(
            prepared.map((item) => [item.balanceRef.path, item.balanceRef])
        );
        const balanceSnapshots = await Promise.all(
            [...uniqueBalanceRefs.values()].map((ref) => transaction.get(ref))
        );

        const balances = new Map<
            string,
            { onHand: number; initialized: boolean }
        >();
        balanceSnapshots.forEach((snapshot) => {
            const data = snapshot.data() as Partial<InventoryBalance> | undefined;
            balances.set(
                snapshot.ref.path,
                {
                    onHand:
                        typeof data?.onHand === "number" && Number.isFinite(data.onHand)
                            ? data.onHand
                            : 0,
                    initialized: snapshot.exists(),
                }
            );
        });

        const result: RecordInventoryMovementsResult = {
            recorded: [],
            skipped: [],
        };

        prepared.forEach((item, index) => {
            const existingKey = keySnapshots[index];
            if (existingKey.exists()) {
                const data = existingKey.data() as { movementId?: unknown };
                result.skipped.push({
                    movementId:
                        typeof data.movementId === "string"
                            ? data.movementId
                            : undefined,
                    sku: item.movement.sku,
                    idempotencyKey: item.movement.idempotencyKey,
                });
                return;
            }

            const balanceState = balances.get(item.balanceRef.path) ?? {
                onHand: 0,
                initialized: false,
            };
            const isOpeningBalance = item.movement.type === "opening_balance";

            if (isOpeningBalance && balanceState.initialized) {
                throw new Error(
                    `SKU ${item.movement.sku} har allereie startbehaldning. Bruk korrigering i staden.`
                );
            }
            if (!isOpeningBalance && !balanceState.initialized) {
                throw new Error(
                    `SKU ${item.movement.sku} må få startbehaldning før andre lagerrørsler kan bokførast.`
                );
            }

            const currentBalance = balanceState.onHand;
            const balanceAfter = currentBalance + item.movement.quantity;
            balances.set(item.balanceRef.path, {
                onHand: balanceAfter,
                initialized: true,
            });

            const occurredAt = item.movement.occurredAt
                ? Timestamp.fromDate(item.movement.occurredAt)
                : serverTimestamp();

            transaction.set(item.movementRef, {
                sku: item.movement.sku,
                locationId: item.movement.locationId,
                quantity: item.movement.quantity,
                balanceAfter,
                type: item.movement.type,
                source: item.movement.source,
                idempotencyKey: item.movement.idempotencyKey,
                productId: item.movement.productId ?? null,
                variantId: item.movement.variantId ?? null,
                productName: item.movement.productName ?? null,
                variantName: item.movement.variantName ?? null,
                sourceId: item.movement.sourceId ?? null,
                note: item.movement.note ?? null,
                occurredAt,
                createdAt: serverTimestamp(),
                createdBy: item.movement.createdBy ?? null,
                metadata: item.movement.metadata ?? {},
            });

            transaction.set(
                item.balanceRef,
                {
                    sku: item.movement.sku,
                    locationId: item.movement.locationId,
                    onHand: balanceAfter,
                    lastMovementId: item.movementRef.id,
                    updatedAt: serverTimestamp(),
                    ...(isOpeningBalance
                        ? { initializedAt: serverTimestamp() }
                        : {}),
                },
                { merge: true }
            );

            transaction.set(item.keyRef, {
                movementId: item.movementRef.id,
                sku: item.movement.sku,
                locationId: item.movement.locationId,
                createdAt: serverTimestamp(),
            });

            result.recorded.push({
                movementId: item.movementRef.id,
                sku: item.movement.sku,
                quantity: item.movement.quantity,
                balanceAfter,
            });
        });

        return result;
    });
}

export async function fetchInventoryBalance(
    sku: string,
    locationId = DEFAULT_INVENTORY_LOCATION
): Promise<InventoryBalance> {
    const normalizedSku = requiredText(sku, "SKU");
    const normalizedLocation = requiredText(locationId, "Lagerstad");
    const snapshot = await getDoc(
        doc(
            db,
            BALANCES_COLLECTION,
            documentKey(normalizedLocation, normalizedSku)
        )
    );

    if (!snapshot.exists()) {
        return {
            sku: normalizedSku,
            locationId: normalizedLocation,
            onHand: 0,
        };
    }

    const data = snapshot.data() as Partial<InventoryBalance>;
    return {
        sku: normalizedSku,
        locationId: normalizedLocation,
        onHand:
            typeof data.onHand === "number" && Number.isFinite(data.onHand)
                ? data.onHand
                : 0,
        lastMovementId:
            typeof data.lastMovementId === "string"
                ? data.lastMovementId
                : undefined,
        initializedAt: data.initializedAt ?? data.updatedAt,
        updatedAt: data.updatedAt,
    };
}

export async function fetchInventoryBalances(
    locationId = DEFAULT_INVENTORY_LOCATION
): Promise<InventoryBalance[]> {
    const normalizedLocation = requiredText(locationId, "Lagerstad");
    const snapshot = await getDocs(
        query(
            collection(db, BALANCES_COLLECTION),
            where("locationId", "==", normalizedLocation)
        )
    );

    return snapshot.docs.map((balanceDoc) => {
        const data = balanceDoc.data() as Partial<InventoryBalance>;
        return {
            sku: typeof data.sku === "string" ? data.sku : "",
            locationId: normalizedLocation,
            onHand:
                typeof data.onHand === "number" && Number.isFinite(data.onHand)
                    ? data.onHand
                    : 0,
            lastMovementId:
                typeof data.lastMovementId === "string"
                    ? data.lastMovementId
                    : undefined,
            initializedAt: data.initializedAt ?? data.updatedAt,
            updatedAt: data.updatedAt,
        };
    }).sort((a, b) => a.sku.localeCompare(b.sku, "nb-NO"));
}

function timestampMillis(value: unknown) {
    if (!value || typeof value !== "object") return 0;
    const timestamp = value as { toMillis?: () => number };
    return typeof timestamp.toMillis === "function" ? timestamp.toMillis() : 0;
}

export async function fetchInventoryMovements(
    sku: string,
    locationId = DEFAULT_INVENTORY_LOCATION,
    maxResults = 50
): Promise<InventoryMovement[]> {
    const normalizedSku = requiredText(sku, "SKU");
    const normalizedLocation = requiredText(locationId, "Lagerstad");
    const snapshot = await getDocs(
        query(
            collection(db, MOVEMENTS_COLLECTION),
            where("sku", "==", normalizedSku)
        )
    );

    return snapshot.docs
        .map((movementDoc) => {
            const data = movementDoc.data() as Omit<InventoryMovement, "id">;
            return { id: movementDoc.id, ...data };
        })
        .filter((movement) => movement.locationId === normalizedLocation)
        .sort(
            (a, b) =>
                timestampMillis(b.occurredAt ?? b.createdAt) -
                timestampMillis(a.occurredAt ?? a.createdAt)
        )
        .slice(0, Math.max(1, maxResults));
}
