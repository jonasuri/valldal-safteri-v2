

export type SyncVariant = {
    sku: string;
    name: string;
    barcode?: string;
    retailPrice: number;
};

export type SyncProduct = {
    name: string;
    category: string;
    posFolder: string;
    variants: SyncVariant[];
};

export type SyncValidationResult = {
    valid: boolean;
    warnings: string[];
    errors: string[];
};

export type ZettleVariantPayload = {
    name: string;
    sku: string;
    barcode?: string;
    price: {
        amount: number;
        currencyId: "NOK";
    };
    options?: Array<{
        name: "Størrelse";
        value: string;
    }>;
};

export type ZettleProductPayload = {
    name: string;
    category: {
        name: string;
    };
    variants: ZettleVariantPayload[];
    variantOptionDefinitions?: {
        definitions: Array<{
            name: "Størrelse";
            properties: Array<{
                value: string;
            }>;
        }>;
    };
};

const CATEGORY_MAP: Record<string, { zettleCategory: string; posFolder: string }> = {
    Sylte: { zettleCategory: "Sylte", posFolder: "SYLTE" },
    "Gelè": { zettleCategory: "Gelè", posFolder: "GELÈ" },
    Gele: { zettleCategory: "Gelè", posFolder: "GELÈ" },
    Saft: { zettleCategory: "Saft", posFolder: "SAFT" },
    Saus: { zettleCategory: "Saus", posFolder: "SAUS" },
    Frisk: { zettleCategory: "Frisk", posFolder: "FRISK" },
    Rein: { zettleCategory: "Rein", posFolder: "REIN" },
    Is: { zettleCategory: "Is", posFolder: "IS" },
    Øl: { zettleCategory: "Øl", posFolder: "BRYGGERI" },
    Sider: { zettleCategory: "Sider", posFolder: "BRYGGERI" },
};

export function resolveCategory(category: string) {
    const mapping = CATEGORY_MAP[category];

    if (!mapping) {
        throw new Error(`Unsupported Zettle category: ${category}`);
    }

    return mapping;
}

export function buildSyncProduct(input: {
    name: string;
    category: string;
    variants: SyncVariant[];
}): SyncProduct {
    const mapping = resolveCategory(input.category);

    return {
        name: input.name,
        category: mapping.zettleCategory,
        posFolder: mapping.posFolder,
        variants: [...input.variants].sort((a, b) => a.sku.localeCompare(b.sku)),
    };
}

export function validateSyncProduct(product: SyncProduct): SyncValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!product.name.trim()) {
        errors.push("Produktet manglar namn.");
    }

    if (!product.category.trim()) {
        errors.push("Produktet manglar kategori.");
    }

    if (product.variants.length === 0) {
        errors.push("Produktet har ingen aktive variantar.");
    }

    const hasMultipleVariants = product.variants.length > 1;

    for (const variant of product.variants) {
        if (!variant.sku.trim()) {
            errors.push(`Variant '${variant.name}' manglar SKU.`);
        }

        if (variant.retailPrice <= 0) {
            errors.push(`Variant '${variant.name}' har ugyldig utsalspris.`);
        }

        if (hasMultipleVariants && !variant.name.trim()) {
            errors.push("Ein variant manglar namn.");
        }

        if (!variant.barcode?.trim()) {
            warnings.push(`Variant '${variant.name}' manglar strekkode.`);
        }
    }

    return {
        valid: errors.length === 0,
        warnings,
        errors,
    };
}

function toMinorUnits(value: number) {
    return Math.round(value * 100);
}

export function buildZettleProductPayload(product: SyncProduct): ZettleProductPayload {
    const hasMultipleVariants = product.variants.length > 1;

    return {
        name: product.name,
        category: {
            name: product.category,
        },
        variants: product.variants.map((variant) => ({
            name: hasMultipleVariants ? variant.name : "",
            sku: variant.sku,
            barcode: variant.barcode,
            price: {
                amount: toMinorUnits(variant.retailPrice),
                currencyId: "NOK",
            },
            options: hasMultipleVariants
                ? [
                    {
                        name: "Størrelse",
                        value: variant.name,
                    },
                ]
                : undefined,
        })),
        variantOptionDefinitions: hasMultipleVariants
            ? {
                definitions: [
                    {
                        name: "Størrelse",
                        properties: product.variants.map((variant) => ({
                            value: variant.name,
                        })),
                    },
                ],
            }
            : undefined,
    };
}