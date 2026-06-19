

"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

const ADMIN_EMAILS = [
    "post@valldalsafteri.no",
];

function isAdminUser(user: User | null) {
    const email = user?.email?.trim().toLowerCase();
    if (!email) return false;
    return ADMIN_EMAILS.map((adminEmail) => adminEmail.trim().toLowerCase()).includes(email);
}

export default function AdminLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);
    const [checkingAuth, setCheckingAuth] = useState(true);

    const isAdminHome = pathname === "/admin";
    const isAdmin = isAdminUser(user);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
            setUser(nextUser);
            setCheckingAuth(false);
        });

        return () => unsubscribe();
    }, []);

    async function handleLogout() {
        await signOut(auth);
    }

    if (isAdminHome) {
        return <>{children}</>;
    }

    if (checkingAuth) {
        return (
            <main className="min-h-screen bg-[color:var(--paper)] text-neutral-900">
                <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4 py-20">
                    <p className="text-sm text-neutral-600">Sjekkar tilgang …</p>
                </div>
            </main>
        );
    }

    if (!user) {
        return (
            <main className="min-h-screen bg-[color:var(--paper)] text-neutral-900">
                <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-20">
                    <div className="rounded-[24px] border border-[color:var(--line)] bg-white/80 p-6 text-center shadow-sm">
                        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Admin</p>
                        <h1
                            className="mt-3 text-2xl tracking-tight text-neutral-900"
                            style={{ fontFamily: "var(--font-serif)" }}
                        >
                            Logg inn først
                        </h1>
                        <p className="mt-3 text-sm leading-6 text-neutral-600">
                            Du må vere logga inn med ein adminbrukar for å opne denne sida.
                        </p>
                        <Link
                            href="/admin"
                            className="mt-6 inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-[color:var(--paper)] hover:bg-neutral-800"
                        >
                            Gå til innlogging
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    if (!isAdmin) {
        return (
            <main className="min-h-screen bg-[color:var(--paper)] text-neutral-900">
                <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-20">
                    <div className="rounded-[24px] border border-[color:var(--line)] bg-white/80 p-6 text-center shadow-sm">
                        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Admin</p>
                        <h1
                            className="mt-3 text-2xl tracking-tight text-neutral-900"
                            style={{ fontFamily: "var(--font-serif)" }}
                        >
                            Ingen admintilgang
                        </h1>
                        <p className="mt-3 text-sm leading-6 text-neutral-600">
                            Du er logga inn, men denne brukaren har ikkje tilgang til administrasjonssida.
                        </p>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="mt-6 inline-flex items-center justify-center rounded-full border border-[color:var(--line)] px-4 py-2 text-xs text-neutral-700 hover:bg-black/5"
                        >
                            Logg ut
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    return <>{children}</>;
}