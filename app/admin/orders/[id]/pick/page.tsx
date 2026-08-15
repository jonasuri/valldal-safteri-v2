"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { arrayUnion, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { requireActiveOperator } from "@/lib/adminOperators";
import { auth, db } from "@/lib/firebase";
import { completeOrderPacking } from "@/lib/completeOrderPacking";
import { groupOrderLinesByBrand, sortOrderLines } from "@/lib/orderLineSorting";
import { useSystemFeedback } from "@/app/components/SystemFeedback";

type OrderLine = {
    productId: string;
    productName: string;
    variantId: string;
    variantLabel: string;
    brand: "safteri" | "bryggeri";
    category?: string | null;
    subcategory?: string | null;
    categoryName?: string | null;
    subcategoryName?: string | null;
    quantity: number;
    unitPrice: number;
};

type PackingLine = {
    productId: string;
    variantId: string;
    orderedQuantity: number;
    packedQuantity: number | null;
    missingQuantity: number | null;
};

type OrderDetail = {
    id: string;
    orderNumber: string | null;
    customerName: string;
    customerDisplayName: string;
    customerCompanyName: string;
    lines: OrderLine[];
    packingLines: PackingLine[];
    packingInventoryRevision: number;
};

function mapOrder(id: string, data: any): OrderDetail {
    const customerCompanyName =
        typeof data.customerCompanyName === "string" && data.customerCompanyName.trim()
            ? data.customerCompanyName
            : typeof data.customerName === "string"
                ? data.customerName
                : "Ukjend kunde";

    const customerDisplayName =
        typeof data.customerDisplayName === "string" && data.customerDisplayName.trim()
            ? data.customerDisplayName
            : customerCompanyName;

    return {
        id,
        orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : null,
        customerName: customerDisplayName,
        customerDisplayName,
        customerCompanyName,
        lines: Array.isArray(data.lines) ? data.lines : [],
        packingLines: Array.isArray(data.packing?.lines) ? data.packing.lines : [],
        packingInventoryRevision: typeof data.packing?.inventoryRevision === "number"
            ? data.packing.inventoryRevision
            : data.inventoryFulfillment?.status === "posted" ? 1 : 0,
    };
}

function getLineKey(line: OrderLine) {
    return `${line.productId}-${line.variantId}`;
}


