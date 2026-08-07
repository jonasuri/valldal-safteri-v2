import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { sendInternalOrderEmail, type InternalOrderEvent } from "@/lib/internalOrderEmail";
import { canSendOrderEmails } from "@/lib/sandbox";

export const runtime = "nodejs";

const EVENTS = new Set<InternalOrderEvent>(["new_order", "change_request", "approval_response"]);

export async function POST(request: NextRequest) {
    try {
        const authorization = request.headers.get("authorization") || "";
        if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
        const decoded = await getAdminAuth().verifyIdToken(authorization.slice(7));
        const body = (await request.json()) as Record<string, unknown>;
        const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
        const event = body.event as InternalOrderEvent;
        if (!orderId || !EVENTS.has(event)) throw new Error("INVALID_REQUEST");

        const db = getAdminFirestore();
        const orderSnapshot = await db.collection("orders").doc(orderId).get();
        if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
        const order = orderSnapshot.data() || {};
        const customerId = typeof order.customerId === "string" ? order.customerId : "";
        if (!customerId) throw new Error("FORBIDDEN");
        const customerSnapshot = await db.collection("customers").doc(customerId).get();
        const customer = customerSnapshot.data();
        if (!customerSnapshot.exists || customer?.authUid !== decoded.uid) throw new Error("FORBIDDEN");
        if (!canSendOrderEmails(order)) return NextResponse.json({ ok: true, skipped: "sandbox" });

        await sendInternalOrderEmail({
            event,
            orderId,
            order,
            message: typeof body.message === "string" ? body.message.slice(0, 2000) : undefined,
        });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Internt ordrevarsel feila", error);
        const message = error instanceof Error ? error.message : "NOTIFICATION_FAILED";
        const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : message === "ORDER_NOT_FOUND" ? 404 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
