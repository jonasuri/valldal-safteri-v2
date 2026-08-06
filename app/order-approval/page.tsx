"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { ApprovalResponse } from "@/lib/ordersFirestore";

const choices: Array<{ value: ApprovalResponse; label: string; description: string }> = [
    { value: "deliver_partial_later", label: "Send det som er klart", description: "Manglande varer kan ettersendast seinare." },
    { value: "deliver_partial_cancel_rest", label: "Send det som er klart og stryk resten", description: "Manglande varer blir fjerna frå bestillinga." },
    { value: "wait_for_complete", label: "Vent til alt er klart", description: "Vi ventar med levering til heile bestillinga kan leverast." },
];

type Preview = { orderNumber: string; customerName: string; lines: Array<{ productName: string; variantLabel: string; orderedQuantity: number; packedQuantity: number }> };

function OrderApprovalContent() {
    const params = useSearchParams();
    const token = params.get("token") || "";
    const requestedChoice = params.get("choice") as ApprovalResponse | null;
    const [preview, setPreview] = useState<Preview | null>(null);
    const [choice, setChoice] = useState<ApprovalResponse | null>(choices.some((item) => item.value === requestedChoice) ? requestedChoice : null);
    const [state, setState] = useState<"loading" | "ready" | "saving" | "done" | "error">("loading");

    useEffect(() => {
        fetch(`/api/public/order-approval?token=${encodeURIComponent(token)}`)
            .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
            .then((data) => { setPreview(data); setState("ready"); })
            .catch(() => setState("error"));
    }, [token]);

    async function confirm() {
        if (!choice) return;
        setState("saving");
        const response = await fetch("/api/public/order-approval", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, response: choice }) });
        setState(response.ok ? "done" : "error");
    }

    return <main className="min-h-screen bg-[#f3f0e9] px-4 py-12 text-neutral-900">
        <div className="mx-auto max-w-2xl rounded-[24px] border border-neutral-200 bg-[#fffdf8] p-6 md:p-10">
            <p className="text-xs font-semibold tracking-[0.18em]">VALLDAL SAFTERI</p>
            {state === "loading" ? <p className="mt-8 text-sm text-neutral-600">Hentar bestillinga …</p> : null}
            {state === "error" ? <><h1 className="mt-8 text-2xl font-medium">Lenkja kan ikkje brukast</h1><p className="mt-3 text-neutral-600">Ho kan vere utgått eller allereie brukt. Ta kontakt med oss dersom de treng ei ny lenkje.</p></> : null}
            {state === "done" ? <><h1 className="mt-8 text-3xl font-medium">Takk. Svaret er registrert.</h1><p className="mt-3 text-neutral-600">Vi behandlar bestillinga vidare etter valet dykkar.</p></> : null}
            {preview && (state === "ready" || state === "saving") ? <>
                <h1 className="mt-8 text-3xl font-medium">Vel korleis vi skal handtere bestillinga</h1>
                <p className="mt-3 text-sm text-neutral-600">Ordre {preview.orderNumber} · {preview.customerName}</p>
                <div className="mt-6 space-y-2 rounded-[16px] bg-neutral-50 p-4 text-sm">{preview.lines.map((line, index) => <div key={index} className="flex justify-between gap-4"><span>{line.productName} – {line.variantLabel}</span><span className="shrink-0">{line.packedQuantity} av {line.orderedQuantity} pakka</span></div>)}</div>
                <div className="mt-6 space-y-3">{choices.map((item) => <button key={item.value} type="button" onClick={() => setChoice(item.value)} className={`w-full rounded-[16px] border p-4 text-left ${choice === item.value ? "border-neutral-900 bg-white" : "border-neutral-200 bg-neutral-50"}`}><span className="font-medium">{item.label}</span><span className="mt-1 block text-sm text-neutral-600">{item.description}</span></button>)}</div>
                <button type="button" disabled={!choice || state === "saving"} onClick={confirm} className="mt-6 w-full rounded-full bg-neutral-900 px-5 py-3 font-medium text-white disabled:opacity-40">{state === "saving" ? "Lagrar …" : "Stadfest valet"}</button>
            </> : null}
        </div>
    </main>;
}

export default function OrderApprovalPage() {
    return <Suspense fallback={<main className="min-h-screen bg-[#f3f0e9] px-4 py-12 text-neutral-900"><div className="mx-auto max-w-2xl rounded-[24px] border border-neutral-200 bg-[#fffdf8] p-10 text-sm text-neutral-600">Hentar bestillinga …</div></main>}><OrderApprovalContent /></Suspense>;
}
