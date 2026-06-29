

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CustomerType } from "@/lib/customersFirestore";
import ProductOrderPicker, { type ProductOrderLine } from "../../../components/admin/ProductOrderPicker";

type PickupCustomer = {
    id: string;
    companyName: string;
    displayName: string;
    sameAsCompanyName: boolean;
    customerType: CustomerType;
    customerSource: "registered" | "manual";
    authUid: string;
    email: string;
    phone: string;
};

function customerTypeLabel(type: CustomerType) {
    return type === "grossist" ? "Grossist" : "Retail";
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("nb-NO", {
        style: "currency",
        currency: "NOK",
        maximumFractionDigits: 2,
    }).format(value);
}

function mapCustomer(id: string, data: any): PickupCustomer {
    const companyName = typeof data.companyName === "string" ? data.companyName : "";
    const displayName =
        typeof data.displayName === "string" && data.displayName.trim()
            ? data.displayName
            : companyName;

    return {
        id,
        companyName,
        displayName,
        sameAsCompanyName:
            typeof data.sameAsCompanyName === "boolean"
                ? data.sameAsCompanyName
                : displayName === companyName,
        customerType: data.customerType === "grossist" ? "grossist" : "retail",
        customerSource: data.customerSource === "manual" ? "manual" : "registered",
        authUid: typeof data.authUid === "string" ? data.authUid : "",
        email: typeof data.email === "string" ? data.email : "",
        phone: typeof data.phone === "string" ? data.phone : "",
    };
}

