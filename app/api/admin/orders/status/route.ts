import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { sendCustomerPackingSlip } from "@/lib/customerOrderEmail";

export const runtime = "nodejs";
const ADMIN_EMAILS = new Set(["post@valldalsafteri.no"]);
const STATUSES = new Set(["new", "processing", "packed", "partial", "picked_up", "shipped", "delivered", "change_requested", "cancelled"]);
const DELIVERY = new Set(["picked_up", "shipped", "delivered"]);
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export async function POST(request: NextRequest) {
    try {
        const authorization = request.headers.get("authorization") || "";
        if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
        const decoded = await getAdminAuth().verifyIdToken(authorization.slice(7));
        if (!decoded.email || !ADMIN_EMAILS.has(decoded.email.trim().toLowerCase())) throw new Error("FORBIDDEN");
        const body = await request.json() as Record<string, unknown>;
        const orderId = text(body.orderId);
        const status = text(body.status);
        if (!orderId || !STATUSES.has(status)) throw new Error("INVALID_REQUEST");
        const db = getAdminFirestore();
        const ref = db.collection("orders").doc(orderId);
        await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
        let emailSent = false;
        let emailError = false;
        if (DELIVERY.has(status)) {
            const snapshot = await ref.get();
            const order = snapshot.data() || {};
            const alreadySent = order.customerEmails?.packingSlip?.[`${status}SentAt`];
            if (!alreadySent && text(order.customerEmail)) {
                try {
                    await sendCustomerPackingSlip(orderId, order, status);
                    await ref.update({ [`customerEmails.packingSlip.${status}SentAt`]: FieldValue.serverTimestamp() });
                    emailSent = true;
                } catch (error) {
                    emailError = true;
                    console.error("Status vart lagra, men følgjesetelen feila", error);
                }
            }
        }
        return NextResponse.json({ ok: true, emailSent, emailError });
    } catch (error) {
        console.error("Oppdatering av ordrestatus feila", error);
        const message = error instanceof Error ? error.message : "ORDER_STATUS_FAILED";
        const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
