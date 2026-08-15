"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  subscribeProductionBatches,
  type ProductionBatch,
} from "@/lib/production/batchesFirestore";
import { auth } from "@/lib/firebase";
import type { LabelTemplateVersion } from "@/lib/production/labelTemplateAdmin";

const categoryColors: Record<string, string> = {
  Sylte: "#48a9d1",
  Saft: "#64be78",
  Gelé: "#5a3cff",
  Frisk: "#c879bd",
  Rein: "#d99470",
  Saus: "#c4b52e",
};

function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("nn-NO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value)
    : "Nett no";
}
function dateKey(batch: ProductionBatch) {
  const value = batch.completedAt || batch.createdAt || batch.updatedAt;
  return value
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
    : "unknown";
}
function dateHeading(key: string) {
  if (key === "unknown") return "Ukjend dato";
  return new Intl.DateTimeFormat("nn-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${key}T12:00:00`));
}

function startOfPeriod(period: string) {
  const now = new Date();
  if (period === "today")
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    return date;
  }
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  return null;
}

function BatchCard({
  batch,
  templates,
}: {
  batch: ProductionBatch;
  templates: LabelTemplateVersion[];
}) {
  const rawBatches = Object.values(batch.rawMaterialBatches || {}).filter(
    Boolean,
  );
  const requiredLabelJobs = batch.recipeSnapshot.outputs.flatMap((output) => {
    const quantity = Math.max(
      0,
      Number(batch.outputQuantities?.[output.id] || 0),
    );
    if (!quantity) return [];
    const product = templates.some(
      (item) =>
        item.outputId === output.id && item.kind === "product" && item.active,
    );
    const box = templates.some(
      (item) =>
        item.outputId === output.id && item.kind === "box" && item.active,
    );
    return [
      ...(product ? [`${output.id}_product`] : []),
      ...(box ? [`${output.id}_box`] : []),
    ];
  });
  const downloadedLabelJobs = requiredLabelJobs.filter(
    (key) => batch.labelDownloads?.[key],
  ).length;
  const downloadedSheets = requiredLabelJobs.reduce(
    (total, key) => total + Number(batch.labelDownloads?.[key]?.sheets || 0),
    0,
  );
  return (
    <Link
      href={`/admin/production?batch=${encodeURIComponent(batch.id)}`}
      className="group block rounded-[18px] border border-[color:var(--admin-line)] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[color:var(--admin-line-strong)] hover:shadow-sm"
      style={{
        borderLeft: `5px solid ${categoryColors[batch.category] || "#64748b"}`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted)]">
            {batch.category}
          </p>
          <h3 className="mt-1 truncate text-base font-semibold">
            {batch.recipeName}
          </h3>
          <p className="mt-1 text-xs font-medium text-[color:var(--admin-muted)]">
            {batch.batchNumber}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${batch.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
        >
          {batch.status === "completed" ? "Fullført" : "Pågåande"}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-[color:var(--admin-muted)]">Planlagt</dt>
          <dd className="mt-0.5 font-semibold">
            {batch.selectedPlan?.plannedPrimaryAmount || 0}{" "}
            {batch.recipeSnapshot?.primaryUnit || "kg/l"}
          </dd>
        </div>
        <div>
          <dt className="text-[color:var(--admin-muted)]">Resultat</dt>
          <dd className="mt-0.5 font-semibold">
            {batch.actualTotal == null
              ? "Ikkje registrert"
              : `${batch.actualTotal} kg/l`}
          </dd>
        </div>
      </dl>
      {rawBatches.length ? (
        <p className="mt-3 truncate text-[11px] text-[color:var(--admin-muted)]">
          Råvarebatch: {rawBatches.join(", ")}
        </p>
      ) : null}
      {(batch.completedByOperator?.name || batch.createdByOperator?.name) ? (
        <p className="mt-3 text-[11px] text-[color:var(--admin-muted)]">
          {batch.status === "completed" ? "Registrert" : "Starta"} av {batch.completedByOperator?.name || batch.createdByOperator?.name}
        </p>
      ) : null}
      {requiredLabelJobs.length ? (
        <div
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${downloadedLabelJobs === requiredLabelJobs.length ? "bg-emerald-50 text-emerald-700" : downloadedLabelJobs ? "bg-amber-50 text-amber-700" : "bg-neutral-100 text-neutral-600"}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${downloadedLabelJobs === requiredLabelJobs.length ? "bg-emerald-500" : downloadedLabelJobs ? "bg-amber-500" : "bg-neutral-400"}`}
          />
          {downloadedLabelJobs === requiredLabelJobs.length
            ? `Alle etikettar lasta ned${downloadedSheets ? ` · ${downloadedSheets} ark` : ""}`
            : downloadedLabelJobs
              ? `Etikettar ${downloadedLabelJobs}/${requiredLabelJobs.length}${downloadedSheets ? ` · ${downloadedSheets} ark` : ""}`
              : "Etikettar ikkje lasta ned"}
        </div>
      ) : null}
      <p className="mt-3 border-t border-[color:var(--admin-line)] pt-3 text-[11px] text-[color:var(--admin-muted)]">
        Oppdatert {formatDate(batch.updatedAt)}
      </p>
    </Link>
  );
}

export default function ProductionBatchesPage() {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [period, setPeriod] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [templates, setTemplates] = useState<LabelTemplateVersion[]>([]);

  useEffect(
    () =>
      subscribeProductionBatches(
        (next) => {
          setBatches(next);
          setLoading(false);
        },
        (nextError) => {
          setError(nextError.message);
          setLoading(false);
        },
      ),
    [],
  );
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

  const categories = [...new Set(batches.map((batch) => batch.category))];
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const from = startOfPeriod(period);
    return batches.filter((batch) => {
      const haystack = [
        batch.batchNumber,
        batch.recipeName,
        batch.category,
        batch.notes,
        ...Object.values(batch.rawMaterialBatches || {}),
      ]
        .join(" ")
        .toLowerCase();
      const date = batch.createdAt || batch.updatedAt;
      const day = date
        ? new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
          ).getTime()
        : 0;
      const manualFrom = dateFrom
        ? new Date(`${dateFrom}T00:00:00`).getTime()
        : 0;
      const manualTo = dateTo
        ? new Date(`${dateTo}T23:59:59`).getTime()
        : Number.POSITIVE_INFINITY;
      return (
        (!needle || haystack.includes(needle)) &&
        (status === "all" || batch.status === status) &&
        (category === "all" || batch.category === category) &&
        (!from || Boolean(date && date >= from)) &&
        (!dateFrom || day >= manualFrom) &&
        (!dateTo || day <= manualTo)
      );
    });
  }, [batches, search, status, category, period, dateFrom, dateTo]);
  const ongoing = filtered.filter((batch) => batch.status === "in_progress");
  const completed = filtered.filter((batch) => batch.status === "completed");
  const completedByDate = Object.entries(
    completed.reduce<Record<string, ProductionBatch[]>>((result, batch) => {
      (result[dateKey(batch)] ||= []).push(batch);
      return result;
    }, {}),
  );

  return (
    <main className="min-h-screen text-[color:var(--admin-ink)]">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">
        <header className="flex flex-col gap-5 border-b border-[color:var(--admin-line)] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--admin-muted)]">
              Produksjon
            </p>
            <h1
              className="mt-2 text-3xl tracking-tight md:text-4xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Batchregister
            </h1>
            <p className="mt-2 text-sm text-[color:var(--admin-muted)]">
              Finn pågåande produksjon, resultat og råvarebatchar.
            </p>
          </div>
          <Link
            href="/admin/production"
            className="rounded-full bg-[color:var(--admin-accent)] px-5 py-2.5 text-center text-sm font-medium text-white"
          >
            Ny produksjon
          </Link>
        </header>

        <section className="mt-7 grid gap-3 rounded-[20px] border border-[color:var(--admin-line)] bg-white p-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_repeat(5,150px)]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded-[11px] border border-[color:var(--admin-line-strong)] px-3 py-2.5 text-sm outline-none"
            placeholder="Søk batch, oppskrift eller råvarebatch"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-[11px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">Alle statusar</option>
            <option value="in_progress">Pågåande</option>
            <option value="completed">Fullførte</option>
          </select>
          <label className="text-[10px] font-semibold text-[color:var(--admin-muted)]">
            Frå dato
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPeriod("all");
              }}
              className="mt-1 block w-full rounded-[11px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2 text-sm text-[color:var(--admin-ink)]"
            />
          </label>
          <label className="text-[10px] font-semibold text-[color:var(--admin-muted)]">
            Til dato
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPeriod("all");
              }}
              className="mt-1 block w-full rounded-[11px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2 text-sm text-[color:var(--admin-ink)]"
            />
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-[11px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">Alle kategoriar</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="rounded-[11px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">Alle datoar</option>
            <option value="today">I dag</option>
            <option value="week">Denne veka</option>
            <option value="month">Denne månaden</option>
          </select>
        </section>

        {loading ? (
          <p className="mt-8 text-sm text-[color:var(--admin-muted)]">
            Hentar produksjon …
          </p>
        ) : error ? (
          <p className="mt-8 text-sm text-red-700">{error}</p>
        ) : (
          <div className="mt-8 space-y-10">
            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Pågåande</h2>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  {ongoing.length}
                </span>
              </div>
              {ongoing.length ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {ongoing.map((batch) => (
                    <BatchCard
                      key={batch.id}
                      batch={batch}
                      templates={templates}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-[16px] border border-dashed border-[color:var(--admin-line-strong)] p-6 text-sm text-[color:var(--admin-muted)]">
                  Ingen pågåande produksjonar i dette utvalet.
                </p>
              )}
            </section>
            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Historikk</h2>
                <span className="text-xs text-[color:var(--admin-muted)]">
                  {completed.length} batchar
                </span>
              </div>
              {completed.length ? (
                <div className="mt-4 space-y-8">
                  {completedByDate.map(([key, dayBatches]) => (
                    <section key={key}>
                      <div className="mb-3 flex items-center gap-3">
                        <h3 className="text-sm font-semibold capitalize">
                          {dateHeading(key)}
                        </h3>
                        <span className="text-xs text-[color:var(--admin-muted)]">
                          {dayBatches.length}{" "}
                          {dayBatches.length === 1 ? "batch" : "batchar"}
                        </span>
                        <span className="h-px flex-1 bg-[color:var(--admin-line)]" />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {dayBatches.map((batch) => (
                          <BatchCard
                            key={batch.id}
                            batch={batch}
                            templates={templates}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-[16px] border border-dashed border-[color:var(--admin-line-strong)] p-6 text-sm text-[color:var(--admin-muted)]">
                  Ingen fullførte produksjonar i dette utvalet.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
