

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { db, storage } from "@/lib/firebase";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { deleteDoc, deleteField, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

type ProductDoc = {
    name?: string;
    slug?: string;
    brand?: "safteri" | "bryggeri";
    category?: string;
    description?: string;
    longDescription?: string;
    active?: boolean;
    thumbnailUrl?: string;
    imageUrl?: string;
    image?: string;
    variants?: Array<{
        id: string;
        label: string;
        sku: string;
        price: number;
        prices?: {
            retail?: number;
            trade?: number;
            distributor?: number;
        };
        alcoholPercent?: string;
        imageUrl?: string;
        active?: boolean;
    }>;
    // Product-level fields
    ingredients?: string;
    allergens?: string;
    nutrition?: {
        basis?: "per_100g" | "per_100ml";
        energyKj?: string;
        energyKcal?: string;
        fat?: string;
        saturatedFat?: string;
        carbs?: string;
        sugars?: string;
        protein?: string;
        salt?: string;
    };
    updatedAt?: unknown;
};

function slugify(value: string) {
    return value
        .trim()
        .toLowerCase()
        // Norwegian-friendly replacements
        .replace(/æ/g, "ae")
        .replace(/ø/g, "o")
        .replace(/å/g, "a")
        // remove accents/diacritics
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        // non-alphanumeric to hyphen
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

function normalizeImageUrl(value: unknown): string {
    if (typeof value !== "string") return "";
    return value
        .trim()
        .replace(/&amp;/g, "&");
}

const MAX_UPLOAD_IMAGE_SIZE = 1800;
const UPLOAD_IMAGE_QUALITY = 0.85;

async function resizeImageBeforeUpload(file: File): Promise<File> {
    if (!file.type.startsWith("image/")) return file;

    const imageUrl = URL.createObjectURL(file);

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Kunne ikkje lese biletet."));
            img.src = imageUrl;
        });

        const width = image.naturalWidth;
        const height = image.naturalHeight;

        if (!width || !height) return file;

        const scale = Math.min(MAX_UPLOAD_IMAGE_SIZE / width, MAX_UPLOAD_IMAGE_SIZE / height, 1);
        const nextWidth = Math.round(width * scale);
        const nextHeight = Math.round(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = nextWidth;
        canvas.height = nextHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) return file;

        ctx.drawImage(image, 0, 0, nextWidth, nextHeight);

        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, "image/webp", UPLOAD_IMAGE_QUALITY);
        });

        if (!blob) return file;

        const originalName = file.name.replace(/\.[^.]+$/, "");
        return new File([blob], `${originalName}.webp`, {
            type: "image/webp",
            lastModified: Date.now(),
        });
    } finally {
        URL.revokeObjectURL(imageUrl);
    }
}

const SAFT_CATEGORY_OPTIONS = ["Saft", "Sylte", "Gelé", "Saus", "Frisk", "Rein"] as const;
const BRYGGERI_CATEGORY_OPTIONS = ["Øl", "Sider"] as const;
function getCategoryOptions(brand: "safteri" | "bryggeri"): string[] {
    return brand === "bryggeri"
        ? ([...BRYGGERI_CATEGORY_OPTIONS] as unknown as string[])
        : ([...SAFT_CATEGORY_OPTIONS] as unknown as string[]);
}

