

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { db, storage } from "@/lib/firebase";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { deleteField, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

type ProductDoc = {
    name?: string;
    slug?: string;
    brand?: "safteri" | "bryggeri";
    category?: string;
    active?: boolean;
    thumbnailUrl?: string;
    variants?: Array<{
        id: string;
        label: string;
        sku: string;
        price: number;
        imageUrl?: string;
        active?: boolean;
    }>;
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
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    // Form state
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [brand, setBrand] = useState<ProductDoc["brand"]>("safteri");
    const [category, setCategory] = useState("");
    const [active, setActive] = useState(true);
    // Thumbnail state
    const [thumbnailUrl, setThumbnailUrl] = useState<string>("");
    const [thumbUploading, setThumbUploading] = useState(false);
    const [thumbError, setThumbError] = useState<string | null>(null);

    // Variants
    type VariantForm = { id: string; label: string; sku: string; price: string; imageUrl?: string };
    const [variants, setVariants] = useState<VariantForm[]>([]);
    const [variantError, setVariantError] = useState<string | null>(null);

    // Initial state to detect changes
    const [initial, setInitial] = useState<{
        name: string;
        slug: string;
        brand: ProductDoc["brand"];
        category: string;
        active: boolean;
        thumbnailUrl: string;
        variants: VariantForm[];
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
                const loadedActive = typeof data.active === "boolean" ? data.active : true;
                const loadedThumb = typeof data.thumbnailUrl === "string" ? data.thumbnailUrl : "";
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
                            price: String(v.price),
                            imageUrl: v.imageUrl,
                        }));
                }
                if (!loadedVariants.length) {
                    loadedVariants = [{ id: String(Date.now()), label: "", sku: "", price: "" }];
                }

                if (cancelled) return;

                setName(loadedName);
                setSlug(loadedSlug);
                setBrand(loadedBrand);
                setCategory(loadedCategory);
                setActive(loadedActive);
                setThumbnailUrl(loadedThumb);
                setVariants(loadedVariants);

                setInitial({
                    name: loadedName,
                    slug: loadedSlug,
                    brand: loadedBrand,
                    category: loadedCategory,
                    active: loadedActive,
                    thumbnailUrl: loadedThumb,
                    variants: loadedVariants,
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

    const hasChanges = useMemo(() => {
        if (!initial) return false;
        const variantsChanged = JSON.stringify(variants) !== JSON.stringify(initial.variants);
        return (
            name !== initial.name ||
            slug !== initial.slug ||
            brand !== initial.brand ||
            category !== initial.category ||
            active !== initial.active ||
            thumbnailUrl !== initial.thumbnailUrl ||
            variantsChanged
        );
    }, [initial, name, slug, brand, category, active, thumbnailUrl, variants]);

    async function handleSave() {
        if (!productId) return;
        setSaving(true);
        setError(null);
        setSaved(false);
        setVariantError(null);
        try {
            const ref = doc(db, "products", productId);

            if (!name.trim()) {
                throw new Error("Produktnamn må vere fylt ut før lagring.");
            }

            const computedSlug = slugify(name);

            // Validate variants
            if (!variants.length) {
                setVariantError("Du må ha minst éin variant.");
                throw new Error("Du må ha minst éin variant.");
            }
            for (const v of variants) {
                if (!v.label.trim() || !v.sku.trim()) {
                    setVariantError("Alle variantar må ha storleik og SKU.");
                    throw new Error("Alle variantar må ha storleik og SKU.");
                }
                const priceVal = v.price.trim().replace(",", ".");
                if (!priceVal.length || !Number.isFinite(Number(priceVal))) {
                    setVariantError("Alle variantar må ha ein gyldig pris.");
                    throw new Error("Alle variantar må ha ein gyldig pris.");
                }
            }

            const nextVariants = variants.map((v) => {
                const nextVariant: {
                    id: string;
                    label: string;
                    sku: string;
                    price: number;
                    imageUrl?: string;
                } = {
                    id: v.id,
                    label: v.label.trim(),
                    sku: v.sku.trim(),
                    price: Number(v.price.trim().replace(",", ".")),
                };

                if (typeof v.imageUrl === "string" && v.imageUrl.trim().length > 0) {
                    nextVariant.imageUrl = v.imageUrl.trim();
                }

                return nextVariant;
            });

            const next: ProductDoc = {
                name: name.trim(),
                slug: computedSlug,
                brand: brand || "safteri",
                category: category.trim(),
                active: !!active,
            };

            // Build update payload (Firestore does NOT allow `undefined` values)
            const payload: Record<string, any> = {
                ...next,
                updatedAt: serverTimestamp(),
            };

            payload.thumbnailUrl = thumbnailUrl.trim() || deleteField();
            payload.variants = nextVariants;

            await updateDoc(ref, payload);

            const nextInitial = {
                name: next.name || "",
                slug: computedSlug,
                brand: next.brand || "safteri",
                category: next.category || "",
                active: !!next.active,
                thumbnailUrl: thumbnailUrl.trim(),
                variants: variants.map((v) => ({
                    ...v,
                    label: v.label.trim(),
                    sku: v.sku.trim(),
                    price: v.price.trim(),
                })),
            };

            setInitial(nextInitial);
            setSaved(true);

            // hide toast after a bit
            window.setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Kunne ikkje lagre endringar.");
        } finally {
            setSaving(false);
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
                                "inline-flex items-center justify-center rounded-full bg-neutral-900 px-5 py-2 text-sm text-[color:var(--paper)] disabled:opacity-60 " +
                                (saving || loading || !hasChanges
                                    ? ""
                                    : "hover:bg-neutral-800 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-transform transition-shadow")
                            }
                        >
                            {saving ? "Lagrar …" : hasChanges ? "Lagre endringar" : "Ingenting å lagre"}
                        </button>
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
                            <div className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-neutral-800" htmlFor="prodName">
                                            Produktnamn
                                        </label>
                                        <input
                                            id="prodName"
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                            placeholder="T.d. Jordbærsylte"
                                        />
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
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
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
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-neutral-800">Produktbilete (mini)</label>
                                    <p className="text-[11px] text-neutral-500">Eitt bilete som blir brukt i produktlista (kort/thumbnail).</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-3">
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
                                                        const safeName = `${Date.now()}-${file.name}`;
                                                        const ref = storageRef(storage, `products/thumbnails/${safeName}`);
                                                        await uploadBytes(ref, file);
                                                        const url = await getDownloadURL(ref);
                                                        setThumbnailUrl(url);
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
                                                        // Attempt to delete from storage if it is a Firebase storage URL
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
                                    {thumbError ? <p className="mt-1 text-[11px] text-red-600">{thumbError}</p> : null}
                                    {thumbnailUrl ? (
                                        <div className="mt-3 h-24 w-24 overflow-hidden rounded-[12px] border border-[color:var(--line)] bg-neutral-100">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={thumbnailUrl} alt="Produktbilete" className="h-full w-full object-cover" />
                                        </div>
                                    ) : null}
                                </div>

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
                                                    { id: String(Date.now()), label: "", sku: "", price: "" },
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
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-xs font-medium text-neutral-800">Variant {idx + 1}</p>
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
                                                <div className="mt-3 grid gap-3 md:grid-cols-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-medium text-neutral-700">Storleik</label>
                                                        <input
                                                            type="text"
                                                            value={v.label}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, label: val } : x)));
                                                            }}
                                                            className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                            placeholder='T.d. "390 ml"'
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-medium text-neutral-700">SKU</label>
                                                        <input
                                                            type="text"
                                                            value={v.sku}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, sku: val } : x)));
                                                            }}
                                                            className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                            placeholder="T.d. SYLTE-JORDBAR-390"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-medium text-neutral-700">Pris</label>
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={v.price}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, price: val } : x)));
                                                            }}
                                                            className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                            placeholder="T.d. 89"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <label className="inline-flex items-center gap-2 text-sm text-neutral-800">
                                        <input
                                            type="checkbox"
                                            checked={active}
                                            onChange={(e) => setActive(e.target.checked)}
                                            className="h-4 w-4"
                                        />
                                        Aktiv
                                    </label>

                                    {saved && (
                                        <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700">
                                            Endringar lagra.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}