import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { CookPlan, ProductionRecipe } from "./types";

export type ProductionBatchStatus = "in_progress" | "completed";

export type LabelDownloadRecord = {
  downloadedAt: Date | null;
  downloadedBy: { uid: string; email: string | null };
  sheets?: number;
};

export type ProductionBatchForm = {
  targetText: string;
  cookSizeText: string;
  selectedPlan: CookPlan;
  forecastMonth: number;
  plannedOutputQuantities: Record<string, string>;
  rawMaterialBatches: Record<string, string>;
  checks: Record<string, boolean>;
  outputQuantities: Record<string, string>;
  extraLitres: string;
  notes: string;
  workflowStep: "worksheet" | "result";
};

export type ProductionBatch = ProductionBatchForm & {
  id: string;
  batchNumber: string;
  status: ProductionBatchStatus;
  recipeId: string;
  recipeName: string;
  category: string;
  recipeVersion: number;
  recipeSnapshot: ProductionRecipe;
  expectedYield: number;
  actualTotal: number | null;
  createdBy: { uid: string; email: string | null };
  createdAt: Date | null;
  updatedAt: Date | null;
  completedAt: Date | null;
  labelDownloads?: Record<string, LabelDownloadRecord>;
  labelPrintingSkipped?: boolean;
};

const batchesCollection = collection(db, "productionBatches");

function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function dateValue(value: unknown): Date | null {
  if (value && typeof (value as { toDate?: unknown }).toDate === "function")
    return (value as { toDate: () => Date }).toDate();
  return null;
}

function mapBatch(
  snapshot:
    QueryDocumentSnapshot<DocumentData> | { id: string; data(): DocumentData },
): ProductionBatch {
  const data = snapshot.data();
  const labelDownloads = Object.fromEntries(
    Object.entries(
      (data.labelDownloads || {}) as Record<string, DocumentData>,
    ).map(([key, record]) => [
      key,
      {
        ...record,
        downloadedAt: dateValue(record.downloadedAt),
      },
    ]),
  );
  return {
    id: snapshot.id,
    ...data,
    createdAt: dateValue(data.createdAt),
    updatedAt: dateValue(data.updatedAt),
    completedAt: dateValue(data.completedAt),
    labelDownloads,
  } as ProductionBatch;
}

export async function createProductionBatch(
  recipe: ProductionRecipe,
  form: ProductionBatchForm,
  expectedYield: number,
) {
  const user = auth.currentUser;
  if (!user) throw new Error("Du må vere innlogga for å starte produksjonen.");
  const ref = doc(batchesCollection);
  const now = new Date();
  const year = now.getFullYear();
  const counterRef = doc(db, "productionBatchCounters", String(year));
  let assignedBatchNumber = "";
  await runTransaction(db, async (transaction) => {
    const counterSnapshot = await transaction.get(counterRef);
    const sequence = counterSnapshot.exists()
      ? Number(counterSnapshot.data().nextSequence || 0)
      : 0;
    assignedBatchNumber = `${year}${String(sequence).padStart(3, "0")}`;
    transaction.set(
      counterRef,
      { year, nextSequence: sequence + 1, updatedAt: serverTimestamp() },
      { merge: true },
    );
    transaction.set(ref, {
      batchNumber: assignedBatchNumber,
      status: "in_progress" as ProductionBatchStatus,
      recipeId: recipe.id,
      recipeName: recipe.name,
      category: recipe.category,
      recipeVersion: recipe.version,
      recipeSnapshot: clean(recipe),
      expectedYield,
      actualTotal: null,
      ...clean(form),
      createdBy: { uid: user.uid, email: user.email || null },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      completedAt: null,
    });
  });
  return { id: ref.id, batchNumber: assignedBatchNumber };
}

export async function saveProductionBatch(
  id: string,
  form: ProductionBatchForm,
  expectedYield: number,
  actualTotal: number | null,
) {
  const ref = doc(db, "productionBatches", id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("Fann ikkje produksjonsbatchen.");
    if (snapshot.data().status === "completed")
      throw new Error("Ein fullført batch er skriveverna.");
    transaction.update(ref, {
      ...clean(form),
      expectedYield,
      actualTotal,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function completeProductionBatch(
  id: string,
  form: ProductionBatchForm,
  expectedYield: number,
  actualTotal: number,
) {
  await updateDoc(doc(db, "productionBatches", id), {
    ...clean(form),
    expectedYield,
    actualTotal,
    status: "completed" as ProductionBatchStatus,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getProductionBatch(id: string) {
  const snapshot = await getDoc(doc(db, "productionBatches", id));
  return snapshot.exists() ? mapBatch(snapshot) : null;
}

export async function setProductionBatchLabelPrintingSkipped(
  id: string,
  skipped: boolean,
) {
  await updateDoc(doc(db, "productionBatches", id), {
    labelPrintingSkipped: skipped,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeProductionBatches(
  callback: (batches: ProductionBatch[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(batchesCollection, orderBy("updatedAt", "desc")),
    (snapshot) => callback(snapshot.docs.map(mapBatch)),
    onError,
  );
}
