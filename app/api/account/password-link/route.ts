import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { sendCustomerAccessEmail } from "@/lib/customerAccessEmail";

export const runtime = "nodejs";

const ADMIN_EMAILS = ["post@valldalsafteri.no"];
const GENERIC_RESPONSE = {
    ok: true,
    message: "Dersom e-postadressa er registrert hos oss, sender vi ei passordlenke.",
};

function normalizeEmail(value: unknown) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function siteUrl() {
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, "")}`;
    }
    return "http://localhost:3000";
}

function customResetUrl(firebaseLink: string) {
    const generated = new URL(firebaseLink);
    const code = generated.searchParams.get("oobCode");
    if (!code) throw new Error("INVALID_RESET_LINK");

    const target = new URL("/auth/action", siteUrl());
    target.searchParams.set("mode", "resetPassword");
    target.searchParams.set("oobCode", code);
    target.searchParams.set("lang", "nn");
    return target.toString();
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

        const customer = customerSnapshot.data();
        if (!customer) return NextResponse.json(GENERIC_RESPONSE);
        const email = normalizeEmail(customer.email);
        if (!email || customer.active === false) return NextResponse.json(GENERIC_RESPONSE);

        const auth = getAdminAuth();
        let authUser;
        try {
            authUser = await auth.getUserByEmail(email);
        } catch (error: unknown) {
            if (
                typeof error !== "object" ||
                error === null ||
                !("code" in error) ||
                error.code !== "auth/user-not-found"
            ) {
                throw error;
            }

            authUser = await auth.createUser({
                email,
                displayName:
                    String(customer.contactName || "").trim() ||
                    String(customer.displayName || customer.companyName || "").trim(),
                emailVerified: false,
                disabled: false,
            });
        }

        const storedUid = String(customer.authUid || "").trim();
        if (storedUid !== authUser.uid || customer.customerSource !== "registered") {
            await customerSnapshot.ref.set(
                {
                    authUid: authUser.uid,
                    customerSource: "registered",
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
        }

        const firebaseLink = await auth.generatePasswordResetLink(email);
        await sendCustomerAccessEmail({
            email,
            name:
                String(customer.contactName || "").trim() ||
                String(customer.displayName || customer.companyName || "").trim(),
            resetUrl: customResetUrl(firebaseLink),
        });

        await customerSnapshot.ref.set(
            {
                passwordLinkSentAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );

        return NextResponse.json(GENERIC_RESPONSE);
    } catch (error) {
        console.error("Sending av passordlenke feila", error);
        if (!adminRequest) return NextResponse.json(GENERIC_RESPONSE);

        const message = error instanceof Error ? error.message : "PASSWORD_LINK_FAILED";
        const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
