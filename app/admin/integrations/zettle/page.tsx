"use client";

import { useEffect, useMemo, useState } from "react";

// Types for comparison response
type DifferenceType =
    | "missing_in_zettle"
    | "missing_in_valldal"
    | "inactive_in_valldal"
    | "price_mismatch"
    | "barcode_mismatch";

type ValldalVariant = {
    productId: string;
    productName: string;
    variantId: string;
    variantName: string;
    sku: string;
    barcode?: string;
    retailPrice: number;
    productActive: boolean;
    variantActive: boolean;
};

type ZettleVariant = {
    id: string;
    sku: string;
    name: string;
    barcode?: string;
    retailPrice: number;
    currency?: string;
    productId: string;
    productName: string;
};

type Difference = {
    sku: string;
    type: DifferenceType;
    message: string;
    valldal?: ValldalVariant;
    zettle?: ZettleVariant;
};

type Comparison = {
    matchedCount: number;
    missingInZettleCount: number;
    missingInValldalCount: number;
    inactiveInValldalCount: number;
    priceMismatchCount: number;
    barcodeMismatchCount: number;
    differences: Difference[];
};

type PricePreviewUpdate = {
    sku: string;
    valldalProductId?: string;
    valldalVariantId?: string;
    zettleProductId?: string;
    zettleVariantId?: string;
    productName?: string;
    variantName?: string;
    from?: number;
    to?: number;
};

type PricePreview = {
    dryRun: boolean;
    selectedSkus: string[];
    updateCount: number;
    updates: PricePreviewUpdate[];
};

type PriceUpdateResult = {
    requestedCount: number;
    updatedCount: number;
    failedCount: number;
    results: Array<{
        sku: string;
        success: boolean;
        from?: number;
        to?: number;
        error?: string;
    }>;
};

type VariantPlacementPreview = {
    valid: boolean;
    warnings: string[];
    errors: string[];
    valldalProduct: { id: string; name: string; category: string };
    zettleProduct?: { id: string; name: string; category?: string };
    matchedBySkus: string[];
    existingVariants: Array<{
        sku: string;
        name: string;
        barcode?: string;
        retailPrice: number;
    }>;
    variantToAdd: {
        sku: string;
        name: string;
        barcode?: string;
        retailPrice?: number;
    };
};

type VariantUpdateResult = {
    success: true;
    sku: string;
    productId: string;
    productName: string;
    variantName: string;
};

const formatCurrency = (value?: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "–";

    return new Intl.NumberFormat("nb-NO", {
        style: "currency",
        currency: "NOK",
        maximumFractionDigits: 0,
    }).format(value);
};

type DifferenceTableProps = {
    title: string;
    differences: Difference[];
    selectedSkus: Set<string>;
    onToggleSku: (sku: string) => void;
    selectable?: boolean;
    actionLabel?: string;
    onAction?: (sku: string) => void;
    actionLoadingSku?: string | null;
};

