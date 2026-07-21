import { v1 as uuidv1 } from "uuid";
import {
    fetchRawZettleProduct,
    fetchZettleProducts,
    updateZettleProduct,
} from "@/lib/integrations/zettle/products";
import { getSyncProducts } from "@/lib/productsSync";

export type VariantPlacementPreview = {
    valid: boolean;
    warnings: string[];
    errors: string[];
    valldalProduct: {
        id: string;
        name: string;
        category: string;
    };
    zettleProduct?: {
        id: string;
        name: string;
        category?: string;
    };
    matchedBySkus: string[];
    existingVariants: Array<{
        sku: string;
        name: string;
        barcode?: string;
        retailPrice: number;
    }>;
    variantToAdd: {
        sku: string;
        name: string;
        barcode?: string;
        retailPrice?: number;
    };
};

function normalize(value?: string) {
    return (value ?? "").trim();
}

export async function previewVariantPlacement(
    requestedSku: string
): Promise<VariantPlacementPreview> {
    const sku = normalize(requestedSku);
    if (!sku) {
        throw new Error("Manglar SKU.");
    }

    const [valldalProducts, zettleProducts] = await Promise.all([
        getSyncProducts(),
        fetchZettleProducts(),
    ]);

    const valldalProduct = valldalProducts.find((product) =>
        product.variants.some((variant) => normalize(variant.sku) === sku)
    );

    if (!valldalProduct) {
        throw new Error(`Fann ikkje SKU ${sku} i Valldal-systemet.`);
    }

    const targetVariant = valldalProduct.variants.find(
        (variant) => normalize(variant.sku) === sku
    );

    if (!targetVariant) {
        throw new Error(`Fann ikkje varianten for SKU ${sku}.`);
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!valldalProduct.active) {
        errors.push("Produktet er inaktivt i Valldal.");
    }
    if (!targetVariant.active) {
        errors.push("Varianten er inaktiv i Valldal.");
    }
    if (!targetVariant.name) {
        errors.push("Varianten manglar namn.");
    }
    if (
        typeof targetVariant.retailPrice !== "number" ||
        !Number.isFinite(targetVariant.retailPrice) ||
        targetVariant.retailPrice <= 0
    ) {
        errors.push("Varianten manglar ein gyldig utsalspris.");
    }
    if (!targetVariant.barcode) {
        warnings.push("Varianten manglar strekkode, men kan framleis leggjast til.");
    }

    const siblingSkus = new Set(
        valldalProduct.variants
            .filter((variant) => normalize(variant.sku) !== sku)
            .map((variant) => normalize(variant.sku))
            .filter(Boolean)
    );

    const parentCandidates = zettleProducts.filter((product) =>
        product.variants.some((variant) => siblingSkus.has(normalize(variant.sku)))
    );

    const alreadyExists = zettleProducts.some((product) =>
        product.variants.some((variant) => normalize(variant.sku) === sku)
    );

    if (alreadyExists) {
        errors.push(`SKU ${sku} finst allereie i Zettle.`);
    }
    if (parentCandidates.length === 0) {
        errors.push("Fann ikkje eit eksisterande Zettle-produkt via søskenvariantane.");
    }
    if (parentCandidates.length > 1) {
        errors.push("Søskenvariantane peikar til fleire Zettle-produkt. Plasseringa er tvitydig.");
    }

    const zettleProduct = parentCandidates.length === 1 ? parentCandidates[0] : undefined;
    const matchedBySkus = zettleProduct
        ? zettleProduct.variants
              .map((variant) => normalize(variant.sku))
              .filter((variantSku) => siblingSkus.has(variantSku))
        : [];

    if (
        zettleProduct?.category &&
        valldalProduct.category &&
        normalize(zettleProduct.category).toLocaleLowerCase("nb-NO") !==
            normalize(valldalProduct.category).toLocaleLowerCase("nb-NO")
    ) {
        warnings.push(
            `Kategorien er '${valldalProduct.category}' i Valldal og '${zettleProduct.category}' i Zettle.`
        );
    }

    if (zettleProduct) {
        const rawProduct = await fetchRawZettleProduct(zettleProduct.id);
        const optionDefinitionCount =
            rawProduct.variantOptionDefinitions?.definitions?.length ?? 0;

        if (optionDefinitionCount > 1) {
            errors.push(
                "Zettle-produktet har fleire variantval. Varianten kan ikkje leggjast til automatisk utan å opprette manglande kombinasjonar."
            );
        }
    }

    return {
        valid: errors.length === 0,
        warnings,
        errors,
        valldalProduct: {
            id: valldalProduct.id,
            name: valldalProduct.name,
            category: valldalProduct.category,
        },
        zettleProduct: zettleProduct
            ? {
                  id: zettleProduct.id,
                  name: zettleProduct.name,
                  category: zettleProduct.category,
              }
            : undefined,
        matchedBySkus,
        existingVariants: (zettleProduct?.variants ?? []).map((variant) => ({
            sku: normalize(variant.sku),
            name: variant.name,
            barcode: variant.barcode,
            retailPrice: variant.retailPrice,
        })),
        variantToAdd: {
            sku,
            name: targetVariant.name,
            barcode: targetVariant.barcode,
            retailPrice: targetVariant.retailPrice,
        },
    };
}

