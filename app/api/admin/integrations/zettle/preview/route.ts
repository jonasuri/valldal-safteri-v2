import { NextRequest, NextResponse } from "next/server";
import { getSyncProducts } from "@/lib/productsSync";
import { buildSyncProduct, buildZettleProductPayload, validateSyncProduct } from "@/lib/integrations/zettle/sync";

export async function GET(request: NextRequest) {
    try {
        const sku = request.nextUrl.searchParams.get("sku");
        if (!sku) {
            return NextResponse.json({ error: "Missing sku parameter" }, { status: 400 });
        }

        const products = await getSyncProducts();
        const product = products.find((p) =>
            p.variants.some((variant) => variant.sku === sku)
        );

        if (!product) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        const syncProduct = buildSyncProduct({
            name: product.name,
            category: product.category,
            variants: product.variants
                .filter((variant) => variant.active)
                .map((variant) => ({
                    sku: variant.sku,
                    name: variant.name,
                    barcode: variant.barcode,
                    retailPrice: variant.retailPrice ?? 0,
                })),
        });

        const validation = validateSyncProduct(syncProduct);
        const payload = buildZettleProductPayload(syncProduct);

        return NextResponse.json({
            valid: validation.valid,
            warnings: validation.warnings,
            errors: validation.errors,
            payload,
        });
    } catch (error) {
        console.error("Zettle preview failed", error);
        return NextResponse.json({ error: "Failed to build preview" }, { status: 500 });
    }
}
