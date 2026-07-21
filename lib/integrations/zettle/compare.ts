

import {
    ValldalVariantForZettle,
    ZettleProduct,
    ZettleProductComparison,
    ZettleProductDifference,
    ZettleVariant,
} from "./types";

function normalize(value?: string) {
    return (value ?? "").trim();
}

export function compareProducts(
    valldalVariants: ValldalVariantForZettle[],
    zettleProducts: ZettleProduct[]
): ZettleProductComparison {
    const differences: ZettleProductDifference[] = [];

    const zettleBySku = new Map<
        string,
        ZettleVariant & { productId: string; productName: string }
    >();

    for (const product of zettleProducts) {
        for (const variant of product.variants) {
            const sku = normalize(variant.sku);
            if (!sku) continue;
            zettleBySku.set(sku, {
                ...variant,
                productId: product.id,
                productName: product.name,
            });
        }
    }

    let matchedCount = 0;
    let missingInZettleCount = 0;
    let missingInValldalCount = 0;
    let inactiveInValldalCount = 0;
    let priceMismatchCount = 0;
    let barcodeMismatchCount = 0;

    const seen = new Set<string>();

    for (const variant of valldalVariants) {
        const sku = normalize(variant.sku);
        if (!sku) continue;

        const zettle = zettleBySku.get(sku);

        // Inaktive produkt er historikk og skal ikkje vere ein del av den
        // operative Zettle-samanlikninga. Vi markerer likevel SKU-en som sett,
        // slik at han ikkje feilaktig blir rapportert som manglande i Valldal.
        if (!variant.productActive) {
            if (zettle) seen.add(sku);
            continue;
        }

        // Ein inaktiv variant kan framleis liggje i Zettle. Det er informasjon,
        // ikkje eit synkroniseringsavvik, og skal aldri gi prisoppdatering.
        if (!variant.variantActive) {
            if (zettle) {
                seen.add(sku);
                inactiveInValldalCount++;
                differences.push({
                    sku,
                    type: "inactive_in_valldal",
                    message: "Varianten er inaktiv i Valldal, men finst framleis i Zettle.",
                    valldal: variant,
                    zettle,
                });
            }
            continue;
        }

        if (!zettle) {
            missingInZettleCount++;
            differences.push({
                sku,
                type: "missing_in_zettle",
                message: "Produktet finst ikkje i Zettle.",
                valldal: variant,
            });
            continue;
        }

        matchedCount++;
        seen.add(sku);

        if (variant.retailPrice !== zettle.retailPrice) {
            priceMismatchCount++;
            differences.push({
                sku,
                type: "price_mismatch",
                message: "Prisane er ulike.",
                valldal: variant,
                zettle,
            });
        }

        if (normalize(variant.barcode) !== normalize(zettle.barcode)) {
            barcodeMismatchCount++;
            differences.push({
                sku,
                type: "barcode_mismatch",
                message: "Strekkoden er ulik.",
                valldal: variant,
                zettle,
            });
        }

    }

    for (const [sku, zettle] of zettleBySku) {
        if (seen.has(sku)) continue;
        missingInValldalCount++;
        differences.push({
            sku,
            type: "missing_in_valldal",
            message: "Produktet finst ikkje i Valldal-systemet.",
            zettle,
        });
    }

    return {
        matchedCount,
        missingInZettleCount,
        missingInValldalCount,
        inactiveInValldalCount,
        priceMismatchCount,
        barcodeMismatchCount,
        differences,
    };
}
