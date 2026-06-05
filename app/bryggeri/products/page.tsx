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

function clampTasteValue(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(10, Math.round(n)));
}

function TasteMiniBar({ label, value }: { label: string; value: number }) {
    const safeValue = clampTasteValue(value);

    return (
        <div className="flex items-center gap-1.5">
            <span className="w-4 text-[9px] font-medium text-neutral-700">{label}</span>
            <div className="flex gap-[2px]">
                {Array.from({ length: 10 }).map((_, index) => (
                    <span
                        key={index}
                        className="h-[2px] w-[5px] rounded-full"
                        style={{
                            backgroundColor:
                                index < safeValue
                                    ? 'rgba(176, 122, 42, 0.75)'
                                    : 'rgba(0,0,0,0.12)',
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

function getVariantLabel(variant: any) {
    return String(variant?.size ?? variant?.label ?? "").trim();
}

function getVariantSortValue(variant: any) {
    const label = getVariantLabel(variant).toLowerCase().replace(",", ".");
    const match = label.match(/([0-9]+(?:\.[0-9]+)?)\s*(ml|l|g|kg)/i);

    if (!match) return Number.MAX_SAFE_INTEGER;

    const value = Number(match[1]);
    const unit = match[2].toLowerCase();

    if (!Number.isFinite(value)) return Number.MAX_SAFE_INTEGER;

    if (unit === "l") return value * 1000;
    if (unit === "ml") return value;
    if (unit === "kg") return value * 1000;
    if (unit === "g") return value;

    return Number.MAX_SAFE_INTEGER;
}

function sortVariantsBySize(variants: any[] = []) {
    return [...variants].sort((a, b) => {
        const sizeCompare = getVariantSortValue(a) - getVariantSortValue(b);
        if (sizeCompare !== 0) return sizeCompare;
        return getVariantLabel(a).localeCompare(getVariantLabel(b), "nb");
    });
}

function getDisplayVariants(product: any) {
    return sortVariantsBySize((product.variants || []).filter((v: any) => v?.active !== false));
}

function getProductCardImage(product: any) {
    const activeVariants = sortVariantsBySize((product.variants || []).filter((v: any) => v?.active !== false));
    const defaultVariant = activeVariants.find((v: any) => String(v.id) === String(product.defaultVariantId));

    return defaultVariant?.imageUrl || product.imageUrl || product.thumbnailUrl || product.image || product.images?.[0]?.src || "/placeholder.jpg";
}

function ProductCard({ product }: { product: any }) {
    const image = getProductCardImage(product);
    const badgeText = String(product.badgeText || "").trim();
    const imageAlt = product.images?.[0]?.alt || product.name;
    const shortDescription = product.shortDesc || product.shortDescription || product.description;
    const variants = getDisplayVariants(product);
    const isBeer = isBeerProduct(product);
    const alcoholPercent = formatAlcoholPercent(
        product.alcoholPercent ?? product.abv ?? product.alcohol
    );
    const tasteProfile = product.tasteProfile || {};
    const freshness = clampTasteValue(tasteProfile.freshness);
    const bitterness = clampTasteValue(tasteProfile.bitterness);
    const body = clampTasteValue(tasteProfile.body);
    const hasTasteProfile = freshness > 0 || bitterness > 0 || body > 0;

    return (
        <Link
            href={`/bryggeri/products/${product.slug}`}
            className="group block rounded-[24px] bg-[color:var(--accentSurface)] p-6 ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(0,0,0,0.06)] hover:bg-[color:var(--accentSoft)]"
            aria-label={`Opne ${product.name}`}
        >
            <div className="relative aspect-square overflow-hidden rounded-[16px] bg-neutral-100 p-4">
                {badgeText ? (
                    <div className="absolute left-3 top-3 z-10 rounded-full border border-[color:var(--accentSoft)] bg-[color:var(--paper)] px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-neutral-800">
                        {badgeText}
                    </div>
                ) : null}
                {hasTasteProfile ? (
                    <div className="absolute bottom-3 right-3 z-10 space-y-1">
                        {freshness > 0 ? <TasteMiniBar label="F" value={freshness} /> : null}
                        {bitterness > 0 ? <TasteMiniBar label="B" value={bitterness} /> : null}
                        {body > 0 ? <TasteMiniBar label="Fy" value={body} /> : null}
                    </div>
                ) : null}
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