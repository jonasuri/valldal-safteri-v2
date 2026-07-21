import { NextResponse } from "next/server";
import { getDocs, collection } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { fetchZettleProducts } from "@/lib/integrations/zettle/products";
import { compareProducts } from "@/lib/integrations/zettle/compare";
import { ValldalVariantForZettle } from "@/lib/integrations/zettle/types";

export async function GET() {
    try {
        const snapshot = await getDocs(collection(db, "products"));

        const valldalVariants: ValldalVariantForZettle[] = [];

        snapshot.forEach((doc) => {
            const product = doc.data() as any;

            for (const variant of product.variants ?? []) {
                valldalVariants.push({
                    productId: doc.id,
                    productName: product.name ?? "",
                    variantId: variant.id,
                    variantName: variant.label ?? "",
                    sku: String(variant.itemNumber ?? variant.sku ?? "").trim(),
                    barcode: variant.barcode,
                    retailPrice: Number(variant.prices?.retail ?? variant.price ?? 0),
                    productActive: product.active !== false,
                    variantActive: variant.active !== false,
                });
            }
        });

        const zettleProducts = await fetchZettleProducts();
        const comparison = compareProducts(valldalVariants, zettleProducts);

        return NextResponse.json(comparison);
    } catch (error) {
        console.error("Zettle comparison failed", error);

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
