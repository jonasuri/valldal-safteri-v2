import { FieldValue, type Firestore } from "firebase-admin/firestore";

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

export async function ensureBackorderForOrder(db: Firestore, orderId: string) {
    const orderRef = db.collection("orders").doc(orderId);
    const backorderRef = db.collection("orders").doc(`backorder-${orderId}`);

    return db.runTransaction(async (transaction) => {
        const [orderSnapshot, backorderSnapshot] = await Promise.all([
            transaction.get(orderRef),
            transaction.get(backorderRef),
        ]);
        if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");

        const order = orderSnapshot.data() || {};
        if (order.approval?.status !== "answered" || order.approval?.response !== "deliver_partial_later") {
            return null;
        }
        if (backorderSnapshot.exists) {
            if (order.backorder?.status !== "created" || order.backorder?.createdOrderId !== backorderRef.id) {
                transaction.update(orderRef, {
                    "backorder.status": "created",
                    "backorder.createdOrderId": backorderRef.id,
                    updatedAt: FieldValue.serverTimestamp(),
                });
            }
            return backorderRef.id;
        }

        const packingLines = Array.isArray(order.packing?.lines) ? order.packing.lines : [];
        const packingByKey = new Map(packingLines.map((line: Record<string, unknown>) => [
            `${text(line.productId)}:${text(line.variantId)}`,
            line,
        ]));
        const missingLines = (Array.isArray(order.lines) ? order.lines : []).flatMap((line: Record<string, unknown>) => {
            const key = `${text(line.productId)}:${text(line.variantId)}`;
            const packingLine = packingByKey.get(key) as Record<string, unknown> | undefined;
            const orderedQuantity = Number(line.quantity) || 0;
            const packedQuantity = Number(packingLine?.packedQuantity) || 0;
            const missingQuantity = typeof packingLine?.missingQuantity === "number"
                ? Math.max(0, Number(packingLine.missingQuantity))
                : Math.max(0, orderedQuantity - packedQuantity);
            return missingQuantity > 0 ? [{ ...line, quantity: missingQuantity }] : [];
        });

        if (!missingLines.length) {
            transaction.update(orderRef, {
                "backorder.status": "none",
                updatedAt: FieldValue.serverTimestamp(),
            });
            return null;
        }

        const lineCount = missingLines.length;
        const unitCount = missingLines.reduce((sum: number, line: Record<string, unknown>) => sum + Number(line.quantity), 0);
        const totalExVat = missingLines.reduce(
            (sum: number, line: Record<string, unknown>) => sum + Number(line.quantity) * Number(line.unitPrice),
            0
        );

        transaction.set(backorderRef, {
            orderNumber: null,
            status: "new",
            customerId: order.customerId ?? null,
            customerName: order.customerName ?? "",
            customerDisplayName: order.customerDisplayName ?? order.customerName ?? "",
            customerCompanyName: order.customerCompanyName ?? order.customerName ?? "",
            customerEmail: order.customerEmail ?? "",
            customerType: order.customerType ?? "retail",
            customerPhone: order.customerPhone ?? "",
            customerContactName: order.customerContactName ?? "",
            organizationNumber: order.organizationNumber ?? "",
            source: order.sandbox?.enabled === true ? order.sandbox.orderMode : "manual",
            sandbox: order.sandbox?.enabled === true ? order.sandbox : null,
            lineCount,
            unitCount,
            totalExVat,
            lines: missingLines,
            isBackorder: true,
            parentOrderId: orderId,
            parentOrderNumber: order.orderNumber ?? null,
            packing: {
                status: "not_started",
                lines: missingLines.map((line: Record<string, unknown>) => ({
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
                normalizedNumber: null,
                invoicedAt: null,
            },
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(orderRef, {
            "backorder.status": "created",
            "backorder.createdOrderId": backorderRef.id,
            "backorder.createdAt": FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        return backorderRef.id;
    });
}
