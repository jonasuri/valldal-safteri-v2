import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { isAdminEmail } from "@/lib/sandbox";
import { sendCustomerPortalAccess } from "@/lib/serverCustomerAccess";

export const runtime = "nodejs";

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizedText(value: unknown) {
    return text(value).replace(/\s+/g, " ");
}

function key(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

function parseOperator(value: unknown) {
    const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const id = text(item.id);
    const name = text(item.name);
    if (!id || !name) throw new Error("INVALID_OPERATOR");
    return { id, name };
}

function optionalNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function POST(request: NextRequest) {
    try {
        const authorization = request.headers.get("authorization") || "";
        if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
        const decoded = await getAdminAuth().verifyIdToken(authorization.slice(7));
        if (!isAdminEmail(decoded.email)) throw new Error("FORBIDDEN");

        const body = await request.json() as Record<string, unknown>;
        const customerId = text(body.customerId);
        const isUpdate = Boolean(customerId);
        const companyName = normalizedText(body.companyName);
        const sameAsCompanyName = body.sameAsCompanyName !== false;
        const displayName = sameAsCompanyName ? companyName : normalizedText(body.displayName);
        const contactName = normalizedText(body.contactName);
        const email = text(body.email).toLowerCase();
        const phone = text(body.phone);
        const organizationNumber = text(body.organizationNumber).replace(/\D/g, "");
        const organizationForm = text(body.organizationForm);
        const legalAddress = normalizedText(body.legalAddress);
        const visitingAddress = normalizedText(body.visitingAddress);
        const openingHours = text(body.openingHours);
        const customerType = text(body.customerType) === "grossist" ? "grossist" : "retail";
        const sendPortalInvite = body.sendPortalInvite === true;
        const operator = parseOperator(body.operator);

        if (!companyName || !displayName) throw new Error("INVALID_CUSTOMER_NAME");
        if (organizationNumber && organizationNumber.length !== 9) throw new Error("INVALID_ORGANIZATION_NUMBER");
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INVALID_CUSTOMER_EMAIL");
        if (sendPortalInvite && !email) throw new Error("MISSING_CUSTOMER_EMAIL");

        const db = getAdminFirestore();
        if (organizationNumber) {
            const existing = await db.collection("customers")
                .where("organizationNumber", "==", organizationNumber)
                .limit(2)
                .get();
            if (existing.docs.some((snapshot) => snapshot.id !== customerId)) {
                throw new Error("CUSTOMER_ORGANIZATION_EXISTS");
            }
        }
        if (email) {
            const existing = await db.collection("customers").where("email", "==", email).limit(2).get();
            if (existing.docs.some((snapshot) => snapshot.id !== customerId)) {
                throw new Error("CUSTOMER_EMAIL_EXISTS");
            }
        }

        const customerRef = isUpdate
            ? db.collection("customers").doc(customerId)
            : db.collection("customers").doc();

        await db.runTransaction(async (transaction) => {
            const currentSnapshot = isUpdate ? await transaction.get(customerRef) : null;
            if (isUpdate && !currentSnapshot?.exists) throw new Error("CUSTOMER_NOT_FOUND");
            const current = currentSnapshot?.data() ?? {};

            const oldOrganizationNumber = text(current.organizationNumber).replace(/\D/g, "");
            const oldEmail = text(current.email).toLowerCase();
            const organizationKeyRef = organizationNumber
                ? db.collection("customerOrganizationKeys").doc(key(organizationNumber))
                : null;
            const emailKeyRef = email ? db.collection("customerEmailKeys").doc(key(email)) : null;
            const oldOrganizationKeyRef = oldOrganizationNumber && oldOrganizationNumber !== organizationNumber
                ? db.collection("customerOrganizationKeys").doc(key(oldOrganizationNumber))
                : null;
            const oldEmailKeyRef = oldEmail && oldEmail !== email
                ? db.collection("customerEmailKeys").doc(key(oldEmail))
                : null;

            const organizationKeySnapshot = organizationKeyRef ? await transaction.get(organizationKeyRef) : null;
            const emailKeySnapshot = emailKeyRef ? await transaction.get(emailKeyRef) : null;
            const oldOrganizationKeySnapshot = oldOrganizationKeyRef
                ? await transaction.get(oldOrganizationKeyRef)
                : null;
            const oldEmailKeySnapshot = oldEmailKeyRef ? await transaction.get(oldEmailKeyRef) : null;

            const organizationKeyOwner = text(organizationKeySnapshot?.data()?.customerId);
            const emailKeyOwner = text(emailKeySnapshot?.data()?.customerId);
            if (organizationKeySnapshot?.exists && organizationKeyOwner !== customerRef.id) {
                throw new Error("CUSTOMER_ORGANIZATION_EXISTS");
            }
            if (emailKeySnapshot?.exists && emailKeyOwner !== customerRef.id) {
                throw new Error("CUSTOMER_EMAIL_EXISTS");
            }

            const effectiveOrganizationForm = Object.hasOwn(body, "organizationForm")
                ? organizationForm
                : text(current.organizationForm);
            const effectiveLegalAddress = Object.hasOwn(body, "legalAddress")
                ? legalAddress
                : text(current.legalAddress);
            const effectiveVisitingAddress = Object.hasOwn(body, "visitingAddress")
                ? visitingAddress || effectiveLegalAddress
                : text(current.visitingAddress) || effectiveLegalAddress;
            const effectiveVisitingLat = Object.hasOwn(body, "visitingLat")
                ? optionalNumber(body.visitingLat)
                : optionalNumber(current.visitingLat);
            const effectiveVisitingLng = Object.hasOwn(body, "visitingLng")
                ? optionalNumber(body.visitingLng)
                : optionalNumber(current.visitingLng);
            const active = typeof body.active === "boolean"
                ? body.active
                : typeof current.active === "boolean" ? current.active : true;
            const profileCompleted = typeof body.profileCompleted === "boolean"
                ? body.profileCompleted
                : Boolean(companyName && contactName && phone && organizationNumber);

            const common = {
                companyName,
                displayName,
                sameAsCompanyName,
                contactName,
                email,
                phone,
                organizationNumber,
                organizationForm: effectiveOrganizationForm,
                openingHours,
                legalAddress: effectiveLegalAddress,
                visitingAddress: effectiveVisitingAddress,
                visitingLat: effectiveVisitingLat,
                visitingLng: effectiveVisitingLng,
                customerType,
                active,
                profileCompleted,
                lastUpdatedByOperator: operator,
                updatedAt: FieldValue.serverTimestamp(),
            };

            if (isUpdate) {
                transaction.update(customerRef, {
                    ...common,
                    operatorHistory: FieldValue.arrayUnion({
                        action: "customer_updated",
                        operator,
                        occurredAt: new Date(),
                    }),
                });
            } else {
                transaction.create(customerRef, {
                    ...common,
                    authUid: "",
                    customerSource: "manual",
                    createdByOperator: operator,
                    operatorHistory: [{ action: "customer_created", operator, occurredAt: new Date() }],
                    createdAt: FieldValue.serverTimestamp(),
                });
            }

            if (organizationKeyRef) {
                transaction.set(organizationKeyRef, { organizationNumber, customerId: customerRef.id });
            }
            if (emailKeyRef) {
                transaction.set(emailKeyRef, { email, customerId: customerRef.id });
            }
            if (oldOrganizationKeyRef && text(oldOrganizationKeySnapshot?.data()?.customerId) === customerRef.id) {
                transaction.delete(oldOrganizationKeyRef);
            }
            if (oldEmailKeyRef && text(oldEmailKeySnapshot?.data()?.customerId) === customerRef.id) {
                transaction.delete(oldEmailKeyRef);
            }
        });

        let portalInviteSent = false;
        let portalInviteError = false;
        if (sendPortalInvite) {
            try {
                const snapshot = await customerRef.get();
                await sendCustomerPortalAccess(snapshot);
                portalInviteSent = true;
            } catch (error) {
                portalInviteError = true;
                console.error("Kunden vart lagra, men portalinvitasjonen feila", error);
            }
        }

        return NextResponse.json({
            ok: true,
            customerId: customerRef.id,
            portalInviteSent,
            portalInviteError,
        }, { status: isUpdate ? 200 : 201 });
    } catch (error) {
        console.error("Lagring av kunde feila", error);
        const message = error instanceof Error ? error.message : "CUSTOMER_SAVE_FAILED";
        const status = message === "UNAUTHORIZED" ? 401
            : message === "FORBIDDEN" ? 403
                : message === "CUSTOMER_NOT_FOUND" ? 404
                    : message === "CUSTOMER_ORGANIZATION_EXISTS" || message === "CUSTOMER_EMAIL_EXISTS" ? 409
                        : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
