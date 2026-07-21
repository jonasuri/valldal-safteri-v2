
import { NextResponse } from "next/server";

import { getZettleAccessToken } from "@/lib/integrations/zettle/auth";

const PRODUCT_ENDPOINTS_TO_TEST = [
    "https://products.izettle.com/organizations/self/products",
    "https://products.izettle.com/organizations/self/library/products",
    "https://products.izettle.com/v2/organizations/self/products",
];

async function testEndpoint(url: string, accessToken: string) {
    const response = await fetch(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
        },
        cache: "no-store",
    });

    const text = await response.text();

    let json: unknown = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }

    return {
        url,
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get("content-type"),
        rawPreview: text.slice(0, 1000),
        json,
    };
}

export async function GET() {
    try {
        const accessToken = await getZettleAccessToken();

        const endpointResults = await Promise.all(
            PRODUCT_ENDPOINTS_TO_TEST.map((url) => testEndpoint(url, accessToken))
        );

        return NextResponse.json({
            token: {
                ok: true,
                preview: `${accessToken.slice(0, 8)}...${accessToken.slice(-8)}`,
            },
            endpoints: endpointResults,
        });
    } catch (error) {
        console.error("Zettle debug failed", error);

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}