

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Brand = "all" | "safteri" | "bryggeri";
type PriceGroup = "retail" | "trade" | "distributor";

type ProductVariant = {
    id: string;
    label: string;
    itemNumber?: string;
    sku?: string;
    price?: number;
    prices?: {
        retail?: number;
        trade?: number;
        distributor?: number;
    };
    priceUpdatedAt?: {
        retail?: unknown;
        trade?: unknown;
        distributor?: unknown;
    };
    active?: boolean;
};

type ProductDoc = {
    id: string;
    name?: string;
    brand?: "safteri" | "bryggeri";
    category?: string;
    active?: boolean;
    variants?: ProductVariant[];
};

type PriceRow = {
    productId: string;
    productName: string;
    brand: "safteri" | "bryggeri";
    category: string;
    variantId: string;
    variantLabel: string;
    itemNumber: string;
    active: boolean;
    variant: ProductVariant;
    original: Record<PriceGroup, number | "">;
    draft: Record<PriceGroup, string>;
    updatedAt?: ProductVariant["priceUpdatedAt"];
};

const PRICE_GROUPS: Array<{ key: PriceGroup; label: string }> = [
    { key: "retail", label: "Utsal" },
    { key: "trade", label: "Retail" },
    { key: "distributor", label: "Grossist" },
];

const SAFT_CATEGORIES = ["Saft", "Sylte", "Gelé", "Frisk", "Rein"];
const BRYGGERI_CATEGORIES = ["Øl", "Sider"];

