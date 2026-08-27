import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { isAdminEmail } from "@/lib/sandbox";

export const runtime = "nodejs";

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

function osloYear() {
    return Number(new Intl.DateTimeFormat("en", {
        year: "numeric",
        timeZone: "Europe/Oslo",
    }).format(new Date()));
}

export async function POST(request: NextRequest) {
    try {
        const authorization = request.headers.get("authorization") || "";
        if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
        const decoded = await getAdminAuth().verifyIdToken(authorization.slice(7));
        if (!isAdminEmail(decoded.email)) throw new Error("FORBIDDEN");

        const body = await request.json() as Record<string, unknown>;
        const orderId = text(body.orderId);
        const operator = parseOperator(body.operator);
        if (!orderId) throw new Error("INVALID_REQUEST");

        const db = getAdminFirestore();
        const ref = db.collection("orders").doc(orderId);
        let confirmedOrderNumber = "";

        await db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(ref);
            if (!snapshot.exists) throw new Error("ORDER_NOT_FOUND");
            const order = snapshot.data() || {};
            const status = text(order.status);
            if (status !== "new" && status !== "processing") throw new Error("ORDER_CANNOT_BE_CONFIRMED");

            confirmedOrderNumber = text(order.orderNumber);
            const update: Record<string, unknown> = {
                status: "processing",
                updatedAt: FieldValue.serverTimestamp(),
                lastUpdatedByOperator: operator,
                operatorHistory: FieldValue.arrayUnion({
                    action: "order_confirmed",
                    operator,
                    occurredAt: new Date(),
                }),
            };

            // Older orders may have been created before automatic numbering.
            if (!confirmedOrderNumber) {
                const year = osloYear();
                const isSandbox = order.sandbox?.enabled === true;
                const counterRef = db.collection("orderNumberCounters").doc(
                    isSandbox ? `sandbox-${year}` : String(year)
                );
                const counterSnapshot = await transaction.get(counterRef);
                const storedSequence = Number(counterSnapshot.data()?.nextSequence);
                const sequence = Number.isInteger(storedSequence) && storedSequence > 0 ? storedSequence : 1;
                const prefix = isSandbox ? "TEST-VS" : "VS";
                confirmedOrderNumber = `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
                update.orderNumber = confirmedOrderNumber;
                transaction.set(counterRef, {
                    year,
                    nextSequence: sequence + 1,
                    updatedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
            }

            transaction.update(ref, update);
        });

        return NextResponse.json({
            ok: true,
            orderNumber: confirmedOrderNumber,
            status: "processing",
        });
    } catch (error) {
        console.error("Stadfesting av ordre feila", error);
        const message = error instanceof Error ? error.message : "ORDER_CONFIRMATION_FAILED";
        const status = message === "UNAUTHORIZED" ? 401
            : message === "FORBIDDEN" ? 403
                : message === "ORDER_NOT_FOUND" ? 404
                    : message === "ORDER_CANNOT_BE_CONFIRMED" ? 409
                        : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
