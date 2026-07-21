import { NextRequest, NextResponse } from "next/server";
import {
    addVariantToZettle,
    previewVariantPlacement,
} from "@/lib/integrations/zettle/variants";

export async function GET(request: NextRequest) {
    try {
        const sku = request.nextUrl.searchParams.get("sku")?.trim();
        if (!sku) {
            return NextResponse.json({ error: "Manglar SKU." }, { status: 400 });
        }

        return NextResponse.json(await previewVariantPlacement(sku));
    } catch (error) {
        console.error("Zettle variant preview failed", error);
        return NextResponse.json(
            {
                error: error instanceof Error
                    ? error.message
                    : "Kunne ikkje førehandssjekke varianten.",
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as { sku?: string };
        const sku = body.sku?.trim();

        if (!sku) {
            return NextResponse.json({ error: "Manglar SKU." }, { status: 400 });
        }

        return NextResponse.json(await addVariantToZettle(sku));
    } catch (error) {
        console.error("Zettle variant update failed", error);
        return NextResponse.json(
            {
                error: error instanceof Error
                    ? error.message
                    : "Kunne ikkje leggje varianten til i Zettle.",
            },
            { status: 500 }
        );
    }
}
