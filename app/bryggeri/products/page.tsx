import Link from "next/link";
import Image from "next/image";
import { products } from "@/lib/products";
import type { CSSProperties } from "react";

type PageProps = {
    searchParams?: { category?: string } | Promise<{ category?: string }>;
};

export default async function BryggeriProductsPage({ searchParams }: PageProps) {
    const bryggeriProducts = products.filter((p) => p.brand === "Bryggeri");

    // In Next.js App Router (especially newer versions), `searchParams` may be a Promise.
    // `await` works for both Promises and plain objects.
    const sp: any = await (searchParams as any);
    const selectedCategoryRaw = ((sp?.category as string) || "").toLowerCase().trim();

    // Normalize to supported filters
    const selectedCategory =
        selectedCategoryRaw.includes("sider") || selectedCategoryRaw.includes("cider")
            ? "sider"
            : selectedCategoryRaw.includes("øl") || selectedCategoryRaw.includes("ol") || selectedCategoryRaw.includes("beer")
                ? "ol"
                : "";

    const showAll = !selectedCategory;

    const ol = bryggeriProducts.filter((p) => p.category === "Bryggeri - Øl");
    const sider = bryggeriProducts.filter((p) => p.category === "Bryggeri - Sider");

    return (
        <main
            className="min-h-screen text-neutral-900"
            style={
                {
                    // Bryggeri accent wash (amber / malt)
                    "--accentSurface": "rgba(176, 122, 42, 0.06)",
                    "--accentSoft": "rgba(176, 122, 42, 0.10)",
                } as CSSProperties
            }
        >
            <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
                <Link
                    href="/bryggeri"
                    className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-neutral-600 hover:text-neutral-900"
                >
                    <span aria-hidden="true">←</span>
                    Tilbake til Bryggeriet
                </Link>
                <h1
                    className="text-4xl tracking-tight md:text-5xl"
                    style={{ fontFamily: "var(--font-serif)" }}
                >
                    Produkt frå Bryggeriet
                </h1>

                <div className="mt-6 flex flex-wrap gap-2 text-sm">
                    <Link
                        href="/bryggeri/products"
                        className={`rounded-full border border-[color:var(--line)] px-4 py-1.5 transition ${showAll ? "bg-[color:var(--accentSoft)]" : "hover:bg-black/[0.03]"}`}
                    >
                        Alle
                    </Link>
                    <Link
                        href="/bryggeri/products?category=ol"
                        className={`rounded-full border border-[color:var(--line)] px-4 py-1.5 transition ${selectedCategory === "ol" ? "bg-[color:var(--accentSoft)]" : "hover:bg-black/[0.03]"}`}
                    >
                        Øl
                    </Link>
                    <Link
                        href="/bryggeri/products?category=sider"
                        className={`rounded-full border border-[color:var(--line)] px-4 py-1.5 transition ${selectedCategory === "sider" ? "bg-[color:var(--accentSoft)]" : "hover:bg-black/[0.03]"}`}
                    >
                        Sider
                    </Link>
                </div>

                {!showAll && (
                    <p className="mt-3 text-xs tracking-[0.18em] uppercase text-neutral-600">
                        Viser: {selectedCategory === "ol" ? "øl" : "sider"}
                    </p>
                )}
            </section>

            {(showAll || selectedCategory === "ol") && (
                <section className="mx-auto max-w-6xl px-4 pb-12">
                    <h2
                        className="text-2xl tracking-tight md:text-3xl"
                        style={{ fontFamily: "var(--font-serif)" }}
                    >
                        Øl
                    </h2>
                    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {ol.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </section>
            )}

            {(showAll || selectedCategory === "sider") && (
                <section className="mx-auto max-w-6xl px-4 pb-12">
                    <h2
                        className="text-2xl tracking-tight md:text-3xl"
                        style={{ fontFamily: "var(--font-serif)" }}
                    >
                        Sider
                    </h2>
                    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {sider.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </section>
            )}
        </main>
    );
}

function ProductCard({ product }: { product: any }) {
    return (
        <Link
            href={`/bryggeri/products/${product.slug}`}
            className="group block rounded-[24px] bg-[color:var(--accentSurface)] p-6 ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(0,0,0,0.06)] hover:bg-[color:var(--accentSoft)]"
            aria-label={`Opne ${product.name}`}
        >
            <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] bg-neutral-100">
                <Image
                    src={product.images[0]?.src || "/placeholder.jpg"}
                    alt={product.images[0]?.alt || product.name}
                    fill
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
            </div>

            <h3 className="mt-4 text-xl font-medium text-neutral-900">{product.name}</h3>
            <p className="mt-1 text-sm text-neutral-600">{product.shortDesc}</p>

            <div className="mt-3 flex flex-wrap gap-2">
                {product.variants.map((v: any) => (
                    <span
                        key={v.id}
                        className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs text-neutral-600 backdrop-blur"
                    >
                        {v.label}
                    </span>
                ))}
            </div>
        </Link>
    );
}