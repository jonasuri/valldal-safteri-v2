"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

type OrderStatus =
    | "new"
    | "processing"
    | "packed"
    | "partial"
    | "picked_up"
    | "shipped"
    | "delivered"
    | "change_requested"
    | "cancelled";

type BackorderStatus = "none" | "open" | "cancelled" | "waiting_for_stock";

type OrderRow = {
    id: string;
    orderNumber: string;
    customerName: string;
    customerDisplayName: string;
    customerCompanyName: string;
    createdAt: string;
    status: OrderStatus;
    lineCount: number;
    unitCount: number;
    totalExVat: number;
    approvalStatus: string;
    approvalResponse: string | null;
    backorderStatus: BackorderStatus;
    missingUnits: number;
    isBackorder: boolean;
    parentOrderNumber: string | null;
    source: "customer" | "manual";
    isSandbox: boolean;
    sandboxEmailsEnabled: boolean;
    invoiceStatus: "not_invoiced" | "invoiced";
    invoicedAt: string | null;
};

type OrderFilter =
    | "all"
    | "approval"
    | "partial"
    | "new"
    | "work"
    | "processing"
    | "packed"
    | "backorder";

const statusLabels: Record<OrderStatus, string> = {
    new: "Ny",
    processing: "Under behandling",
    packed: "Pakka",
    partial: "Delpakka",
    picked_up: "Henta",
    shipped: "Sendt",
    delivered: "Levert",
    change_requested: "Ventande godkjenning",
    cancelled: "Kansellert",
};

const statusStyles: Record<OrderStatus, string> = {
    new: "border-blue-200 bg-blue-50 text-blue-700",
    processing: "border-amber-200 bg-amber-50 text-amber-800",
    packed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    partial: "border-amber-200 bg-amber-50 text-amber-800",
    picked_up: "border-emerald-200 bg-emerald-50 text-emerald-800",
    shipped: "border-emerald-200 bg-emerald-50 text-emerald-800",
    delivered: "border-emerald-200 bg-emerald-50 text-emerald-800",
    change_requested: "border-rose-200 bg-rose-50 text-rose-700",
    cancelled: "border-neutral-200 bg-neutral-50 text-neutral-500",
};

const orderFilters: { value: OrderFilter; label: string }[] = [
    { value: "all", label: "Alle" },
    { value: "work", label: "Under arbeid" },
    { value: "approval", label: "Ventande godkjenning" },
    { value: "partial", label: "Delpakka" },
    { value: "new", label: "Nye" },
    { value: "processing", label: "Under behandling" },
    { value: "packed", label: "Pakka" },
    { value: "backorder", label: "Restordre" },
];

function approvalResponseLabel(response: string | null) {
    if (response === "deliver_partial_later") {
        return "Klar for levering";
    }

    if (response === "deliver_partial_cancel_rest") {
        return "Klar for levering";
    }

    if (response === "wait_for_complete") {
        return "Ventar på resten";
    }

    return null;
}

function backorderStatusLabel(status: BackorderStatus) {
    const labels: Record<BackorderStatus, string | null> = {
        none: null,
        open: "Handling krevst: restordre",
        cancelled: "Rest sletta",
        waiting_for_stock: "Ventar på varer",
    };

    return labels[status];
}

function isHistoricalOrder(status: OrderStatus) {
    return status === "picked_up" || status === "shipped" || status === "delivered" || status === "cancelled";
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("nb-NO", {
        style: "currency",
        currency: "NOK",
        maximumFractionDigits: 2,
    }).format(value);
}

function getOrderPriority(order: OrderRow) {
    if (order.status === "new") return 1;

    if (order.status === "change_requested") return 2;

    if (order.backorderStatus === "waiting_for_stock") return 3;

    if (order.isBackorder) return 4;

    if (order.backorderStatus === "open") return 5;

    if (order.status === "processing") return 6;

    if (order.status === "partial") return 7;

    if (order.status === "packed") return 8;

    if (order.status === "shipped" || order.status === "picked_up") return 9;

    if (order.status === "delivered") return 10;

    if (order.status === "cancelled") return 11;

    return 12;
}

function sortOrders(orders: OrderRow[]) {
    return [...orders].sort((a, b) => {
        const priorityDiff = getOrderPriority(a) - getOrderPriority(b);

        if (priorityDiff !== 0) {
            return priorityDiff;
        }

        return 0;
    });
}

