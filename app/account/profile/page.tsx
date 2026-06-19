

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDocs, limit, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type CustomerType = "retail" | "grossist";

type AccountCustomer = {
    id: string;
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    organizationNumber: string;
    openingHours: string;
    customerType: CustomerType;
    active: boolean;
    profileCompleted: boolean;
};

type ProfileForm = {
    companyName: string;
    contactName: string;
    phone: string;
    organizationNumber: string;
    openingHours: string;
};

function emptyForm(): ProfileForm {
    return {
        companyName: "",
        contactName: "",
        phone: "",
        organizationNumber: "",
        openingHours: "",
    };
}

function customerTypeLabel(type: CustomerType) {
    return type === "grossist" ? "Grossist" : "Retail";
}

function isProfileComplete(form: ProfileForm) {
    return Boolean(
        form.companyName.trim() &&
        form.contactName.trim() &&
        form.phone.trim() &&
        form.organizationNumber.trim()
    );
}

async function fetchCustomerForUser(user: User): Promise<AccountCustomer | null> {
    const snapshot = await getDocs(
        query(collection(db, "customers"), where("authUid", "==", user.uid), limit(1))
    );

    if (snapshot.empty) return null;

    const docSnap = snapshot.docs[0];
    const data = docSnap.data();

    return {
        id: docSnap.id,
        companyName: typeof data.companyName === "string" ? data.companyName : "",
        contactName: typeof data.contactName === "string" ? data.contactName : "",
        email: typeof data.email === "string" ? data.email : user.email || "",
        phone: typeof data.phone === "string" ? data.phone : "",
        organizationNumber: typeof data.organizationNumber === "string" ? data.organizationNumber : "",
        openingHours: typeof data.openingHours === "string" ? data.openingHours : "",
        customerType: data.customerType === "grossist" ? "grossist" : "retail",
        active: typeof data.active === "boolean" ? data.active : true,
        profileCompleted: data.profileCompleted === true,
    };
}

