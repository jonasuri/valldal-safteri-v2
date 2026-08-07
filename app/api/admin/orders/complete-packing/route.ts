import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { isAdminEmail } from "@/lib/sandbox";

export const runtime = "nodejs";


type PackingLine = {
    productId: string;
    variantId: string;
    orderedQuantity: number;
    packedQuantity: number;
    missingQuantity: number;
};

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function documentKey(...parts: string[]) {
    return parts.map((part) => encodeURIComponent(part.trim())).join("__");
}

function parsePackingLines(value: unknown): PackingLine[] {
    if (!Array.isArray(value) || value.length === 0) throw new Error("INVALID_PACKING_LINES");
    return value.map((raw) => {
        const line = raw as Record<string, unknown>;
        const productId = text(line.productId);
        const variantId = text(line.variantId);
        const orderedQuantity = Number(line.orderedQuantity);
        const packedQuantity = Number(line.packedQuantity);
        const missingQuantity = Math.max(0, orderedQuantity - packedQuantity);
        if (
            !productId || !variantId ||
            !Number.isInteger(orderedQuantity) || orderedQuantity < 0 ||
            !Number.isInteger(packedQuantity) || packedQuantity < 0 || packedQuantity > orderedQuantity
        ) throw new Error("INVALID_PACKING_LINES");
        return { productId, variantId, orderedQuantity, packedQuantity, missingQuantity };
    });
}

