

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type AccountCustomer = {
    id: string;
    companyName: string;
    contactName: string;
    phone: string;
    organizationNumber: string;
    email: string;
    customerType: "retail" | "grossist";
    active: boolean;
    profileCompleted: boolean;
};

type AccountOrder = {
    id: string;
    orderNumber: string | null;
    status: string;
    createdAtMs: number;
    isBackorder: boolean;
    parentOrderNumber: string | null;
};

function customerTypeLabel(type: AccountCustomer["customerType"]) {
    return type === "grossist" ? "Grossist" : "Retail";
}

function normalizeOrderStatus(status: string) {
    const normalized = status.trim().toLowerCase();

    if (normalized === "ferdig") return "delivered";
    if (normalized === "complete") return "delivered";
    if (normalized === "completed") return "delivered";
    if (normalized === "levert") return "delivered";
    if (normalized === "hentet") return "picked_up";
    if (normalized === "henta") return "picked_up";
    if (normalized === "sendt") return "shipped";

    return normalized;
}

function orderStatusLabel(status: string) {
    const normalizedStatus = normalizeOrderStatus(status);
    const labels: Record<string, string> = {
        new: "Bestilling motteken",
        processing: "Under behandling",
        packed: "Pakka",
        partial: "Delpakka",
        change_requested: "Handling krevst",
        picked_up: "Henta",
        shipped: "Sendt",
        delivered: "Levert",
        cancelled: "Kansellert",
    };

    return labels[normalizedStatus] || "Under behandling";
}

function orderStatusDescription(status: string) {
    const normalizedStatus = normalizeOrderStatus(status);
    if (normalizedStatus === "new") {
        return "Bestillinga er motteken. Ordrenummer blir tildelt når ho er registrert hos oss.";
    }
    if (normalizedStatus === "change_requested") {
        return "Vi treng svar frå dykk før ordren kan behandlast vidare.";
    }

    if (normalizedStatus === "partial") {
        return "Ordren er delpakka. Vi tek kontakt dersom vi treng avklaring.";
    }

    if (normalizedStatus === "packed") {
        return "Ordren er pakka og klar for vidare handtering.";
    }

    if (normalizedStatus === "shipped") {
        return "Ordren er sendt.";
    }

    if (normalizedStatus === "picked_up") {
        return "Ordren er henta.";
    }

    if (normalizedStatus === "delivered") {
        return "Ordren er levert.";
    }

    return "Ordren er registrert og blir behandla vidare av Valldal.";
}

function orderStepIndex(status: string) {
    const normalizedStatus = normalizeOrderStatus(status);
    if (normalizedStatus === "new") return 0;
    if (normalizedStatus === "processing") return 1;
    if (
        normalizedStatus === "packed" ||
        normalizedStatus === "partial" ||
        normalizedStatus === "change_requested"
    )
        return 2;
    if (
        normalizedStatus === "shipped" ||
        normalizedStatus === "picked_up"
    )
        return 3;
    if (normalizedStatus === "delivered") return 4;
    return 0;
}

function isActiveOrder(status: string) {
    const normalizedStatus = normalizeOrderStatus(status);

    return !["picked_up", "shipped", "delivered", "cancelled"].includes(normalizedStatus);
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
        phone: typeof data.phone === "string" ? data.phone : "",
        organizationNumber: typeof data.organizationNumber === "string" ? data.organizationNumber : "",
        email: typeof data.email === "string" ? data.email : user.email || "",
        customerType: data.customerType === "grossist" ? "grossist" : "retail",
        active: typeof data.active === "boolean" ? data.active : true,
        profileCompleted: data.profileCompleted === true,
    };
}

async function fetchLatestOrder(customerId: string): Promise<AccountOrder | null> {
    const snapshot = await getDocs(
        query(
            collection(db, "orders"),
            where("customerId", "==", customerId),
            limit(20)
        )
    );

    if (snapshot.empty) return null;

    const orders = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const createdAtMs = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0;

        return {
            id: docSnap.id,
            orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : null,
            status: typeof data.status === "string" ? normalizeOrderStatus(data.status) : "new",
            createdAtMs,
            isBackorder: data.isBackorder === true,
            parentOrderNumber: typeof data.parentOrderNumber === "string" ? data.parentOrderNumber : null,
        };
    });

    orders.sort((a, b) => b.createdAtMs - a.createdAtMs);

    const activeOrder = orders.find((order) => isActiveOrder(order.status));

    return activeOrder || null;
}

