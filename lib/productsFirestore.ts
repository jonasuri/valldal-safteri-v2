import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    serverTimestamp,
    type Unsubscribe,
} from "firebase/firestore";

export type ProductBrand = "safteri" | "bryggeri";

export type AdminProductRow = {
    id: string;
    name: string;
    slug: string;
    brand: ProductBrand;
    category: string;
    active: boolean;
    updatedAt?: unknown; // Firestore Timestamp
};

type ProductDoc = Partial<AdminProductRow> & {
    name?: unknown;
    slug?: unknown;
    brand?: unknown;
    category?: unknown;
    active?: unknown;
    updatedAt?: unknown;
};

/**
 * Subscribe to the product list (collection: "products"), ordered by name.
 * Returns an unsubscribe function.
 */
export function listenToProducts(
    onData: (rows: AdminProductRow[]) => void,
    onError?: (error: unknown) => void
): Unsubscribe {
    const q = query(collection(db, "products"), orderBy("name", "asc"));

    return onSnapshot(
        q,
        (snap) => {
            const rows: AdminProductRow[] = snap.docs.map((d) => {
                const data = d.data() as ProductDoc;

                const name =
                    typeof data.name === "string" && data.name.trim().length > 0
                        ? data.name
                        : "(utan namn)";

                const slug =
                    typeof data.slug === "string" && data.slug.trim().length > 0
                        ? data.slug
                        : d.id;

                const brand: ProductBrand =
                    data.brand === "bryggeri" ? "bryggeri" : "safteri";

                const category = typeof data.category === "string" ? data.category : "";

                const active =
                    typeof data.active === "boolean" ? data.active : true;

                return {
                    id: d.id,
                    name,
                    slug,
                    brand,
                    category,
                    active,
                    updatedAt: data.updatedAt,
                };
            });

            onData(rows);
        },
        (err) => {
            console.error("listenToProducts error:", err);
            onError?.(err);
        }
    );
}

/**
 * Fetch the product list once (ordered by name).
 */
export async function fetchProductsOnce(): Promise<AdminProductRow[]> {
    const q = query(collection(db, "products"), orderBy("name", "asc"));
    const snap = await getDocs(q);

    return snap.docs.map((d) => {
        const data = d.data() as ProductDoc;

        const name =
            typeof data.name === "string" && data.name.trim().length > 0
                ? data.name
                : "(utan namn)";

        const slug =
            typeof data.slug === "string" && data.slug.trim().length > 0
                ? data.slug
                : d.id;

        const brand: ProductBrand = data.brand === "bryggeri" ? "bryggeri" : "safteri";

        const category = typeof data.category === "string" ? data.category : "";

        const active = typeof data.active === "boolean" ? data.active : true;

        return {
            id: d.id,
            name,
            slug,
            brand,
            category,
            active,
            updatedAt: data.updatedAt,
        };
    });
}

// Backwards-compatible alias (some pages may import `fetchProducts`)
export const fetchProducts = fetchProductsOnce;

/**
 * Read a single product doc by id.
 */
export async function fetchProductById(id: string): Promise<AdminProductRow | null> {
    const ref = doc(db, "products", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const data = snap.data() as ProductDoc;

    const name =
        typeof data.name === "string" && data.name.trim().length > 0
            ? data.name
            : "(utan namn)";

    const slug =
        typeof data.slug === "string" && data.slug.trim().length > 0
            ? data.slug
            : snap.id;

    const brand: ProductBrand = data.brand === "bryggeri" ? "bryggeri" : "safteri";
    const category = typeof data.category === "string" ? data.category : "";
    const active = typeof data.active === "boolean" ? data.active : true;

    return {
        id: snap.id,
        name,
        slug,
        brand,
        category,
        active,
        updatedAt: data.updatedAt,
    };
}

/**
 * Create/update the minimal product fields used by the admin list.
 * (You can extend this later with variants, prices, images, etc.)
 */
export async function upsertProductMinimal(input: {
    id: string;
    name: string;
    brand: ProductBrand;
    category: string;
    slug: string;
    active: boolean;
}): Promise<void> {
    const ref = doc(db, "products", input.id);

    await setDoc(
        ref,
        {
            name: input.name,
            brand: input.brand,
            category: input.category,
            slug: input.slug,
            active: input.active,
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );
}

/**
 * Utility: simple slug generator for Norwegian text.
 * You can refine later.
 */
export function toSlug(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/æ/g, "ae")
        .replace(/ø/g, "o")
        .replace(/å/g, "a")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
}