export async function POST(request: NextRequest) {
    try {
        const authorization = request.headers.get("authorization") || "";
        if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
        const decoded = await getAdminAuth().verifyIdToken(authorization.slice(7));
        if (!isAdminEmail(decoded.email)) {
            throw new Error("FORBIDDEN");
        }

        const body = (await request.json()) as Record<string, unknown>;
        const orderId = text(body.orderId);
        const packingLines = parsePackingLines(body.packingLines);
        if (!orderId) throw new Error("INVALID_REQUEST");

        const db = getAdminFirestore();
        const orderRef = db.collection("orders").doc(orderId);
        const orderSnapshot = await orderRef.get();
        if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
        const order = orderSnapshot.data() || {};
        const orderLines = Array.isArray(order.lines) ? order.lines as Array<Record<string, unknown>> : [];
        const orderedByKey = new Map(orderLines.map((line) => [
            `${text(line.productId)}:${text(line.variantId)}`,
            Number(line.quantity),
        ]));
        const packingKeys = new Set(packingLines.map((line) => `${line.productId}:${line.variantId}`));
        if (packingKeys.size !== packingLines.length || packingKeys.size !== orderedByKey.size) {
            throw new Error("PACKING_LINES_DO_NOT_MATCH_ORDER");
        }
        for (const line of packingLines) {
            if (orderedByKey.get(`${line.productId}:${line.variantId}`) !== line.orderedQuantity) {
                throw new Error("PACKING_LINES_DO_NOT_MATCH_ORDER");
            }
        }
        if (packingLines.length !== orderLines.length) throw new Error("PACKING_LINES_DO_NOT_MATCH_ORDER");

        const inventorySnapshot = await db.collection("inventoryBalances").limit(1).get();
        const inventoryEnabled = !inventorySnapshot.empty && order.sandbox?.enabled !== true;
        const productInfo = new Map<string, { sku: string; productName: string; variantName: string }>();

        if (inventoryEnabled) {
            const productIds = [...new Set(packingLines.map((line) => line.productId))];
            const products = await Promise.all(productIds.map((id) => db.collection("products").doc(id).get()));
            const productsById = new Map(products.map((snapshot) => [snapshot.id, snapshot.data() || {}]));

            for (const line of packingLines) {
                const product = productsById.get(line.productId);
                const variants = Array.isArray(product?.variants) ? product.variants as Array<Record<string, unknown>> : [];
                const variant = variants.find((item) => text(item.id) === line.variantId);
                const sku = text(variant?.itemNumber ?? variant?.sku);
                if (!product || !variant || !sku) throw new Error("MISSING_PRODUCT_SKU");
                productInfo.set(`${line.productId}:${line.variantId}`, {
                    sku,
                    productName: text(product.name),
                    variantName: text(variant.label ?? variant.name),
                });
            }
        }

        let inventoryUpdated = false;

        await db.runTransaction(async (transaction) => {
            const currentSnapshot = await transaction.get(orderRef);
            if (!currentSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
            const current = currentSnapshot.data() || {};
            const hasPostedLines = Array.isArray(current.packing?.inventoryPostedLines);
            const previousLines = hasPostedLines
                ? current.packing.inventoryPostedLines as Array<Record<string, unknown>>
                : current.inventoryFulfillment?.status === "posted" && Array.isArray(current.packing?.lines)
                    ? (current.packing.lines as Array<Record<string, unknown>>).map((line) => ({
                        productId: line.productId,
                        variantId: line.variantId,
                        quantity: line.packedQuantity,
                    }))
                    : [];
            const previousByKey = new Map(previousLines.map((line) => [
                `${text(line.productId)}:${text(line.variantId)}`,
                Number(line.quantity) || 0,
            ]));
            const revision = (Number(current.packing?.inventoryRevision) || 0) + 1;
            const adjustments = inventoryEnabled ? packingLines.flatMap((line) => {
                const key = `${line.productId}:${line.variantId}`;
                const delta = line.packedQuantity - (previousByKey.get(key) || 0);
                if (delta === 0) return [];
                return [{ line, delta, info: productInfo.get(key)! }];
            }) : [];
            const prepared = adjustments.map((adjustment) => ({
                ...adjustment,
                movementRef: db.collection("inventoryMovements").doc(),
                keyRef: db.collection("inventoryMovementKeys").doc(documentKey(
                    `order:${orderId}:packing:${revision}:${adjustment.line.productId}:${adjustment.line.variantId}`
                )),
                balanceRef: db.collection("inventoryBalances").doc(documentKey("main", adjustment.info.sku)),
            }));
            const keySnapshots = await Promise.all(prepared.map((item) => transaction.get(item.keyRef)));
            const uniqueBalanceRefs = new Map(prepared.map((item) => [item.balanceRef.path, item.balanceRef]));
            const balanceSnapshots = await Promise.all([...uniqueBalanceRefs.values()].map((ref) => transaction.get(ref)));
            const balances = new Map(balanceSnapshots.map((snapshot) => [
                snapshot.ref.path,
                { exists: snapshot.exists, onHand: Number(snapshot.data()?.onHand ?? 0) },
            ]));
            const inventoryReady = inventoryEnabled && [...uniqueBalanceRefs.values()].every(
                (ref) => balances.get(ref.path)?.exists
            );
            const movementIds: string[] = [];

            prepared.forEach((item, index) => {
                if (!inventoryReady) return;
                if (keySnapshots[index].exists) return;
                const balance = balances.get(item.balanceRef.path);
                if (!balance?.exists) return;
                const movementQuantity = -item.delta;
                const balanceAfter = balance.onHand + movementQuantity;
                balances.set(item.balanceRef.path, { exists: true, onHand: balanceAfter });
                const idempotencyKey = `order:${orderId}:packing:${revision}:${item.line.productId}:${item.line.variantId}`;

                transaction.set(item.movementRef, {
                    sku: item.info.sku,
                    locationId: "main",
                    quantity: movementQuantity,
                    balanceAfter,
                    type: "order_fulfillment",
                    source: "order",
                    idempotencyKey,
                    productId: item.line.productId,
                    variantId: item.line.variantId,
                    productName: item.info.productName,
                    variantName: item.info.variantName,
                    sourceId: orderId,
                    note: item.delta > 0
                        ? "Trekt frå lager ved fullført pakking."
                        : "Tilbakeført til lager etter endring i plukklista.",
                    occurredAt: FieldValue.serverTimestamp(),
                    createdAt: FieldValue.serverTimestamp(),
                    createdBy: decoded.uid,
                    metadata: {
                        orderId,
                        packingRevision: revision,
                        previousPackedQuantity: item.line.packedQuantity - item.delta,
                        packedQuantity: item.line.packedQuantity,
                    },
                });
                transaction.set(item.balanceRef, {
                    sku: item.info.sku,
                    locationId: "main",
                    onHand: balanceAfter,
                    lastMovementId: item.movementRef.id,
                    updatedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
                transaction.set(item.keyRef, {
                    movementId: item.movementRef.id,
                    sku: item.info.sku,
                    locationId: "main",
                    createdAt: FieldValue.serverTimestamp(),
                });
                movementIds.push(item.movementRef.id);
            });

            const hasMissingProducts = packingLines.some((line) => line.packedQuantity < line.orderedQuantity);
            const previousMovementIds = Array.isArray(current.inventoryFulfillment?.movementIds)
                ? current.inventoryFulfillment.movementIds.filter((id: unknown) => typeof id === "string")
                : [];
            const orderUpdate: Record<string, unknown> = {
                status: hasMissingProducts ? "partial" : "packed",
                "packing.lines": packingLines,
                "packing.status": hasMissingProducts ? "partial" : "complete",
                "packing.completedAt": FieldValue.serverTimestamp(),
                "packing.updatedAt": FieldValue.serverTimestamp(),
                inventoryFulfillment: inventoryReady ? {
                    status: "posted",
                    postedAt: FieldValue.serverTimestamp(),
                    movementIds: [...previousMovementIds, ...movementIds],
                    lineCount: packingLines.filter((line) => line.packedQuantity > 0).length,
                    unitCount: packingLines.reduce((sum, line) => sum + line.packedQuantity, 0),
                    revision,
                } : {
                    status: "skipped",
                    reason: "inventory_not_initialized",
                    skippedAt: FieldValue.serverTimestamp(),
                },
                updatedAt: FieldValue.serverTimestamp(),
            };

            if (inventoryReady) {
                orderUpdate["packing.inventoryRevision"] = revision;
                orderUpdate["packing.inventoryPostedLines"] = packingLines.map((line) => ({
                    productId: line.productId,
                    variantId: line.variantId,
                    quantity: line.packedQuantity,
                }));
            }

            inventoryUpdated = inventoryReady;
            transaction.update(orderRef, orderUpdate);
        });

        return NextResponse.json({ ok: true, inventoryUpdated });
    } catch (error) {
        console.error("Fullføring av pakking feila", error);
        const message = error instanceof Error ? error.message : "PACKING_FAILED";
        const status = message === "UNAUTHORIZED" ? 401
            : message === "FORBIDDEN" ? 403
                : message === "ORDER_NOT_FOUND" ? 404
                    : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