export default function AccountPage() {
    const [user, setUser] = useState<User | null>(null);
    const [customer, setCustomer] = useState<AccountCustomer | null>(null);
    const [latestOrder, setLatestOrder] = useState<AccountOrder | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(true);
    const [checkingCustomer, setCheckingCustomer] = useState(false);
    const [signingIn, setSigningIn] = useState(false);
    const [error, setError] = useState("");

    const [sendingPasswordLink, setSendingPasswordLink] = useState(false);
    const [passwordLinkSent, setPasswordLinkSent] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
            setUser(nextUser);
            setCustomer(null);
            setLatestOrder(null);
            setError("");
            setLoading(false);

            if (!nextUser) return;

            setCheckingCustomer(true);

            try {
                const nextCustomer = await fetchCustomerForUser(nextUser);
                setCustomer(nextCustomer);

                if (nextCustomer) {
                    try {
                        const order = await fetchLatestOrder(nextCustomer.id);
                        setLatestOrder(order);
                    } catch (orderError) {
                        console.error("Kunne ikkje hente siste ordre", orderError);
                        setLatestOrder(null);
                    }
                }

                if (!nextCustomer) {
                    setError("Brukaren er innlogga, men er ikkje knytt til ein B2B-kunde enno.");
                } else if (!nextCustomer.active) {
                    setError("Kundekontoen er ikkje aktiv. Ta kontakt med Valldal Safteri.");
                }
            } catch (err) {
                console.error(err);
                setError("Kunne ikkje hente kundedata.");
            } finally {
                setCheckingCustomer(false);
            }
        });

        return () => unsubscribe();
    }, []);

    async function handleSignIn() {
        setError("");
        setPasswordLinkSent(false);
        setSigningIn(true);

        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (err) {
            console.error(err);
            setError("Feil e-post eller passord.");
        } finally {
            setSigningIn(false);
        }
    }

    async function handleSendPasswordLink() {
        const nextEmail = email.trim().toLowerCase();

        setError("");
        setPasswordLinkSent(false);

        if (!nextEmail) {
            setError("Skriv inn e-postadressa først.");
            return;
        }

        try {
            setSendingPasswordLink(true);
            await sendPasswordResetEmail(auth, nextEmail);
            setPasswordLinkSent(true);
        } catch (err) {
            console.error(err);
            setError("Kunne ikkje sende passordlenke. Kontroller e-postadressa eller ta kontakt med Valldal Safteri.");
        } finally {
            setSendingPasswordLink(false);
        }
    }

    async function handleSignOut() {
        setError("");
        await signOut(auth);
        setCustomer(null);
        setLatestOrder(null);
        setPassword("");
    }

    return (
        <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
            <div className="mx-auto max-w-4xl px-6 py-12">
                <Link
                    href="/"
                    className="mb-6 inline-flex text-sm text-neutral-600 underline-offset-4 hover:underline"
                >
                    ← Tilbake til heimesida
                </Link>

                <div className="mb-8">
                    <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                        Valldal Safteri / Bryggeri
                    </p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                        {user ? "Mi side" : "B2B-konto"}
                    </h1>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-600">
                        {user
                            ? "Her finn de aktive bestillingar, ordrehistorikk og snarveg til ny bestilling."
                            : "Logg inn for å sjå prisar og legge inn bestilling som registrert kunde."}
                    </p>
                </div>

                {loading ? (
                    <section className="rounded-[24px] border border-neutral-200 bg-white p-8 text-sm text-neutral-500">
                        Lastar …
                    </section>
                ) : user ? (
                    <section className="rounded-[24px] border border-neutral-200 bg-white p-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                                    Innlogga
                                </p>
                                <h2 className="mt-2 text-xl font-medium">{user.email}</h2>
                            </div>
                            <button
                                type="button"
                                onClick={handleSignOut}
                                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"
                            >
                                Logg ut
                            </button>
                        </div>

                        {checkingCustomer ? (
                            <p className="mt-6 text-sm text-neutral-500">Hentar kundedata …</p>
                        ) : customer && customer.active ? (
                            <>
                                <div className="mt-6 rounded-[18px] border border-rose-100 bg-[#faf6f6] p-5">
                                    <p className="text-xs uppercase tracking-[0.16em] text-rose-500">
                                        Kunde
                                    </p>
                                    <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <h3 className="text-xl font-medium">{customer.companyName}</h3>
                                            <div className="mt-3 grid gap-3 text-sm text-neutral-600 md:grid-cols-2">
                                                <p>Kontakt: {customer.contactName || "–"}</p>
                                                <p>E-post: {customer.email}</p>
                                                <p>Prisgruppe: {customerTypeLabel(customer.customerType)}</p>
                                                <p>Status: Aktiv</p>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                                {customer.profileCompleted ? (
                                    <div className="mt-4 rounded-[18px] border border-neutral-200 bg-white p-5">
                                        <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                                            Snarvegar
                                        </p>

                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <Link
                                                href="/account/order"
                                                className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-900 transition hover:bg-rose-100"
                                            >
                                                Ny bestilling
                                            </Link>
                                            <Link
                                                href="/account/orders"
                                                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"
                                            >
                                                Mine bestillingar
                                            </Link>
                                            <Link
                                                href="/account/pickups"
                                                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"
                                            >
                                                Hentehistorikk
                                            </Link>
                                            <Link
                                                href="/account/profile"
                                                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"
                                            >
                                                Kundeprofil
                                            </Link>
                                        </div>
                                    </div>
                                ) : null}
                                {!customer.profileCompleted ? (
                                    <div className="mt-5 rounded-[18px] border border-amber-200 bg-amber-50 p-5">
                                        <p className="text-sm leading-6 text-amber-900">
                                            Kundeinformasjonen manglar obligatoriske felt. Fullfør kundeinformasjonen før de kan leggje inn bestilling.
                                        </p>
                                        <Link
                                            href="/account/profile"
                                            className="mt-4 inline-flex rounded-full bg-rose-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-900"
                                        >
                                            Fullfør kundeinformasjon
                                        </Link>
                                    </div>
                                ) : null}

                                {customer.profileCompleted && latestOrder ? (
                                    <div
                                        className={`mt-6 rounded-[18px] border p-5 ${latestOrder.status === "change_requested"
                                            ? "border-amber-200 bg-amber-50"
                                            : "border-rose-100 bg-[#fffafa]"
                                            }`}
                                    >
                                        <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                                            Aktiv bestilling
                                        </p>
                                        {latestOrder.isBackorder ? (
                                            <div className="mt-3 inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-800">
                                                Restordre
                                            </div>
                                        ) : null}

                                        <h4 className="mt-2 text-lg font-medium text-neutral-900">
                                            {latestOrder.orderNumber || "Ordrenummer kjem"}
                                        </h4>
                                        {!latestOrder.orderNumber ? (
                                            <p className="mt-1 text-sm text-neutral-500">
                                                Ordrenummer blir tildelt når bestillinga er registrert i ordresystemet vårt.
                                            </p>
                                        ) : null}
                                        {latestOrder.isBackorder ? (
                                            <p className="mt-2 text-sm text-neutral-600">
                                                Dette er ein restordre frå ei tidlegare bestilling
                                                {latestOrder.parentOrderNumber ? ` (${latestOrder.parentOrderNumber})` : ""}.
                                            </p>
                                        ) : null}

                                        <p className="mt-2 text-sm font-medium text-neutral-900">
                                            {orderStatusLabel(latestOrder.status)}
                                        </p>

                                        <p className="mt-2 text-sm text-neutral-600">
                                            {latestOrder.isBackorder
                                                ? "Restordren er registrert og blir behandla vidare av Valldal."
                                                : orderStatusDescription(latestOrder.status)}
                                        </p>

                                        <div className="mt-4 grid grid-cols-5 gap-2">
                                            {["Motteken", "Behandlast", "Pakka", "Sendt/henta", "Ferdig"].map((step, index) => {
                                                const active = index <= orderStepIndex(latestOrder.status);

                                                return (
                                                    <div key={step}>
                                                        <div
                                                            className={`h-1.5 rounded-full ${active ? "bg-neutral-900" : "bg-neutral-200"}`}
                                                        />
                                                        <div className="mt-1 text-[10px] leading-4 text-neutral-500">
                                                            {step}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {latestOrder.status === "change_requested" && (
                                            <p className="mt-4 rounded-[14px] border border-amber-300 bg-white px-4 py-3 text-sm font-medium text-amber-900">
                                                Handling krevst: Opne bestillinga og vel korleis vi skal gå vidare.
                                            </p>
                                        )}

                                        <div className="mt-4">
                                            <Link
                                                href={`/account/orders/${latestOrder.id}?from=account`}
                                                className="inline-flex rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
                                            >
                                                {latestOrder.status === "change_requested" ? "Sjå og svar" : "Sjå bestilling"}
                                            </Link>
                                        </div>
                                    </div>
                                ) : null}
                            </>
                        ) : null}
                    </section>
                ) : (
                    <section className="rounded-[24px] border border-neutral-200 bg-white p-6">
                        <h2 className="text-xl font-medium">Logg inn</h2>
                        <p className="mt-2 text-sm text-neutral-500">
                            For kundar med B2B-avtale.
                        </p>

                        <div className="mt-6 grid gap-4">
                            <label className="space-y-1 text-sm font-medium text-neutral-800">
                                E-post
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                    placeholder="kunde@firma.no"
                                />
                            </label>

                            <label className="space-y-1 text-sm font-medium text-neutral-800">
                                Passord
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-800"
                                    placeholder="Passord"
                                />
                            </label>
                        </div>

                        <button
                            type="button"
                            onClick={handleSignIn}
                            disabled={signingIn}
                            className="mt-6 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
                        >
                            {signingIn ? "Loggar inn …" : "Logg inn"}
                        </button>

                        <div className="mt-6 rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
                            <h3 className="text-sm font-medium text-neutral-900">
                                Ny kunde eller gløymt passord?
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-neutral-600">
                                Skriv inn e-postadressa di over, så sender vi ei lenke der du kan opprette eller endre passord.
                            </p>

                            <button
                                type="button"
                                onClick={handleSendPasswordLink}
                                disabled={sendingPasswordLink}
                                className="mt-4 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 disabled:opacity-60"
                            >
                                {sendingPasswordLink ? "Sender lenke …" : "Send passordlenke"}
                            </button>

                            {passwordLinkSent ? (
                                <p className="mt-3 text-sm text-emerald-700">
                                    Passordlenke er sendt dersom e-postadressa er registrert hos oss.
                                </p>
                            ) : null}
                        </div>
                    </section>
                )}

                {error ? (
                    <div className="mt-6 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                ) : null}
            </div>
        </main>
    );
}