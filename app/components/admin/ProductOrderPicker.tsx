"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type ProductOrderLine = {
    productId: string;
    productName: string;
    variantId: string;
    variantLabel: string;
    brand: "safteri" | "bryggeri";
    category?: string | null;
    categoryName?: string | null;
    subcategory?: string | null;
    subcategoryName?: string | null;
    quantity: number;
    unitPrice: number;
};

export type ProductVariant = {
    id: string;
    label: string;
    prices?: {
        retail?: number | null;
        trade?: number | null;
        distributor?: number | null;
    };
};

export type AdminProduct = {
    id: string;
    name: string;
    brand: "safteri" | "bryggeri";
    category?: string | null;
    categoryName?: string | null;
    subcategory?: string | null;
    subcategoryName?: string | null;
    variants: ProductVariant[];
    active: boolean;
};

export type ProductOrderPickerMode = "create" | "edit" | "pickup";

export type ProductOrderPickerProps = {
    customerId?: string;
    customerType: string;
    mode: ProductOrderPickerMode;
    lines: ProductOrderLine[];
    onChange: (lines: ProductOrderLine[]) => void;
    title?: string;
    description?: string;
    showProductsBeforeSearch?: boolean;
};

type BrandFilter = "alle" | "safteri" | "bryggeri";

function brandLabel(brand: "safteri" | "bryggeri") {
    return brand === "bryggeri" ? "Bryggeri" : "Safteri";
}

function customerTypeLabel(type: string) {
    return type === "grossist" ? "Grossist" : "Retail";
}

