import { arrayUnion, deleteField, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { postPackedOrderInventory } from "@/lib/inventory/orderFulfillment";
import { getStoredOperator, requireActiveOperator, type OperatorStamp } from "@/lib/adminOperators";

export type OrderStatus =
    | "new"
    | "processing"
    | "packed"
    | "partial"
    | "picked_up"
    | "shipped"
    | "delivered"
    | "change_requested"
    | "cancelled";

export type PackingStatus = "not_started" | "complete" | "partial";

export type ApprovalStatus = "not_required" | "waiting" | "answered";

export type ApprovalResponse =
    | "deliver_partial_later"
    | "deliver_partial_cancel_rest"
    | "wait_for_complete";

export type ApprovalRespondedBy = "customer" | "admin";

export type BackorderStatus = "none" | "open" | "cancelled" | "waiting_for_stock";


export type InvoiceStatus = "not_invoiced" | "invoiced";

export type DeliverySignatureInput = {
    signedBy?: string;
    signatureDataUrl?: string;
    deliveryType: "shipped" | "delivered" | "picked_up";
};

export type OrderLineInput = {
    productId: string;
    productName: string;
    variantId: string;
    variantLabel: string;
    brand: "safteri" | "bryggeri";
    category?: string | null;
    quantity: number;
    unitPrice: number;
};

export type CreateOrderInput = {
    customerId: string | null;
    customerName: string;
    customerDisplayName?: string;
    customerCompanyName?: string;
    customerEmail: string;
    customerType: string;
    customerPhone?: string | null;
    customerContactName?: string | null;
    organizationNumber?: string | null;
    source?: "customer" | "manual";
    sandbox?: {
        enabled: boolean;
        sendEmails: boolean;
        orderMode: "customer" | "manual";
    };
    note?: string | null;
    lines: OrderLineInput[];
    totalExVat: number;
    lineCount: number;
    unitCount: number;
};

function buildPackingLines(lines: OrderLineInput[]) {
    return lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        orderedQuantity: line.quantity,
        packedQuantity: null,
        missingQuantity: null,
    }));
}

function calculateOrderTotals(lines: OrderLineInput[]) {
    return {
        lineCount: lines.length,
        unitCount: lines.reduce((sum, line) => sum + line.quantity, 0),
        totalExVat: lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    };
}

function operatorEvent(operator: OperatorStamp, action: string) {
    return { action, operator, occurredAt: new Date() };
}

export async function createOrder(input: CreateOrderInput) {
    const user = auth.currentUser;
    if (!user) throw new Error("UNAUTHORIZED");
    const operator = input.source === "manual" ? requireActiveOperator() : getStoredOperator();
    const token = await user.getIdToken();
    const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...input, operator }),
    });
    const result = await response.json().catch(() => ({})) as { orderId?: string; error?: string };
    if (!response.ok || !result.orderId) {
        throw new Error(result.error || `ORDER_CREATE_${response.status}`);
    }
    return result.orderId;
}

export async function updateOrderLines(orderId: string, lines: OrderLineInput[]) {
    const operator = requireActiveOperator();
    const totals = calculateOrderTotals(lines);

    await updateDoc(doc(db, "orders", orderId), {
        lines,
        lineCount: totals.lineCount,
        unitCount: totals.unitCount,
        totalExVat: totals.totalExVat,
        packing: {
            status: "not_started" as PackingStatus,
            lines: buildPackingLines(lines),
        },
        lastUpdatedByOperator: operator,
        operatorHistory: arrayUnion(operatorEvent(operator, "order_lines_updated")),
        updatedAt: serverTimestamp(),
    });
}

export async function submitOrderApprovalResponse(
    orderId: string,
    response: ApprovalResponse,
    respondedBy: ApprovalRespondedBy = "customer"
) {
    const operator = respondedBy === "admin" ? requireActiveOperator() : getStoredOperator();
    const nextStatus: OrderStatus = response === "wait_for_complete" ? "processing" : "packed";
    const orderRef = doc(db, "orders", orderId);
    const inventoryFulfillment = response === "wait_for_complete"
        ? null
        : await (async () => {
            const snapshot = await getDoc(orderRef);
            if (!snapshot.exists()) throw new Error("Fann ikkje ordren.");
            const data = snapshot.data();
            const lines = Array.isArray(data.packing?.lines) ? data.packing.lines : [];
            return postPackedOrderInventory(orderId, lines);
        })();

    const backorderStatus: BackorderStatus =
        response === "deliver_partial_later"
            ? "open"
            : response === "deliver_partial_cancel_rest"
                ? "cancelled"
                : "waiting_for_stock";

    await updateDoc(orderRef, {
        status: nextStatus,
        "approval.status": "answered" as ApprovalStatus,
        "approval.response": response,
        "approval.respondedBy": respondedBy,
        "approval.respondedAt": serverTimestamp(),
        "backorder.status": backorderStatus,
        "backorder.createdFromApproval": response,
        ...(operator ? {
            lastUpdatedByOperator: operator,
            operatorHistory: arrayUnion(operatorEvent(operator, "approval_registered")),
        } : {}),
        ...(inventoryFulfillment ? { inventoryFulfillment } : {}),
        updatedAt: serverTimestamp(),
    });
}

export async function saveDeliverySignature(
    orderId: string,
    input: DeliverySignatureInput
) {
    const operator = requireActiveOperator();
    await updateDoc(doc(db, "orders", orderId), {
        status: input.deliveryType,
        deliverySignature: input.signatureDataUrl
            ? {
                signedBy: input.signedBy || "",
                signatureDataUrl: input.signatureDataUrl,
                deliveryType: input.deliveryType,
                signedAt: serverTimestamp(),
            }
            : deleteField(),
        lastUpdatedByOperator: operator,
        operatorHistory: arrayUnion(operatorEvent(operator, `order_${input.deliveryType}`)),
        updatedAt: serverTimestamp(),
    });
}
