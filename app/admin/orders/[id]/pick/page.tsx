"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { groupOrderLinesByBrand, sortOrderLines } from "@/lib/orderLineSorting";

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
    };
}

function getLineKey(line: OrderLine) {
    return `${line.productId}-${line.variantId}`;
}


export default function OrderPickPage() {
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

            await updateDoc(doc(db, "orders", orderId), {
                "packing.lines": buildPackingLines(),
                "packing.updatedAt": serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            setHasChanges(false);
        } catch (error) {
            console.error(error);
            window.alert("Kunne ikkje lagre plukklista.");
        } finally {
            setSavingPacking(false);
        }
    }

    async function completePacking() {
        if (!orderId || !order || !canCompletePacking) return;

        try {
            setSavingPacking(true);

            const nextStatus = hasMissingProducts ? "partial" : "packed";

            await updateDoc(doc(db, "orders", orderId), {
                status: nextStatus,
                "packing.lines": buildPackingLines(),
                "packing.status": hasMissingProducts ? "partial" : "complete",
                "packing.completedAt": serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            router.push(`/admin/orders/${orderId}`);
        } catch (error) {
            console.error(error);
            window.alert("Kunne ikkje fullføre pakkinga.");
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
        return value > 0 && value < line.quantity;
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
        <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
            <div className="mx-auto max-w-5xl px-6 py-10">
                <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-sm text-neutral-600 underline-offset-4 hover:underline"
                >
                    ← Tilbake til ordre
                </Link>

                <div className="mt-6 rounded-[24px] border border-neutral-200 bg-white p-6">
                    <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                        Plukkliste
                    </p>

                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">
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
                        <span>{completedLineCount} av {order.lines.length} linjer registrerte</span>
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
                </div>

                <div className="mt-6 rounded-[24px] border border-neutral-200 bg-white p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="font-medium">Automatisk ordrestatus</h2>
                            <p className="mt-1 text-sm text-neutral-500">
                                Når alle linjer er registrerte vil ordren bli sett til Pakka eller Delpakka.
                            </p>
                        </div>

                        <div className="text-right">
                            <div className="text-xs uppercase tracking-[0.12em] text-neutral-500">
                                Ny status
                            </div>
                            <div className="mt-1 text-lg font-semibold">
                                {packingResultStatus}
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 flex flex-col gap-3 border-t border-neutral-200 pt-5 md:flex-row md:items-center md:justify-between">
                        <p className="text-sm text-neutral-500">
                            Pakking blir lagra automatisk. Status blir først endra når pakking blir fullført.
                        </p>

                        <div className="flex items-center gap-3">
                            <div className="text-sm text-neutral-500">
                                {savingPacking
                                    ? "Lagrar …"
                                    : hasChanges
                                        ? "Ventar på lagring …"
                                        : "Alle endringar lagra"}
                            </div>
                            <button
                                type="button"
                                onClick={completePacking}
                                disabled={!canCompletePacking || savingPacking}
                                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {savingPacking ? "Fullfører …" : "Fullfør pakking"}
                            </button>
                        </div>
                    </div>
                </div>

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
                                            className="rounded-[24px] border border-neutral-200 bg-white p-6"
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

                                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-sm transition hover:bg-neutral-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={isFullyPacked}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;

                                                            setFullyPacked((prev) => ({
                                                                ...prev,
                                                                [key]: checked,
                                                            }));

                                                            setPacked((prev) => ({
                                                                ...prev,
                                                                [key]: checked ? line.quantity : "",
                                                            }));
                                                            setHasChanges(true);
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
                                                    <div className="mt-1 text-xl font-medium">
                                                        {line.quantity}
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="text-xs uppercase tracking-[0.12em] text-neutral-500">
                                                        Pakka
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={packedQty}
                                                        placeholder="—"
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            const nextValue = value === "" ? "" : Math.max(0, Math.floor(Number(value) || 0));

                                                            setPacked((prev) => ({
                                                                ...prev,
                                                                [key]: nextValue,
                                                            }));

                                                            setFullyPacked((prev) => ({
                                                                ...prev,
                                                                [key]: nextValue === line.quantity,
                                                            }));
                                                            setHasChanges(true);
                                                        }}
                                                        className="mt-1 w-24 rounded-[12px] border border-neutral-200 px-3 py-2 outline-none [appearance:textfield] focus:border-neutral-800 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                    />
                                                </div>

                                                <div>
                                                    <div className="text-xs uppercase tracking-[0.12em] text-neutral-500">
                                                        Manglar
                                                    </div>
                                                    <div className={
                                                        "mt-1 text-xl font-medium " +
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
        </main>
    );
}