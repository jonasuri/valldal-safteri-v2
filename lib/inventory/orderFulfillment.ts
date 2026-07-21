import { serverTimestamp } from "firebase/firestore";

import { recordInventoryMovements } from "@/lib/inventory/firestore";
import { DEFAULT_INVENTORY_LOCATION } from "@/lib/inventory/types";
import { getSyncProducts } from "@/lib/productsSync";

export type PackedOrderLine = {
    productId: string;
    variantId: string;
    packedQuantity: number | null;
};

export async function postPackedOrderInventory(
    orderId: string,
    packingLines: PackedOrderLine[]
) {
    const products = await getSyncProducts();
    const productById = new Map(products.map((product) => [product.id, product]));
    const quantitiesByVariant = new Map<string, PackedOrderLine>();

    for (const line of packingLines) {
        const key = `${line.productId}:${line.variantId}`;
        const current = quantitiesByVariant.get(key);
        quantitiesByVariant.set(key, {
            ...line,
            packedQuantity:
                (current?.packedQuantity ?? 0) + (line.packedQuantity ?? 0),
        });
    }

    const movements = [...quantitiesByVariant.values()].flatMap((line) => {
        const quantity = line.packedQuantity ?? 0;
        if (!Number.isInteger(quantity) || quantity < 0) {
            throw new Error("Pakka mengd må vere eit positivt heilt tal.");
        }
        if (quantity === 0) return [];

        const product = productById.get(line.productId);
        const variant = product?.variants.find((item) => item.id === line.variantId);
        if (!product || !variant?.sku) {
            throw new Error(
                `Fann ikkje varenummer for ordrelinja ${line.productId}/${line.variantId}.`
            );
        }

        return [{
            sku: variant.sku,
            quantity: -quantity,
            type: "order_fulfillment" as const,
            source: "order" as const,
            idempotencyKey: `order:${orderId}:packed:${line.productId}:${line.variantId}`,
            locationId: DEFAULT_INVENTORY_LOCATION,
            productId: product.id,
            variantId: variant.id,
            productName: product.name,
            variantName: variant.name,
            sourceId: orderId,
            note: "Trekt frå lager ved fullført pakking.",
            metadata: { orderId, packedQuantity: quantity },
        }];
    });

    const result = await recordInventoryMovements(movements);

    return {
        status: "posted",
        postedAt: serverTimestamp(),
        movementIds: [
            ...result.recorded.map((item) => item.movementId),
            ...result.skipped.flatMap((item) => item.movementId ? [item.movementId] : []),
        ],
        lineCount: movements.length,
        unitCount: movements.reduce((sum, movement) => sum - movement.quantity, 0),
    };
}
