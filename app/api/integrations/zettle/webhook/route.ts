import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { bookZettlePurchase } from "@/lib/inventory/zettleWebhook";

export const runtime = "nodejs";

function validSignature(input: {
    timestamp: string;
    payload: unknown;
    signature: string;
    signingKey: string;
}) {
    const payload = typeof input.payload === "string"
        ? input.payload
        : JSON.stringify(input.payload);
    const expected = createHmac("sha256", input.signingKey)
        .update(`${input.timestamp}.${payload}`, "utf8")
        .digest("hex");
    const receivedBuffer = Buffer.from(input.signature, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    return receivedBuffer.length === expectedBuffer.length &&
        timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function GET() {
    return NextResponse.json({ ok: true, service: "zettle-purchase-webhook" });
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const event = JSON.parse(rawBody) as {
            eventName?: unknown;
            messageId?: unknown;
            timestamp?: unknown;
            payload?: unknown;
        };
        const eventName = typeof event.eventName === "string" ? event.eventName : "";

        // Zettle sender ei testmelding når abonnementet blir oppretta.
        if (eventName === "TestMessage") {
            return NextResponse.json({ ok: true });
        }
        if (eventName !== "PurchaseCreated") {
            return NextResponse.json({ ok: true, ignored: true });
        }

        const signingKey = process.env.ZETTLE_WEBHOOK_SIGNING_KEY
            ?.trim()
            .replace(/^["']|["']$/g, "");
        const signature = request.headers.get("x-izettle-signature") ?? "";
        const timestamp = typeof event.timestamp === "string" ? event.timestamp : "";
        if (!signingKey || !signature || !timestamp || !validSignature({
            timestamp,
            payload: event.payload,
            signature,
            signingKey,
        })) {
            return NextResponse.json({ error: "Ugyldig Zettle-signatur." }, { status: 401 });
        }

        const payload = typeof event.payload === "string"
            ? JSON.parse(event.payload)
            : event.payload;
        const result = await bookZettlePurchase(
            payload as Record<string, unknown>,
            typeof event.messageId === "string" ? event.messageId : "ukjend-melding"
        );
        return NextResponse.json({ ok: true, ...result });
    } catch (error) {
        console.error("Zettle webhook failed", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Webhook-feil." },
            { status: 500 }
        );
    }
}