function normalizeOptionName(value: string) {
    return value
        .trim()
        .toLocaleLowerCase("nb-NO")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function findSizeOption<T extends { name: string }>(options: T[]) {
    return (
        options.find((option) => {
            const name = normalizeOptionName(option.name);
            return name.includes("storrelse") || name === "size";
        }) ?? (options.length === 1 ? options[0] : undefined)
    );
}

export async function addVariantToZettle(requestedSku: string) {
    // Bygg previewen på nytt ved skrivetidspunktet. Då kontrollerer vi at SKU-en
    // framleis manglar, og at søskenvariantane framleis peikar eintydig.
    const preview = await previewVariantPlacement(requestedSku);
    if (!preview.valid || !preview.zettleProduct) {
        throw new Error(preview.errors.join(" ") || "Varianten er ikkje klar for Zettle.");
    }

    const products = await getSyncProducts();
    const valldalProduct = products.find((product) =>
        product.variants.some((variant) => normalize(variant.sku) === normalize(requestedSku))
    );
    const targetVariant = valldalProduct?.variants.find(
        (variant) => normalize(variant.sku) === normalize(requestedSku)
    );

    if (!valldalProduct || !targetVariant || targetVariant.retailPrice === undefined) {
        throw new Error("Fann ikkje komplett variantinformasjon i Valldal.");
    }

    const rawProduct = await fetchRawZettleProduct(preview.zettleProduct.id);
    if (!rawProduct.variants?.length) {
        throw new Error("Zettle-produktet har ingen variantar å byggje vidare på.");
    }
    if (rawProduct.variants.length >= 99) {
        throw new Error("Zettle-produktet har nådd grensa på 99 variantar.");
    }
    if ((rawProduct.variantOptionDefinitions?.definitions?.length ?? 0) > 1) {
        throw new Error(
            "Zettle-produktet har fleire variantval og kan ikkje oppdaterast automatisk enno."
        );
    }
    if (rawProduct.variants.some((variant) => normalize(variant.sku ?? undefined) === normalize(requestedSku))) {
        throw new Error(`SKU ${requestedSku} finst allereie i Zettle.`);
    }

    const template = rawProduct.variants.find((variant) =>
        preview.matchedBySkus.includes(normalize(variant.sku ?? undefined))
    );
    if (!template) {
        throw new Error("Fann ikkje søskenvarianten som skulle brukast som mal.");
    }

    const options = template.options ? structuredClone(template.options) : null;
    if (options?.length) {
        const sizeOption = findSizeOption(options);
        if (!sizeOption) {
            throw new Error("Fann ikkje storleiksvalet i Zettle-produktet.");
        }
        sizeOption.value = targetVariant.name;
    } else if (rawProduct.variantOptionDefinitions?.definitions?.length) {
        throw new Error("Zettle-produktet har variantval, men søskenvarianten manglar valdata.");
    }

    const newVariant = structuredClone(template);
    newVariant.uuid = uuidv1();
    newVariant.name = options?.length
        ? options.map((option) => option.value).join(", ")
        : targetVariant.name;
    newVariant.sku = targetVariant.sku;
    newVariant.barcode = targetVariant.barcode ?? null;
    newVariant.price = {
        amount: Math.round(targetVariant.retailPrice * 100),
        currencyId: "NOK",
    };
    newVariant.options = options;

    const updatedProduct = structuredClone(rawProduct);
    updatedProduct.variants = [...rawProduct.variants, newVariant];

    const definitions = updatedProduct.variantOptionDefinitions?.definitions;
    if (definitions?.length && options?.length) {
        const sizeDefinition = findSizeOption(definitions);
        const sizeOption = findSizeOption(options);

        if (!sizeDefinition || !sizeOption) {
            throw new Error("Kunne ikkje oppdatere storleiksdefinisjonen i Zettle.");
        }

        sizeDefinition.properties ??= [];
        if (!sizeDefinition.properties.some((property) => property.value === sizeOption.value)) {
            sizeDefinition.properties.push({ value: sizeOption.value, imageUrl: null });
        }
    }

    await updateZettleProduct(rawProduct.uuid, updatedProduct);

    return {
        success: true,
        sku: targetVariant.sku,
        productId: rawProduct.uuid,
        productName: rawProduct.name,
        variantName: newVariant.name ?? targetVariant.name,
    };
}