export default function OrderPickPage() {
    const { notify } = useSystemFeedback();
    const params = useParams();
    const router = useRouter();
    const orderId = typeof params.id === "string" ? params.id : "";

    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [packed, setPacked] = useState<Record<string, number | "">>({});
    const [fullyPacked, setFullyPacked] = useState<Record<string, boolean>>({});
    const [savingPacking, setSavingPacking] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (!orderId) return;

        const unsubscribe = onSnapshot(doc(db, "orders", orderId), (snapshot) => {
            if (!snapshot.exists()) {
                setOrder(null);
                setLoading(false);
                return;
            }

            setOrder(mapOrder(snapshot.id, snapshot.data()));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [orderId]);

    useEffect(() => {
        if (!order) return;

        const nextPacked: Record<string, number | ""> = {};
        const nextFullyPacked: Record<string, boolean> = {};

        for (const line of order.lines) {
            const key = getLineKey(line);
            const savedLine = order.packingLines.find(
                (item) => item.productId === line.productId && item.variantId === line.variantId
            );

            if (typeof savedLine?.packedQuantity === "number") {
                nextPacked[key] = savedLine.packedQuantity;
                nextFullyPacked[key] = savedLine.packedQuantity === line.quantity;
            }
        }

        setPacked(nextPacked);
        setFullyPacked(nextFullyPacked);
        setHasChanges(false);
    }, [order]);

    function buildPackingLines() {
        if (!order) return [];

        return sortOrderLines(order.lines).map((line) => {
            const packedQuantityValue = packedQuantity(line);
            const numericPacked = typeof packedQuantityValue === "number" ? packedQuantityValue : null;

            return {
                productId: line.productId,
                variantId: line.variantId,
                orderedQuantity: line.quantity,
                packedQuantity: numericPacked,
                missingQuantity: numericPacked === null ? null : Math.max(0, line.quantity - numericPacked),
            };
        });
    }

    async function savePackingDraft() {
        if (!orderId || !order) return;

        try {
            setSavingPacking(true);
            const operator = requireActiveOperator();

            await updateDoc(doc(db, "orders", orderId), {
                "packing.lines": buildPackingLines(),
                "packing.updatedAt": serverTimestamp(),
                lastUpdatedByOperator: operator,
                operatorHistory: arrayUnion({ action: "packing_draft_saved", operator, occurredAt: new Date() }),
                updatedAt: serverTimestamp(),
            });
            setHasChanges(false);
        } catch (error) {
            console.error(error);
            notify("Kunne ikkje lagre plukklista.", "error");
        } finally {
            setSavingPacking(false);
        }
    }

    async function completePacking() {
        if (!orderId || !order || !canCompletePacking) return;

        try {
            setSavingPacking(true);

            const packingLines = buildPackingLines();
            if (!auth.currentUser) throw new Error("UNAUTHORIZED");
            await completeOrderPacking({
                user: auth.currentUser,
                orderId,
                packingLines,
            });

            router.push(`/admin/orders/${orderId}`);
        } catch (error) {
            console.error(error);
            notify(
                error instanceof Error
                    ? error.message
                    : "Kunne ikkje fullføre pakkinga."
            , "error");
        } finally {
            setSavingPacking(false);
        }
    }

    useEffect(() => {
        if (!order || !hasChanges) return;

        const timeout = setTimeout(() => {
            savePackingDraft();
        }, 1000);

        return () => clearTimeout(timeout);
    }, [packed, fullyPacked, hasChanges]);

    function packedQuantity(line: OrderLine) {
        return packed[getLineKey(line)] ?? "";
    }

    function numericPackedQuantity(line: OrderLine) {
        const value = packed[getLineKey(line)];
        return typeof value === "number" ? value : 0;
    }

    function setPackedQuantity(line: OrderLine, quantity: number | "") {
        const key = getLineKey(line);
        const nextQuantity = quantity === ""
            ? ""
            : Math.min(line.quantity, Math.max(0, Math.floor(quantity)));

        setPacked((current) => ({ ...current, [key]: nextQuantity }));
        setFullyPacked((current) => ({ ...current, [key]: nextQuantity === line.quantity }));
        setHasChanges(true);
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
                <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-neutral-600">
                    Lastar plukkliste …
                </div>
            </main>
        );
    }

    if (!order) {
        return (
            <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
                <div className="mx-auto max-w-5xl px-6 py-10">
                    <Link
                        href={`/admin/orders/${orderId}`}
                        className="text-sm text-neutral-600 underline-offset-4 hover:underline"
                    >
                        ← Tilbake til ordre
                    </Link>

                    <div className="mt-6 rounded-[24px] border border-neutral-200 bg-white p-6">
                        <h1 className="text-2xl font-semibold tracking-tight">Fann ikkje ordre</h1>
                        <p className="mt-2 text-sm text-neutral-600">
                            Ordren finst ikkje, eller han er sletta.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    const completedLineCount = order.lines.filter((line) => {
        const value = packed[getLineKey(line)];
        return value !== undefined && value !== "";
    }).length;

    const allLinesHandled = completedLineCount === order.lines.length;

    const hasMissingProducts = order.lines.some((line) => {
        const value = numericPackedQuantity(line);
        return value < line.quantity;
    });

    const packingResultStatus = !allLinesHandled
        ? "Under pakking"
        : hasMissingProducts
            ? "Delpakka"
            : "Pakka";

    const packedLineCount = order.lines.filter((line) => fullyPacked[getLineKey(line)]).length;
    const canCompletePacking = allLinesHandled;
    const sortedLines = sortOrderLines(order.lines);
    const groupedLines = groupOrderLinesByBrand(sortedLines);

    return (
        <main className="min-h-screen text-[color:var(--admin-ink)]">
            <div className="mx-auto max-w-5xl px-5 pb-36 pt-7 md:px-8 md:pb-36 md:pt-10">
                <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-xs font-medium text-[color:var(--admin-muted)] underline-offset-4 hover:text-[color:var(--admin-ink)] hover:underline"
                >
                    ← Tilbake til ordre
                </Link>

                <header className="mt-5 rounded-[22px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:p-7">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--admin-muted)]">
                        Plukkliste
                    </p>

                    <h1 className="mt-2 text-3xl tracking-tight md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
                        {order.orderNumber || order.id.slice(0, 8).toUpperCase()}
                    </h1>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
                        <span>{order.customerDisplayName || order.customerName}</span>
                        {order.customerCompanyName && order.customerCompanyName !== (order.customerDisplayName || order.customerName) ? (
                            <>
                                <span>•</span>
                                <span className="text-neutral-500">Fakturerast til: {order.customerCompanyName}</span>
                            </>
                        ) : null}
                        <span>•</span>
                        <span>{completedLineCount} av {order.lines.length} varelinjer registrerte</span>
                        <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${packingResultStatus === "Delpakka"
                                ? "bg-amber-100 text-amber-800"
                                : packingResultStatus === "Pakka"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-neutral-100 text-neutral-700"
                                }`}
                        >
                            {packingResultStatus}
                        </span>
                    </div>
                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-neutral-100">
                        <div
                            className="h-full rounded-full bg-[color:var(--admin-accent)] transition-all"
                            style={{ width: `${order.lines.length ? (completedLineCount / order.lines.length) * 100 : 0}%` }}
                        />
                    </div>
                </header>

                <section className="mt-5 rounded-[18px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="font-medium">Automatisk ordrestatus</h2>
                            <p className="mt-1 text-sm text-neutral-500">
                                Når alle linjer er registrerte vil ordren bli sett til Pakka eller Delpakka.
                            </p>
                        </div>

                        <div className="shrink-0 text-right">
                            <div className="text-xs uppercase tracking-[0.12em] text-neutral-500">
                                Ny status
                            </div>
                            <div className="mt-1 text-lg font-semibold">
                                {packingResultStatus}
                            </div>
                        </div>
                    </div>
                    <p className="mt-4 border-t border-[color:var(--admin-line)] pt-4 text-sm leading-6 text-[color:var(--admin-muted)]">
                        Mengdene blir lagra automatisk. Lageret blir først justert når du fullfører pakkinga nedst på skjermen.
                    </p>
                </section>

                <div className="mt-6 space-y-8">
                    {([
                        ["Valldal Safteri", groupedLines.safteri, "text-rose-700"],
                        ["Valldal Bryggeri", groupedLines.bryggeri, "text-amber-700"],
                    ] as const).map(([title, lines, textClass]) => {
                        if (!lines.length) return null;

                        return (
                            <section key={title} className="space-y-4">
                                <div className="border-b border-neutral-200 pb-2">
                                    <h2 className={`text-sm font-semibold uppercase tracking-[0.18em] ${textClass}`}>
                                        {title}
                                    </h2>
                                </div>

                                {lines.map((line) => {
                                    const key = getLineKey(line);
                                    const packedQty = packedQuantity(line);
                                    const missingQty = Math.max(0, line.quantity - numericPackedQuantity(line));
                                    const isFullyPacked = fullyPacked[key] || false;

                                    return (
                                        <div
                                            key={key}
                                            className={`rounded-[20px] border p-5 transition md:p-6 ${
                                                packedQty !== ""
                                                    ? missingQty > 0
                                                        ? "border-amber-200 bg-amber-50/55"
                                                        : "border-emerald-200 bg-emerald-50/40"
                                                    : "border-[color:var(--admin-line)] bg-[color:var(--admin-card)]"
                                            }`}
                                        >
                                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <div className="mb-2 flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">
                                                        {(line.categoryName || line.category) ? <span>{line.categoryName || line.category}</span> : null}
                                                        {(line.subcategoryName || line.subcategory) ? <span>/{line.subcategoryName || line.subcategory}</span> : null}
                                                    </div>
                                                    <h2 className="text-lg font-medium">
                                                        {line.productName}
                                                    </h2>
                                                    <p className="text-sm text-neutral-500">
                                                        {line.variantLabel}
                                                    </p>
                                                </div>

                                                <label className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${isFullyPacked ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-[color:var(--admin-line-strong)] bg-white hover:bg-neutral-50"}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isFullyPacked}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;

                                                            setPackedQuantity(line, checked ? line.quantity : "");
                                                        }}
                                                        className="h-4 w-4 rounded border-neutral-300"
                                                    />
                                                    Alt pakka
                                                </label>
                                            </div>

                                            <div className="mt-5 grid gap-4 md:grid-cols-3">
                                                <div>
                                                    <div className="text-xs uppercase tracking-[0.12em] text-neutral-500">
                                                        Bestilt
                                                    </div>
                                                    <div className="mt-2 text-3xl font-semibold">
                                                        {line.quantity}
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="text-xs uppercase tracking-[0.12em] text-neutral-500">
                                                        Pakka
                                                    </div>
                                                    <div className="mt-2 inline-flex items-center overflow-hidden rounded-[12px] border border-[color:var(--admin-line-strong)] bg-white">
                                                        <button type="button" onClick={() => setPackedQuantity(line, Math.max(0, numericPackedQuantity(line) - 1))} className="h-11 w-11 text-lg text-neutral-600 hover:bg-neutral-50" aria-label={`Trekk frå éin ${line.productName}`}>−</button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={line.quantity}
                                                            inputMode="numeric"
                                                            value={packedQty}
                                                            placeholder="—"
                                                            onChange={(e) => setPackedQuantity(line, e.target.value === "" ? "" : Number(e.target.value))}
                                                            className="h-11 w-16 border-x border-[color:var(--admin-line)] px-2 text-center text-lg font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                        />
                                                        <button type="button" onClick={() => setPackedQuantity(line, numericPackedQuantity(line) + 1)} className="h-11 w-11 text-lg text-neutral-600 hover:bg-neutral-50" aria-label={`Legg til éin ${line.productName}`}>+</button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="text-xs uppercase tracking-[0.12em] text-neutral-500">
                                                        Manglar
                                                    </div>
                                                    <div className={
                                                        "mt-2 text-3xl font-semibold " +
                                                        (missingQty > 0 ? "text-amber-700" : "text-neutral-400")
                                                    }>
                                                        {packedQty === "" ? "—" : missingQty}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </section>
                        );
                    })}
                </div>
            </div>
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--admin-line)] bg-[color:var(--admin-surface)]/96 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur md:left-60 md:px-8">
                <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-medium">
                            {completedLineCount} av {order.lines.length} varelinjer registrerte
                        </p>
                        <p className="mt-0.5 text-xs text-[color:var(--admin-muted)]">
                            {savingPacking ? "Lagrar endringar …" : hasChanges ? "Ventar på automatisk lagring …" : "Alle endringar er lagra"}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={completePacking}
                        disabled={!canCompletePacking || savingPacking}
                        className="rounded-full bg-[color:var(--admin-accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--admin-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {savingPacking
                            ? "Fullfører …"
                            : order.packingInventoryRevision > 0
                                ? "Oppdater pakking og lager"
                                : "Fullfør pakking"}
                    </button>
                </div>
            </div>
        </main>
    );
}