function normalizeCategory(value: string | null | undefined) {
    return (value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function getCategoryLabel(product: AdminProduct) {
    return product.categoryName || product.category || "Anna";
}

function getCategoryWeight(product: AdminProduct) {
    const brandOffset = product.brand === "safteri" ? 0 : 100;
    const category = normalizeCategory(getCategoryLabel(product));

    const weights: Record<string, number> = {
        saft: 10,
        sylte: 20,
        syltetoy: 20,
        syltetøy: 20,
        gele: 30,
        gelé: 30,
        saus: 40,
        frisk: 50,
        rein: 60,
        sirup: 70,
        most: 80,
        sider: 110,
        ol: 120,
        øl: 120,
    };

    return brandOffset + (weights[category] ?? 90);
}

function sortProducts(products: AdminProduct[]) {
    return [...products].sort((a, b) => {
        const weightDiff = getCategoryWeight(a) - getCategoryWeight(b);
        if (weightDiff !== 0) return weightDiff;
        return a.name.localeCompare(b.name, "nb");
    });
}

function getProductGroupLabel(product: AdminProduct) {
    return `${brandLabel(product.brand)} - ${getCategoryLabel(product)}`;
}

function getGroupStyles(label: string) {
    if (label.startsWith("Safteri")) {
        return {
            card: "border-rose-100 bg-rose-50/40",
            text: "text-rose-700",
        };
    }

    return {
        card: "border-amber-100 bg-amber-50/40",
        text: "text-amber-700",
    };
}

const VARIANT_ORDER = [
    "80 ml",
    "195 ml",
    "390 ml",
    "1 kg",
    "2,5 kg",
    "7,5 kg",
    "80 g",
    "250 ml",
    "0,33 l",
    "0,5 l",
    "0,7 l",
    "0,75 l",
    "2,5 l",
    "3 l",
    "5 l",
];

function getVariantSortIndex(label: string) {
    const index = VARIANT_ORDER.findIndex(
        (value) => value.toLowerCase() === label.trim().toLowerCase()
    );

    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function sortVariants(variants: ProductVariant[]) {
    return [...variants].sort((a, b) => {
        const diff = getVariantSortIndex(a.label) - getVariantSortIndex(b.label);
        if (diff !== 0) return diff;
        return a.label.localeCompare(b.label, "nb");
    });
}

function groupProductsByCategory(products: AdminProduct[]) {
    const groups: { label: string; products: AdminProduct[] }[] = [];

    for (const product of sortProducts(products)) {
        const label = getProductGroupLabel(product);
        const existingGroup = groups.find((group) => group.label === label);

        if (existingGroup) {
            existingGroup.products.push(product);
        } else {
            groups.push({ label, products: [product] });
        }
    }

    return groups;
}

export default function ProductOrderPicker({
    customerId,
    customerType,
    mode,
    lines,
    onChange,
    title = "Produkt",
    description,
    showProductsBeforeSearch = true,
}: ProductOrderPickerProps) {
    const [products, setProducts] = useState<AdminProduct[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [queryText, setQueryText] = useState("");
    const [brandFilter, setBrandFilter] = useState<BrandFilter>("alle");
    const [preferredProductIds, setPreferredProductIds] = useState<string[]>([]);

    useEffect(() => {
        async function loadProducts() {
            try {
                setLoadingProducts(true);
                setError(null);
                const snapshot = await getDocs(collection(db, "products"));

                setProducts(
                    snapshot.docs
                        .map((doc) => mapProduct(doc.id, doc.data()))
                        .filter((product) => product.active)
                );
            } catch (error) {
                console.error("Failed to load products", error);
                setError("Kunne ikkje hente produkt.");
            } finally {
                setLoadingProducts(false);
            }
        }

        void loadProducts();
    }, []);

    useEffect(() => {
        setQueryText("");
        setPreferredProductIds([]);

        // Load previously ordered products for the customer
        if (!customerId) return;
        async function loadPreferredProducts() {
            try {
                const q = query(collection(db, "pickups"), where("customerId", "==", customerId));
                const snapshot = await getDocs(q);
                const productIds = new Set<string>();
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    if (Array.isArray(data?.lines)) {
                        data.lines.forEach((line: any) => {
                            if (typeof line?.productId === "string") {
                                productIds.add(line.productId);
                            }
                        });
                    }
                });
                setPreferredProductIds(Array.from(productIds));
            } catch (error) {
                console.error("Failed to load preferred products", error);
                setPreferredProductIds([]);
            }
        }
        void loadPreferredProducts();
    }, [customerId]);

    const filteredProducts = useMemo(() => {
        const q = queryText.trim().toLowerCase();

        if (!q && !showProductsBeforeSearch && preferredProductIds.length > 0) {
            const preferredIds = new Set(preferredProductIds);

            return products.filter((product) => {
                if (brandFilter !== "alle" && product.brand !== brandFilter) return false;
                return preferredIds.has(product.id);
            });
        }

        return products.filter((product) => {
            if (!q && !showProductsBeforeSearch) return false;
            if (brandFilter !== "alle" && product.brand !== brandFilter) return false;

            const searchableText = [
                product.name,
                product.categoryName,
                product.category,
                product.subcategoryName,
                product.subcategory,
                product.brand,
                ...product.variants.map((variant) => variant.label),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchableText.includes(q);
        });
    }, [products, queryText, brandFilter, showProductsBeforeSearch, preferredProductIds]);

    const groupedProducts = useMemo(
        () => groupProductsByCategory(filteredProducts),
        [filteredProducts]
    );

    function getLineQuantity(productId: string, variantId: string) {
        return (
            lines.find(
                (line) => line.productId === productId && line.variantId === variantId
            )?.quantity || 0
        );
    }

    function setLineQuantity(
        product: AdminProduct,
        variant: ProductVariant,
        value: string | number
    ) {
        const quantity = Math.max(0, Math.floor(Number(value) || 0));
        const unitPrice = getVariantPrice(variant, customerType);

        const nextLines = lines.filter(
            (line) => !(line.productId === product.id && line.variantId === variant.id)
        );

        if (quantity > 0 && unitPrice > 0) {
            nextLines.push({
                productId: product.id,
                productName: product.name,
                variantId: variant.id,
                variantLabel: variant.label,
                brand: product.brand,
                category: product.category,
                categoryName: product.categoryName,
                subcategory: product.subcategory,
                subcategoryName: product.subcategoryName,
                quantity,
                unitPrice,
            });
        }

        onChange(nextLines);
    }

    function adjustLineQuantity(
        product: AdminProduct,
        variant: ProductVariant,
        delta: number
    ) {
        const currentQuantity = getLineQuantity(product.id, variant.id);
        setLineQuantity(product, variant, currentQuantity + delta);
    }

    return (
        <section className="rounded-[24px] border border-neutral-200 bg-white p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-lg font-medium">{title}</h2>
                    <p className="mt-1 text-sm text-neutral-500">
                        {description || `Produktliste med prisgruppe: ${customerTypeLabel(customerType)}.`}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {(["alle", "safteri", "bryggeri"] as BrandFilter[]).map((brand) => (
                        <button
                            key={brand}
                            type="button"
                            onClick={() => setBrandFilter(brand)}
                            className={`rounded-full border px-3 py-1.5 text-sm transition ${brandFilter === brand
                                ? "border-neutral-900 bg-neutral-900 text-white"
                                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                                }`}
                        >
                            {brand === "alle" ? "Alle" : brandLabel(brand)}
                        </button>
                    ))}
                </div>
            </div>

            <label className="mt-5 block">
                <span className="sr-only">Søk produkt</span>
                <input
                    type="search"
                    value={queryText}
                    onChange={(event) => setQueryText(event.target.value)}
                    placeholder="Søk produkt, kategori eller variant"
                    className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-500"
                />
            </label>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <span>{mode === "pickup" ? "Henting" : mode === "edit" ? "Redigering" : "Ny ordre"}</span>
                <span>·</span>
                <span>{lines.length} ordrelinjer</span>
                <span>·</span>
                <span>{filteredProducts.length} produkt</span>
                <span>·</span>
                <span>{groupedProducts.length} grupper</span>
                <span>·</span>
                <span>{lines.reduce((sum, line) => sum + line.quantity, 0)} stk</span>
            </div>

            {error ? (
                <div className="mt-6 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {error}
                </div>
            ) : null}

            {loadingProducts ? (
                <div className="mt-6 rounded-[18px] border border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
                    Lastar produkt …
                </div>
            ) : groupedProducts.length ? (
                <div className="mt-6 space-y-8">
                    {groupedProducts.map((group) => {
                        const styles = getGroupStyles(group.label);

                        return (
                            <section key={group.label}>
                                <div className={`rounded-[14px] border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${styles.card} ${styles.text}`}>
                                    {group.label}
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                    {group.products.map((product) => (
                                        <article
                                            key={product.id}
                                            className="rounded-[20px] border border-neutral-200 bg-neutral-50 p-4"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <h3 className="font-medium text-neutral-950">{product.name}</h3>
                                                    <p className="mt-1 text-sm text-neutral-500">
                                                        {brandLabel(product.brand)}
                                                        {product.categoryName || product.category ? ` · ${product.categoryName || product.category}` : ""}
                                                    </p>
                                                </div>
                                                <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600">
                                                    {product.variants.length} variant{product.variants.length === 1 ? "" : "ar"}
                                                </span>
                                            </div>

                                            <div className="mt-4 space-y-2">
                                                {sortVariants(product.variants).map((variant) => (
                                                    <div
                                                        key={variant.id}
                                                        className="flex items-center justify-between gap-3 rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm"
                                                    >
                                                        <div>
                                                            <div className="font-medium text-neutral-900">{variant.label}</div>
                                                            <div className="text-xs text-neutral-500">
                                                                {getVariantPrice(variant, customerType) > 0
                                                                    ? `${getVariantPrice(variant, customerType)} eks. mva.`
                                                                    : "Pris manglar"}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => adjustLineQuantity(product, variant, -1)}
                                                                disabled={!getLineQuantity(product.id, variant.id)}
                                                                className="h-8 w-8 rounded-full border border-neutral-300 bg-white text-sm disabled:opacity-40"
                                                            >
                                                                −
                                                            </button>

                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={getLineQuantity(product.id, variant.id) || ""}
                                                                onChange={(event) =>
                                                                    setLineQuantity(product, variant, event.target.value)
                                                                }
                                                                className="w-16 rounded-[10px] border border-neutral-200 px-2 py-1 text-center text-sm outline-none [appearance:textfield] focus:border-neutral-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                            />

                                                            <button
                                                                type="button"
                                                                onClick={() => adjustLineQuantity(product, variant, 1)}
                                                                className="h-8 w-8 rounded-full border border-neutral-300 bg-white text-sm"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            ) : (
                <div className="mt-6 rounded-[18px] border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
                    {queryText.trim()
                        ? "Ingen produkt passar søket."
                        : showProductsBeforeSearch
                            ? "Ingen produkt funne."
                            : customerId
                                ? "Kunden har ingen tidlegare varer. Søk etter produkt for å legge til varer."
                                : "Vel kunde for å sjå tidlegare varer eller søk etter produkt."
                    }
                </div>
            )}
        </section>
    );
}

function getVariantPrice(variant: ProductVariant, customerType: string) {
    const storePrice = variant.prices?.retail ?? 0;
    const retailPrice = variant.prices?.trade ?? storePrice;
    const wholesalePrice = variant.prices?.distributor ?? retailPrice;

    if (customerType === "grossist") {
        return wholesalePrice;
    }

    return retailPrice;
}

function mapProduct(id: string, data: any): AdminProduct {
    return {
        id,
        name: typeof data.name === "string" ? data.name : "Utan namn",
        brand: data.brand === "bryggeri" ? "bryggeri" : "safteri",
        category: typeof data.category === "string" ? data.category : null,
        categoryName: typeof data.categoryName === "string" ? data.categoryName : null,
        subcategory: typeof data.subcategory === "string" ? data.subcategory : null,
        subcategoryName: typeof data.subcategoryName === "string" ? data.subcategoryName : null,
        active: data.active !== false,
        variants: Array.isArray(data.variants)
            ? data.variants.map((variant: any, index: number) => ({
                id: typeof variant.id === "string" ? variant.id : `variant-${index}`,
                label:
                    typeof variant.label === "string"
                        ? variant.label
                        : typeof variant.name === "string"
                            ? variant.name
                            : "Variant",
                prices: {
                    retail:
                        typeof variant?.prices?.retail === "number" ? variant.prices.retail : null,
                    trade:
                        typeof variant?.prices?.trade === "number" ? variant.prices.trade : null,
                    distributor:
                        typeof variant?.prices?.distributor === "number" ? variant.prices.distributor : null,
                },
            }))
            : [],
    };
}