function DifferenceTable({
    title,
    differences,
    selectedSkus,
    onToggleSku,
    selectable = true,
    actionLabel,
    onAction,
    actionLoadingSku,
}: DifferenceTableProps) {
    if (!differences.length) return null;
    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-8">
            <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold">{title}</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50">
                            {selectable && <th className="px-4 py-2 text-left font-medium text-gray-700">Vel</th>}
                            <th className="px-4 py-2 text-left font-medium text-gray-700">SKU</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700">Valldal produkt</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700">Valldal variant</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700">Valldal pris</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700">Valldal strekkode</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700">Zettle produkt</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700">Zettle variant</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700">Zettle pris</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700">Zettle strekkode</th>
                            {actionLabel && <th className="px-4 py-2 text-right font-medium text-gray-700">Handling</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {differences.map((diff) => (
                            <tr key={diff.sku} className="border-t border-gray-100">
                                {selectable && <td className="px-4 py-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedSkus.has(diff.sku)}
                                        onChange={() => onToggleSku(diff.sku)}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </td>}
                                <td className="px-4 py-2 font-mono">{diff.sku}</td>
                                <td className="px-4 py-2">{diff.valldal?.productName ?? <span className="text-gray-400">–</span>}</td>
                                <td className="px-4 py-2">{diff.valldal?.variantName ?? <span className="text-gray-400">–</span>}</td>
                                <td className="px-4 py-2">
                                    {diff.valldal?.retailPrice != null ? formatCurrency(diff.valldal?.retailPrice) : <span className="text-gray-400">–</span>}
                                </td>
                                <td className="px-4 py-2">{diff.valldal?.barcode ?? <span className="text-gray-400">–</span>}</td>
                                <td className="px-4 py-2">{diff.zettle?.productName ?? <span className="text-gray-400">–</span>}</td>
                                <td className="px-4 py-2">{diff.zettle?.name ?? <span className="text-gray-400">–</span>}</td>
                                <td className="px-4 py-2">
                                    {diff.zettle?.retailPrice != null ? formatCurrency(diff.zettle?.retailPrice) : <span className="text-gray-400">–</span>}
                                </td>
                                <td className="px-4 py-2">{diff.zettle?.barcode ?? <span className="text-gray-400">–</span>}</td>
                                {actionLabel && onAction && (
                                    <td className="px-4 py-2 text-right">
                                        <button
                                            type="button"
                                            onClick={() => onAction(diff.sku)}
                                            disabled={actionLoadingSku === diff.sku}
                                            className="whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {actionLoadingSku === diff.sku ? "Sjekkar…" : actionLabel}
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function ZettleIntegrationPage() {
    const [comparison, setComparison] = useState<Comparison | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
    const [pricePreview, setPricePreview] = useState<PricePreview | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [updateLoading, setUpdateLoading] = useState(false);
    const [updateResult, setUpdateResult] = useState<PriceUpdateResult | null>(null);
    const [variantPreview, setVariantPreview] = useState<VariantPlacementPreview | null>(null);
    const [variantPreviewSku, setVariantPreviewSku] = useState<string | null>(null);
    const [variantUpdateLoading, setVariantUpdateLoading] = useState(false);
    const [variantUpdateResult, setVariantUpdateResult] = useState<VariantUpdateResult | null>(null);

    const loadComparison = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/integrations/zettle/products", {
                cache: "no-store",
            });
            if (!res.ok) throw new Error("Kunne ikkje hente samanlikning");
            const data: Comparison = await res.json();
            setComparison(data);
            setSelectedSkus(new Set());
            setPricePreview(null);
            setPreviewError(null);
            setUpdateResult(null);
            setVariantPreview(null);
            setVariantUpdateResult(null);
        } catch (err: any) {
            setError(err.message || "Ukjend feil");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadComparison();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { price, barcode, missingInZettle, missingInValldal, inactiveInValldal } = useMemo(() => {
        const price: Difference[] = [];
        const barcode: Difference[] = [];
        const missingInZettle: Difference[] = [];
        const missingInValldal: Difference[] = [];
        const inactiveInValldal: Difference[] = [];
        if (comparison) {
            for (const diff of comparison.differences) {
                if (diff.type === "price_mismatch") price.push(diff);
                else if (diff.type === "barcode_mismatch") barcode.push(diff);
                else if (diff.type === "missing_in_zettle") missingInZettle.push(diff);
                else if (diff.type === "missing_in_valldal") missingInValldal.push(diff);
                else if (diff.type === "inactive_in_valldal") inactiveInValldal.push(diff);
            }
        }
        return { price, barcode, missingInZettle, missingInValldal, inactiveInValldal };
    }, [comparison]);

    const allPriceSkus = price.map((diff) => diff.sku);

    function toggleSku(sku: string) {
        setSelectedSkus((current) => {
            const next = new Set(current);
            if (next.has(sku)) {
                next.delete(sku);
            } else {
                next.add(sku);
            }
            setPricePreview(null);
            setPreviewError(null);
            setUpdateResult(null);
            return next;
        });
    }

    function selectSkus(skus: string[]) {
        setSelectedSkus((current) => {
            const next = new Set(current);
            for (const sku of skus) {
                next.add(sku);
            }
            setPricePreview(null);
            setPreviewError(null);
            setUpdateResult(null);
            return next;
        });
    }

    function clearSelection() {
        setSelectedSkus(new Set());
        setPricePreview(null);
        setPreviewError(null);
        setUpdateResult(null);
    }

    async function loadPricePreview() {
        if (selectedSkus.size === 0) return;

        setPreviewLoading(true);
        setPreviewError(null);
        setPricePreview(null);

        try {
            const params = new URLSearchParams();
            params.set("sku", Array.from(selectedSkus).join(","));

            const res = await fetch(`/api/admin/integrations/zettle/prices?${params.toString()}`, {
                cache: "no-store",
            });

            if (!res.ok) {
                const message = await res.text();
                throw new Error(message || "Kunne ikkje førehandssjekke prisoppdatering.");
            }

            const data = (await res.json()) as PricePreview;
            setPricePreview(data);
            setUpdateResult(null);
        } catch (err) {
            console.error(err);
            setPreviewError(err instanceof Error ? err.message : "Ukjend feil");
        } finally {
            setPreviewLoading(false);
        }
    }

    async function updateSelectedPrices() {
        const skus = pricePreview?.updates.map((update) => update.sku) ?? [];
        if (skus.length === 0) return;

        const confirmed = window.confirm(
            `Vil du oppdatere ${skus.length} pris${skus.length === 1 ? "" : "ar"} i Zettle?`
        );
        if (!confirmed) return;

        setUpdateLoading(true);
        setPreviewError(null);
        setUpdateResult(null);

        try {
            const res = await fetch("/api/admin/integrations/zettle/prices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ skus }),
            });
            const data = (await res.json()) as PriceUpdateResult | { error?: string };

            if (!res.ok && !("results" in data)) {
                throw new Error(data.error || "Kunne ikkje oppdatere prisane.");
            }

            if (!("results" in data)) {
                throw new Error("Zettle returnerte eit uventa svar.");
            }

            setUpdateResult(data);

            if (data.updatedCount > 0) {
                await loadComparison();
                setUpdateResult(data);
            }
        } catch (err) {
            console.error(err);
            setPreviewError(err instanceof Error ? err.message : "Ukjend feil");
        } finally {
            setUpdateLoading(false);
        }
    }

    async function loadVariantPreview(sku: string) {
        setVariantPreviewSku(sku);
        setVariantPreview(null);
        setPreviewError(null);

        try {
            const params = new URLSearchParams({ sku });
            const res = await fetch(
                `/api/admin/integrations/zettle/variants/preview?${params.toString()}`,
                { cache: "no-store" }
            );
            const data = (await res.json()) as VariantPlacementPreview | { error?: string };

            if (!res.ok || !("variantToAdd" in data)) {
                const message = "error" in data ? data.error : undefined;
                throw new Error(message || "Kunne ikkje førehandssjekke varianten.");
            }

            setVariantPreview(data);
            setVariantUpdateResult(null);
        } catch (err) {
            setPreviewError(err instanceof Error ? err.message : "Ukjend feil");
        } finally {
            setVariantPreviewSku(null);
        }
    }

    async function addPreviewedVariant() {
        if (!variantPreview?.valid) return;

        const { sku, name } = variantPreview.variantToAdd;
        const targetProduct = variantPreview.zettleProduct?.name ?? "Zettle-produktet";
        const confirmed = window.confirm(
            `Vil du leggje varianten ${name} (SKU ${sku}) til ${targetProduct}?`
        );
        if (!confirmed) return;

        setVariantUpdateLoading(true);
        setPreviewError(null);
        setVariantUpdateResult(null);

        try {
            const res = await fetch("/api/admin/integrations/zettle/variants/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sku }),
            });
            const data = (await res.json()) as VariantUpdateResult | { error?: string };

            if (!res.ok || !("success" in data)) {
                const message = "error" in data ? data.error : undefined;
                throw new Error(message || "Kunne ikkje leggje varianten til i Zettle.");
            }

            await loadComparison();
            setVariantUpdateResult(data);
        } catch (err) {
            setPreviewError(err instanceof Error ? err.message : "Ukjend feil");
        } finally {
            setVariantUpdateLoading(false);
        }
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">Zettle</h1>
                <p className="text-gray-600 mb-4">
                    Samanlikning av produkt og variantar mellom Valldal og Zettle. Valldal er master for pris og strekkode.
                </p>
                <button
                    className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white font-medium shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                    onClick={loadComparison}
                    disabled={loading}
                >
                    Oppdater samanlikning
                </button>
            </div>

            {error && (
                <div className="mb-8 bg-red-50 border border-red-200 text-red-800 rounded-md px-4 py-3">
                    {error}
                </div>
            )}
            {loading && (
                <div className="mb-8 bg-white border border-gray-200 rounded-md px-4 py-3 text-gray-500">
                    Laster...
                </div>
            )}

            {comparison && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col items-center">
                            <div className="text-xs text-gray-500 mb-1">Matcha produkt</div>
                            <div className="text-xl font-bold">{comparison.matchedCount}</div>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col items-center">
                            <div className="text-xs text-gray-500 mb-1">Pris-avvik</div>
                            <div className="text-xl font-bold">{comparison.priceMismatchCount}</div>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col items-center">
                            <div className="text-xs text-gray-500 mb-1">Strekkode-avvik</div>
                            <div className="text-xl font-bold">{comparison.barcodeMismatchCount}</div>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col items-center">
                            <div className="text-xs text-gray-500 mb-1">Manglar i Zettle</div>
                            <div className="text-xl font-bold">{comparison.missingInZettleCount}</div>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col items-center">
                            <div className="text-xs text-gray-500 mb-1">Manglar i Valldal</div>
                            <div className="text-xl font-bold">{comparison.missingInValldalCount}</div>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col items-center">
                            <div className="text-xs text-gray-500 mb-1">Inaktive i Valldal</div>
                            <div className="text-xl font-bold">{comparison.inactiveInValldalCount}</div>
                        </div>
                    </div>

                    <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-gray-900">Valde endringar</h2>
                                <p className="mt-1 text-sm text-gray-600">
                                    {selectedSkus.size === 0
                                        ? "Ingen varer er valde. Vel enkeltvarer i listene under, eller bruk hurtigvala."
                                        : `${selectedSkus.size} vare${selectedSkus.size === 1 ? "" : "r"} vald${selectedSkus.size === 1 ? "" : "e"}.`}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => selectSkus(allPriceSkus)}
                                    disabled={allPriceSkus.length === 0}
                                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Vel alle prisavvik
                                </button>
                                <button
                                    type="button"
                                    onClick={clearSelection}
                                    disabled={selectedSkus.size === 0}
                                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Fjern val
                                </button>
                                <button
                                    type="button"
                                    onClick={loadPricePreview}
                                    disabled={selectedSkus.size === 0 || previewLoading}
                                    className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {previewLoading ? "Sjekkar…" : "Førehandsvis oppdatering"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {previewError && (
                        <div className="mb-8 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                            {previewError}
                        </div>
                    )}

                    {pricePreview && (
                        <div className="mb-8 rounded-lg border border-gray-200 bg-white shadow-sm">
                            <div className="border-b border-gray-100 px-5 py-4">
                                <h2 className="text-base font-semibold text-gray-900">Førehandsvising av prisoppdatering</h2>
                                <p className="mt-1 text-sm text-gray-600">
                                    {pricePreview.updateCount === 0
                                        ? "Ingen prisar vil bli oppdaterte for dei valde varene."
                                        : `${pricePreview.updateCount} pris${pricePreview.updateCount === 1 ? "" : "ar"} ville blitt oppdatert i Zettle.`}
                                </p>
                            </div>
                            {pricePreview.updates.length > 0 && (
                                <div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="px-4 py-2 text-left font-medium text-gray-700">SKU</th>
                                                <th className="px-4 py-2 text-left font-medium text-gray-700">Produkt</th>
                                                <th className="px-4 py-2 text-left font-medium text-gray-700">Variant</th>
                                                <th className="px-4 py-2 text-right font-medium text-gray-700">Zettle no</th>
                                                <th className="px-4 py-2 text-right font-medium text-gray-700">Valldal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pricePreview.updates.map((update) => (
                                                <tr key={update.sku} className="border-t border-gray-100">
                                                    <td className="px-4 py-2 font-mono">{update.sku}</td>
                                                    <td className="px-4 py-2">{update.productName ?? "–"}</td>
                                                    <td className="px-4 py-2">{update.variantName ?? "–"}</td>
                                                    <td className="px-4 py-2 text-right">{formatCurrency(update.from)}</td>
                                                    <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(update.to)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex justify-end border-t border-gray-100 px-5 py-4">
                                    <button
                                        type="button"
                                        onClick={updateSelectedPrices}
                                        disabled={updateLoading}
                                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {updateLoading ? "Oppdaterer…" : "Oppdater desse prisane i Zettle"}
                                    </button>
                                </div>
                                </div>
                            )}
                        </div>
                    )}

                    {variantPreview && (
                        <div className="mb-8 rounded-lg border border-gray-200 bg-white shadow-sm">
                            <div className="border-b border-gray-100 px-5 py-4">
                                <h2 className="text-base font-semibold text-gray-900">Førehandsvising av ny variant</h2>
                                <p className="mt-1 text-sm text-gray-600">
                                    {variantPreview.zettleProduct
                                        ? `${variantPreview.valldalProduct.name} blir knytt til Zettle-produktet ${variantPreview.zettleProduct.name}.`
                                        : "Fann ikkje ei sikker plassering i Zettle."}
                                </p>
                            </div>
                            <div className="grid gap-6 p-5 md:grid-cols-2">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900">Eksisterande i Zettle</h3>
                                    <p className="mt-1 text-sm text-gray-600">
                                        Produkt: {variantPreview.zettleProduct?.name ?? "–"}<br />
                                        Kategori: {variantPreview.zettleProduct?.category ?? "–"}<br />
                                        Funne via SKU: {variantPreview.matchedBySkus.join(", ") || "–"}
                                    </p>
                                    <ul className="mt-3 space-y-2 text-sm">
                                        {variantPreview.existingVariants.map((variant) => (
                                            <li key={variant.sku || variant.name} className="rounded-md bg-gray-50 px-3 py-2">
                                                <span className="font-mono">{variant.sku || "Utan SKU"}</span>
                                                <span className="ml-3">{variant.name || "Utan variantnamn"}</span>
                                                <span className="float-right">{formatCurrency(variant.retailPrice)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900">Blir lagd til</h3>
                                    <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
                                        <div><span className="font-medium">SKU:</span> {variantPreview.variantToAdd.sku}</div>
                                        <div><span className="font-medium">Variant:</span> {variantPreview.variantToAdd.name}</div>
                                        <div><span className="font-medium">Pris:</span> {formatCurrency(variantPreview.variantToAdd.retailPrice)}</div>
                                        <div><span className="font-medium">Strekkode:</span> {variantPreview.variantToAdd.barcode ?? "Ingen"}</div>
                                    </div>
                                    {variantPreview.warnings.length > 0 && (
                                        <ul className="mt-3 list-disc pl-5 text-sm text-amber-800">
                                            {variantPreview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                                        </ul>
                                    )}
                                    {variantPreview.errors.length > 0 && (
                                        <ul className="mt-3 list-disc pl-5 text-sm text-red-800">
                                            {variantPreview.errors.map((previewError) => <li key={previewError}>{previewError}</li>)}
                                        </ul>
                                    )}
                                    <p className="mt-4 text-xs text-gray-500">
                                        Dette er berre ei førehandsvising. Ingenting er sendt til Zettle.
                                    </p>
                                    {variantPreview.valid && (
                                        <button
                                            type="button"
                                            onClick={addPreviewedVariant}
                                            disabled={variantUpdateLoading}
                                            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {variantUpdateLoading ? "Legg til…" : "Legg varianten til i Zettle"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {variantUpdateResult && (
                        <div className="mb-8 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                            Varianten {variantUpdateResult.variantName} (SKU {variantUpdateResult.sku}) vart lagd til i Zettle-produktet {variantUpdateResult.productName}.
                        </div>
                    )}

                    {updateResult && (
                        <div className={`mb-8 rounded-md border px-4 py-3 text-sm ${
                            updateResult.failedCount === 0
                                ? "border-green-200 bg-green-50 text-green-800"
                                : "border-amber-200 bg-amber-50 text-amber-900"
                        }`}>
                            <p className="font-medium">
                                {updateResult.updatedCount} pris{updateResult.updatedCount === 1 ? "" : "ar"} oppdatert.
                                {updateResult.failedCount > 0 && ` ${updateResult.failedCount} vart ikkje oppdatert.`}
                            </p>
                            {updateResult.results.some((result) => !result.success) && (
                                <ul className="mt-2 list-disc pl-5">
                                    {updateResult.results
                                        .filter((result) => !result.success)
                                        .map((result) => (
                                            <li key={result.sku}>
                                                {result.sku}: {result.error ?? "Ukjend feil"}
                                            </li>
                                        ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {comparison.differences.length === 0 ? (
                        <div className="bg-green-50 border border-green-200 rounded-md px-4 py-5 flex items-center mb-8">
                            <svg className="w-6 h-6 text-green-500 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-green-800 font-medium">
                                Ingen forskjellar funne – alle produkt og variantar er i synk!
                            </span>
                        </div>
                    ) : (
                        <>
                            <DifferenceTable title="Pris-avvik" differences={price} selectedSkus={selectedSkus} onToggleSku={toggleSku} />
                            <DifferenceTable title="Strekkode-avvik" differences={barcode} selectedSkus={selectedSkus} onToggleSku={toggleSku} />
                            <DifferenceTable
                                title="Manglar i Zettle"
                                differences={missingInZettle}
                                selectedSkus={selectedSkus}
                                onToggleSku={toggleSku}
                                selectable={false}
                                actionLabel="Førehandsvis plassering"
                                onAction={loadVariantPreview}
                                actionLoadingSku={variantPreviewSku}
                            />
                            <DifferenceTable title="Manglar i Valldal" differences={missingInValldal} selectedSkus={selectedSkus} onToggleSku={toggleSku} />
                            <DifferenceTable title="Inaktive i Valldal, framleis i Zettle" differences={inactiveInValldal} selectedSkus={selectedSkus} onToggleSku={toggleSku} selectable={false} />
                        </>
                    )}
                </>
            )}
        </div>
    );
}
