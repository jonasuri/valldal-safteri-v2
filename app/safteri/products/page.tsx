import Image from "next/image";
import { fetchProductsForBrand } from "@/lib/productsPublic";
import type { CSSProperties } from "react";
import Link from "next/link";
import { ContactDisplay } from "../../components/ContactDisplay";
import { siteContent } from "@/lib/siteContent";

function normalizeDbCategory(value: unknown): "saft" | "sylte" | "gele" | "saus" | "frisk" | "rein" | "" {
    if (typeof value !== "string") return "";
    const v = value.trim().toLowerCase();

    // handle accents and common variants
    const plain = v
        .replaceAll("é", "e")
        .replaceAll("è", "e")
        .replaceAll("ê", "e")
        .replaceAll("á", "a")
        .replaceAll("à", "a")
        .replaceAll("å", "a")
        .replaceAll("ø", "o")
        .replaceAll("æ", "ae");

    if (plain.includes("saft")) return "saft";
    if (plain.includes("frisk")) return "frisk";
    if (plain.includes("rein")) return "rein";
    if (plain.includes("sylte")) return "sylte";
    if (plain.includes("gele")) return "gele";
    if (plain.includes("saus")) return "saus";
    return "";
}

function ProductCard({ product }: { product: any }) {
    return (
        <Link
            href={`/safteri/products/${product.slug}`}
            className="group block cursor-pointer rounded-[24px] bg-[color:var(--accentSurface)] p-6 ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(0,0,0,0.06)] hover:bg-[color:var(--accentSoft)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/20"
            aria-label={product.name}
        >
            <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] bg-neutral-100">
                <Image
                    src={product.thumbnailUrl || "/placeholder.jpg"}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
            </div>
            <h3 className="mt-4 text-xl font-medium text-neutral-900">{product.name}</h3>
            <p className="mt-1 text-sm text-neutral-600">{product.shortDesc}</p>
            <div className="mt-3 flex flex-wrap gap-2">
                {(product.variants || [])
                    .filter((v: any) => v?.active !== false)
                    .map((v: any) => (
                        <span
                            key={v.id}
                            className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs text-neutral-600 backdrop-blur"
                        >
                            {v.size}
                        </span>
                    ))}
            </div>
        </Link>
    );
}

