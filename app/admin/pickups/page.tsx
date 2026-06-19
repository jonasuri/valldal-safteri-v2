

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

type PickupLine = {
    productId: string;
    productName: string;
    variantId: string;
    variantLabel: string;
    brand: "safteri" | "bryggeri";
    quantity: number;
    unitPrice: number;
};

type PickupRow = {
    id: string;
    customerId: string;
    customerName: string;
    customerDisplayName: string;
    customerCompanyName: string;
    pickedUpBy: string;
    pickupDateLabel: string;
    lines: PickupLine[];
    lineCount: number;
    unitCount: number;
    totalExVat: number;
};

type CustomerPickupGroup = {
    customerId: string;
    customerDisplayName: string;
    customerCompanyName: string;
    pickups: PickupRow[];
    totalExVat: number;
    unitCount: number;
};

type PickupDateLine = PickupLine & {
    totalExVat: number;
};

type PickupDateGroup = {
    dateLabel: string;
    pickedUpByNames: string[];
    lines: PickupDateLine[];
    totalExVat: number;
    unitCount: number;
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

function mapPickup(id: string, data: any): PickupRow {
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
        customerId: typeof data.customerId === "string" ? data.customerId : "",
        customerName: customerDisplayName,
        customerDisplayName,
        customerCompanyName,
        pickedUpBy: typeof data.pickedUpBy === "string" ? data.pickedUpBy : "",
        pickupDateLabel: formatDate(data.pickupDate || data.createdAt),
        lines: Array.isArray(data.lines) ? data.lines : [],
        lineCount: typeof data.lineCount === "number" ? data.lineCount : 0,
        unitCount: typeof data.unitCount === "number" ? data.unitCount : 0,
        totalExVat: typeof data.totalExVat === "number" ? data.totalExVat : 0,
    };
}

function groupPickupsByCustomer(pickups: PickupRow[]): CustomerPickupGroup[] {
    const groups = new Map<string, CustomerPickupGroup>();

    for (const pickup of pickups) {
        const key = pickup.customerId || pickup.customerCompanyName;
        const existing = groups.get(key);

        if (existing) {
            existing.pickups.push(pickup);
            existing.totalExVat += pickup.totalExVat;
            existing.unitCount += pickup.unitCount;
        } else {
            groups.set(key, {
                customerId: pickup.customerId,
                customerDisplayName: pickup.customerDisplayName,
                customerCompanyName: pickup.customerCompanyName,
                pickups: [pickup],
                totalExVat: pickup.totalExVat,
                unitCount: pickup.unitCount,
            });
        }
    }

    return Array.from(groups.values()).sort((a, b) =>
        a.customerDisplayName.localeCompare(b.customerDisplayName, "nb")
    );
}

function groupPickupsByDate(pickups: PickupRow[]): PickupDateGroup[] {
    const groups = new Map<string, PickupDateGroup>();

    for (const pickup of pickups) {
        const dateLabel = pickup.pickupDateLabel || "—";
        const existingDateGroup = groups.get(dateLabel);
        const group = existingDateGroup || {
            dateLabel,
            pickedUpByNames: [],
            lines: [],
            totalExVat: 0,
            unitCount: 0,
        };

        if (pickup.pickedUpBy && !group.pickedUpByNames.includes(pickup.pickedUpBy)) {
            group.pickedUpByNames.push(pickup.pickedUpBy);
        }

        for (const line of pickup.lines) {
            const existingLine = group.lines.find(
                (groupLine) =>
                    groupLine.productId === line.productId &&
                    groupLine.variantId === line.variantId &&
                    groupLine.unitPrice === line.unitPrice
            );

            if (existingLine) {
                existingLine.quantity += line.quantity;
                existingLine.totalExVat += line.quantity * line.unitPrice;
            } else {
                group.lines.push({
                    ...line,
                    totalExVat: line.quantity * line.unitPrice,
                });
            }

            group.unitCount += line.quantity;
            group.totalExVat += line.quantity * line.unitPrice;
        }

        groups.set(dateLabel, group);
    }

    return Array.from(groups.values()).sort((a, b) =>
        a.dateLabel.localeCompare(b.dateLabel, "nb")
    );
}

