"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
    fetchCustomerById,
    updateCustomer,
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
    customerSource: "registered" | "manual";
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
    customerSource: "manual",
    customerType: "retail",
    active: true,
    profileCompleted: false,
};

function customerToForm(customer: AdminCustomerRow): CustomerForm {
    const customerData = customer as AdminCustomerRow & {
        displayName?: string;
        sameAsCompanyName?: boolean;
        organizationNumber?: string;
        openingHours?: string;
        profileCompleted?: boolean;
        customerSource?: "registered" | "manual";
    };

    const companyName = customer.companyName || "";
    const displayName = customerData.displayName || companyName;
    const sameAsCompanyName = customerData.sameAsCompanyName ?? displayName === companyName;

    return {
        companyName,
        displayName,
        sameAsCompanyName,
        contactName: customer.contactName || "",
        email: customer.email || "",
        phone: customer.phone || "",
        organizationNumber: customerData.organizationNumber || "",
        openingHours: customerData.openingHours || "",
        authUid: customer.authUid || "",
        customerSource: customerData.customerSource || (customer.authUid ? "registered" : "manual"),
        customerType: customer.customerType,
        active: customer.active,
        profileCompleted: customerData.profileCompleted === true,
    };
}

export default function AdminCustomerDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const fromOrder = searchParams.get("fromOrder");
    const customerId = typeof params?.id === "string" ? params.id : "";

    const [form, setForm] = useState<CustomerForm>(emptyForm);
    const [initial, setInitial] = useState<CustomerForm | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sendingPasswordLink, setSendingPasswordLink] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        if (!customerId) return;

        let cancelled = false;

        async function loadCustomer() {
            setLoading(true);
            setError("");
            setSuccess("");

            try {
                const customer = await fetchCustomerById(customerId);

                if (!customer) {
                    throw new Error("Kunden finst ikkje.");
                }

                if (cancelled) return;

                const nextForm = customerToForm(customer);
                setForm(nextForm);
                setInitial(nextForm);
            } catch (err) {
                console.error(err);
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Kunne ikkje laste kunde.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void loadCustomer();

        return () => {
            cancelled = true;
        };
    }, [customerId]);

    const hasChanges = initial ? JSON.stringify(form) !== JSON.stringify(initial) : false;

    function updateForm<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) {
        setForm((prev) => {
            if (key === "companyName") {
                const nextCompanyName = String(value);
                return {
                    ...prev,
                    companyName: nextCompanyName,
                    displayName: prev.sameAsCompanyName ? nextCompanyName : prev.displayName,
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

    async function handleSave() {
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
        const customerSource = authUid ? "registered" : "manual";

        if (!email) {
            setError("E-post er påkravd.");
            return;
        }

        if (!companyName) {
            setError("Firmanamn er påkravd.");
            return;
        }

        if (!displayName) {
            setError("Visningsnamn er påkravd når det ikkje er same som firmanamn.");
            return;
        }

        setSaving(true);

        try {
            const nextForm: CustomerForm = {
                companyName,
                displayName,
                sameAsCompanyName,
                contactName,
                email,
                phone,
                organizationNumber,
                openingHours,
                authUid,
                customerSource,
                customerType: form.customerType,
                active: form.active,
                profileCompleted: Boolean(
                    companyName && contactName && phone && organizationNumber
                ),
            };

            await updateCustomer(customerId, nextForm);

            setForm(nextForm);
            setInitial(nextForm);
            setSuccess("Endringar lagra.");
        } catch (err) {
            console.error(err);
            setError("Kunne ikkje lagre endringar.");
        } finally {
            setSaving(false);
        }
    }

    async function handleSendPasswordLink() {
        const email = form.email.trim().toLowerCase();

        setError("");
        setSuccess("");

        if (!email) {
            setError("E-post må vere fylt ut før passordlenke kan sendast.");
            return;
        }

        try {
            setSendingPasswordLink(true);
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("UNAUTHORIZED");
            const response = await fetch("/api/account/password-link", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ customerId }),
            });
            if (!response.ok) throw new Error("PASSWORD_LINK_FAILED");

            const customer = await fetchCustomerById(customerId);
            if (customer) {
                const nextForm = customerToForm(customer);
                setForm(nextForm);
                setInitial(nextForm);
            }
            setSuccess("Passordlenke er sendt til kunden.");
        } catch (err) {
            console.error(err);
            setError("Kunne ikkje opprette kundekonto eller sende passordlenke.");
        } finally {
            setSendingPasswordLink(false);
        }
    }

    return (
        <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
            <div className="mx-auto max-w-4xl px-6 py-10">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                            Admin / Kundar
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                            Rediger kunde
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm text-neutral-600">
                            Oppdater kundeinformasjon, prisgruppe og status.
                        </p>
                    </div>

                    <Link
                        href={fromOrder ? `/admin/orders/${fromOrder}` : "/admin/customers"}
                        className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"
                    >
                        {fromOrder ? "Tilbake til ordre" : "Tilbake"}
                    </Link>
                </div>

                {loading ? (
                    <section className="mt-8 rounded-[24px] border border-neutral-200 bg-white p-8 text-sm text-neutral-500">
                        Lastar kunde …
                    </section>
                ) : (
                    <section className="mt-8 rounded-[24px] border border-neutral-200 bg-white p-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-1 text-sm font-medium text-neutral-800">
                                Firmanamn / fakturanamn
                                <input
                                    type="text"
                                    value={form.companyName}
                                    onChange={(e) => updateForm("companyName", e.target.value)}
                                    className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                    placeholder="Til dømes Valldal Mat"
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
                                        <span className="mt-1 block text-xs font-normal text-neutral-500">
                                            Bruk eige visningsnamn når kunden bestiller som butikk/profilnamn, men skal fakturerast til eit anna firmanamn.
                                        </span>
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
                                        placeholder="Til dømes Bunnpris Valldal"
                                    />
                                    <span className="block text-xs font-normal text-neutral-500">
                                        Dette namnet kan brukast i ordreoversikt, plukking og kundedialog. Fakturering bør bruke firmanamn/fakturanamn.
                                    </span>
                                </label>
                            </div>

                            <label className="space-y-1 text-sm font-medium text-neutral-800">
                                Kontaktperson
                                <input
                                    type="text"
                                    value={form.contactName}
                                    onChange={(e) => updateForm("contactName", e.target.value)}
                                    className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                />
                            </label>

                            <label className="space-y-1 text-sm font-medium text-neutral-800">
                                E-post
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => updateForm("email", e.target.value)}
                                    disabled={Boolean(form.authUid)}
                                    className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-500"
                                />
                                {form.authUid ? (
                                    <span className="block text-xs font-normal text-neutral-500">
                                        E-postadressa er knytt til innlogginga. Kontaktinformasjon og innlogging må endrast samla.
                                    </span>
                                ) : null}
                            </label>

                            <label className="space-y-1 text-sm font-medium text-neutral-800">
                                Telefon
                                <input
                                    type="tel"
                                    value={form.phone}
                                    onChange={(e) => updateForm("phone", e.target.value)}
                                    className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                />
                            </label>

                            <label className="space-y-1 text-sm font-medium text-neutral-800">
                                Org.nr.
                                <input
                                    type="text"
                                    value={form.organizationNumber}
                                    onChange={(e) => updateForm("organizationNumber", e.target.value)}
                                    className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
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

                            <div className="rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 md:col-span-2">
                                <div className="font-medium text-neutral-800">Kundekonto</div>
                                <div className="mt-1 text-xs text-neutral-500">
                                    {form.authUid.trim()
                                        ? "Kundekontoen er aktiv. Du kan sende ei ny lenke dersom kunden har gløymt passordet."
                                        : "Kundekontoen er ikkje aktivert. Kontoen blir oppretta automatisk når du sender tilgang."}
                                </div>
                            </div>

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
                                <div className="font-medium text-neutral-800">Profilstatus</div>
                                <div className="mt-1 text-xs text-neutral-500">
                                    {form.profileCompleted
                                        ? "Kundeprofilen er komplett."
                                        : "Kundeprofilen manglar obligatorisk informasjon."}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving || !hasChanges}
                                className={
                                    "rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 " +
                                    (hasChanges ? "bg-emerald-700 hover:bg-emerald-800" : "bg-neutral-400")
                                }
                            >
                                {saving ? "Lagrar …" : "Lagre endringar"}
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push(fromOrder ? `/admin/orders/${fromOrder}` : "/admin/customers")}
                                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"
                            >
                                Avbryt
                            </button>
                            <button
                                type="button"
                                onClick={handleSendPasswordLink}
                                disabled={sendingPasswordLink || !form.email.trim()}
                                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {sendingPasswordLink ? "Sender passordlenke …" : form.authUid ? "Send ny passordlenke" : "Opprett konto og send tilgang"}
                            </button>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-neutral-500">
                            Konto og intern kopling blir handtert automatisk. Kunden får e-post frå Valldal Safteri med lenke til den eigne passordsida.
                        </p>
                    </section>
                )}

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
            </div>
        </main>
    );
}
