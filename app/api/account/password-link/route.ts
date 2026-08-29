import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { sendCustomerPortalAccess } from "@/lib/serverCustomerAccess";

export const runtime = "nodejs";

const ADMIN_EMAILS = ["post@valldalsafteri.no", "jonassolvaguri@gmail.com"];
const GENERIC_RESPONSE = {
    ok: true,
    message: "Dersom e-postadressa er registrert hos oss, sender vi ei passordlenke.",
};

function normalizeEmail(value: unknown) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function requireAdmin(request: NextRequest) {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");

    const decoded = await getAdminAuth().verifyIdToken(authorization.slice(7));
    const email = normalizeEmail(decoded.email);
    if (!email || !ADMIN_EMAILS.includes(email)) throw new Error("FORBIDDEN");
}

async function findCustomer(request: NextRequest, body: Record<string, unknown>) {
    const db = getAdminFirestore();
    const customerId = typeof body.customerId === "string" ? body.customerId.trim() : "";

    if (customerId) {
        await requireAdmin(request);
        const snapshot = await db.collection("customers").doc(customerId).get();
        return snapshot.exists ? snapshot : null;
    }

    const email = normalizeEmail(body.email);
    if (!email) return null;

    const snapshot = await db.collection("customers").where("email", "==", email).limit(2).get();
    if (snapshot.size !== 1) {
        if (snapshot.size > 1) console.error("Fleire kundar har same e-postadresse", email);
        return null;
    }
    return snapshot.docs[0];
}

export async function POST(request: NextRequest) {
    let adminRequest = false;
    try {
        const body = (await request.json()) as Record<string, unknown>;
        adminRequest = typeof body.customerId === "string" && body.customerId.trim().length > 0;
        const customerSnapshot = await findCustomer(request, body);
        if (!customerSnapshot) return NextResponse.json(GENERIC_RESPONSE);

        await sendCustomerPortalAccess(customerSnapshot);

        return NextResponse.json(GENERIC_RESPONSE);
    } catch (error) {
        console.error("Sending av passordlenke feila", error);
        if (!adminRequest) return NextResponse.json(GENERIC_RESPONSE);

        const message = error instanceof Error ? error.message : "PASSWORD_LINK_FAILED";
        const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
