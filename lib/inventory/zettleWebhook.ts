import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebaseAdmin";

type PurchaseLine = {
    id?: unknown;
    type?: unknown;
    sku?: unknown;
    quantity?: unknown;
    name?: unknown;
    variantName?: unknown;
    productUuid?: unknown;
    variantUuid?: unknown;
};

type PurchasePayload = {
    purchaseUuid?: unknown;
    purchaseUUID1?: unknown;
    purchaseNumber?: unknown;
    created?: unknown;
    products?: unknown;
};

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function numeric(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value.replace(",", "."));
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function documentKey(...parts: string[]) {
    return parts.map((part) => encodeURIComponent(part.trim())).join("__");
}

export async function bookZettlePurchase(
    payload: PurchasePayload,
    messageId: string
) {
    const adminDb = getAdminFirestore();
    const purchaseId = text(payload.purchaseUuid) || text(payload.purchaseUUID1);
    if (!purchaseId) throw new Error("Zettle-hendinga manglar kjøps-ID.");

    const productsSnapshot = await adminDb.collection("products").get();
    const variantsBySku = new Map<string, {
        productId: string;
        productName: string;
        variantId: string;
        variantName: string;
    }>();

    for (const productDoc of productsSnapshot.docs) {
        const product = productDoc.data();
        const variants = Array.isArray(product.variants) ? product.variants : [];
        for (const variant of variants) {
            const sku = text(variant.itemNumber ?? variant.sku);
            if (!sku) continue;
            variantsBySku.set(sku, {
                productId: productDoc.id,
                productName: text(product.name),
                variantId: text(variant.id),
                variantName: text(variant.label ?? variant.name),
            });
        }
    }

    const rawLines = Array.isArray(payload.products)
        ? payload.products as PurchaseLine[]
        : [];
    const prepared = rawLines.flatMap((line, index) => {
        const sku = text(line.sku);
        const quantity = numeric(line.quantity);
        const product = variantsBySku.get(sku);
        const reason = text(line.type) !== "PRODUCT"
            ? "Ikkje ei vare frå produktregisteret."
            : !sku
                ? "Manglar SKU i Zettle-salet."
                : quantity === null || !Number.isInteger(quantity) || quantity === 0
                    ? "Mengda er ikkje eit heilt tal."
                    : !product
                        ? "SKU finst ikkje i Valldal-registeret."
                        : null;

        return [{
            index,
            line,
            sku,
            quantity,
            product,
            reason,
            idempotencyKey: `zettle:${purchaseId}:${text(line.id) || index}`,
        }];
    });

    const issueInputs = prepared.filter((item) => item.reason);
    const validInputs = prepared.filter(
        (item): item is typeof item & {
            quantity: number;
            product: NonNullable<typeof item.product>;
        } => !item.reason && item.quantity !== null && Boolean(item.product)
    );

    const result = await adminDb.runTransaction(async (transaction) => {
        const validRefs = validInputs.map((item) => ({
            ...item,
            keyRef: adminDb.collection("inventoryMovementKeys").doc(
                documentKey(item.idempotencyKey)
            ),
            balanceRef: adminDb.collection("inventoryBalances").doc(
                documentKey("main", item.sku)
            ),
            movementRef: adminDb.collection("inventoryMovements").doc(),
        }));
        const keySnapshots = await Promise.all(
            validRefs.map((item) => transaction.get(item.keyRef))
        );
        const balanceSnapshots = await Promise.all(
            validRefs.map((item) => transaction.get(item.balanceRef))
        );

        let recorded = 0;
        let duplicates = 0;
        const missingBalance: typeof validInputs = [];

        validRefs.forEach((item, index) => {
            if (keySnapshots[index].exists) {
                duplicates += 1;
                return;
            }
            const balanceSnapshot = balanceSnapshots[index];
            if (!balanceSnapshot.exists) {
                missingBalance.push(item);
                return;
            }

            const current = balanceSnapshot.data()?.onHand;
            const onHand = typeof current === "number" && Number.isFinite(current)
                ? current
                : 0;
            const inventoryChange = -item.quantity;
            const balanceAfter = onHand + inventoryChange;
            const occurredAtText = text(payload.created);
            const occurredAtDate = occurredAtText ? new Date(occurredAtText) : new Date();
            const occurredAt = Number.isNaN(occurredAtDate.getTime())
                ? Timestamp.now()
                : Timestamp.fromDate(occurredAtDate);

            transaction.set(item.movementRef, {
                sku: item.sku,
                locationId: "main",
                quantity: inventoryChange,
                balanceAfter,
                type: "zettle_sale",
                source: "zettle",
                idempotencyKey: item.idempotencyKey,
                productId: item.product.productId,
                variantId: item.product.variantId,
                productName: item.product.productName,
                variantName: item.product.variantName,
                sourceId: purchaseId,
                note: item.quantity < 0 ? "Retur registrert i Zettle." : "Sal registrert i Zettle.",
                occurredAt,
                createdAt: FieldValue.serverTimestamp(),
                createdBy: "zettle-webhook",
                metadata: {
                    purchaseId,
                    purchaseNumber: numeric(payload.purchaseNumber),
                    messageId,
                    zettleQuantity: item.quantity,
                },
            });
            transaction.set(item.balanceRef, {
                sku: item.sku,
                locationId: "main",
                onHand: balanceAfter,
                lastMovementId: item.movementRef.id,
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            transaction.set(item.keyRef, {
                movementId: item.movementRef.id,
                sku: item.sku,
                locationId: "main",
                createdAt: FieldValue.serverTimestamp(),
            });
            recorded += 1;
        });

        return { recorded, duplicates, missingBalance };
    });

    const allIssues = [
        ...issueInputs.map((item) => ({ ...item, reason: item.reason! })),
        ...result.missingBalance.map((item) => ({
            ...item,
            reason: "SKU manglar startbehaldning og vart ikkje bokført.",
        })),
    ];

    await Promise.all(allIssues.map((item) =>
        adminDb.collection("zettleInventoryIssues")
            .doc(documentKey(purchaseId, String(item.index)))
            .set({
                status: "open",
                purchaseId,
                purchaseNumber: numeric(payload.purchaseNumber),
                messageId,
                lineIndex: item.index,
                productName: text(item.line.name),
                variantName: text(item.line.variantName),
                sku: item.sku || null,
                productUuid: text(item.line.productUuid) || null,
                variantUuid: text(item.line.variantUuid) || null,
                quantity: item.quantity,
                reason: item.reason,
                createdAt: FieldValue.serverTimestamp(),
            }, { merge: true })
    ));

    return {
        purchaseId,
        recorded: result.recorded,
        duplicates: result.duplicates,
        issues: allIssues.length,
    };
}
