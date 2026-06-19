

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

type PickupBatchLine = {
    productId: string;
    productName: string;
    variantId: string;
    variantLabel: string;
    quantity: number;
    unitPrice: number;
    totalExVat?: number;
};

type PickupBatchDateGroup = {
    dateLabel: string;
    pickedUpByNames?: string[];
    lines: PickupBatchLine[];
    totalExVat: number;
    unitCount: number;
};

type PickupInvoiceBatch = {
    id: string;
    customerId: string;
    customerDisplayName: string;
    customerCompanyName: string;
    invoiceNumber: string;
    invoiceDateLabel: string;
    dateGroups: PickupBatchDateGroup[];
    unitCount: number;
    totalExVat: number;
};

function formatCurrency(value: number) {
    return new Intl.NumberFormat("nb-NO", {
        style: "currency",
        currency: "NOK",
        maximumFractionDigits: 2,
    }).format(value);
}

function formatDate(value: any) {
    if (value?.toDate) {
        return value.toDate().toLocaleDateString("nb-NO");
    }

    return "—";
}

function mapBatch(id: string, data: any): PickupInvoiceBatch {
    const customerCompanyName =
        typeof data.customerCompanyName === "string" && data.customerCompanyName.trim()
            ? data.customerCompanyName
            : "Ukjend kunde";

    const customerDisplayName =
        typeof data.customerDisplayName === "string" && data.customerDisplayName.trim()
            ? data.customerDisplayName
            : customerCompanyName;

    return {
        id,
        customerId: typeof data.customerId === "string" ? data.customerId : "",
        customerDisplayName,
        customerCompanyName,
        invoiceNumber: typeof data.invoiceNumber === "string" ? data.invoiceNumber : "",
        invoiceDateLabel: formatDate(data.invoiceDate || data.createdAt),
        dateGroups: Array.isArray(data.dateGroups) ? data.dateGroups : [],
        unitCount: typeof data.unitCount === "number" ? data.unitCount : 0,
        totalExVat: typeof data.totalExVat === "number" ? data.totalExVat : 0,
    };
}

