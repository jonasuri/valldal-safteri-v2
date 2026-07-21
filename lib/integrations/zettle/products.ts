import { zettleRequest } from "./client";
import { ZettleProduct } from "./types";

export type ZettleRawVariant = {
    uuid: string;
    name?: string | null;
    sku?: string | null;
    barcode?: string | null;
    price?: {
        amount: number;
        currencyId?: string;
    } | null;
    options?: Array<{
        name: string;
        value: string;
    }> | null;
    [key: string]: unknown;
};

export type ZettleRawProduct = {
    uuid: string;
    name: string;
    etag?: string;
    category?: { name?: string } | null;
    variants?: ZettleRawVariant[] | null;
    variantOptionDefinitions?: {
        definitions?: Array<{
            name: string;
            properties?: Array<{
                value: string;
                imageUrl?: string | null;
            }> | null;
        }> | null;
    } | null;
    [key: string]: unknown;
};

export async function fetchRawZettleProduct(productId: string): Promise<ZettleRawProduct> {
    return zettleRequest<ZettleRawProduct>(`/organizations/self/products/${productId}`);
}

export async function fetchZettleProducts(): Promise<ZettleProduct[]> {
    const products = await zettleRequest<ZettleRawProduct[]>("/organizations/self/products");

    return products.map((product) => ({
        id: product.uuid,
        name: product.name,
        category: product.category?.name,
        variants: (product.variants ?? []).map((variant) => ({
            id: variant.uuid,
            sku: variant.sku ?? "",
            name: variant.name ?? "",
            barcode: variant.barcode ?? undefined,
            retailPrice: (variant.price?.amount ?? 0) / 100,
            currency: variant.price?.currencyId,
        })),
    }));
}

export async function updateZettleProduct(
    productId: string,
    product: ZettleRawProduct
): Promise<void> {
    if (!product.etag) {
        throw new Error(`Manglar ETag for Zettle-produkt ${productId}.`);
    }

    if (!product.variants?.length) {
        throw new Error(`Zettle-produkt ${productId} har ingen variantar.`);
    }

    await zettleRequest<void>(`/organizations/self/products/v2/${productId}`, {
        method: "PUT",
        headers: {
            "If-Match": product.etag.startsWith('"')
                ? product.etag
                : `"${product.etag}"`,
        },
        body: {
            uuid: product.uuid,
            name: product.name,
            variants: product.variants,
            ...(product.variantOptionDefinitions !== undefined
                ? { variantOptionDefinitions: product.variantOptionDefinitions }
                : {}),
        },
    });
}
