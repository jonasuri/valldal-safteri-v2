import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { sendInternalOrderEmail } from "@/lib/internalOrderEmail";
import type { ApprovalResponse } from "@/lib/ordersFirestore";

export const runtime = "nodejs";

const RESPONSES = new Set<ApprovalResponse>([
    "deliver_partial_later",
    "deliver_partial_cancel_rest",
    "wait_for_complete",
]);

function documentKey(...parts: string[]) {
    return parts.map((part) => encodeURIComponent(part.trim())).join("__");
}

function value(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

type PackingLine = {
    productId: string;
    variantId: string;
    packedQuantity: number;
};

async function packedMovements(orderId: string, rawLines: unknown) {
    if (!Array.isArray(rawLines)) return [];

    const quantities = new Map<string, PackingLine>();
    for (const rawLine of rawLines) {
        const line = rawLine as Record<string, unknown>;
        const productId = value(line.productId);
        const variantId = value(line.variantId);
        const packedQuantity = Number(line.packedQuantity ?? 0);
        if (!productId || !variantId || !Number.isInteger(packedQuantity) || packedQuantity < 0) {
            throw new Error("INVALID_PACKING_LINES");
        }
        const key = `${productId}:${variantId}`;
        const current = quantities.get(key);
        quantities.set(key, {
            productId,
            variantId,
            packedQuantity: (current?.packedQuantity ?? 0) + packedQuantity,
        });
    }

    const db = getAdminFirestore();
    const productIds = [...new Set([...quantities.values()].map((line) => line.productId))];
    const products = await Promise.all(productIds.map((id) => db.collection("products").doc(id).get()));
    const productsById = new Map(products.map((snapshot) => [snapshot.id, snapshot.data() || {}]));

    return [...quantities.values()].flatMap((line) => {
        if (line.packedQuantity === 0) return [];
        const product = productsById.get(line.productId);
        const variants = Array.isArray(product?.variants) ? product.variants as Array<Record<string, unknown>> : [];
        const variant = variants.find((item) => value(item.id) === line.variantId);
        const sku = value(variant?.itemNumber ?? variant?.sku);
        if (!product || !variant || !sku) throw new Error("MISSING_PRODUCT_SKU");

        return [{
            productId: line.productId,
            variantId: line.variantId,
            productName: value(product.name),
            variantName: value(variant.label ?? variant.name),
            sku,
            quantity: line.packedQuantity,
            idempotencyKey: `order:${orderId}:packed:${line.productId}:${line.variantId}`,
        }];
    });
}

export async function POST(request: NextRequest) {
    try {
        const authorization = request.headers.get("authorization") || "";
        if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
        const decoded = await getAdminAuth().verifyIdToken(authorization.slice(7));
        const body = (await request.json()) as Record<string, unknown>;
        const orderId = value(body.orderId);
        const response = body.response as ApprovalResponse;
        if (!orderId || !RESPONSES.has(response)) throw new Error("INVALID_REQUEST");

        const db = getAdminFirestore();
        const orderRef = db.collection("orders").doc(orderId);
        const initialOrder = await orderRef.get();
        if (!initialOrder.exists) throw new Error("ORDER_NOT_FOUND");
        const initialData = initialOrder.data() || {};
        const customerId = value(initialData.customerId);
        const customer = customerId ? await db.collection("customers").doc(customerId).get() : null;
        if (!customer?.exists || customer.data()?.authUid !== decoded.uid) throw new Error("FORBIDDEN");
        if (initialData.approval?.status !== "waiting") throw new Error("APPROVAL_NOT_WAITING");

        const movements = response === "wait_for_complete"
            ? []
            : await packedMovements(orderId, initialData.packing?.lines);

        await db.runTransaction(async (transaction) => {
            const currentOrder = await transaction.get(orderRef);
            const order = currentOrder.data() || {};
            if (!currentOrder.exists || order.approval?.status !== "waiting") {
                throw new Error("APPROVAL_NOT_WAITING");
            }

            const prepared = movements.map((movement) => ({
                movement,
                keyRef: db.collection("inventoryMovementKeys").doc(documentKey(movement.idempotencyKey)),
                balanceRef: db.collection("inventoryBalances").doc(documentKey("main", movement.sku)),
                movementRef: db.collection("inventoryMovements").doc(),
            }));
            const keySnapshots = await Promise.all(prepared.map((item) => transaction.get(item.keyRef)));
            const balanceSnapshots = await Promise.all(prepared.map((item) => transaction.get(item.balanceRef)));
            const movementIds: string[] = [];
            let unitCount = 0;

            prepared.forEach((item, index) => {
                const existingKey = keySnapshots[index];
                if (existingKey.exists) {
                    const existingId = value(existingKey.data()?.movementId);
                    if (existingId) movementIds.push(existingId);
                    return;
                }
                const balance = balanceSnapshots[index];
                if (!balance.exists) throw new Error(`INVENTORY_NOT_INITIALIZED:${item.movement.sku}`);
                const onHand = Number(balance.data()?.onHand ?? 0);
                const balanceAfter = onHand - item.movement.quantity;

                transaction.set(item.movementRef, {
                    sku: item.movement.sku,
                    locationId: "main",
                    quantity: -item.movement.quantity,
                    balanceAfter,
                    type: "order_fulfillment",
                    source: "order",
                    idempotencyKey: item.movement.idempotencyKey,
                    productId: item.movement.productId,
                    variantId: item.movement.variantId,
                    productName: item.movement.productName,
                    variantName: item.movement.variantName,
                    sourceId: orderId,
                    note: "Trekt frå lager ved kundegodkjend dellevering.",
                    occurredAt: FieldValue.serverTimestamp(),
                    createdAt: FieldValue.serverTimestamp(),
                    createdBy: decoded.uid,
                    metadata: { orderId, packedQuantity: item.movement.quantity },
                });
                transaction.set(item.balanceRef, {
                    sku: item.movement.sku,
                    locationId: "main",
                    onHand: balanceAfter,
                    lastMovementId: item.movementRef.id,
                    updatedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
                transaction.set(item.keyRef, {
                    movementId: item.movementRef.id,
                    sku: item.movement.sku,
                    locationId: "main",
                    createdAt: FieldValue.serverTimestamp(),
                });
                movementIds.push(item.movementRef.id);
                unitCount += item.movement.quantity;
            });

            const backorderStatus = response === "deliver_partial_later"
                ? "open"
                : response === "deliver_partial_cancel_rest"
                    ? "cancelled"
                    : "waiting_for_stock";
            transaction.update(orderRef, {
                status: response === "wait_for_complete" ? "processing" : "packed",
                "approval.status": "answered",
                "approval.response": response,
                "approval.respondedBy": "customer",
                "approval.responseSource": "customer_portal",
                "approval.respondedAt": FieldValue.serverTimestamp(),
                "backorder.status": backorderStatus,
                "backorder.createdFromApproval": response,
                ...(response === "wait_for_complete" ? {} : {
                    inventoryFulfillment: {
                        status: "posted",
                        postedAt: FieldValue.serverTimestamp(),
                        movementIds,
                        lineCount: movements.length,
                        unitCount,
                    },
                }),
                updatedAt: FieldValue.serverTimestamp(),
            });
        });

        const updatedOrder = await orderRef.get();
        try {
            await sendInternalOrderEmail({
                event: "approval_response",
                orderId,
                order: updatedOrder.data() || {},
            });
        } catch (emailError) {
            console.error("Kundesvaret vart lagra, men ordrevarselet feila", emailError);
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Kundegodkjenning feila", error);
        const message = error instanceof Error ? error.message : "APPROVAL_FAILED";
        const status = message === "UNAUTHORIZED" ? 401
            : message === "FORBIDDEN" ? 403
                : message === "ORDER_NOT_FOUND" ? 404
                    : message === "APPROVAL_NOT_WAITING" ? 409
                        : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
