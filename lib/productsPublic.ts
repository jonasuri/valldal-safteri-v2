/**
 * Public product helpers (Firestore)
 *
 * NOTE: These helpers use the Firebase *client* SDK.
 * Use them from Client Components (or from other client-side code).
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    where,
    type DocumentData,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type ProductBrand = "safteri" | "bryggeri";

export type ProductVariant = {
    id: string;
    label: string; // e.g. "195ml", "0,33L"

    // legacy alias used by older UI
    size?: string;

    price?: number;
    alcoholPercent?: string;
    active?: boolean;
    sku?: string;

    imageUrl?: string;

    // legacy alias used by older UI
    image?: string;
};

export type NutritionPer100 = {
    energyKj?: number;
    energyKcal?: number;
    fat?: number;
    saturatedFat?: number;
    carbs?: number;
    sugars?: number;
    protein?: number;
    salt?: number;
};

export type FullProduct = {
    id: string;
    name: string;

    // legacy alias
    productName?: string;

    slug: string;
    brand: ProductBrand;
    category: string;
    active: boolean;
    defaultVariantId?: string;

    // optional copy
    shortDesc?: string;
    longDesc?: string;

    // legacy aliases
    shortDescription?: string;
    longDescription?: string;

    // media
    imageUrl?: string; // main/thumbnail

    // legacy aliases
    thumbnailUrl?: string;
    image?: string;

    // variants
    variants: ProductVariant[];

    // details
    ingredients?: string;
    allergens?: string;

    // legacy aliases
    ingredientsText?: string;
    allergensText?: string;

    dilutionRatio?: string;
    badgeText?: string;

    nutrition?: NutritionPer100;

    updatedAt?: unknown;
};

function asString(v: unknown): string | null {
    return typeof v === "string" ? v : null;
}

function asNumber(v: unknown): number | undefined {
    if (typeof v === "number" && Number.isFinite(v)) return v;

    if (typeof v === "string") {
        const normalized = v.trim().replace(",", ".");
        if (!normalized) return undefined;

        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
}

function asBool(v: unknown, fallback = false): boolean {
    return typeof v === "boolean" ? v : fallback;
}

function normalizeBrand(v: unknown): ProductBrand | null {
    return v === "safteri" || v === "bryggeri" ? v : null;
}

function mapVariant(raw: unknown, idx: number): ProductVariant | null {
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as Record<string, unknown>;

    const id = asString(obj.id) ?? `v${idx}`;
    const label = asString(obj.label) ?? asString(obj.size) ?? asString(obj.name);
    if (!label) return null;

    return {
        id,
        label,
        // legacy alias
        size: label,

        price: asNumber(obj.price),
        alcoholPercent: asString(obj.alcoholPercent) ?? undefined,
        active: typeof obj.active === "boolean" ? obj.active : undefined,
        sku: asString(obj.sku) ?? asString(obj.SKU) ?? undefined,
        imageUrl: asString(obj.imageUrl) ?? asString(obj.image) ?? undefined,
        // legacy alias
        image: asString(obj.image) ?? asString(obj.imageUrl) ?? undefined,
    };
}

function mapNutrition(raw: unknown): NutritionPer100 | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const obj = raw as Record<string, unknown>;
    const n: NutritionPer100 = {
        energyKj: asNumber(obj.energyKj) ?? asNumber(obj.kj),
        energyKcal: asNumber(obj.energyKcal) ?? asNumber(obj.kcal),
        fat: asNumber(obj.fat),
        saturatedFat: asNumber(obj.saturatedFat) ?? asNumber(obj.satFat),
        carbs: asNumber(obj.carbs),
        sugars: asNumber(obj.sugars),
        protein: asNumber(obj.protein),
        salt: asNumber(obj.salt),
    };

    // if everything is undefined, treat as absent
    const anyValue = Object.values(n).some((v) => typeof v === "number");
    return anyValue ? n : undefined;
}

function mapProduct(id: string, data: DocumentData): FullProduct | null {
    const name = asString(data.name) ?? asString(data.productName);
    const slug = asString(data.slug);
    const brand = normalizeBrand(data.brand);
    const category = asString(data.category) ?? "";
    const defaultVariantId = asString(data.defaultVariantId) ?? undefined;

    // minimal requirements for public display
    if (!name || !slug || !brand) return null;

    const variantsRaw = Array.isArray(data.variants) ? data.variants : [];
    const variants = variantsRaw
        .map((v, idx) => mapVariant(v, idx))
        .filter((v): v is ProductVariant => Boolean(v));

    return {
        id,
        name,
        // legacy alias
        productName: name,

        slug,
        brand,
        category,
        active: asBool(data.active, true),
        defaultVariantId,

        shortDesc:
            asString(data.shortDesc) ??
            asString(data.shortDescription) ??
            asString(data.description) ??
            undefined,
        longDesc:
            asString(data.longDesc) ??
            asString(data.longDescription) ??
            undefined,

        // legacy aliases
        shortDescription:
            asString(data.shortDesc) ??
            asString(data.shortDescription) ??
            asString(data.description) ??
            undefined,
        longDescription:
            asString(data.longDesc) ??
            asString(data.longDescription) ??
            undefined,

        imageUrl: asString(data.imageUrl) ?? asString(data.image) ?? asString(data.thumbnailUrl) ?? undefined,

        // legacy aliases
        thumbnailUrl: asString(data.thumbnailUrl) ?? asString(data.imageUrl) ?? asString(data.image) ?? undefined,
        image: asString(data.image) ?? asString(data.imageUrl) ?? asString(data.thumbnailUrl) ?? undefined,

        variants,

        ingredients: asString(data.ingredients) ?? asString(data.ingredientsText) ?? undefined,
        allergens: asString(data.allergens) ?? asString(data.allergensText) ?? undefined,

        // legacy aliases
        ingredientsText: asString(data.ingredientsText) ?? asString(data.ingredients) ?? undefined,
        allergensText: asString(data.allergensText) ?? asString(data.allergens) ?? undefined,

        dilutionRatio: asString(data.dilutionRatio) ?? undefined,
        badgeText: asString(data.badgeText) ?? undefined,

        nutrition: mapNutrition(data.nutrition),

        updatedAt: data.updatedAt,
    };
}

/**
 * Fetch products for a brand.
 *
 * By default: returns only active products. Set includeInactive=true to fetch all.
 */
