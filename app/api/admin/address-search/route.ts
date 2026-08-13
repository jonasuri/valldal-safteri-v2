import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
    await getAdminAuth().verifyIdToken(authorization.slice(7));
    const query = request.nextUrl.searchParams.get("q")?.trim() || "";
    if (query.length < 3) return NextResponse.json({ items: [] });
    const response = await fetch(
      `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(query)}&treffPerSide=8&side=0`,
      { next: { revalidate: 86400 } },
    );
    if (!response.ok) throw new Error("ADDRESS_FAILED");
    const body = await response.json();
    const items = (body.adresser || []).map((item: any) => ({
      address: [item.adressetekst, item.postnummer, item.poststed]
        .filter(Boolean)
        .join(", "),
      streetAddress: item.adressetekst || "",
      postalCode: item.postnummer || "",
      city: item.poststed || "",
      lat: item.representasjonspunkt?.lat ?? null,
      lng: item.representasjonspunkt?.lon ?? null,
    }));
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "FAILED" },
      { status: 400 },
    );
  }
}
