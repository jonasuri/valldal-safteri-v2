// app/api/geocode/route.ts
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const address = typeof body.address === "string" ? body.address.trim() : "";

        if (!address) {
            return new Response(
                JSON.stringify({ error: "Mangler adresse" }),
                { status: 400 }
            );
        }

        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            address
        )}&limit=1`;

        const res = await fetch(url, {
            headers: {
                "User-Agent": "ValldalSafteri/1.0 (kontakt@valldalsafteri.no)",
            },
        });

        if (!res.ok) {
            return new Response(
                JSON.stringify({ error: "Feil ved geokoding" }),
                { status: 500 }
            );
        }

        const data = (await res.json()) as any[];

        if (!data || data.length === 0) {
            return new Response(
                JSON.stringify({ error: "Fann ingen koordinatar for adressa" }),
                { status: 404 }
            );
        }

        const first = data[0];

        const lat = parseFloat(first.lat);
        const lng = parseFloat(first.lon);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            return new Response(
                JSON.stringify({ error: "Ugyldige koordinatar frå tenesta" }),
                { status: 500 }
            );
        }

        return new Response(JSON.stringify({ lat, lng }), { status: 200 });
    } catch (err) {
        console.error("Feil i /api/geocode:", err);
        return new Response(
            JSON.stringify({ error: "Uventa feil ved geokoding" }),
            { status: 500 }
        );
    }
}