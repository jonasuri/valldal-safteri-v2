import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { isAdminEmail } from "@/lib/sandbox";

export const runtime = "nodejs";

type Operator = { id: string; name: string };
type OrderLine = {
    productId: string;
    productName: string;
    variantId: string;
    variantLabel: string;
    brand: "safteri" | "bryggeri";
    category: string | null;
    quantity: number;
    unitPrice: number;
};

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
    return text(value) || null;
}

function parseOperator(value: unknown): Operator | null {
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    const id = text(item.id);
    const name = text(item.name);
    return id && name ? { id, name } : null;
}

function parseLines(value: unknown): OrderLine[] {
    if (!Array.isArray(value) || value.length === 0) throw new Error("INVALID_ORDER_LINES");
    return value.map((raw) => {
        const line = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
        const productId = text(line.productId);
        const productName = text(line.productName);
        const variantId = text(line.variantId);
        const variantLabel = text(line.variantLabel);
        const brand = text(line.brand);
        const quantity = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        if (
            !productId || !productName || !variantId || !variantLabel ||
            (brand !== "safteri" && brand !== "bryggeri") ||
            !Number.isInteger(quantity) || quantity <= 0 ||
            !Number.isFinite(unitPrice) || unitPrice < 0
        ) throw new Error("INVALID_ORDER_LINES");
        return {
            productId,
            productName,
            variantId,
            variantLabel,
            brand,
            category: optionalText(line.category),
            quantity,
            unitPrice,
        };
    });
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
        const isAdmin = isAdminEmail(decoded.email);
        const body = await request.json() as Record<string, unknown>;
        const source = text(body.source) === "manual" ? "manual" : "customer";
        const operator = parseOperator(body.operator);
        if (source === "manual" && (!isAdmin || !operator)) throw new Error("FORBIDDEN");

        const db = getAdminFirestore();
        const customerId = text(body.customerId);
        const customerSnapshot = customerId ? await db.collection("customers").doc(customerId).get() : null;
        if (!isAdmin && (!customerSnapshot?.exists || customerSnapshot.data()?.authUid !== decoded.uid)) {
            throw new Error("FORBIDDEN");
        }
        if (!isAdmin && (customerSnapshot?.data()?.active === false || customerSnapshot?.data()?.profileCompleted !== true)) {
            throw new Error("CUSTOMER_NOT_READY");
        }

        const requestedSandbox = body.sandbox && typeof body.sandbox === "object"
            ? body.sandbox as Record<string, unknown>
            : null;
        const isSandbox = requestedSandbox?.enabled === true;
        if (!isAdmin && isSandbox && customerSnapshot?.data()?.sandbox?.enabled !== true) {
            throw new Error("FORBIDDEN");
        }
        const sandbox = isSandbox ? {
            enabled: true,
            sendEmails: requestedSandbox?.sendEmails === true,
            orderMode: requestedSandbox?.orderMode === "manual" ? "manual" : "customer",
        } : null;

        const lines = parseLines(body.lines);
        const lineCount = lines.length;
        const unitCount = lines.reduce((sum, line) => sum + line.quantity, 0);
        const totalExVat = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
        const customer = customerSnapshot?.data() || {};
        const customerName = isAdmin
            ? text(body.customerName)
            : text(customer.displayName) || text(customer.companyName);
        if (!customerName) throw new Error("INVALID_CUSTOMER");
        const customerDisplayName = isAdmin
            ? text(body.customerDisplayName) || customerName
            : text(customer.displayName) || customerName;
        const customerCompanyName = isAdmin
            ? text(body.customerCompanyName) || customerName
            : text(customer.companyName) || customerName;
        const customerEmail = isAdmin ? text(body.customerEmail) : text(decoded.email);
        const customerType = isAdmin
            ? text(body.customerType)
            : customer.customerType === "grossist" ? "grossist" : "retail";

        const year = osloYear();
        const counterRef = db.collection("orderNumberCounters").doc(isSandbox ? `sandbox-${year}` : String(year));
        const orderRef = db.collection("orders").doc();
        let orderNumber = "";

        await db.runTransaction(async (transaction) => {
            const counterSnapshot = await transaction.get(counterRef);
            const storedSequence = Number(counterSnapshot.data()?.nextSequence);
            const sequence = Number.isInteger(storedSequence) && storedSequence > 0 ? storedSequence : 1;
            const prefix = isSandbox ? "TEST-VS" : "VS";
            orderNumber = `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;

            transaction.set(counterRef, {
                year,
                nextSequence: sequence + 1,
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            transaction.set(orderRef, {
                orderNumber,
                status: "new",
                customerId: customerId || null,
                customerName,
                customerDisplayName,
                customerCompanyName,
                customerEmail,
                customerType,
                customerPhone: isAdmin ? optionalText(body.customerPhone) : optionalText(customer.phone),
                customerContactName: isAdmin ? optionalText(body.customerContactName) : optionalText(customer.contactName),
                organizationNumber: isAdmin ? optionalText(body.organizationNumber) : optionalText(customer.organizationNumber),
                source,
                sandbox,
                note: optionalText(body.note),
                lineCount,
                unitCount,
                totalExVat,
                lines,
                packing: {
                    status: "not_started",
                    lines: lines.map((line) => ({
                        productId: line.productId,
                        variantId: line.variantId,
                        orderedQuantity: line.quantity,
                        packedQuantity: null,
                        missingQuantity: null,
                    })),
                },
                approval: {
                    required: false,
                    status: "not_required",
                    response: null,
                    respondedBy: null,
                    respondedAt: null,
                    message: null,
                },
                backorder: {
                    status: "none",
                    createdFromApproval: null,
                    note: null,
                },
                invoice: {
                    status: "not_invoiced",
                    number: null,
                    invoicedAt: null,
                },
                deliverySignature: null,
                ...(isAdmin && operator ? {
                    createdByOperator: operator,
                    lastUpdatedByOperator: operator,
                    operatorHistory: [{ action: "order_created", operator, occurredAt: new Date() }],
                } : {}),
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
        });

        return NextResponse.json({ ok: true, orderId: orderRef.id, orderNumber });
    } catch (error) {
        console.error("Oppretting av ordre feila", error);
        const message = error instanceof Error ? error.message : "ORDER_CREATE_FAILED";
        const status = message === "UNAUTHORIZED" ? 401
            : message === "FORBIDDEN" ? 403
                : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
