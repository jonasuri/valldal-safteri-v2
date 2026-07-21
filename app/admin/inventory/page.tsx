"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { auth } from "@/lib/firebase";
import {
    fetchInventoryBalances,
    fetchInventoryMovements,
    recordInventoryMovement,
} from "@/lib/inventory/firestore";
import type {
    InventoryBalance,
    InventoryMovement,
} from "@/lib/inventory/types";
import {
    fetchOpenOrderDemand,
    type OpenOrderDemand,
} from "@/lib/inventory/orders";
import { getSyncProducts } from "@/lib/productsSync";

type InventoryRow = {
    productId: string;
    productName: string;
    category: string;
    variantId: string;
    variantName: string;
    sku: string;
};

type CorrectionMode = "set_balance" | "adjust";
type AdjustmentDirection = "add" | "subtract";

type ZettlePreviewLine = {
    purchaseId: string;
    purchaseNumber?: number;
    timestamp: string;
    sku: string;
    productName: string;
    variantName: string;
    soldQuantity: number;
    inventoryChange: number;
    refund: boolean;
};

type ZettlePreview = {
    purchaseCount: number;
    lineCount: number;
    unitChange: number;
    lines: ZettlePreviewLine[];
    issues: Array<{
        purchaseId: string;
        purchaseNumber?: number;
        timestamp: string;
        productName: string;
        variantName: string;
        barcode: string;
        category: string;
        posFolder: string;
        productId: string;
        variantId: string;
        reason: string;
    }>;
};

function todayAsInputDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatZettleTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "–";
    return new Intl.DateTimeFormat("nb-NO", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(date);
}

const movementLabels: Record<InventoryMovement["type"], string> = {
    opening_balance: "Startbehaldning",
    manual_adjustment: "Manuell korrigering",
    stocktake_adjustment: "Vareteljing",
    order_fulfillment: "Ordre pakka",
    zettle_sale: "Zettle-sal",
    production: "Produksjon",
    return: "Retur",
    waste: "Svinn",
};