function filterOrders(orders: OrderRow[], filter: OrderFilter) {
    if (filter === "all") return orders;
    if (filter === "approval") return orders.filter((order) => order.status === "change_requested");
    if (filter === "partial") return orders.filter((order) => order.status === "partial");
    if (filter === "new") return orders.filter((order) => order.status === "new");
    if (filter === "work") {
        return orders.filter((order) => ["processing", "packed", "partial"].includes(order.status));
    }
    if (filter === "processing") return orders.filter((order) => order.status === "processing");
    if (filter === "packed") return orders.filter((order) => order.status === "packed");
    if (filter === "backorder") {
        return orders.filter(
            (order) => order.isBackorder || order.backorderStatus === "open" || order.backorderStatus === "waiting_for_stock"
        );
    }

    return orders;
}

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [activeFilter, setActiveFilter] = useState<OrderFilter>("all");
    const [historySearch, setHistorySearch] = useState("");
    const [showInvoicedHistory, setShowInvoicedHistory] = useState(false);
    const [pendingChangeRequestCounts, setPendingChangeRequestCounts] = useState<Record<string, number>>({});
    const activeOrders = orders.filter((order) => !isHistoricalOrder(order.status));
    const historicalOrders = orders.filter((order) => isHistoricalOrder(order.status));
    const normalizedHistorySearch = historySearch.trim().toLocaleLowerCase("nb-NO");
    const filteredHistoricalOrders = normalizedHistorySearch
        ? historicalOrders.filter((order) => {
            const searchableText = [
                order.orderNumber,
                order.customerName,
                order.customerDisplayName,
                order.customerCompanyName,
                statusLabels[order.status],
                order.parentOrderNumber,
                order.isBackorder ? "restordre" : null,
                order.invoiceStatus === "invoiced" ? "fakturert" : "ikkje fakturert",
            ]
                .filter(Boolean)
                .join(" ")
                .toLocaleLowerCase("nb-NO");

            return searchableText.includes(normalizedHistorySearch);
        })
        : historicalOrders;
    const billableHistoricalOrders = filteredHistoricalOrders.filter((order) => order.status !== "cancelled");
    const notInvoicedHistoricalOrders = billableHistoricalOrders.filter((order) => order.invoiceStatus !== "invoiced");
    const invoicedHistoricalOrders = filteredHistoricalOrders.filter(
        (order) => order.invoiceStatus === "invoiced" || order.status === "cancelled"
    );
    const activeRestorderCount = activeOrders.filter(
        (order) => order.isBackorder || order.backorderStatus === "open" || order.backorderStatus === "waiting_for_stock"
    ).length;
    const pendingApprovalCount = orders.filter((order) => order.status === "change_requested").length;
    const notInvoicedCount = notInvoicedHistoricalOrders.length;
    const sortedOrders = sortOrders(filterOrders(activeOrders, activeFilter));
    const appBadgeCount =
        orders.filter((order) => order.status === "new").length +
        pendingApprovalCount +
        activeRestorderCount;

    useEffect(() => {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const next: OrderRow[] = snapshot.docs.map((doc) => {
                const data = doc.data() as any;

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

                const missingUnits = Array.isArray(data.packing?.lines)
                    ? data.packing.lines.reduce(
                        (sum: number, line: any) =>
                            sum + (typeof line.missingQuantity === "number" ? line.missingQuantity : 0),
                        0
                    )
                    : 0;

                return {
                    id: doc.id,
                    orderNumber: data.orderNumber || doc.id.slice(0, 8).toUpperCase(),
                    customerName: customerDisplayName,
                    customerDisplayName,
                    customerCompanyName,
                    createdAt: data.createdAt?.toDate
                        ? data.createdAt.toDate().toLocaleDateString("nb-NO")
                        : "—",
                    status: (data.status || "new") as OrderStatus,
                    lineCount: data.lineCount || 0,
                    unitCount: data.unitCount || 0,
                    totalExVat: data.totalExVat || 0,
                    approvalStatus: typeof data.approval?.status === "string" ? data.approval.status : "not_required",
                    approvalResponse: typeof data.approval?.response === "string" ? data.approval.response : null,
                    backorderStatus: typeof data.backorder?.status === "string" ? data.backorder.status : "none",
                    missingUnits,
                    isBackorder: data.isBackorder === true,
                    parentOrderNumber: typeof data.parentOrderNumber === "string" ? data.parentOrderNumber : null,
                    source: data.source === "manual" ? "manual" : "customer",
                    isSandbox: data.sandbox?.enabled === true,
                    sandboxEmailsEnabled: data.sandbox?.sendEmails === true,
                    invoiceStatus: data.invoice?.status === "invoiced" ? "invoiced" : "not_invoiced",
                    invoicedAt: data.invoice?.invoicedAt?.toDate
                        ? data.invoice.invoicedAt.toDate().toLocaleDateString("nb-NO")
                        : null,
                };
            });

            setOrders(next);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const requestsQuery = query(
            collection(db, "orderChangeRequests"),
            where("status", "==", "pending")
        );

        const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
            const nextCounts: Record<string, number> = {};

            snapshot.docs.forEach((requestDoc) => {
                const data = requestDoc.data() as any;
                const orderId = typeof data.orderId === "string" ? data.orderId : "";

                if (!orderId) return;

                nextCounts[orderId] = (nextCounts[orderId] || 0) + 1;
            });

            setPendingChangeRequestCounts(nextCounts);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (typeof navigator === "undefined") return;

        const nav = navigator as Navigator & {
            setAppBadge?: (count?: number) => Promise<void>;
            clearAppBadge?: () => Promise<void>;
        };

        async function updateBadge() {
            try {
                if (appBadgeCount > 0 && nav.setAppBadge) {
                    await nav.setAppBadge(appBadgeCount);
                } else if (nav.clearAppBadge) {
                    await nav.clearAppBadge();
                }
            } catch {
                // Badge API not supported.
            }
        }

        void updateBadge();
    }, [appBadgeCount]);

    return (
        <main className="admin-orders-page min-h-screen text-[color:var(--admin-ink)]">
            <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
                <header className="flex flex-col gap-5 border-b border-[color:var(--admin-line)] pb-8 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--admin-muted)]">
                            Ordrearbeid
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                            <h1 className="text-3xl tracking-tight md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
                                Ordrar
                            </h1>

                            {appBadgeCount > 0 ? (
                                <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 md:hidden">
                                    {appBadgeCount} krev handling
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--admin-muted)]">
                            Nye bestillingar og oppgåver som ventar, ligg øvst. Ferdige ordrar er samla under fakturering og historikk.
                        </p>
                    </div>

                    <div>
                        <Link
                            href="/admin/orders/new"
                            className="inline-flex rounded-full bg-[color:var(--admin-accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--admin-accent-hover)]"
                        >
                            Ny manuell ordre
                        </Link>
                    </div>
                </header>

                <section className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-5">
                    <button type="button" onClick={() => setActiveFilter("new")} className="rounded-[18px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm md:p-5">
                        <p className="text-xs font-medium text-[color:var(--admin-muted)]">Nye</p>
                        <p className="mt-2 text-3xl font-semibold">{orders.filter((o) => o.status === "new").length}</p>
                    </button>
                    <button type="button" onClick={() => setActiveFilter("work")} className="rounded-[18px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm md:p-5">
                        <p className="text-xs font-medium text-[color:var(--admin-muted)]">Under arbeid</p>
                        <p className="mt-2 text-3xl font-semibold">{orders.filter((o) => o.status === "processing" || o.status === "packed" || o.status === "partial").length}</p>
                    </button>
                    <button type="button" onClick={() => setActiveFilter("approval")} className={`rounded-[18px] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm md:p-5 ${pendingApprovalCount > 0 ? "border-amber-200 bg-amber-50/80" : "border-[color:var(--admin-line)] bg-[color:var(--admin-card)]"}`}>
                        <p className={`text-xs font-medium ${pendingApprovalCount > 0 ? "text-amber-700" : "text-[color:var(--admin-muted)]"}`}>
                            Kundegodkjenning
                        </p>
                        <p className={`mt-2 text-3xl font-semibold ${pendingApprovalCount > 0 ? "text-amber-900" : "text-neutral-900"}`}>
                            {pendingApprovalCount}
                        </p>
                    </button>
                    <button type="button" onClick={() => setActiveFilter("backorder")} className={`rounded-[18px] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm md:p-5 ${activeRestorderCount > 0 ? "border-rose-200 bg-rose-50/80" : "border-[color:var(--admin-line)] bg-[color:var(--admin-card)]"}`}>
                        <p className={`text-xs font-medium ${activeRestorderCount > 0 ? "text-rose-700" : "text-[color:var(--admin-muted)]"}`}>Restordre</p>
                        <p className="mt-2 text-3xl font-semibold text-rose-900">
                            {activeRestorderCount}
                        </p>
                    </button>
                    <div className={`col-span-2 rounded-[18px] border p-4 md:p-5 xl:col-span-1 ${notInvoicedCount > 0 ? "border-amber-200 bg-amber-50/80" : "border-[color:var(--admin-line)] bg-[color:var(--admin-card)]"}`}>
                        <p className={`text-xs font-medium ${notInvoicedCount > 0 ? "text-amber-700" : "text-[color:var(--admin-muted)]"}`}>
                            Ikkje fakturert
                        </p>
                        <p className={`mt-2 text-3xl font-semibold ${notInvoicedCount > 0 ? "text-amber-900" : "text-neutral-900"}`}>
                            {notInvoicedCount}
                        </p>
                    </div>
                </section>

                <section className="mt-7 rounded-[22px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight">Aktive ordrar</h2>
                            <p className="mt-1 text-sm text-[color:var(--admin-muted)]">
                                Sortert etter kva som bør handterast først.
                            </p>
                        </div>

                        <div className="admin-scrollbar flex gap-1 overflow-x-auto pb-1">
                            {orderFilters.map((filter) => {
                                const isActive = activeFilter === filter.value;

                                return (
                                    <button
                                        key={filter.value}
                                        type="button"
                                        onClick={() => setActiveFilter(filter.value)}
                                        className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition ${isActive
                                            ? "bg-[color:var(--admin-ink)] text-white"
                                            : "text-[color:var(--admin-muted)] hover:bg-black/5"
                                            }`}
                                    >
                                        {filter.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-6 space-y-3 md:hidden">
                        {sortedOrders.length ? (
                            sortedOrders.map((order) => (
                                <Link
                                    key={order.id}
                                    href={`/admin/orders/${order.id}`}
                                    className="block rounded-[18px] border border-[color:var(--admin-line)] bg-white p-4 transition active:scale-[0.99]"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-medium text-neutral-950">
                                                {order.orderNumber}
                                            </div>
                                            <div className="mt-1 text-sm text-neutral-600">
                                                {order.customerDisplayName || order.customerName}
                                            </div>
                                            {order.customerDisplayName !== order.customerCompanyName ? (
                                                <div className="mt-1 text-xs text-neutral-500">
                                                    Fakturerast til: {order.customerCompanyName}
                                                </div>
                                            ) : null}
                                        </div>
                                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${statusStyles[order.status]}`}>
                                            {statusLabels[order.status]}
                                        </span>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {order.isSandbox ? (
                                            <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800">
                                                Sandbox · e-post {order.sandboxEmailsEnabled ? "på" : "av"}
                                            </span>
                                        ) : null}
                                        {pendingChangeRequestCounts[order.id] ? (
                                            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
                                                Endringsønske ({pendingChangeRequestCounts[order.id]})
                                            </span>
                                        ) : null}
                                        {order.isBackorder ? (
                                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-800">
                                                Restordre
                                            </span>
                                        ) : null}

                                        {order.source === "manual" ? (
                                            <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600">
                                                Manuell ordre
                                            </span>
                                        ) : null}

                                        {order.approvalStatus === "answered" && approvalResponseLabel(order.approvalResponse) ? (
                                            <span
                                                className={`rounded-full border px-2.5 py-1 text-xs ${order.approvalResponse === "wait_for_complete"
                                                    ? "border-amber-200 bg-amber-50 text-amber-800"
                                                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                                                    }`}
                                            >
                                                {approvalResponseLabel(order.approvalResponse)}
                                            </span>
                                        ) : null}

                                        {backorderStatusLabel(order.backorderStatus) && order.approvalResponse !== "wait_for_complete" ? (
                                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs text-rose-800">
                                                {backorderStatusLabel(order.backorderStatus)}
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-neutral-600">
                                        <div>
                                            <div className="text-xs uppercase tracking-[0.12em] text-neutral-400">
                                                Innhald
                                            </div>
                                            <div className="mt-1">
                                                {order.lineCount} varetypar · {order.unitCount} einingar
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs uppercase tracking-[0.12em] text-neutral-400">
                                                Sum
                                            </div>
                                            <div className="mt-1 font-medium text-neutral-900">
                                                {formatCurrency(order.totalExVat)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-3 text-sm">
                                        <span className="text-neutral-500">{order.createdAt}</span>
                                        <span className="font-medium text-neutral-800">Opne →</span>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="rounded-[20px] border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
                                {activeFilter === "all" ? "Ingen aktive ordre akkurat no." : "Ingen ordre passar dette filteret."}
                            </div>
                        )}
                    </div>

                    <div className="mt-6 hidden overflow-x-auto rounded-[16px] border border-[color:var(--admin-line)] md:block">
                        <table className="w-full min-w-[980px] text-left text-sm">
                            <thead className="bg-black/[0.018] text-[10px] uppercase tracking-[0.12em] text-[color:var(--admin-faint)]">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Ordre</th>
                                    <th className="px-4 py-3 font-medium">Kunde</th>
                                    <th className="px-4 py-3 font-medium">Dato</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Oppfølging</th>
                                    <th className="px-4 py-3 font-medium">Innhald</th>
                                    <th className="px-4 py-3 font-medium">Sum</th>
                                    <th className="px-4 py-3 font-medium">Handling</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {sortedOrders.length ? (
                                    sortedOrders.map((order) => (
                                        <tr key={order.id} className={`transition hover:bg-black/[0.022] ${order.status === "new" || order.status === "change_requested" ? "bg-amber-50/35" : ""}`}>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-neutral-900">
                                                    {order.orderNumber}
                                                </div>
                                                {order.isBackorder ? (
                                                    <div className="mt-1 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                                                        Restordre
                                                    </div>
                                                ) : null}
                                                {order.source === "manual" ? (
                                                    <div className="mt-1 inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600">
                                                        Manuell ordre
                                                    </div>
                                                ) : null}
                                                {order.isBackorder && order.parentOrderNumber ? (
                                                    <div className="mt-1 text-xs text-neutral-500">
                                                        Frå ordre {order.parentOrderNumber}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3 text-neutral-700">
                                                <div>{order.customerDisplayName || order.customerName}</div>
                                                {order.customerDisplayName !== order.customerCompanyName ? (
                                                    <div className="mt-1 text-xs text-neutral-500">
                                                        Fakturerast til: {order.customerCompanyName}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3 text-neutral-600">
                                                {order.createdAt}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-full border px-2.5 py-1 text-xs ${statusStyles[order.status]}`}>
                                                    {statusLabels[order.status]}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {pendingChangeRequestCounts[order.id] ? (
                                                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
                                                            Endringsønske ({pendingChangeRequestCounts[order.id]})
                                                        </span>
                                                    ) : null}
                                                    {order.approvalStatus === "answered" && approvalResponseLabel(order.approvalResponse) ? (
                                                        <span
                                                            className={`rounded-full border px-2.5 py-1 text-xs ${order.approvalResponse === "wait_for_complete"
                                                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                                                : "border-emerald-200 bg-emerald-50 text-emerald-800"
                                                                }`}
                                                        >
                                                            {approvalResponseLabel(order.approvalResponse)}
                                                        </span>
                                                    ) : null}

                                                    {backorderStatusLabel(order.backorderStatus) && order.approvalResponse !== "wait_for_complete" ? (
                                                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs text-rose-800">
                                                            {backorderStatusLabel(order.backorderStatus)}
                                                        </span>
                                                    ) : null}

                                                    {order.approvalStatus !== "answered" && !backorderStatusLabel(order.backorderStatus) && !pendingChangeRequestCounts[order.id] ? (
                                                        <span className="text-xs text-neutral-400">—</span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-neutral-600">
                                                {order.lineCount} varetypar · {order.unitCount} einingar
                                            </td>
                                            <td className="px-4 py-3 text-neutral-700">
                                                {formatCurrency(order.totalExVat)} eks. mva.
                                            </td>
                                            <td className="px-4 py-3">
                                                <Link
                                                    href={`/admin/orders/${order.id}`}
                                                    className="inline-flex rounded-full border border-[color:var(--admin-line)] bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900"
                                                >
                                                    Opne →
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-sm text-neutral-500">
                                            {activeFilter === "all" ? "Ingen aktive ordre akkurat no." : "Ingen ordre passar dette filteret."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {historicalOrders.length ? (
                    <section className="mt-7 rounded-[22px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:p-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight">Fakturering og historikk</h2>
                                <p className="mt-1 text-sm text-[color:var(--admin-muted)]">
                                    Søk etter kunde, ordrenummer eller status og sjå ferdige ordre sortert etter fakturering.
                                </p>
                            </div>


                        </div>

                        <div className="mt-6 rounded-[18px] border border-amber-200 bg-amber-50 p-4">
                            <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-amber-950">Ikkje fakturert</h3>
                                    <p className="mt-1 text-xs text-amber-800">
                                        Desse bør kontrollerast og fakturerast vidare i rekneskapssystemet.
                                    </p>
                                </div>
                                <div className="text-sm font-medium text-amber-950">
                                    {notInvoicedHistoricalOrders.length} ordre
                                </div>
                            </div>

                            <div className="mt-4 overflow-x-auto rounded-[14px] border border-amber-200 bg-white">
                                <table className="w-full min-w-[860px] text-left text-sm">
                                    <thead className="bg-amber-50 text-xs uppercase tracking-[0.12em] text-amber-800">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Ordre</th>
                                            <th className="px-4 py-3 font-medium">Kunde</th>
                                            <th className="px-4 py-3 font-medium">Dato</th>
                                            <th className="px-4 py-3 font-medium">Status</th>
                                            <th className="px-4 py-3 font-medium">Sum</th>
                                            <th className="px-4 py-3 font-medium">Faktura</th>
                                            <th className="px-4 py-3 font-medium">Handling</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                        {notInvoicedHistoricalOrders.length ? (
                                            notInvoicedHistoricalOrders.map((order) => (
                                                <tr key={order.id}>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-neutral-900">
                                                            {order.orderNumber}
                                                        </div>
                                                        {order.isBackorder ? (
                                                            <div className="mt-1 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                                                                Restordre
                                                            </div>
                                                        ) : null}
                                                        {order.source === "manual" ? (
                                                            <div className="mt-1 inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600">
                                                                Manuell ordre
                                                            </div>
                                                        ) : null}
                                                        {order.isBackorder && order.parentOrderNumber ? (
                                                            <div className="mt-1 text-xs text-neutral-500">
                                                                Frå ordre {order.parentOrderNumber}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                    <td className="px-4 py-3 text-neutral-700">
                                                        <div className="font-medium text-neutral-900">
                                                            {order.customerDisplayName || order.customerName}
                                                        </div>
                                                        {order.customerDisplayName !== order.customerCompanyName ? (
                                                            <div className="mt-1 text-xs text-amber-800">
                                                                Fakturerast til: {order.customerCompanyName}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                    <td className="px-4 py-3 text-neutral-600">
                                                        {order.createdAt}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`rounded-full border px-2.5 py-1 text-xs ${statusStyles[order.status]}`}>
                                                            {statusLabels[order.status]}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-neutral-700">
                                                        {formatCurrency(order.totalExVat)} eks. mva.
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800">
                                                            Ikkje fakturert
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Link
                                                            href={`/admin/orders/${order.id}`}
                                                            className="text-sm font-medium text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline"
                                                        >
                                                            Opne →
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-500">
                                                    {historySearch.trim() ? "Ingen ikkje-fakturerte ordre passar søket." : "Ingen ferdige ordre ventar på fakturering."}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="mt-6 rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <button
                                    type="button"
                                    onClick={() => setShowInvoicedHistory((value) => !value)}
                                    className="flex flex-1 items-center justify-between gap-4 text-left"
                                >
                                    <div>
                                        <h3 className="text-sm font-medium text-neutral-950">Fakturerte og kansellerte ordre</h3>
                                        <p className="mt-1 text-xs text-neutral-500">
                                            {invoicedHistoricalOrders.length} ferdige ordre i historikken.
                                        </p>
                                    </div>
                                    <span className="text-sm font-medium text-neutral-700">
                                        {showInvoicedHistory ? "Lukk" : "Vis"}
                                    </span>
                                </button>

                            </div>

                            {showInvoicedHistory ? (
                                <div className="mt-4 space-y-4">
                                    <div className="w-full md:max-w-sm">
                                        <label htmlFor="history-search" className="sr-only">
                                            Søk i fakturert historikk
                                        </label>
                                        <input
                                            id="history-search"
                                            type="search"
                                            value={historySearch}
                                            onChange={(event) => setHistorySearch(event.target.value)}
                                            placeholder="Søk fakturerte ordre"
                                            className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                                        />
                                        {historySearch.trim() ? (
                                            <p className="mt-2 text-xs text-neutral-500">
                                                Viser {invoicedHistoricalOrders.length} fakturerte ordre.
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="overflow-x-auto rounded-[14px] border border-neutral-200 bg-white">
                                        <table className="w-full min-w-[900px] text-left text-sm">
                                            <thead className="bg-neutral-50 text-xs uppercase tracking-[0.12em] text-neutral-500">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium">Ordre</th>
                                                    <th className="px-4 py-3 font-medium">Kunde</th>
                                                    <th className="px-4 py-3 font-medium">Dato</th>
                                                    <th className="px-4 py-3 font-medium">Status</th>
                                                    <th className="px-4 py-3 font-medium">Sum</th>
                                                    <th className="px-4 py-3 font-medium">Faktura</th>
                                                    <th className="px-4 py-3 font-medium">Handling</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-neutral-100">
                                                {invoicedHistoricalOrders.length ? (
                                                    invoicedHistoricalOrders.map((order) => (
                                                        <tr key={order.id}>
                                                            <td className="px-4 py-3">
                                                                <div className="font-medium text-neutral-900">
                                                                    {order.orderNumber}
                                                                </div>
                                                                {order.isBackorder ? (
                                                                    <div className="mt-1 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                                                                        Restordre
                                                                    </div>
                                                                ) : null}
                                                                {order.source === "manual" ? (
                                                                    <div className="mt-1 inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600">
                                                                        Manuell ordre
                                                                    </div>
                                                                ) : null}
                                                                {order.isBackorder && order.parentOrderNumber ? (
                                                                    <div className="mt-1 text-xs text-neutral-500">
                                                                        Frå ordre {order.parentOrderNumber}
                                                                    </div>
                                                                ) : null}
                                                            </td>
                                                            <td className="px-4 py-3 text-neutral-700">
                                                                <div>{order.customerDisplayName || order.customerName}</div>
                                                                {order.customerDisplayName !== order.customerCompanyName ? (
                                                                    <div className="mt-1 text-xs text-neutral-500">
                                                                        Fakturerast til: {order.customerCompanyName}
                                                                    </div>
                                                                ) : null}
                                                            </td>
                                                            <td className="px-4 py-3 text-neutral-600">
                                                                {order.createdAt}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`rounded-full border px-2.5 py-1 text-xs ${statusStyles[order.status]}`}>
                                                                    {statusLabels[order.status]}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-neutral-700">
                                                                {formatCurrency(order.totalExVat)} eks. mva.
                                                            </td>
                                                            <td className="px-4 py-3 text-neutral-600">
                                                                {order.status === "cancelled" ? (
                                                                    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-600">
                                                                        Ikkje fakturerast
                                                                    </span>
                                                                ) : (
                                                                    <>
                                                                        <div className="font-medium text-neutral-800">
                                                                            {order.orderNumber}
                                                                        </div>
                                                                        {order.invoicedAt ? (
                                                                            <div className="mt-1 text-xs text-neutral-500">
                                                                                {order.invoicedAt}
                                                                            </div>
                                                                        ) : null}
                                                                    </>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <Link
                                                                    href={`/admin/orders/${order.id}`}
                                                                    className="text-sm font-medium text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline"
                                                                >
                                                                    Opne →
                                                                </Link>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-500">
                                                            {historySearch.trim() ? "Ingen ferdige ordre passar søket." : "Ingen fakturerte eller kansellerte ordre i historikken enno."}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </section>
                ) : null}

            </div>
        </main>
    );
}