export default function AdminProductEditPage({
    params,
}: {
    params: { id: string } | Promise<{ id: string }>;
}) {
    const [productId, setProductId] = useState<string>("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    type SaveToast = { type: "error" | "success"; message: string };
    type VariantFieldErrors = { label?: string; sku?: string; price?: string; alcoholPercent?: string };

    const [saveToast, setSaveToast] = useState<SaveToast | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{
        name?: string;
        variants: Record<string, VariantFieldErrors>;
    }>({ variants: {} });

    // Form state
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [brand, setBrand] = useState<ProductDoc["brand"]>("safteri");
    const [category, setCategory] = useState("");
    const [description, setDescription] = useState("");
    const [longDescription, setLongDescription] = useState("");
    const [active, setActive] = useState(true);
    // Thumbnail state
    const [thumbnailUrl, setThumbnailUrl] = useState<string>("");
    const [thumbUploading, setThumbUploading] = useState(false);
    const [thumbError, setThumbError] = useState<string | null>(null);

    // Variants
    type VariantForm = {
        id: string;
        label: string;
        sku: string;
        price: string;
        priceTrade: string;
        priceDistributor: string;
        alcoholPercent: string;
        imageUrl?: string;
        active: boolean;
    };
    type NutritionForm = {
        basis: "per_100g" | "per_100ml";
        energyKj: string;
        energyKcal: string;
        fat: string;
        saturatedFat: string;
        carbs: string;
        sugars: string;
        protein: string;
        salt: string;
    };
    const [variants, setVariants] = useState<VariantForm[]>([]);
    const [variantError, setVariantError] = useState<string | null>(null);

    // Form state for product-level fields
    const [ingredients, setIngredients] = useState("");
    const [allergens, setAllergens] = useState("");
    const [nutrition, setNutrition] = useState<NutritionForm>({
        basis: "per_100g",
        energyKj: "",
        energyKcal: "",
        fat: "",
        saturatedFat: "",
        carbs: "",
        sugars: "",
        protein: "",
        salt: "",
    });

    // Initial state to detect changes
    const [initial, setInitial] = useState<{
        name: string;
        slug: string;
        brand: ProductDoc["brand"];
        category: string;
        description: string;
        longDescription: string;
        active: boolean;
        thumbnailUrl: string;
        variants: VariantForm[];
        ingredients: string;
        allergens: string;
        nutrition: NutritionForm;
    } | null>(null);

    // Resolve params (supports Promise form)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const p = (await params) as { id: string };
            if (!cancelled) setProductId(p.id);
        })();
        return () => {
            cancelled = true;
        };
    }, [params]);

    useEffect(() => {
        if (!productId) return;

        let cancelled = false;

        (async () => {
            setLoading(true);
            setError(null);
            setSaved(false);

            try {
                const ref = doc(db, "products", productId);
                const snap = await getDoc(ref);

                if (!snap.exists()) {
                    throw new Error("Produktet finst ikkje (eller er sletta).");
                }

                const data = (snap.data() || {}) as ProductDoc;

                const loadedName = typeof data.name === "string" ? data.name : "";
                const loadedSlug = typeof data.slug === "string" ? data.slug : "";
                const loadedBrand: ProductDoc["brand"] =
                    data.brand === "bryggeri" || data.brand === "safteri"
                        ? data.brand
                        : "safteri";
                const loadedCategory = typeof data.category === "string" ? data.category : "";
                const loadedDescription = typeof data.description === "string" ? data.description : "";
                const loadedLongDescription = typeof data.longDescription === "string" ? data.longDescription : "";
                const loadedActive = typeof data.active === "boolean" ? data.active : true;
                const loadedThumb =
                    normalizeImageUrl(data.thumbnailUrl) ||
                    normalizeImageUrl(data.imageUrl) ||
                    normalizeImageUrl(data.image);
                // Variants: build array of { id, label, sku, price } as strings for form
                let loadedVariants: VariantForm[] = [];
                if (Array.isArray(data.variants) && data.variants.length > 0) {
                    loadedVariants = data.variants
                        .filter(
                            (v) =>
                                v &&
                                typeof v.id === "string" &&
                                typeof v.label === "string" &&
                                typeof v.sku === "string" &&
                                typeof v.price === "number" &&
                                Number.isFinite(v.price)
                        )
                        .map((v) => ({
                            id: v.id,
                            label: v.label,
                            sku: v.sku,
                            price: String(v.prices?.retail ?? v.price),
                            priceTrade: typeof v.prices?.trade === "number" ? String(v.prices.trade) : "",
                            priceDistributor: typeof v.prices?.distributor === "number" ? String(v.prices.distributor) : "",
                            alcoholPercent: typeof v.alcoholPercent === "string" ? v.alcoholPercent : "",
                            imageUrl: normalizeImageUrl(v.imageUrl) || undefined,
                            active: typeof v.active === "boolean" ? v.active : true,
                        }));
                }
                if (!loadedVariants.length) {
                    loadedVariants = [{ id: String(Date.now()), label: "", sku: "", price: "", priceTrade: "", priceDistributor: "", alcoholPercent: "", active: true }];
                }

                // Product-level fields
                const loadedIngredients = typeof data.ingredients === "string" ? data.ingredients : "";
                const loadedAllergens = typeof data.allergens === "string" ? data.allergens : "";

                const rawNutrition = (data.nutrition && typeof data.nutrition === "object") ? data.nutrition : undefined;
                const loadedNutrition: NutritionForm = {
                    basis: rawNutrition && (rawNutrition as any).basis === "per_100ml" ? "per_100ml" : "per_100g",
                    energyKj: rawNutrition && typeof (rawNutrition as any).energyKj === "string" ? (rawNutrition as any).energyKj : "",
                    energyKcal: rawNutrition && typeof (rawNutrition as any).energyKcal === "string" ? (rawNutrition as any).energyKcal : "",
                    fat: rawNutrition && typeof (rawNutrition as any).fat === "string" ? (rawNutrition as any).fat : "",
                    saturatedFat: rawNutrition && typeof (rawNutrition as any).saturatedFat === "string" ? (rawNutrition as any).saturatedFat : "",
                    carbs: rawNutrition && typeof (rawNutrition as any).carbs === "string" ? (rawNutrition as any).carbs : "",
                    sugars: rawNutrition && typeof (rawNutrition as any).sugars === "string" ? (rawNutrition as any).sugars : "",
                    protein: rawNutrition && typeof (rawNutrition as any).protein === "string" ? (rawNutrition as any).protein : "",
                    salt: rawNutrition && typeof (rawNutrition as any).salt === "string" ? (rawNutrition as any).salt : "",
                };

                if (cancelled) return;

                setName(loadedName);
                setSlug(loadedSlug);
                setBrand(loadedBrand);
                setCategory(loadedCategory);
                setDescription(loadedDescription);
                setLongDescription(loadedLongDescription);
                setActive(loadedActive);
                setThumbnailUrl(loadedThumb);
                setVariants(loadedVariants);
                setIngredients(loadedIngredients);
                setAllergens(loadedAllergens);
                setNutrition(loadedNutrition);

                setInitial({
                    name: loadedName,
                    slug: loadedSlug,
                    brand: loadedBrand,
                    category: loadedCategory,
                    description: loadedDescription,
                    longDescription: loadedLongDescription,
                    active: loadedActive,
                    thumbnailUrl: loadedThumb,
                    variants: loadedVariants,
                    ingredients: loadedIngredients,
                    allergens: loadedAllergens,
                    nutrition: loadedNutrition,
                });
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : "Kunne ikkje laste produkt.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [productId]);

    // Keep category valid when brand changes
    useEffect(() => {
        const options = getCategoryOptions(brand || "safteri");
        if (!category || !options.includes(category)) {
            setCategory(options[0] || "");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [brand]);

    const shouldShowAlcoholPercent = brand === "bryggeri" && (category === "Øl" || category === "Sider");

    const hasChanges = useMemo(() => {
        if (!initial) return false;
        const variantsChanged = JSON.stringify(variants) !== JSON.stringify(initial.variants);
        return (
            name !== initial.name ||
            slug !== initial.slug ||
            brand !== initial.brand ||
            category !== initial.category ||
            description !== initial.description ||
            longDescription !== initial.longDescription ||
            active !== initial.active ||
            thumbnailUrl !== initial.thumbnailUrl ||
            variantsChanged ||
            ingredients !== initial.ingredients ||
            allergens !== initial.allergens ||
            JSON.stringify(nutrition) !== JSON.stringify(initial.nutrition)
        );
    }, [initial, name, slug, brand, category, description, longDescription, active, thumbnailUrl, variants, ingredients, allergens, nutrition]);

    async function handleSave() {
        if (!productId) return;
        setSaving(true);
        setError(null);
        setSaved(false);
        setVariantError(null);
        setSaveToast(null);
        setFieldErrors({ variants: {} });
        try {
            const ref = doc(db, "products", productId);

            const computedSlug = slugify(name);

            // Validation (do NOT throw; just show UI errors)
            let hasValidationErrors = false;
            const nextFieldErrors: { name?: string; variants: Record<string, VariantFieldErrors> } = { variants: {} };

            if (!name.trim()) {
                hasValidationErrors = true;
                nextFieldErrors.name = "Produktnamn er påkravd.";
            }

            if (!variants.length) {
                hasValidationErrors = true;
                setVariantError("Du må ha minst éin variant.");
            }

            for (const v of variants) {
                const vErr: VariantFieldErrors = {};

                if (!v.label.trim()) {
                    hasValidationErrors = true;
                    vErr.label = "Storleik er påkravd.";
                }
                if (!v.sku.trim()) {
                    hasValidationErrors = true;
                    vErr.sku = "SKU er påkravd.";
                }

                const priceVal = v.price.trim().replace(",", ".");
                if (!priceVal.length) {
                    hasValidationErrors = true;
                    vErr.price = "Pris er påkravd.";
                } else if (!Number.isFinite(Number(priceVal))) {
                    hasValidationErrors = true;
                    vErr.price = "Pris må vere eit tal (t.d. 89 eller 89,00).";
                }

                if (Object.keys(vErr).length > 0) {
                    nextFieldErrors.variants[v.id] = vErr;
                }
            }

            if (hasValidationErrors) {
                setFieldErrors(nextFieldErrors);
                setSaveToast({ type: "error", message: "Rett opp dei markerte felta før du lagrar." });
                // Ensure button re-enables
                setSaving(false);
                return;
            }

            const nextVariants = variants.map((v) => {
                const retailPrice = Number(v.price.trim().replace(",", "."));

                const nextVariant: {
                    id: string;
                    label: string;
                    sku: string;
                    price: number;
                    prices: {
                        retail: number;
                        trade?: number;
                        distributor?: number;
                    };
                    alcoholPercent?: string;
                    imageUrl?: string;
                    active: boolean;
                } = {
                    id: v.id,
                    label: v.label.trim(),
                    sku: v.sku.trim().toUpperCase(),
                    price: retailPrice,
                    prices: {
                        retail: retailPrice,
                    },
                    active: typeof v.active === "boolean" ? v.active : true,
                };

                if (v.priceTrade.trim()) {
                    nextVariant.prices.trade = Number(v.priceTrade.trim().replace(",", "."));
                }

                if (v.priceDistributor.trim()) {
                    nextVariant.prices.distributor = Number(v.priceDistributor.trim().replace(",", "."));
                }

                if (shouldShowAlcoholPercent && v.alcoholPercent.trim()) {
                    nextVariant.alcoholPercent = v.alcoholPercent.trim();
                }

                const normalizedVariantImageUrl = normalizeImageUrl(v.imageUrl);
                if (normalizedVariantImageUrl) {
                    nextVariant.imageUrl = normalizedVariantImageUrl;
                }

                return nextVariant;
            });

            const next: ProductDoc = {
                name: name.trim(),
                slug: computedSlug,
                brand: brand || "safteri",
                category: category.trim(),
                description: description.trim(),
                longDescription: longDescription.trim(),
                active: !!active,
            };

            // Build update payload (Firestore does NOT allow `undefined` values)
            const payload: Record<string, any> = {
                ...next,
                updatedAt: serverTimestamp(),
            };

            payload.thumbnailUrl = normalizeImageUrl(thumbnailUrl) || deleteField();
            payload.longDescription = longDescription.trim() || deleteField();
            // payload.alcoholPercent removed
            payload.variants = nextVariants;

            // Product-level fields
            payload.ingredients = ingredients.trim() || deleteField();
            payload.allergens = allergens.trim() || deleteField();

            const nextNutrition = {
                basis: nutrition.basis,
                energyKj: nutrition.energyKj.trim(),
                energyKcal: nutrition.energyKcal.trim(),
                fat: nutrition.fat.trim(),
                saturatedFat: nutrition.saturatedFat.trim(),
                carbs: nutrition.carbs.trim(),
                sugars: nutrition.sugars.trim(),
                protein: nutrition.protein.trim(),
                salt: nutrition.salt.trim(),
            };

            const nutritionHasAnyValue = Object.entries(nextNutrition).some(([k, v]) => k === "basis" ? false : !!v);
            payload.nutrition = nutritionHasAnyValue ? nextNutrition : deleteField();

            await updateDoc(ref, payload);

            const nextInitial = {
                name: next.name || "",
                slug: computedSlug,
                brand: next.brand || "safteri",
                category: next.category || "",
                description: next.description || "",
                longDescription: longDescription.trim(),
                active: !!next.active,
                thumbnailUrl: thumbnailUrl.trim(),
                variants: variants.map((v) => ({
                    ...v,
                    label: v.label.trim(),
                    sku: v.sku.trim().toUpperCase(),
                    price: v.price.trim(),
                    priceTrade: v.priceTrade.trim(),
                    priceDistributor: v.priceDistributor.trim(),
                    alcoholPercent: shouldShowAlcoholPercent ? v.alcoholPercent.trim() : "",
                    active: typeof v.active === "boolean" ? v.active : true,
                })),
                ingredients: ingredients.trim(),
                allergens: allergens.trim(),
                nutrition: {
                    basis: nutrition.basis,
                    energyKj: nutrition.energyKj.trim(),
                    energyKcal: nutrition.energyKcal.trim(),
                    fat: nutrition.fat.trim(),
                    saturatedFat: nutrition.saturatedFat.trim(),
                    carbs: nutrition.carbs.trim(),
                    sugars: nutrition.sugars.trim(),
                    protein: nutrition.protein.trim(),
                    salt: nutrition.salt.trim(),
                },
            };

            setName(nextInitial.name);
            setSlug(nextInitial.slug);
            setBrand(nextInitial.brand);
            setCategory(nextInitial.category);
            setDescription(nextInitial.description);
            setLongDescription(nextInitial.longDescription);
            setActive(nextInitial.active);
            setThumbnailUrl(nextInitial.thumbnailUrl);
            setVariants(nextInitial.variants);
            setIngredients(nextInitial.ingredients);
            setAllergens(nextInitial.allergens);
            setNutrition(nextInitial.nutrition);

            setInitial(nextInitial);
            setSaved(true);
            setSaveToast({ type: "success", message: "Endringar lagra." });

            // hide toast after a bit
            window.setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            console.error(err);
            const msg = err instanceof Error ? err.message : "Kunne ikkje lagre endringar.";
            setError(msg);
            setSaveToast({ type: "error", message: msg });
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteProduct() {
        if (!productId || deleting) return;

        const firstConfirm = window.confirm(
            `Slette produktet "${name || "utan namn"}"? Dette kan ikkje angrast.`
        );
        if (!firstConfirm) return;

        const secondConfirm = window.confirm(
            "Er du heilt sikker? Produktet blir sletta frå admin og frå offentlege produktsider. Bilete i Storage blir ikkje automatisk sletta."
        );
        if (!secondConfirm) return;

        setDeleting(true);
        setError(null);
        setSaveToast(null);

        try {
            const ref = doc(db, "products", productId);
            await deleteDoc(ref);
            window.location.href = "/admin/products";
        } catch (err) {
            console.error(err);
            const msg = err instanceof Error ? err.message : "Kunne ikkje slette produktet.";
            setError(msg);
            setSaveToast({ type: "error", message: msg });
            setDeleting(false);
        }
    }

    return (
        <main className="min-h-screen bg-[color:var(--paper)] text-neutral-900">
            <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div>
                        <p className="text-xs tracking-[0.22em] uppercase text-neutral-500">ADMIN</p>
                        <h1
                            className="mt-3 text-5xl leading-[0.95] tracking-tight"
                            style={{ fontFamily: "var(--font-serif)" }}
                        >
                            Rediger produkt
                        </h1>
                        <p className="mt-3 max-w-prose text-sm leading-7 text-neutral-600">
                            Oppdater namn, kategori, thumbnail og variantar.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            href="/admin/products"
                            className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] bg-white px-5 py-2 text-sm text-neutral-800 hover:bg-black/5"
                        >
                            ← Tilbake til produkt
                        </Link>

                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || loading || !hasChanges}
                            className={
                                "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm disabled:opacity-60 transition-colors " +
                                (saving || loading || !hasChanges
                                    ? "bg-neutral-900 text-[color:var(--paper)]"
                                    : "bg-emerald-600 text-white hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-transform transition-shadow")
                            }
                        >
                            {saving ? "Lagrar …" : hasChanges ? "Lagre endringar" : "Ingenting å lagre"}
                        </button>
                        <button
                            type="button"
                            onClick={handleDeleteProduct}
                            disabled={deleting || loading || saving}
                            className="inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 px-5 py-2 text-sm text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {deleting ? "Slettar …" : "Slett produkt"}
                        </button>
                        {saveToast ? (
                            <div
                                className={
                                    "inline-flex items-center rounded-full px-3 py-1 text-[11px] " +
                                    (saveToast.type === "success"
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-red-50 text-red-700")
                                }
                                role="status"
                                aria-live="polite"
                            >
                                {saveToast.message}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="mt-10 h-px w-full bg-[color:var(--line)]" />

                <section className="mt-6">
                    <div className="rounded-[18px] border border-[color:var(--line)] bg-white/70 p-5">
                        {loading ? (
                            <p className="text-sm text-neutral-600">Lastar produkt …</p>
                        ) : error ? (
                            <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                                {error}
                            </div>
                        ) : (
                            <div className="grid gap-6 md:grid-cols-12">
                                {/* LEFT: basic info */}
                                <div className="md:col-span-7 flex flex-col gap-4">
                                    <label className="inline-flex items-center gap-2 text-sm text-neutral-800">
                                        <input
                                            type="checkbox"
                                            checked={active}
                                            onChange={(e) => setActive(e.target.checked)}
                                            className="h-4 w-4"
                                        />
                                        Aktivt produkt
                                    </label>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-neutral-800" htmlFor="prodBrand">
                                            Merke / område
                                        </label>
                                        <select
                                            id="prodBrand"
                                            value={brand || "safteri"}
                                            onChange={(e) => setBrand(e.target.value as ProductDoc["brand"])}
                                            className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-neutral-800"
                                        >
                                            <option value="safteri">Safteri</option>
                                            <option value="bryggeri">Bryggeri</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-neutral-800" htmlFor="prodCategory">
                                            Kategori
                                        </label>
                                        <select
                                            id="prodCategory"
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                            className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-neutral-800"
                                        >
                                            {getCategoryOptions(brand || "safteri").map((opt) => (
                                                <option key={opt} value={opt}>
                                                    {opt}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-neutral-800" htmlFor="prodName">
                                            Produktnamn
                                        </label>
                                        <input
                                            id="prodName"
                                            type="text"
                                            value={name}
                                            onChange={(e) => {
                                                setName(e.target.value);
                                                setSaveToast(null);
                                                setFieldErrors((prev) => ({ ...prev, name: undefined }));
                                            }}
                                            className={
                                                "w-full rounded-[12px] border bg-white px-3 py-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-800 " +
                                                (fieldErrors.name ? "border-red-400" : "border-[color:var(--line)]")
                                            }
                                            placeholder="T.d. Jordbærsylte"
                                        />
                                        {fieldErrors.name ? (
                                            <p className="text-[11px] text-red-600">{fieldErrors.name}</p>
                                        ) : null}
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-neutral-800" htmlFor="prodDescription">
                                            Kort skildring
                                        </label>
                                        <textarea
                                            id="prodDescription"
                                            rows={4}
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            className="w-full resize-none rounded-[12px] border border-[color:var(--line)] bg-white px-3 py-2 text-sm leading-6 outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                            placeholder="Kort tekst som kan visast på produktsida. Trykk Enter for ny linje."
                                        />
                                        <p className="text-[11px] text-neutral-500">
                                            Denne kan innehalde linjeskift (Enter). Vi formaterer dette på nettsida.
                                        </p>
                                    </div>

                                    {/* Produktbilete ligg i høgre kolonne */}
                                </div>

                                {/* RIGHT: thumbnail */}
                                <div className="md:col-span-5 flex">
                                    <div className="flex w-full flex-col rounded-[18px] border border-[color:var(--line)] bg-white p-5">
                                        <h3 className="text-sm font-medium text-neutral-900">Produktbilete</h3>
                                        <p className="mt-1 text-[11px] text-neutral-500">
                                            Dette biletet blir brukt i produktlista (kort/thumbnail).
                                        </p>

                                        <div className="mt-3 flex flex-wrap items-center gap-3">
                                            <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-[11px] font-medium text-neutral-800 hover:bg-black/5">
                                                <span>{thumbUploading ? "Laster opp …" : "Last opp bilete"}</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        setThumbError(null);
                                                        setThumbUploading(true);
                                                        try {
                                                            const uploadFile = await resizeImageBeforeUpload(file);
                                                            const safeName = `${Date.now()}-${uploadFile.name}`;
                                                            const ref = storageRef(storage, `products/thumbnails/${safeName}`);
                                                            await uploadBytes(ref, uploadFile, { contentType: uploadFile.type });
                                                            const url = await getDownloadURL(ref);
                                                            setThumbnailUrl(normalizeImageUrl(url));
                                                        } catch (err) {
                                                            console.error("Feil ved opplasting av produktbilete:", err);
                                                            setThumbError("Noko gjekk gale under opplastinga.");
                                                        } finally {
                                                            setThumbUploading(false);
                                                            e.target.value = "";
                                                        }
                                                    }}
                                                />
                                            </label>

                                            {thumbnailUrl ? (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const ok = window.confirm("Fjerne produktbiletet?");
                                                        if (!ok) return;
                                                        try {
                                                            try {
                                                                await deleteObject(storageRef(storage, thumbnailUrl));
                                                            } catch { }
                                                        } finally {
                                                            setThumbnailUrl("");
                                                        }
                                                    }}
                                                    className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-[11px] font-medium text-neutral-800 hover:bg-black/5"
                                                >
                                                    Fjern
                                                </button>
                                            ) : null}
                                        </div>

                                        {thumbError ? <p className="mt-2 text-[11px] text-red-600">{thumbError}</p> : null}

                                        <div className="mt-4 flex-1">
                                            {thumbnailUrl ? (
                                                <div className="aspect-square w-full overflow-hidden rounded-[16px] border border-[color:var(--line)] bg-neutral-100 p-4">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={thumbnailUrl} alt="Produktbilete" className="h-full w-full object-contain" />
                                                </div>
                                            ) : (
                                                <div className="aspect-square w-full rounded-[16px] border border-dashed border-[color:var(--line)] bg-white/60 p-4">
                                                    <div className="flex h-full flex-col items-center justify-center text-center">
                                                        <p className="text-sm text-neutral-700">Ingen bilete</p>
                                                        <p className="mt-1 text-[11px] text-neutral-500">
                                                            Last opp eit bilete for å vise i produktlista.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* BELOW: variants + status */}
                                <div className="md:col-span-12 space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-end justify-between gap-3">
                                            <div>
                                                <label className="text-xs font-medium text-neutral-800">Variantar</label>
                                                <p className="mt-1 text-[11px] text-neutral-500">Kvar variant har eigen storleik, SKU og pris.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setVariants((prev) => [
                                                        ...prev,
                                                        { id: String(Date.now()), label: "", sku: "", price: "", priceTrade: "", priceDistributor: "", alcoholPercent: "", active: true },
                                                    ]);
                                                }}
                                                className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-[11px] font-medium text-neutral-800 hover:bg-black/5"
                                            >
                                                + Legg til variant
                                            </button>
                                        </div>
                                        {variantError ? (
                                            <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                                                {variantError}
                                            </div>
                                        ) : null}
                                        <div className="space-y-3">
                                            {variants.map((v, idx) => (
                                                <div key={v.id} className="rounded-[14px] border border-[color:var(--line)] bg-white p-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <p className="text-xs font-medium text-neutral-800">Variant {idx + 1}</p>

                                                            <div className="flex items-center gap-2">
                                                                <div className="h-10 w-10 overflow-hidden rounded-[10px] border border-[color:var(--line)] bg-neutral-100">
                                                                    {v.imageUrl ? (
                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                        <img src={v.imageUrl} alt="Variantbilete" className="h-full w-full object-contain p-1" />
                                                                    ) : thumbnailUrl ? (
                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                        <img src={thumbnailUrl} alt="Produktbilete" className="h-full w-full object-contain p-1 opacity-90" />
                                                                    ) : null}
                                                                </div>

                                                                <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[color:var(--line)] bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-800 hover:bg-black/5">
                                                                    <span>Last opp</span>
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        className="hidden"
                                                                        onChange={async (e) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (!file) return;
                                                                            try {
                                                                                const uploadFile = await resizeImageBeforeUpload(file);
                                                                                const safeName = `${Date.now()}-${uploadFile.name}`;
                                                                                const path = `products/variants/${productId}/${v.id}/${safeName}`;
                                                                                const r = storageRef(storage, path);
                                                                                await uploadBytes(r, uploadFile, { contentType: uploadFile.type });
                                                                                const url = await getDownloadURL(r);

                                                                                setVariants((prev) =>
                                                                                    prev.map((x) => (x.id === v.id ? { ...x, imageUrl: normalizeImageUrl(url) } : x))
                                                                                );
                                                                            } catch (err) {
                                                                                console.error("Feil ved opplasting av variantbilete:", err);
                                                                                window.alert("Noko gjekk gale under opplastinga av variantbiletet.");
                                                                            } finally {
                                                                                e.target.value = "";
                                                                            }
                                                                        }}
                                                                    />
                                                                </label>

                                                                {v.imageUrl ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={async () => {
                                                                            const ok = window.confirm("Fjerne variantbiletet?");
                                                                            if (!ok) return;

                                                                            try {
                                                                                try {
                                                                                    await deleteObject(storageRef(storage, v.imageUrl));
                                                                                } catch {
                                                                                    // ignore
                                                                                }
                                                                            } finally {
                                                                                setVariants((prev) =>
                                                                                    prev.map((x) => (x.id === v.id ? { ...x, imageUrl: undefined } : x))
                                                                                );
                                                                            }
                                                                        }}
                                                                        className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-800 hover:bg-black/5"
                                                                    >
                                                                        Fjern
                                                                    </button>
                                                                ) : null}
                                                            </div>

                                                            <label className="inline-flex items-center gap-2 text-[11px] text-neutral-700">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={typeof v.active === "boolean" ? v.active : true}
                                                                    onChange={(e) => {
                                                                        const checked = e.target.checked;
                                                                        setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, active: checked } : x)));
                                                                    }}
                                                                    className="h-4 w-4"
                                                                />
                                                                Aktiv
                                                            </label>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (variants.length === 1) return;
                                                                const ok = window.confirm("Slette denne varianten?");
                                                                if (!ok) return;
                                                                setVariants((prev) => prev.filter((x) => x.id !== v.id));
                                                            }}
                                                            disabled={variants.length === 1}
                                                            className="text-[11px] text-neutral-600 hover:text-neutral-900 disabled:opacity-40"
                                                        >
                                                            Slett
                                                        </button>
                                                    </div>
                                                    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-6">
                                                        <div className="space-y-1">
                                                            <label className="text-[11px] font-medium text-neutral-700">Storleik</label>
                                                            <input
                                                                type="text"
                                                                value={v.label}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setSaveToast(null);
                                                                    setFieldErrors((prev) => {
                                                                        const next = { ...prev };
                                                                        const vErr = { ...(next.variants[v.id] || {}) };
                                                                        delete vErr.label;
                                                                        next.variants = { ...next.variants, [v.id]: vErr };
                                                                        return next;
                                                                    });
                                                                    setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, label: val } : x)));
                                                                }}
                                                                className={
                                                                    "w-full rounded-[12px] border bg-white px-2 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800 " +
                                                                    (fieldErrors.variants[v.id]?.label ? "border-red-400" : "border-[color:var(--line)]")
                                                                }
                                                                placeholder='T.d. "390 ml"'
                                                            />
                                                            {fieldErrors.variants[v.id]?.label ? (
                                                                <p className="mt-1 text-[11px] text-red-600">{fieldErrors.variants[v.id]?.label}</p>
                                                            ) : null}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[11px] font-medium text-neutral-700">SKU</label>
                                                            <input
                                                                type="text"
                                                                value={v.sku}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.toUpperCase();
                                                                    setSaveToast(null);
                                                                    setFieldErrors((prev) => {
                                                                        const next = { ...prev };
                                                                        const vErr = { ...(next.variants[v.id] || {}) };
                                                                        delete vErr.sku;
                                                                        next.variants = { ...next.variants, [v.id]: vErr };
                                                                        return next;
                                                                    });
                                                                    setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, sku: val } : x)));
                                                                }}
                                                                className={
                                                                    "w-full rounded-[12px] border bg-white px-2 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800 " +
                                                                    (fieldErrors.variants[v.id]?.sku ? "border-red-400" : "border-[color:var(--line)]")
                                                                }
                                                                placeholder="T.d. SYLTE-JORDBAR-390"
                                                            />
                                                            {fieldErrors.variants[v.id]?.sku ? (
                                                                <p className="mt-1 text-[11px] text-red-600">{fieldErrors.variants[v.id]?.sku}</p>
                                                            ) : null}
                                                        </div>
                                                        {shouldShowAlcoholPercent ? (
                                                            <div className="space-y-1">
                                                                <label className="text-[11px] font-medium text-neutral-700">Alkoholprosent</label>
                                                                <input
                                                                    type="text"
                                                                    inputMode="decimal"
                                                                    value={v.alcoholPercent}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, alcoholPercent: val } : x)));
                                                                    }}
                                                                    className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-2 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                    placeholder="T.d. 4,7"
                                                                />
                                                            </div>
                                                        ) : null}

                                                        <div className="space-y-1">
                                                            <label className="text-[11px] font-medium text-neutral-700">Utsalspris</label>
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={v.price}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setSaveToast(null);
                                                                    setFieldErrors((prev) => {
                                                                        const next = { ...prev };
                                                                        const vErr = { ...(next.variants[v.id] || {}) };
                                                                        delete vErr.price;
                                                                        next.variants = { ...next.variants, [v.id]: vErr };
                                                                        return next;
                                                                    });
                                                                    setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, price: val } : x)));
                                                                }}
                                                                className={
                                                                    "w-full rounded-[12px] border bg-white px-2 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800 " +
                                                                    (fieldErrors.variants[v.id]?.price ? "border-red-400" : "border-[color:var(--line)]")
                                                                }
                                                                placeholder="T.d. 89"
                                                            />
                                                            {fieldErrors.variants[v.id]?.price ? (
                                                                <p className="mt-1 text-[11px] text-red-600">{fieldErrors.variants[v.id]?.price}</p>
                                                            ) : null}
                                                        </div>

                                                        <div className="space-y-1">
                                                            <label className="text-[11px] font-medium text-neutral-700">Retailpris</label>
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={v.priceTrade}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setSaveToast(null);
                                                                    setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, priceTrade: val } : x)));
                                                                }}
                                                                className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-2 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                placeholder="Valfritt"
                                                            />
                                                        </div>

                                                        <div className="space-y-1">
                                                            <label className="text-[11px] font-medium text-neutral-700">Grossistpris</label>
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={v.priceDistributor}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setSaveToast(null);
                                                                    setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, priceDistributor: val } : x)));
                                                                }}
                                                                className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-2 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                placeholder="Valfritt"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="rounded-[18px] border border-[color:var(--line)] bg-white p-5">
                                        <div>
                                            <h3 className="text-sm font-medium text-neutral-900">Lang skildring</h3>
                                            <p className="mt-1 text-[11px] text-neutral-500">
                                                Dette er den lengre teksten som kan visast inne på produktet. Enter for ny linje.
                                            </p>
                                        </div>

                                        <div className="mt-4 space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-neutral-800" htmlFor="prodLongDescription">
                                                    Lang tekst
                                                </label>
                                                <textarea
                                                    id="prodLongDescription"
                                                    rows={8}
                                                    value={longDescription}
                                                    onChange={(e) => setLongDescription(e.target.value)}
                                                    className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-3 py-2 text-sm leading-6 outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                    placeholder="Skriv ein lengre tekst her. Trykk Enter for ny linje."
                                                />
                                            </div>

                                            {/* Removed alcoholPercent block */}
                                        </div>
                                    </div>

                                    {/* Product-level fields: ingredients, allergens, nutrition */}
                                    <div className="rounded-[18px] border border-[color:var(--line)] bg-white p-5">
                                        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                                            <div>
                                                <h3 className="text-sm font-medium text-neutral-900">Innhald</h3>
                                                <p className="mt-1 text-[11px] text-neutral-500">
                                                    Desse felta gjeld heile produktet (ikkje per variant), men ligg her fordi dei blir endra sjeldnare.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-neutral-800" htmlFor="prodIngredients">
                                                    Ingrediensar
                                                </label>
                                                <textarea
                                                    id="prodIngredients"
                                                    rows={4}
                                                    value={ingredients}
                                                    onChange={(e) => setIngredients(e.target.value)}
                                                    className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-3 py-2 text-sm leading-6 outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                    placeholder="Skriv ingrediensar her. Enter for ny linje."
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-neutral-800" htmlFor="prodAllergens">
                                                    Allergener
                                                </label>
                                                <textarea
                                                    id="prodAllergens"
                                                    rows={4}
                                                    value={allergens}
                                                    onChange={(e) => setAllergens(e.target.value)}
                                                    className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-3 py-2 text-sm leading-6 outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                    placeholder='T.d. "Ingen" eller ei liste. Enter for ny linje.'
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-6">
                                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <h4 className="text-xs font-medium text-neutral-900">Næringsinnhald</h4>
                                                    <p className="mt-1 text-[11px] text-neutral-500">
                                                        Fyll inn verdiane som tekst (t.d. "0,5 g").
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] text-neutral-600">Basis:</span>
                                                    <select
                                                        value={nutrition.basis}
                                                        onChange={(e) => setNutrition((prev) => ({ ...prev, basis: e.target.value as NutritionForm["basis"] }))}
                                                        className="rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-[11px] outline-none focus:border-neutral-800"
                                                    >
                                                        <option value="per_100g">Per 100 g</option>
                                                        <option value="per_100ml">Per 100 ml</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="mt-3 overflow-hidden rounded-[14px] border border-[color:var(--line)]">
                                                <div className="grid grid-cols-12 bg-white/70 px-3 py-2 text-[11px] font-medium text-neutral-700">
                                                    <div className="col-span-6">Næringsinnhald</div>
                                                    <div className="col-span-6 text-right">Verdi</div>
                                                </div>

                                                <div className="divide-y divide-[color:var(--line)] bg-white">
                                                    <div className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                                                        <div className="col-span-6 text-[11px] text-neutral-700">Energi</div>
                                                        <div className="col-span-6 flex justify-end gap-2">
                                                            <input
                                                                type="text"
                                                                value={nutrition.energyKj}
                                                                onChange={(e) => setNutrition((p) => ({ ...p, energyKj: e.target.value }))}
                                                                className="w-24 rounded-[10px] border border-[color:var(--line)] bg-white px-2 py-1.5 text-[11px] outline-none focus:border-neutral-800"
                                                                placeholder="kJ"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={nutrition.energyKcal}
                                                                onChange={(e) => setNutrition((p) => ({ ...p, energyKcal: e.target.value }))}
                                                                className="w-24 rounded-[10px] border border-[color:var(--line)] bg-white px-2 py-1.5 text-[11px] outline-none focus:border-neutral-800"
                                                                placeholder="kcal"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                                                        <div className="col-span-6 text-[11px] text-neutral-700">Feitt</div>
                                                        <div className="col-span-6 flex justify-end">
                                                            <input
                                                                type="text"
                                                                value={nutrition.fat}
                                                                onChange={(e) => setNutrition((p) => ({ ...p, fat: e.target.value }))}
                                                                className="w-52 rounded-[10px] border border-[color:var(--line)] bg-white px-2 py-1.5 text-[11px] outline-none focus:border-neutral-800"
                                                                placeholder="T.d. 0,5 g"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                                                        <div className="col-span-6 pl-4 text-[11px] text-neutral-600">– metta feittsyrer</div>
                                                        <div className="col-span-6 flex justify-end">
                                                            <input
                                                                type="text"
                                                                value={nutrition.saturatedFat}
                                                                onChange={(e) => setNutrition((p) => ({ ...p, saturatedFat: e.target.value }))}
                                                                className="w-52 rounded-[10px] border border-[color:var(--line)] bg-white px-2 py-1.5 text-[11px] outline-none focus:border-neutral-800"
                                                                placeholder="T.d. 0,1 g"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                                                        <div className="col-span-6 text-[11px] text-neutral-700">Karbohydrat</div>
                                                        <div className="col-span-6 flex justify-end">
                                                            <input
                                                                type="text"
                                                                value={nutrition.carbs}
                                                                onChange={(e) => setNutrition((p) => ({ ...p, carbs: e.target.value }))}
                                                                className="w-52 rounded-[10px] border border-[color:var(--line)] bg-white px-2 py-1.5 text-[11px] outline-none focus:border-neutral-800"
                                                                placeholder="T.d. 35 g"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                                                        <div className="col-span-6 pl-4 text-[11px] text-neutral-600">– sukkerartar</div>
                                                        <div className="col-span-6 flex justify-end">
                                                            <input
                                                                type="text"
                                                                value={nutrition.sugars}
                                                                onChange={(e) => setNutrition((p) => ({ ...p, sugars: e.target.value }))}
                                                                className="w-52 rounded-[10px] border border-[color:var(--line)] bg-white px-2 py-1.5 text-[11px] outline-none focus:border-neutral-800"
                                                                placeholder="T.d. 33 g"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                                                        <div className="col-span-6 text-[11px] text-neutral-700">Protein</div>
                                                        <div className="col-span-6 flex justify-end">
                                                            <input
                                                                type="text"
                                                                value={nutrition.protein}
                                                                onChange={(e) => setNutrition((p) => ({ ...p, protein: e.target.value }))}
                                                                className="w-52 rounded-[10px] border border-[color:var(--line)] bg-white px-2 py-1.5 text-[11px] outline-none focus:border-neutral-800"
                                                                placeholder="T.d. 0,7 g"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                                                        <div className="col-span-6 text-[11px] text-neutral-700">Salt</div>
                                                        <div className="col-span-6 flex justify-end">
                                                            <input
                                                                type="text"
                                                                value={nutrition.salt}
                                                                onChange={(e) => setNutrition((p) => ({ ...p, salt: e.target.value }))}
                                                                className="w-52 rounded-[10px] border border-[color:var(--line)] bg-white px-2 py-1.5 text-[11px] outline-none focus:border-neutral-800"
                                                                placeholder="T.d. 0,01 g"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <button
                                            type="button"
                                            onClick={handleDeleteProduct}
                                            disabled={deleting || loading || saving}
                                            className="inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 px-5 py-2 text-sm text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {deleting ? "Slettar …" : "Slett produkt"}
                                        </button>

                                        {saved && (
                                            <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700">
                                                Endringar lagra.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}