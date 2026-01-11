"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    listenToProducts,
    upsertProductMinimal,
    toSlug,
    type ProductBrand,
} from "@/lib/productsFirestore";

export default function AdminProductsPage() {
    const router = useRouter();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const [query, setQuery] = useState("");
    const [brandFilter, setBrandFilter] = useState<"alle" | ProductBrand>("alle");

    const filteredProducts = products
        .filter((p) => {
            const q = query.trim().toLowerCase();
            if (!q) return true;
            const name = String(p?.name ?? "").toLowerCase();
            const category = String(p?.category ?? "").toLowerCase();
            const sku = String(p?.sku ?? "").toLowerCase();
            const slug = String(p?.slug ?? "").toLowerCase();
            return (
                name.includes(q) ||
                category.includes(q) ||
                sku.includes(q) ||
                slug.includes(q)
            );
        })
        .filter((p) => {
            if (brandFilter === "alle") return true;
            return String(p?.brand ?? "") === brandFilter;
        })
        .slice()
        .sort((a, b) => String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "nb"));

    const counts = {
        alle: products.length,
        safteri: products.filter((p) => String(p?.brand ?? "") === "safteri").length,
        bryggeri: products.filter((p) => String(p?.brand ?? "") === "bryggeri").length,
    };

    async function handleAddProduct() {
        if (creating) return;

        setCreating(true);
        setError(null);

        try {
            const id =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                    ? crypto.randomUUID()
                    : String(Date.now());

            const name = "Nytt produkt";
            const brand: ProductBrand = "safteri";

            await upsertProductMinimal({
                id,
                name,
                brand,
                category: "",
                slug: toSlug(name) || "",
                active: true,
            });
            router.push(`/admin/products/${id}`);
        } catch (err) {
            console.error(err);
            setError("Kunne ikkje opprette nytt produkt.");
        } finally {
            setCreating(false);
        }
    }

    useEffect(() => {
        const unsubscribe = listenToProducts(
            (items) => {
                setProducts(items);
                setLoading(false);
            },
            (err) => {
                console.error(err);
                setError("Kunne ikkje laste produkt.");
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    return (
        <main className="min-h-screen bg-[color:var(--paper)] text-neutral-900">
            <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">

                {/* Header */}
                <header className="flex flex-col gap-3 border-b border-[color:var(--line)] pb-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-neutral-600">
                            Admin
                        </p>
                        <h1
                            className="mt-2 text-3xl tracking-tight md:text-4xl"
                            style={{ fontFamily: "var(--font-serif)" }}
                        >
                            Produkter
                        </h1>
                        <p className="mt-2 max-w-prose text-xs text-neutral-600">
                            Administrer produktbiblioteket – prisar, SKU, kategoriar, storleikar og bilete.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={handleAddProduct}
                            disabled={creating}
                            className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-xs text-[color:var(--paper)] hover:bg-neutral-800 disabled:opacity-60"
                        >
                            {creating ? "Opprettar …" : "Legg til produkt"}
                        </button>

                        <Link
                            href="/admin"
                            className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] px-4 py-1.5 text-xs text-neutral-700 hover:bg-black/5"
                        >
                            ← Tilbake til admin
                        </Link>
                    </div>
                </header>

                <section className="mt-8">
                    <div className="rounded-[18px] border border-[color:var(--line)] bg-white/70 p-6">
                        <div className="flex flex-col gap-3 border-b border-[color:var(--line)] pb-5 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center">
                                <div className="w-full md:w-[340px]">
                                    <label className="sr-only" htmlFor="productSearch">Søk</label>
                                    <input
                                        id="productSearch"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Søk etter namn, kategori, SKU eller slug …"
                                        className="w-full rounded-[12px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                    />
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {([
                                        { key: "alle" as const, label: `Alle (${counts.alle})` },
                                        { key: "safteri" as const, label: `Safteri (${counts.safteri})` },
                                        { key: "bryggeri" as const, label: `Bryggeri (${counts.bryggeri})` },
                                    ] as const).map((b) => (
                                        <button
                                            key={b.key}
                                            type="button"
                                            onClick={() => setBrandFilter(b.key)}
                                            className={`rounded-full border px-3 py-1.5 text-[11px] transition-colors ${brandFilter === b.key
                                                ? "border-neutral-900 bg-neutral-900 text-[color:var(--paper)]"
                                                : "border-[color:var(--line)] bg-white text-neutral-700 hover:bg-black/5"
                                                }`}
                                        >
                                            {b.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <p className="text-[11px] text-neutral-500">
                                Viser {filteredProducts.length} av {products.length}
                            </p>
                        </div>
                        {loading && (
                            <p className="text-sm text-neutral-600">Lastar produkt …</p>
                        )}

                        {error && (
                            <p className="text-sm text-red-600">{error}</p>
                        )}

                        {!loading && !error && filteredProducts.length === 0 && (
                            <p className="text-sm text-neutral-600">
                                Ingen produkt funne. Prøv å endre søket eller filteret.
                            </p>
                        )}

                        {!loading && !error && filteredProducts.length > 0 && (
                            <ul className="divide-y divide-[color:var(--line)]">
                                {filteredProducts.map((product) => (
                                    <li
                                        key={product.id}
                                        className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="relative h-12 w-12 overflow-hidden rounded-[14px] border border-[color:var(--line)] bg-white">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                {typeof product?.thumbnailUrl === "string" && product.thumbnailUrl.trim() ? (
                                                    <img
                                                        src={product.thumbnailUrl}
                                                        alt={product?.name ?? "Produkt"}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-[11px] font-medium text-neutral-500">
                                                        {String(product?.name ?? "P").slice(0, 1).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <p className="text-sm font-medium text-neutral-900">
                                                    {product.name}
                                                </p>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
                                                    <span>
                                                        {product.category ? product.category : "Utan kategori"}
                                                    </span>
                                                    <span className="text-neutral-300">•</span>
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${product.brand === "bryggeri"
                                                            ? "bg-amber-100 text-amber-800"
                                                            : "bg-rose-100 text-rose-800"
                                                            }`}
                                                    >
                                                        {product.brand === "bryggeri" ? "Bryggeri" : "Safteri"}
                                                    </span>
                                                    <span className="text-neutral-300">•</span>
                                                    <span className={product.active ? "text-emerald-700" : "text-neutral-500"}>
                                                        {product.active ? "Aktiv" : "Inaktiv"}
                                                    </span>
                                                    {typeof product?.price === "number" && !Number.isNaN(product.price) && (
                                                        <>
                                                            <span className="text-neutral-300">•</span>
                                                            <span className="text-neutral-700">
                                                                {new Intl.NumberFormat("nb-NO", {
                                                                    style: "currency",
                                                                    currency: "NOK",
                                                                    maximumFractionDigits: 0,
                                                                }).format(product.price)}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-2">
                                            <Link
                                                href={`/admin/products/${product.id}`}
                                                className="rounded-full border border-[color:var(--line)] px-3 py-1.5 text-xs text-neutral-700 hover:bg-black/5"
                                            >
                                                Rediger →
                                            </Link>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}