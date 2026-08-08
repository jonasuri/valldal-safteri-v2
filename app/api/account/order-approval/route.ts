import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { sendInternalOrderEmail } from "@/lib/internalOrderEmail";
import type { ApprovalResponse } from "@/lib/ordersFirestore";
import { canSendOrderEmails } from "@/lib/sandbox";
import { ensureBackorderForOrder } from "@/lib/serverOrderBackorder";

export const runtime = "nodejs";

const RESPONSES = new Set<ApprovalResponse>([
    "deliver_partial_later",
    "deliver_partial_cancel_rest",
    "wait_for_complete",
]);

function value(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
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

        await db.runTransaction(async (transaction) => {
            const currentOrder = await transaction.get(orderRef);
            const order = currentOrder.data() || {};
            if (!currentOrder.exists || order.approval?.status !== "waiting") {
                throw new Error("APPROVAL_NOT_WAITING");
            }

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
                updatedAt: FieldValue.serverTimestamp(),
            });
        });

        if (response === "deliver_partial_later") {
            await ensureBackorderForOrder(db, orderId);
        }

        const updatedOrder = await orderRef.get();
        try {
            if (!canSendOrderEmails(updatedOrder.data() || {})) return NextResponse.json({ ok: true });
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
