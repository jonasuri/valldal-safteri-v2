import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { isAdminEmail } from "@/lib/sandbox";

export const runtime = "nodejs";

const ACTIONS = new Set(["register", "reopen"]);
const DELIVERED_STATUSES = new Set(["picked_up", "shipped", "delivered"]);

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizedInvoiceNumber(value: string) {
    return value.replace(/\s+/g, " ").toUpperCase();
}

function invoiceKey(value: string) {
    return createHash("sha256").update(value).digest("hex");
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
        const action = text(body.action);
        const invoiceNumber = text(body.invoiceNumber).replace(/\s+/g, " ");
        const operator = parseOperator(body.operator);
        if (!orderId || !ACTIONS.has(action)) throw new Error("INVALID_REQUEST");
        if (action === "register" && (!invoiceNumber || invoiceNumber.length > 64)) {
            throw new Error("INVALID_INVOICE_NUMBER");
        }

        const db = getAdminFirestore();
        const orderRef = db.collection("orders").doc(orderId);

        await db.runTransaction(async (transaction) => {
            const orderSnapshot = await transaction.get(orderRef);
            if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
            const order = orderSnapshot.data() || {};
            const currentNumber = text(order.invoice?.number);
            const currentNormalized = text(order.invoice?.normalizedNumber)
                || (currentNumber ? normalizedInvoiceNumber(currentNumber) : "");

            if (action === "reopen") {
                if (text(order.invoice?.status) !== "invoiced") throw new Error("INVOICE_NOT_REGISTERED");
                const currentKeyRef = currentNormalized
                    ? db.collection("invoiceNumberKeys").doc(invoiceKey(currentNormalized))
                    : null;
                const currentKeySnapshot = currentKeyRef ? await transaction.get(currentKeyRef) : null;

                if (currentKeyRef && currentKeySnapshot?.data()?.orderId === orderId) {
                    transaction.delete(currentKeyRef);
                }
                transaction.update(orderRef, {
                    "invoice.status": "not_invoiced",
                    "invoice.previousNumber": currentNumber || null,
                    "invoice.number": null,
                    "invoice.normalizedNumber": null,
                    "invoice.invoicedAt": null,
                    "invoice.invoicedBy": null,
                    "invoice.reopenedAt": FieldValue.serverTimestamp(),
                    "invoice.reopenedBy": operator,
                    updatedAt: FieldValue.serverTimestamp(),
                    lastUpdatedByOperator: operator,
                    operatorHistory: FieldValue.arrayUnion({
                        action: "invoice_reopened",
                        operator,
                        previousInvoiceNumber: currentNumber || null,
                        occurredAt: new Date(),
                    }),
                });
                return;
            }

            if (!DELIVERED_STATUSES.has(text(order.status))) throw new Error("ORDER_NOT_DELIVERED");

            const normalized = normalizedInvoiceNumber(invoiceNumber);
            const nextKeyRef = db.collection("invoiceNumberKeys").doc(invoiceKey(normalized));
            const nextKeySnapshot = await transaction.get(nextKeyRef);
            if (nextKeySnapshot.exists && nextKeySnapshot.data()?.orderId !== orderId) {
                throw new Error("INVOICE_NUMBER_IN_USE");
            }

            const currentKeyRef = currentNormalized && currentNormalized !== normalized
                ? db.collection("invoiceNumberKeys").doc(invoiceKey(currentNormalized))
                : null;
            const currentKeySnapshot = currentKeyRef ? await transaction.get(currentKeyRef) : null;
            const isCorrection = text(order.invoice?.status) === "invoiced" && currentNumber !== invoiceNumber;

            transaction.set(nextKeyRef, {
                invoiceNumber,
                normalizedNumber: normalized,
                orderId,
                updatedAt: FieldValue.serverTimestamp(),
            });
            if (currentKeyRef && currentKeySnapshot?.data()?.orderId === orderId) {
                transaction.delete(currentKeyRef);
            }
            transaction.update(orderRef, {
                "invoice.status": "invoiced",
                "invoice.number": invoiceNumber,
                "invoice.normalizedNumber": normalized,
                "invoice.invoicedAt": order.invoice?.invoicedAt || FieldValue.serverTimestamp(),
                "invoice.invoicedBy": order.invoice?.invoicedBy || operator,
                "invoice.updatedAt": FieldValue.serverTimestamp(),
                "invoice.updatedBy": operator,
                updatedAt: FieldValue.serverTimestamp(),
                lastUpdatedByOperator: operator,
                operatorHistory: FieldValue.arrayUnion({
                    action: isCorrection ? "invoice_number_changed" : "invoice_marked",
                    operator,
                    previousInvoiceNumber: currentNumber || null,
                    invoiceNumber,
                    occurredAt: new Date(),
                }),
            });
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Registrering av fakturering feila", error);
        const message = error instanceof Error ? error.message : "INVOICE_FAILED";
        const status = message === "UNAUTHORIZED" ? 401
            : message === "FORBIDDEN" ? 403
                : message === "ORDER_NOT_FOUND" ? 404
                    : message === "ORDER_NOT_DELIVERED" || message === "INVOICE_NOT_REGISTERED" || message === "INVOICE_NUMBER_IN_USE" ? 409
                        : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
