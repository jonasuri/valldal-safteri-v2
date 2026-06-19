"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type AccountCustomer = {
    id: string;
    companyName: string;
    active: boolean;
};

type CustomerOrder = {
    id: string;
    orderNumber: string | null;
    status: string;
    totalExVat: number;
    lineCount: number;
    unitCount: number;
    createdAtLabel: string;
    createdAtMs: number;
    isBackorder: boolean;
    parentOrderNumber: string | null;
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
        return value.toDate().toLocaleDateString("nb-NO", {
            day: "2-digit",
            month: "long",
            year: "numeric",
        });
    }

    return "—";
}

function createdAtMs(value: any) {
    return value?.toDate ? value.toDate().getTime() : 0;
}

function orderStatusLabel(status: string) {
    const labels: Record<string, string> = {
        new: "Ny bestilling",
        processing: "Under behandling",
        packed: "Pakka",
        partial: "Delpakka",
        change_requested: "Handling krevst",
        picked_up: "Henta",
        shipped: "Sendt",
        delivered: "Levert",
        cancelled: "Kansellert",
    };

    return labels[status] || "Under behandling";
}

function orderStatusStyles(status: string) {
    if (status === "change_requested") {
        return "border-amber-300 bg-amber-50 text-amber-900";
    }

    if (status === "partial") {
        return "border-amber-200 bg-amber-50 text-amber-800";
    }

    if (["packed", "picked_up", "shipped", "delivered"].includes(status)) {
        return "border-emerald-200 bg-emerald-50 text-emerald-800";
    }

    if (status === "cancelled") {
        return "border-neutral-200 bg-neutral-50 text-neutral-500";
    }

    return "border-neutral-200 bg-neutral-50 text-neutral-700";
}

function isHistoricalOrder(status: string) {
    return ["picked_up", "shipped", "delivered", "cancelled"].includes(status);
}

function orderPriority(status: string) {
    if (status === "change_requested") return 1;
    if (status === "partial") return 2;
    if (status === "new") return 3;
    if (status === "processing") return 4;
    if (status === "packed") return 5;
    return 6;
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
        active: typeof data.active === "boolean" ? data.active : true,
    };
}

async function fetchOrdersForCustomer(customerId: string): Promise<CustomerOrder[]> {
    const snapshot = await getDocs(
        query(
            collection(db, "orders"),
            where("customerId", "==", customerId),
            limit(100)
        )
    );

    return snapshot.docs
        .map((docSnap) => {
            const data = docSnap.data();

            return {
                id: docSnap.id,
                orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : null,
                status: typeof data.status === "string" ? data.status : "new",
                totalExVat: typeof data.totalExVat === "number" ? data.totalExVat : 0,
                lineCount: typeof data.lineCount === "number" ? data.lineCount : 0,
                unitCount: typeof data.unitCount === "number" ? data.unitCount : 0,
                createdAtLabel: formatDate(data.createdAt),
                createdAtMs: createdAtMs(data.createdAt),
                isBackorder: data.isBackorder === true,
                parentOrderNumber: typeof data.parentOrderNumber === "string" ? data.parentOrderNumber : null,
            };
        })
        .sort((a, b) => {
            const priorityDiff = orderPriority(a.status) - orderPriority(b.status);

            if (priorityDiff !== 0) return priorityDiff;

            return b.createdAtMs - a.createdAtMs;
        });
}

