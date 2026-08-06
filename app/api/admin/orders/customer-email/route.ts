import { createHash, randomBytes } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { sendCustomerApprovalEmail, sendCustomerOrderConfirmation, sendCustomerPackingSlip } from "@/lib/customerOrderEmail";
import type { ApprovalResponse } from "@/lib/ordersFirestore";

export const runtime = "nodejs";
const ADMIN_EMAILS = new Set(["post@valldalsafteri.no"]);
const TYPES = new Set(["confirmation", "approval", "packing_slip"]);

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function siteUrl() {
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, "")}`;
    return "http://localhost:3000";
}

export async function POST(request: NextRequest) {
    try {
        const authorization = request.headers.get("authorization") || "";
        if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
        const decoded = await getAdminAuth().verifyIdToken(authorization.slice(7));
        if (!decoded.email || !ADMIN_EMAILS.has(decoded.email.trim().toLowerCase())) throw new Error("FORBIDDEN");
        const body = await request.json() as Record<string, unknown>;
        const orderId = text(body.orderId);
        const type = text(body.type);
        if (!orderId || !TYPES.has(type)) throw new Error("INVALID_REQUEST");

        const db = getAdminFirestore();
        const orderRef = db.collection("orders").doc(orderId);
        const snapshot = await orderRef.get();
        if (!snapshot.exists) throw new Error("ORDER_NOT_FOUND");
        const order = snapshot.data() || {};
        if (!text(order.customerEmail)) throw new Error("MISSING_CUSTOMER_EMAIL");

        if (type === "confirmation") {
            await sendCustomerOrderConfirmation(orderId, order);
            await orderRef.update({ "customerEmails.confirmationSentAt": FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        } else if (type === "approval") {
            if (order.packing?.status !== "partial") throw new Error("ORDER_NOT_PARTIAL");
            const token = randomBytes(32).toString("base64url");
            const tokenHash = createHash("sha256").update(token).digest("hex");
            const expiresAt = Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
            await orderRef.update({
                status: "change_requested",
                "approval.required": true,
                "approval.status": "waiting",
                "approval.response": null,
                "approval.respondedAt": null,
                "approval.emailTokenHash": tokenHash,
                "approval.emailTokenExpiresAt": expiresAt,
                "approval.emailTokenUsedAt": null,
                updatedAt: FieldValue.serverTimestamp(),
            });
            const approvalUrl = (choice: ApprovalResponse) => {
                const url = new URL("/order-approval", siteUrl());
                url.searchParams.set("token", token);
                url.searchParams.set("choice", choice);
                return url.toString();
            };
            await sendCustomerApprovalEmail(orderId, { ...order, status: "change_requested" }, approvalUrl);
            await orderRef.update({ "customerEmails.approvalSentAt": FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        } else {
            const status = text(order.status);
            if (!["shipped", "delivered", "picked_up"].includes(status)) throw new Error("INVALID_DELIVERY_STATUS");
            await sendCustomerPackingSlip(orderId, order, status);
            await orderRef.update({ [`customerEmails.packingSlip.${status}SentAt`]: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Sending av kundemelding feila", error);
        const message = error instanceof Error ? error.message : "CUSTOMER_EMAIL_FAILED";
        const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : message === "ORDER_NOT_FOUND" ? 404 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
