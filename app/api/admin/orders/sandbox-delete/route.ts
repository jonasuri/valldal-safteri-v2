import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { isAdminEmail } from "@/lib/sandbox";

export const runtime = "nodejs";

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
    try {
        const authorization = request.headers.get("authorization") || "";
        if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");

        const decoded = await getAdminAuth().verifyIdToken(authorization.slice(7));
        if (!isAdminEmail(decoded.email)) throw new Error("FORBIDDEN");

        const body = await request.json() as Record<string, unknown>;
        const orderId = text(body.orderId);
        if (!orderId) throw new Error("INVALID_REQUEST");

        const db = getAdminFirestore();
        const orderRef = db.collection("orders").doc(orderId);
        const orderSnapshot = await orderRef.get();
        if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");

        const order = orderSnapshot.data() || {};
        if (order.sandbox?.enabled !== true) throw new Error("NOT_SANDBOX_ORDER");

        const childSnapshot = await db.collection("orders")
            .where("parentOrderId", "==", orderId)
            .get();
        const childDocs = childSnapshot.docs;
        const orderIds = [orderId, ...childDocs.map((doc) => doc.id)];
        const changeRequestSnapshots = await Promise.all(orderIds.map((id) =>
            db.collection("orderChangeRequests").where("orderId", "==", id).get()
        ));
        const movementSnapshots = await Promise.all(orderIds.map((id) =>
            db.collection("inventoryMovements").where("sourceId", "==", id).limit(1).get()
        ));

        if (movementSnapshots.some((snapshot) => !snapshot.empty)) {
            throw new Error("SANDBOX_HAS_INVENTORY_MOVEMENTS");
        }

        const batch = db.batch();
        batch.delete(orderRef);
        childDocs.forEach((doc) => batch.delete(doc.ref));
        changeRequestSnapshots.forEach((snapshot) => {
            snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        });

        const parentOrderId = text(order.parentOrderId);
        if (parentOrderId) {
            const parentRef = db.collection("orders").doc(parentOrderId);
            const parentSnapshot = await parentRef.get();
            if (parentSnapshot.exists && parentSnapshot.data()?.sandbox?.enabled === true) {
                batch.update(parentRef, {
                    "backorder.status": "open",
                    "backorder.createdOrderId": null,
                    "backorder.createdAt": null,
                    updatedAt: FieldValue.serverTimestamp(),
                });
            }
        }

        await batch.commit();
        return NextResponse.json({
            ok: true,
            deletedOrders: orderIds.length,
            deletedChangeRequests: changeRequestSnapshots.reduce((sum, snapshot) => sum + snapshot.size, 0),
        });
    } catch (error) {
        console.error("Sletting av sandbox-ordre feila", error);
        const message = error instanceof Error ? error.message : "SANDBOX_DELETE_FAILED";
        const status = message === "UNAUTHORIZED" ? 401
            : message === "FORBIDDEN" ? 403
                : message === "ORDER_NOT_FOUND" ? 404
                    : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