export default function AccountOrdersPage() {
    const [user, setUser] = useState<User | null>(null);
    const [customer, setCustomer] = useState<AccountCustomer | null>(null);
    const [orders, setOrders] = useState<CustomerOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
            setUser(nextUser);
            setCustomer(null);
            setOrders([]);
            setError("");
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

                if (!nextCustomer.active) {
                    setError("Kundekontoen er ikkje aktiv. Ta kontakt med Valldal Safteri.");
                    return;
                }

                const nextOrders = await fetchOrdersForCustomer(nextCustomer.id);
                setOrders(nextOrders);
            } catch (err) {
                console.error(err);
                setError("Kunne ikkje hente bestillingar.");
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const activeOrders = useMemo(
        () => orders.filter((order) => !isHistoricalOrder(order.status)),
        [orders]
    );

    const historicalOrders = useMemo(
        () => orders.filter((order) => isHistoricalOrder(order.status)),
        [orders]
    );

    return (
        <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
            <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
                <Link
                    href="/account"
                    className="text-sm text-neutral-600 underline-offset-4 hover:underline"
                >
                    ← Tilbake til mi side
                </Link>

                <div className="mt-6 rounded-[24px] border border-rose-100 bg-[#fffafa] p-6">
                    <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                        Mi side
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                        Mine bestillingar
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600">
                        Her finn de aktive bestillingar og tidlegare ordre. Detaljar og eventuelle val finn de inne på kvar enkelt bestilling.
                    </p>
                </div>

                {loading ? (
                    <p className="mt-6 text-sm text-neutral-500">Hentar bestillingar …</p>
                ) : !user ? (
                    <div className="mt-6 rounded-[18px] border border-neutral-200 bg-white p-5 text-sm text-neutral-600">
                        Logg inn for å sjå bestillingane dykkar.
                    </div>
                ) : error ? (
                    <div className="mt-6 rounded-[18px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                        {error}
                    </div>
                ) : (
                    <div className="mt-8 space-y-10">
                        <section>
                            <div className="flex items-end justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-medium">Aktive bestillingar</h2>
                                    <p className="mt-1 text-sm text-neutral-500">
                                        Bestillingar som er nye, under behandling, pakka eller ventar på svar.
                                    </p>
                                </div>
                                <Link
                                    href="/account/order"
                                    className="hidden rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-900 transition hover:bg-rose-100 md:inline-flex"
                                >
                                    Ny bestilling
                                </Link>
                            </div>

                            <div className="mt-4 space-y-3">
                                {activeOrders.length ? (
                                    activeOrders.map((order) => (
                                        <OrderCard key={order.id} order={order} />
                                    ))
                                ) : (
                                    <div className="rounded-[18px] border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
                                        Ingen aktive bestillingar akkurat no.
                                    </div>
                                )}
                            </div>
                        </section>

                        <section>
                            <h2 className="text-xl font-medium">Tidlegare bestillingar</h2>
                            <p className="mt-1 text-sm text-neutral-500">
                                Ferdige, henta, sende eller kansellerte ordre.
                            </p>

                            <div className="mt-4 space-y-3">
                                {historicalOrders.length ? (
                                    historicalOrders.map((order) => (
                                        <OrderCard key={order.id} order={order} muted />
                                    ))
                                ) : (
                                    <div className="rounded-[18px] border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
                                        Ingen tidlegare bestillingar enno.
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </main>
    );
}

function OrderCard({ order, muted = false }: { order: CustomerOrder; muted?: boolean }) {
    const needsAction = order.status === "change_requested";
    const isCancelled = order.status === "cancelled";

    return (
        <div
            className={`rounded-[18px] border p-5 ${needsAction
                ? "border-amber-300 bg-amber-50"
                : isCancelled
                    ? "border-neutral-300 bg-neutral-100"
                    : muted
                        ? "border-neutral-200 bg-white/70"
                        : "border-rose-100 bg-white"
                }`}
        >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                        {order.createdAtLabel}
                    </div>
                    {order.isBackorder ? (
                        <div className="mt-2 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-800">
                            Restordre
                        </div>
                    ) : null}
                    <h3 className="mt-2 text-lg font-medium text-neutral-900">
                        {order.orderNumber || "Ordrenummer kjem"}
                    </h3>
                    {order.isBackorder && order.parentOrderNumber ? (
                        <p className="mt-1 text-sm text-neutral-500">
                            Restordre frå ordre {order.parentOrderNumber}
                        </p>
                    ) : null}
                    {isCancelled ? (
                        <p className="mt-2 text-sm text-neutral-600">
                            Denne bestillinga er kansellert.
                        </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                        <span>{order.lineCount} varetypar</span>
                        <span>·</span>
                        <span>{order.unitCount} einingar</span>
                        <span>·</span>
                        <span>{formatCurrency(order.totalExVat)} eks. mva.</span>
                    </div>
                </div>

                <div className="flex flex-col items-start gap-3 md:items-end">
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${orderStatusStyles(order.status)}`}>
                        {orderStatusLabel(order.status)}
                    </span>

                    <Link
                        href={`/account/orders/${order.id}`}
                        className={
                            needsAction
                                ? "rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-900 transition hover:bg-rose-100"
                                : isCancelled
                                    ? "rounded-full border border-neutral-300 bg-white/70 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-white"
                                    : "rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
                        }
                    >
                        {needsAction ? "Sjå og svar" : "Sjå ordre"}
                    </Link>
                </div>
            </div>
        </div>
    );
}