"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  createCookPlans,
  scaleExpectedYield,
  scaleIngredient,
} from "@/lib/production/recipeMath";
import { allProductionRecipes } from "@/lib/production/recipes.generated";
import type {
  ProductionRecipe,
  RecipeProcessStep,
  RecipeWarning,
} from "@/lib/production/types";
import {
  completeProductionBatch,
  createProductionBatch,
  getProductionBatch,
  saveProductionBatch,
  type ProductionBatch,
  type ProductionBatchForm,
  type ProductionBatchStatus,
} from "@/lib/production/batchesFirestore";
import {
  normalizeLegacyRecipe,
  saveProductionRecipe,
  subscribeProductionRecipeOverrides,
} from "@/lib/production/recipesFirestore";
import { auth } from "@/lib/firebase";
import { blueberryJamLabelTemplates } from "@/lib/production/labelTemplates";
import type { LabelTemplateVersion } from "@/lib/production/labelTemplateAdmin";

function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("nn-NO", { maximumFractionDigits }).format(
    value,
  );
}

function describeCooks(fullCooks: number, halfCooks: number) {
  const parts = [];
  if (fullCooks)
    parts.push(`${fullCooks} ${fullCooks === 1 ? "heilt kok" : "heile kok"}`);
  if (halfCooks) parts.push("1 halvt kok");
  return parts.join(" + ");
}

const monthNames = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

const categoryColors: Record<string, { strong: string; soft: string }> = {
  Sylte: { strong: "#48a9d1", soft: "#e8f6fb" },
  Saft: { strong: "#64be78", soft: "#edf9ef" },
  Gelé: { strong: "#5a3cff", soft: "#efecff" },
  Frisk: { strong: "#c879bd", soft: "#faedf8" },
  Rein: { strong: "#d99470", soft: "#fdf1ea" },
  Saus: { strong: "#c4b52e", soft: "#fffde2" },
};

const baseProductionRecipes = allProductionRecipes.map(normalizeLegacyRecipe);

function outputBaseAmount(
  contentAmount: number,
  contentUnit: "ml" | "l" | "kg",
) {
  return contentUnit === "ml" ? contentAmount / 1000 : contentAmount;
}

