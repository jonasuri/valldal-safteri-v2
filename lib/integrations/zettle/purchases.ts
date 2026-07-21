import { getZettleAccessToken } from "@/lib/integrations/zettle/auth";
import { fetchZettleProducts } from "@/lib/integrations/zettle/products";

const PURCHASE_API_BASE_URL = "https://purchase.izettle.com";

type ZettlePurchaseLine = {
    quantity?: unknown;
    type?: unknown;
    name?: unknown;
    variantName?: unknown;
    sku?: unknown;
    barcode?: unknown;
    productUuid?: unknown;
    variantUuid?: unknown;
};

type ZettlePurchase = {
    purchaseUUID1?: unknown;
    purchaseNumber?: unknown;
    timestamp?: unknown;
    created?: unknown;
    refund?: unknown;
    products?: unknown;
};

type PurchasePage = {
    purchases?: unknown;
    lastPurchaseHash?: unknown;
};

export type ZettleInventoryPreviewLine = {
    purchaseId: string;
    purchaseNumber?: number;
    timestamp: string;
    sku: string;
    productName: string;
    variantName: string;
    soldQuantity: number;
    inventoryChange: number;
    refund: boolean;
};

export type ZettleInventoryPreviewIssue = {
    purchaseId: string;
    purchaseNumber?: number;
    timestamp: string;
    productName: string;
    variantName: string;
    barcode: string;
    category: string;
    posFolder: string;
    productId: string;
    variantId: string;
    reason: string;
};

const POS_FOLDER_BY_CATEGORY: Record<string, string> = {
    Sylte: "SYLTE",
    "Gelè": "GELÈ",
    Gele: "GELÈ",
    Saus: "SAUS",
    Saft: "SAFT",
    Frisk: "FRISK",
    Rein: "REIN",
    Øl: "BRYGGERI",
    Sider: "BRYGGERI",
    Is: "IS",
};

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value.replace(",", "."));
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

async function purchaseRequest(path: string) {
    const accessToken = await getZettleAccessToken();
    const response = await fetch(`${PURCHASE_API_BASE_URL}${path}`, {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
    });

    if (!response.ok) {
        const body = await response.text();
        if (response.status === 401 || response.status === 403) {
            throw new Error(
                "Zettle-nøkkelen manglar truleg tilgangen READ:PURCHASE. Oppdater API-nøkkelen før vi hentar sal."
            );
        }
        throw new Error(`Kunne ikkje hente Zettle-sal (${response.status}): ${body}`);
    }

    return response.json() as Promise<PurchasePage>;
}

export async function previewZettleInventoryChanges(input: {
    startDate: string;
    endDate?: string;
}) {
    const purchases: ZettlePurchase[] = [];
    const zettleProducts = await fetchZettleProducts();
    const productById = new Map(zettleProducts.map((product) => [product.id, product]));
    let lastPurchaseHash = "";

    for (let page = 0; page < 20; page += 1) {
        const params = new URLSearchParams({
            startDate: input.startDate,
            limit: "1000",
            descending: "false",
        });
        if (input.endDate) params.set("endDate", input.endDate);
        if (lastPurchaseHash) params.set("lastPurchaseHash", lastPurchaseHash);

        const response = await purchaseRequest(`/purchases/v2?${params.toString()}`);
        const pagePurchases = Array.isArray(response.purchases)
            ? response.purchases as ZettlePurchase[]
            : [];
        purchases.push(...pagePurchases);

        const nextHash = text(response.lastPurchaseHash);
        if (pagePurchases.length === 0 || !nextHash || nextHash === lastPurchaseHash) break;
        lastPurchaseHash = nextHash;
    }

    const lines: ZettleInventoryPreviewLine[] = [];
    const issues: ZettleInventoryPreviewIssue[] = [];

    for (const purchase of purchases) {
        const purchaseId = text(purchase.purchaseUUID1) || "ukjent-kjøp";
        const timestamp = text(purchase.timestamp) || text(purchase.created);
        const purchaseNumber = number(purchase.purchaseNumber) ?? undefined;
        const purchaseLines = Array.isArray(purchase.products)
            ? purchase.products as ZettlePurchaseLine[]
            : [];

        for (const line of purchaseLines) {
            const productName = text(line.name) || "Ukjent vare";
            const quantity = number(line.quantity);
            const sku = text(line.sku);
            const productId = text(line.productUuid);
            const variantId = text(line.variantUuid);
            const libraryProduct = productById.get(productId);
            const libraryVariant = libraryProduct?.variants.find(
                (variant) => variant.id === variantId
            );
            const issue = (reason: string): ZettleInventoryPreviewIssue => ({
                purchaseId,
                purchaseNumber,
                timestamp,
                productName: libraryProduct?.name || productName,
                variantName: libraryVariant?.name || text(line.variantName),
                barcode: libraryVariant?.barcode || text(line.barcode),
                category: libraryProduct?.category || "Ukjend kategori",
                posFolder: libraryProduct?.category
                    ? POS_FOLDER_BY_CATEGORY[libraryProduct.category] || "Ukjend mappe"
                    : "Ukjend mappe",
                productId,
                variantId,
                reason,
            });

            if (text(line.type) !== "PRODUCT") {
                issues.push(issue("Ikkje ei vare frå produktregisteret."));
                continue;
            }
            if (!sku) {
                issues.push(issue("Manglar SKU i Zettle-salet."));
                continue;
            }
            if (quantity === null || !Number.isInteger(quantity) || quantity === 0) {
                issues.push(issue("Mengda er ikkje eit heilt tal."));
                continue;
            }

            lines.push({
                purchaseId,
                purchaseNumber,
                timestamp,
                sku,
                productName,
                variantName: text(line.variantName),
                soldQuantity: quantity,
                inventoryChange: -quantity,
                refund: quantity < 0 || purchase.refund === true,
            });
        }
    }

    return {
        dryRun: true,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        purchaseCount: purchases.length,
        lineCount: lines.length,
        unitChange: lines.reduce((sum, line) => sum + line.inventoryChange, 0),
        lines,
        issues,
    };
}