function CategoryBlock({ title, items }: { title: string; items: any[] }) {
    if (!items.length) return null;
    return (
        <div>
            <h3 className="text-xl tracking-tight text-neutral-900" style={{ fontFamily: "var(--font-serif)" }}>
                {title}
            </h3>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(product => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>
        </div>
    );
}

type PageProps = {
    searchParams?: { category?: string } | Promise<{ category?: string }>;
};

export default async function SafteriProductsPage({ searchParams }: PageProps) {
    const safteriProducts = await fetchProductsForBrand("safteri");

    const products = (safteriProducts || []).map((p: any) => {
        const cat = normalizeDbCategory(p?.category);
        return { ...p, _cat: cat };
    });

    // In Next.js App Router (especially newer versions), `searchParams` may be a Promise.
    // `await` works for both Promises and plain objects.
    const sp: any = await (searchParams as any);
    const selectedCategoryRaw = ((sp?.category as string) || "").toLowerCase().trim();

    // Normalize to our four supported filters
    const selectedCategory =
        selectedCategoryRaw.includes("saft")
            ? "saft"
            : selectedCategoryRaw.includes("frisk")
                ? "frisk"
                : selectedCategoryRaw.includes("rein")
                    ? "rein"
                    : selectedCategoryRaw.includes("sylte") || selectedCategoryRaw.includes("gele") || selectedCategoryRaw.includes("gelé") || selectedCategoryRaw.includes("saus")
                        ? "sylte"
                        : "";

    const showAll = !selectedCategory;

    const saft = products.filter((p) => p._cat === "saft");
    const frisk = products.filter((p) => p._cat === "frisk");
    const rein = products.filter((p) => p._cat === "rein");

    const sylte = products.filter((p) => p._cat === "sylte");
    const gele = products.filter((p) => p._cat === "gele");
    const saus = products.filter((p) => p._cat === "saus");

    return (
        <main
            className="min-h-screen text-neutral-900"
            style={
                {
                    // Safteri accent wash (subtle berry)
                    "--accentSurface": "rgba(178, 74, 155, 0.06)",
                    "--accentSoft": "rgba(178, 74, 155, 0.10)",
                } as CSSProperties
            }
        >
            <header className="sticky top-0 z-10 border-b border-[color:var(--line)] bg-[color:var(--paper)]/85 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                    <Link href="/" className="flex items-center">
                        <Image
                            src="/logoDark.png"
                            alt="Valldal"
                            width={120}
                            height={32}
                            priority
                            className="h-6 w-auto"
                        />
                    </Link>

                    <nav className="flex items-center gap-4 text-sm text-neutral-700">
                        <Link className="hover:text-neutral-900" href="/">
                            Heim
                        </Link>
                        <Link className="font-medium text-neutral-900" href="/safteri">
                            Safteri
                        </Link>
                        <Link className="hover:text-neutral-900" href="/bryggeri">
                            Bryggeri <span className="ml-1 text-xs opacity-70">18+</span>
                        </Link>
                    </nav>
                </div>
            </header>
            <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
                <Link
                    href="/safteri"
                    className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-neutral-600 hover:text-neutral-900"
                >
                    <span aria-hidden="true">←</span>
                    Tilbake til Safteriet
                </Link>
                <h1
                    className="text-4xl tracking-tight md:text-5xl"
                    style={{ fontFamily: "var(--font-serif)" }}
                >
                    Produkter frå Safteriet
                </h1>
                <div className="mt-6 flex flex-wrap gap-2 text-sm">
                    <a
                        href="/safteri/products"
                        className={`rounded-full border border-[color:var(--line)] px-4 py-1.5 transition ${showAll ? "bg-[color:var(--accentSoft)]" : "hover:bg-black/[0.03]"}`}
                    >
                        Alle
                    </a>
                    <a
                        href="/safteri/products?category=saft"
                        className={`rounded-full border border-[color:var(--line)] px-4 py-1.5 transition ${selectedCategory === "saft" ? "bg-[color:var(--accentSoft)]" : "hover:bg-black/[0.03]"}`}
                    >
                        Saft
                    </a>
                    <a
                        href="/safteri/products?category=sylte"
                        className={`rounded-full border border-[color:var(--line)] px-4 py-1.5 transition ${selectedCategory === "sylte" ? "bg-[color:var(--accentSoft)]" : "hover:bg-black/[0.03]"}`}
                    >
                        Sylte og gelé
                    </a>
                    <a
                        href="/safteri/products?category=frisk"
                        className={`rounded-full border border-[color:var(--line)] px-4 py-1.5 transition ${selectedCategory === "frisk" ? "bg-[color:var(--accentSoft)]" : "hover:bg-black/[0.03]"}`}
                    >
                        Frisk
                    </a>
                    <a
                        href="/safteri/products?category=rein"
                        className={`rounded-full border border-[color:var(--line)] px-4 py-1.5 transition ${selectedCategory === "rein" ? "bg-[color:var(--accentSoft)]" : "hover:bg-black/[0.03]"}`}
                    >
                        Rein
                    </a>
                </div>

                {!showAll && (
                    <p className="mt-3 text-xs tracking-[0.18em] uppercase text-neutral-600">
                        Viser: {selectedCategory === "sylte" ? "Sylte og gelé" : selectedCategory}
                    </p>
                )}
            </section>

            {(showAll || selectedCategory === "saft") && (
                <section className="mx-auto max-w-6xl px-4 pb-12">
                    <h2 className="text-2xl tracking-tight md:text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
                        Saft
                    </h2>
                    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {saft.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </section>
            )}

            {(showAll || selectedCategory === "sylte") && (
                <section className="mx-auto max-w-6xl px-4 pb-12">
                    <h2 className="text-2xl tracking-tight md:text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
                        Sylte og gelé
                    </h2>

                    <div className="mt-6 space-y-12">
                        <CategoryBlock title="Sylte" items={sylte} />
                        <CategoryBlock title="Gele" items={gele} />
                        <CategoryBlock title="Saus" items={saus} />
                    </div>
                </section>
            )}

            {(showAll || selectedCategory === "frisk") && (
                <section className="mx-auto max-w-6xl px-4 pb-12">
                    <h2 className="text-2xl tracking-tight md:text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
                        Frisk
                    </h2>
                    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {frisk.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </section>
            )}

            {(showAll || selectedCategory === "rein") && (
                <section className="mx-auto max-w-6xl px-4 pb-12">
                    <h2 className="text-2xl tracking-tight md:text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
                        Rein
                    </h2>
                    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {rein.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </section>
            )}
            <footer id="kontakt" className="border-t border-[color:var(--line)]">
                <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-neutral-600">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <p>© {new Date().getFullYear()} Valldal</p>
                        <ContactDisplay fallbackContact={siteContent.contact} variant="inline" />
                    </div>
                </div>
            </footer>
        </main>
    );
}