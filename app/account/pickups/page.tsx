

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type AccountCustomer = {
    id: string;
    companyName: string;
    displayName: string;
};

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

function mapCustomer(id: string, data: any): AccountCustomer {
    const companyName =
        typeof data.companyName === "string" && data.companyName.trim()
            ? data.companyName
            : typeof data.name === "string"
                ? data.name
                : "Kunde";

    const displayName =
        typeof data.displayName === "string" && data.displayName.trim()
            ? data.displayName
            : companyName;

    return {
        id,
        companyName,
        displayName,
    };
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

async function fetchCustomerForUser(user: User): Promise<AccountCustomer | null> {
    const snapshot = await getDocs(
        query(collection(db, "customers"), where("authUid", "==", user.uid))
    );

    const firstDoc = snapshot.docs[0];
    if (!firstDoc) return null;

    return mapCustomer(firstDoc.id, firstDoc.data());
}

async function fetchPickupBatchesForCustomer(customerId: string): Promise<PickupInvoiceBatch[]> {
    const snapshot = await getDocs(
        query(collection(db, "pickupInvoiceBatches"), where("customerId", "==", customerId))
    );

    return snapshot.docs
        .map((batchDoc) => mapBatch(batchDoc.id, batchDoc.data()))
        .sort((a, b) => b.invoiceDateLabel.localeCompare(a.invoiceDateLabel));
}

export default function AccountPickupsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [customer, setCustomer] = useState<AccountCustomer | null>(null);
    const [batches, setBatches] = useState<PickupInvoiceBatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [openBatches, setOpenBatches] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
            setUser(nextUser);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        async function loadData() {
            if (!user) {
                setCustomer(null);
                setBatches([]);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const nextCustomer = await fetchCustomerForUser(user);
                setCustomer(nextCustomer);

                if (!nextCustomer) {
                    setBatches([]);
                    return;
                }

                const nextBatches = await fetchPickupBatchesForCustomer(nextCustomer.id);
                setBatches(nextBatches);
            } catch (error) {
                console.error(error);
                setCustomer(null);
                setBatches([]);
            } finally {
                setLoading(false);
            }
        }

        void loadData();
    }, [user]);



    function toggleBatch(batchId: string) {
        setOpenBatches((current) => ({
            ...current,
            [batchId]: !current[batchId],
        }));
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-[#f7f5f1] px-5 py-10 text-neutral-900">
                <div className="mx-auto max-w-4xl rounded-[24px] border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
                    Lastar hentehistorikk …
                </div>
            </main>
        );
    }

    if (!user) {
        return (
            <main className="min-h-screen bg-[#f7f5f1] px-5 py-10 text-neutral-900">
                <div className="mx-auto max-w-4xl rounded-[24px] border border-neutral-200 bg-white p-6">
                    <h1 className="text-2xl font-semibold">Logg inn</h1>
                    <p className="mt-2 text-sm text-neutral-600">
                        Du må vere innlogga for å sjå hentehistorikk.
                    </p>
                    <Link
                        href="/account"
                        className="mt-5 inline-flex rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
                    >
                        Til mi side
                    </Link>
                </div>
            </main>
        );
    }

    if (!customer) {
        return (
            <main className="min-h-screen bg-[#f7f5f1] px-5 py-10 text-neutral-900">
                <div className="mx-auto max-w-4xl rounded-[24px] border border-neutral-200 bg-white p-6">
                    <h1 className="text-2xl font-semibold">Fann ikkje kundeprofil</h1>
                    <p className="mt-2 text-sm text-neutral-600">
                        Kontoen din er ikkje kopla til ein kundeprofil enno.
                    </p>
                    <Link
                        href="/account"
                        className="mt-5 inline-flex rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800"
                    >
                        Tilbake til mi side
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
            <div className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                            Hentehistorikk
                        </div>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                            Hentingar
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                            Oversikt over varer som er henta og fakturert samla.
                        </p>
                    </div>

                    <Link
                        href="/account"
                        className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
                    >
                        Til mi side
                    </Link>
                </div>

                <section className="mt-6 rounded-[24px] border border-neutral-200 bg-white p-5 md:p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-lg font-medium">{customer.displayName}</h2>
                            {customer.displayName !== customer.companyName ? (
                                <p className="mt-1 text-sm text-neutral-500">
                                    Fakturert til: {customer.companyName}
                                </p>
                            ) : null}
                        </div>

                        <div className="grid grid-cols-1 gap-2 text-sm">
                            <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3">
                                <div className="text-xs text-neutral-500">Faktureringar</div>
                                <div className="font-semibold">{batches.length}</div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="mt-6 space-y-4">
                    {batches.length ? (
                        batches.map((batch) => {
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
                                                Fakturert {batch.invoiceDateLabel}
                                            </h2>
                                            <p className="mt-2 text-sm text-neutral-500">
                                                {batch.unitCount} einingar · {formatCurrency(batch.totalExVat)} eks. mva.
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
                                            <table className="w-full min-w-[720px] text-left text-sm">
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