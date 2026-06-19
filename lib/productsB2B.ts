import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CustomerType } from "@/lib/customersFirestore";

export type B2BProductBrand = "safteri" | "bryggeri";

export type B2BVariant = {
    id: string;
    label: string;
    sku: string;
    active: boolean;
    imageUrl?: string;
    alcoholPercent?: number;
    retailPrice?: number;
    grossistPrice?: number;
};

export type B2BProduct = {
    id: string;
    name: string;
    slug: string;
    brand: B2BProductBrand;
    category: string;
    shortDescription: string;
    imageUrl?: string;
    alcoholPercent?: number;
    active: boolean;
    variants: B2BVariant[];
};

function asString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const normalized = value.trim().replace(",", ".");
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
}

function normalizeBrand(value: unknown): B2BProductBrand {
    return value === "bryggeri" ? "bryggeri" : "safteri";
}

function mapVariant(raw: any): B2BVariant | null {
    if (!raw || typeof raw !== "object") return null;

    const id = asString(raw.id);
    const label = asString(raw.label);
    const sku = asString(raw.sku);

    if (!id || !label) return null;

    return {
        id,
        label,
        sku,
        active: typeof raw.active === "boolean" ? raw.active : true,
        imageUrl: asString(raw.imageUrl) || undefined,
        alcoholPercent: asNumber(raw.alcoholPercent),
        retailPrice: asNumber(raw.prices?.trade),
        grossistPrice: asNumber(raw.prices?.distributor),
    };
}

function mapProduct(id: string, data: any): B2BProduct | null {
    const name = asString(data.name);
    const slug = asString(data.slug);

    if (!name || !slug) return null;

    const variants = Array.isArray(data.variants)
        ? data.variants.map(mapVariant).filter(Boolean) as B2BVariant[]
        : [];

    return {
        id,
        name,
        slug,
        brand: normalizeBrand(data.brand),
        category: asString(data.category),
        shortDescription: asString(data.shortDescription) || asString(data.description),
        imageUrl: asString(data.thumbnailUrl) || asString(data.imageUrl) || asString(data.image) || undefined,
        alcoholPercent: asNumber(data.alcoholPercent),
        active: typeof data.active === "boolean" ? data.active : true,
        variants: variants.filter((variant) => variant.active),
    };
}

export async function fetchB2BProducts(): Promise<B2BProduct[]> {
    const snapshot = await getDocs(query(collection(db, "products"), orderBy("name", "asc")));

    return snapshot.docs
        .map((docSnap) => mapProduct(docSnap.id, docSnap.data()))
        .filter(Boolean) as B2BProduct[];
}

export function getB2BVariantPrice(variant: B2BVariant, customerType: CustomerType) {
    if (customerType === "grossist") return variant.grossistPrice;
    return variant.retailPrice;
}

export function hasB2BVariantPrice(variant: B2BVariant, customerType: CustomerType) {
    return typeof getB2BVariantPrice(variant, customerType) === "number";
}

export function formatB2BPrice(value: number | undefined) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "Kontakt oss for pris";

    return new Intl.NumberFormat("nb-NO", {
        style: "currency",
        currency: "NOK",
        maximumFractionDigits: 2,
    }).format(value);
}

export function formatB2BPriceExVat(value: number | undefined) {
    const formatted = formatB2BPrice(value);
    return formatted === "Kontakt oss for pris"
        ? formatted
        : `${formatted} eks. mva.`;
}

export const B2B_PRICE_CONTACT_EMAIL = "post@valldalsafteri.no";