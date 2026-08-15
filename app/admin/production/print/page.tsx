"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProductionBatch, markProductionWorksheetPrinted, type ProductionBatch } from "@/lib/production/batchesFirestore";
import { scaleIngredient } from "@/lib/production/recipeMath";
import { useAdminOperator } from "@/app/components/admin/AdminOperatorProvider";

const colors: Record<string, { strong: string; soft: string; text: string }> = {
    Sylte: { strong: "#48a9d1", soft: "#dff3fa", text: "#102a35" },
    Saft: { strong: "#64be78", soft: "#e1f6e6", text: "#14331b" },
    Gelé: { strong: "#5a3cff", soft: "#e8e3ff", text: "#ffffff" },
    Frisk: { strong: "#c879bd", soft: "#f5dff2", text: "#35102f" },
    Rein: { strong: "#d99470", soft: "#f8e5da", text: "#3b2115" },
    Saus: { strong: "#c4b52e", soft: "#fffbc9", text: "#302b06" },
};

function formatNumber(value: number, digits = 2) {
    return new Intl.NumberFormat("nn-NO", { maximumFractionDigits: digits }).format(value);
}

function groups(total: number, size = 5) {
    return Array.from({ length: Math.ceil(total / size) }, (_, index) => ({ start: index * size, count: Math.min(size, total - index * size) }));
}

function cooksPerSheet(batch: ProductionBatch) {
    const recipe = batch.recipeSnapshot;
    const warningWeight = (recipe.warnings || []).reduce((total, warning) => total + Math.max(1, Math.ceil(warning.text.length / 55)), 0);
    if (warningWeight > 0 || recipe.ingredients.length >= 7 || recipe.process.length >= 8) return 2;
    if (recipe.ingredients.length >= 6 || recipe.process.length >= 7) return 3;
    return 4;
}

function CheckBox({ checked = false }: { checked?: boolean }) {
    return <span className="inline-flex h-4 w-4 items-center justify-center border border-black text-[10px] font-bold">{checked ? "✓" : ""}</span>;
}

function CookPrintSheet({ batch, operatorName, kind, cookAmount, totalCooks, start, count }: { batch: ProductionBatch; operatorName: string; kind: "full" | "half"; cookAmount: number; totalCooks: number; start: number; count: number }) {
    const recipe = batch.recipeSnapshot;
    const color = colors[recipe.category] || { strong: "#64748b", soft: "#f1f5f9", text: "#ffffff" };
    const date = batch.createdAt || new Date();
    const rawIngredients = recipe.ingredients.filter((ingredient) => ingredient.tracksRawMaterialBatch);
    return (
        <article className="print-sheet mx-auto mb-6 flex min-h-[720px] w-[1120px] flex-col overflow-hidden border-2 border-black bg-white text-black">
            <header className="grid grid-cols-[1fr_260px] border-b-2 border-black">
                <div className="px-5 py-3" style={{ backgroundColor: color.strong, color: color.text }}><p className="text-[11px] font-semibold uppercase tracking-[0.16em]">{recipe.category} · arbeidsskjema</p><h1 className="mt-1 text-2xl font-semibold">{recipe.name}</h1></div>
                <dl className="grid grid-cols-2 text-xs"><div className="border-r border-black p-3"><dt className="font-semibold">Batch</dt><dd className="mt-1 text-base">{batch.batchNumber}</dd></div><div className="p-3"><dt className="font-semibold">Dato</dt><dd className="mt-1 text-base">{new Intl.DateTimeFormat("nn-NO").format(date)}</dd></div></dl>
            </header>

            <div className="grid grid-cols-[430px_1fr]">
                <section className="border-r-2 border-black">
                    <div className="grid h-9 grid-cols-[1fr_112px] items-center border-b border-black px-3 text-sm" style={{ backgroundColor: color.soft }}><strong>{kind === "full" ? "Heilt kok" : "Halvt kok"}</strong><strong className="text-right">{formatNumber(cookAmount)} {recipe.primaryUnit}</strong></div>
                    <div className="grid h-9 grid-cols-[1fr_112px] items-center border-b border-black px-3 text-xs font-semibold"><span>Ingrediens</span><span className="text-right">Per kok</span></div>
                    {recipe.ingredients.map((ingredient) => { const scaled = scaleIngredient(ingredient, recipe, cookAmount); return <div key={ingredient.id} className="grid h-11 grid-cols-[1fr_112px] items-center border-b border-black px-3 text-xs"><span className="font-medium">{ingredient.name}</span><span className="text-right font-semibold">{formatNumber(scaled.totalAmount)} {ingredient.unit}</span></div>; })}
                </section>

                <section>
                    <div className="flex h-9 items-center border-b border-black px-3 text-xs font-semibold" style={{ backgroundColor: color.soft }}>Avkryssing per kok</div>
                    <div className="grid h-9 border-b border-black text-center text-xs font-semibold" style={{ gridTemplateColumns: `110px repeat(${count}, minmax(0, 1fr))`, backgroundColor: color.soft }}><div className="flex items-center border-r border-black px-2 text-left">Kontroll</div>{Array.from({ length: count }, (_, local) => <div key={local} className="flex items-center justify-center border-r border-black px-2 last:border-r-0">Kok {start + local + 1} av {totalCooks}</div>)}</div>
                    {recipe.ingredients.map((ingredient) => <div key={ingredient.id} className="grid h-11 border-b border-black text-[10px]" style={{ gridTemplateColumns: `110px repeat(${count}, minmax(0, 1fr))` }}><div className="flex items-center border-r border-black px-2 font-medium">{ingredient.name}</div>{Array.from({ length: count }, (_, local) => { const cookIndex = start + local; return <div key={local} className="flex items-center justify-center gap-3 border-r border-black px-2 last:border-r-0"><span className="flex items-center gap-1"><CheckBox checked={Boolean(batch.checks?.[`${kind}-ingredient-${ingredient.id}-${cookIndex}-measured`])} /> Målt</span><span className="flex items-center gap-1"><CheckBox checked={Boolean(batch.checks?.[`${kind}-ingredient-${ingredient.id}-${cookIndex}-added`])} /> Tilsett</span></div>; })}</div>)}
                </section>
            </div>

            {recipe.warnings?.length ? <section className="border-t-2 border-b-2 border-black bg-amber-100 px-4 py-2"><strong className="mr-3 text-xs uppercase">OBS</strong>{recipe.warnings.map((warning) => <span key={warning.id} className="mr-5 text-sm font-semibold">{warning.text}</span>)}</section> : null}

            <section className="border-b-2 border-black">
                <div className="grid text-center text-[10px] font-semibold" style={{ gridTemplateColumns: `80px repeat(${recipe.process.length}, minmax(0, 1fr))`, backgroundColor: color.soft }}><div className="border-r border-black px-2 py-2 text-left">Arbeidsgang</div>{recipe.process.map((step, index) => <div key={step.id} className="border-r border-black px-2 py-2 last:border-r-0"><span className="mr-1">{index + 1}.</span>{step.title}</div>)}</div>
                {Array.from({ length: count }, (_, local) => <div key={local} className="grid border-t border-black text-center text-xs" style={{ gridTemplateColumns: `80px repeat(${recipe.process.length}, minmax(0, 1fr))` }}><div className="border-r border-black px-2 py-3 text-left font-semibold">Kok {start + local + 1}</div>{recipe.process.map((step) => <div key={step.id} className="flex min-h-12 items-center justify-center border-r border-black last:border-r-0"><CheckBox checked={Boolean(batch.checks?.[`${kind}-process-${step.id}`])} /></div>)}</div>)}
            </section>

            <footer className="mt-auto grid min-h-[120px] grid-cols-[1fr_1fr_260px] border-t-2 border-black text-xs">
                <div className="border-r border-black p-3"><strong>Råvarebatch</strong><div className="mt-2 grid grid-cols-2 gap-2">{rawIngredients.length ? rawIngredients.map((ingredient) => <div key={ingredient.id} className="border-b border-black pb-1"><span>{ingredient.name}: </span><strong>{batch.rawMaterialBatches?.[ingredient.id] || "________________"}</strong></div>) : <span>Ingen råvarebatch</span>}</div></div>
                <div className="border-r border-black p-3"><strong>Merknad under produksjon</strong><div className="mt-7 border-b border-black" /><div className="mt-7 border-b border-black" /><div className="mt-7 border-b border-black" /></div>
                <div className="p-3"><strong>Ansvarleg</strong><p className="mt-3 text-base font-semibold">{operatorName}</p><p className="mt-2 text-[10px]">Registrert automatisk ved utskrift</p></div>
            </footer>
        </article>
    );
}

