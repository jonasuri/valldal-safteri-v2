import { NextRequest, NextResponse } from "next/server";

import { previewZettleInventoryChanges } from "@/lib/integrations/zettle/purchases";

function validDate(value: string) {
    return /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && !Number.isNaN(Date.parse(value));
}

export async function GET(request: NextRequest) {
    try {
        const startDate = request.nextUrl.searchParams.get("startDate")?.trim() ?? "";
        const endDate = request.nextUrl.searchParams.get("endDate")?.trim() || undefined;

        if (!validDate(startDate) || (endDate && !validDate(endDate))) {
            return NextResponse.json(
                { error: "Oppgi gyldig startdato, til dømes 2026-07-21." },
                { status: 400 }
            );
        }

        return NextResponse.json(
            await previewZettleInventoryChanges({ startDate, endDate })
        );
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Kunne ikkje hente Zettle-sal." },
            { status: 500 }
        );
    }
}
