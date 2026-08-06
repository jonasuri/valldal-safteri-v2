import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { sendCustomerOrderConfirmation } from "@/lib/customerOrderEmail";

export const runtime = "nodejs";
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export async function POST(request: NextRequest) {
    try {
        const authorization = request.headers.get("authorization") || "";
        if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
        const decoded = await getAdminAuth().verifyIdToken(authorization.slice(7));
        const body = await request.json() as Record<string, unknown>;
        const orderId = text(body.orderId);
        if (!orderId) throw new Error("INVALID_REQUEST");
        const db = getAdminFirestore();
        const ref = db.collection("orders").doc(orderId);
        const snapshot = await ref.get();
        if (!snapshot.exists) throw new Error("ORDER_NOT_FOUND");
        const order = snapshot.data() || {};
        const customerId = text(order.customerId);
        const customer = customerId ? await db.collection("customers").doc(customerId).get() : null;
        if (!customer?.exists || customer.data()?.authUid !== decoded.uid) throw new Error("FORBIDDEN");
        if (order.customerEmails?.confirmationSentAt) return NextResponse.json({ ok: true, alreadySent: true });
        await sendCustomerOrderConfirmation(orderId, order);
        await ref.update({ "customerEmails.confirmationSentAt": FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Automatisk ordrebekrefting feila", error);
        const message = error instanceof Error ? error.message : "ORDER_CONFIRMATION_FAILED";
        const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : message === "ORDER_NOT_FOUND" ? 404 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