export default function AdminPickupsPage() {
    const [pickups, setPickups] = useState<PickupRow[]>([]);
    const [searchText, setSearchText] = useState("");
    const [savingCustomerId, setSavingCustomerId] = useState<string | null>(null);
    const [openCustomers, setOpenCustomers] = useState<Record<string, boolean>>({});
    const [confirmInvoiceGroup, setConfirmInvoiceGroup] = useState<CustomerPickupGroup | null>(null);

    useEffect(() => {
        const pickupsQuery = query(
            collection(db, "pickups"),
            where("invoiceStatus", "==", "not_invoiced")
        );

        const unsubscribe = onSnapshot(pickupsQuery, (snapshot) => {
            setPickups(
                snapshot.docs.map((pickupDoc) =>
                    mapPickup(pickupDoc.id, pickupDoc.data())
                )
            );
        });

        return () => unsubscribe();
    }, []);

    const filteredPickups = useMemo(() => {
        const q = searchText.trim().toLowerCase();
        if (!q) return pickups;

        return pickups.filter((pickup) => {
            const searchableText = [
                pickup.customerDisplayName,
                pickup.customerCompanyName,
                pickup.pickedUpBy,
                ...pickup.lines.map((line) => `${line.productName} ${line.variantLabel}`),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchableText.includes(q);
        });
    }, [pickups, searchText]);

    const customerGroups = useMemo(
        () => groupPickupsByCustomer(filteredPickups),
        [filteredPickups]
    );

    const totalExVat = filteredPickups.reduce((sum, pickup) => sum + pickup.totalExVat, 0);
    const unitCount = filteredPickups.reduce((sum, pickup) => sum + pickup.unitCount, 0);

    function toggleCustomer(customerKey: string) {
        setOpenCustomers((current) => ({
            ...current,
            [customerKey]: !current[customerKey],
        }));
    }

    async function markCustomerPickupsInvoiced(group: CustomerPickupGroup) {
        try {
            const customerKey = group.customerId || group.customerCompanyName;
            setSavingCustomerId(customerKey);

            const batchRef = await addDoc(collection(db, "pickupInvoiceBatches"), {
                customerId: group.customerId,
                customerDisplayName: group.customerDisplayName,
                customerCompanyName: group.customerCompanyName,
                pickupIds: group.pickups.map((pickup) => pickup.id),
                pickups: group.pickups.map((pickup) => ({
                    id: pickup.id,
                    pickedUpBy: pickup.pickedUpBy,
                    pickupDateLabel: pickup.pickupDateLabel,
                    lines: pickup.lines,
                    lineCount: pickup.lineCount,
                    unitCount: pickup.unitCount,
                    totalExVat: pickup.totalExVat,
                })),
                dateGroups: groupPickupsByDate(group.pickups),
                unitCount: group.unitCount,
                totalExVat: group.totalExVat,
                invoiceNumber: "",
                invoiceStatus: "invoiced",
                invoiceDate: serverTimestamp(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            await Promise.all(
                group.pickups.map((pickup) =>
                    updateDoc(doc(db, "pickups", pickup.id), {
                        invoiceStatus: "invoiced",
                        invoiceBatchId: batchRef.id,
                        invoicedAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    })
                )
            );
            setConfirmInvoiceGroup(null);
        } catch (error) {
            console.error(error);
            window.alert("Kunne ikkje merke hentingane som fakturerte.");
        } finally {
            setSavingCustomerId(null);
        }
    }

    return (
        <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
            {confirmInvoiceGroup ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
                    <div className="w-full max-w-md rounded-[24px] border border-neutral-200 bg-white p-6 shadow-xl">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                            Stadfest fakturering
                        </div>

                        <h2 className="mt-2 text-xl font-semibold tracking-tight text-neutral-950">
                            Merk hentingar som fakturert?
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-neutral-600">
                            {confirmInvoiceGroup.customerDisplayName} har {confirmInvoiceGroup.pickups.length} hentingar med totalt {confirmInvoiceGroup.unitCount} einingar og {formatCurrency(confirmInvoiceGroup.totalExVat)} eks. mva.
                        </p>

                        <p className="mt-3 text-sm leading-6 text-neutral-600">
                            Det blir oppretta eit samla historikkpunkt, og hentingane blir fjerna frå faktureringslista.
                        </p>

                        <div className="mt-6 grid gap-2 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setConfirmInvoiceGroup(null)}
                                disabled={savingCustomerId !== null}
                                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50"
                            >
                                Avbryt
                            </button>

                            <button
                                type="button"
                                onClick={() => markCustomerPickupsInvoiced(confirmInvoiceGroup)}
                                disabled={savingCustomerId !== null}
                                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
                            >
                                {savingCustomerId !== null ? "Lagrar …" : "Merk som fakturert"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            <div className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-10">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                            Hentingar
                        </div>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                            Fakturering av hentingar
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                            Hentingar som er registrerte i butikken og ventar på fakturering, gruppert per kunde.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/admin/pickups/new"
                            className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                        >
                            Ny henting
                        </Link>
                        <Link
                            href="/admin/pickups/history"
                            className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
                        >
                            Historikk
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
                                placeholder="Søk etter kunde, henta av eller vare"
                            />
                        </label>

                        <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
                            <div className="text-xs text-neutral-500">Kundar</div>
                            <div className="font-semibold">{customerGroups.length}</div>
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

                <div className="mt-6 space-y-6">
                    {customerGroups.length ? (
                        customerGroups.map((group) => {
                            const customerKey = group.customerId || group.customerCompanyName;
                            const saving = savingCustomerId === customerKey;
                            const isOpen = openCustomers[customerKey] ?? false;
                            const dateGroups = groupPickupsByDate(group.pickups);

                            return (
                                <section
                                    key={customerKey}
                                    className="rounded-[24px] border border-neutral-200 bg-white p-5 md:p-6"
                                >
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                            <button
                                                type="button"
                                                onClick={() => toggleCustomer(customerKey)}
                                                className="text-left"
                                            >
                                                <h2 className="text-xl font-semibold tracking-tight">
                                                    {group.customerDisplayName}
                                                </h2>
                                                {group.customerDisplayName !== group.customerCompanyName ? (
                                                    <p className="mt-1 text-sm text-neutral-500">
                                                        Fakturerast til: {group.customerCompanyName}
                                                    </p>
                                                ) : null}
                                                <p className="mt-2 text-sm text-neutral-500">
                                                    {group.pickups.length} hentingar · {group.unitCount} einingar · {formatCurrency(group.totalExVat)} eks. mva.
                                                </p>
                                                <p className="mt-2 text-xs font-medium text-neutral-500">
                                                    {isOpen ? "Skjul detaljar ▲" : "Vis detaljar ▼"}
                                                </p>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setConfirmInvoiceGroup(group)}
                                                disabled={saving}
                                                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
                                            >
                                                {saving ? "Lagrar …" : "Merk kunden som fakturert"}
                                            </button>
                                        </div>
                                    </div>

                                    {isOpen ? (
                                        <div className="mt-5 overflow-x-auto rounded-[18px] border border-neutral-200">
                                            <table className="w-full min-w-[760px] text-left text-sm">
                                                <thead className="bg-neutral-50 text-neutral-600">
                                                    <tr>
                                                        <th className="px-4 py-3 font-medium">Dato</th>
                                                        <th className="px-4 py-3 font-medium">Henta av</th>
                                                        <th className="px-4 py-3 font-medium">Varer samla per dato</th>
                                                        <th className="px-4 py-3 text-right font-medium">Sum eks. mva.</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-neutral-100">
                                                    {dateGroups.map((dateGroup) => (
                                                        <tr key={dateGroup.dateLabel}>
                                                            <td className="px-4 py-3 align-top text-neutral-700">
                                                                {dateGroup.dateLabel}
                                                            </td>
                                                            <td className="px-4 py-3 align-top text-neutral-700">
                                                                {dateGroup.pickedUpByNames.length
                                                                    ? dateGroup.pickedUpByNames.join(", ")
                                                                    : "—"}
                                                            </td>
                                                            <td className="px-4 py-3 align-top">
                                                                <div className="space-y-1">
                                                                    {dateGroup.lines.map((line) => (
                                                                        <div key={`${dateGroup.dateLabel}-${line.productId}-${line.variantId}-${line.unitPrice}`} className="text-neutral-800">
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
                            Ingen hentingar ventar på fakturering.
                        </section>
                    )}
                </div>
            </div>
        </main>
    );
}