async function downloadProductionLabels(
  batchId: string,
  batchNumber: string,
  outputId: string,
  outputName: string,
  kind: "product" | "box",
) {
  const user = auth.currentUser;
  if (!user) throw new Error("Du må vere innlogga for å lage etikettar.");
  const response = await fetch("/api/admin/production-labels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify({ batchId, outputId, kind }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (body.error === "NO_BOX_LABELS")
      throw new Error("Denne batchen har ingen eskeetikettar å skrive ut.");
    if (body.error === "NO_PRODUCT_LABELS")
      throw new Error("Denne batchen har ingen produktetikettar å skrive ut.");
    throw new Error("Klarte ikkje å lage etikettfila.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${batchNumber}-${outputName.replace(/[^a-zA-Z0-9æøåÆØÅ]+/g, "-")}-${kind === "product" ? "produktetikettar" : "eskeetikettar"}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function CookSheet({
  recipe,
  cookAmount,
  count,
  title,
  sheetKey,
  checks,
  onCheck,
  locked = false,
}: {
  recipe: ProductionRecipe;
  cookAmount: number;
  count: number;
  title: string;
  sheetKey: string;
  checks: Record<string, boolean>;
  onCheck: (key: string, checked: boolean) => void;
  locked?: boolean;
}) {
  const categoryColor = categoryColors[recipe.category] || {
    strong: "#64748b",
    soft: "#f1f5f9",
  };
  return (
    <section className="overflow-hidden rounded-[18px] border border-[color:var(--admin-line)] bg-white">
      <div
        className="flex flex-col gap-1 border-b border-[color:var(--admin-line)] px-4 py-3 [print-color-adjust:exact] sm:flex-row sm:items-center sm:justify-between"
        style={{
          backgroundColor: categoryColor.soft,
          borderTop: `5px solid ${categoryColor.strong}`,
        }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
              style={{ backgroundColor: categoryColor.strong }}
            >
              {recipe.category}
            </span>
            <h3 className="text-sm font-semibold">{title}</h3>
          </div>
          <p className="mt-0.5 text-xs text-[color:var(--admin-muted)]">
            {formatNumber(cookAmount)} {recipe.primaryUnit} grunnmengd per kok
          </p>
        </div>
        <span className="text-xs font-medium text-[color:var(--admin-muted)]">
          {count} {count === 1 ? "kok" : "kok"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[color:var(--admin-line)] text-left text-xs text-[color:var(--admin-muted)]">
              <th className="px-4 py-3 font-medium">Ingrediens</th>
              <th className="px-3 py-3 text-right font-medium">Per kok</th>
              {Array.from({ length: count }, (_, index) => (
                <th
                  key={index}
                  className="min-w-28 px-3 py-3 text-center font-medium"
                >
                  Kok {index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recipe.ingredients.map((ingredient) => {
              const amount = scaleIngredient(ingredient, recipe, cookAmount);
              return (
                <tr
                  key={ingredient.id}
                  className="border-b border-[color:var(--admin-line)] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{ingredient.name}</p>
                    {ingredient.note ? (
                      <p className="mt-0.5 text-[11px] text-amber-700">
                        {ingredient.note}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                    {formatNumber(amount.totalAmount)} {ingredient.unit}
                  </td>
                  {Array.from({ length: count }, (_, index) => (
                    <td key={index} className="px-3 py-2 text-center">
                      <div className="flex justify-center gap-2">
                        <label className="grid cursor-pointer justify-items-center gap-1 text-[10px] text-[color:var(--admin-muted)]">
                          <input
                            type="checkbox"
                            disabled={locked}
                            checked={Boolean(
                              checks[
                                `${sheetKey}-ingredient-${ingredient.id}-${index}-measured`
                              ],
                            )}
                            onChange={(event) =>
                              onCheck(
                                `${sheetKey}-ingredient-${ingredient.id}-${index}-measured`,
                                event.target.checked,
                              )
                            }
                            className="h-4 w-4 accent-[color:var(--admin-accent)] disabled:cursor-not-allowed"
                          />
                          Målt
                        </label>
                        <label className="grid cursor-pointer justify-items-center gap-1 text-[10px] text-[color:var(--admin-muted)]">
                          <input
                            type="checkbox"
                            disabled={locked}
                            checked={Boolean(
                              checks[
                                `${sheetKey}-ingredient-${ingredient.id}-${index}-added`
                              ],
                            )}
                            onChange={(event) =>
                              onCheck(
                                `${sheetKey}-ingredient-${ingredient.id}-${index}-added`,
                                event.target.checked,
                              )
                            }
                            className="h-4 w-4 accent-[color:var(--admin-accent)] disabled:cursor-not-allowed"
                          />
                          Tilsett
                        </label>
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {recipe.warnings?.length ? (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 [print-color-adjust:exact]">
          {recipe.warnings.map((warning) => (
            <p
              key={warning.id}
              className="text-xs font-semibold text-amber-900"
            >
              OBS: {warning.text}
            </p>
          ))}
        </div>
      ) : null}
      <div className="border-t border-[color:var(--admin-line)] px-4 py-4">
        <p className="mb-3 text-xs font-medium text-[color:var(--admin-muted)]">
          Arbeidsgang per kok
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {recipe.process.map((step, index) => (
            <label
              key={step.id}
              className="flex cursor-pointer items-start gap-2 rounded-[10px] bg-[color:var(--admin-active)] px-3 py-2.5 text-xs"
            >
              <input
                type="checkbox"
                disabled={locked}
                checked={Boolean(checks[`${sheetKey}-process-${step.id}`])}
                onChange={(event) =>
                  onCheck(
                    `${sheetKey}-process-${step.id}`,
                    event.target.checked,
                  )
                }
                className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--admin-accent)] disabled:cursor-not-allowed"
              />
              <span className="flex min-w-0 gap-2">
                <span className="font-semibold text-[color:var(--admin-accent)]">
                  {index + 1}.
                </span>
                <span>
                  <span className="font-medium">{step.title}</span>
                  {step.detail ? (
                    <span className="mt-0.5 block text-[color:var(--admin-muted)]">
                      {step.detail}
                    </span>
                  ) : null}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompletedBatchView({ batch }: { batch: ProductionBatch }) {
  const [labelMessage, setLabelMessage] = useState("");
  const [creatingLabels, setCreatingLabels] = useState<string | null>(null);
  const [labelDownloads, setLabelDownloads] = useState(
    batch.labelDownloads || {},
  );
  const [availableTemplates, setAvailableTemplates] = useState<
    LabelTemplateVersion[]
  >([]);
  const [labelSettings, setLabelSettings] = useState<{
    boxLabelsPerSheet?: number;
    bySize?: Record<string, { labelsPerSheet?: number; unitsPerBox?: number }>;
  }>({});
  useEffect(() => {
    (async () => {
      const user = auth.currentUser;
      if (!user) return;
      const response = await fetch("/api/admin/label-templates", {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      if (!response.ok) return;
      const body = await response.json();
      setAvailableTemplates(body.templates || []);
      setLabelSettings(body.settings || {});
    })();
  }, []);
  const recipe = batch.recipeSnapshot;
  const color = categoryColors[batch.category] || {
    strong: "#64748b",
    soft: "#f1f5f9",
  };
  const rawMaterials = recipe.ingredients.filter(
    (ingredient) => batch.rawMaterialBatches?.[ingredient.id],
  );
  const resultOutputs = recipe.outputs.filter(
    (output) =>
      Number(batch.plannedOutputQuantities?.[output.id] || 0) > 0 ||
      Number(batch.outputQuantities?.[output.id] || 0) > 0,
  );
  const packagedResult = recipe.outputs.reduce(
    (total, output) =>
      total +
      Number(batch.outputQuantities?.[output.id] || 0) *
        outputBaseAmount(output.contentAmount, output.contentUnit),
    0,
  );
  const storedResult = Number(batch.extraLitres || 0);
  const registeredResult = batch.actualTotal ?? packagedResult + storedResult;
  const resultDifference = registeredResult - batch.expectedYield;
  const checkedCount = Object.values(batch.checks || {}).filter(Boolean).length;
  const totalChecks = Object.keys(batch.checks || {}).length;
  const completedDate = batch.completedAt
    ? new Intl.DateTimeFormat("nn-NO", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(batch.completedAt)
    : "Ukjend dato";
  const printableOutputs = recipe.outputs
    .map((output) => {
      const template = blueberryJamLabelTemplates[output.id];
      const productTemplate = availableTemplates.find(
        (item) =>
          item.outputId === output.id && item.kind === "product" && item.active,
      );
      const boxTemplate = availableTemplates.find(
        (item) =>
          item.outputId === output.id && item.kind === "box" && item.active,
      );
      const sizeDefaults =
        labelSettings.bySize?.[
          `${String(output.contentAmount).replace(".", "-")}-${output.contentUnit}`
        ];
      const quantity = Math.max(
        0,
        Number(batch.outputQuantities?.[output.id] || 0),
      );
      const productSheets =
        productTemplate && quantity
          ? Math.ceil(
              quantity /
                (sizeDefaults?.labelsPerSheet ||
                  productTemplate.labelsPerSheet ||
                  output.labelsPerSheet),
            )
          : 0;
      const unitsPerBox =
        sizeDefaults?.unitsPerBox ||
        boxTemplate?.unitsPerBox ||
        template?.unitsPerBox;
      const boxes =
        boxTemplate && unitsPerBox && quantity
          ? Math.ceil(quantity / unitsPerBox)
          : 0;
      const boxSheets = boxes
        ? Math.ceil(boxes / (labelSettings.boxLabelsPerSheet || 8))
        : 0;
      return { output, quantity, productSheets, boxes, boxSheets };
    })
    .filter((item) => item.productSheets && item.quantity);

  async function createLabels(
    outputId: string,
    outputName: string,
    kind: "product" | "box",
  ) {
    const job = `${kind}:${outputId}`;
    setCreatingLabels(job);
    setLabelMessage("");
    try {
      await downloadProductionLabels(
        batch.id,
        batch.batchNumber,
        outputId,
        outputName,
        kind,
      );
      setLabelDownloads((current) => ({
        ...current,
        [`${outputId}_${kind}`]: {
          downloadedAt: new Date(),
          downloadedBy: {
            uid: auth.currentUser?.uid || "",
            email: auth.currentUser?.email || null,
          },
        },
      }));
      setLabelMessage(
        `${kind === "product" ? "Produktetikettane" : "Eskeetikettane"} for ${outputName} er lasta ned.`,
      );
    } catch (error) {
      setLabelMessage(
        error instanceof Error
          ? error.message
          : "Klarte ikkje å lage etikettfila.",
      );
    } finally {
      setCreatingLabels(null);
    }
  }
  return (
    <main className="min-h-screen text-[color:var(--admin-ink)]">
      <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12">
        <header className="flex flex-col gap-5 border-b border-[color:var(--admin-line)] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--admin-muted)]">
              Produksjonshistorikk
            </p>
            <h1
              className="mt-2 text-3xl tracking-tight md:text-4xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {batch.batchNumber}
            </h1>
            <p className="mt-2 text-sm text-[color:var(--admin-muted)]">
              Fullført {completedDate}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/production/batches"
              className="admin-button-secondary px-4 py-2 text-xs"
            >
              ← Batchregister
            </Link>
            <Link
              href={`/admin/production/print?batch=${encodeURIComponent(batch.id)}`}
              className="admin-button-secondary px-4 py-2 text-xs"
            >
              Skriv ut arbeidsskjema
            </Link>
            <Link
              href="/admin/production"
              className="rounded-full bg-[color:var(--admin-accent)] px-4 py-2 text-xs font-medium text-white"
            >
              Ny produksjon
            </Link>
          </div>
        </header>

        <section
          className="mt-7 overflow-hidden rounded-[22px] border border-[color:var(--admin-line)] bg-white"
          style={{ borderTop: `6px solid ${color.strong}` }}
        >
          <div
            className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
            style={{ backgroundColor: color.soft }}
          >
            <div>
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                style={{ color: color.strong }}
              >
                {batch.category}
              </span>
              <h2 className="mt-1 text-2xl font-semibold">
                {batch.recipeName}
              </h2>
              <p className="mt-1 text-xs text-[color:var(--admin-muted)]">
                Oppskrift versjon {batch.recipeVersion}
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              Fullført · skriveverna
            </span>
          </div>
          <dl className="grid gap-px bg-[color:var(--admin-line)] sm:grid-cols-3">
            <div className="bg-white p-5">
              <dt className="text-xs text-[color:var(--admin-muted)]">
                Planlagt grunnmengd
              </dt>
              <dd className="mt-1 text-xl font-semibold">
                {formatNumber(batch.selectedPlan.plannedPrimaryAmount)}{" "}
                {recipe.primaryUnit}
              </dd>
            </div>
            <div className="bg-white p-5">
              <dt className="text-xs text-[color:var(--admin-muted)]">
                Forventa resultat
              </dt>
              <dd className="mt-1 text-xl font-semibold">
                ca. {formatNumber(batch.expectedYield, 1)}{" "}
                {recipe.expectedYieldUnit}
              </dd>
            </div>
            <div className="bg-white p-5">
              <dt className="text-xs text-[color:var(--admin-muted)]">
                Faktisk resultat
              </dt>
              <dd className="mt-1 text-xl font-semibold">
                {formatNumber(batch.actualTotal || 0, 2)} kg/l
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 overflow-hidden rounded-[20px] border border-[color:var(--admin-line)] bg-white">
          <div className="border-b border-[color:var(--admin-line)] px-5 py-4">
            <h2 className="text-base font-semibold">Registrert resultat</h2>
            <p className="mt-1 text-xs text-[color:var(--admin-muted)]">
              Planlagt og faktisk tapping for denne batchen.
            </p>
          </div>
          {resultOutputs.length ? (
            <div className="overflow-x-auto">
              <div className="min-w-[650px]">
                <div className="grid grid-cols-[minmax(200px,1fr)_90px_100px_110px_90px] gap-3 border-b border-[color:var(--admin-line)] bg-[color:var(--admin-active)] px-5 py-2.5 text-[11px] font-medium text-[color:var(--admin-muted)]">
                  <span>Produkt</span>
                  <span className="text-right">Plan</span>
                  <span className="text-right">Registrert</span>
                  <span className="text-right">Mengd</span>
                  <span className="text-right">Etikettark</span>
                </div>
                {resultOutputs.map((output) => {
                  const planned = Number(
                    batch.plannedOutputQuantities?.[output.id] || 0,
                  );
                  const actual = Number(
                    batch.outputQuantities?.[output.id] || 0,
                  );
                  const amount =
                    actual *
                    outputBaseAmount(output.contentAmount, output.contentUnit);
                  return (
                    <div
                      key={output.id}
                      className="grid grid-cols-[minmax(200px,1fr)_90px_100px_110px_90px] items-center gap-3 border-b border-[color:var(--admin-line)] px-5 py-3 text-sm last:border-b-0"
                    >
                      <span className="font-medium">{output.name}</span>
                      <span className="text-right text-[color:var(--admin-muted)]">
                        {formatNumber(planned, 0)}
                      </span>
                      <strong className="text-right">
                        {formatNumber(actual, 0)}
                      </strong>
                      <span className="text-right">
                        {formatNumber(amount, 2)} kg/l
                      </span>
                      <span className="text-right">
                        {actual ? Math.ceil(actual / output.labelsPerSheet) : 0}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="px-5 py-6 text-sm text-[color:var(--admin-muted)]">
              Ingen emballerte produkt registrerte.
            </p>
          )}
          <dl className="grid gap-px border-t border-[color:var(--admin-line)] bg-[color:var(--admin-line)] sm:grid-cols-4">
            <div className="bg-white p-4">
              <dt className="text-xs text-[color:var(--admin-muted)]">Pakka</dt>
              <dd className="mt-1 font-semibold">
                {formatNumber(packagedResult, 2)} kg/l
              </dd>
            </div>
            <div className="bg-white p-4">
              <dt className="text-xs text-[color:var(--admin-muted)]">
                Til seinare
              </dt>
              <dd className="mt-1 font-semibold">
                {formatNumber(storedResult, 2)} l
              </dd>
            </div>
            <div className="bg-white p-4">
              <dt className="text-xs text-[color:var(--admin-muted)]">
                Totalt registrert
              </dt>
              <dd className="mt-1 font-semibold">
                {formatNumber(registeredResult, 2)} kg/l
              </dd>
            </div>
            <div className="bg-white p-4">
              <dt className="text-xs text-[color:var(--admin-muted)]">
                Avvik frå forventa
              </dt>
              <dd
                className={`mt-1 font-semibold ${Math.abs(resultDifference) <= 1 ? "text-emerald-700" : "text-amber-700"}`}
              >
                {resultDifference >= 0 ? "+" : ""}
                {formatNumber(resultDifference, 2)} kg/l
              </dd>
            </div>
          </dl>
        </section>

        {printableOutputs.length ? (
          <section className="mt-6 rounded-[20px] border border-[color:var(--admin-line)] bg-white p-5">
            <div>
              <h2 className="text-base font-semibold">Etikettar</h2>
              <p className="mt-1 text-xs leading-5 text-[color:var(--admin-muted)]">
                Dato og partinummer blir henta frå denne batchen. PDF-en
                inneheld riktig tal komplette etikettark.
              </p>
            </div>
            <div className="mt-4 overflow-hidden rounded-[14px] border border-[color:var(--admin-line)]">
              {printableOutputs.map(
                ({ output, quantity, productSheets, boxes, boxSheets }) => {
                  const productDownloaded =
                    labelDownloads[`${output.id}_product`];
                  const boxDownloaded = labelDownloads[`${output.id}_box`];
                  return (
                    <div
                      key={output.id}
                      className="flex flex-col gap-3 border-b border-[color:var(--admin-line)] bg-white px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium">{output.name}</p>
                        <p className="mt-0.5 text-[11px] text-[color:var(--admin-muted)]">
                          {quantity} produserte · {productSheets} produktark
                          {boxes
                            ? ` · ${boxes} esker på ${boxSheets} eskeark`
                            : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                          <span
                            className={`inline-flex items-center gap-1.5 font-medium ${productDownloaded ? "text-emerald-700" : "text-neutral-500"}`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${productDownloaded ? "bg-emerald-500" : "bg-neutral-300"}`}
                            />
                            Produkt:{" "}
                            {productDownloaded
                              ? "lasta ned"
                              : "ikkje lasta ned"}
                          </span>
                          {boxes ? (
                            <span
                              className={`inline-flex items-center gap-1.5 font-medium ${boxDownloaded ? "text-emerald-700" : "text-neutral-500"}`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${boxDownloaded ? "bg-emerald-500" : "bg-neutral-300"}`}
                              />
                              Esker:{" "}
                              {boxDownloaded ? "lasta ned" : "ikkje lasta ned"}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={creatingLabels !== null}
                          onClick={() =>
                            createLabels(output.id, output.name, "product")
                          }
                          className={`rounded-full border px-4 py-2 text-xs font-medium transition disabled:opacity-40 ${productDownloaded ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "border-transparent bg-[color:var(--admin-accent)] text-white"}`}
                        >
                          {creatingLabels === `product:${output.id}`
                            ? "Lagar PDF …"
                            : `${productDownloaded ? "✓ Lasta ned · last ned på nytt" : "Last ned produkt"} · ${productSheets} ${productSheets === 1 ? "ark" : "ark"}`}
                        </button>
                        {boxes ? (
                          <button
                            type="button"
                            disabled={creatingLabels !== null}
                            onClick={() =>
                              createLabels(output.id, output.name, "box")
                            }
                            className={`rounded-full border px-4 py-2 text-xs font-medium transition disabled:opacity-40 ${boxDownloaded ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "border-[color:var(--admin-line-strong)] bg-white text-[color:var(--admin-ink)] hover:bg-[color:var(--admin-active)]"}`}
                          >
                            {creatingLabels === `box:${output.id}`
                              ? "Lagar PDF …"
                              : `${boxDownloaded ? "✓ Lasta ned · last ned på nytt" : "Last ned esker"} · ${boxSheets} ${boxSheets === 1 ? "ark" : "ark"}`}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
            {labelMessage ? (
              <p className="mt-3 text-xs font-medium text-[color:var(--admin-muted)]">
                {labelMessage}
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="mt-6 rounded-[20px] border border-[color:var(--admin-line)] bg-white p-5">
          <h2 className="text-base font-semibold">Sporing</h2>
          {rawMaterials.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {rawMaterials.map((ingredient) => (
                <div
                  key={ingredient.id}
                  className="flex items-center justify-between gap-4 rounded-[11px] bg-[color:var(--admin-active)] px-3 py-2.5 text-sm"
                >
                  <span>{ingredient.name}</span>
                  <strong>{batch.rawMaterialBatches[ingredient.id]}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--admin-muted)]">
              Ingen råvarebatch registrert.
            </p>
          )}
          <p className="mt-4 text-xs text-[color:var(--admin-muted)]">
            Kontrollpunkt utførte: {checkedCount} av {totalChecks}
          </p>
        </section>

        {batch.notes ? (
          <section className="mt-6 rounded-[20px] border border-[color:var(--admin-line)] bg-white p-5">
            <h2 className="text-base font-semibold">Merknader</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[color:var(--admin-muted)]">
              {batch.notes}
            </p>
          </section>
        ) : null}

        <details className="mt-6 rounded-[20px] border border-[color:var(--admin-line)] bg-white">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">
            Vis produksjonsdetaljar
          </summary>
          <div className="border-t border-[color:var(--admin-line)] px-5 py-5">
            <dl className="grid gap-3 sm:grid-cols-2">
              {recipe.ingredients.map((ingredient) => {
                const scaled = scaleIngredient(
                  ingredient,
                  recipe,
                  batch.selectedPlan.plannedPrimaryAmount,
                );
                return (
                  <div
                    key={ingredient.id}
                    className="flex justify-between gap-4 rounded-[11px] bg-[color:var(--admin-active)] px-3 py-2.5 text-sm"
                  >
                    <dt>{ingredient.name}</dt>
                    <dd className="font-semibold">
                      {formatNumber(scaled.totalAmount)} {ingredient.unit}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <div className="mt-5">
              <h3 className="text-sm font-semibold">Arbeidsgang</h3>
              <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                {recipe.process.map((step, index) => (
                  <li
                    key={step.id}
                    className="rounded-[11px] border border-[color:var(--admin-line)] px-3 py-2.5 text-xs"
                  >
                    <span className="mr-2 font-semibold">{index + 1}.</span>
                    {step.title}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </details>
      </div>
    </main>
  );
}

export default function ProductionPage() {
  const [recipeOverrides, setRecipeOverrides] = useState<
    Record<string, ProductionRecipe>
  >({});
  const recipes = baseProductionRecipes.map((item) =>
    recipeOverrides[item.id]
      ? normalizeLegacyRecipe(recipeOverrides[item.id])
      : item,
  );
  const defaultRecipe =
    recipes.find((item) => item.name === "Jordbærsylte") || recipes[0];
  const [recipeId, setRecipeId] = useState(defaultRecipe.id);
  const [batchRecipeOverride, setBatchRecipeOverride] =
    useState<ProductionRecipe | null>(null);
  const recipe =
    batchRecipeOverride ||
    recipes.find((item) => item.id === recipeId) ||
    recipes[0];
  const [targetText, setTargetText] = useState(() =>
    String(
      recipe.recommendedProductionAmount || recipe.preferredCookPrimaryAmount,
    ),
  );
  const [cookSizeText, setCookSizeText] = useState(() =>
    String(recipe.preferredCookPrimaryAmount),
  );
  const targetAmount = Number(targetText.replace(",", "."));
  const enteredCookSize = Number(cookSizeText.replace(",", "."));
  const plannedCookSize = recipe.maxCookPrimaryAmount
    ? Math.min(enteredCookSize, recipe.maxCookPrimaryAmount)
    : enteredCookSize;
  const plans = useMemo(
    () => createCookPlans(targetAmount, plannedCookSize),
    [targetAmount, plannedCookSize],
  );
  const [selectedPlanKey, setSelectedPlanKey] = useState<string | null>(null);
  const [outputQuantities, setOutputQuantities] = useState<
    Record<string, string>
  >({});
  const [plannedOutputQuantities, setPlannedOutputQuantities] = useState<
    Record<string, string>
  >({});
  const [extraLitres, setExtraLitres] = useState("");
  const [rawMaterialBatches, setRawMaterialBatches] = useState<
    Record<string, string>
  >({});
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [workflowStep, setWorkflowStep] = useState<"worksheet" | "result">(
    "worksheet",
  );
  const [forecastMonth, setForecastMonth] = useState(() =>
    new Date().getMonth(),
  );
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [activeBatchNumber, setActiveBatchNumber] = useState<string | null>(
    null,
  );
  const [activeBatchStatus, setActiveBatchStatus] =
    useState<ProductionBatchStatus | null>(null);
  const [loadedBatch, setLoadedBatch] = useState<ProductionBatch | null>(null);
  const [batchMessage, setBatchMessage] = useState("");
  const [savingBatch, setSavingBatch] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftSteps, setDraftSteps] = useState<RecipeProcessStep[]>([]);
  const [draftWarnings, setDraftWarnings] = useState<RecipeWarning[]>([]);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [recipeMessage, setRecipeMessage] = useState("");
  const recommendedPlan = plans[0];
  const selectedPlan =
    plans.find(
      (plan) => `${plan.fullCooks}-${plan.halfCooks}` === selectedPlanKey,
    ) || recommendedPlan;
  const expectedYield = selectedPlan
    ? scaleExpectedYield(recipe, selectedPlan.plannedPrimaryAmount)
    : 0;
  const packagedAmount = recipe.outputs.reduce((total, output) => {
    const quantity = Math.max(
      0,
      Number(outputQuantities[output.id]?.replace(",", ".")) || 0,
    );
    const amountPerUnit =
      output.contentUnit === "ml"
        ? output.contentAmount / 1000
        : output.contentAmount;
    return total + quantity * amountPerUnit;
  }, 0);
  const storedAmount = Math.max(0, Number(extraLitres.replace(",", ".")) || 0);
  const actualTotal = packagedAmount + storedAmount;
  const forecastOutputs = recipe.outputs;
  const forecastReferenceVolume = forecastOutputs.reduce((total, output) => {
    if (output.forecastEnabled === false) return total;
    return (
      total +
      (output.monthlySales?.[forecastMonth] || 0) *
        outputBaseAmount(output.contentAmount, output.contentUnit)
    );
  }, 0);
  const outputForecast = forecastOutputs.map((output) => {
    const historicalUnits =
      output.forecastEnabled === false
        ? 0
        : output.monthlySales?.[forecastMonth] || 0;
    const historicalVolume =
      historicalUnits *
      outputBaseAmount(output.contentAmount, output.contentUnit);
    const allocatedAmount = forecastReferenceVolume
      ? (expectedYield * historicalVolume) / forecastReferenceVolume
      : 0;
    return {
      output,
      quantity: Math.max(
        0,
        Math.round(
          allocatedAmount /
            outputBaseAmount(output.contentAmount, output.contentUnit),
        ),
      ),
      allocatedAmount,
    };
  });
  const plannedPackagingAmount = outputForecast.reduce(
    (total, { output, quantity }) => {
      const plannedQuantity = Math.max(
        0,
        Number(
          (plannedOutputQuantities[output.id] ?? String(quantity)).replace(
            ",",
            ".",
          ),
        ) || 0,
      );
      return (
        total +
        plannedQuantity *
          outputBaseAmount(output.contentAmount, output.contentUnit)
      );
    },
    0,
  );
  const plannedDifference = expectedYield - plannedPackagingAmount;
  const categories = [...new Set(recipes.map((item) => item.category))];
  const categoryColor = categoryColors[recipe.category] || {
    strong: "#64748b",
    soft: "#f1f5f9",
  };
  const isBatchLocked = activeBatchStatus === "completed";

  function currentBatchForm(): ProductionBatchForm | null {
    if (!selectedPlan) return null;
    const resolvedPlan = Object.fromEntries(
      outputForecast.map(({ output, quantity }) => [
        output.id,
        plannedOutputQuantities[output.id] ?? String(quantity),
      ]),
    );
    return {
      targetText,
      cookSizeText,
      selectedPlan,
      forecastMonth,
      plannedOutputQuantities: resolvedPlan,
      rawMaterialBatches,
      checks,
      outputQuantities,
      extraLitres,
      notes,
      workflowStep,
    };
  }

  useEffect(
    () =>
      subscribeProductionRecipeOverrides(setRecipeOverrides, (error) =>
        setRecipeMessage(error.message),
      ),
    [],
  );

  useEffect(() => {
    const batchId = new URLSearchParams(window.location.search).get("batch");
    if (!batchId) return;
    let cancelled = false;
    setLoadingBatch(true);
    getProductionBatch(batchId)
      .then((batch) => {
        if (cancelled || !batch) return;
        setBatchRecipeOverride(batch.recipeSnapshot);
        setRecipeId(batch.recipeId);
        setTargetText(batch.targetText);
        setCookSizeText(batch.cookSizeText);
        setSelectedPlanKey(
          `${batch.selectedPlan.fullCooks}-${batch.selectedPlan.halfCooks}`,
        );
        setForecastMonth(batch.forecastMonth);
        setPlannedOutputQuantities(batch.plannedOutputQuantities || {});
        setRawMaterialBatches(batch.rawMaterialBatches || {});
        setChecks(batch.checks || {});
        setOutputQuantities(batch.outputQuantities || {});
        setExtraLitres(batch.extraLitres || "");
        setNotes(batch.notes || "");
        setWorkflowStep(batch.workflowStep || "worksheet");
        setActiveBatchId(batch.id);
        setActiveBatchNumber(batch.batchNumber);
        setActiveBatchStatus(batch.status);
        setLoadedBatch(batch);
      })
      .catch((error) =>
        setBatchMessage(
          error instanceof Error
            ? error.message
            : "Klarte ikkje å opne batchen.",
        ),
      )
      .finally(() => {
        if (!cancelled) setLoadingBatch(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeBatchId || activeBatchStatus !== "in_progress" || loadingBatch)
      return;
    const form = currentBatchForm();
    if (!form) return;
    const timer = window.setTimeout(async () => {
      setSavingBatch(true);
      try {
        await saveProductionBatch(
          activeBatchId,
          form,
          expectedYield,
          actualTotal || null,
        );
        setBatchMessage("Alle endringar er lagra");
      } catch (error) {
        setBatchMessage(
          error instanceof Error ? error.message : "Automatisk lagring feila.",
        );
      } finally {
        setSavingBatch(false);
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    activeBatchId,
    activeBatchStatus,
    loadingBatch,
    targetText,
    cookSizeText,
    selectedPlanKey,
    forecastMonth,
    plannedOutputQuantities,
    rawMaterialBatches,
    checks,
    outputQuantities,
    extraLitres,
    notes,
    workflowStep,
    expectedYield,
    actualTotal,
  ]);

  function chooseRecipe(nextRecipeId: string) {
    const nextRecipe = recipes.find((item) => item.id === nextRecipeId);
    if (!nextRecipe) return;
    setBatchRecipeOverride(null);
    setRecipeId(nextRecipeId);
    setTargetText(
      String(
        nextRecipe.recommendedProductionAmount ||
          nextRecipe.preferredCookPrimaryAmount,
      ),
    );
    setCookSizeText(String(nextRecipe.preferredCookPrimaryAmount));
    setSelectedPlanKey(null);
    setPlannedOutputQuantities({});
    setOutputQuantities({});
    setExtraLitres("");
    setRawMaterialBatches({});
    setChecks({});
    setNotes("");
    setWorkflowStep("worksheet");
  }

  function chooseCategory(nextCategory: string) {
    const firstRecipe = recipes.find((item) => item.category === nextCategory);
    if (firstRecipe) chooseRecipe(firstRecipe.id);
  }

  function openRecipeEditor() {
    setDraftSteps(recipe.process.map((step) => ({ ...step })));
    setDraftWarnings(
      (recipe.warnings || []).map((warning) => ({ ...warning })),
    );
    setRecipeMessage("");
    setEditorOpen(true);
  }

  function moveDraftStep(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draftSteps.length) return;
    setDraftSteps((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  async function saveRecipeEditor() {
    const cleanedSteps = draftSteps
      .map((step) => ({ ...step, title: step.title.trim() }))
      .filter((step) => step.title);
    const cleanedWarnings = draftWarnings
      .map((warning) => ({ ...warning, text: warning.text.trim() }))
      .filter((warning) => warning.text);
    if (!cleanedSteps.length) {
      setRecipeMessage("Oppskrifta må ha minst eitt produksjonssteg.");
      return;
    }
    setSavingRecipe(true);
    try {
      const saved = await saveProductionRecipe({
        ...recipe,
        process: cleanedSteps,
        warnings: cleanedWarnings,
      });
      setRecipeOverrides((current) => ({ ...current, [saved.id]: saved }));
      setRecipeMessage(`Oppskrifta er lagra som versjon ${saved.version}.`);
      setEditorOpen(false);
    } catch (error) {
      setRecipeMessage(
        error instanceof Error
          ? error.message
          : "Klarte ikkje å lagre oppskrifta.",
      );
    } finally {
      setSavingRecipe(false);
    }
  }

  async function startBatch() {
    const form = currentBatchForm();
    if (!form) return;
    setSavingBatch(true);
    setBatchMessage("");
    try {
      const created = await createProductionBatch(recipe, form, expectedYield);
      setActiveBatchId(created.id);
      setActiveBatchNumber(created.batchNumber);
      setActiveBatchStatus("in_progress");
      window.history.replaceState(
        null,
        "",
        `/admin/production?batch=${encodeURIComponent(created.id)}`,
      );
      setBatchMessage("Produksjonen er starta og blir lagra automatisk");
    } catch (error) {
      setBatchMessage(
        error instanceof Error
          ? error.message
          : "Klarte ikkje å starte produksjonen.",
      );
    } finally {
      setSavingBatch(false);
    }
  }

  async function completeBatch() {
    if (!activeBatchId) return;
    const form = currentBatchForm();
    if (!form) return;
    setSavingBatch(true);
    try {
      await completeProductionBatch(
        activeBatchId,
        form,
        expectedYield,
        actualTotal,
      );
      setActiveBatchStatus("completed");
      setBatchMessage("Batchen er fullført og lagra i produksjonshistorikken");
      const refreshed = await getProductionBatch(activeBatchId);
      if (refreshed) setLoadedBatch(refreshed);
    } catch (error) {
      setBatchMessage(
        error instanceof Error
          ? error.message
          : "Klarte ikkje å fullføre batchen.",
      );
    } finally {
      setSavingBatch(false);
    }
  }

  if (isBatchLocked && loadedBatch)
    return <CompletedBatchView batch={loadedBatch} />;

  return (
    <main className="min-h-screen text-[color:var(--admin-ink)]">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">
        <header className="border-b border-[color:var(--admin-line)] pb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--admin-muted)]">
              Produksjon
            </p>
            <Link
              href="/admin/production/batches"
              className="admin-button-secondary px-4 py-2 text-xs"
            >
              Produksjonsoversikt
            </Link>
          </div>
          <h1
            className="mt-2 text-3xl tracking-tight md:text-4xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Planlegg eit kok
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--admin-muted)]">
            Planlegg, start og registrer produksjon. Pågåande arbeid blir lagra
            automatisk på same batch.
          </p>
        </header>

        {editorOpen ? (
          <section className="mt-7 rounded-[22px] border border-[color:var(--admin-line)] bg-white p-5 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--admin-muted)]">
                  Rediger oppskrift
                </p>
                <h2 className="mt-1 text-xl font-semibold">{recipe.name}</h2>
                <p className="mt-1 text-xs text-[color:var(--admin-muted)]">
                  Lagring opprettar ein ny versjon. Eksisterande batchar blir
                  ikkje endra.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="admin-button-secondary px-3 py-1.5 text-xs"
              >
                Lukk
              </button>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Produksjonssteg</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftSteps((current) => [
                        ...current,
                        { id: `step-${Date.now()}`, title: "" },
                      ])
                    }
                    className="admin-button-secondary px-3 py-1.5 text-xs"
                  >
                    + Legg til steg
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {draftSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-[12px] border border-[color:var(--admin-line)] bg-[color:var(--admin-active)] p-2"
                    >
                      <span className="text-center text-xs font-semibold text-[color:var(--admin-muted)]">
                        {index + 1}
                      </span>
                      <input
                        value={step.title}
                        onChange={(event) =>
                          setDraftSteps((current) =>
                            current.map((item) =>
                              item.id === step.id
                                ? { ...item, title: event.target.value }
                                : item,
                            ),
                          )
                        }
                        className="min-w-0 rounded-[9px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2 text-sm outline-none"
                        placeholder="Skriv produksjonssteget"
                      />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveDraftStep(index, -1)}
                          className="rounded-lg border border-[color:var(--admin-line)] bg-white px-2 py-1.5 text-xs disabled:opacity-30"
                          aria-label="Flytt opp"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={index === draftSteps.length - 1}
                          onClick={() => moveDraftStep(index, 1)}
                          className="rounded-lg border border-[color:var(--admin-line)] bg-white px-2 py-1.5 text-xs disabled:opacity-30"
                          aria-label="Flytt ned"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDraftSteps((current) =>
                              current.filter((item) => item.id !== step.id),
                            )
                          }
                          className="rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-xs text-rose-700"
                          aria-label="Fjern steg"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">OBS og åtvaringar</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftWarnings((current) => [
                        ...current,
                        { id: `warning-${Date.now()}`, text: "" },
                      ])
                    }
                    className="admin-button-secondary px-3 py-1.5 text-xs"
                  >
                    + Legg til
                  </button>
                </div>
                <p className="mt-1 text-xs leading-5 text-[color:var(--admin-muted)]">
                  Desse blir viste tydeleg, men er ikkje avkryssingssteg.
                </p>
                <div className="mt-3 space-y-2">
                  {draftWarnings.length ? (
                    draftWarnings.map((warning) => (
                      <div
                        key={warning.id}
                        className="flex items-start gap-2 rounded-[12px] border border-amber-200 bg-amber-50 p-2"
                      >
                        <textarea
                          rows={2}
                          value={warning.text}
                          onChange={(event) =>
                            setDraftWarnings((current) =>
                              current.map((item) =>
                                item.id === warning.id
                                  ? { ...item, text: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="min-w-0 flex-1 resize-y rounded-[9px] border border-amber-300 bg-white px-3 py-2 text-sm outline-none"
                          placeholder="Skriv åtvaringa"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDraftWarnings((current) =>
                              current.filter((item) => item.id !== warning.id),
                            )
                          }
                          className="rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-xs text-rose-700"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-[12px] border border-dashed border-[color:var(--admin-line-strong)] p-4 text-xs text-[color:var(--admin-muted)]">
                      Ingen åtvaringar på denne oppskrifta.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-[color:var(--admin-line)] pt-5 sm:flex-row sm:items-center">
              <p
                className={`text-xs ${recipeMessage ? "text-amber-700" : "text-[color:var(--admin-muted)]"}`}
              >
                {recipeMessage ||
                  "Stega blir brukte i denne rekkjefølgja på arbeidsskjemaet."}
              </p>
              <button
                type="button"
                onClick={saveRecipeEditor}
                disabled={savingRecipe}
                className="rounded-full bg-[color:var(--admin-ink)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {savingRecipe ? "Lagrar …" : "Lagre som ny versjon"}
              </button>
            </div>
          </section>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <section className="space-y-6">
            <div
              className="rounded-[22px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 [print-color-adjust:exact] md:p-6"
              style={{ borderTop: `5px solid ${categoryColor.strong}` }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label
                  className="text-xs font-medium text-[color:var(--admin-muted)]"
                  htmlFor="category"
                >
                  Kategori
                  <select
                    id="category"
                    disabled={Boolean(activeBatchId)}
                    value={recipe.category}
                    onChange={(event) => chooseCategory(event.target.value)}
                    className="mt-2 w-full rounded-[12px] border border-[color:var(--admin-line-strong)] px-3 py-2.5 text-sm font-semibold text-[color:var(--admin-ink)] outline-none disabled:opacity-60"
                    style={{ backgroundColor: categoryColor.soft }}
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label
                  className="text-xs font-medium text-[color:var(--admin-muted)]"
                  htmlFor="recipe"
                >
                  Oppskrift
                  <select
                    id="recipe"
                    disabled={Boolean(activeBatchId)}
                    value={recipe.id}
                    onChange={(event) => chooseRecipe(event.target.value)}
                    className="mt-2 w-full rounded-[12px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm font-medium text-[color:var(--admin-ink)] outline-none disabled:opacity-60"
                  >
                    {recipes
                      .filter((item) => item.category === recipe.category)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    {recipe.name}
                  </h2>
                  <p className="mt-1 text-sm text-[color:var(--admin-muted)]">
                    Versjon {recipe.version}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="rounded-full bg-[color:var(--admin-active)] px-3 py-1 text-xs text-[color:var(--admin-muted)]">
                    {recipes.length} oppskrifter
                  </span>
                  {!activeBatchId ? (
                    <button
                      type="button"
                      onClick={openRecipeEditor}
                      className="admin-button-secondary px-3 py-1.5 text-xs"
                    >
                      Rediger steg og OBS
                    </button>
                  ) : null}
                </div>
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-[14px] border border-[color:var(--admin-line)] bg-white p-3.5">
                  <dt className="text-xs text-[color:var(--admin-muted)]">
                    Forslag per kok frå Excel
                  </dt>
                  <dd className="mt-1 text-lg font-semibold">
                    {formatNumber(recipe.preferredCookPrimaryAmount)}{" "}
                    {recipe.primaryUnit}
                  </dd>
                </div>
                <div className="rounded-[14px] border border-[color:var(--admin-line)] bg-white p-3.5">
                  <dt className="text-xs text-[color:var(--admin-muted)]">
                    Oppskriftsgrunnlag
                  </dt>
                  <dd className="mt-1 text-lg font-semibold">
                    {formatNumber(recipe.basisPrimaryAmount)}{" "}
                    {recipe.primaryUnit}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[22px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:p-6">
              <h2 className="text-sm font-semibold">Produksjonsplan</h2>
              <p className="mt-1 text-sm text-[color:var(--admin-muted)]">
                Oppskrifta er normalisert til 100 kg/l, men kokestorleiken kjem
                frå forslaget i Excel og kan endrast.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label
                  className="block text-xs font-medium text-[color:var(--admin-muted)]"
                  htmlFor="primary-amount"
                >
                  Total grunnmengd
                  <span className="relative mt-1.5 block">
                    <input
                      id="primary-amount"
                      disabled={isBatchLocked}
                      inputMode="decimal"
                      value={targetText}
                      onChange={(event) => {
                        setTargetText(event.target.value);
                        setSelectedPlanKey(null);
                        setPlannedOutputQuantities({});
                      }}
                      className="w-full rounded-[14px] border border-[color:var(--admin-line-strong)] bg-white px-4 py-3 pr-14 text-lg font-semibold text-[color:var(--admin-ink)] outline-none disabled:bg-neutral-100"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-normal">
                      {recipe.primaryUnit}
                    </span>
                  </span>
                </label>
                <label
                  className="block text-xs font-medium text-[color:var(--admin-muted)]"
                  htmlFor="cook-size"
                >
                  Planlagt per kok
                  <span className="relative mt-1.5 block">
                    <input
                      id="cook-size"
                      disabled={isBatchLocked}
                      inputMode="decimal"
                      value={cookSizeText}
                      onChange={(event) => {
                        const raw = event.target.value;
                        const numeric = Number(raw.replace(",", "."));
                        setCookSizeText(
                          recipe.maxCookPrimaryAmount &&
                            numeric > recipe.maxCookPrimaryAmount
                            ? String(recipe.maxCookPrimaryAmount)
                            : raw,
                        );
                        setSelectedPlanKey(null);
                        setPlannedOutputQuantities({});
                      }}
                      className="w-full rounded-[14px] border border-[color:var(--admin-line-strong)] bg-white px-4 py-3 pr-14 text-lg font-semibold text-[color:var(--admin-ink)] outline-none disabled:bg-neutral-100"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-normal">
                      {recipe.primaryUnit}
                    </span>
                  </span>
                </label>
              </div>
              <p className="mt-3 text-xs leading-5 text-[color:var(--admin-muted)]">
                Systemet fordeler totalen på heile kok og foreslår eit halvt kok
                når det gir betre samsvar.
              </p>
              {recipe.maxCookPrimaryAmount ? (
                <p className="mt-1 text-xs font-medium text-amber-700">
                  Maks {formatNumber(recipe.maxCookPrimaryAmount)}{" "}
                  {recipe.primaryUnit} per kok.
                </p>
              ) : null}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[22px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:p-6">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Forslag til kok
                </h2>
                <p className="mt-1 text-sm text-[color:var(--admin-muted)]">
                  Vel forslaget som passar produksjonen best.
                </p>
              </div>
              {plans.length ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {plans.map((plan, index) => {
                    const key = `${plan.fullCooks}-${plan.halfCooks}`;
                    const isSelected = selectedPlan === plan;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={isBatchLocked}
                        onClick={() => {
                          setSelectedPlanKey(key);
                          setPlannedOutputQuantities({});
                        }}
                        className={`rounded-[16px] border p-4 text-left transition disabled:cursor-not-allowed ${isSelected ? "border-[color:var(--admin-accent)] bg-emerald-50/60 ring-1 ring-[color:var(--admin-accent)]" : "border-[color:var(--admin-line)] bg-white hover:border-[color:var(--admin-line-strong)]"}`}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--admin-muted)]">
                          {index === 0 ? "Tilrådd" : "Alternativ"}
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                          {formatNumber(plan.plannedPrimaryAmount)}{" "}
                          {recipe.primaryUnit}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[color:var(--admin-muted)]">
                          {describeCooks(plan.fullCooks, plan.halfCooks)}
                        </p>
                        <p
                          className={`mt-3 text-xs font-medium ${Math.abs(plan.differencePercent) > 20 ? "text-amber-700" : "text-[color:var(--admin-muted)]"}`}
                        >
                          {plan.difference >= 0 ? "+" : ""}
                          {formatNumber(plan.difference)} {recipe.primaryUnit} (
                          {plan.differencePercent >= 0 ? "+" : ""}
                          {formatNumber(plan.differencePercent, 1)} %)
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 text-sm text-amber-700">
                  Legg inn ei mengd større enn null.
                </p>
              )}
            </div>

            {selectedPlan ? (
              <div className="rounded-[22px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">
                      Skalert oppskrift
                    </h2>
                    <p className="mt-1 text-sm text-[color:var(--admin-muted)]">
                      For {formatNumber(selectedPlan.plannedPrimaryAmount)}{" "}
                      {recipe.primaryUnit} grunnmengd.
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-[color:var(--admin-muted)]">
                      Forventa etter koking
                    </p>
                    <p className="mt-1 text-xl font-semibold">
                      ca. {formatNumber(expectedYield, 1)}{" "}
                      {recipe.expectedYieldUnit}
                    </p>
                    {recipe.yieldConfidence === "estimated" ? (
                      <p className="mt-1 text-[10px] font-medium text-amber-700">
                        Førebels estimat
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-6 overflow-hidden rounded-[14px] border border-[color:var(--admin-line)]">
                  {recipe.ingredients.map((ingredient) => {
                    const scaled = scaleIngredient(
                      ingredient,
                      recipe,
                      selectedPlan.plannedPrimaryAmount,
                    );
                    return (
                      <div
                        key={ingredient.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-[color:var(--admin-line)] bg-white px-4 py-3 last:border-b-0"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {ingredient.name}
                          </p>
                          {ingredient.note ? (
                            <p className="mt-0.5 text-xs text-amber-700">
                              {ingredient.note}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {formatNumber(scaled.totalAmount)} {ingredient.unit}
                          </p>
                          {scaled.adjustmentAmount ? (
                            <p className="mt-0.5 text-xs text-[color:var(--admin-muted)]">
                              {formatNumber(scaled.baseAmount)} +{" "}
                              {formatNumber(scaled.adjustmentAmount)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 border-t border-[color:var(--admin-line)] pt-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">
                        Førebels emballasjefordeling
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--admin-muted)]">
                        Basert på salsfordelinga i same månad i 2025. Lager og
                        konkrete ordrar blir lagde til seinare.
                      </p>
                    </div>
                    <label className="text-xs font-medium text-[color:var(--admin-muted)]">
                      Produksjonsmånad
                      <select
                        disabled={isBatchLocked}
                        value={forecastMonth}
                        onChange={(event) => {
                          setForecastMonth(Number(event.target.value));
                          setPlannedOutputQuantities({});
                        }}
                        className="ml-2 rounded-[10px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2 text-sm text-[color:var(--admin-ink)] outline-none disabled:bg-neutral-100"
                      >
                        {monthNames.map((month, index) => (
                          <option key={month} value={index}>
                            {month}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {outputForecast.length ? (
                    <div className="mt-4">
                      <div className="overflow-hidden rounded-[14px] border border-[color:var(--admin-line)]">
                        <div className="grid grid-cols-[minmax(0,1fr)_82px_82px] gap-3 border-b border-[color:var(--admin-line)] bg-[color:var(--admin-active)] px-3.5 py-2.5 text-[11px] font-medium text-[color:var(--admin-muted)]">
                          <span>Produkt</span>
                          <span className="text-right">Historisk</span>
                          <span className="text-right">Plan</span>
                        </div>
                        {outputForecast.map(
                          ({ output, quantity, allocatedAmount }) => (
                            <div
                              key={output.id}
                              className="grid grid-cols-[minmax(0,1fr)_82px_82px] items-center gap-3 border-b border-[color:var(--admin-line)] bg-white px-3.5 py-3 last:border-b-0"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium">
                                  {output.name}
                                </p>
                                <p className="mt-0.5 text-[11px] text-[color:var(--admin-muted)]">
                                  ca. {formatNumber(allocatedAmount, 1)} kg/l
                                </p>
                              </div>
                              <p className="text-right text-sm font-semibold">
                                {quantity}
                              </p>
                              <input
                                aria-label={`Planlagt ${output.name}`}
                                disabled={isBatchLocked}
                                inputMode="numeric"
                                value={
                                  plannedOutputQuantities[output.id] ??
                                  String(quantity)
                                }
                                onChange={(event) =>
                                  setPlannedOutputQuantities((current) => ({
                                    ...current,
                                    [output.id]: event.target.value,
                                  }))
                                }
                                className="w-full rounded-[9px] border border-[color:var(--admin-line-strong)] bg-white px-2 py-1.5 text-right text-sm font-semibold outline-none disabled:bg-neutral-100"
                              />
                            </div>
                          ),
                        )}
                      </div>
                      <div className="mt-3 flex flex-col gap-3 rounded-[12px] border border-[color:var(--admin-line)] bg-[color:var(--admin-active)] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-medium">
                            Planlagt: {formatNumber(plannedPackagingAmount, 1)}{" "}
                            kg/l av ca. {formatNumber(expectedYield, 1)} kg/l
                          </p>
                          <p
                            className={`mt-0.5 text-[11px] ${plannedDifference < -0.05 ? "text-rose-700" : Math.abs(plannedDifference) <= 1 ? "text-emerald-700" : "text-amber-700"}`}
                          >
                            {plannedDifference > 0.05
                              ? `${formatNumber(plannedDifference, 1)} kg/l står att`
                              : plannedDifference < -0.05
                                ? `Planen er ${formatNumber(Math.abs(plannedDifference), 1)} kg/l større enn forventa`
                                : "Planen samsvarer med forventa resultat"}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isBatchLocked}
                          onClick={() => setPlannedOutputQuantities({})}
                          className="admin-button-secondary shrink-0 px-3 py-1.5 text-xs disabled:opacity-40"
                        >
                          Bruk systemforslaget
                        </button>
                      </div>
                      {recipe.outputs.some(
                        (output) => output.forecastEnabled === false,
                      ) ? (
                        <p className="px-1 pt-2 text-[11px] text-[color:var(--admin-muted)]">
                          Bestillingsvarer står med forslag 0, men kan leggjast
                          inn i planen manuelt. Seinare blir dei fylte frå
                          aktive ordrar.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-amber-700">
                      Det finst ikkje salsgrunnlag for denne månaden.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <div className="mt-8 space-y-6">
          {selectedPlan ? (
            <section className="rounded-[22px] border border-[color:var(--admin-line)] bg-white p-5 md:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--admin-muted)]">
                    Produksjonsbatch
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {activeBatchNumber || "Ikkje starta"}
                  </h2>
                  <p className="mt-1 text-xs text-[color:var(--admin-muted)]">
                    {activeBatchStatus === "completed"
                      ? "Fullført og lagra i historikken"
                      : activeBatchId
                        ? savingBatch
                          ? "Lagrar endringar …"
                          : batchMessage || "Endringar blir lagra automatisk"
                        : "Start produksjonen før de tek til med arbeidsskjemaet."}
                  </p>
                </div>
                {!activeBatchId ? (
                  <button
                    type="button"
                    onClick={startBatch}
                    disabled={savingBatch}
                    className="rounded-full bg-[color:var(--admin-accent)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {savingBatch ? "Startar …" : "Start produksjon"}
                  </button>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/production/print?batch=${encodeURIComponent(activeBatchId)}`}
                      className="admin-button-secondary px-4 py-2 text-xs"
                    >
                      Skriv ut arbeidsskjema
                    </Link>
                    <Link
                      href="/admin/production"
                      className="admin-button-secondary px-4 py-2 text-xs"
                    >
                      Ny produksjon
                    </Link>
                  </div>
                )}
              </div>
              {batchMessage && !activeBatchId ? (
                <p className="mt-3 text-sm text-amber-700">{batchMessage}</p>
              ) : null}
              {isBatchLocked ? (
                <div className="mt-4 rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
                  Denne batchen er fullført og skriveverna. Eventuelle seinare
                  avvik skal registrerast som ei eiga korrigering.
                </div>
              ) : null}
            </section>
          ) : null}
          {selectedPlan ? (
            <div className="mx-auto grid max-w-xl grid-cols-2 overflow-hidden rounded-full border border-[color:var(--admin-line)] bg-white p-1">
              <button
                type="button"
                onClick={() => setWorkflowStep("worksheet")}
                className={`rounded-full px-4 py-2 text-xs font-medium transition ${workflowStep === "worksheet" ? "bg-[color:var(--admin-ink)] text-white" : "text-[color:var(--admin-muted)]"}`}
              >
                1. Arbeidsskjema
              </button>
              <button
                type="button"
                onClick={() => setWorkflowStep("result")}
                className={`rounded-full px-4 py-2 text-xs font-medium transition ${workflowStep === "result" ? "bg-[color:var(--admin-ink)] text-white" : "text-[color:var(--admin-muted)]"}`}
              >
                2. Registrer resultat
              </button>
            </div>
          ) : null}

          {selectedPlan ? (
            <div
              className={`${workflowStep === "worksheet" ? "block" : "hidden"} rounded-[22px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:p-6`}
            >
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Arbeidsskjema per kok
                </h2>
                <p className="mt-1 text-sm leading-6 text-[color:var(--admin-muted)]">
                  Like kok står ved sida av kvarandre. Eit halvt kok får si eiga
                  skalerte oppskrift.
                </p>
              </div>
              <div className="mt-5 rounded-[16px] border border-[color:var(--admin-line)] bg-[color:var(--admin-active)] p-4">
                <div>
                  <h3 className="text-sm font-semibold">
                    Batchnummer på råvarer
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--admin-muted)]">
                    Valfritt. Dette er batchnummeret på bæra, ikkje
                    batchnummeret til det ferdige produktet.
                  </p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {recipe.ingredients
                    .filter((ingredient) => ingredient.tracksRawMaterialBatch)
                    .map((ingredient) => (
                      <label
                        key={ingredient.id}
                        className="text-xs font-medium text-[color:var(--admin-muted)]"
                      >
                        {ingredient.name}
                        <input
                          disabled={isBatchLocked}
                          value={rawMaterialBatches[ingredient.id] || ""}
                          onChange={(event) =>
                            setRawMaterialBatches((current) => ({
                              ...current,
                              [ingredient.id]: event.target.value,
                            }))
                          }
                          className="mt-1.5 w-full rounded-[11px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm font-normal text-[color:var(--admin-ink)] outline-none disabled:bg-neutral-100"
                          placeholder="Batchnummer (valfritt)"
                        />
                      </label>
                    ))}
                </div>
              </div>
              <div className="mt-5 space-y-4">
                {selectedPlan.fullCooks ? (
                  <CookSheet
                    recipe={recipe}
                    cookAmount={plannedCookSize}
                    count={selectedPlan.fullCooks}
                    title="Heile kok"
                    sheetKey="full"
                    checks={checks}
                    locked={isBatchLocked}
                    onCheck={(key, checked) =>
                      setChecks((current) => ({ ...current, [key]: checked }))
                    }
                  />
                ) : null}
                {selectedPlan.halfCooks ? (
                  <CookSheet
                    recipe={recipe}
                    cookAmount={plannedCookSize / 2}
                    count={selectedPlan.halfCooks}
                    title="Halvt kok"
                    sheetKey="half"
                    checks={checks}
                    locked={isBatchLocked}
                    onCheck={(key, checked) =>
                      setChecks((current) => ({ ...current, [key]: checked }))
                    }
                  />
                ) : null}
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setWorkflowStep("result")}
                  className="rounded-full bg-[color:var(--admin-accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--admin-accent-hover)]"
                >
                  Gå til registrering →
                </button>
              </div>
            </div>
          ) : null}

          {selectedPlan ? (
            <div
              className={`${workflowStep === "result" ? "block" : "hidden"} rounded-[22px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:p-6`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Registrer resultat
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--admin-muted)]">
                    Før inn det som faktisk vart pakka. Etikettark blir avrunda
                    opp til heile ark.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWorkflowStep("worksheet")}
                  className="admin-button-secondary shrink-0 px-3 py-1.5 text-xs"
                >
                  ← Arbeidsskjema
                </button>
              </div>
              <div className="mt-5 overflow-hidden rounded-[14px] border border-[color:var(--admin-line)]">
                <div className="grid grid-cols-[minmax(0,1fr)_90px_90px] gap-3 border-b border-[color:var(--admin-line)] bg-[color:var(--admin-active)] px-4 py-2.5 text-xs font-medium text-[color:var(--admin-muted)]">
                  <span>Produkt</span>
                  <span className="text-right">Produsert</span>
                  <span className="text-right">Etikettark</span>
                </div>
                {recipe.outputs.map((output) => {
                  const quantity = Math.max(
                    0,
                    Number(outputQuantities[output.id]?.replace(",", ".")) || 0,
                  );
                  return (
                    <div
                      key={output.id}
                      className="grid grid-cols-[minmax(0,1fr)_90px_90px] items-center gap-3 border-b border-[color:var(--admin-line)] bg-white px-4 py-3 last:border-b-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{output.name}</p>
                        <p className="mt-0.5 text-[11px] text-[color:var(--admin-muted)]">
                          {output.labelsPerSheet} etikettar per ark
                        </p>
                      </div>
                      <input
                        aria-label={`Produsert ${output.name}`}
                        disabled={isBatchLocked}
                        inputMode="numeric"
                        value={outputQuantities[output.id] || ""}
                        onChange={(event) =>
                          setOutputQuantities((current) => ({
                            ...current,
                            [output.id]: event.target.value,
                          }))
                        }
                        className="w-full rounded-[10px] border border-[color:var(--admin-line-strong)] px-2.5 py-2 text-right text-sm outline-none disabled:bg-neutral-100"
                        placeholder="0"
                      />
                      <p className="text-right text-sm font-semibold">
                        {quantity
                          ? Math.ceil(quantity / output.labelsPerSheet)
                          : 0}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Liter til seinare produksjon
                  <input
                    disabled={isBatchLocked}
                    inputMode="decimal"
                    value={extraLitres}
                    onChange={(event) => setExtraLitres(event.target.value)}
                    className="mt-1.5 w-full rounded-[12px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm font-normal outline-none disabled:bg-neutral-100"
                    placeholder="Til dømes 40"
                  />
                </label>
                <div className="rounded-[14px] border border-[color:var(--admin-line)] bg-[color:var(--admin-active)] px-4 py-3">
                  <p className="text-xs font-medium text-[color:var(--admin-muted)]">
                    Faktisk resultat totalt
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {formatNumber(actualTotal, 2)} kg/l
                  </p>
                  <p className="mt-1 text-[11px] text-[color:var(--admin-muted)]">
                    {formatNumber(packagedAmount, 2)} pakka +{" "}
                    {formatNumber(storedAmount, 2)} til seinare
                  </p>
                </div>
              </div>
              <label className="mt-4 block text-sm font-medium">
                Merknader
                <textarea
                  rows={3}
                  disabled={isBatchLocked}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-1.5 w-full resize-y rounded-[12px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm font-normal outline-none disabled:bg-neutral-100"
                  placeholder="Til dømes: 20 l × 2 i dunk til seinare produksjon"
                />
              </label>
              <div className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-[color:var(--admin-line)] pt-5 sm:flex-row sm:items-center">
                <p className="text-xs text-[color:var(--admin-muted)]">
                  Når batchen blir fullført, blir han flytta til
                  produksjonshistorikken.
                </p>
                <button
                  type="button"
                  onClick={completeBatch}
                  disabled={
                    !activeBatchId ||
                    activeBatchStatus === "completed" ||
                    savingBatch
                  }
                  className="rounded-full bg-[color:var(--admin-ink)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {activeBatchStatus === "completed"
                    ? "Batch fullført"
                    : "Fullfør produksjon"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-[22px] border border-[color:var(--admin-line)] bg-transparent p-5 md:p-6">
            <h2 className="text-base font-semibold tracking-tight">
              Batch og sporing
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--admin-muted)]">
              Oppskrift, råvarebatchar, avkryssingar, resultat og merknader blir
              lagra samla. Lager og etikettar kan seinare knytast til det same
              batchnummeret.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
