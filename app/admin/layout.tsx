

"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/sandbox";
import AdminOperatorProvider from "@/app/components/admin/AdminOperatorProvider";

const ADMIN_NAVIGATION = [
    { href: "/admin", label: "Oversikt", shortLabel: "Oversikt" },
    { href: "/admin/orders", label: "Ordrar", shortLabel: "Ordrar" },
    { href: "/admin/pickups", label: "Hentingar", shortLabel: "Henting" },
    { href: "/admin/customers", label: "Kundar", shortLabel: "Kundar" },
    { href: "/admin/products", label: "Produkt", shortLabel: "Produkt" },
    { href: "/admin/inventory", label: "Lager", shortLabel: "Lager" },
    { href: "/admin/production", label: "Produksjon", shortLabel: "Produksjon" },
];

const ADMIN_SECONDARY_NAVIGATION = [
    { href: "/admin/operators", label: "Brukarar" },
    { href: "/admin/production/labels", label: "Etikettmalar" },
    { href: "/admin/website", label: "Nettside" },
    { href: "/admin/prices", label: "Prisar" },
    { href: "/admin/integrations/zettle", label: "Zettle" },
    { href: "/admin/media", label: "Mediebank" },
];

function isAdminUser(user: User | null) {
    const email = user?.email?.trim().toLowerCase();
    if (!email) return false;
    return isAdminEmail(email);
}

