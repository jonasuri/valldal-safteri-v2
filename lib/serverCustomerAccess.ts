import { FieldValue, type DocumentSnapshot } from "firebase-admin/firestore";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import { sendCustomerAccessEmail } from "@/lib/customerAccessEmail";

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
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

export async function sendCustomerPortalAccess(customerSnapshot: DocumentSnapshot) {
    const customer = customerSnapshot.data();
    if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
    const email = text(customer.email).toLowerCase();
    if (!email) throw new Error("MISSING_CUSTOMER_EMAIL");
    if (customer.active === false) throw new Error("CUSTOMER_INACTIVE");

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
            displayName: text(customer.contactName) || text(customer.displayName) || text(customer.companyName),
            emailVerified: false,
            disabled: false,
        });
    }

    if (text(customer.authUid) !== authUser.uid || customer.customerSource !== "registered") {
        await customerSnapshot.ref.set({
            authUid: authUser.uid,
            customerSource: "registered",
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
    }

    const firebaseLink = await auth.generatePasswordResetLink(email);
    await sendCustomerAccessEmail({
        email,
        name: text(customer.contactName) || text(customer.displayName) || text(customer.companyName),
        resetUrl: customResetUrl(firebaseLink),
    });

    await customerSnapshot.ref.set({
        passwordLinkSentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}
