import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { sendCustomerPackingSlip } from "@/lib/customerOrderEmail";
import { canSendOrderEmails, isAdminEmail } from "@/lib/sandbox";

export const runtime = "nodejs";

const DELIVERY_TYPES = new Set(["picked_up", "shipped", "delivered"]);
const DELIVERY_READY_STATUSES = new Set(["packed", "picked_up", "shipped", "delivered"]);
const MAX_SIGNATURE_LENGTH = 700_000;

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

function validateSignature(signatureDataUrl: string, signedBy: string) {
    if (!signatureDataUrl) return;
    if (!signedBy) throw new Error("MISSING_RECEIVER_NAME");
    if (!signatureDataUrl.startsWith("data:image/png;base64,")) throw new Error("INVALID_SIGNATURE");
    if (signatureDataUrl.length > MAX_SIGNATURE_LENGTH) throw new Error("SIGNATURE_TOO_LARGE");

    const encoded = signatureDataUrl.slice("data:image/png;base64,".length);
    if (!encoded || Buffer.from(encoded, "base64").length === 0) throw new Error("INVALID_SIGNATURE");
}

export async function POST(request: NextRequest) {
    try {
        const authorization = request.headers.get("authorization") || "";
        if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
        const decoded = await getAdminAuth().verifyIdToken(authorization.slice(7));
        if (!isAdminEmail(decoded.email)) throw new Error("FORBIDDEN");

        const body = await request.json() as Record<string, unknown>;
        const orderId = text(body.orderId);
        const deliveryType = text(body.deliveryType);
        const signedBy = text(body.signedBy);
        const signatureDataUrl = text(body.signatureDataUrl);
        const operator = parseOperator(body.operator);
        if (!orderId || !DELIVERY_TYPES.has(deliveryType)) throw new Error("INVALID_REQUEST");
        validateSignature(signatureDataUrl, signedBy);

        const db = getAdminFirestore();
        const orderRef = db.collection("orders").doc(orderId);

        await db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(orderRef);
            if (!snapshot.exists) throw new Error("ORDER_NOT_FOUND");
            const order = snapshot.data() || {};
            if (!DELIVERY_READY_STATUSES.has(text(order.status))) throw new Error("ORDER_NOT_READY_FOR_DELIVERY");

            const update: Record<string, unknown> = {
                status: deliveryType,
                updatedAt: FieldValue.serverTimestamp(),
                lastUpdatedByOperator: operator,
                operatorHistory: FieldValue.arrayUnion({
                    action: `order_${deliveryType}`,
                    operator,
                    occurredAt: new Date(),
                }),
            };

            if (signatureDataUrl) {
                update.deliverySignature = {
                    signedBy,
                    signatureDataUrl,
                    deliveryType,
                    signedAt: FieldValue.serverTimestamp(),
                };
            }

            transaction.update(orderRef, update);
        });

        let emailSent = false;
        let emailError = false;
        const snapshot = await orderRef.get();
        const order = snapshot.data() || {};
        const alreadySent = order.customerEmails?.packingSlip?.[`${deliveryType}SentAt`];
        if (!alreadySent && text(order.customerEmail) && canSendOrderEmails(order)) {
            try {
                await sendCustomerPackingSlip(orderId, order, deliveryType);
                await orderRef.update({
                    [`customerEmails.packingSlip.${deliveryType}SentAt`]: FieldValue.serverTimestamp(),
                });
                emailSent = true;
            } catch (error) {
                emailError = true;
                console.error("Utleveringa vart lagra, men følgjesetelen feila", error);
            }
        }

        return NextResponse.json({ ok: true, emailSent, emailError });
    } catch (error) {
        console.error("Registrering av utlevering feila", error);
        const message = error instanceof Error ? error.message : "DELIVERY_FAILED";
        const status = message === "UNAUTHORIZED" ? 401
            : message === "FORBIDDEN" ? 403
                : message === "ORDER_NOT_FOUND" ? 404
                    : message === "ORDER_NOT_READY_FOR_DELIVERY" ? 409
                        : message === "SIGNATURE_TOO_LARGE" ? 413
                            : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
