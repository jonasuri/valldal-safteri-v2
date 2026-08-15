import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type AdminOperator = {
  id: string;
  name: string;
  active: boolean;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type OperatorStamp = {
  id: string;
  name: string;
};

const ACTIVE_OPERATOR_KEY = "valldal-admin-operator";
const LAST_ACTIVITY_KEY = "valldal-admin-operator-activity";

function toDate(value: unknown) {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null;
}

export function subscribeAdminOperators(
  callback: (operators: AdminOperator[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "adminOperators"), orderBy("name")),
    (snapshot) =>
      callback(
        snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            name: typeof data.name === "string" ? data.name : "Ukjend brukar",
            active: data.active !== false,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
          };
        }),
      ),
    onError,
  );
}

export async function createAdminOperator(name: string) {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Skriv inn namn på brukaren.");
  return addDoc(collection(db, "adminOperators"), {
    name: cleanName,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateAdminOperator(
  id: string,
  changes: { name?: string; active?: boolean },
) {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (typeof changes.name === "string") {
    const name = changes.name.trim();
    if (!name) throw new Error("Namnet kan ikkje vere tomt.");
    update.name = name;
  }
  if (typeof changes.active === "boolean") update.active = changes.active;
  await updateDoc(doc(db, "adminOperators", id), update);
}

export function getStoredOperator(): OperatorStamp | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(ACTIVE_OPERATOR_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<OperatorStamp>;
    return typeof parsed.id === "string" && typeof parsed.name === "string"
      ? { id: parsed.id, name: parsed.name }
      : null;
  } catch {
    return null;
  }
}

export function storeOperator(operator: OperatorStamp | null) {
  if (typeof window === "undefined") return;
  if (operator) {
    window.localStorage.setItem(ACTIVE_OPERATOR_KEY, JSON.stringify(operator));
    markOperatorActivity();
  } else {
    window.localStorage.removeItem(ACTIVE_OPERATOR_KEY);
    window.localStorage.removeItem(LAST_ACTIVITY_KEY);
  }
}

export function markOperatorActivity() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function getLastOperatorActivity() {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(LAST_ACTIVITY_KEY)) || 0;
}

export function requireActiveOperator(): OperatorStamp {
  const operator = getStoredOperator();
  if (!operator) throw new Error("Vel kven som utfører arbeidet først.");
  return operator;
}
