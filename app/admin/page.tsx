"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  setProductionBatchLabelPrintingSkipped,
  subscribeProductionBatches,
  type ProductionBatch,
} from "@/lib/production/batchesFirestore";
import type { LabelTemplateVersion } from "@/lib/production/labelTemplateAdmin";

type DashboardOrder = {
  id: string;
  orderNumber: string | null;
  customerName: string;
  status: string;
  createdAtMs: number;
};

const finishedStatuses = new Set([
  "picked_up",
  "shipped",
  "delivered",
  "cancelled",
]);

const statusLabels: Record<string, string> = {
  new: "Ny ordre",
  processing: "Under behandling",
  packed: "Pakka",
  partial: "Delpakka",
  change_requested: "Kundegodkjenning",
  picked_up: "Henta",
  shipped: "Sendt",
  delivered: "Levert",
  cancelled: "Kansellert",
};

function formatDate(timestamp: number) {
  if (!timestamp) return "Ukjend dato";
  return new Intl.DateTimeFormat("nn-NO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export default function AdminOverviewPage() {
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [pendingChangeRequests, setPendingChangeRequests] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [templates, setTemplates] = useState<LabelTemplateVersion[]>([]);

  useEffect(() => {
    const ordersQuery = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(
        snapshot.docs.map((orderDoc) => {
          const data = orderDoc.data();
          return {
            id: orderDoc.id,
            orderNumber:
              typeof data.orderNumber === "string" ? data.orderNumber : null,
            customerName:
              data.customerDisplayName ||
              data.customerName ||
              data.customerCompanyName ||
              "Ukjend kunde",
            status: typeof data.status === "string" ? data.status : "new",
            createdAtMs: data.createdAt?.toMillis?.() || 0,
          };
        }),
      );
      setLoading(false);
    });

    const requestsQuery = query(
      collection(db, "orderChangeRequests"),
      where("status", "==", "pending"),
    );
    const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
      setPendingChangeRequests(snapshot.size);
    });

    const unsubscribeCustomers = onSnapshot(
      collection(db, "customers"),
      (snapshot) => {
        setCustomerCount(snapshot.size);
      },
    );

    return () => {
      unsubscribeOrders();
      unsubscribeRequests();
      unsubscribeCustomers();
    };
  }, []);
  useEffect(() => subscribeProductionBatches(setBatches), []);
  useEffect(() => {
    (async () => {
      const user = auth.currentUser;
      if (!user) return;
      const response = await fetch("/api/admin/label-templates", {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      if (!response.ok) return;
      const body = await response.json();
      setTemplates(body.templates || []);
    })();
  }, []);

  const activeOrders = useMemo(
    () => orders.filter((order) => !finishedStatuses.has(order.status)),
    [orders],
  );
  const newOrders = activeOrders.filter((order) => order.status === "new");
  const inProgressOrders = activeOrders.filter((order) =>
    ["processing", "packed", "partial"].includes(order.status),
  );
  const approvals = activeOrders.filter(
    (order) => order.status === "change_requested",
  );
  const actionCount =
    newOrders.length + approvals.length + pendingChangeRequests;
  const actionOrders = activeOrders.filter((order) =>
    ["new", "change_requested"].includes(order.status),
  );
  const productionActions = batches.filter((batch) => {
    if (batch.status === "in_progress") return true;
    if (batch.labelPrintingSkipped) return false;
    return batch.recipeSnapshot.outputs.some((output) => {
      const quantity = Number(batch.outputQuantities?.[output.id] || 0);
      const hasTemplate = templates.some(
        (item) =>
          item.outputId === output.id && item.kind === "product" && item.active,
      );
      return (
        quantity > 0 &&
        hasTemplate &&
        !batch.labelDownloads?.[`${output.id}_product`]
      );
    });
  });

  return (
    <main className="min-h-screen text-[color:var(--admin-ink)]">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">
        <header className="flex flex-col gap-5 border-b border-[color:var(--admin-line)] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--admin-muted)]">
              Oversikt
            </p>
            <h1
              className="mt-2 text-3xl tracking-tight md:text-4xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              God arbeidsdag
            </h1>
            <p className="mt-2 text-sm leading-6 text-[color:var(--admin-muted)]">
              Her ser du kva som ventar, og kjem raskt vidare til dei viktigaste
              oppgåvene.
            </p>
          </div>
          <Link
            href="/admin/orders/new"
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--admin-accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--admin-accent-hover)]"
          >
            Ny manuell ordre
          </Link>
        </header>

        <section
          className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Nøkkeltal"
        >
          {[
            {
              label: "Krev merksemd",
              value: actionCount,
              href: "/admin/orders",
              tone: actionCount ? "warm" : "neutral",
            },
            {
              label: "Nye ordrar",
              value: newOrders.length,
              href: "/admin/orders?filter=new",
              tone: newOrders.length ? "green" : "neutral",
            },
            {
              label: "I arbeid",
              value: inProgressOrders.length,
              href: "/admin/orders?filter=processing",
              tone: "neutral",
            },
            {
              label: "Kundar",
              value: customerCount,
              href: "/admin/customers",
              tone: "neutral",
            },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`group rounded-[18px] border p-5 transition hover:-translate-y-0.5 hover:shadow-sm ${
                item.tone === "warm"
                  ? "border-amber-200 bg-amber-50/70"
                  : item.tone === "green"
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-[color:var(--admin-line)] bg-[color:var(--admin-card)]"
              }`}
            >
              <p className="text-xs font-medium text-[color:var(--admin-muted)]">
                {item.label}
              </p>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-semibold tracking-tight">
                  {loading ? "–" : item.value}
                </p>
                <span className="text-sm text-[color:var(--admin-faint)] transition group-hover:translate-x-0.5">
                  →
                </span>
              </div>
            </Link>
          ))}
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.7fr)]">
          <section className="rounded-[22px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Ordrar som krev handling
                </h2>
                <p className="mt-1 text-sm text-[color:var(--admin-muted)]">
                  Nye ordrar og kundesvar som ventar på deg.
                </p>
              </div>
              <Link
                href="/admin/orders"
                className="text-xs font-medium text-[color:var(--admin-accent)] hover:underline"
              >
                Alle ordrar
              </Link>
            </div>

            <div className="mt-5 divide-y divide-[color:var(--admin-line)]">
              {loading ? (
                <p className="py-8 text-sm text-[color:var(--admin-muted)]">
                  Lastar ordrar …
                </p>
              ) : actionOrders.length ? (
                actionOrders.slice(0, 6).map((order) => (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    className="group flex items-center justify-between gap-4 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {order.customerName}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--admin-muted)]">
                        {order.orderNumber || "Utan ordrenummer"} ·{" "}
                        {formatDate(order.createdAtMs)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="rounded-full bg-[color:var(--admin-active)] px-2.5 py-1 text-[11px] text-[color:var(--admin-muted)]">
                        {statusLabels[order.status] || order.status}
                      </span>
                      <span className="text-sm text-[color:var(--admin-faint)] transition group-hover:translate-x-0.5">
                        →
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="py-8 text-sm text-[color:var(--admin-muted)]">
                  Ingen ordrar krev handling akkurat no.
                </p>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[22px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5">
              <h2 className="text-base font-semibold tracking-tight">
                Snarvegar
              </h2>
              <div className="mt-4 grid gap-2">
                {[
                  ["Ny ordre", "/admin/orders/new"],
                  ["Ny produksjon", "/admin/production"],
                  ["Ny kunde", "/admin/customers"],
                  ["Registrer henting", "/admin/pickups/new"],
                  ["Oppdater lager", "/admin/inventory"],
                  ["Rediger nettsida", "/admin/website"],
                ].map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between rounded-[12px] border border-[color:var(--admin-line)] bg-white px-3.5 py-3 text-sm transition hover:border-[color:var(--admin-line-strong)]"
                  >
                    {label}
                    <span className="text-[color:var(--admin-faint)]">→</span>
                  </Link>
                ))}
              </div>
            </section>
          </aside>
        </div>
        <section className="mt-6 rounded-[22px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Produksjon som krev handling
              </h2>
              <p className="mt-1 text-sm text-[color:var(--admin-muted)]">
                Pågåande produksjon og batchar der produktetikettar ikkje er
                lasta ned.
              </p>
            </div>
            <Link
              href="/admin/production/batches"
              className="text-xs font-medium text-[color:var(--admin-accent)] hover:underline"
            >
              Batchregister
            </Link>
          </div>
          <div className="mt-5 divide-y divide-[color:var(--admin-line)]">
            {productionActions.length ? (
              productionActions.map((batch) => {
                const ongoing = batch.status === "in_progress";
                return (
                  <div
                    key={batch.id}
                    className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Link
                      href={`/admin/production?batch=${encodeURIComponent(batch.id)}`}
                      className="group min-w-0"
                    >
                      <p className="text-sm font-medium">
                        {batch.recipeName} · {batch.batchNumber}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--admin-muted)]">
                        {ongoing
                          ? "Produksjonen er ikkje fullført"
                          : "Produktetikettar manglar"}{" "}
                        <span className="ml-1 transition group-hover:translate-x-0.5">
                          →
                        </span>
                      </p>
                    </Link>
                    {!ongoing ? (
                      <button
                        onClick={() =>
                          setProductionBatchLabelPrintingSkipped(batch.id, true)
                        }
                        className="text-left text-xs font-medium text-[color:var(--admin-muted)] hover:text-[color:var(--admin-ink)]"
                      >
                        Skal ikkje skrivast ut
                      </button>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <p className="py-8 text-sm text-[color:var(--admin-muted)]">
                Ingen produksjonsoppgåver krev handling akkurat no.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
