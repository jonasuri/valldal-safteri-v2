import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import { fetchProductBySlugOrIdForBrand } from "@/lib/productsPublic";

type PageProps = {
    params: { slug: string } | Promise<{ slug: string }>;
    searchParams?: { variant?: string } | Promise<{ variant?: string }>;
};

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

function clampProfileValue(value: unknown) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return 0;
    return Math.max(0, Math.min(10, Math.round(numberValue)));
}

function ProfileBar({ label, value }: { label: string; value: number }) {
    const safeValue = clampProfileValue(value);

    return (
        <div>
            <div className="mb-1 flex items-center justify-between gap-4 text-xs text-neutral-600">
                <span>{label}</span>
                <span>{safeValue}/10</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                <div
                    className="h-full rounded-full bg-[color:var(--accent)]"
                    style={{ width: `${safeValue * 10}%` }}
                />
            </div>
        </div>
    );
}

export default async function BryggeriProductDetailPage({ params, searchParams }: PageProps) {
    const slugify = (value: unknown) => {
        const s = String(value ?? "")
            .trim()
            .toLowerCase()
            // Norwegian-friendly replacements
            .replace(/æ/g, "ae")
            .replace(/ø/g, "o")
            .replace(/å/g, "a")
            // remove accents/diacritics
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            // non-alphanumeric to hyphen
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
        return s;
    };

    const pr: any = await (params as any);
    const wanted = slugify(pr?.slug);

    const sp: any = searchParams ? await (searchParams as any) : undefined;
    const selectedVariantId = String(sp?.variant ?? "");

    if (!wanted) {
        return (
            <main className="min-h-screen text-neutral-900">
                <section className="mx-auto max-w-3xl px-4 py-12 md:py-16">
                    <Link
                        href="/bryggeri/products"
                        className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-neutral-600 hover:text-neutral-900"
                    >
                        <span aria-hidden="true">←</span>
                        Tilbake til produkt
                    </Link>
                    <h1
                        className="mt-6 text-3xl tracking-tight md:text-4xl"
                        style={{ fontFamily: "var(--font-serif)" }}
                    >
                        Produktet finst ikkje
                    </h1>
                    <p className="mt-3 text-sm leading-7 text-neutral-600">
                        Lenka du opna peikar ikkje på eit produkt. Gå tilbake og prøv igjen.
                    </p>
                </section>
            </main>
        );
    }

    const product = await fetchProductBySlugOrIdForBrand(wanted, "bryggeri");

    if (!product) {
        return (
            <main className="min-h-screen text-neutral-900">
                <section className="mx-auto max-w-3xl px-4 py-12 md:py-16">
                    <Link
                        href="/bryggeri/products"
                        className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-neutral-600 hover:text-neutral-900"
                    >
                        <span aria-hidden="true">←</span>
                        Tilbake til produkt
                    </Link>
                    <h1
                        className="mt-6 text-3xl tracking-tight md:text-4xl"
                        style={{ fontFamily: "var(--font-serif)" }}
                    >
                        Produktet finst ikkje
                    </h1>
                    <p className="mt-3 text-sm leading-7 text-neutral-600">
                        Lenka du opna peikar ikkje på eit produkt. Gå tilbake og prøv igjen.
                    </p>
                </section>
            </main>
        );
    }

    const hero = product.imageUrl || product.thumbnailUrl || product.image
        ? {
            src: product.imageUrl || product.thumbnailUrl || product.image || "/placeholder.jpg",
            alt: product.name,
        }
        : undefined;

    const activeVariants = sortVariantsBySize((product.variants ?? []).filter((v: any) => v.active !== false));
    const defaultVariant =
        activeVariants.find((v: any) => String(v.id) === String((product as any).defaultVariantId)) ??
        activeVariants[0];
    const selectedVariant =
        activeVariants.find((v: any) => String(v.id) === selectedVariantId) ??
        defaultVariant;
    const selectedVariantIdResolved = selectedVariant ? String(selectedVariant.id) : "";

    const selectedImage = selectedVariant?.imageUrl || selectedVariant?.image
        ? {
            src: selectedVariant.imageUrl || selectedVariant.image || hero?.src || "/placeholder.jpg",
            alt: `${product.name} – ${getVariantLabel(selectedVariant)}`,
        }
        : hero;

    const category = String(product.category || "").toLowerCase();
    const isBeer = category.includes("øl") || category.includes("ol") || category.includes("beer");
    const rawAlcoholPercent =
        (selectedVariant as any)?.alcoholPercent ??
        (product as any).alcoholPercent ??
        (product as any).abv ??
        (product as any).alcohol?.abv ??
        (product as any).alcohol;
    const formattedAlcoholPercent = formatAlcoholPercent(rawAlcoholPercent);
    const badgeText = (product as any).badgeText?.trim?.() || "";
    const tasteProfile = (product as any).tasteProfile || {};
    const freshness = clampProfileValue(tasteProfile.freshness);
    const bitterness = clampProfileValue(tasteProfile.bitterness);
    const body = clampProfileValue(tasteProfile.body);
    const hasTasteProfile = freshness > 0 || bitterness > 0 || body > 0;

    return (
        <main
            className="min-h-screen text-neutral-900"
            style={
                {
                    // Bryggeri accent wash (amber / malt)
                    "--accentSurface": "rgba(176, 122, 42, 0.06)",
                    "--accentSoft": "rgba(176, 122, 42, 0.12)",
                    "--accent": "rgba(176, 122, 42, 0.72)",
                } as CSSProperties
            }
        >
            <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
                <Link
                    href="/bryggeri/products"
                    className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-neutral-600 hover:text-neutral-900"
                >
                    <span aria-hidden="true">←</span>
                    Tilbake til produkt
                </Link>

                <div className="mt-8 grid gap-10 md:grid-cols-12 md:items-start">
                    {/* Text */}
                    <div className="order-2 md:order-1 md:col-span-5 lg:col-span-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-neutral-600">
                            {isBeer ? "Valldøla" : "Bryggeri"}
                        </p>

                        <h1
                            className="mt-3 text-4xl tracking-tight md:text-5xl"
                            style={{ fontFamily: "var(--font-serif)" }}
                        >
                            {product.name}
                        </h1>

                        {product.shortDesc && (
                            <p className="mt-4 text-sm leading-7 text-neutral-600">{product.shortDesc}</p>
                        )}

                        {formattedAlcoholPercent ? (
                            <p className="mt-4 text-xs tracking-[0.18em] uppercase text-neutral-600">
                                {formattedAlcoholPercent} alc. · 18+
                            </p>
                        ) : null}

                        {/* Variants */}
                        {activeVariants.length ? (
                            <div className="mt-6">
                                <p className="text-xs tracking-[0.18em] uppercase text-neutral-600">Storleikar</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {activeVariants.map((v) => {
                                        const isActive = String(v.id) === selectedVariantIdResolved;

                                        return (
                                            <Link
                                                key={v.id}
                                                href={`/bryggeri/products/${product.slug}?variant=${encodeURIComponent(String(v.id))}`}
                                                className={
                                                    "rounded-full border px-3 py-1 text-xs backdrop-blur transition " +
                                                    (isActive
                                                        ? "border-[color:var(--accentSoft)] bg-[color:var(--accentSoft)] text-neutral-900"
                                                        : "border-black/10 bg-white/70 text-neutral-600 hover:bg-white/85")
                                                }
                                                aria-label={`Vel ${getVariantLabel(v)}`}
                                            >
                                                {formatVariantLabel(v)}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}

                        {hasTasteProfile ? (
                            <div className="mt-8 rounded-[18px] border border-black/10 bg-white/60 p-4">
                                <p className="text-xs tracking-[0.18em] uppercase text-neutral-600">
                                    Smaksprofil
                                </p>
                                <div className="mt-4 space-y-3">
                                    {freshness > 0 ? <ProfileBar label="Friskheit" value={freshness} /> : null}
                                    {bitterness > 0 ? <ProfileBar label="Bitterheit" value={bitterness} /> : null}
                                    {body > 0 ? <ProfileBar label="Fylde" value={body} /> : null}
                                </div>
                            </div>
                        ) : null}

                        {/* Long description */}
                        {product.longDesc && (
                            <p className="mt-8 text-sm leading-7 text-neutral-600">{product.longDesc}</p>
                        )}

                        {/* Details / accordions */}
                        <div className="mt-8 space-y-4">
                            {product.ingredients && (
                                <details className="group rounded-[18px] border border-black/10 bg-white/60 p-4">
                                    <summary className="cursor-pointer list-none text-sm font-medium text-neutral-800 flex items-center justify-between">
                                        Ingrediensar
                                        <span className="transition group-open:rotate-180">⌄</span>
                                    </summary>
                                    <p className="mt-3 text-sm leading-7 text-neutral-600">{product.ingredients}</p>
                                </details>
                            )}

                            <details className="group rounded-[18px] border border-black/10 bg-white/60 p-4">
                                <summary className="cursor-pointer list-none text-sm font-medium text-neutral-800 flex items-center justify-between">
                                    Allergiar
                                    <span className="transition group-open:rotate-180">⌄</span>
                                </summary>
                                <p className="mt-3 text-sm leading-7 text-neutral-600">
                                    {product.allergens && product.allergens.length > 0
                                        ? product.allergens
                                        : "Ingen kjende allergen."}
                                </p>
                            </details>

                            {product.nutrition && (
                                <details className="group rounded-[18px] border border-black/10 bg-white/60 p-4">
                                    <summary className="cursor-pointer list-none text-sm font-medium text-neutral-800 flex items-center justify-between">
                                        Næringsinnhald (per 100 ml)
                                        <span className="transition group-open:rotate-180">⌄</span>
                                    </summary>
                                    <div className="mt-4 overflow-x-auto">
                                        <table className="w-full text-sm text-neutral-600">
                                            <tbody className="divide-y">
                                                <tr>
                                                    <td>Energi</td>
                                                    <td className="text-right">
                                                        {product.nutrition.energyKj} kJ / {product.nutrition.energyKcal} kcal
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Feitt</td>
                                                    <td className="text-right">{product.nutrition.fat} g</td>
                                                </tr>
                                                <tr>
                                                    <td>– metta feittsyrer</td>
                                                    <td className="text-right">{product.nutrition.saturatedFat} g</td>
                                                </tr>
                                                <tr>
                                                    <td>Karbohydrat</td>
                                                    <td className="text-right">{product.nutrition.carbs} g</td>
                                                </tr>
                                                <tr>
                                                    <td>– sukkerartar</td>
                                                    <td className="text-right">{product.nutrition.sugars} g</td>
                                                </tr>
                                                <tr>
                                                    <td>Protein</td>
                                                    <td className="text-right">{product.nutrition.protein} g</td>
                                                </tr>
                                                <tr>
                                                    <td>Salt</td>
                                                    <td className="text-right">{product.nutrition.salt} g</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </details>
                            )}
                        </div>
                    </div>

                    {/* Image */}
                    <div className="order-1 md:order-2 md:col-span-7 lg:col-span-8">
                        <div className="mx-auto max-w-[620px] rounded-[28px] bg-[color:var(--accentSurface)] p-4 ring-1 ring-black/10">
                            <div className="relative aspect-square overflow-hidden rounded-[22px] bg-neutral-100 p-6 md:p-8">
                                {badgeText ? (
                                    <div className="absolute left-4 top-4 z-10 rounded-full border border-[color:var(--accentSoft)] bg-[color:var(--accentSoft)] px-3 py-1 text-xs font-semibold tracking-[0.08em] text-neutral-800">
                                        {badgeText}
                                    </div>
                                ) : null}
                                <Image
                                    src={selectedImage?.src || "/placeholder.jpg"}
                                    alt={selectedImage?.alt || product.name}
                                    fill
                                    className="object-contain"
                                    sizes="(min-width: 1024px) 620px, (min-width: 768px) 58vw, 100vw"
                                    priority
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 h-px w-full bg-[color:var(--line)]" />
            </section>
        </main>
    );
}