export default function ProductionPrintPage() {
    const { operator } = useAdminOperator();
    const [batch, setBatch] = useState<ProductionBatch | null>(null);
    const [error, setError] = useState("");
    useEffect(() => { const id = new URLSearchParams(window.location.search).get("batch"); if (!id) { setError("Batchnummer manglar."); return; } getProductionBatch(id).then((value) => value ? setBatch(value) : setError("Fann ikkje batchen.")).catch((next) => setError(next instanceof Error ? next.message : "Klarte ikkje å hente batchen.")); }, []);
    if (error) return <main className="p-8 text-sm text-red-700">{error}</main>;
    if (!batch) return <main className="p-8 text-sm">Hentar arbeidsskjema …</main>;
    const plan = batch.selectedPlan;
    async function printWorksheet() {
        if (!batch || !operator) return;
        try {
            await markProductionWorksheetPrinted(batch.id);
            window.print();
        } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : "Klarte ikkje å registrere utskrifta.");
        }
    }
    return (
        <main className="min-h-screen bg-neutral-100 px-4 py-6 text-neutral-950 print:bg-white print:p-0">
            <style jsx global>{`@page { size: A4 landscape; margin: 7mm; } @media print { html, body { background: white !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; } .print-controls { display: none !important; } .print-sheet { width: 100% !important; min-height: 190mm !important; margin: 0 !important; page-break-inside: avoid !important; break-inside: avoid-page !important; page-break-after: always; break-after: page; } .print-sheet:last-child { page-break-after: auto; break-after: auto; } }`}</style>
            <div className="print-controls mx-auto mb-5 flex max-w-[1120px] items-center justify-between gap-3"><Link href={`/admin/production?batch=${encodeURIComponent(batch.id)}`} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm">← Tilbake til batch</Link><button type="button" onClick={() => void printWorksheet()} className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white">Skriv ut som {operator?.name || "vald brukar"}</button></div>
            {plan.fullCooks ? groups(plan.fullCooks, cooksPerSheet(batch)).map((group) => <CookPrintSheet key={`full-${group.start}`} batch={batch} operatorName={operator?.name || "—"} kind="full" cookAmount={Number(batch.cookSizeText.replace(",", "."))} totalCooks={plan.fullCooks} start={group.start} count={group.count} />) : null}
            {plan.halfCooks ? groups(plan.halfCooks, cooksPerSheet(batch)).map((group) => <CookPrintSheet key={`half-${group.start}`} batch={batch} operatorName={operator?.name || "—"} kind="half" cookAmount={Number(batch.cookSizeText.replace(",", ".")) / 2} totalCooks={plan.halfCooks} start={group.start} count={group.count} />) : null}
        </main>
    );
}
