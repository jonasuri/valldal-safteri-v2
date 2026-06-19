

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    createCustomer,
    listenToCustomers,
    type AdminCustomerRow,
    type CustomerType,
} from "@/lib/customersFirestore";

type CustomerForm = {
    companyName: string;
    displayName: string;
    sameAsCompanyName: boolean;
    contactName: string;
    email: string;
    phone: string;
    organizationNumber: string;
    openingHours: string;
    authUid: string;
    customerType: CustomerType;
    active: boolean;
    profileCompleted: boolean;
};

const emptyForm: CustomerForm = {
    companyName: "",
    displayName: "",
    sameAsCompanyName: true,
    contactName: "",
    email: "",
    phone: "",
    organizationNumber: "",
    openingHours: "",
    authUid: "",
    customerType: "retail",
    active: true,
    profileCompleted: false,
};

function customerTypeLabel(type: CustomerType) {
    return type === "grossist" ? "Grossist" : "Retail";
}

export default function AdminCustomersPage() {
    const [customers, setCustomers] = useState<AdminCustomerRow[]>([]);
    const [form, setForm] = useState<CustomerForm>(emptyForm);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [queryText, setQueryText] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        setLoading(true);
        setError("");

        const unsubscribe = listenToCustomers((nextCustomers) => {
            setCustomers(nextCustomers);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const filteredCustomers = useMemo(() => {
        const q = queryText.trim().toLowerCase();
        if (!q) return customers;

        return customers.filter((customer) => {
            return (
                customer.companyName.toLowerCase().includes(q) ||
                customer.contactName.toLowerCase().includes(q) ||
                customer.email.toLowerCase().includes(q) ||
                customer.phone.toLowerCase().includes(q)
            );
        });
    }, [customers, queryText]);

    const customerProfiles = useMemo(
        () => filteredCustomers.filter((customer) => customer.customerSource !== "manual" && Boolean(customer.authUid)),
        [filteredCustomers]
    );

    const manualCustomers = useMemo(
        () => filteredCustomers.filter((customer) => customer.customerSource === "manual" || !customer.authUid),
        [filteredCustomers]
    );

    function updateForm<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) {
        setForm((prev) => {
            if (key === "companyName") {
                const companyName = String(value);
                return {
                    ...prev,
                    companyName,
                    displayName: prev.sameAsCompanyName ? companyName : prev.displayName,
                };
            }

            if (key === "sameAsCompanyName") {
                const sameAsCompanyName = Boolean(value);
                return {
                    ...prev,
                    sameAsCompanyName,
                    displayName: sameAsCompanyName ? prev.companyName : prev.displayName,
                };
            }

            return { ...prev, [key]: value };
        });
        setError("");
        setSuccess("");
    }

    async function handleCreateCustomer() {
        setError("");
        setSuccess("");

        const companyName = form.companyName.trim();
        const sameAsCompanyName = form.sameAsCompanyName;
        const displayName = sameAsCompanyName ? companyName : form.displayName.trim();
        const contactName = form.contactName.trim();
        const email = form.email.trim().toLowerCase();
        const phone = form.phone.trim();
        const organizationNumber = form.organizationNumber.trim();
        const openingHours = form.openingHours.trim();
        const authUid = form.authUid.trim();

        if (!email) {
            setError("E-post er påkravd.");
            return;
        }

        if (!displayName && !sameAsCompanyName) {
            setError("Visningsnamn må fyllast ut dersom det er ulikt firmanamn.");
            return;
        }

        setSaving(true);

        try {
            await createCustomer({
                companyName,
                displayName,
                sameAsCompanyName,
                contactName,
                email,
                phone,
                organizationNumber,
                openingHours,
                authUid,
                customerType: form.customerType,
                active: form.active,
                profileCompleted: Boolean(companyName && contactName && phone && organizationNumber),
            });

            setForm(emptyForm);
            setShowForm(false);
            setSuccess("Kunde oppretta.");
        } catch (err) {
            console.error(err);
            setError("Kunne ikkje opprette kunde.");
        } finally {
            setSaving(false);
        }
    }

    function CustomerTable({
        title,
        description,
        rows,
        emptyText,
    }: {
        title: string;
        description: string;
        rows: AdminCustomerRow[];
        emptyText: string;
    }) {
        return (
            <section className="rounded-[24px] border border-neutral-200 bg-white p-6">
                <div>
                    <h2 className="text-lg font-medium">{title}</h2>
                    <p className="mt-1 text-sm text-neutral-500">{description}</p>
                </div>

                <div className="mt-6 overflow-x-auto rounded-[18px] border border-neutral-200">
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-neutral-50">
                            <tr>
                                <th className="px-4 py-3 font-medium">Firma</th>
                                <th className="px-4 py-3 font-medium">Kontakt</th>
                                <th className="px-4 py-3 font-medium">Type</th>
                                <th className="px-4 py-3 font-medium">Konto</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Handling</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-neutral-500">
                                        Lastar kundar …
                                    </td>
                                </tr>
                            ) : rows.length ? (
                                rows.map((customer) => (
                                    <tr key={customer.id}>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-neutral-900">
                                                {customer.displayName || customer.companyName}
                                            </div>
                                            {customer.displayName && customer.displayName !== customer.companyName ? (
                                                <div className="text-xs text-neutral-500">
                                                    Fakturerast til: {customer.companyName}
                                                </div>
                                            ) : null}
                                            <div className="text-xs text-neutral-500">{customer.email}</div>
                                        </td>
                                        <td className="px-4 py-3 text-neutral-700">
                                            <div>{customer.contactName || "–"}</div>
                                            <div className="text-xs text-neutral-500">{customer.phone || "–"}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700">
                                                {customerTypeLabel(customer.customerType)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {customer.customerSource === "manual" || !customer.authUid ? (
                                                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-600">
                                                    Manuell kunde
                                                </span>
                                            ) : (
                                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
                                                    Kundekonto
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={
                                                "rounded-full border px-2.5 py-1 text-xs " +
                                                (customer.active
                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                    : "border-neutral-200 bg-neutral-50 text-neutral-500")
                                            }>
                                                {customer.active ? "Aktiv" : "Inaktiv"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link
                                                href={`/admin/customers/${customer.id}`}
                                                className="text-sm font-medium text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline"
                                            >
                                                Rediger →
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-neutral-500">
                                        {emptyText}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        );
    }

    return (
        <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
            <div className="mx-auto max-w-7xl px-6 py-10">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                            Admin
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                            Kundar
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm text-neutral-600">
                            Administrer retailkundar, grossistar og prisgrupper.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/admin"
                            className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"
                        >
                            Til admin
                        </Link>

                        <button
                            type="button"
                            onClick={() => {
                                setShowForm((prev) => !prev);
                                setError("");
                                setSuccess("");
                            }}
                            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"
                        >
                            {showForm ? "Lukk" : "Ny kunde"}
                        </button>
                    </div>
                </div>

                {showForm ? (
                    <section className="mt-8 rounded-[24px] border border-neutral-200 bg-white p-6">
                        <div>
                            <h2 className="text-lg font-medium">Ny kunde</h2>
                            <p className="mt-1 text-sm text-neutral-500">
                                Opprett kunde med e-post og prisgruppe. Utan Firebase UID blir kunden lagra som manuell kunde utan innlogging.
                            </p>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            <label className="space-y-1 text-sm font-medium text-neutral-800">
                                Firmanamn / fakturanamn (valfritt)
                                <input
                                    type="text"
                                    value={form.companyName}
                                    onChange={(e) => updateForm("companyName", e.target.value)}
                                    className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                    placeholder="T.d. Fjordkroa AS"
                                />
                            </label>
                            <div className="space-y-2 rounded-[12px] border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-800 md:col-span-2">
                                <label className="flex items-start gap-3 font-medium">
                                    <input
                                        type="checkbox"
                                        checked={form.sameAsCompanyName}
                                        onChange={(e) => updateForm("sameAsCompanyName", e.target.checked)}
                                        className="mt-1 h-4 w-4"
                                    />
                                    <span>
                                        Visningsnamn er same som firmanamn
                                    </span>
                                </label>

                                <label className="block space-y-1 text-sm font-medium text-neutral-800">
                                    Visningsnamn / butikknamn
                                    <input
                                        type="text"
                                        value={form.displayName}
                                        onChange={(e) => updateForm("displayName", e.target.value)}
                                        disabled={form.sameAsCompanyName}
                                        className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-500"
                                        placeholder="T.d. Bunnpris Valldal"
                                    />
                                </label>
                            </div>

                            <label className="space-y-1 text-sm font-medium text-neutral-800">
                                Kontaktperson (valfritt)
                                <input
                                    type="text"
                                    value={form.contactName}
                                    onChange={(e) => updateForm("contactName", e.target.value)}
                                    className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                    placeholder="Namn"
                                />
                            </label>

                            <label className="space-y-1 text-sm font-medium text-neutral-800">
                                E-post
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => updateForm("email", e.target.value)}
                                    className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                    placeholder="kunde@firma.no"
                                />
                            </label>

                            <label className="space-y-1 text-sm font-medium text-neutral-800">
                                Telefon (valfritt)
                                <input
                                    type="tel"
                                    value={form.phone}
                                    onChange={(e) => updateForm("phone", e.target.value)}
                                    className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                    placeholder="Telefonnummer"
                                />
                            </label>

                            <label className="space-y-1 text-sm font-medium text-neutral-800">
                                Org.nr. (valfritt)
                                <input
                                    type="text"
                                    value={form.organizationNumber}
                                    onChange={(e) => updateForm("organizationNumber", e.target.value)}
                                    className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                    placeholder="Organisasjonsnummer"
                                />
                            </label>

                            <label className="space-y-1 text-sm font-medium text-neutral-800">
                                Firebase Auth UID (valfritt)
                                <input
                                    type="text"
                                    value={form.authUid}
                                    onChange={(e) => updateForm("authUid", e.target.value)}
                                    className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                    placeholder="Lim inn UID frå Firebase Auth"
                                />
                            </label>

                            <label className="space-y-1 text-sm font-medium text-neutral-800 md:col-span-2">
                                Opningstider / leveringsinfo
                                <textarea
                                    value={form.openingHours}
                                    onChange={(e) => updateForm("openingHours", e.target.value)}
                                    rows={3}
                                    className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                    placeholder="Valfritt. Til dømes opningstider, varemottak eller ønskje for levering."
                                />
                            </label>

                            <label className="space-y-1 text-sm font-medium text-neutral-800">
                                Kundetype
                                <select
                                    value={form.customerType}
                                    onChange={(e) => updateForm("customerType", e.target.value as CustomerType)}
                                    className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                >
                                    <option value="retail">Retail</option>
                                    <option value="grossist">Grossist</option>
                                </select>
                            </label>

                            <label className="flex items-center gap-3 rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-800">
                                <input
                                    type="checkbox"
                                    checked={form.active}
                                    onChange={(e) => updateForm("active", e.target.checked)}
                                    className="h-4 w-4"
                                />
                                Aktiv kunde
                            </label>

                            <div className="rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                                <div className="font-medium text-neutral-800">Kundestatus</div>
                                <div className="mt-1 text-xs text-neutral-500">
                                    {form.authUid.trim()
                                        ? "Kunden blir oppretta som registrert kunde med kundekonto."
                                        : "Kunden blir oppretta som manuell kunde utan kundekonto."}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={handleCreateCustomer}
                                disabled={saving}
                                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
                            >
                                {saving ? "Lagrar …" : "Lagre kunde"}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setForm(emptyForm);
                                    setShowForm(false);
                                    setError("");
                                    setSuccess("");
                                }}
                                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"
                            >
                                Avbryt
                            </button>
                        </div>
                    </section>
                ) : null}

                {error ? (
                    <div className="mt-6 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                ) : null}

                {success ? (
                    <div className="mt-6 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        {success}
                    </div>
                ) : null}

                <section className="mt-8 rounded-[24px] border border-neutral-200 bg-white p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-lg font-medium">Kunderegister</h2>
                            <p className="mt-1 text-sm text-neutral-500">
                                {filteredCustomers.length} av {customers.length} kundar
                            </p>
                        </div>

                        <input
                            type="search"
                            value={queryText}
                            onChange={(e) => setQueryText(e.target.value)}
                            className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-800 md:w-72"
                            placeholder="Søk etter firma, kontakt eller e-post"
                        />
                    </div>
                </section>

                <div className="mt-6 grid gap-6">
                    <CustomerTable
                        title={`Kundeprofilar (${customerProfiles.length})`}
                        description="Kundar med innlogging. Desse kan sjå historikk, ordrebekreftelsar og følgesedlar i portalen."
                        rows={customerProfiles}
                        emptyText="Ingen kundeprofilar funne."
                    />

                    <CustomerTable
                        title={`Manuelle kundar (${manualCustomers.length})`}
                        description="Kundar utan innlogging. Desse må følgjast opp via telefon, e-post eller direkte avtale."
                        rows={manualCustomers}
                        emptyText="Ingen manuelle kundar funne."
                    />
                </div>

            </div>
        </main>
    );
}