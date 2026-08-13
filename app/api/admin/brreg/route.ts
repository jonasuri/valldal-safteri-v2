import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
    await getAdminAuth().verifyIdToken(authorization.slice(7));
    const query = request.nextUrl.searchParams.get("q")?.trim() || "";
    if (query.length < 2) return NextResponse.json({ items: [] });
    const digits = query.replace(/\D/g, "");
    const url =
      digits.length === 9
        ? `https://data.brreg.no/enhetsregisteret/api/enheter/${digits}`
        : `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(query)}&size=8`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.brreg.enhetsregisteret.enhet.v2+json",
      },
      next: { revalidate: 3600 },
    });
    if (response.status === 404) return NextResponse.json({ items: [] });
    if (!response.ok) throw new Error("BRREG_FAILED");
    const body = await response.json();
    const units = body._embedded?.enheter || [body];
    const items = units.map((unit: any) => {
      const address = unit.forretningsadresse || unit.postadresse || {};
      return {
        organizationNumber: unit.organisasjonsnummer || "",
        name: unit.navn || "",
        address: [
          address.adresse?.join(", "),
          address.postnummer,
          address.poststed,
        ]
          .filter(Boolean)
          .join(", "),
        postalCode: address.postnummer || "",
        city: address.poststed || "",
        active: !unit.slettedato,
      };
    });
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "FAILED" },
      { status: 400 },
    );
  }
}
