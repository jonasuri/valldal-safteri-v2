"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { auth } from "@/lib/firebase";
import { setAdminOrderStatus } from "@/lib/customerEmailActions";
import { saveDeliverySignature } from "@/lib/ordersFirestore";

type DeliveryType = "shipped" | "delivered" | "picked_up";

type Props = {
    orderId: string;
    onClose: () => void;
    onComplete: () => void;
    overlay?: boolean;
};

export default function OrderDeliveryDialog({ orderId, onClose, onComplete, overlay = false }: Props) {
    const signatureRef = useRef<SignatureCanvas | null>(null);
    const [receiverName, setReceiverName] = useState("");
    const [signatureDataUrl, setSignatureDataUrl] = useState("");
    const [signingMode, setSigningMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deliveryType, setDeliveryType] = useState<DeliveryType>("delivered");

    const exitSigningMode = async () => {
        setSigningMode(false);
        document.body.style.overflow = "";
        try { (screen.orientation as any)?.unlock?.(); } catch { /* Unsupported browser. */ }
        try {
            if (document.fullscreenElement) await document.exitFullscreen?.();
        } catch { /* Fullscreen is optional. */ }
    };

    const enterSigningMode = async () => {
        setError(null);
        setSigningMode(true);
        document.body.style.overflow = "hidden";
        try { await document.documentElement.requestFullscreen?.(); } catch { /* Fullscreen is optional. */ }
        try { await (screen.orientation as any)?.lock?.("landscape"); } catch { /* Mainly supported on mobile. */ }
    };

    const confirmSignature = async () => {
        if (!signatureRef.current || signatureRef.current.isEmpty()) {
            setError("Signatur manglar.");
            return;
        }
        setSignatureDataUrl(signatureRef.current.toDataURL("image/png"));
        setError(null);
        signatureRef.current.clear();
        await exitSigningMode();
    };

    const handleSave = async () => {
        if (signatureDataUrl && !receiverName.trim()) {
            setError("Skriv inn namn på mottakar.");
            return;
        }

        try {
            setSaving(true);
            setError(null);
            await saveDeliverySignature(orderId, {
                ...(signatureDataUrl ? { signedBy: receiverName.trim(), signatureDataUrl } : {}),
                deliveryType,
            });
            if (!auth.currentUser) throw new Error("UNAUTHORIZED");
            await setAdminOrderStatus(auth.currentUser, orderId, deliveryType);
            onComplete();
        } catch {
            setError("Klarte ikkje registrere utleveringa.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={overlay ? "fixed inset-0 z-40 overflow-y-auto bg-neutral-950/35 p-4 backdrop-blur-[2px] md:flex md:items-center md:justify-center md:p-8" : ""}>
            {signingMode ? (
                <div className="fixed inset-0 z-50 flex h-[100dvh] w-screen flex-col overflow-hidden bg-white text-neutral-900 touch-none overscroll-none">
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-3 py-2">
                        <button type="button" onClick={() => signatureRef.current?.clear()} className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700">Tøm</button>
                        <div className="text-center text-xs text-neutral-500"><div className="font-semibold uppercase tracking-[0.18em]">Signatur</div>Signer i feltet</div>
                        <button type="button" onClick={confirmSignature} className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white">Signert</button>
                    </div>
                    <div className="min-h-0 flex-1 p-2">
                        <div className="h-full overflow-hidden rounded-[14px] border border-neutral-300">
                            <SignatureCanvas ref={signatureRef} canvasProps={{ className: "block h-full w-full touch-none" }} />
                        </div>
                    </div>
                </div>
            ) : null}

            <div role="dialog" aria-modal={overlay} aria-labelledby="delivery-title" className="relative mx-auto w-full max-w-2xl rounded-[24px] border border-neutral-200 bg-white p-5 text-neutral-900 shadow-xl md:max-h-[calc(100vh-4rem)] md:overflow-y-auto md:p-7">
                <button type="button" onClick={onClose} aria-label="Lukk" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-neutral-200 bg-white text-lg text-neutral-600 hover:bg-neutral-50">×</button>
                <h1 id="delivery-title" className="pr-12 text-2xl font-semibold tracking-tight">Registrer utlevering</h1>
                <p className="mt-3 text-sm leading-6 text-neutral-600">Vel om ordren er send, levert eller henta. Signatur kan leggjast til dersom de ønskjer dokumentasjon på mottaket.</p>

                <div className="mt-6">
                    <div className="mb-2 text-sm font-medium">Kva skjedde med ordren?</div>
                    <div className="flex flex-wrap gap-3">
                        {([["shipped", "Sendt"], ["delivered", "Levert"], ["picked_up", "Henta"]] as const).map(([value, label]) => (
                            <button key={value} type="button" onClick={() => setDeliveryType(value)} className={`rounded-full px-4 py-2 text-sm font-medium transition ${deliveryType === value ? "bg-emerald-600 text-white" : "border border-neutral-300 bg-white text-neutral-700"}`}>{label}</button>
                        ))}
                    </div>
                </div>

                <div className="mt-6 rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
                    {signatureDataUrl ? (
                        <div>
                            <div className="rounded-[14px] border border-neutral-200 bg-white p-3"><img src={signatureDataUrl} alt="Registrert signatur" className="h-24 w-full object-contain" /></div>
                            <div className="mt-3 flex justify-end"><button type="button" onClick={enterSigningMode} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700">Signer på nytt</button></div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div><div className="text-sm font-medium">Signatur er valfri</div><p className="mt-1 text-sm text-neutral-500">Legg til signatur dersom kunden eller mottakaren skal stadfeste mottaket.</p></div>
                            <button type="button" onClick={enterSigningMode} className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white">Legg til signatur</button>
                        </div>
                    )}
                </div>

                {signatureDataUrl ? <div className="mt-5"><label className="mb-2 block text-sm font-medium">Namn på mottakar</label><input value={receiverName} onChange={(event) => setReceiverName(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" placeholder="Kven mottok varene?" /></div> : null}
                {error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

                <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onClose} className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700">Avbryt</button>
                    <button type="button" onClick={handleSave} disabled={saving} className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">{saving ? "Lagrar …" : "Fullfør utlevering"}</button>
                </div>
            </div>
        </div>
    );
}