export default function PickupHistoryPage() {
    const [batches, setBatches] = useState<PickupInvoiceBatch[]>([]);
    const [searchText, setSearchText] = useState("");
    const [openBatches, setOpenBatches] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const batchesQuery = query(collection(db, "pickupInvoiceBatches"));

        const unsubscribe = onSnapshot(batchesQuery, (snapshot) => {
            setBatches(
                snapshot.docs
                    .map((batchDoc) => mapBatch(batchDoc.id, batchDoc.data()))
                    .sort((a, b) => b.invoiceDateLabel.localeCompare(a.invoiceDateLabel))
            );
        });

        return () => unsubscribe();
    }, []);

    const filteredBatches = useMemo(() => {
        const q = searchText.trim().toLowerCase();
        if (!q) return batches;

        return batches.filter((batch) => {
            const searchableText = [
                batch.customerDisplayName,
                batch.customerCompanyName,
                batch.invoiceNumber,
                batch.invoiceDateLabel,
                ...batch.dateGroups.flatMap((dateGroup) => [
                    dateGroup.dateLabel,
                    ...(dateGroup.pickedUpByNames || []),
                    ...dateGroup.lines.map((line) => `${line.productName} ${line.variantLabel}`),
                ]),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchableText.includes(q);
        });
    }, [batches, searchText]);

    const totalExVat = filteredBatches.reduce((sum, batch) => sum + batch.totalExVat, 0);
    const unitCount = filteredBatches.reduce((sum, batch) => sum + batch.unitCount, 0);

    function toggleBatch(batchId: string) {
        setOpenBatches((current) => ({
            ...current,
            [batchId]: !current[batchId],
        }));
    }

    return (
        <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
            <div className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-10">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                            Hentehistorikk
                        </div>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                            Fakturerte hentingar
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                            Samla fakturagrunnlag frå hentingar som er merkte som fakturerte.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/admin/pickups"
                            className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                        >
                            Faktureringsliste
                        </Link>
                        <Link
                            href="/admin"
                            className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
                        >
                            Til admin
                        </Link>
                    </div>
                </div>

                <section className="mt-6 rounded-[24px] border border-neutral-200 bg-white p-5 md:p-6">
                    <div className="grid gap-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                        <label className="block">
                            <span className="sr-only">Søk</span>
                            <input
                                type="search"
                                value={searchText}
                                onChange={(event) => setSearchText(event.target.value)}
                                className="w-full rounded-full border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:border-neutral-700"
                                placeholder="Søk etter kunde, dato, vare eller fakturanummer"
                            />
                        </label>

                        <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
                            <div className="text-xs text-neutral-500">Faktureringar</div>
                            <div className="font-semibold">{filteredBatches.length}</div>
                        </div>

                        <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
                            <div className="text-xs text-neutral-500">Antal</div>
                            <div className="font-semibold">{unitCount}</div>
                        </div>

                        <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
                            <div className="text-xs text-neutral-500">Sum eks. mva.</div>
                            <div className="font-semibold">{formatCurrency(totalExVat)}</div>
                        </div>
                    </div>
                </section>

                <div className="mt-6 space-y-4">
                    {filteredBatches.length ? (
                        filteredBatches.map((batch) => {
                            const isOpen = openBatches[batch.id] ?? false;

                            return (
                                <section
                                    key={batch.id}
                                    className="rounded-[24px] border border-neutral-200 bg-white p-5 md:p-6"
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleBatch(batch.id)}
                                        className="flex w-full flex-col gap-4 text-left md:flex-row md:items-start md:justify-between"
                                    >
                                        <div>
                                            <h2 className="text-xl font-semibold tracking-tight">
                                                {batch.customerDisplayName}
                                            </h2>
                                            {batch.customerDisplayName !== batch.customerCompanyName ? (
                                                <p className="mt-1 text-sm text-neutral-500">
                                                    Fakturert til: {batch.customerCompanyName}
                                                </p>
                                            ) : null}
                                            <p className="mt-2 text-sm text-neutral-500">
                                                Fakturert {batch.invoiceDateLabel} · {batch.unitCount} einingar · {formatCurrency(batch.totalExVat)} eks. mva.
                                            </p>
                                            <p className="mt-2 text-xs font-medium text-neutral-500">
                                                {isOpen ? "Skjul detaljar ▲" : "Vis detaljar ▼"}
                                            </p>
                                        </div>

                                        {batch.invoiceNumber ? (
                                            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-600">
                                                Faktura {batch.invoiceNumber}
                                            </span>
                                        ) : null}
                                    </button>

                                    {isOpen ? (
                                        <div className="mt-5 overflow-x-auto rounded-[18px] border border-neutral-200">
                                            <table className="w-full min-w-[760px] text-left text-sm">
                                                <thead className="bg-neutral-50 text-neutral-600">
                                                    <tr>
                                                        <th className="px-4 py-3 font-medium">Dato henta</th>
                                                        <th className="px-4 py-3 font-medium">Henta av</th>
                                                        <th className="px-4 py-3 font-medium">Varer</th>
                                                        <th className="px-4 py-3 text-right font-medium">Sum eks. mva.</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-neutral-100">
                                                    {batch.dateGroups.map((dateGroup) => (
                                                        <tr key={`${batch.id}-${dateGroup.dateLabel}`}>
                                                            <td className="px-4 py-3 align-top text-neutral-700">
                                                                {dateGroup.dateLabel}
                                                            </td>
                                                            <td className="px-4 py-3 align-top text-neutral-700">
                                                                {dateGroup.pickedUpByNames?.length
                                                                    ? dateGroup.pickedUpByNames.join(", ")
                                                                    : "—"}
                                                            </td>
                                                            <td className="px-4 py-3 align-top">
                                                                <div className="space-y-1">
                                                                    {dateGroup.lines.map((line) => (
                                                                        <div key={`${batch.id}-${dateGroup.dateLabel}-${line.productId}-${line.variantId}-${line.unitPrice}`}>
                                                                            {line.quantity} × {line.productName} {line.variantLabel}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 align-top text-right font-medium text-neutral-900">
                                                                {formatCurrency(dateGroup.totalExVat)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : null}
                                </section>
                            );
                        })
                    ) : (
                        <section className="rounded-[24px] border border-dashed border-neutral-300 bg-white px-6 py-12 text-center text-sm text-neutral-500">
                            Ingen fakturerte hentingar funne.
                        </section>
                    )}
                </div>
            </div>
        </main>
    );
}