"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import {
    listenToProducts,
    upsertProductMinimal,
    toSlug,
    type ProductBrand,
} from "@/lib/productsFirestore";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminProductsPage() {
    const router = useRouter();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const [query, setQuery] = useState("");
    const [brandFilter, setBrandFilter] = useState<"alle" | ProductBrand>("alle");
    const [categoryFilter, setCategoryFilter] = useState("alle");

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [variantDraft, setVariantDraft] = useState<Record<string, string>>({});
    const [variantDirty, setVariantDirty] = useState<Record<string, boolean>>({});
    const [variantErrors, setVariantErrors] = useState<Record<string, string>>({});
    const [variantsByProductId, setVariantsByProductId] = useState<Record<string, any[]>>({});
    const [variantsLoadingId, setVariantsLoadingId] = useState<string | null>(null);
    const [thumbnailById, setThumbnailById] = useState<Record<string, string>>({});
    const [thumbLoadingIds, setThumbLoadingIds] = useState<Set<string>>(new Set());

    const SAFT_CATEGORY_OPTIONS = ["Sylte", "Gelé", "Saus", "Saft", "Rein", "Frisk", "Iskrem"];
    const BRYGGERI_CATEGORY_OPTIONS = ["Øl", "Sider"];

    function normalizeCategory(value: unknown) {
        return String(value ?? "").trim();
    }

    function getCategoryOptionsForBrand() {
        if (brandFilter === "safteri") return SAFT_CATEGORY_OPTIONS;
        if (brandFilter === "bryggeri") return BRYGGERI_CATEGORY_OPTIONS;

        const found = Array.from(
            new Set(
                products
                    .map((product) => normalizeCategory(product?.category))
                    .filter((category) => category.length > 0)
            )
        );

        return found.sort((a, b) => a.localeCompare(b, "nb"));
    }

    function formatNok(v: number) {
        return new Intl.NumberFormat("nb-NO", {
            style: "currency",
            currency: "NOK",
            maximumFractionDigits: 0,
        }).format(v);
    }

    function parsePrice(input: string): number | null {
        // Accepts "123", "123,45", "123.45"
        if (!input) return null;
        let normalized = input.trim().replace(",", ".");
        const parsed = Number(normalized);
        if (Number.isFinite(parsed)) return parsed;
        return null;
    }

    function getVariantItemNumber(variant: any) {
        return String(variant?.itemNumber ?? variant?.sku ?? "").trim();
    }

    function normalizeVariantForSave(variant: any) {
        const itemNumber = getVariantItemNumber(variant);
        return {
            ...variant,
            itemNumber,
            sku: itemNumber,
        };
    }

    async function persistVariants(productId: string, nextVariants: any[]) {
        try {
            const normalizedVariants = nextVariants.map(normalizeVariantForSave);

            // Keep local cache in sync (source of truth for variants on this page)
            setVariantsByProductId((prev) => ({ ...prev, [productId]: normalizedVariants }));

            await updateDoc(doc(db, "products", productId), { variants: normalizedVariants });
            setToast("Variantane vart oppdatert");
            setTimeout(() => setToast(null), 2000);
        } catch (err) {
            console.error(err);
            setError("Kunne ikkje oppdatere variantane.");
        }
    }

    function updateVariantLocalAndPersist(
        productId: string,
        variantId: string,
        patch: {
            price?: number;
            prices?: {
                retail?: number;
                trade?: number;
                distributor?: number;
            };
            active?: boolean;
        }
    ) {
        // IMPORTANT: On this page, `listenToProducts` does not guarantee that `product.variants`
        // is included. Using it can wipe variants in Firestore. We only persist after variants
        // are loaded into `variantsByProductId`.
        const cached = variantsByProductId[productId];
        if (!Array.isArray(cached)) {
            // If variants are not loaded yet, don't risk overwriting.
            setError("Last variantane først (opne produktet), før du endrar pris/aktiv.");
            return;
        }

        const nextVariants = cached.map((variant: any, idx: number) => {
            const vId = String(variant?.id ?? variant?.variantId ?? idx);
            if (vId === variantId) return normalizeVariantForSave({ ...variant, ...patch });
            return normalizeVariantForSave(variant);
        });

        // Update cache immediately
        setVariantsByProductId((prev) => ({ ...prev, [productId]: nextVariants }));

        // Also update products state if the product currently has variants loaded there (optional)
        setProducts((prev) =>
            prev.map((p) => (p.id === productId ? { ...p, variants: nextVariants } : p))
        );

        void persistVariants(productId, nextVariants);
    }

    const filteredProducts = products
        .filter((p) => {
            const q = query.trim().toLowerCase();
            if (!q) return true;
            const name = String(p?.name ?? "").toLowerCase();
            const category = String(p?.category ?? "").toLowerCase();
            const sku = String(p?.sku ?? "").toLowerCase();
            const slug = String(p?.slug ?? "").toLowerCase();
            return (
                name.includes(q) ||
                category.includes(q) ||
                sku.includes(q) ||
                slug.includes(q)
            );
        })
        .filter((p) => {
            if (brandFilter === "alle") return true;
            return String(p?.brand ?? "") === brandFilter;
        })
        .filter((p) => {
            if (categoryFilter === "alle") return true;
            return normalizeCategory(p?.category) === categoryFilter;
        })
        .slice()
        .sort((a, b) => String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "nb"));

    const counts = {
        alle: products.length,
        safteri: products.filter((p) => String(p?.brand ?? "") === "safteri").length,
        bryggeri: products.filter((p) => String(p?.brand ?? "") === "bryggeri").length,
    };

    const categoryOptions = getCategoryOptionsForBrand();

    async function ensureVariantsLoaded(productId: string) {
        // already cached
        if (Array.isArray(variantsByProductId[productId])) return;

        setVariantsLoadingId(productId);
        try {
            const snap = await getDoc(doc(db, "products", productId));
            const data = snap.exists() ? (snap.data() as any) : null;
            // Capture thumbnailUrl if present
            const thumb = data && typeof data.thumbnailUrl === "string" ? data.thumbnailUrl.trim() : "";
            if (thumb) setThumbnailById((prev) => ({ ...prev, [productId]: thumb }));
            const variants = data && Array.isArray(data.variants) ? data.variants : [];
            setVariantsByProductId((prev) => ({ ...prev, [productId]: variants }));
            setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, variants } : p)));
        } catch (err) {
            console.error(err);
            setError("Kunne ikkje laste variantar for produktet.");
        } finally {
            setVariantsLoadingId((cur) => (cur === productId ? null : cur));
        }
    }
    // Helper to ensure thumbnail is loaded for a product
    async function ensureThumbnailLoaded(productId: string) {
        if (thumbnailById[productId]) return;
        if (thumbLoadingIds.has(productId)) return;

        setThumbLoadingIds((prev) => new Set(prev).add(productId));
        try {
            const snap = await getDoc(doc(db, "products", productId));
            const data = snap.exists() ? (snap.data() as any) : null;
            const url = data && typeof data.thumbnailUrl === "string" ? data.thumbnailUrl.trim() : "";
            if (url) {
                setThumbnailById((prev) => ({ ...prev, [productId]: url }));
            }
        } catch (err) {
            // silent: thumbnail is optional
            console.error(err);
        } finally {
            setThumbLoadingIds((prev) => {
                const next = new Set(prev);
                next.delete(productId);
                return next;
            });
        }
    }

    useEffect(() => {
        // Preload thumbnails for the current filtered list (best-effort)
        const ids = filteredProducts.map((p) => String(p?.id ?? "")).filter(Boolean);
        for (const id of ids) {
            // Only fetch when the list item doesn't already contain a usable thumbnail
            const p = filteredProducts.find((x) => String(x?.id ?? "") === id);
            const direct = [
                p?.thumbnailUrl,
                p?.thumbUrl,
                p?.imageUrl,
                p?.mainImageUrl,
                p?.photoUrl,
                p?.image,
            ].find((v) => typeof v === "string" && v.trim());

            if (!direct && !thumbnailById[id]) {
                void ensureThumbnailLoaded(id);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredProducts]);

    async function handleAddProduct() {
        if (creating) return;

        setCreating(true);
        setError(null);

        try {
            const id =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                    ? crypto.randomUUID()
                    : String(Date.now());

            const name = "Nytt produkt";
            const brand: ProductBrand = "safteri";

            await upsertProductMinimal({
                id,
                name,
                brand,
                category: "",
                slug: toSlug(name) || "",
                active: true,
            });
            router.push(`/admin/products/${id}`);
        } catch (err) {
            console.error(err);
            setError("Kunne ikkje opprette nytt produkt.");
        } finally {
            setCreating(false);
        }
    }

    useEffect(() => {
        const unsubscribe = listenToProducts(
            (items) => {
                setProducts(items);
                setLoading(false);
            },
            (err) => {
                console.error(err);
                setError("Kunne ikkje laste produkt.");
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    return (
        <main className="min-h-screen bg-[color:var(--paper)] text-neutral-900">
            <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">

                {/* Header */}
                <header className="flex flex-col gap-3 border-b border-[color:var(--line)] pb-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-neutral-600">
                            Admin
                        </p>
                        <h1
                            className="mt-2 text-3xl tracking-tight md:text-4xl"
                            style={{ fontFamily: "var(--font-serif)" }}
                        >
                            Produkter
                        </h1>
                        <p className="mt-2 max-w-prose text-xs text-neutral-600">
                            Administrer produktbiblioteket – prisar, varenummer, strekkodar, kategoriar, storleikar og bilete.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            href="/admin/prices"
                            className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700 transition hover:bg-emerald-100"
                        >
                            Prisjustering →
                        </Link>

                        <Link
                            href="/admin/products/list"
                            className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-xs text-neutral-700 hover:bg-black/5"
                        >
                            Vareliste →
                        </Link>

                        <button
                            type="button"
                            onClick={handleAddProduct}
                            disabled={creating}
                            className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-xs text-[color:var(--paper)] hover:bg-neutral-800 disabled:opacity-60"
                        >
                            {creating ? "Opprettar …" : "Legg til produkt"}
                        </button>

                        <Link
                            href="/admin"
                            className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] px-4 py-1.5 text-xs text-neutral-700 hover:bg-black/5"
                        >
                            ← Tilbake til admin
                        </Link>
                    </div>
                </header>

                <section className="mt-8">
                    <div className="rounded-[18px] border border-[color:var(--line)] bg-white/70 p-6">
                        <div className="flex flex-col gap-3 border-b border-[color:var(--line)] pb-5 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center">
                                <div className="w-full md:w-[340px]">
                                    <label className="sr-only" htmlFor="productSearch">Søk</label>
                                    <input
                                        id="productSearch"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Søk etter namn, kategori, varenummer, strekkode eller slug …"
                                        className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                    />
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {([
                                        { key: "alle" as const, label: `Alle (${counts.alle})` },
                                        { key: "safteri" as const, label: `Safteri (${counts.safteri})` },
                                        { key: "bryggeri" as const, label: `Bryggeri (${counts.bryggeri})` },
                                    ] as const).map((b) => (
                                        <button
                                            key={b.key}
                                            type="button"
                                            onClick={() => {
                                                setBrandFilter(b.key);
                                                setCategoryFilter("alle");
                                            }}
                                            className={`rounded-full border px-3 py-1.5 text-[11px] transition-colors ${brandFilter === b.key
                                                ? "border-neutral-900 bg-neutral-900 text-[color:var(--paper)]"
                                                : "border-[color:var(--line)] bg-white text-neutral-700 hover:bg-black/5"
                                                }`}
                                        >
                                            {b.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="w-full md:w-[180px]">
                                    <label className="sr-only" htmlFor="categoryFilter">Kategori</label>
                                    <select
                                        id="categoryFilter"
                                        value={categoryFilter}
                                        onChange={(e) => setCategoryFilter(e.target.value)}
                                        className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs text-neutral-900 outline-none focus:border-neutral-800"
                                    >
                                        <option value="alle">Alle kategoriar</option>
                                        {categoryOptions.map((category) => (
                                            <option key={category} value={category}>
                                                {category}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <p className="text-[11px] text-neutral-500">
                                Viser {filteredProducts.length} av {products.length}
                            </p>
                        </div>

                        {toast && (
                            <div className="mt-4 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">{toast}</div>
                        )}

                        {loading && (
                            <p className="text-sm text-neutral-600">Lastar produkt …</p>
                        )}

                        {error && (
                            <p className="text-sm text-red-600">{error}</p>
                        )}

                        {!loading && !error && filteredProducts.length === 0 && (
                            <p className="text-sm text-neutral-600">
                                Ingen produkt funne. Prøv å endre søket eller filteret.
                            </p>
                        )}

                        {!loading && !error && filteredProducts.length > 0 && (
                            <ul className="divide-y divide-[color:var(--line)]">
                                {filteredProducts.map((product) => {
                                    const isExpanded = expandedId === product.id;

                                    function onKeyDownToggle(e: React.KeyboardEvent) {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            const next = expandedId === product.id ? null : product.id;
                                            setExpandedId(next);
                                            if (next) void ensureVariantsLoaded(product.id);
                                        }
                                    }

                                    const variants = Array.isArray(variantsByProductId[product.id])
                                        ? variantsByProductId[product.id]
                                        : (Array.isArray(product.variants) ? product.variants : []);

                                    return (
                                        <li key={product.id} className="py-4">
                                            {/* Row (click to expand) */}
                                            <div
                                                className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between cursor-pointer"
                                                onClick={async () => {
                                                    const next = expandedId === product.id ? null : product.id;
                                                    setExpandedId(next);
                                                    if (next) await ensureVariantsLoaded(product.id);
                                                }}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={onKeyDownToggle}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="relative h-12 w-12 overflow-hidden rounded-[14px] border border-[color:var(--line)] bg-white">
                                                        {(() => {
                                                            const direct = [
                                                                product?.thumbnailUrl,
                                                                thumbnailById[product.id],
                                                                product?.thumbUrl,
                                                                product?.imageUrl,
                                                                product?.mainImageUrl,
                                                                product?.photoUrl,
                                                                product?.image,
                                                            ].find((v) => typeof v === "string" && v.trim());

                                                            const fromVariants = Array.isArray(variantsByProductId?.[product.id])
                                                                ? variantsByProductId[product.id]
                                                                    .map((v: any) => v?.imageUrl || v?.thumbnailUrl || v?.photoUrl)
                                                                    .find((v: any) => typeof v === "string" && v.trim())
                                                                : null;

                                                            const firstInImages = Array.isArray(product?.images)
                                                                ? product.images
                                                                    .map((i: any) => i?.url || i?.src)
                                                                    .find((v: any) => typeof v === "string" && v.trim())
                                                                : null;

                                                            const url = direct || fromVariants || firstInImages;

                                                            return typeof url === "string" && url.trim() ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img
                                                                    src={url}
                                                                    alt={product?.name ?? "Produkt"}
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="flex h-full w-full items-center justify-center text-[11px] font-medium text-neutral-500">
                                                                    {String(product?.name ?? "P")
                                                                        .slice(0, 1)
                                                                        .toUpperCase()}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>

                                                    <div>
                                                        <p className="text-sm font-medium text-neutral-900">
                                                            {product.name}
                                                        </p>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
                                                            <span>
                                                                {product.category
                                                                    ? product.category
                                                                    : "Utan kategori"}
                                                            </span>
                                                            <span className="text-neutral-300">•</span>
                                                            <span
                                                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${product.brand === "bryggeri"
                                                                    ? "bg-amber-100 text-amber-800"
                                                                    : "bg-rose-100 text-rose-800"
                                                                    }`}
                                                            >
                                                                {product.brand === "bryggeri"
                                                                    ? "Bryggeri"
                                                                    : "Safteri"}
                                                            </span>
                                                            <span className="text-neutral-300">•</span>
                                                            <span
                                                                className={
                                                                    product.active
                                                                        ? "text-emerald-700"
                                                                        : "text-neutral-500"
                                                                }
                                                            >
                                                                {product.active ? "Aktiv" : "Inaktiv"}
                                                            </span>
                                                            {typeof product?.price === "number" &&
                                                                !Number.isNaN(product.price) && (
                                                                    <>
                                                                        <span className="text-neutral-300">•</span>
                                                                        <span className="text-neutral-700">
                                                                            {formatNok(product.price)}
                                                                        </span>
                                                                    </>
                                                                )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-end gap-2">
                                                    <Link
                                                        href={`/admin/products/${product.id}`}
                                                        className="rounded-full border border-[color:var(--line)] px-3 py-1.5 text-xs text-neutral-700 hover:bg-black/5"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        Rediger →
                                                    </Link>
                                                </div>
                                            </div>

                                            {/* Expanded variants (full width under the row) */}
                                            {isExpanded && (
                                                <div
                                                    className="mt-3 rounded-[14px] border border-[color:var(--line)] bg-white p-4"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[11px] font-medium text-neutral-700">
                                                            Variantar
                                                        </p>
                                                        <button
                                                            type="button"
                                                            className="text-[11px] text-neutral-600 hover:text-neutral-900"
                                                            onClick={() => setExpandedId(null)}
                                                        >
                                                            Lukk
                                                        </button>
                                                    </div>

                                                    {variantsLoadingId === product.id ? (
                                                        <p className="mt-2 text-[11px] text-neutral-600">
                                                            Lastar variantar …
                                                        </p>
                                                    ) : variants.length === 0 ? (
                                                        <p className="mt-2 text-[11px] text-neutral-600">
                                                            Ingen variantar på dette produktet.
                                                        </p>
                                                    ) : (
                                                        <ul className="mt-2 space-y-2">
                                                            {variants.map((variant: any, idx: number) => {
                                                                const variantId = String(
                                                                    variant?.id ??
                                                                    variant?.variantId ??
                                                                    idx
                                                                );
                                                                const key = `${product.id}:${variantId}`;
                                                                const tradeKey = `${key}:trade`;
                                                                const distributorKey = `${key}:distributor`;
                                                                const draftValue =
                                                                    variantDraft[key] ??
                                                                    (variant?.prices?.retail != null
                                                                        ? String(variant.prices.retail)
                                                                        : variant.price != null
                                                                            ? String(variant.price)
                                                                            : "");
                                                                const draftTradeValue =
                                                                    variantDraft[tradeKey] ??
                                                                    (variant?.prices?.trade != null ? String(variant.prices.trade) : "");
                                                                const draftDistributorValue =
                                                                    variantDraft[distributorKey] ??
                                                                    (variant?.prices?.distributor != null ? String(variant.prices.distributor) : "");
                                                                const errorMsg = variantErrors[key];

                                                                function onPriceChange(
                                                                    fieldKey: string,
                                                                    value: string
                                                                ) {
                                                                    setVariantDraft((d) => ({
                                                                        ...d,
                                                                        [fieldKey]: value,
                                                                    }));
                                                                    setVariantDirty((d) => ({
                                                                        ...d,
                                                                        [fieldKey]: true,
                                                                    }));
                                                                    setVariantErrors((errs) => {
                                                                        const copy = { ...errs };
                                                                        delete copy[key];
                                                                        return copy;
                                                                    });
                                                                }

                                                                function onPriceSave() {
                                                                    const parsedRetail = parsePrice(draftValue);
                                                                    const parsedTrade = draftTradeValue.trim() ? parsePrice(draftTradeValue) : null;
                                                                    const parsedDistributor = draftDistributorValue.trim() ? parsePrice(draftDistributorValue) : null;

                                                                    if (parsedRetail === null) {
                                                                        setVariantErrors((errs) => ({
                                                                            ...errs,
                                                                            [key]: "Utsalspris må vere eit tal",
                                                                        }));
                                                                        return;
                                                                    }

                                                                    if (draftTradeValue.trim() && parsedTrade === null) {
                                                                        setVariantErrors((errs) => ({
                                                                            ...errs,
                                                                            [key]: "Retailpris må vere eit tal",
                                                                        }));
                                                                        return;
                                                                    }

                                                                    if (draftDistributorValue.trim() && parsedDistributor === null) {
                                                                        setVariantErrors((errs) => ({
                                                                            ...errs,
                                                                            [key]: "Grossistpris må vere eit tal",
                                                                        }));
                                                                        return;
                                                                    }

                                                                    const prices: {
                                                                        retail: number;
                                                                        trade?: number;
                                                                        distributor?: number;
                                                                    } = {
                                                                        retail: parsedRetail,
                                                                    };

                                                                    if (parsedTrade !== null) prices.trade = parsedTrade;
                                                                    if (parsedDistributor !== null) prices.distributor = parsedDistributor;

                                                                    setVariantErrors((errs) => {
                                                                        const copy = { ...errs };
                                                                        delete copy[key];
                                                                        return copy;
                                                                    });
                                                                    setVariantDirty((d) => ({
                                                                        ...d,
                                                                        [key]: false,
                                                                        [tradeKey]: false,
                                                                        [distributorKey]: false,
                                                                    }));
                                                                    updateVariantLocalAndPersist(
                                                                        product.id,
                                                                        variantId,
                                                                        { price: parsedRetail, prices }
                                                                    );
                                                                }

                                                                function onActiveChange(
                                                                    e: React.ChangeEvent<HTMLInputElement>
                                                                ) {
                                                                    updateVariantLocalAndPersist(
                                                                        product.id,
                                                                        variantId,
                                                                        { active: e.target.checked }
                                                                    );
                                                                }

                                                                const sizeLabel =
                                                                    variant.size ??
                                                                    variant.label ??
                                                                    variant.name ??
                                                                    "Ukjend";
                                                                const itemNumber = getVariantItemNumber(variant);

                                                                return (
                                                                    <li
                                                                        key={key}
                                                                        className="flex items-center justify-between gap-4 rounded border border-[color:var(--line)] bg-white px-3 py-2 text-[11px] text-neutral-700"
                                                                    >
                                                                        <div className="flex-1">
                                                                            <div className="font-medium">{sizeLabel}</div>
                                                                            {itemNumber && (
                                                                                <div className="mt-0.5 text-[10px] text-neutral-500">
                                                                                    Varenr. {itemNumber}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex flex-col items-end gap-1">
                                                                            <div className="grid grid-cols-3 gap-1">
                                                                                <label className="flex flex-col gap-1 text-[10px] text-neutral-500">
                                                                                    Utsal
                                                                                    <input
                                                                                        type="text"
                                                                                        className="w-[74px] rounded border border-[color:var(--line)] px-2 py-1 text-right text-[11px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                                        value={draftValue}
                                                                                        onChange={(e) => onPriceChange(key, e.target.value)}
                                                                                        aria-invalid={errorMsg ? "true" : "false"}
                                                                                        aria-describedby={errorMsg ? `${key}-error` : undefined}
                                                                                    />
                                                                                </label>
                                                                                <label className="flex flex-col gap-1 text-[10px] text-neutral-500">
                                                                                    Retail
                                                                                    <input
                                                                                        type="text"
                                                                                        className="w-[74px] rounded border border-[color:var(--line)] px-2 py-1 text-right text-[11px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                                        value={draftTradeValue}
                                                                                        onChange={(e) => onPriceChange(tradeKey, e.target.value)}
                                                                                    />
                                                                                </label>
                                                                                <label className="flex flex-col gap-1 text-[10px] text-neutral-500">
                                                                                    Grossist
                                                                                    <input
                                                                                        type="text"
                                                                                        className="w-[74px] rounded border border-[color:var(--line)] px-2 py-1 text-right text-[11px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                                        value={draftDistributorValue}
                                                                                        onChange={(e) => onPriceChange(distributorKey, e.target.value)}
                                                                                    />
                                                                                </label>
                                                                            </div>
                                                                            {errorMsg && (
                                                                                <p
                                                                                    id={`${key}-error`}
                                                                                    className="text-[10px] text-red-600"
                                                                                >
                                                                                    {errorMsg}
                                                                                </p>
                                                                            )}
                                                                            <button
                                                                                type="button"
                                                                                onClick={onPriceSave}
                                                                                disabled={!variantDirty[key] && !variantDirty[tradeKey] && !variantDirty[distributorKey]}
                                                                                className={
                                                                                    "rounded-full border px-3 py-1 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-40 " +
                                                                                    (variantDirty[key] || variantDirty[tradeKey] || variantDirty[distributorKey]
                                                                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                                                        : "border-[color:var(--line)] text-neutral-700 hover:bg-black/5")
                                                                                }
                                                                            >
                                                                                Lagre
                                                                            </button>
                                                                        </div>

                                                                        <label className="flex cursor-pointer items-center gap-1">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={variant?.active !== false}
                                                                                onChange={onActiveChange}
                                                                            />
                                                                            <span className="text-[11px] text-neutral-700 select-none">
                                                                                Aktiv
                                                                            </span>
                                                                        </label>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    )}
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}

const CATEGORY_ITEM_SERIES: Record<string, number> = {
    Sylte: 10000,
    Gelé: 11000,
    Saus: 12000,
    Saft: 13000,
    Rein: 14000,
    Frisk: 15000,
    Iskrem: 16000,
    Øl: 20000,
    Sider: 21000,
};