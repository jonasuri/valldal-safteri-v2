"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { allProductionRecipes } from "@/lib/production/recipes.generated";
import {
  BLUEBERRY_JAM_RECIPE_ID,
  blueberryJamLabelTemplates,
} from "@/lib/production/labelTemplates";
import type {
  LabelTemplateKind,
  LabelTemplateVersion,
  LabelVariableField,
} from "@/lib/production/labelTemplateAdmin";

const categoryOrder = ["Sylte", "Saft", "Gelé", "Frisk", "Rein", "Saus"];
const recipe = allProductionRecipes.find(
  (item) => item.id === BLUEBERRY_JAM_RECIPE_ID,
)!;
type LabelDefaults = {
  boxLabelsPerSheet: number;
  bySize: Record<string, { labelsPerSheet: number; unitsPerBox?: number }>;
};
function sizeKey(output: { contentAmount: number; contentUnit: string }) {
  return `${String(output.contentAmount).replace(".", "-")}-${output.contentUnit}`;
}
const initialDefaults: LabelDefaults = {
  boxLabelsPerSheet: 8,
  bySize: Object.fromEntries(
    allProductionRecipes
      .flatMap((item) => item.outputs)
      .map((output) => [
        sizeKey(output),
        {
          labelsPerSheet:
            output.contentAmount === 80 && output.contentUnit === "ml" ? 14 : 8,
          ...(output.contentAmount === 80 && output.contentUnit === "ml"
            ? { unitsPerBox: 30 }
            : output.contentAmount === 195 && output.contentUnit === "ml"
              ? { unitsPerBox: 16 }
              : output.contentAmount === 390 && output.contentUnit === "ml"
                ? { unitsPerBox: 9 }
                : {}),
        },
      ]),
  ),
};

