import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import { fetchProductBySlugOrIdForBrand } from "@/lib/productsPublic";
import { ContactDisplay } from "../../../components/ContactDisplay";
import { siteContent } from "@/lib/siteContent";

type PageProps = {
    params: { slug: string } | Promise<{ slug: string }>;
    searchParams?: { variant?: string } | Promise<{ variant?: string }>;
};

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

export default async function SafteriProductDetailPage({ params, searchParams }: PageProps) {
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

                <section className="mx-auto max-w-3xl px-4 py-12 md:py-16">
                    <Link
                        href="/safteri/products"
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

    const product = await fetchProductBySlugOrIdForBrand(wanted, "safteri");

    if (!product) {
        return (
            <main className="min-h-screen text-neutral-900">
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

                <section className="mx-auto max-w-3xl px-4 py-12 md:py-16">
                    <Link
                        href="/safteri/products"
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

    const hero = product.thumbnailUrl
        ? { src: product.thumbnailUrl, alt: product.name }
        : null;

    const activeVariants = sortVariantsBySize((product.variants ?? []).filter((v: any) => v.active !== false));
    const defaultVariant =
        activeVariants.find((v: any) => String(v.id) === String((product as any).defaultVariantId)) ??
        activeVariants[0];
    const selectedVariant =
        activeVariants.find((v: any) => String(v.id) === selectedVariantId) ??
        defaultVariant;
    const selectedVariantIdResolved = selectedVariant ? String(selectedVariant.id) : "";
    const dilutionRatio = (product as any).dilutionRatio?.trim?.() || "";
    const badgeText = (product as any).badgeText?.trim?.() || "";

    const selectedImage = selectedVariant?.imageUrl
        ? {
            src: selectedVariant.imageUrl as string,
            alt: `${product.name} – ${getVariantLabel(selectedVariant)}`,
        }
        : hero;

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

            <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
                <Link
                    href="/safteri/products"
                    className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-neutral-600 hover:text-neutral-900"
                >
                    <span aria-hidden="true">←</span>
                    Tilbake til produkt
                </Link>

                <div className="mt-8 grid gap-10 md:grid-cols-12 md:items-start">
                    {/* Text */}
                    <div className="order-2 md:order-1 md:col-span-5 lg:col-span-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-neutral-600">
                            Safteri
                        </p>

                        <h1
                            className="mt-3 text-4xl tracking-tight md:text-5xl"
                            style={{ fontFamily: "var(--font-serif)" }}
                        >
                            {product.name}
                        </h1>

                        {product.shortDescription && (
                            <p className="mt-4 text-sm leading-7 text-neutral-600">
                                {product.shortDescription}
                            </p>
                        )}

                        {activeVariants.length ? (
                            <div className="mt-6">
                                <p className="text-xs tracking-[0.18em] uppercase text-neutral-600">Storleikar</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {activeVariants.map((v: any) => {
                                        const isActive = String(v.id) === selectedVariantIdResolved;

                                        return (
                                            <Link
                                                key={v.id}
                                                href={`/safteri/products/${product.slug}?variant=${encodeURIComponent(String(v.id))}`}
                                                className={
                                                    "rounded-full border px-3 py-1 text-xs backdrop-blur transition " +
                                                    (isActive
                                                        ? "border-[color:var(--accentSoft)] bg-[color:var(--accentSoft)] text-neutral-900"
                                                        : "border-black/10 bg-white/70 text-neutral-600 hover:bg-white/85")
                                                }
                                                aria-label={`Vel ${getVariantLabel(v)}`}
                                            >
                                                {getVariantLabel(v)}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}

                        {dilutionRatio ? (
                            <div className="mt-6 rounded-[18px] border border-black/10 bg-white/60 p-4">
                                <p className="text-xs tracking-[0.18em] uppercase text-neutral-600">
                                    Blandingsforhold
                                </p>
                                <p className="mt-2 text-sm text-neutral-800">
                                    {dilutionRatio}
                                </p>
                            </div>
                        ) : null}

                        {/* Long description */}
                        {product.longDescription && (
                            <p className="mt-8 text-sm leading-7 text-neutral-600">
                                {product.longDescription}
                            </p>
                        )}

                        {/* Details / accordions */}
                        <div className="mt-8 space-y-4">
                            {product.ingredientsText && (
                                <details className="group rounded-[18px] border border-black/10 bg-white/60 p-4">
                                    <summary className="cursor-pointer list-none text-sm font-medium text-neutral-800 flex items-center justify-between">
                                        Ingrediensar
                                        <span className="transition group-open:rotate-180">⌄</span>
                                    </summary>
                                    <p className="mt-3 text-sm leading-7 text-neutral-600">
                                        {product.ingredientsText}
                                    </p>
                                </details>
                            )}

                            <details className="group rounded-[18px] border border-black/10 bg-white/60 p-4">
                                <summary className="cursor-pointer list-none text-sm font-medium text-neutral-800 flex items-center justify-between">
                                    Allergiar
                                    <span className="transition group-open:rotate-180">⌄</span>
                                </summary>
                                <p className="mt-3 text-sm leading-7 text-neutral-600">
                                    {product.allergensText?.trim()
                                        ? product.allergensText
                                        : "Ingen kjende allergen."}
                                </p>
                            </details>

                            {product.nutrition && (
                                <details className="group rounded-[18px] border border-black/10 bg-white/60 p-4">
                                    <summary className="cursor-pointer list-none text-sm font-medium text-neutral-800 flex items-center justify-between">
                                        {dilutionRatio
                                            ? `Næringsinnhald per 100 ml ferdigblanda (${dilutionRatio})`
                                            : "Næringsinnhald (per 100 g / ml)"}
                                        <span className="transition group-open:rotate-180">⌄</span>
                                    </summary>
                                    <div className="mt-4 overflow-x-auto">
                                        <table className="w-full text-sm text-neutral-600">
                                            <tbody className="divide-y">
                                                <tr>
                                                    <td>Energi</td>
                                                    <td className="text-right">
                                                        {product.nutrition?.energyKj ?? "–"} kJ / {product.nutrition?.energyKcal ?? "–"} kcal
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Feitt</td>
                                                    <td className="text-right">{product.nutrition?.fat ?? "–"} g</td>
                                                </tr>
                                                <tr>
                                                    <td>– metta feittsyrer</td>
                                                    <td className="text-right">{product.nutrition?.saturatedFat ?? "–"} g</td>
                                                </tr>
                                                <tr>
                                                    <td>Karbohydrat</td>
                                                    <td className="text-right">{product.nutrition?.carbs ?? "–"} g</td>
                                                </tr>
                                                <tr>
                                                    <td>– sukkerartar</td>
                                                    <td className="text-right">{product.nutrition?.sugars ?? "–"} g</td>
                                                </tr>
                                                <tr>
                                                    <td>Protein</td>
                                                    <td className="text-right">{product.nutrition?.protein ?? "–"} g</td>
                                                </tr>
                                                <tr>
                                                    <td>Salt</td>
                                                    <td className="text-right">{product.nutrition?.salt ?? "–"} g</td>
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
                                    <div className="absolute left-4 top-4 z-10 rounded-full border border-[color:var(--accentSoft)] bg-[color:var(--accentSoft)] px-3 py-1 text-xs font-semibold tracking-[0.08em] text-neutral-800 backdrop-blur">
                                        {badgeText}
                                    </div>
                                ) : null}
                                <Image
                                    src={selectedImage?.src || "/logoDark.png"}
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