function formatDate(value: unknown) {
    if (!value || typeof value !== "object") return "–";
    const timestamp = value as { toDate?: () => Date };
    if (typeof timestamp.toDate !== "function") return "–";
    return new Intl.DateTimeFormat("nb-NO", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(timestamp.toDate());
}

function parseInteger(value: string) {
    const normalized = value.trim();
    if (!/^-?\d+$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

export default function InventoryPage() {
    const [rows, setRows] = useState<InventoryRow[]>([]);
    const [balances, setBalances] = useState<InventoryBalance[]>([]);
    const [orderDemand, setOrderDemand] = useState<OpenOrderDemand[]>([]);
    const [unresolvedOrderLines, setUnresolvedOrderLines] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("all");
    const [selectedRow, setSelectedRow] = useState<InventoryRow | null>(null);
    const [quantity, setQuantity] = useState("");
    const [correctionMode, setCorrectionMode] = useState<CorrectionMode>("set_balance");
    const [adjustmentDirection, setAdjustmentDirection] = useState<AdjustmentDirection>("add");
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);
    const [savedMessage, setSavedMessage] = useState<string | null>(null);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [zettleStartDate, setZettleStartDate] = useState(todayAsInputDate);
    const [zettlePreview, setZettlePreview] = useState<ZettlePreview | null>(null);
    const [zettleLoading, setZettleLoading] = useState(false);
    const [zettleError, setZettleError] = useState<string | null>(null);

    async function loadOverview() {
        setLoading(true);
        setError(null);
        try {
            const products = await getSyncProducts();
            const [nextBalances, demandResult] = await Promise.all([
                fetchInventoryBalances(),
                fetchOpenOrderDemand(products),
            ]);

            const nextRows = products
                .filter((product) => product.active)
                .flatMap((product) =>
                    product.variants
                        .filter((variant) => variant.active && variant.sku)
                        .map((variant) => ({
                            productId: product.id,
                            productName: product.name,
                            category: product.category,
                            variantId: variant.id,
                            variantName: variant.name,
                            sku: variant.sku,
                        }))
                )
                .sort((a, b) => {
                    const categoryCompare = a.category.localeCompare(b.category, "nb-NO");
                    if (categoryCompare !== 0) return categoryCompare;
                    const productCompare = a.productName.localeCompare(b.productName, "nb-NO");
                    if (productCompare !== 0) return productCompare;
                    return a.variantName.localeCompare(b.variantName, "nb-NO");
                });

            setRows(nextRows);
            setBalances(nextBalances);
            setOrderDemand(demandResult.demand);
            setUnresolvedOrderLines(demandResult.unresolvedLines.length);
        } catch (loadError) {
            console.error(loadError);
            setError("Kunne ikkje hente lageroversikta. Kontroller Firestore-tilgangen.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadOverview();
    }, []);

    const balanceBySku = useMemo(
        () => new Map(balances.map((balance) => [balance.sku, balance])),
        [balances]
    );

    const categories = useMemo(
        () => [...new Set(rows.map((row) => row.category).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, "nb-NO")),
        [rows]
    );

    const demandBySku = useMemo(
        () => new Map(orderDemand.map((item) => [item.sku, item])),
        [orderDemand]
    );

    const visibleRows = useMemo(() => {
        const normalizedSearch = search.trim().toLocaleLowerCase("nb-NO");
        return rows.filter((row) => {
            if (category !== "all" && row.category !== category) return false;
            if (!normalizedSearch) return true;
            return `${row.sku} ${row.productName} ${row.variantName} ${row.category}`
                .toLocaleLowerCase("nb-NO")
                .includes(normalizedSearch);
        });
    }, [category, rows, search]);

    const selectedBalance = selectedRow
        ? balanceBySku.get(selectedRow.sku)
        : undefined;
    const isOpeningBalance = selectedRow ? !selectedBalance : false;
    const totalOnHand = balances.reduce((sum, balance) => sum + balance.onHand, 0);
    const totalOpenOrderQuantity = orderDemand.reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    async function openEditor(row: InventoryRow) {
        setSelectedRow(row);
        setQuantity("");
        setCorrectionMode("set_balance");
        setAdjustmentDirection("add");
        setNote("");
        setSavedMessage(null);
        setHistoryLoading(true);
        try {
            setMovements(await fetchInventoryMovements(row.sku));
        } catch (historyError) {
            console.error(historyError);
            setMovements([]);
            setError("Kunne ikkje hente lagerhistorikken.");
        } finally {
            setHistoryLoading(false);
        }
    }

    async function saveMovement() {
        if (!selectedRow) return;
        const parsedQuantity = parseInteger(quantity);

        if (parsedQuantity === null || parsedQuantity < 0) {
            setError("Mengda må vere eit positivt heilt tal.");
            return;
        }

        const currentBalance = selectedBalance?.onHand ?? 0;
        const movementQuantity = isOpeningBalance
            ? parsedQuantity
            : correctionMode === "set_balance"
                ? parsedQuantity - currentBalance
                : adjustmentDirection === "add"
                    ? parsedQuantity
                    : -parsedQuantity;

        if (movementQuantity === 0 && !isOpeningBalance) {
            setError(
                correctionMode === "set_balance"
                    ? "Den nye beholdninga er lik den som allereie er registrert."
                    : "Mengda må vere større enn null."
            );
            return;
        }

        setSaving(true);
        setError(null);
        setSavedMessage(null);
        try {
            const type = isOpeningBalance
                ? "opening_balance" as const
                : correctionMode === "set_balance"
                    ? "stocktake_adjustment" as const
                    : "manual_adjustment" as const;
            const actionId = crypto.randomUUID();

            const result = await recordInventoryMovement({
                sku: selectedRow.sku,
                quantity: movementQuantity,
                type,
                source: correctionMode === "set_balance" && !isOpeningBalance
                    ? "stocktake"
                    : "manual",
                idempotencyKey: `manual:${type}:${selectedRow.sku}:${actionId}`,
                productId: selectedRow.productId,
                variantId: selectedRow.variantId,
                productName: selectedRow.productName,
                variantName: selectedRow.variantName,
                note,
                createdBy: auth.currentUser?.email ?? undefined,
            });

            const recorded = result.recorded[0];
            if (!recorded) {
                throw new Error("Lagerendringa vart ikkje registrert.");
            }

            setQuantity("");
            setNote("");
            setSavedMessage(
                `${movementQuantity > 0 ? "+" : ""}${movementQuantity} registrert. Ny beholdning: ${recorded.balanceAfter}.`
            );
            const [nextBalances, nextMovements] = await Promise.all([
                fetchInventoryBalances(),
                fetchInventoryMovements(selectedRow.sku),
            ]);
            setBalances(nextBalances);
            setMovements(nextMovements);
        } catch (saveError) {
            console.error(saveError);
            setError(
                saveError instanceof Error
                    ? saveError.message
                    : "Kunne ikkje registrere lagerendringa."
            );
        } finally {
            setSaving(false);
        }
    }

    async function loadZettlePreview() {
        setZettleLoading(true);
        setZettleError(null);
        try {
            const params = new URLSearchParams({ startDate: zettleStartDate });
            const response = await fetch(
                `/api/admin/integrations/zettle/purchases/preview?${params.toString()}`,
                { cache: "no-store" }
            );
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Kunne ikkje hente Zettle-sal.");
            }
            setZettlePreview(data as ZettlePreview);
        } catch (previewError) {
            console.error(previewError);
            setZettlePreview(null);
            setZettleError(
                previewError instanceof Error
                    ? previewError.message
                    : "Kunne ikkje hente Zettle-sal."
            );
        } finally {
            setZettleLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-[color:var(--paper)] text-neutral-900">
            <div className="mx-auto max-w-7xl px-4 py-8 md:py-12">
                <header className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-6 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Admin</p>
                        <h1 className="mt-2 text-3xl tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
                            Lager
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                            Fysisk beholdning og behov frå opne ordre per SKU. Produksjonsbehov blir kopla på seinare.
                        </p>
                    </div>
                    <Link
                        href="/admin"
                        className="inline-flex w-fit rounded-full border border-[color:var(--line)] px-4 py-2 text-xs text-neutral-700 hover:bg-black/5"
                    >
                        ← Administrasjon
                    </Link>
                </header>

                {error && (
                    <div className="mt-6 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        {error}
                    </div>
                )}

                <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-[18px] border border-[color:var(--line)] bg-white/80 p-4">
                        <p className="text-xs text-neutral-500">Aktive SKU-ar</p>
                        <p className="mt-1 text-2xl font-semibold">{rows.length}</p>
                    </div>
                    <div className="rounded-[18px] border border-[color:var(--line)] bg-white/80 p-4">
                        <p className="text-xs text-neutral-500">Med registrert lager</p>
                        <p className="mt-1 text-2xl font-semibold">{balances.length}</p>
                    </div>
                    <div className="rounded-[18px] border border-[color:var(--line)] bg-white/80 p-4">
                        <p className="text-xs text-neutral-500">Einingar fysisk på lager</p>
                        <p className="mt-1 text-2xl font-semibold">{totalOnHand}</p>
                    </div>
                    <div className="rounded-[18px] border border-[color:var(--line)] bg-white/80 p-4">
                        <p className="text-xs text-neutral-500">Einingar i opne ordre</p>
                        <p className="mt-1 text-2xl font-semibold">{totalOpenOrderQuantity}</p>
                    </div>
                </section>

                {unresolvedOrderLines > 0 && (
                    <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        {unresolvedOrderLines} ordrelinje{unresolvedOrderLines === 1 ? "" : "r"} kunne ikkje koplast sikkert til SKU og er ikkje med i ordrebehovet.
                    </div>
                )}

                <section className="mt-6 rounded-[20px] border border-[color:var(--line)] bg-white/80 p-5 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Zettle</p>
                            <h2 className="mt-1 text-lg font-medium">Førehandsvis lagerendringar</h2>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600">
                                Hent sal frå ein dato og kontroller kva som ville blitt trekt frå lageret. Ingenting blir bokført her.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                            <label className="text-xs font-medium text-neutral-700">
                                Frå dato
                                <input
                                    type="date"
                                    value={zettleStartDate}
                                    onChange={(event) => setZettleStartDate(event.target.value)}
                                    className="mt-1 block rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-sm"
                                />
                            </label>
                            <button
                                type="button"
                                onClick={loadZettlePreview}
                                disabled={zettleLoading || !zettleStartDate}
                                className="rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                            >
                                {zettleLoading ? "Hentar …" : "Hent Zettle-sal"}
                            </button>
                        </div>
                    </div>

                    {zettleError && (
                        <div className="mt-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                            {zettleError}
                        </div>
                    )}

                    {zettlePreview && (
                        <div className="mt-5">
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-[14px] bg-neutral-50 p-3">
                                    <p className="text-xs text-neutral-500">Kvitteringar</p>
                                    <p className="mt-1 text-xl font-semibold">{zettlePreview.purchaseCount}</p>
                                </div>
                                <div className="rounded-[14px] bg-neutral-50 p-3">
                                    <p className="text-xs text-neutral-500">Varelinjer</p>
                                    <p className="mt-1 text-xl font-semibold">{zettlePreview.lineCount}</p>
                                </div>
                                <div className="rounded-[14px] bg-neutral-50 p-3">
                                    <p className="text-xs text-neutral-500">Samla lagerendring</p>
                                    <p className={`mt-1 text-xl font-semibold ${zettlePreview.unitChange < 0 ? "text-red-700" : "text-emerald-700"}`}>
                                        {zettlePreview.unitChange > 0 ? "+" : ""}{zettlePreview.unitChange}
                                    </p>
                                </div>
                            </div>

                            {zettlePreview.issues.length > 0 && (
                                <div className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    <p className="font-medium">{zettlePreview.issues.length} linje{zettlePreview.issues.length === 1 ? "" : "r"} må kontrollerast</p>
                                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                        {zettlePreview.issues.slice(0, 10).map((issue, index) => (
                                            <div key={`${issue.purchaseId}:${index}`} className="rounded-[10px] border border-amber-200 bg-white/70 p-3">
                                                <p className="font-medium text-neutral-900">
                                                    {issue.productName}{issue.variantName ? ` · ${issue.variantName}` : ""}
                                                </p>
                                                <p className="mt-1">Kategori: {issue.category}</p>
                                                <p>POS-mappe: {issue.posFolder}</p>
                                                <p>Strekkode: {issue.barcode || "Ingen"}</p>
                                                <p>Kvittering: {issue.purchaseNumber ?? "–"} · {formatZettleTime(issue.timestamp)}</p>
                                                <p className="mt-1 font-medium text-amber-900">{issue.reason}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {zettlePreview.lines.length === 0 ? (
                                <p className="mt-4 text-sm text-neutral-500">Ingen Zettle-varer funne i perioden.</p>
                            ) : (
                                <div className="mt-4 overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="text-left text-xs text-neutral-500">
                                            <tr>
                                                <th className="pb-2 pr-4 font-medium">Tid</th>
                                                <th className="pb-2 pr-4 font-medium">Kvittering</th>
                                                <th className="pb-2 pr-4 font-medium">SKU</th>
                                                <th className="pb-2 pr-4 font-medium">Vare</th>
                                                <th className="pb-2 text-right font-medium">Lagerendring</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {zettlePreview.lines.map((line, index) => (
                                                <tr key={`${line.purchaseId}:${line.sku}:${index}`} className="border-t border-[color:var(--line)]">
                                                    <td className="py-2 pr-4 text-xs text-neutral-500">{formatZettleTime(line.timestamp)}</td>
                                                    <td className="py-2 pr-4">{line.purchaseNumber ?? "–"}</td>
                                                    <td className="py-2 pr-4 font-mono text-xs">{line.sku}</td>
                                                    <td className="py-2 pr-4">
                                                        {line.productName}{line.variantName ? ` · ${line.variantName}` : ""}
                                                        {line.refund ? <span className="ml-2 text-xs text-emerald-700">Retur</span> : null}
                                                    </td>
                                                    <td className={`py-2 text-right font-semibold ${line.inventoryChange > 0 ? "text-emerald-700" : "text-red-700"}`}>
                                                        {line.inventoryChange > 0 ? "+" : ""}{line.inventoryChange}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {selectedRow && (
                    <section className="mt-6 rounded-[20px] border border-[color:var(--line)] bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                                <p className="font-medium">{selectedRow.productName} · {selectedRow.variantName}</p>
                                <p className="mt-1 text-sm text-neutral-500">SKU {selectedRow.sku}</p>
                                <p className="mt-2 text-sm">
                                    Fysisk beholdning: <span className="font-semibold">{selectedBalance?.onHand ?? 0}</span>
                                </p>
                                <p className="mt-1 text-sm">
                                    I opne ordre: <span className="font-semibold">{demandBySku.get(selectedRow.sku)?.quantity ?? 0}</span>
                                </p>
                                <p className="mt-1 text-sm">
                                    Disponibelt etter ordre:{" "}
                                    <span className="font-semibold">
                                        {selectedBalance
                                            ? selectedBalance.onHand - (demandBySku.get(selectedRow.sku)?.quantity ?? 0)
                                            : "–"}
                                    </span>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedRow(null)}
                                className="text-xs text-neutral-500 hover:text-neutral-900"
                            >
                                Lukk
                            </button>
                        </div>

                        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
                            <div>
                                <h2 className="text-sm font-medium">
                                    {isOpeningBalance ? "Registrer startbehaldning" : "Korriger lager"}
                                </h2>
                                <p className="mt-1 text-xs leading-5 text-neutral-500">
                                    {isOpeningBalance
                                        ? "Skriv inn talet som fysisk finst på lager no."
                                        : correctionMode === "set_balance"
                                            ? "Skriv inn det talet som fysisk står på lager. Differansen blir bokført automatisk."
                                            : "Vel om mengda skal leggjast til eller trekkjast frå."}
                                </p>

                                {!isOpeningBalance && (
                                    <div className="mt-4 grid grid-cols-2 rounded-full bg-neutral-100 p-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCorrectionMode("set_balance");
                                                setQuantity("");
                                                setError(null);
                                            }}
                                            className={`rounded-full px-3 py-2 text-xs font-medium ${correctionMode === "set_balance" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"}`}
                                        >
                                            Set beholdning
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCorrectionMode("adjust");
                                                setQuantity("");
                                                setError(null);
                                            }}
                                            className={`rounded-full px-3 py-2 text-xs font-medium ${correctionMode === "adjust" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"}`}
                                        >
                                            Juster med ±
                                        </button>
                                    </div>
                                )}

                                {!isOpeningBalance && correctionMode === "adjust" && (
                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setAdjustmentDirection("add")}
                                            className={`rounded-[10px] border px-3 py-2 text-sm font-medium ${adjustmentDirection === "add" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-[color:var(--line)] bg-white text-neutral-600"}`}
                                        >
                                            + Legg til
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAdjustmentDirection("subtract")}
                                            className={`rounded-[10px] border px-3 py-2 text-sm font-medium ${adjustmentDirection === "subtract" ? "border-red-400 bg-red-50 text-red-800" : "border-[color:var(--line)] bg-white text-neutral-600"}`}
                                        >
                                            − Trekk frå
                                        </button>
                                    </div>
                                )}
                                <label className="mt-4 block text-xs font-medium text-neutral-700" htmlFor="inventory-quantity">
                                    {isOpeningBalance
                                        ? "Startbehaldning"
                                        : correctionMode === "set_balance"
                                            ? "Ny fysisk beholdning"
                                            : "Mengd"}
                                </label>
                                <input
                                    id="inventory-quantity"
                                    inputMode="numeric"
                                    value={quantity}
                                    onChange={(event) => setQuantity(event.target.value)}
                                    placeholder={isOpeningBalance
                                        ? "Til dømes 120"
                                        : correctionMode === "set_balance"
                                            ? "Til dømes 47"
                                            : "Til dømes 3"}
                                    className="mt-1 w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-neutral-700"
                                />
                                <label className="mt-4 block text-xs font-medium text-neutral-700" htmlFor="inventory-note">
                                    Notat
                                </label>
                                <textarea
                                    id="inventory-note"
                                    rows={3}
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    placeholder="Til dømes vareteljing 21. juli"
                                    className="mt-1 w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-neutral-700"
                                />
                                <button
                                    type="button"
                                    onClick={saveMovement}
                                    disabled={saving}
                                    className="mt-4 rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                                >
                                    {saving ? "Registrerer …" : "Registrer lagerendring"}
                                </button>
                                {savedMessage && <p className="mt-3 text-sm text-emerald-700">{savedMessage}</p>}
                            </div>

                            <div>
                                <h2 className="text-sm font-medium">Siste rørsler</h2>
                                {historyLoading ? (
                                    <p className="mt-3 text-sm text-neutral-500">Hentar historikk …</p>
                                ) : movements.length === 0 ? (
                                    <p className="mt-3 text-sm text-neutral-500">Ingen lagerrørsler registrerte.</p>
                                ) : (
                                    <div className="mt-3 overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="text-left text-xs text-neutral-500">
                                                <tr>
                                                    <th className="pb-2 pr-4 font-medium">Tid</th>
                                                    <th className="pb-2 pr-4 font-medium">Hending</th>
                                                    <th className="pb-2 pr-4 text-right font-medium">Endring</th>
                                                    <th className="pb-2 text-right font-medium">Etter</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {movements.map((movement) => (
                                                    <tr key={movement.id} className="border-t border-[color:var(--line)]">
                                                        <td className="py-2 pr-4 text-xs text-neutral-500">{formatDate(movement.occurredAt ?? movement.createdAt)}</td>
                                                        <td className="py-2 pr-4">
                                                            {movementLabels[movement.type]}
                                                            {movement.note ? <div className="text-xs text-neutral-500">{movement.note}</div> : null}
                                                        </td>
                                                        <td className={`py-2 pr-4 text-right font-medium ${movement.quantity > 0 ? "text-emerald-700" : "text-red-700"}`}>
                                                            {movement.quantity > 0 ? "+" : ""}{movement.quantity}
                                                        </td>
                                                        <td className="py-2 text-right">{movement.balanceAfter}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                <section className="mt-6 rounded-[20px] border border-[color:var(--line)] bg-white/80 shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-[color:var(--line)] p-4 md:flex-row md:items-center">
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Søk på produkt, variant eller SKU"
                            className="w-full rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-sm outline-none focus:border-neutral-700 md:max-w-sm"
                        />
                        <select
                            value={category}
                            onChange={(event) => setCategory(event.target.value)}
                            className="rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-sm outline-none"
                        >
                            <option value="all">Alle kategoriar</option>
                            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                    </div>

                    {loading ? (
                        <p className="p-6 text-sm text-neutral-500">Hentar lager …</p>
                    ) : visibleRows.length === 0 ? (
                        <p className="p-6 text-sm text-neutral-500">Ingen variantar funne.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">SKU</th>
                                        <th className="px-4 py-3 font-medium">Produkt</th>
                                        <th className="px-4 py-3 font-medium">Variant</th>
                                        <th className="px-4 py-3 font-medium">Kategori</th>
                                        <th className="px-4 py-3 text-right font-medium">Fysisk lager</th>
                                        <th className="px-4 py-3 text-right font-medium">I opne ordre</th>
                                        <th className="px-4 py-3 text-right font-medium">Disponibelt</th>
                                        <th className="px-4 py-3 text-right font-medium">Handling</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleRows.map((row) => {
                                        const balance = balanceBySku.get(row.sku);
                                        const demand = demandBySku.get(row.sku)?.quantity ?? 0;
                                        const projectedAvailable = balance
                                            ? balance.onHand - demand
                                            : null;
                                        return (
                                            <tr key={`${row.productId}:${row.variantId}`} className="border-t border-[color:var(--line)]">
                                                <td className="px-4 py-3 font-mono text-xs">{row.sku}</td>
                                                <td className="px-4 py-3 font-medium">{row.productName}</td>
                                                <td className="px-4 py-3">{row.variantName}</td>
                                                <td className="px-4 py-3 text-neutral-500">{row.category}</td>
                                                <td className="px-4 py-3 text-right">
                                                    {balance ? balance.onHand : <span className="text-neutral-400">Ikkje registrert</span>}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {demand || <span className="text-neutral-400">0</span>}
                                                </td>
                                                <td className={`px-4 py-3 text-right font-medium ${projectedAvailable !== null && projectedAvailable < 0 ? "text-red-700" : ""}`}>
                                                    {projectedAvailable ?? <span className="text-neutral-400">–</span>}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditor(row)}
                                                        className="rounded-full border border-[color:var(--line)] px-3 py-1.5 text-xs hover:bg-black/5"
                                                    >
                                                        {balance ? "Korriger" : "Startbehaldning"}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