export default function AccountProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [customer, setCustomer] = useState<AccountCustomer | null>(null);
    const [form, setForm] = useState<ProfileForm>(emptyForm());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
            setUser(nextUser);
            setCustomer(null);
            setForm(emptyForm());
            setError("");
            setSaved(false);
            setLoading(false);

            if (!nextUser) return;

            try {
                setLoading(true);

                const nextCustomer = await fetchCustomerForUser(nextUser);
                setCustomer(nextCustomer);

                if (!nextCustomer) {
                    setError("Brukaren er ikkje knytt til ein B2B-kunde enno.");
                    return;
                }

                setForm({
                    companyName: nextCustomer.companyName,
                    contactName: nextCustomer.contactName,
                    phone: nextCustomer.phone,
                    organizationNumber: nextCustomer.organizationNumber,
                    openingHours: nextCustomer.openingHours,
                });

                if (!nextCustomer.active) {
                    setError("Kundekontoen er ikkje aktiv. Ta kontakt med Valldal Safteri.");
                }
            } catch (err) {
                console.error(err);
                setError("Kunne ikkje hente kundeprofil.");
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    function updateForm<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
        setSaved(false);
    }

    async function handleSave() {
        if (!customer) return;

        if (!isProfileComplete(form)) {
            setError("Fyll ut firmanamn, kontaktperson, telefonnummer og org.nr.");
            return;
        }

        try {
            setSaving(true);
            setError("");

            const nextProfileCompleted = isProfileComplete(form);

            await updateDoc(doc(db, "customers", customer.id), {
                companyName: form.companyName.trim(),
                contactName: form.contactName.trim(),
                phone: form.phone.trim(),
                organizationNumber: form.organizationNumber.trim(),
                openingHours: form.openingHours.trim(),
                profileCompleted: nextProfileCompleted,
            });

            setCustomer((prev) =>
                prev
                    ? {
                        ...prev,
                        companyName: form.companyName.trim(),
                        contactName: form.contactName.trim(),
                        phone: form.phone.trim(),
                        organizationNumber: form.organizationNumber.trim(),
                        openingHours: form.openingHours.trim(),
                        profileCompleted: nextProfileCompleted,
                    }
                    : prev
            );
            setSaved(true);

            setTimeout(() => {
                router.push("/account");
            }, 500);
        } catch (err) {
            console.error(err);
            setError("Kunne ikkje lagre kundeprofil.");
        } finally {
            setSaving(false);
        }
    }

    const profileComplete = isProfileComplete(form);

    return (
        <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
            <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
                <Link
                    href="/account"
                    className="text-sm text-neutral-600 underline-offset-4 hover:underline"
                >
                    ← Tilbake til Min side
                </Link>

                <div className="mt-6 rounded-[24px] border border-rose-100 bg-[#fffafa] p-6">
                    <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                        Kundeprofil
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                        Opplysningar om verksemda
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600">
                        Desse opplysningane blir brukte ved bestilling, pakking og levering. Firmanamn, kontaktperson, telefonnummer og org.nr. må vere utfylt før de kan sende bestilling.
                    </p>
                </div>

                {loading ? (
                    <p className="mt-6 text-sm text-neutral-500">Hentar kundeprofil …</p>
                ) : !user ? (
                    <div className="mt-6 rounded-[18px] border border-neutral-200 bg-white p-5 text-sm text-neutral-600">
                        Logg inn for å redigere kundeprofilen.
                    </div>
                ) : error && !customer ? (
                    <div className="mt-6 rounded-[18px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                        {error}
                    </div>
                ) : customer ? (
                    <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
                        <section className="rounded-[24px] border border-neutral-200 bg-white p-6">
                            <h2 className="text-lg font-medium">Profil</h2>

                            <div className="mt-5 grid gap-4 md:grid-cols-2">
                                <label className="space-y-1 text-sm font-medium text-neutral-800 md:col-span-2">
                                    Firmanamn *
                                    <input
                                        type="text"
                                        value={form.companyName}
                                        onChange={(e) => updateForm("companyName", e.target.value)}
                                        className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                    />
                                </label>

                                <label className="space-y-1 text-sm font-medium text-neutral-800">
                                    Kontaktperson *
                                    <input
                                        type="text"
                                        value={form.contactName}
                                        onChange={(e) => updateForm("contactName", e.target.value)}
                                        className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                    />
                                </label>

                                <label className="space-y-1 text-sm font-medium text-neutral-800">
                                    Telefonnummer *
                                    <input
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) => updateForm("phone", e.target.value)}
                                        className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                    />
                                </label>

                                <label className="space-y-1 text-sm font-medium text-neutral-800">
                                    Org.nr. *
                                    <input
                                        type="text"
                                        value={form.organizationNumber}
                                        onChange={(e) => updateForm("organizationNumber", e.target.value)}
                                        className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                    />
                                </label>

                                <label className="space-y-1 text-sm font-medium text-neutral-800">
                                    E-post
                                    <input
                                        type="email"
                                        value={customer.email}
                                        disabled
                                        className="w-full rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-normal text-neutral-500"
                                    />
                                </label>

                                <label className="space-y-1 text-sm font-medium text-neutral-800 md:col-span-2">
                                    Opningstider / leveringsinfo
                                    <textarea
                                        value={form.openingHours}
                                        onChange={(e) => updateForm("openingHours", e.target.value)}
                                        rows={4}
                                        placeholder="Valfritt. Til dømes opningstider, varemottak eller ønskje for levering."
                                        className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                    />
                                </label>
                            </div>

                            {error ? (
                                <div className="mt-5 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {error}
                                </div>
                            ) : null}

                            {saved ? (
                                <div className="mt-5 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                    Kundeprofilen er lagra.
                                </div>
                            ) : null}

                            <div className="mt-6 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
                                >
                                    {saving ? "Lagrar …" : "Lagre profil"}
                                </button>

                                <Link
                                    href="/account"
                                    className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"
                                >
                                    Avbryt
                                </Link>
                            </div>
                        </section>

                        <aside className="space-y-6">
                            <section className="rounded-[24px] border border-neutral-200 bg-white p-6">
                                <h2 className="text-lg font-medium">Status</h2>

                                <div
                                    className={`mt-4 rounded-[14px] border px-4 py-3 text-sm ${profileComplete
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                        : "border-amber-200 bg-amber-50 text-amber-800"
                                        }`}
                                >
                                    {profileComplete
                                        ? "Kundeprofilen er komplett."
                                        : "Kundeprofilen manglar obligatorisk informasjon."}
                                </div>
                            </section>

                            <section className="rounded-[24px] border border-neutral-200 bg-white p-6">
                                <h2 className="text-lg font-medium">Konto</h2>
                                <div className="mt-4 space-y-2 text-sm text-neutral-600">
                                    <div className="flex justify-between gap-4">
                                        <span>Prisgruppe</span>
                                        <span className="font-medium text-neutral-900">
                                            {customerTypeLabel(customer.customerType)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span>Status</span>
                                        <span className="font-medium text-neutral-900">
                                            {customer.active ? "Aktiv" : "Inaktiv"}
                                        </span>
                                    </div>
                                </div>
                            </section>
                        </aside>
                    </div>
                ) : null}
            </div>
        </main>
    );
}