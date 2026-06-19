"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";
import { saveDeliverySignature } from "@/lib/ordersFirestore";

export default function OrderSignaturePage() {
    const params = useParams();
    const orderId = typeof params.id === "string" ? params.id : "";
    const router = useRouter();

    const signatureRef = useRef<SignatureCanvas | null>(null);
    const [receiverName, setReceiverName] = useState("");
    const [signatureDataUrl, setSignatureDataUrl] = useState("");
    const [signingMode, setSigningMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deliveryType, setDeliveryType] = useState<"delivered" | "picked_up">("delivered");

    const clearSignature = () => {
        signatureRef.current?.clear();
        setSignatureDataUrl("");
    };

    const enterSigningMode = async () => {
        setError(null);
        setSigningMode(true);
        document.body.style.overflow = "hidden";

        try {
            await document.documentElement.requestFullscreen?.();
        } catch {
            // Fullscreen is optional and may be blocked by the browser.
        }

        try {
            await (screen.orientation as any)?.lock?.("landscape");
        } catch {
            // Orientation lock is optional and mainly supported on mobile in fullscreen.
        }
    };

    const exitSigningMode = async () => {
        setSigningMode(false);
        document.body.style.overflow = "";

        try {
            (screen.orientation as any)?.unlock?.();
        } catch {
            // Ignore unsupported orientation APIs.
        }

        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen?.();
            }
        } catch {
            // Ignore fullscreen exit errors.
        }
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
        if (!receiverName.trim()) {
            setError("Skriv inn namn på mottakar.");
            return;
        }

        if (!signatureDataUrl) {
            setError("Signatur manglar.");
            return;
        }

        try {
            setSaving(true);
            setError(null);

            await saveDeliverySignature(orderId, {
                signedBy: receiverName.trim(),
                signatureDataUrl,
                deliveryType,
            });

            router.push(`/admin/orders/${orderId}`);
        } catch {
            setError("Klarte ikkje lagre signaturen.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
            {signingMode ? (
                <div className="fixed inset-0 z-50 flex h-[100dvh] w-screen flex-col overflow-hidden bg-white text-neutral-900 touch-none overscroll-none">
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-3 py-2">
                        <button
                            type="button"
                            onClick={clearSignature}
                            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700"
                        >
                            Tøm
                        </button>

                        <div className="text-center">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                                Signatur
                            </div>
                            <div className="text-xs text-neutral-500">
                                Signer i feltet
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={confirmSignature}
                            className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white"
                        >
                            Signert
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-hidden bg-white p-2">
                        <div className="h-full overflow-hidden rounded-[14px] border border-neutral-300 bg-white">
                            <SignatureCanvas
                                ref={signatureRef}
                                canvasProps={{
                                    className: "block h-full w-full touch-none",
                                }}
                            />
                        </div>
                    </div>
                </div>
            ) : null}
            <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
                <div className="mb-6">
                    <Link
                        href={`/admin/orders/${orderId}`}
                        className="text-sm text-neutral-600 underline-offset-4 hover:underline"
                    >
                        ← Tilbake til ordre
                    </Link>
                </div>

                <div className="rounded-[24px] border border-neutral-200 bg-white p-6 shadow-sm">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Signer mottak
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-neutral-600">
                        Opne signaturflata først. På telefon prøver sida å bruke fullskjerm og landskap for betre skriveflate. Etterpå fyller de inn mottakar og mottakstype.
                    </p>

                    <div className="mt-8 rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
                        {signatureDataUrl ? (
                            <div>
                                <div className="rounded-[14px] border border-neutral-200 bg-white p-3">
                                    <img
                                        src={signatureDataUrl}
                                        alt="Registrert signatur"
                                        className="h-28 w-full object-contain"
                                    />
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={enterSigningMode}
                                        className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                                    >
                                        Signer på nytt
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="text-sm font-medium text-neutral-900">
                                        Signatur manglar
                                    </div>
                                    <p className="mt-1 text-sm text-neutral-500">
                                        Opne signaturflata, la kunden signere, og trykk «Signert».
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={enterSigningMode}
                                    className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                                >
                                    Opne signaturflate
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Namn på mottakar
                            </label>
                            <input
                                type="text"
                                value={receiverName}
                                onChange={(event) => setReceiverName(event.target.value)}
                                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                                placeholder="Kven mottok varene?"
                            />
                        </div>
                    </div>

                    <div className="mt-6">
                        <label className="mb-2 block text-sm font-medium">
                            Mottakstype
                        </label>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setDeliveryType("delivered")}
                                className={`rounded-full px-4 py-2 text-sm font-medium transition ${deliveryType === "delivered"
                                    ? "bg-emerald-600 text-white"
                                    : "border border-neutral-300 bg-white text-neutral-700"
                                    }`}
                            >
                                Levert
                            </button>

                            <button
                                type="button"
                                onClick={() => setDeliveryType("picked_up")}
                                className={`rounded-full px-4 py-2 text-sm font-medium transition ${deliveryType === "picked_up"
                                    ? "bg-emerald-600 text-white"
                                    : "border border-neutral-300 bg-white text-neutral-700"
                                    }`}
                            >
                                Henta
                            </button>
                        </div>
                    </div>

                    {error ? (
                        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    ) : null}

                    <div className="mt-8 flex justify-end">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
                        >
                            {saving ? "Lagrar …" : "Lagre signatur"}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}