export default function NewPickupPage() {
    const router = useRouter();

    const [customers, setCustomers] = useState<PickupCustomer[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [customerSearch, setCustomerSearch] = useState("");
    const [selectedCustomerId, setSelectedCustomerId] = useState("");

    const [manualCustomerName, setManualCustomerName] = useState("");
    const [manualDisplayName, setManualDisplayName] = useState("");
    const [manualSameAsCompanyName, setManualSameAsCompanyName] = useState(true);
    const [manualCustomerType, setManualCustomerType] = useState<CustomerType>("retail");
    const [manualContactName, setManualContactName] = useState("");
    const [manualEmail, setManualEmail] = useState("");
    const [manualPhone, setManualPhone] = useState("");
    const [manualOrganizationNumber, setManualOrganizationNumber] = useState("");

    const [pickedUpBy, setPickedUpBy] = useState("");
    const [lines, setLines] = useState<ProductOrderLine[]>([]);
    const [saving, setSaving] = useState(false);
    const [pickupDate, setPickupDate] = useState(() => {
        const today = new Date();
        return today.toISOString().slice(0, 10);
    });

    useEffect(() => {
        async function loadCustomers() {
            try {
                const snapshot = await getDocs(
                    query(collection(db, "customers"), orderBy("companyName", "asc"))
                );

                setCustomers(snapshot.docs.map((customerDoc) => mapCustomer(customerDoc.id, customerDoc.data())));
            } catch (error) {
                console.error("Failed to load customers", error);
            } finally {
                setLoadingCustomers(false);
            }
        }

        void loadCustomers();
    }, []);

    const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) || null;
    const activeCustomerType = selectedCustomer?.customerType || manualCustomerType;

    const filteredCustomers = useMemo(() => {
        const q = customerSearch.trim().toLowerCase();
        if (!q) return customers.slice(0, 12);

        return customers.filter((customer) => {
            const searchableText = [
                customer.companyName,
                customer.displayName,
                customer.email,
                customer.phone,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchableText.includes(q);
        });
    }, [customers, customerSearch]);

    const totalExVat = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const unitCount = lines.reduce((sum, line) => sum + line.quantity, 0);

    function updateManualSameAsCompanyName(value: boolean) {
        setManualSameAsCompanyName(value);
        if (value) {
            setManualDisplayName(manualCustomerName);
        }
    }

    async function ensureCustomerId() {
        if (selectedCustomer) return selectedCustomer.id;

        const companyName = manualCustomerName.trim();
        const displayName = manualSameAsCompanyName
            ? companyName
            : manualDisplayName.trim() || companyName;

        if (!companyName) {
            window.alert("Vel kunde eller skriv inn kundenamn.");
            return null;
        }

        const customerRef = await addDoc(collection(db, "customers"), {
            companyName,
            displayName,
            sameAsCompanyName: manualSameAsCompanyName,
            customerType: manualCustomerType,
            customerSource: "manual",
            authUid: "",
            email: manualEmail.trim(),
            phone: manualPhone.trim(),
            contactName: manualContactName.trim(),
            organizationNumber: manualOrganizationNumber.trim(),
            openingHours: "",
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        return customerRef.id;
    }

    async function savePickup() {
        if (!lines.length) {
            window.alert("Legg til minst éi vare før du lagrar henting.");
            return;
        }

        try {
            setSaving(true);
            const customerId = await ensureCustomerId();
            if (!customerId) return;

            const customer = selectedCustomer;
            const companyName = customer?.companyName || manualCustomerName.trim();
            const displayName = customer?.displayName || (manualSameAsCompanyName ? companyName : manualDisplayName.trim() || companyName);
            const customerType = customer?.customerType || manualCustomerType;
            const customerSource = customer?.customerSource || "manual";
            const authUid = customer?.authUid || "";

            const pickupDateValue = pickupDate
                ? new Date(`${pickupDate}T12:00:00`)
                : new Date();

            await addDoc(collection(db, "pickups"), {
                customerId,
                customerName: displayName,
                customerDisplayName: displayName,
                customerCompanyName: companyName,
                customerType,
                customerSource,
                authUid,
                pickedUpBy: pickedUpBy.trim(),
                pickupDate: pickupDateValue,
                lines,
                lineCount: lines.length,
                unitCount,
                totalExVat,
                invoiceStatus: "not_invoiced",
                source: "ipad",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            router.push("/admin/pickups");
        } catch (error) {
            console.error(error);
            window.alert("Kunne ikkje lagre henting.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
            <div className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-10">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                            Henting
                        </div>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                            Registrer henting
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                            For varer som blir henta i butikken og fakturert samla seinare.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/admin/pickups"
                            className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
                        >
                            ← Avbryt
                        </Link>

                        <Link
                            href="/admin"
                            className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
                        >
                            Til admin
                        </Link>
                    </div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.4fr_0.7fr]">
                    <section className="rounded-[24px] border border-neutral-200 bg-white p-5 md:p-6">
                        <h2 className="text-lg font-medium">Kunde</h2>
                        <p className="mt-1 text-sm text-neutral-500">
                            Vel frå kunderegisteret, eller opprett ein enkel manuell kunde.
                        </p>

                        <label className="mt-5 block text-sm font-medium text-neutral-800">
                            Søk kunde
                            <input
                                type="search"
                                value={customerSearch}
                                onChange={(event) => setCustomerSearch(event.target.value)}
                                className="mt-2 w-full rounded-[14px] border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-700"
                                placeholder="Firmanamn, butikk eller telefon"
                            />
                        </label>

                        <div className="mt-4 space-y-2">
                            {loadingCustomers ? (
                                <div className="rounded-[14px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                                    Lastar kundar …
                                </div>
                            ) : filteredCustomers.length ? (
                                filteredCustomers.map((customer) => {
                                    const selected = selectedCustomerId === customer.id;

                                    return (
                                        <button
                                            key={customer.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedCustomerId(customer.id);
                                                setManualCustomerName("");
                                                setManualDisplayName("");
                                                setManualContactName("");
                                                setManualEmail("");
                                                setManualPhone("");
                                                setManualOrganizationNumber("");
                                            }}
                                            className={`w-full rounded-[14px] border px-4 py-3 text-left transition ${selected
                                                ? "border-neutral-900 bg-neutral-900 text-white"
                                                : "border-neutral-200 bg-neutral-50 text-neutral-800 hover:bg-neutral-100"
                                                }`}
                                        >
                                            <div className="text-sm font-medium">
                                                {customer.displayName || customer.companyName}
                                            </div>
                                            {customer.displayName !== customer.companyName ? (
                                                <div className={`mt-1 text-xs ${selected ? "text-neutral-300" : "text-neutral-500"}`}>
                                                    Fakturerast til: {customer.companyName}
                                                </div>
                                            ) : null}
                                            <div className={`mt-1 text-xs ${selected ? "text-neutral-300" : "text-neutral-500"}`}>
                                                {customerTypeLabel(customer.customerType)} · {customer.customerSource === "manual" || !customer.authUid ? "Manuell" : "Kundekonto"}
                                            </div>
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="rounded-[14px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                                    Ingen kunde funne. Opprett enkel kunde under.
                                </div>
                            )}
                        </div>

                        <div className="mt-6 border-t border-neutral-200 pt-5">
                            <div className="text-sm font-medium text-neutral-900">Ny manuell kunde</div>
                            <label className="mt-3 block text-sm font-medium text-neutral-800">
                                Firmanamn / fakturanamn
                                <input
                                    value={manualCustomerName}
                                    onChange={(event) => {
                                        setManualCustomerName(event.target.value);
                                        if (manualSameAsCompanyName) {
                                            setManualDisplayName(event.target.value);
                                        }
                                        setSelectedCustomerId("");
                                        setCustomerSearch("");
                                    }}
                                    className="mt-2 w-full rounded-[14px] border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-700"
                                    placeholder="Til dømes Valldal Fjordhotell"
                                />
                            </label>

                            <label className="mt-3 flex items-center gap-2 text-sm text-neutral-700">
                                <input
                                    type="checkbox"
                                    checked={manualSameAsCompanyName}
                                    onChange={(event) => updateManualSameAsCompanyName(event.target.checked)}
                                />
                                Visningsnamn er same som fakturanamn
                            </label>

                            {!manualSameAsCompanyName ? (
                                <label className="mt-3 block text-sm font-medium text-neutral-800">
                                    Visningsnamn
                                    <input
                                        value={manualDisplayName}
                                        onChange={(event) => setManualDisplayName(event.target.value)}
                                        className="mt-2 w-full rounded-[14px] border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-700"
                                        placeholder="Til dømes Fjordhotellet"
                                    />
                                </label>
                            ) : null}

                            <label className="mt-3 block text-sm font-medium text-neutral-800">
                                Kontaktperson
                                <input
                                    value={manualContactName}
                                    onChange={(event) => setManualContactName(event.target.value)}
                                    className="mt-2 w-full rounded-[14px] border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-700"
                                    placeholder="Til dømes Kari Nordmann"
                                />
                            </label>

                            <label className="mt-3 block text-sm font-medium text-neutral-800">
                                E-post
                                <input
                                    type="email"
                                    value={manualEmail}
                                    onChange={(event) => setManualEmail(event.target.value)}
                                    className="mt-2 w-full rounded-[14px] border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-700"
                                    placeholder="post@kunde.no"
                                />
                            </label>

                            <label className="mt-3 block text-sm font-medium text-neutral-800">
                                Telefon
                                <input
                                    value={manualPhone}
                                    onChange={(event) => setManualPhone(event.target.value)}
                                    className="mt-2 w-full rounded-[14px] border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-700"
                                    placeholder="Telefonnummer"
                                />
                            </label>

                            <label className="mt-3 block text-sm font-medium text-neutral-800">
                                Organisasjonsnummer
                                <input
                                    value={manualOrganizationNumber}
                                    onChange={(event) => setManualOrganizationNumber(event.target.value)}
                                    className="mt-2 w-full rounded-[14px] border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-700"
                                    placeholder="Valfritt"
                                />
                            </label>

                            <label className="mt-3 block text-sm font-medium text-neutral-800">
                                Prisgruppe
                                <select
                                    value={manualCustomerType}
                                    onChange={(event) => setManualCustomerType(event.target.value as CustomerType)}
                                    className="mt-2 w-full rounded-[14px] border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-700"
                                >
                                    <option value="grossist">Grossist</option>
                                    <option value="retail">Retail</option>
                                </select>
                            </label>
                        </div>
                    </section>

                    <ProductOrderPicker
                        customerId={selectedCustomerId || undefined}
                        customerType={activeCustomerType}
                        mode="pickup"
                        lines={lines}
                        onChange={setLines}
                        title="Varer"
                        description="Søk opp varer som kunden tek med seg no."
                        showProductsBeforeSearch={false}
                    />

                    <aside className="space-y-6">
                        <section className="rounded-[24px] border border-neutral-200 bg-white p-5 md:p-6">
                            <h2 className="text-lg font-medium">Henting</h2>

                            <label className="mt-4 block text-sm font-medium text-neutral-800">
                                Dato
                                <input
                                    type="date"
                                    value={pickupDate}
                                    onChange={(event) => setPickupDate(event.target.value)}
                                    className="mt-2 w-full rounded-[14px] border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-700"
                                />
                            </label>

                            <label className="mt-4 block text-sm font-medium text-neutral-800">
                                Henta av <span className="font-normal text-neutral-400">(valfritt)</span>
                                <input
                                    value={pickedUpBy}
                                    onChange={(event) => setPickedUpBy(event.target.value)}
                                    className="mt-2 w-full rounded-[14px] border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-700"
                                    placeholder="Namn på den som hentar"
                                />
                            </label>

                            <div className="mt-5">
                                <div className="mb-2 text-sm font-medium text-neutral-900">
                                    Handlekorg
                                </div>

                                <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 p-4">
                                    {lines.length ? (
                                        <div className="space-y-2 text-sm">
                                            {lines.map((line) => (
                                                <div
                                                    key={`${line.productId}-${line.variantId}`}
                                                    className="flex items-start justify-between gap-3"
                                                >
                                                    <div>
                                                        <div className="font-medium text-neutral-900">
                                                            {line.productName}
                                                        </div>
                                                        <div className="text-xs text-neutral-500">
                                                            {line.variantLabel}
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <div className="font-medium text-neutral-900">
                                                            {line.quantity} stk
                                                        </div>
                                                        <div className="text-xs text-neutral-500">
                                                            {formatCurrency(line.quantity * line.unitPrice)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-neutral-500">
                                            Ingen varer lagt til enno.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-5 rounded-[16px] border border-neutral-200 bg-neutral-50 p-4 text-sm">
                                <div className="flex justify-between gap-4">
                                    <span className="text-neutral-500">Ulike varer</span>
                                    <span className="font-medium">{lines.length}</span>
                                </div>
                                <div className="mt-2 flex justify-between gap-4">
                                    <span className="text-neutral-500">Antal</span>
                                    <span className="font-medium">{unitCount}</span>
                                </div>
                                <div className="mt-2 flex justify-between gap-4 border-t border-neutral-200 pt-3">
                                    <span className="text-neutral-500">Sum eks. mva.</span>
                                    <span className="font-semibold">{formatCurrency(totalExVat)}</span>
                                </div>
                            </div>

                            <div className="mt-5 grid gap-2">
                                <button
                                    type="button"
                                    onClick={savePickup}
                                    disabled={saving || !lines.length}
                                    className="w-full rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {saving ? "Lagrar …" : "Lagre henting"}
                                </button>

                                <Link
                                    href="/admin/pickups"
                                    className="inline-flex w-full items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
                                >
                                    Avbryt
                                </Link>
                            </div>

                            <p className="mt-3 text-xs leading-5 text-neutral-500">
                                Hentinga blir lagt på faktureringslista og kan fakturerast samla seinare.
                            </p>
                        </section>
                    </aside>
                </div>
            </div>
        </main>
    );
}