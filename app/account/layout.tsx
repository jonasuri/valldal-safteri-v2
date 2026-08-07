"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

const accountNavigation = [
    { href: "/account", label: "Mi side" },
    { href: "/account/order", label: "Ny bestilling" },
    { href: "/account/orders", label: "Bestillingar" },
    { href: "/account/pickups", label: "Hentehistorikk" },
    { href: "/account/profile", label: "Profil" },
];

export default function AccountLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => onAuthStateChanged(auth, setUser), []);

    const isDocumentView = pathname.endsWith("/confirmation") || pathname.endsWith("/packing-slip");
    if (isDocumentView) return <>{children}</>;

    function isCurrent(href: string) {
        if (href === "/account") return pathname === href;
        return pathname === href || pathname.startsWith(`${href}/`);
    }

    return (
        <div className="account-shell min-h-screen bg-[color:var(--account-canvas)] text-[color:var(--account-ink)]">
            <header className="sticky top-0 z-30 border-b border-[color:var(--account-line)] bg-[color:var(--account-surface)]/95 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-5 py-5 md:px-8">
                    <Link href={user ? "/account" : "/"} className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--account-muted)]">
                            Valldal Safteri
                        </span>
                        <span className="mt-0.5 block text-lg tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
                            Kundeområde
                        </span>
                    </Link>
                    {user ? (
                        <div className="flex items-center gap-3">
                            <span className="hidden max-w-48 truncate text-xs text-[color:var(--account-muted)] sm:block">{user.email}</span>
                            <button type="button" onClick={() => void signOut(auth)} className="account-button-secondary px-3.5 py-2 text-xs">
                                Logg ut
                            </button>
                        </div>
                    ) : (
                        <Link href="/" className="text-xs font-medium text-[color:var(--account-muted)] hover:text-[color:var(--account-ink)]">
                            Til nettsida
                        </Link>
                    )}
                </div>
                {user ? (
                    <nav className="account-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-4 md:px-7" aria-label="Kundeområde">
                        {accountNavigation.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isCurrent(item.href) ? "page" : undefined}
                                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition ${
                                    isCurrent(item.href)
                                        ? "bg-[color:var(--account-accent)] text-white"
                                        : "text-[color:var(--account-muted)] hover:bg-black/5 hover:text-[color:var(--account-ink)]"
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                ) : null}
            </header>
            <div className="account-shell-content">{children}</div>
        </div>
    );
}
