

import { compareProducts } from "@/lib/integrations/zettle/compare";
import {
    fetchRawZettleProduct,
    fetchZettleProducts,
    updateZettleProduct,
} from "@/lib/integrations/zettle/products";
import type { ZettleRawProduct } from "@/lib/integrations/zettle/products";
import { getSyncProducts } from "@/lib/productsSync";
import type { ValldalVariantForZettle } from "@/lib/integrations/zettle/types";

export type PriceUpdatePreview = {
    sku: string;
    productName?: string;
    variantName?: string;
    valldalProductId?: string;
    valldalVariantId?: string;
    zettleProductId?: string;
    zettleVariantId?: string;
    from?: number;
    to?: number;
};

export type PriceUpdatePayloadPreview = {
    productId: string;
    sku: string;
    before: ZettleRawProduct;
    after: ZettleRawProduct;
};

export type PriceUpdateResult = {
    sku: string;
    success: boolean;
    from?: number;
    to?: number;
    error?: string;
};

export async function previewPriceUpdates(selectedSkus?: string[]) {
    const valldalProducts = await getSyncProducts();

    const valldalVariants: ValldalVariantForZettle[] = valldalProducts
        .filter((product) => product.active)
        .flatMap((product) =>
            product.variants
                .filter((variant) => variant.active)
                .map((variant) => ({
                    productId: product.id,
                    productName: product.name,
                    variantId: variant.id,
                    variantName: variant.name,
                    sku: variant.sku,
                    barcode: variant.barcode,
                    retailPrice: variant.retailPrice ?? 0,
                    productActive: product.active,
                    variantActive: variant.active,
                }))
        );

    const zettleProducts = await fetchZettleProducts();
    const comparison = compareProducts(valldalVariants, zettleProducts);

    const skuFilter = selectedSkus?.length ? new Set(selectedSkus) : null;

    const updates: PriceUpdatePreview[] = comparison.differences
        .filter((diff) => diff.type === "price_mismatch")
        .filter((diff) => !skuFilter || skuFilter.has(diff.sku))
        .map((diff) => ({
            sku: diff.sku,
            productName: diff.valldal?.productName,
            variantName: diff.valldal?.variantName,
            valldalProductId: diff.valldal?.productId,
            valldalVariantId: diff.valldal?.variantId,
            zettleProductId: diff.zettle?.productId,
            zettleVariantId: diff.zettle?.id,
            from: diff.zettle?.retailPrice,
            to: diff.valldal?.retailPrice,
        }));

    return {
        updateCount: updates.length,
        updates,
    };
}

export async function buildPriceUpdatePayload(
    update: PriceUpdatePreview
): Promise<PriceUpdatePayloadPreview> {
    if (!update.zettleProductId || !update.zettleVariantId) {
        throw new Error(`Manglar Zettle-ID for SKU ${update.sku}.`);
    }

    if (typeof update.to !== "number" || !Number.isFinite(update.to) || update.to <= 0) {
        throw new Error(`SKU ${update.sku} har ikkje ein gyldig utsalspris.`);
    }

    const product = await fetchRawZettleProduct(update.zettleProductId);

    const before = structuredClone(product);
    const after = structuredClone(product);

    if (!after.variants) {
        throw new Error(`Produktet ${update.zettleProductId} har ingen variantar.`);
    }

    const variant = after.variants.find(
        (item) => item.uuid === update.zettleVariantId
    );

    if (!variant) {
        throw new Error(`Fann ikkje variant ${update.zettleVariantId}.`);
    }

    variant.price = {
        amount: Math.round((update.to ?? 0) * 100),
        currencyId: "NOK",
    };

    return {
        productId: update.zettleProductId,
        sku: update.sku,
        before,
        after,
    };
}

export async function updatePrices(_selectedSkus: string[]) {
    const selectedSkus = Array.from(
        new Set(_selectedSkus.map((sku) => sku.trim()).filter(Boolean))
    );

    if (selectedSkus.length === 0) {
        throw new Error("Ingen SKU-ar vart valde.");
    }

    const preview = await previewPriceUpdates(selectedSkus);
    const updatesBySku = new Map(preview.updates.map((update) => [update.sku, update]));
    const results: PriceUpdateResult[] = [];

    for (const sku of selectedSkus) {
        const update = updatesBySku.get(sku);

        if (!update) {
            results.push({
                sku,
                success: false,
                error: "SKU-en har ikkje eit prisavvik eller finst ikkje i begge system.",
            });
            continue;
        }

        try {
            const payload = await buildPriceUpdatePayload(update);
            await updateZettleProduct(payload.productId, payload.after);

            results.push({
                sku,
                success: true,
                from: update.from,
                to: update.to,
            });
        } catch (error) {
            results.push({
                sku,
                success: false,
                from: update.from,
                to: update.to,
                error: error instanceof Error ? error.message : "Ukjend feil.",
            });
        }
    }

    return {
        requestedCount: selectedSkus.length,
        updatedCount: results.filter((result) => result.success).length,
        failedCount: results.filter((result) => !result.success).length,
        results,
    };
}