function asNumber(value: unknown): number | "" {
    return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function formatNumber(value: number | "") {
    if (value === "") return "";
    return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

function parsePrice(value: string): number | null {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function roundPrice(value: number, group: PriceGroup) {
    if (group === "retail") return Math.round(value);
    return Math.round(value * 100) / 100;
}

function getCellKey(row: PriceRow, group: PriceGroup) {
    return `${row.productId}:${row.variantId}:${group}`;
}

function isRecentlyUpdated(value: unknown) {
    if (!value || typeof value !== "object") return false;

    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate !== "function") return false;

    const date = maybeTimestamp.toDate();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return Date.now() - date.getTime() <= thirtyDays;
}

export default function AdminPricesPage() {
    const [rows, setRows] = useState<PriceRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedMessage, setSavedMessage] = useState<string | null>(null);

    const [brandFilter, setBrandFilter] = useState<Brand>("all");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [increasePercent, setIncreasePercent] = useState("4");
    const [selectedGroups, setSelectedGroups] = useState<Record<PriceGroup, boolean>>({
        retail: true,
        trade: true,
        distributor: true,
    });

    const [dirtyCells, setDirtyCells] = useState<Record<string, boolean>>({});
    const [savedCells, setSavedCells] = useState<Record<string, boolean>>({});

    useEffect(() => {
        async function loadProducts() {
            setLoading(true);
            setError(null);

            try {
                const snap = await getDocs(collection(db, "products"));
                const nextRows: PriceRow[] = [];

                snap.forEach((document) => {
                    const data = document.data() as Omit<ProductDoc, "id">;
                    const brand = data.brand === "bryggeri" ? "bryggeri" : "safteri";
                    const variants = Array.isArray(data.variants) ? data.variants : [];

                    for (const variant of variants) {
                        if (!variant || typeof variant.id !== "string") continue;

                        const retail = asNumber(variant.prices?.retail ?? variant.price);
                        const trade = asNumber(variant.prices?.trade);
                        const distributor = asNumber(variant.prices?.distributor);

                        nextRows.push({
                            productId: document.id,
                            productName: data.name || "Utan namn",
                            brand,
                            category: data.category || "Utan kategori",
                            variantId: variant.id,
                            variantLabel: variant.label || "Variant",
                            itemNumber: variant.itemNumber || variant.sku || "",
                            active: typeof variant.active === "boolean" ? variant.active : true,
                            variant,
                            original: { retail, trade, distributor },
                            draft: {
                                retail: formatNumber(retail),
                                trade: formatNumber(trade),
                                distributor: formatNumber(distributor),
                            },
                            updatedAt: variant.priceUpdatedAt,
                        });
                    }
                });

                nextRows.sort((a, b) => {
                    const brandCompare = a.brand.localeCompare(b.brand, "nb");
                    if (brandCompare !== 0) return brandCompare;

                    const categoryCompare = a.category.localeCompare(b.category, "nb");
                    if (categoryCompare !== 0) return categoryCompare;

                    const productCompare = a.productName.localeCompare(b.productName, "nb");
                    if (productCompare !== 0) return productCompare;

                    return a.variantLabel.localeCompare(b.variantLabel, "nb");
                });

                setRows(nextRows);
                setDirtyCells({});
            } catch (err) {
                console.error(err);
                setError("Kunne ikkje hente produktprisane.");
            } finally {
                setLoading(false);
            }
        }

        loadProducts();
    }, []);

    const categories = useMemo(() => {
        if (brandFilter === "safteri") return SAFT_CATEGORIES;
        if (brandFilter === "bryggeri") return BRYGGERI_CATEGORIES;

        return Array.from(new Set(rows.map((row) => row.category))).sort((a, b) => a.localeCompare(b, "nb"));
    }, [brandFilter, rows]);

    const filteredRows = useMemo(() => {
        return rows.filter((row) => {
            if (brandFilter !== "all" && row.brand !== brandFilter) return false;
            if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
            return true;
        });
    }, [rows, brandFilter, categoryFilter]);

    const hasDirtyCells = Object.values(dirtyCells).some(Boolean);

    function updateDraft(row: PriceRow, group: PriceGroup, value: string) {
        const key = getCellKey(row, group);

        setRows((prev) =>
            prev.map((item) =>
                item.productId === row.productId && item.variantId === row.variantId
                    ? {
                        ...item,
                        draft: {
                            ...item.draft,
                            [group]: value,
                        },
                    }
                    : item
            )
        );

        setDirtyCells((prev) => ({ ...prev, [key]: true }));
        setSavedMessage(null);
    }

    function suggestPrices() {
        const percent = Number(increasePercent.trim().replace(",", "."));
        if (!Number.isFinite(percent)) {
            setError("Prisauke må vere eit tal.");
            return;
        }

        setError(null);
        const multiplier = 1 + percent / 100;
        const nextDirty: Record<string, boolean> = {};

        setRows((prev) =>
            prev.map((row) => {
                const included = filteredRows.some(
                    (filtered) => filtered.productId === row.productId && filtered.variantId === row.variantId
                );

                if (!included) return row;

                const nextDraft = { ...row.draft };

                for (const group of PRICE_GROUPS) {
                    if (!selectedGroups[group.key]) continue;

                    const current = parsePrice(row.draft[group.key]) ?? row.original[group.key];
                    if (current === "" || current === null) continue;

                    const nextValue = roundPrice(current * multiplier, group.key);
                    nextDraft[group.key] = formatNumber(nextValue);
                    nextDirty[getCellKey(row, group.key)] = true;
                }

                return { ...row, draft: nextDraft };
            })
        );

        setDirtyCells((prev) => ({ ...prev, ...nextDirty }));
    }

    function resetChanges() {
        setRows((prev) =>
            prev.map((row) => ({
                ...row,
                draft: {
                    retail: formatNumber(row.original.retail),
                    trade: formatNumber(row.original.trade),
                    distributor: formatNumber(row.original.distributor),
                },
            }))
        );
        setDirtyCells({});
        setSavedMessage(null);
        setError(null);
    }

    async function saveAllChanges() {
        setSaving(true);
        setError(null);
        setSavedMessage(null);

        try {
            const changedRows = rows.filter((row) =>
                PRICE_GROUPS.some((group) => dirtyCells[getCellKey(row, group.key)])
            );

            for (const row of changedRows) {
                const productRef = doc(db, "products", row.productId);
                const existingRowsForProduct = rows.filter((item) => item.productId === row.productId);

                const variants = existingRowsForProduct.map((item) => {
                    const retail = parsePrice(item.draft.retail);
                    const trade = item.draft.trade.trim() ? parsePrice(item.draft.trade) : null;
                    const distributor = item.draft.distributor.trim() ? parsePrice(item.draft.distributor) : null;

                    const prices: ProductVariant["prices"] = {};
                    if (retail !== null) prices.retail = retail;
                    if (trade !== null) prices.trade = trade;
                    if (distributor !== null) prices.distributor = distributor;

                    const priceUpdatedAt: ProductVariant["priceUpdatedAt"] = {};
                    for (const group of PRICE_GROUPS) {
                        const key = getCellKey(item, group.key);
                        if (dirtyCells[key]) {
                            priceUpdatedAt[group.key] = Timestamp.now();
                        } else if (item.updatedAt?.[group.key]) {
                            priceUpdatedAt[group.key] = item.updatedAt[group.key];
                        }
                    }

                    return {
                        ...item.variant,
                        id: item.variantId,
                        label: item.variantLabel,
                        itemNumber: item.itemNumber,
                        sku: item.itemNumber,
                        price: retail ?? 0,
                        prices,
                        priceUpdatedAt,
                        active: item.active,
                    };
                });

                await updateDoc(productRef, { variants });
            }

            const nextSavedCells: Record<string, boolean> = {};
            for (const [key, value] of Object.entries(dirtyCells)) {
                if (value) nextSavedCells[key] = true;
            }

            setRows((prev) =>
                prev.map((row) => {
                    const nextOriginal: Record<PriceGroup, number | ""> = {
                        retail: parsePrice(row.draft.retail) ?? "",
                        trade: row.draft.trade.trim() ? parsePrice(row.draft.trade) ?? "" : "",
                        distributor: row.draft.distributor.trim() ? parsePrice(row.draft.distributor) ?? "" : "",
                    };

                    const nextPrices: ProductVariant["prices"] = {};
                    if (typeof nextOriginal.retail === "number") nextPrices.retail = nextOriginal.retail;
                    if (typeof nextOriginal.trade === "number") nextPrices.trade = nextOriginal.trade;
                    if (typeof nextOriginal.distributor === "number") nextPrices.distributor = nextOriginal.distributor;

                    return {
                        ...row,
                        original: nextOriginal,
                        variant: {
                            ...row.variant,
                            price: typeof nextOriginal.retail === "number" ? nextOriginal.retail : row.variant.price,
                            prices: nextPrices,
                        },
                    };
                })
            );
            setSavedCells((prev) => ({ ...prev, ...nextSavedCells }));
            setDirtyCells({});
            setSavedMessage("Prisendringar lagra.");
        } catch (err) {
            console.error(err);
            setError("Kunne ikkje lagre prisendringane.");
        } finally {
            setSaving(false);
        }
    }

    function cellClass(row: PriceRow, group: PriceGroup) {
        const key = getCellKey(row, group);
        const recentlyUpdated = isRecentlyUpdated(row.updatedAt?.[group]) || savedCells[key];

        if (dirtyCells[key]) return "border-amber-300 bg-amber-50";
        if (recentlyUpdated) return "border-emerald-200 bg-emerald-50";
        return "border-[color:var(--line)] bg-white";
    }

    return (
        <main className="min-h-screen bg-[color:var(--paper)] text-neutral-900">
            <section className="mx-auto max-w-7xl px-4 py-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <Link href="/admin/products" className="text-xs text-neutral-600 hover:text-neutral-900">
                            ← Tilbake til produkt
                        </Link>
                        <h1
                            className="mt-3 text-3xl tracking-tight md:text-4xl"
                            style={{ fontFamily: "var(--font-serif)" }}
                        >
                            Prisjustering
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-7 text-neutral-600">
                            Foreslå prosentvis prisjustering, gå gjennom endringane og lagre alt samla.
                        </p>
                    </div>
                </div>

                <div className="mt-8 rounded-[24px] border border-[color:var(--line)] bg-white/60 p-5">
                    <div className="grid gap-4 md:grid-cols-5">
                        <label className="space-y-1 text-xs font-medium text-neutral-700">
                            Område
                            <select
                                value={brandFilter}
                                onChange={(event) => {
                                    setBrandFilter(event.target.value as Brand);
                                    setCategoryFilter("all");
                                }}
                                className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-neutral-800"
                            >
                                <option value="all">Alle produkt</option>
                                <option value="safteri">Safteri</option>
                                <option value="bryggeri">Bryggeri</option>
                            </select>
                        </label>

                        <label className="space-y-1 text-xs font-medium text-neutral-700">
                            Kategori
                            <select
                                value={categoryFilter}
                                onChange={(event) => setCategoryFilter(event.target.value)}
                                className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-neutral-800"
                            >
                                <option value="all">Alle kategoriar</option>
                                {categories.map((category) => (
                                    <option key={category} value={category}>
                                        {category}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="space-y-1 text-xs font-medium text-neutral-700">
                            Prisauke
                            <div className="flex rounded-[12px] border border-[color:var(--line)] bg-white focus-within:border-neutral-800">
                                <input
                                    value={increasePercent}
                                    onChange={(event) => setIncreasePercent(event.target.value)}
                                    inputMode="decimal"
                                    className="w-full rounded-l-[12px] bg-transparent px-3 py-2 text-sm outline-none"
                                />
                                <span className="px-3 py-2 text-sm text-neutral-500">%</span>
                            </div>
                        </label>

                        <div className="space-y-2 text-xs font-medium text-neutral-700 md:col-span-2">
                            Prisgrupper
                            <div className="flex flex-wrap gap-2">
                                {PRICE_GROUPS.map((group) => (
                                    <label
                                        key={group.key}
                                        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[color:var(--line)] bg-white px-3 py-2 text-xs text-neutral-700"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedGroups[group.key]}
                                            onChange={(event) =>
                                                setSelectedGroups((prev) => ({
                                                    ...prev,
                                                    [group.key]: event.target.checked,
                                                }))
                                            }
                                        />
                                        {group.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={suggestPrices}
                            className="rounded-full bg-neutral-900 px-5 py-2 text-sm text-[color:var(--paper)] transition hover:bg-neutral-800"
                        >
                            Foreslå prisar
                        </button>
                        <button
                            type="button"
                            onClick={resetChanges}
                            disabled={!hasDirtyCells}
                            className="rounded-full border border-[color:var(--line)] bg-white px-5 py-2 text-sm text-neutral-800 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Tilbakestill
                        </button>
                        <button
                            type="button"
                            onClick={saveAllChanges}
                            disabled={!hasDirtyCells || saving}
                            className={
                                "rounded-full px-5 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 " +
                                (hasDirtyCells
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                    : "bg-neutral-200 text-neutral-500")
                            }
                        >
                            {saving ? "Lagrar …" : "Lagre alle endringar"}
                        </button>
                        {error ? <p className="text-sm text-red-700">{error}</p> : null}
                        {savedMessage ? <p className="text-sm text-emerald-700">{savedMessage}</p> : null}
                    </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-[24px] border border-[color:var(--line)] bg-white/70">
                    <div className="grid grid-cols-[1.5fr_0.9fr_0.9fr_0.7fr_0.7fr_0.7fr] gap-3 border-b border-[color:var(--line)] bg-neutral-50 px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
                        <div>Produkt</div>
                        <div>Variant</div>
                        <div>Varenr.</div>
                        <div className="text-right">Utsal</div>
                        <div className="text-right">Retail</div>
                        <div className="text-right">Grossist</div>
                    </div>

                    {loading ? (
                        <div className="px-4 py-10 text-sm text-neutral-600">Laster prisar …</div>
                    ) : filteredRows.length === 0 ? (
                        <div className="px-4 py-10 text-sm text-neutral-600">Ingen produkt funne.</div>
                    ) : (
                        <div className="divide-y divide-[color:var(--line)]">
                            {filteredRows.map((row) => (
                                <div
                                    key={`${row.productId}:${row.variantId}`}
                                    className="grid grid-cols-[1.5fr_0.9fr_0.9fr_0.7fr_0.7fr_0.7fr] gap-3 px-4 py-3 text-sm"
                                >
                                    <div>
                                        <div className="font-medium text-neutral-900">{row.productName}</div>
                                        <div className="mt-1 text-xs text-neutral-500">
                                            {row.brand === "bryggeri" ? "Bryggeri" : "Safteri"} · {row.category}
                                        </div>
                                    </div>
                                    <div className="text-neutral-700">{row.variantLabel}</div>
                                    <div className="text-xs text-neutral-500">{row.itemNumber}</div>

                                    {PRICE_GROUPS.map((group) => (
                                        <div key={group.key} className="space-y-1">
                                            <input
                                                value={row.draft[group.key]}
                                                onChange={(event) => updateDraft(row, group.key, event.target.value)}
                                                inputMode="decimal"
                                                className={
                                                    "w-full rounded-[10px] border px-2 py-1 text-right text-sm outline-none focus:border-neutral-800 " +
                                                    cellClass(row, group.key)
                                                }
                                            />
                                            {dirtyCells[getCellKey(row, group.key)] ? (
                                                <div className="text-right text-[10px] text-amber-700">Ikkje lagra</div>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}