export default function AdminLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [signingIn, setSigningIn] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [orderActionIds, setOrderActionIds] = useState<string[]>([]);
    const [requestActionIds, setRequestActionIds] = useState<string[]>([]);

    const isAdminHome = pathname === "/admin";
    const isDocumentView =
        pathname.endsWith("/confirmation") ||
        pathname.endsWith("/packing-slip") ||
        pathname.endsWith("/signature") ||
        pathname.endsWith("/print");
    const isAdmin = isAdminUser(user);
    const orderNotificationCount = new Set([...orderActionIds, ...requestActionIds]).size;

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
            setUser(nextUser);
            setCheckingAuth(false);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!isAdmin) {
            setOrderActionIds([]);
            setRequestActionIds([]);
            return;
        }

        const unsubscribeOrders = onSnapshot(collection(db, "orders"), (snapshot) => {
            setOrderActionIds(snapshot.docs.flatMap((orderDoc) => {
                const order = orderDoc.data() as any;
                const requiresAction =
                    order.status === "new" ||
                    (order.status === "partial" && order.approval?.status !== "waiting" && order.approval?.status !== "answered") ||
                    (order.approval?.status === "answered" && !order.approval?.adminSeenAt) ||
                    order.backorder?.status === "waiting_for_stock";
                return requiresAction ? [orderDoc.id] : [];
            }));
        });
        const unsubscribeRequests = onSnapshot(
            query(collection(db, "orderChangeRequests"), where("status", "==", "pending")),
            (snapshot) => setRequestActionIds(snapshot.docs.flatMap((doc) => {
                const orderId = doc.data().orderId;
                return typeof orderId === "string" && orderId ? [orderId] : [];
            }))
        );

        return () => {
            unsubscribeOrders();
            unsubscribeRequests();
        };
    }, [isAdmin]);

    async function handleLogout() {
        await signOut(auth);
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
        async function handleLogin(event: FormEvent<HTMLFormElement>) {
            event.preventDefault();
            setLoginError("");
            setSigningIn(true);
            try {
                await signInWithEmailAndPassword(auth, email.trim(), password);
            } catch (error) {
                console.error(error);
                setLoginError("Feil e-post eller passord.");
            } finally {
                setSigningIn(false);
            }
        }

        return (
            <main className="min-h-screen bg-[color:var(--admin-canvas)] text-neutral-900">
                <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-20">
                    <div className="rounded-[24px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-7 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--admin-muted)]">Valldal Safteri</p>
                        <h1
                            className="mt-3 text-3xl tracking-tight text-neutral-900"
                            style={{ fontFamily: "var(--font-serif)" }}
                        >
                            Administrasjon
                        </h1>
                        <p className="mt-2 text-sm leading-6 text-neutral-600">
                            Logg inn for å arbeide med ordrar, kundar, lager og nettside.
                        </p>

                        <form onSubmit={handleLogin} className="mt-7 grid gap-4">
                            <label className="space-y-1.5 text-sm font-medium text-neutral-800">
                                E-post
                                <input
                                    type="email"
                                    name="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    className="w-full rounded-[12px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm font-normal outline-none"
                                />
                            </label>
                            <label className="space-y-1.5 text-sm font-medium text-neutral-800">
                                Passord
                                <input
                                    type="password"
                                    name="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    className="w-full rounded-[12px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm font-normal outline-none"
                                />
                            </label>
                            {loginError ? <p role="alert" className="text-sm text-red-700">{loginError}</p> : null}
                            <button
                                type="submit"
                                disabled={signingIn}
                                className="mt-2 rounded-full bg-[color:var(--admin-accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--admin-accent-hover)] disabled:opacity-60"
                            >
                                {signingIn ? "Loggar inn …" : "Logg inn"}
                            </button>
                        </form>
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

    if (isDocumentView) return <AdminOperatorProvider>{children}</AdminOperatorProvider>;

    function isCurrent(href: string) {
        if (href === "/admin") return pathname === href;
        return pathname === href || pathname.startsWith(`${href}/`);
    }

    return (
        <AdminOperatorProvider>
        <div className="admin-shell min-h-screen bg-[color:var(--admin-canvas)] text-[color:var(--admin-ink)]">
            <header className="sticky top-0 z-40 border-b border-[color:var(--admin-line)] bg-[color:var(--admin-surface)]/95 backdrop-blur md:hidden">
                <div className="flex h-16 items-center justify-between px-4">
                    <Link href="/admin" className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--admin-muted)]">
                            Valldal Safteri
                        </span>
                        <span className="block truncate text-sm font-medium">Administrasjon</span>
                    </Link>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="admin-button-secondary px-3 py-1.5 text-xs"
                    >
                        Logg ut
                    </button>
                </div>
                <nav className="admin-scrollbar flex gap-1 overflow-x-auto px-3 pb-3" aria-label="Administrasjon">
                    {ADMIN_NAVIGATION.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={isCurrent(item.href) ? "page" : undefined}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                isCurrent(item.href)
                                    ? "bg-[color:var(--admin-ink)] text-white"
                                    : "text-[color:var(--admin-muted)] hover:bg-black/5 hover:text-[color:var(--admin-ink)]"
                            }`}
                        >
                            <span>{item.shortLabel}</span>
                            {item.href === "/admin/orders" && orderNotificationCount > 0 ? (
                                <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                    {orderNotificationCount}
                                </span>
                            ) : null}
                        </Link>
                    ))}
                </nav>
            </header>

            <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[color:var(--admin-line)] bg-[color:var(--admin-surface)] md:flex">
                <div className="border-b border-[color:var(--admin-line)] px-6 py-7">
                    <Link href="/admin" className="block">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--admin-muted)]">
                            Valldal Safteri
                        </span>
                        <span className="mt-1 block text-lg tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
                            Administrasjon
                        </span>
                    </Link>
                </div>

                <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Administrasjon">
                    <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-faint)]">
                        Arbeid
                    </p>
                    <div className="space-y-1">
                        {ADMIN_NAVIGATION.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isCurrent(item.href) ? "page" : undefined}
                                className={`flex items-center justify-between rounded-[10px] px-3 py-2.5 text-sm font-medium transition ${
                                    isCurrent(item.href)
                                        ? "bg-[color:var(--admin-active)] text-[color:var(--admin-ink)]"
                                        : "text-[color:var(--admin-muted)] hover:bg-black/[0.035] hover:text-[color:var(--admin-ink)]"
                                }`}
                            >
                                <span>{item.label}</span>
                                {item.href === "/admin/orders" && orderNotificationCount > 0 ? (
                                    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                                        {orderNotificationCount}
                                    </span>
                                ) : null}
                            </Link>
                        ))}
                    </div>

                    <p className="mt-7 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-faint)]">
                        System
                    </p>
                    <div className="space-y-1">
                        {ADMIN_SECONDARY_NAVIGATION.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isCurrent(item.href) ? "page" : undefined}
                                className={`flex items-center rounded-[10px] px-3 py-2.5 text-sm transition ${
                                    isCurrent(item.href)
                                        ? "bg-[color:var(--admin-active)] font-medium text-[color:var(--admin-ink)]"
                                        : "text-[color:var(--admin-muted)] hover:bg-black/[0.035] hover:text-[color:var(--admin-ink)]"
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </nav>

                <div className="border-t border-[color:var(--admin-line)] p-4">
                    <p className="truncate px-2 text-xs text-[color:var(--admin-muted)]" title={user.email || ""}>
                        {user.email}
                    </p>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="mt-3 w-full rounded-[10px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2 text-left text-xs font-medium text-[color:var(--admin-muted)] transition hover:border-neutral-400 hover:text-[color:var(--admin-ink)]"
                    >
                        Logg ut
                    </button>
                </div>
            </aside>

            <div className="admin-shell-content md:pl-60">{children}</div>
        </div>
        </AdminOperatorProvider>
    );
}
