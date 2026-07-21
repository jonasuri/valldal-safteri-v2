import { NextRequest, NextResponse } from "next/server";
import {
    previewPriceUpdates,
    updatePrices,
} from "@/lib/integrations/zettle/prices";

export async function GET(request: NextRequest) {
    try {
        const selectedSkus = request.nextUrl.searchParams
            .getAll("sku")
            .flatMap((value) => value.split(","))
            .map((value) => value.trim())
            .filter(Boolean);

        const result = await previewPriceUpdates(selectedSkus);

        return NextResponse.json({
            dryRun: true,
            selectedSkus,
            ...result,
        });
    } catch (error) {
        console.error("Zettle price dry-run failed", error);
        return NextResponse.json(
            { error: "Failed to prepare price update." },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as { skus?: string[] };

        const skus = (body.skus ?? [])
            .map((sku) => sku.trim())
            .filter(Boolean);

        if (skus.length === 0) {
            return NextResponse.json(
                { error: "Ingen SKU-ar vart sende inn." },
                { status: 400 }
            );
        }

        const result = await updatePrices(skus);

        return NextResponse.json(result, {
            status: result.updatedCount > 0 ? 200 : 422,
        });
    } catch (error) {
        console.error("Failed to prepare Zettle price update", error);

        return NextResponse.json(
            { error: "Kunne ikkje førebu prisoppdatering." },
            { status: 500 }
        );
    }
}
