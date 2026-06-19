

export type SortableOrderLine = {
    brand?: string | null;
    category?: string | null;
    categoryName?: string | null;
    subcategory?: string | null;
    subcategoryName?: string | null;
    productName?: string | null;
    variantLabel?: string | null;
};

const CATEGORY_ORDER = [
    "saft",
    "sylte",
    "gele",
    "saus",
    "frisk",
    "rein",
    "sirup",
    "most",
    "sider",
    "ol",
];

function sortValue(value: string | null | undefined) {
    return (value ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function categoryKey(line: SortableOrderLine) {
    const value = sortValue(line.categoryName || line.category);

    if (value.includes("saft")) return "saft";
    if (value.includes("sylte") || value.includes("syltetoy")) return "sylte";
    if (value.includes("gele")) return "gele";
    if (value.includes("saus")) return "saus";
    if (value.includes("frisk")) return "frisk";
    if (value.includes("rein")) return "rein";
    if (value.includes("sirup")) return "sirup";
    if (value.includes("most")) return "most";
    if (value.includes("sider")) return "sider";
    if (value.includes("ol") || value.includes("oel")) return "ol";

    return value;
}

function brandRank(line: SortableOrderLine) {
    return sortValue(line.brand) === "bryggeri" ? 1 : 0;
}

function categoryRank(line: SortableOrderLine) {
    const index = CATEGORY_ORDER.indexOf(categoryKey(line));
    return index === -1 ? 999 : index;
}

export function sortOrderLines<T extends SortableOrderLine>(lines: T[]): T[] {
    return [...lines].sort((a, b) => {
        const brandDiff = brandRank(a) - brandRank(b);
        if (brandDiff !== 0) return brandDiff;

        const categoryDiff = categoryRank(a) - categoryRank(b);
        if (categoryDiff !== 0) return categoryDiff;

        const categoryA = categoryKey(a);
        const categoryB = categoryKey(b);
        if (categoryA !== categoryB) {
            return categoryA.localeCompare(categoryB, "nb-NO");
        }

        const productDiff = sortValue(a.productName).localeCompare(
            sortValue(b.productName),
            "nb-NO"
        );

        if (productDiff !== 0) {
            return productDiff;
        }

        return sortValue(a.variantLabel).localeCompare(
            sortValue(b.variantLabel),
            "nb-NO"
        );
    });
}

export function groupOrderLinesByBrand<T extends SortableOrderLine>(lines: T[]) {
    const sorted = sortOrderLines(lines);

    return {
        safteri: sorted.filter((line) => sortValue(line.brand) !== "bryggeri"),
        bryggeri: sorted.filter((line) => sortValue(line.brand) === "bryggeri"),
    };
}