async function api(path: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error("Du må vere innlogga.");
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  const response = await fetch(path, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Noko gjekk gale.");
  return body;
}

export default function LabelTemplatesPage({
  recipeId,
}: {
  recipeId?: string;
}) {
  const [templates, setTemplates] = useState<LabelTemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState("");
  const [editing, setEditing] = useState<LabelTemplateVersion | null>(null);
  const [previewImage, setPreviewImage] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Alle");
  const [defaults, setDefaults] = useState<LabelDefaults>(initialDefaults);
  const [showDefaults, setShowDefaults] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const calibrationRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const body = await api("/api/admin/label-templates");
      setTemplates(body.templates || []);
      if (body.settings)
        setDefaults({
          ...initialDefaults,
          ...body.settings,
          bySize: {
            ...initialDefaults.bySize,
            ...(body.settings.bySize || {}),
          },
        });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Klarte ikkje å hente malane.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!editing) {
      setPreviewImage("");
      return;
    }
    let disposed = false;
    (async () => {
      const user = auth.currentUser;
      if (!user) return;
      const response = await fetch(
        `/api/admin/label-templates?file=${encodeURIComponent(editing.id)}`,
        { headers: { Authorization: `Bearer ${await user.getIdToken()}` } },
      );
      if (!response.ok) throw new Error("Klarte ikkje å hente PDF-en.");
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(await response.arrayBuffer()),
      }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Klarte ikkje å vise PDF-en.");
      await page.render({
        canvas,
        canvasContext: context,
        viewport,
        annotationMode: pdfjs.AnnotationMode.DISABLE,
      }).promise;
      if (!disposed) {
        setPreviewImage(canvas.toDataURL("image/png"));
        setPreviewError("");
      }
    })().catch((error) => {
      if (!disposed)
        setPreviewError(
          error instanceof Error
            ? error.message
            : "Klarte ikkje å vise PDF-en.",
        );
    });
    return () => {
      disposed = true;
    };
  }, [editing?.id]);

  const grouped = useMemo(
    () =>
      templates.reduce<Record<string, LabelTemplateVersion[]>>(
        (result, item) => {
          (result[item.outputId] ||= []).push(item);
          return result;
        },
        {},
      ),
    [templates],
  );

  const visibleRecipes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("nb-NO");
    return allProductionRecipes.filter(
      (item) =>
        (category === "Alle" || item.category === category) &&
        (!query ||
          item.name.toLocaleLowerCase("nb-NO").includes(query) ||
          item.outputs.some(
            (output) =>
              output.name.toLocaleLowerCase("nb-NO").includes(query) ||
              output.sku?.toLocaleLowerCase("nb-NO").includes(query),
          )),
    );
  }, [category, search]);
  const selectedRecipe = recipeId
    ? allProductionRecipes.find((item) => item.id === recipeId)
    : undefined;
  async function saveDefaults() {
    await api("/api/admin/label-templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: defaults }),
    });
    setMessage("Felles etikettstandardar er lagra.");
    setShowDefaults(false);
  }

  async function upload(
    recipeId: string,
    outputId: string,
    outputName: string,
    kind: LabelTemplateKind,
    file: File,
  ) {
    const config = blueberryJamLabelTemplates[outputId];
    const key = `${outputId}_${kind}`;
    const recipe = allProductionRecipes.find((item) => item.id === recipeId);
    const output = recipe?.outputs.find((item) => item.id === outputId);
    const sizeDefaults = output ? defaults.bySize[sizeKey(output)] : undefined;
    const labelsPerSheet =
      (kind === "product"
        ? sizeDefaults?.labelsPerSheet || output?.labelsPerSheet
        : defaults.boxLabelsPerSheet) || 8;
    setUploading(key);
    setMessage("");
    const data = new FormData();
    data.set("file", file);
    data.set("recipeId", recipeId);
    data.set("outputId", outputId);
    data.set("outputName", outputName);
    data.set("kind", kind);
    data.set("labelsPerSheet", String(labelsPerSheet));
    const boxUnits = sizeDefaults?.unitsPerBox || config?.unitsPerBox;
    if (kind === "box" && boxUnits) data.set("unitsPerBox", String(boxUnits));
    try {
      await api("/api/admin/label-templates", { method: "POST", body: data });
      setMessage(
        `${outputName}: ny ${kind === "product" ? "produktmal" : "eskemal"} er aktiv.`,
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Opplasting feila.");
    } finally {
      setUploading("");
    }
  }

  async function saveEdit() {
    if (!editing) return;
    try {
      const fields = editing.variableFields || [];
      await api("/api/admin/label-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          variableFields: fields,
          labelsPerSheet: editing.labelsPerSheet,
          unitsPerBox: editing.unitsPerBox,
        }),
      });
      setMessage(
        fields.some((item) => item.type === "date") &&
          fields.some((item) => item.type === "batch")
          ? "Kalibreringa er lagra. Du kan no gjere malen aktiv."
          : "Oppsettet er lagra, men malen manglar framleis dato eller partinummer.",
      );
      setEditing(null);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Klarte ikkje å lagre.",
      );
    }
  }

  async function activate(item: LabelTemplateVersion) {
    await api("/api/admin/label-templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, active: true }),
    });
    setMessage(`Versjon ${item.version} er aktiv.`);
    await load();
  }

  function updateField(id: string, changes: Partial<LabelVariableField>) {
    if (!editing) return;
    setEditing({
      ...editing,
      variableFields: (editing.variableFields || []).map((item) =>
        item.id === id ? { ...item, ...changes } : item,
      ),
    });
  }

  function addField(type: "date" | "batch") {
    if (!editing) return;
    const count =
      (editing.variableFields || []).filter((item) => item.type === type)
        .length + 1;
    const field: LabelVariableField = {
      id: `${type}-${Date.now()}`,
      type,
      x: editing.pageWidth * 0.4,
      y: editing.pageHeight * 0.5,
      width: type === "date" ? 42 : 50,
      height: 12,
      fontSize: 7,
    };
    setEditing({
      ...editing,
      variableFields: [...(editing.variableFields || []), field],
    });
    setSelectedFieldId(field.id);
  }

  function selectField(id: string) {
    setSelectedFieldId(id);
    requestAnimationFrame(() => calibrationRef.current?.focus());
  }

  function handleCalibrationKeyDown(event: React.KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
      !editing ||
      !selectedFieldId
    )
      return;
    const field = (editing.variableFields || []).find(
      (item) => item.id === selectedFieldId,
    );
    if (!field) return;
    const step = event.shiftKey ? 5 : 0.5;
    const movement: Record<string, Partial<LabelVariableField>> = {
      ArrowLeft: { x: Math.max(0, field.x - step) },
      ArrowRight: {
        x: Math.min(editing.pageWidth - field.width, field.x + step),
      },
      ArrowUp: {
        y: Math.min(editing.pageHeight - field.height, field.y + step),
      },
      ArrowDown: { y: Math.max(0, field.y - step) },
    };
    if (!movement[event.key]) return;
    event.preventDefault();
    updateField(field.id, movement[event.key]);
  }

  function beginPan(event: React.PointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest("[data-label-field]")
    )
      return;
    const scroller = previewScrollRef.current;
    if (!scroller) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = scroller.scrollLeft;
    const startTop = scroller.scrollTop;
    scroller.style.cursor = "grabbing";
    const move = (next: PointerEvent) => {
      scroller.scrollLeft = startLeft - (next.clientX - startX);
      scroller.scrollTop = startTop - (next.clientY - startY);
    };
    const up = () => {
      scroller.style.cursor = "grab";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function handlePreviewWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom((value) =>
      Math.min(2.5, Math.max(0.75, value + (event.deltaY < 0 ? 0.1 : -0.1))),
    );
  }

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
              {selectedRecipe ? selectedRecipe.name : "Etikettmalar"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--admin-muted)]">
              {selectedRecipe
                ? `${selectedRecipe.category} · Last opp og kalibrer etikettar for alle storleikar.`
                : "Vel ei oppskrift for å sjå variantar, laste opp PDF-malar og kalibrere plassering."}
            </p>
          </div>
          <Link
            href={
              selectedRecipe ? "/admin/production/labels" : "/admin/production"
            }
            className="admin-button-secondary px-4 py-2 text-xs"
          >
            {selectedRecipe ? "← Alle oppskrifter" : "← Produksjon"}
          </Link>
        </header>
        {message ? (
          <p className="mt-5 rounded-[12px] border border-[color:var(--admin-line)] bg-white px-4 py-3 text-sm">
            {message}
          </p>
        ) : null}
        {!selectedRecipe ? (
          <div className="mt-6 grid gap-3 rounded-[16px] border border-[color:var(--admin-line)] bg-white p-4 md:grid-cols-[1fr_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Søk etter oppskrift, produkt eller SKU"
              className="rounded-[10px] border border-[color:var(--admin-line-strong)] px-3 py-2.5 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {["Alle", ...categoryOrder].map((item) => (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={`rounded-full px-3 py-2 text-xs font-medium ${category === item ? "bg-[color:var(--admin-accent)] text-white" : "bg-[color:var(--admin-active)]"}`}
                >
                  {item}
                </button>
              ))}
              <button
                onClick={() => setShowDefaults(true)}
                className="admin-button-secondary px-3 py-2 text-xs"
              >
                Felles standardar
              </button>
            </div>
          </div>
        ) : null}
        {loading ? (
          <p className="mt-8 text-sm text-[color:var(--admin-muted)]">
            Hentar malbibliotek …
          </p>
        ) : (
          <div className="mt-7 space-y-4">
            {!selectedRecipe ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleRecipes.map((item) => {
                  const itemTemplates = item.outputs.flatMap(
                    (output) => grouped[output.id] || [],
                  );
                  const configured = item.outputs.filter((output) =>
                    (grouped[output.id] || []).some(
                      (template) =>
                        template.kind === "product" && template.active,
                    ),
                  ).length;
                  return (
                    <Link
                      key={item.id}
                      href={`/admin/production/labels/${item.id}`}
                      className="group rounded-[16px] border border-[color:var(--admin-line)] bg-white p-5 transition hover:border-[color:var(--admin-accent)] hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--admin-muted)]">
                            {item.category}
                          </p>
                          <h2 className="mt-2 text-lg font-semibold">
                            {item.name}
                          </h2>
                        </div>
                        <span className="text-lg text-[color:var(--admin-muted)] transition group-hover:translate-x-1">
                          →
                        </span>
                      </div>
                      <p className="mt-4 text-xs text-[color:var(--admin-muted)]">
                        {item.outputs.length} storleikar · {configured} med
                        aktiv etikett
                      </p>
                      {itemTemplates.some(
                        (template) => template.calibrationStatus === "required",
                      ) ? (
                        <p className="mt-2 text-xs font-medium text-amber-700">
                          Kalibrering manglar
                        </p>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ) : null}
            {(selectedRecipe ? [selectedRecipe] : [])
              .flatMap((currentRecipe) =>
                currentRecipe.outputs.map((output) => ({
                  currentRecipe,
                  output,
                })),
              )
              .map(({ currentRecipe, output }) => {
                const config = blueberryJamLabelTemplates[output.id];
                const items = grouped[output.id] || [];
                const product = items.find(
                  (item) => item.kind === "product" && item.active,
                );
                const box = items.find(
                  (item) => item.kind === "box" && item.active,
                );
                return (
                  <section
                    key={output.id}
                    className="overflow-hidden rounded-[20px] border border-[color:var(--admin-line)] bg-white"
                  >
                    <div className="flex flex-col gap-3 border-b border-[color:var(--admin-line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="font-semibold">{output.name}</h2>
                        <p className="mt-1 text-xs text-[color:var(--admin-muted)]">
                          {currentRecipe.category} · {currentRecipe.name}
                          {output.sku ? ` · SKU ${output.sku}` : ""} ·{" "}
                          {product?.labelsPerSheet || output.labelsPerSheet} per
                          ark
                          {box?.unitsPerBox || config?.unitsPerBox
                            ? ` · ${box?.unitsPerBox || config?.unitsPerBox} per eske`
                            : " · eskeoppsett ikkje registrert"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <label className="flex items-center gap-2 rounded-full border border-[color:var(--admin-line-strong)] bg-white px-3 py-1.5 text-xs">
                          Per ark
                          <span className="font-semibold">
                            {defaults.bySize[sizeKey(output)]?.labelsPerSheet ||
                              output.labelsPerSheet}
                          </span>
                        </label>
                        <label className="cursor-pointer rounded-full bg-[color:var(--admin-accent)] px-4 py-2 text-xs font-medium text-white hover:bg-[color:var(--admin-accent-hover)]">
                          {uploading === `${output.id}_product`
                            ? "Lastar opp …"
                            : product
                              ? "Erstatt produktmal"
                              : "Last opp produktmal"}
                          <input
                            type="file"
                            accept="application/pdf"
                            disabled={Boolean(uploading)}
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file)
                                void upload(
                                  currentRecipe.id,
                                  output.id,
                                  output.name,
                                  "product",
                                  file,
                                );
                            }}
                          />
                        </label>
                        <span className="rounded-full border border-[color:var(--admin-line-strong)] bg-white px-3 py-2 text-xs">
                          {defaults.bySize[sizeKey(output)]?.unitsPerBox
                            ? `${defaults.bySize[sizeKey(output)].unitsPerBox} per eske`
                            : "Ingen eskestandard"}
                        </span>
                        <label className="admin-button-secondary cursor-pointer px-4 py-2 text-xs">
                          {uploading === `${output.id}_box`
                            ? "Lastar opp …"
                            : box
                              ? "Erstatt eskemal"
                              : "Last opp eskemal"}
                          <input
                            type="file"
                            accept="application/pdf"
                            disabled={
                              Boolean(uploading) ||
                              !(
                                defaults.bySize[sizeKey(output)]?.unitsPerBox ||
                                box?.unitsPerBox ||
                                config?.unitsPerBox
                              )
                            }
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file)
                                void upload(
                                  currentRecipe.id,
                                  output.id,
                                  output.name,
                                  "box",
                                  file,
                                );
                            }}
                          />
                        </label>
                      </div>
                    </div>
                    <div className="grid gap-px bg-[color:var(--admin-line)] md:grid-cols-2">
                      {(["product", "box"] as LabelTemplateKind[]).map(
                        (kind) => {
                          const active = kind === "product" ? product : box;
                          const history = items.filter(
                            (item) => item.kind === kind,
                          );
                          const latest = active || history[0];
                          return (
                            <div key={kind} className="bg-white p-5">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold">
                                  {kind === "product"
                                    ? "Produktetikett"
                                    : "Eskeetikett"}
                                </h3>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${active ? "bg-emerald-50 text-emerald-700" : latest ? "bg-amber-50 text-amber-700" : "bg-neutral-100 text-neutral-600"}`}
                                >
                                  {active
                                    ? `Aktiv v${active.version}`
                                    : latest
                                      ? `Må kalibrerast · v${latest.version}`
                                      : "Innebygd reserve"}
                                </span>
                              </div>
                              {latest ? (
                                <>
                                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                      <dt className="text-[color:var(--admin-muted)]">
                                        Ark
                                      </dt>
                                      <dd className="mt-0.5 font-semibold">
                                        {Math.round(latest.pageWidth)} ×{" "}
                                        {Math.round(latest.pageHeight)} pt
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-[color:var(--admin-muted)]">
                                        PDF-sider
                                      </dt>
                                      <dd className="mt-0.5 font-semibold">
                                        {latest.pageCount}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-[color:var(--admin-muted)]">
                                        Datoplasseringar
                                      </dt>
                                      <dd
                                        className={`mt-0.5 font-semibold ${(latest.variableFields || []).some((item) => item.type === "date") ? "text-emerald-700" : "text-amber-700"}`}
                                      >
                                        {(latest.variableFields || []).filter(
                                          (item) => item.type === "date",
                                        ).length || "Manglar"}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-[color:var(--admin-muted)]">
                                        Partinr-plasseringar
                                      </dt>
                                      <dd
                                        className={`mt-0.5 font-semibold ${(latest.variableFields || []).some((item) => item.type === "batch") ? "text-emerald-700" : "text-amber-700"}`}
                                      >
                                        {(latest.variableFields || []).filter(
                                          (item) => item.type === "batch",
                                        ).length || "Manglar"}
                                      </dd>
                                    </div>
                                  </dl>
                                  {latest.annotationCount ? (
                                    <p className="mt-3 text-[11px] text-amber-700">
                                      PDF-en inneheld {latest.annotationCount}{" "}
                                      merknader. Dei blir fjerna ved utskrift.
                                    </p>
                                  ) : null}
                                  <div className="mt-4 flex gap-2">
                                    <button
                                      onClick={() => {
                                        setEditing(latest);
                                        setSelectedFieldId(
                                          latest.variableFields?.[0]?.id || "",
                                        );
                                      }}
                                      className="admin-button-secondary px-3 py-1.5 text-xs"
                                    >
                                      Kalibrer plassering
                                    </button>
                                    {!latest.active &&
                                    latest.calibrationStatus === "ready" ? (
                                      <button
                                        onClick={() => activate(latest)}
                                        className="rounded-full bg-[color:var(--admin-accent)] px-3 py-1.5 text-xs font-medium text-white"
                                      >
                                        Gjer aktiv
                                      </button>
                                    ) : null}
                                  </div>
                                </>
                              ) : (
                                <p className="mt-4 text-xs leading-5 text-[color:var(--admin-muted)]">
                                  Dagens mal frå prosjektet blir brukt til du
                                  lastar opp ei ny utgåve.
                                </p>
                              )}
                              {history.length > 1 ? (
                                <details className="mt-4 border-t border-[color:var(--admin-line)] pt-3">
                                  <summary className="cursor-pointer text-xs font-medium">
                                    Versjonshistorikk ({history.length})
                                  </summary>
                                  <div className="mt-2 space-y-2">
                                    {history.map((item) => (
                                      <div
                                        key={item.id}
                                        className="flex items-center justify-between rounded-[9px] bg-[color:var(--admin-active)] px-3 py-2 text-xs"
                                      >
                                        <span>
                                          v{item.version} · {item.fileName}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => {
                                              setEditing(item);
                                              setSelectedFieldId(
                                                item.variableFields?.[0]?.id ||
                                                  "",
                                              );
                                            }}
                                            className="font-semibold text-[color:var(--admin-accent)]"
                                          >
                                            Kalibrer
                                          </button>
                                          {!item.active &&
                                          item.calibrationStatus === "ready" ? (
                                            <button
                                              onClick={() => activate(item)}
                                              className="font-semibold text-emerald-700"
                                            >
                                              Gjer aktiv
                                            </button>
                                          ) : item.active ? (
                                            <span className="text-emerald-700">
                                              Aktiv
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              ) : null}
                            </div>
                          );
                        },
                      )}
                    </div>
                  </section>
                );
              })}
          </div>
        )}
        {showDefaults ? (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
            onClick={() => setShowDefaults(false)}
          >
            <div
              className="w-full max-w-lg rounded-[20px] bg-white p-6 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-xl font-semibold">
                Felles etikettstandardar
              </h2>
              <p className="mt-2 text-sm text-[color:var(--admin-muted)]">
                Desse tala blir brukte på alle oppskrifter med same storleik.
              </p>
              <label className="mt-5 block text-xs font-semibold">
                Eskeetikettar per ark
                <input
                  type="number"
                  min="1"
                  value={defaults.boxLabelsPerSheet}
                  onChange={(event) =>
                    setDefaults({
                      ...defaults,
                      boxLabelsPerSheet: Math.max(
                        1,
                        Math.round(Number(event.target.value) || 1),
                      ),
                    })
                  }
                  className="mt-2 w-full rounded-[9px] border border-[color:var(--admin-line-strong)] px-3 py-2"
                />
              </label>
              <div className="mt-5 space-y-3">
                {Object.entries(defaults.bySize).map(([key, value]) => (
                  <div
                    key={key}
                    className="grid grid-cols-[1fr_90px_90px] items-end gap-3"
                  >
                    <p className="pb-2 text-sm font-medium">
                      {key
                        .replace("-", ",")
                        .replace("-ml", " ml")
                        .replace("-kg", " kg")
                        .replace("-l", " l")}
                    </p>
                    <label className="text-[10px] font-semibold">
                      Per ark
                      <input
                        type="number"
                        min="1"
                        value={value.labelsPerSheet}
                        onChange={(event) =>
                          setDefaults({
                            ...defaults,
                            bySize: {
                              ...defaults.bySize,
                              [key]: {
                                ...value,
                                labelsPerSheet: Math.max(
                                  1,
                                  Math.round(Number(event.target.value) || 1),
                                ),
                              },
                            },
                          })
                        }
                        className="mt-1 w-full rounded-[8px] border border-[color:var(--admin-line-strong)] px-2 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[10px] font-semibold">
                      Per eske
                      <input
                        type="number"
                        min="0"
                        value={value.unitsPerBox || ""}
                        onChange={(event) =>
                          setDefaults({
                            ...defaults,
                            bySize: {
                              ...defaults.bySize,
                              [key]: {
                                ...value,
                                unitsPerBox:
                                  Math.max(
                                    0,
                                    Math.round(Number(event.target.value) || 0),
                                  ) || undefined,
                              },
                            },
                          })
                        }
                        className="mt-1 w-full rounded-[8px] border border-[color:var(--admin-line-strong)] px-2 py-2 text-xs"
                      />
                    </label>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowDefaults(false)}
                  className="admin-button-secondary px-4 py-2 text-xs"
                >
                  Avbryt
                </button>
                <button
                  onClick={saveDefaults}
                  className="rounded-full bg-[color:var(--admin-accent)] px-4 py-2 text-xs font-medium text-white"
                >
                  Lagre standardar
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {editing ? (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 md:p-8"
            onClick={() => setEditing(null)}
          >
            <div
              ref={calibrationRef}
              tabIndex={-1}
              onKeyDown={handleCalibrationKeyDown}
              className="mx-auto w-full max-w-6xl rounded-[22px] bg-white p-5 shadow-xl outline-none md:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-col gap-4 border-b border-[color:var(--admin-line)] pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    Kalibrer {editing.outputName}
                  </h2>
                  <p className="mt-2 text-sm text-[color:var(--admin-muted)]">
                    Dra i arket for å flytte visninga. Klikk eit felt og bruk
                    piltastane for å flytte det. Shift + piltast gir større
                    steg.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      setZoom((value) => Math.max(0.75, value - 0.25))
                    }
                    className="admin-button-secondary px-3 py-2 text-xs"
                  >
                    −
                  </button>
                  <span className="grid min-w-16 place-items-center text-xs font-semibold">
                    {Math.round(zoom * 100)} %
                  </span>
                  <button
                    onClick={() =>
                      setZoom((value) => Math.min(2.5, value + 0.25))
                    }
                    className="admin-button-secondary px-3 py-2 text-xs"
                  >
                    +
                  </button>
                  <button
                    onClick={() => addField("date")}
                    className="admin-button-secondary px-3 py-2 text-xs"
                  >
                    + Best før
                  </button>
                  <button
                    onClick={() => addField("batch")}
                    className="admin-button-secondary px-3 py-2 text-xs"
                  >
                    + Partinr
                  </button>
                </div>
              </div>
              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div
                  ref={previewScrollRef}
                  onPointerDown={beginPan}
                  onWheel={handlePreviewWheel}
                  className="max-h-[70vh] cursor-grab overflow-auto rounded-[14px] border border-[color:var(--admin-line-strong)] bg-neutral-200 p-3"
                >
                  <div
                    ref={previewRef}
                    className="relative origin-top-left overflow-hidden bg-white shadow-sm"
                    style={{
                      aspectRatio: `${editing.pageWidth}/${editing.pageHeight}`,
                      width: `${zoom * 100}%`,
                    }}
                  >
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt="Etikettark"
                        draggable={false}
                        className="pointer-events-none absolute inset-0 h-full w-full select-none"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-sm text-neutral-500">
                        {previewError || "Hentar PDF …"}
                      </div>
                    )}
                    {(editing.variableFields || []).map((field) => (
                      <button
                        key={field.id}
                        data-label-field
                        onClick={() => selectField(field.id)}
                        className={`absolute flex cursor-pointer select-none items-center justify-center border-2 text-[9px] font-semibold shadow-sm ${field.type === "date" ? "border-sky-600 bg-sky-100/80 text-sky-900" : "border-violet-600 bg-violet-100/80 text-violet-900"} ${selectedFieldId === field.id ? "ring-2 ring-black/40" : ""}`}
                        style={{
                          left: `${(field.x / editing.pageWidth) * 100}%`,
                          bottom: `${(field.y / editing.pageHeight) * 100}%`,
                          width: `${(field.width / editing.pageWidth) * 100}%`,
                          height: `${(field.height / editing.pageHeight) * 100}%`,
                        }}
                      >
                        {field.type === "date" ? "11.08.27" : "2026000"}
                      </button>
                    ))}
                  </div>
                </div>
                <aside className="rounded-[14px] border border-[color:var(--admin-line)] bg-[color:var(--admin-active)] p-4">
                  <p className="text-xs font-semibold">
                    {editing.kind === "product"
                      ? "Etikettar per ark"
                      : "Eskeetikettar per ark"}
                    <span className="mt-2 block rounded-[8px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2 text-sm">
                      {editing.kind === "box"
                        ? defaults.boxLabelsPerSheet
                        : editing.labelsPerSheet}
                    </span>
                  </p>
                  <div className="my-4 border-t border-[color:var(--admin-line)]" />
                  <h3 className="text-sm font-semibold">Felt på arket</h3>
                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                    {(editing.variableFields || []).map((field, index) => (
                      <button
                        key={field.id}
                        onClick={() => selectField(field.id)}
                        className={`flex w-full items-center justify-between rounded-[9px] px-3 py-2 text-left text-xs ${selectedFieldId === field.id ? "bg-white ring-1 ring-[color:var(--admin-line-strong)]" : "bg-white/50"}`}
                      >
                        <span>
                          {field.type === "date" ? "Best før" : "Partinr"}{" "}
                          {index + 1}
                        </span>
                        <span>
                          {Math.round(field.x)}, {Math.round(field.y)}
                        </span>
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const field = (editing.variableFields || []).find(
                      (item) => item.id === selectedFieldId,
                    );
                    if (!field)
                      return (
                        <p className="mt-4 text-xs text-[color:var(--admin-muted)]">
                          Vel eit felt på arket.
                        </p>
                      );
                    return (
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        {(
                          ["x", "y", "width", "height", "fontSize"] as const
                        ).map((key) => (
                          <label key={key} className="text-[11px] font-medium">
                            {
                              {
                                x: "X",
                                y: "Y",
                                width: "Breidd",
                                height: "Høgd",
                                fontSize: "Skrift",
                              }[key]
                            }
                            <input
                              type="number"
                              step="0.5"
                              value={field[key]}
                              onChange={(event) =>
                                updateField(field.id, {
                                  [key]: Number(event.target.value),
                                })
                              }
                              className="mt-1 w-full rounded-[8px] border border-[color:var(--admin-line-strong)] bg-white px-2 py-1.5 text-xs"
                            />
                          </label>
                        ))}
                        <button
                          onClick={() => {
                            setEditing({
                              ...editing,
                              variableFields: (
                                editing.variableFields || []
                              ).filter((item) => item.id !== field.id),
                            });
                            setSelectedFieldId("");
                          }}
                          className="col-span-2 text-left text-xs font-medium text-red-700"
                        >
                          Fjern dette feltet
                        </button>
                      </div>
                    );
                  })()}
                </aside>
              </div>
              <div className="mt-6 flex flex-col gap-3 border-t border-[color:var(--admin-line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[color:var(--admin-muted)]">
                  Malen må ha minst éi datoplassering og eitt partinummer før
                  han kan aktiverast.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditing(null)}
                    className="admin-button-secondary px-4 py-2 text-xs"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={saveEdit}
                    className="rounded-full bg-[color:var(--admin-accent)] px-4 py-2 text-xs font-medium text-white"
                  >
                    Lagre kalibrering
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