export async function fetchProductsForBrand(
    brand: ProductBrand,
    opts?: { includeInactive?: boolean; max?: number }
): Promise<FullProduct[]> {
    const includeInactive = Boolean(opts?.includeInactive);
    const max = typeof opts?.max === "number" && opts.max > 0 ? opts.max : undefined;

    // IMPORTANT:
    // Avoid composite-index requirements by keeping the query to:
    //   where(brand) + orderBy(name)
    // and doing the active filtering in-memory.
    const base = collection(db, "products");
    const clauses: any[] = [where("brand", "==", brand), orderBy("name", "asc")];
    if (max) clauses.push(limit(max));

    const q = query(base, ...clauses);
    const snap = await getDocs(q);

    const items: FullProduct[] = [];
    snap.forEach((d) => {
        const mapped = mapProduct(d.id, d.data());
        if (!mapped) return;
        if (!includeInactive && !mapped.active) return;
        items.push(mapped);
    });

    return items;
}

/**
 * Fetch one product by Firestore doc id OR by slug.
 *
 * If brand is provided, it will be enforced when searching by slug.
 */
export async function fetchProductBySlugOrId(
    slugOrId: string,
    opts?: { brand?: ProductBrand; includeInactive?: boolean }
): Promise<FullProduct | null> {
    const includeInactive = Boolean(opts?.includeInactive);

    // 1) Try doc id first
    const byIdRef = doc(db, "products", slugOrId);
    const byIdSnap = await getDoc(byIdRef);
    if (byIdSnap.exists()) {
        const mapped = mapProduct(byIdSnap.id, byIdSnap.data());
        if (mapped) {
            if (!includeInactive && !mapped.active) return null;
            if (opts?.brand && mapped.brand !== opts.brand) return null;
            return mapped;
        }
    }

    // 2) Fall back to slug query
    // Keep this query to a single `where` to avoid composite index requirements.
    const base = collection(db, "products");
    const q = query(base, where("slug", "==", slugOrId), limit(5));
    const snap = await getDocs(q);

    for (const d of snap.docs) {
        const mapped = mapProduct(d.id, d.data());
        if (!mapped) continue;
        if (!includeInactive && !mapped.active) continue;
        if (opts?.brand && mapped.brand !== opts.brand) continue;
        return mapped;
    }

    return null;
}

// -------------------------
// Backward-compatible exports
// -------------------------

/**
 * Legacy helper name used by older pages.
 *
 * Supports both call styles:
 *  - fetchProductBySlugOrIdForBrand(slugOrId, brand, includeInactive?)
 *  - fetchProductBySlugOrIdForBrand(brand, slugOrId, includeInactive?)
 *  - fetchProductBySlugOrIdForBrand(slugOrId, brand, { includeInactive })
 *  - fetchProductBySlugOrIdForBrand(brand, slugOrId, { includeInactive })
 */
export function fetchProductBySlugOrIdForBrand(
    slugOrId: string,
    brand: ProductBrand,
    includeInactive?: boolean
): Promise<FullProduct | null>;
export function fetchProductBySlugOrIdForBrand(
    brand: ProductBrand,
    slugOrId: string,
    includeInactive?: boolean
): Promise<FullProduct | null>;
export function fetchProductBySlugOrIdForBrand(
    slugOrId: string,
    brand: ProductBrand,
    opts?: { includeInactive?: boolean }
): Promise<FullProduct | null>;
export function fetchProductBySlugOrIdForBrand(
    brand: ProductBrand,
    slugOrId: string,
    opts?: { includeInactive?: boolean }
): Promise<FullProduct | null>;
export async function fetchProductBySlugOrIdForBrand(
    a: string,
    b: string,
    c?: boolean | { includeInactive?: boolean }
): Promise<FullProduct | null> {
    const aIsBrand = a === "safteri" || a === "bryggeri";
    const bIsBrand = b === "safteri" || b === "bryggeri";

    const brand: ProductBrand = (aIsBrand ? a : b) as ProductBrand;
    const slugOrId = aIsBrand ? b : a;

    const includeInactive =
        typeof c === "boolean" ? c : Boolean(c && typeof c === "object" && c.includeInactive);

    return fetchProductBySlugOrId(slugOrId, { brand, includeInactive });
}

// Additional legacy aliases that may still be referenced in older pages
export const fetchProductBySlugOrIdForBrandOld = fetchProductBySlugOrIdForBrand;
export const fetchProductBySlugOrIdForBrandOldForBrand = fetchProductBySlugOrIdForBrand;