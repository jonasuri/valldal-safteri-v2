import { collection, getDocs } from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
    getSyncProducts,
    type SyncProductRecord,
} from "@/lib/productsSync";

const OPEN_ORDER_STATUSES = new Set([
    "new",
    "processing",
    "partial",
    "change_requested",
]);

export type OpenOrderDemand = {
    sku: string;
    quantity: number;
    orderCount: number;
};

export type UnresolvedOrderLine = {
    orderId: string;
    productId: string;
    variantId: string;
    quantity: number;
};

type RawOrderLine = {
    productId?: unknown;
    variantId?: unknown;
    quantity?: unknown;
    itemNumber?: unknown;
    sku?: unknown;
};

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function positiveQuantity(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value > 0
        ? value
        : 0;
}

export async function fetchOpenOrderDemand(
    knownProducts?: SyncProductRecord[]
): Promise<{
    demand: OpenOrderDemand[];
    unresolvedLines: UnresolvedOrderLine[];
}> {
    const [orderSnapshot, products] = await Promise.all([
        getDocs(collection(db, "orders")),
        knownProducts ? Promise.resolve(knownProducts) : getSyncProducts(),
    ]);

    const skuByVariant = new Map<string, string>();
    for (const product of products) {
        for (const variant of product.variants) {
            if (!variant.sku) continue;
            skuByVariant.set(`${product.id}:${variant.id}`, variant.sku);
        }
    }

    const totals = new Map<string, { quantity: number; orderIds: Set<string> }>();
    const unresolvedLines: UnresolvedOrderLine[] = [];

    for (const orderDoc of orderSnapshot.docs) {
        const order = orderDoc.data();
        const status = text(order.status) || "new";
        if (!OPEN_ORDER_STATUSES.has(status)) continue;

        const lines = Array.isArray(order.lines) ? order.lines as RawOrderLine[] : [];
        for (const line of lines) {
            const quantity = positiveQuantity(line.quantity);
            if (!quantity) continue;

            const productId = text(line.productId);
            const variantId = text(line.variantId);
            const directSku = text(line.itemNumber ?? line.sku);
            const sku = directSku || skuByVariant.get(`${productId}:${variantId}`) || "";

            if (!sku) {
                unresolvedLines.push({
                    orderId: orderDoc.id,
                    productId,
                    variantId,
                    quantity,
                });
                continue;
            }

            const current = totals.get(sku) ?? {
                quantity: 0,
                orderIds: new Set<string>(),
            };
            current.quantity += quantity;
            current.orderIds.add(orderDoc.id);
            totals.set(sku, current);
        }
    }

    return {
        demand: [...totals.entries()]
            .map(([sku, value]) => ({
                sku,
                quantity: value.quantity,
                orderCount: value.orderIds.size,
            }))
            .sort((a, b) => a.sku.localeCompare(b.sku, "nb-NO")),
        unresolvedLines,
    };
}
