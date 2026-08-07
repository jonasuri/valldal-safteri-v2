import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import { sendInternalOrderEmail } from "@/lib/internalOrderEmail";
import type { ApprovalResponse } from "@/lib/ordersFirestore";
import { canSendOrderEmails } from "@/lib/sandbox";

export const runtime = "nodejs";
const RESPONSES = new Set<ApprovalResponse>(["deliver_partial_later", "deliver_partial_cancel_rest", "wait_for_complete"]);
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }

async function findOrder(token: string) {
    if (token.length < 32) return null;
    const snapshot = await getAdminFirestore().collection("orders").where("approval.emailTokenHash", "==", tokenHash(token)).limit(2).get();
    return snapshot.size === 1 ? snapshot.docs[0] : null;
}

function tokenIsValid(order: Record<string, any>) {
    const expiresAt = order.approval?.emailTokenExpiresAt;
    return order.approval?.status === "waiting" && !order.approval?.emailTokenUsedAt && expiresAt instanceof Timestamp && expiresAt.toMillis() > Date.now();
}

export async function GET(request: NextRequest) {
    const token = text(request.nextUrl.searchParams.get("token"));
    const snapshot = await findOrder(token);
    if (!snapshot) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 404 });
    const order = snapshot.data();
    if (!tokenIsValid(order)) return NextResponse.json({ error: "EXPIRED_OR_USED" }, { status: 410 });
    const packingLines = Array.isArray(order.packing?.lines) ? order.packing.lines : [];
    const lines = (Array.isArray(order.lines) ? order.lines : []).map((line: Record<string, unknown>) => {
        const packed = packingLines.find((item: Record<string, unknown>) => text(item.productId) === text(line.productId) && text(item.variantId) === text(line.variantId));
        return {
            productName: text(line.productName), variantLabel: text(line.variantLabel),
            orderedQuantity: Number(line.quantity) || 0, packedQuantity: Number(packed?.packedQuantity) || 0,
        };
    });
    return NextResponse.json({ orderNumber: text(order.orderNumber, ) || snapshot.id.slice(0, 8).toUpperCase(), customerName: text(order.customerDisplayName) || text(order.customerName), lines });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as Record<string, unknown>;
        const token = text(body.token);
        const response = body.response as ApprovalResponse;
        if (!RESPONSES.has(response)) throw new Error("INVALID_RESPONSE");
        const snapshot = await findOrder(token);
        if (!snapshot) throw new Error("INVALID_TOKEN");
        const db = getAdminFirestore();
        await db.runTransaction(async (transaction) => {
            const current = await transaction.get(snapshot.ref);
            const order = current.data() || {};
            if (!current.exists || !tokenIsValid(order)) throw new Error("EXPIRED_OR_USED");
            const backorderStatus = response === "deliver_partial_later" ? "open" : response === "deliver_partial_cancel_rest" ? "cancelled" : "waiting_for_stock";
            transaction.update(snapshot.ref, {
                status: response === "wait_for_complete" ? "processing" : "packed",
                "approval.status": "answered", "approval.response": response,
                "approval.respondedBy": "customer", "approval.responseSource": "email_link",
                "approval.respondedAt": FieldValue.serverTimestamp(), "approval.emailTokenUsedAt": FieldValue.serverTimestamp(),
                "backorder.status": backorderStatus, "backorder.createdFromApproval": response,
                updatedAt: FieldValue.serverTimestamp(),
            });
        });
        const updated = await snapshot.ref.get();
        try { if (canSendOrderEmails(updated.data() || {})) await sendInternalOrderEmail({ event: "approval_response", orderId: snapshot.id, order: updated.data() || {} }); }
        catch (error) { console.error("Kundesvaret vart lagra, men internt varsel feila", error); }
        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "APPROVAL_FAILED";
        return NextResponse.json({ error: message }, { status: message === "EXPIRED_OR_USED" ? 410 : 400 });
    }
}
