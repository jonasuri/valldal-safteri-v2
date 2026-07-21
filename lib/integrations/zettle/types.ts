export type ZettleVariant = {
    id: string;
    sku: string;
    name: string;
    barcode?: string;
    retailPrice: number;
    currency?: string;
};

export type ZettleProduct = {
    id: string;
    name: string;
    category?: string;
    variants: ZettleVariant[];
};

export type ValldalVariantForZettle = {
    productId: string;
    productName: string;
    variantId: string;
    variantName: string;
    sku: string;
    barcode?: string;
    retailPrice: number;
    productActive: boolean;
    variantActive: boolean;
};

export type ZettleProductDifferenceType =
    | "missing_in_zettle"
    | "missing_in_valldal"
    | "inactive_in_valldal"
    | "price_mismatch"
    | "barcode_mismatch";

export type ZettleProductDifference = {
    sku: string;
    type: ZettleProductDifferenceType;
    message: string;
    valldal?: ValldalVariantForZettle;
    zettle?: ZettleVariant & {
        productId: string;
        productName: string;
    };
};

export type ZettleProductComparison = {
    matchedCount: number;
    missingInZettleCount: number;
    missingInValldalCount: number;
    inactiveInValldalCount: number;
    priceMismatchCount: number;
    barcodeMismatchCount: number;
    differences: ZettleProductDifference[];
};
