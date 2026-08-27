import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { isAdminEmail } from "@/lib/sandbox";
import { ensureBackorderForOrder } from "@/lib/serverOrderBackorder";

export const runtime = "nodejs";

const RESPONSES = new Set([
    "deliver_partial_later",
    "deliver_partial_cancel_rest",
    "wait_for_complete",
]);
const SOURCES = new Set(["phone", "email", "in_person", "other"]);

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function parseOperator(value: unknown) {
    const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const id = text(item.id);
    const name = text(item.name);
    if (!id || !name) throw new Error("INVALID_OPERATOR");
    return { id, name };
}

export async function POST(request: NextRequest) {
    try {
        const authorization = request.headers.get("authorization") || "";
        if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
        const decoded = await getAdminAuth().verifyIdToken(authorization.slice(7));
        if (!isAdminEmail(decoded.email)) throw new Error("FORBIDDEN");

        const body = await request.json() as Record<string, unknown>;
        const orderId = text(body.orderId);
        const response = text(body.response);
        const responseSource = text(body.responseSource);
        const adminNote = text(body.adminNote) || null;
        const operator = parseOperator(body.operator);
        if (!orderId || !RESPONSES.has(response) || !SOURCES.has(responseSource)) {
            throw new Error("INVALID_REQUEST");
        }

        const db = getAdminFirestore();
        const orderRef = db.collection("orders").doc(orderId);
        const backorderRef = db.collection("orders").doc(`backorder-${orderId}`);

        await db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(orderRef);
            if (!snapshot.exists) throw new Error("ORDER_NOT_FOUND");
            const order = snapshot.data() || {};
            if (text(order.packing?.status) !== "partial") throw new Error("ORDER_NOT_PARTIAL");

            const nextStatus = response === "wait_for_complete" ? "processing" : "packed";
            const backorderStatus = response === "deliver_partial_later"
                ? "open"
                : response === "deliver_partial_cancel_rest"
                    ? "cancelled"
                    : "waiting_for_stock";
            const update: Record<string, unknown> = {
                status: nextStatus,
                "approval.required": true,
                "approval.status": "answered",
                "approval.response": response,
                "approval.respondedBy": "admin",
                "approval.respondedForCustomer": true,
                "approval.responseSource": responseSource,
                "approval.adminNote": adminNote,
                "approval.respondedAt": FieldValue.serverTimestamp(),
                "approval.adminSeenAt": FieldValue.serverTimestamp(),
                "approval.emailTokenUsedAt": FieldValue.serverTimestamp(),
                "backorder.status": backorderStatus,
                "backorder.createdFromApproval": response,
                updatedAt: FieldValue.serverTimestamp(),
                lastUpdatedByOperator: operator,
                operatorHistory: FieldValue.arrayUnion({
                    action: "customer_decision_updated",
                    operator,
                    occurredAt: new Date(),
                }),
            };

            if (response !== "deliver_partial_later") {
                update["backorder.createdOrderId"] = null;
                update["backorder.createdAt"] = null;
                transaction.delete(backorderRef);
            }
            transaction.update(orderRef, update);
        });

        if (response === "deliver_partial_later") {
            await ensureBackorderForOrder(db, orderId);
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Manuell kundegodkjenning feila", error);
        const message = error instanceof Error ? error.message : "APPROVAL_FAILED";
        const status = message === "UNAUTHORIZED" ? 401
            : message === "FORBIDDEN" ? 403
                : message === "ORDER_NOT_FOUND" ? 404
                    : message === "ORDER_NOT_PARTIAL" ? 409
                        : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
