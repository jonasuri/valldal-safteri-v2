"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/lib/firebase";

function PasswordAction() {
    const params = useSearchParams();
    const mode = params.get("mode");
    const code = params.get("oobCode") ?? "";
    const [checking, setChecking] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [repeatPassword, setRepeatPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [complete, setComplete] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (mode !== "resetPassword" || !code) {
            setError("Lenka er ugyldig eller manglar nødvendig informasjon.");
            setChecking(false);
            return;
        }

        verifyPasswordResetCode(auth, code)
            .then(setEmail)
            .catch(() => setError("Lenka er ugyldig eller har gått ut. Be om ei ny lenke frå innloggingssida."))
            .finally(() => setChecking(false));
    }, [code, mode]);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setError("");
        if (password.length < 8) {
            setError("Passordet må ha minst åtte teikn.");
            return;
        }
        if (password !== repeatPassword) {
            setError("Passorda er ikkje like.");
            return;
        }

        setSaving(true);
        try {
            await confirmPasswordReset(auth, code, password);
            setComplete(true);
        } catch {
            setError("Kunne ikkje lagre passordet. Be om ei ny lenke og prøv igjen.");
        } finally {
            setSaving(false);
        }
    }

    if (checking) return <p className="text-sm text-neutral-600">Kontrollerer den sikre lenka …</p>;

    if (complete) {
        return (
            <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Passordet er lagra</p>
                <h1 className="mt-3 text-4xl tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>Velkomen tilbake.</h1>
                <p className="mt-5 text-sm leading-6 text-neutral-600">Du kan no logge inn med e-postadressa di og det nye passordet.</p>
                <Link href="/account" className="mt-7 inline-flex rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white">Gå til innlogging →</Link>
            </div>
        );
    }

    if (!email) {
        return (
            <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Lenka kan ikkje brukast</p>
                <h1 className="mt-3 text-4xl tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>Vi hjelper deg vidare.</h1>
                <p className="mt-5 text-sm leading-6 text-neutral-600">{error}</p>
                <a href="mailto:post@valldalsafteri.no" className="mt-7 inline-flex rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white">Kontakt oss →</a>
            </div>
        );
    }

    return (
        <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Kundekonto · Valldal Safteri</p>
            <h1 className="mt-3 text-4xl tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>Vel ditt passord.</h1>
            <p className="mt-5 text-sm leading-6 text-neutral-600">Kontoen gjeld <strong>{email}</strong>. Passordet må ha minst åtte teikn.</p>
            <form className="mt-7 grid gap-4" onSubmit={submit}>
                <label className="space-y-1 text-sm font-medium text-neutral-800">Nytt passord<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 font-normal outline-none focus:border-neutral-800" /></label>
                <label className="space-y-1 text-sm font-medium text-neutral-800">Gjenta passordet<input type="password" autoComplete="new-password" value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} required className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 font-normal outline-none focus:border-neutral-800" /></label>
                <button disabled={saving} className="mt-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">{saving ? "Lagrar …" : "Lagre passord →"}</button>
            </form>
            {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        </div>
    );
}

export default function AuthActionPage() {
    return (
        <main className="min-h-screen bg-[color:var(--paper)] px-6 py-12 text-neutral-900">
            <header className="mx-auto flex max-w-4xl items-center justify-between">
                <Link href="/" className="text-sm font-semibold uppercase tracking-[0.16em]">Valldal Safteri</Link>
                <span className="text-xs text-neutral-500">Trygg kontotilgang</span>
            </header>
            <div className="mx-auto flex min-h-[75vh] max-w-lg items-center">
                <section className="w-full rounded-[24px] border border-neutral-200 bg-white p-7 shadow-sm sm:p-10">
                    <Suspense fallback={<p className="text-sm text-neutral-600">Opnar den sikre lenka …</p>}><PasswordAction /></Suspense>
                </section>
            </div>
        </main>
    );
}
