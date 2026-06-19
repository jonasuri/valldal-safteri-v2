import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type CustomerType = "retail" | "grossist";
export type CustomerSource = "registered" | "manual";

export type AdminCustomerRow = {
    id: string;
    companyName: string;
    displayName: string;
    sameAsCompanyName: boolean;
    contactName: string;
    email: string;
    phone: string;
    organizationNumber: string;
    openingHours: string;
    authUid: string;
    customerSource: CustomerSource;
    customerType: CustomerType;
    active: boolean;
    profileCompleted: boolean;
    updatedAt?: unknown;
};

export type CustomerInput = {
    companyName: string;
    displayName?: string;
    sameAsCompanyName?: boolean;
    contactName?: string;
    email: string;
    phone?: string;
    organizationNumber?: string;
    openingHours?: string;
    authUid?: string;
    customerSource?: CustomerSource;
    customerType: CustomerType;
    active?: boolean;
    profileCompleted?: boolean;
};

const customersCollection = collection(db, "customers");

function mapCustomer(docSnap: any): AdminCustomerRow {
    const data = docSnap.data() ?? {};
    const companyName = typeof data.companyName === "string" ? data.companyName : "";
    const displayName = typeof data.displayName === "string" && data.displayName.trim()
        ? data.displayName
        : companyName;

    return {
        id: docSnap.id,
        companyName,
        displayName,
        sameAsCompanyName:
            typeof data.sameAsCompanyName === "boolean"
                ? data.sameAsCompanyName
                : displayName === companyName,
        contactName: typeof data.contactName === "string" ? data.contactName : "",
        email: typeof data.email === "string" ? data.email : "",
        phone: typeof data.phone === "string" ? data.phone : "",
        organizationNumber: typeof data.organizationNumber === "string" ? data.organizationNumber : "",
        openingHours: typeof data.openingHours === "string" ? data.openingHours : "",
        authUid: typeof data.authUid === "string" ? data.authUid : "",
        customerSource: data.customerSource === "manual" ? "manual" : "registered",
        customerType: data.customerType === "grossist" ? "grossist" : "retail",
        active: typeof data.active === "boolean" ? data.active : true,
        profileCompleted: data.profileCompleted === true,
        updatedAt: data.updatedAt,
    };
}

export async function fetchCustomersOnce(): Promise<AdminCustomerRow[]> {
    const snapshot = await getDocs(
        query(customersCollection, orderBy("companyName", "asc"))
    );

    return snapshot.docs.map(mapCustomer);
}

export function listenToCustomers(
    callback: (customers: AdminCustomerRow[]) => void
) {
    return onSnapshot(
        query(customersCollection, orderBy("companyName", "asc")),
        (snapshot) => {
            callback(snapshot.docs.map(mapCustomer));
        }
    );
}

export async function fetchCustomerById(id: string) {
    const snapshot = await getDoc(doc(db, "customers", id));

    if (!snapshot.exists()) {
        return null;
    }

    return mapCustomer(snapshot);
}

export async function createCustomer(input: CustomerInput) {
    const companyName = input.companyName.trim();
    const sameAsCompanyName = input.sameAsCompanyName ?? true;
    const displayName = sameAsCompanyName
        ? companyName
        : input.displayName?.trim() ?? companyName;

    const docRef = await addDoc(customersCollection, {
        companyName,
        displayName,
        sameAsCompanyName,
        contactName: input.contactName?.trim() ?? "",
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() ?? "",
        organizationNumber: input.organizationNumber?.trim() ?? "",
        openingHours: input.openingHours?.trim() ?? "",
        authUid: input.authUid?.trim() ?? "",
        customerSource: input.customerSource ?? (input.authUid ? "registered" : "manual"),
        customerType: input.customerType,
        active: input.active ?? true,
        profileCompleted: input.profileCompleted ?? false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    return docRef.id;
}

export async function updateCustomer(
    id: string,
    updates: Partial<CustomerInput>
) {
    const nextUpdates: Record<string, unknown> = {
        ...updates,
        updatedAt: serverTimestamp(),
    };

    if (typeof updates.companyName === "string") {
        nextUpdates.companyName = updates.companyName.trim();
    }

    if (typeof updates.sameAsCompanyName === "boolean") {
        nextUpdates.sameAsCompanyName = updates.sameAsCompanyName;
    }

    const companyName =
        typeof nextUpdates.companyName === "string"
            ? nextUpdates.companyName
            : undefined;

    if (updates.sameAsCompanyName === true && companyName) {
        nextUpdates.displayName = companyName;
    } else if (typeof updates.displayName === "string") {
        nextUpdates.displayName = updates.displayName.trim();
    }

    await updateDoc(doc(db, "customers", id), nextUpdates);
}

export async function connectCustomerAuthUid(id: string, authUid: string) {
    await updateDoc(doc(db, "customers", id), {
        authUid: authUid.trim(),
        customerSource: "registered",
        updatedAt: serverTimestamp(),
    });
}

export async function disconnectCustomerAuthUid(id: string) {
    await updateDoc(doc(db, "customers", id), {
        authUid: "",
        customerSource: "manual",
        updatedAt: serverTimestamp(),
    });
}