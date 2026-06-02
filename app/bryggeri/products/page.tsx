import Link from "next/link";
import Image from "next/image";
import { fetchProductsForBrand } from "@/lib/productsPublic";
import type { CSSProperties } from "react";

type PageProps = {
    searchParams?: { category?: string } | Promise<{ category?: string }>;
};

export default async function BryggeriProductsPage({ searchParams }: PageProps) {
    const bryggeriProducts = await fetchProductsForBrand("bryggeri");

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

    const ol = bryggeriProducts.filter((p) => {
        const category = String(p.category || "").toLowerCase();
        return category.includes("øl") || category.includes("ol") || category.includes("beer");
    });

    const sider = bryggeriProducts.filter((p) => {
        const category = String(p.category || "").toLowerCase();
        return category.includes("sider") || category.includes("cider");
    });

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

function isBeerProduct(product: any) {
    const category = String(product.category || "").toLowerCase();
    return category.includes("øl") || category.includes("ol") || category.includes("beer");
}

function formatAlcoholPercent(value: unknown) {
    if (value === undefined || value === null) return "";

    const alcoholPercent = String(value).trim();
    if (!alcoholPercent) return "";

    return alcoholPercent.includes("%") ? alcoholPercent : `${alcoholPercent} %`;
}

function formatVariantLabel(variant: any) {
    const alcoholPercent = formatAlcoholPercent(variant?.alcoholPercent);
    return alcoholPercent ? `${variant.label} · ${alcoholPercent}` : variant.label;
}

function ProductCard({ product }: { product: any }) {
    const image = product.imageUrl || product.thumbnailUrl || product.image || product.images?.[0]?.src || "/placeholder.jpg";
    const imageAlt = product.images?.[0]?.alt || product.name;
    const shortDescription = product.shortDesc || product.shortDescription || product.description;
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const isBeer = isBeerProduct(product);
    const alcoholPercent = formatAlcoholPercent(
        product.alcoholPercent ?? product.abv ?? product.alcohol
    );

    return (
        <Link
            href={`/bryggeri/products/${product.slug}`}
            className="group block rounded-[24px] bg-[color:var(--accentSurface)] p-6 ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(0,0,0,0.06)] hover:bg-[color:var(--accentSoft)]"
            aria-label={`Opne ${product.name}`}
        >
            <div className="relative aspect-square overflow-hidden rounded-[16px] bg-neutral-100 p-4">
                <Image
                    src={image}
                    alt={imageAlt}
                    fill
                    className="object-contain transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                />
            </div>

            <div className="mt-4">
                {isBeer ? (
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Valldøla</p>
                ) : null}
                <h3 className="mt-1 text-xl font-medium text-neutral-900">{product.name}</h3>
                {alcoholPercent ? <p className="mt-1 text-sm text-neutral-600">{alcoholPercent}</p> : null}
            </div>
            {shortDescription ? <p className="mt-1 text-sm text-neutral-600">{shortDescription}</p> : null}

            {variants.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                    {variants.map((v: any) => (
                        <span
                            key={v.id}
                            className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs text-neutral-600 backdrop-blur"
                        >
                            {formatVariantLabel(v)}
                        </span>
                    ))}
                </div>
            ) : null}
        </Link>
    );
}