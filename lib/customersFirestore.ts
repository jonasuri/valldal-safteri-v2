import {
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
import { auth, db } from "@/lib/firebase";
import { requireActiveOperator } from "@/lib/adminOperators";

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
  legalAddress: string;
  visitingAddress: string;
  visitingLat?: number | null;
  visitingLng?: number | null;
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
  legalAddress?: string;
  visitingAddress?: string;
  visitingLat?: number | null;
  visitingLng?: number | null;
  authUid?: string;
  customerSource?: CustomerSource;
  customerType: CustomerType;
  active?: boolean;
  profileCompleted?: boolean;
};

const customersCollection = collection(db, "customers");

function mapCustomer(docSnap: any): AdminCustomerRow {
  const data = docSnap.data() ?? {};
  const companyName =
    typeof data.companyName === "string" ? data.companyName : "";
  const displayName =
    typeof data.displayName === "string" && data.displayName.trim()
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
    organizationNumber:
      typeof data.organizationNumber === "string"
        ? data.organizationNumber
        : "",
    openingHours:
      typeof data.openingHours === "string" ? data.openingHours : "",
    legalAddress:
      typeof data.legalAddress === "string" ? data.legalAddress : "",
    visitingAddress:
      typeof data.visitingAddress === "string" ? data.visitingAddress : "",
    visitingLat: typeof data.visitingLat === "number" ? data.visitingLat : null,
    visitingLng: typeof data.visitingLng === "number" ? data.visitingLng : null,
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
    query(customersCollection, orderBy("companyName", "asc")),
  );

  return snapshot.docs.map(mapCustomer);
}

export function listenToCustomers(
  callback: (customers: AdminCustomerRow[]) => void,
) {
  return onSnapshot(
    query(customersCollection, orderBy("companyName", "asc")),
    (snapshot) => {
      callback(snapshot.docs.map(mapCustomer));
    },
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
  const user = auth.currentUser;
  if (!user) throw new Error("UNAUTHORIZED");
  const token = await user.getIdToken();
  const response = await fetch("/api/admin/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      ...input,
      operator: requireActiveOperator(),
      sendPortalInvite: false,
    }),
  });
  const result = await response.json().catch(() => ({})) as { customerId?: string; error?: string };
  if (!response.ok || !result.customerId) throw new Error(result.error || `CUSTOMER_CREATE_${response.status}`);
  return result.customerId;
}

export async function updateCustomer(
  id: string,
  updates: Partial<CustomerInput>,
) {
  const current = await fetchCustomerById(id);
  if (!current) throw new Error("CUSTOMER_NOT_FOUND");
  const user = auth.currentUser;
  if (!user) throw new Error("UNAUTHORIZED");
  const token = await user.getIdToken();
  const response = await fetch("/api/admin/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      ...current,
      ...updates,
      customerId: id,
      operator: requireActiveOperator(),
      sendPortalInvite: false,
    }),
  });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || `CUSTOMER_UPDATE_${response.status}`);
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
