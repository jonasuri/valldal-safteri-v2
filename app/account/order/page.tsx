
"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { CustomerType } from "@/lib/customersFirestore";
import {
    B2B_PRICE_CONTACT_EMAIL,
    fetchB2BProducts,
    formatB2BPriceExVat,
    getB2BVariantPrice,
    hasB2BVariantPrice,
    type B2BProduct,
    type B2BProductBrand,
    type B2BVariant,
} from "@/lib/productsB2B";
import { createOrder } from "@/lib/ordersFirestore";
import { notifyInternalOrder } from "@/lib/internalOrderNotifications";
import { sendAutomaticOrderConfirmation } from "@/lib/customerEmailActions";
import { groupOrderLinesByBrand, sortVariantsBySize } from "@/lib/orderLineSorting";
import { useSystemFeedback } from "@/app/components/SystemFeedback";

type ViewMode = "liste" | "oppdag";
type BrandFilter = "alle" | B2BProductBrand;

type AccountCustomer = {
    id: string;
    companyName: string;
    displayName: string;
    sameAsCompanyName: boolean;
    contactName: string;
    phone: string;
    organizationNumber: string;
    customerType: CustomerType;
    active: boolean;
    profileCompleted: boolean;
    sandboxEnabled: boolean;
};

type OrderLine = {
    productId: string;
    productName: string;
    brand: B2BProductBrand;
    category: string;
    variantId: string;
    variantLabel: string;
    sku: string;
    quantity: number;
    unitPrice: number;
};

const STORAGE_KEY = "valldal-b2b-order-quantities";

async function fetchCustomerForUser(user: User): Promise<AccountCustomer | null> {
    const snapshot = await getDocs(
        query(collection(db, "customers"), where("authUid", "==", user.uid), limit(1))
    );

    if (snapshot.empty) return null;

    const docSnap = snapshot.docs[0];
    const data = docSnap.data();

    const companyName = typeof data.companyName === "string" ? data.companyName : "";
    const displayName = typeof data.displayName === "string" && data.displayName.trim()
        ? data.displayName
        : companyName;

    return {
        id: docSnap.id,
        companyName,
        displayName,
        sameAsCompanyName:
            typeof data.sameAsCompanyName === "boolean"
                ? data.sameAsCompanyName
                : displayName === companyName,
        contactName: typeof data.contactName === "string" ? data.contactName : "",
        phone: typeof data.phone === "string" ? data.phone : "",
        organizationNumber: typeof data.organizationNumber === "string" ? data.organizationNumber : "",
        customerType: data.customerType === "grossist" ? "grossist" : "retail",
        active: typeof data.active === "boolean" ? data.active : true,
        profileCompleted: data.profileCompleted === true,
        sandboxEnabled: data.sandbox?.enabled === true,
    };
}

function brandLabel(brand: B2BProductBrand) {
    return brand === "bryggeri" ? "Bryggeri" : "Safteri";
}

function customerTypeLabel(type: CustomerType) {
    return type === "grossist" ? "Grossist" : "Retail";
}

function normalizeCategory(value: string) {
    return value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function getCategoryWeight(product: B2BProduct) {
    const brandOffset = product.brand === "safteri" ? 0 : 100;
    const category = normalizeCategory(product.category);

    const weights: Record<string, number> = {
        saft: 10,
        sylte: 20,
        gele: 30,
        saus: 40,
        frisk: 50,
        rein: 60,
        sirup: 70,
        most: 80,

        sider: 110,
        ol: 120,
        øl: 120,
    };

    return brandOffset + (weights[category] ?? 90);
}

function sortProducts(products: B2BProduct[]) {
    return [...products].sort((a, b) => {
        const weightDiff = getCategoryWeight(a) - getCategoryWeight(b);

        if (weightDiff !== 0) {
            return weightDiff;
        }

        return a.name.localeCompare(b.name, "nb");
    });
}

function getProductGroupLabel(product: B2BProduct) {
    return `${brandLabel(product.brand)} · ${product.category || "Anna"}`;
}

function getVariantAlcoholLabel(variant: B2BVariant) {
    const value = (variant as any).alcoholPercent ?? (variant as any).abv;

    if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
    }

    return `${value}% vol.`;
}

function normalizeVariantLabel(label: string) {
    return label.toLowerCase().replace(/\s+/g, "").replace(",", ".");
}

function getCaseSize(product: B2BProduct, variant: B2BVariant) {
    const category = product.category.toLowerCase();
    const label = normalizeVariantLabel(variant.label);

    if (category === "sylte") {
        if (label.includes("55")) return 30;
        if (label.includes("80")) return 30;
        if (label.includes("195")) return 16;
        if (label.includes("390")) return 9;
        return null;
    }

    if (category === "saft") {
        if (label.includes("0.7") || label.includes("0,7") || label.includes("70cl")) return 12;
        return null;
    }

    if (category === "frisk") {
        if (label.includes("0.33") || label.includes("0,33") || label.includes("33cl")) return 24;
        return null;
    }

    if (category === "rein") {
        if (label.includes("0.33") || label.includes("0,33") || label.includes("33cl")) return 24;
        if (label.includes("0.75") || label.includes("0,75") || label.includes("75cl")) return 6;
        return null;
    }

    if (category === "øl" || category === "ol") {
        if (label.includes("0.5") || label.includes("0,5") || label.includes("50cl")) return 12;
        return null;
    }

    if (category === "sider") {
        if (label.includes("0.33") || label.includes("0,33") || label.includes("33cl")) return 24;
        if (label.includes("0.75") || label.includes("0,75") || label.includes("75cl")) return 6;
        return null;
    }

    return null;
}

function getCaseSizeLabel(product: B2BProduct, variant: B2BVariant) {
    const caseSize = getCaseSize(product, variant);
    return caseSize ? `Eske: ${caseSize} stk · Bestilling skjer per eining` : null;
}

function getCaseBreakdownLabel(caseSize: number | null, quantity: number) {
    if (!caseSize || quantity <= 0) return null;

    const fullCases = Math.floor(quantity / caseSize);
    const remainder = quantity % caseSize;

    if (fullCases > 0 && remainder === 0) {
        return `✓ ${fullCases} ${fullCases === 1 ? "heil eske" : "heile esker"}`;
    }

    if (fullCases > 0 && remainder > 0) {
        return `${fullCases} ${fullCases === 1 ? "eske" : "esker"} + ${remainder} stk`;
    }

    return `${quantity} stk · under éi eske`;
}

function getGroupStyles(label: string) {
    if (label.startsWith("Safteri")) {
        return {
            desktop: "bg-rose-50 text-rose-800 border-y border-rose-100",
            text: "text-rose-700",
        };
    }

    return {
        desktop: "bg-amber-50 text-amber-900 border-y border-amber-100",
        text: "text-amber-700",
    };
}

function groupProductsByCategory(products: B2BProduct[]) {
    const groups: { label: string; products: B2BProduct[] }[] = [];

    for (const product of products) {
        const label = getProductGroupLabel(product);
        const existingGroup = groups.find((group) => group.label === label);

        if (existingGroup) {
            existingGroup.products.push(product);
        } else {
            groups.push({ label, products: [product] });
        }
    }

    return groups;
}

function getLineKey(productId: string, variantId: string) {
    return `${productId}__${variantId}`;
}

function readStoredQuantities() {
    if (typeof window === "undefined") return {};

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return {};

        const next: Record<string, number> = {};

        for (const [key, rawValue] of Object.entries(parsed)) {
            const quantity = Math.max(0, Math.floor(Number(rawValue) || 0));
            if (quantity > 0) {
                next[key] = quantity;
            }
        }

        return next;
    } catch {
        return {};
    }
}

function storeQuantities(quantities: Record<string, number>) {
    if (typeof window === "undefined") return;

    const cleaned = Object.fromEntries(
        Object.entries(quantities).filter(([, value]) => value > 0)
    );

    if (Object.keys(cleaned).length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
}

export default function AccountOrderPage() {
    const { notify } = useSystemFeedback();
    const router = useRouter();
    const [viewMode, setViewMode] = useState<ViewMode>("liste");
    const [isOrderOpen, setIsOrderOpen] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [customer, setCustomer] = useState<AccountCustomer | null>(null);
    const [products, setProducts] = useState<B2BProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [queryText, setQueryText] = useState("");
    const [brandFilter, setBrandFilter] = useState<BrandFilter>("alle");
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [submittingOrder, setSubmittingOrder] = useState(false);
    const [sendSandboxEmails, setSendSandboxEmails] = useState(false);

    useEffect(() => {
        setQuantities(readStoredQuantities());
    }, []);

    useEffect(() => {
        storeQuantities(quantities);
    }, [quantities]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
            setUser(nextUser);
            setCustomer(null);
            setProducts([]);
            setError("");
            setLoading(true);

            if (!nextUser) {
                setLoading(false);
                return;
            }

            try {
                const nextCustomer = await fetchCustomerForUser(nextUser);

                if (!nextCustomer || !nextCustomer.active) {
                    setError("Du må vere innlogga med ein aktiv B2B-kunde for å lage bestilling.");
                    setLoading(false);
                    return;
                }

                const nextProducts = await fetchB2BProducts();
                setCustomer(nextCustomer);
                setProducts(nextProducts.filter((product) => product.active));
            } catch (err) {
                console.error(err);
                setError("Kunne ikkje laste bestillingssida.");
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const filteredProducts = useMemo(() => {
        const q = queryText.trim().toLowerCase();

        return products.filter((product) => {
            if (brandFilter !== "alle" && product.brand !== brandFilter) return false;
            if (!q) return true;

            return (
                product.name.toLowerCase().includes(q) ||
                product.category.toLowerCase().includes(q) ||
                product.variants.some((variant) =>
                    variant.label.toLowerCase().includes(q) ||
                    variant.sku.toLowerCase().includes(q)
                )
            );
        });
    }, [products, queryText, brandFilter]);

    const sortedFilteredProducts = useMemo(() => {
        return sortProducts(filteredProducts);
    }, [filteredProducts]);

    const groupedProducts = useMemo(() => {
        return groupProductsByCategory(sortedFilteredProducts);
    }, [sortedFilteredProducts]);

    const orderLines = useMemo<OrderLine[]>(() => {
        if (!customer) return [];

        const lines: OrderLine[] = [];

        for (const product of products) {
            for (const variant of product.variants) {
                const key = getLineKey(product.id, variant.id);
                const quantity = quantities[key] || 0;
                const unitPrice = getB2BVariantPrice(variant, customer.customerType);

                if (quantity > 0 && typeof unitPrice === "number") {
                    lines.push({
                        productId: product.id,
                        productName: product.name,
                        brand: product.brand,
                        category: product.category,
                        variantId: variant.id,
                        variantLabel: variant.label,
                        sku: variant.sku,
                        quantity,
                        unitPrice,
                    });
                }
            }
        }

        return lines;
    }, [products, quantities, customer]);

    const orderLineCount = orderLines.length;
    const orderItemCount = orderLines.reduce((sum, line) => sum + line.quantity, 0);
    const orderSubtotal = orderLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);

    const orderGroups = useMemo(() => groupOrderLinesByBrand(orderLines), [orderLines]);

    function getOrderLineCaseBreakdown(line: OrderLine) {
        const product = products.find((item) => item.id === line.productId);
        const variant = product?.variants.find((item) => item.id === line.variantId);

        if (!product || !variant) return null;

        return getCaseBreakdownLabel(getCaseSize(product, variant), line.quantity);
    }

    function setQuantity(product: B2BProduct, variant: B2BVariant, value: string) {
        if (!customer) return;
        if (!hasB2BVariantPrice(variant, customer.customerType)) return;

        const quantity = Math.max(0, Math.floor(Number(value) || 0));
        const key = getLineKey(product.id, variant.id);

        setQuantities((prev) => {
            const next = { ...prev };
            if (quantity > 0) next[key] = quantity;
            else delete next[key];
            return next;
        });
    }

    function adjustQuantity(product: B2BProduct, variant: B2BVariant, delta: number) {
        if (!customer) return;
        if (!hasB2BVariantPrice(variant, customer.customerType)) return;

        const key = getLineKey(product.id, variant.id);
        const current = quantities[key] || 0;
        const nextQuantity = Math.max(0, current + delta);

        setQuantities((prev) => {
            const next = { ...prev };
            if (nextQuantity > 0) next[key] = nextQuantity;
            else delete next[key];
            return next;
        });
    }

    function clearOrder() {
        setQuantities({});
    }

    function updateOrderLineQuantity(productId: string, variantId: string, quantity: number) {
        const key = getLineKey(productId, variantId);

        setQuantities((prev) => {
            const next = { ...prev };

            if (quantity > 0) {
                next[key] = quantity;
            } else {
                delete next[key];
            }

            return next;
        });
    }

    async function submitOrder() {
        if (!customer || !customer.profileCompleted || !user || !orderLines.length || submittingOrder) {
            return;
        }

        try {
            setSubmittingOrder(true);

            const orderId = await createOrder({
                customerId: customer.id,
                customerName: customer.displayName || customer.companyName,
                customerDisplayName: customer.displayName || customer.companyName,
                customerCompanyName: customer.companyName,
                customerEmail: user.email || "",
                customerType: customer.customerType,
                customerPhone: customer.phone,
                customerContactName: customer.contactName,
                organizationNumber: customer.organizationNumber,
                source: "customer",
                sandbox: customer.sandboxEnabled ? {
                    enabled: true,
                    sendEmails: sendSandboxEmails,
                    orderMode: "customer",
                } : undefined,
                lines: orderLines.map((line) => ({
                    productId: line.productId,
                    productName: line.productName,
                    variantId: line.variantId,
                    variantLabel: line.variantLabel,
                    brand: line.brand,
                    category: line.category,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                })),
                totalExVat: orderSubtotal,
                lineCount: orderLineCount,
                unitCount: orderItemCount,
            });

            if (!customer.sandboxEnabled || sendSandboxEmails) {
                await notifyInternalOrder({ user, orderId, event: "new_order" });
                await sendAutomaticOrderConfirmation(user, orderId).catch((emailError) => {
                    console.error("Ordren vart lagra, men ordrebekreftinga feila", emailError);
                });
            }

            clearOrder();
            setIsOrderOpen(false);
            router.push(`/account/orders/${orderId}?from=account`);
        } catch (error) {
            console.error(error);
            notify("Kunne ikkje sende bestillinga. Prøv igjen.", "error");
        } finally {
            setSubmittingOrder(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
                <div className="mx-auto max-w-7xl px-6 py-12 text-sm text-neutral-600">
                    Lastar bestilling …
                </div>
            </main>
        );
    }

    if (!user || !customer) {
        return (
            <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
                <div className="mx-auto max-w-2xl px-6 py-12">
                    <div className="rounded-[24px] border border-neutral-200 bg-white p-6">
                        <h1 className="text-2xl font-semibold tracking-tight">Logg inn først</h1>
                        <p className="mt-3 text-sm leading-7 text-neutral-600">
                            Du må vere innlogga med ein aktiv B2B-konto for å lage bestilling.
                        </p>
                        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
                        <Link
                            href="/account"
                            className="mt-6 inline-flex rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                        >
                            Gå til innlogging
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    if (!customer.profileCompleted) {
        return (
            <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
                <div className="mx-auto max-w-2xl px-6 py-12">
                    <Link
                        href="/account"
                        className="text-sm text-neutral-600 underline-offset-4 hover:underline"
                    >
                        ← Tilbake til Min side
                    </Link>

                    <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 p-6">
                        <p className="text-xs uppercase tracking-[0.18em] text-amber-700">
                            Kundeprofil
                        </p>

                        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-amber-900">
                            Fullfør kundeprofil før bestilling
                        </h1>

                        <p className="mt-3 max-w-2xl text-sm leading-7 text-amber-900">
                            Firmanamn, kontaktperson, telefonnummer og org.nr. må vere registrert før de kan sende inn bestilling.
                        </p>

                        <Link
                            href="/account/profile"
                            className="mt-5 inline-flex rounded-full bg-amber-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800"
                        >
                            Gå til kundeprofil
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen text-[color:var(--account-ink)]">
            <div className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14 xl:mr-[390px] xl:max-w-none xl:px-10">
                <header className="flex flex-col gap-5 border-b border-[color:var(--account-line)] pb-8 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--account-muted)]">
                            B2B-bestilling · {customer.displayName || customer.companyName} · {customerTypeLabel(customer.customerType)}
                        </p>
                        <h1 className="mt-2 text-3xl tracking-tight md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
                            Ny bestilling
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--account-muted)]">
                            Legg til produkt frå både Valldal Safteri og Valldal Bryggeri i same bestilling.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsOrderOpen(true)}
                            className="rounded-full bg-[color:var(--account-accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--account-accent-hover)] xl:hidden"
                        >
                            Bestilling ({orderLineCount})
                        </button>

                        <div className="inline-flex rounded-full border border-[color:var(--account-line)] bg-white p-1">
                            <button
                                type="button"
                                onClick={() => setViewMode("liste")}
                                className={
                                    "rounded-full px-4 py-2 text-sm transition " +
                                    (viewMode === "liste" ? "bg-[color:var(--account-ink)] text-white" : "text-[color:var(--account-muted)]")
                                }
                            >
                                Liste
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("oppdag")}
                                className={
                                    "rounded-full px-4 py-2 text-sm transition " +
                                    (viewMode === "oppdag" ? "bg-[color:var(--account-ink)] text-white" : "text-[color:var(--account-muted)]")
                                }
                            >
                                Oppdag
                            </button>
                        </div>
                    </div>
                </header>

                <div className="mt-7 rounded-[20px] border border-[color:var(--account-line)] bg-[color:var(--account-card)] p-4 md:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <input
                            type="search"
                            value={queryText}
                            onChange={(e) => setQueryText(e.target.value)}
                            className="w-full rounded-full border border-[color:var(--account-line)] bg-white px-4 py-2.5 text-sm outline-none lg:max-w-md"
                            placeholder="Søk etter produkt, kategori, variant eller SKU"
                        />

                        <div className="flex flex-wrap gap-2">
                            {([
                                ["alle", "Alle"],
                                ["safteri", "Safteri"],
                                ["bryggeri", "Bryggeri"],
                            ] as const).map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setBrandFilter(key)}
                                    className={
                                        "rounded-full border px-3 py-1.5 text-xs transition " +
                                        (brandFilter === key
                                            ? "border-[color:var(--account-ink)] bg-[color:var(--account-ink)] text-white"
                                            : "border-[color:var(--account-line)] bg-white text-[color:var(--account-muted)] hover:bg-neutral-50")
                                    }
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {viewMode === "liste" ? (
                    <section className="mt-6">
                        <div className="hidden overflow-x-auto rounded-[24px] border border-neutral-200 bg-white md:block">
                            <table className="w-full min-w-[900px] text-left text-sm">
                                <thead className="bg-neutral-50 text-xs uppercase tracking-[0.12em] text-neutral-500">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Produkt</th>
                                        <th className="px-4 py-3 font-medium">Pris</th>
                                        <th className="px-4 py-3 font-medium">Antal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {groupedProducts.map((group) => (
                                        <Fragment key={group.label}>
                                            <tr className={getGroupStyles(group.label).desktop}>
                                                <td colSpan={3} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em]">
                                                    {group.label}
                                                </td>
                                            </tr>
                                            {group.products.map((product) => (
                                                <Fragment key={product.id}>
                                                    <tr className="bg-neutral-50 border-b border-neutral-200">
                                                        <td colSpan={3} className="px-4 py-3">
                                                            <div className="font-medium text-neutral-900">{product.name}</div>
                                                        </td>
                                                    </tr>

                                                    {sortVariantsBySize(product.variants).map((variant) => {
                                                        const price = getB2BVariantPrice(variant, customer.customerType);
                                                        const hasPrice = hasB2BVariantPrice(variant, customer.customerType);
                                                        const key = getLineKey(product.id, variant.id);

                                                        return (
                                                            <tr key={key} className="border-b border-neutral-100 last:border-b-0">
                                                                <td className="px-4 py-3 align-top text-neutral-700">
                                                                    {variant.label}
                                                                    {getVariantAlcoholLabel(variant) ? ` · ${getVariantAlcoholLabel(variant)}` : ""}
                                                                    {getCaseSizeLabel(product, variant) ? (
                                                                        <div className="mt-1 text-xs text-neutral-500">
                                                                            {getCaseSizeLabel(product, variant)}
                                                                        </div>
                                                                    ) : null}
                                                                </td>
                                                                <td className="px-4 py-3 align-top">
                                                                    <div className="text-sm font-medium text-neutral-900">
                                                                        {formatB2BPriceExVat(price)}
                                                                    </div>
                                                                    {!hasPrice ? (
                                                                        <a
                                                                            href={`mailto:${B2B_PRICE_CONTACT_EMAIL}`}
                                                                            className="mt-1 inline-block text-xs text-neutral-500 underline-offset-4 hover:underline"
                                                                        >
                                                                            {B2B_PRICE_CONTACT_EMAIL}
                                                                        </a>
                                                                    ) : null}
                                                                </td>
                                                                <td className="px-4 py-3 align-top">
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            type="button"
                                                                            disabled={!hasPrice}
                                                                            onClick={() => adjustQuantity(product, variant, -1)}
                                                                            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-sm hover:bg-neutral-50 disabled:opacity-40"
                                                                        >
                                                                            −
                                                                        </button>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            value={quantities[key] || ""}
                                                                            disabled={!hasPrice}
                                                                            onChange={(e) => setQuantity(product, variant, e.target.value)}
                                                                            className="w-16 rounded-[10px] border border-neutral-200 bg-white px-2 py-1 text-center text-sm outline-none [appearance:textfield] focus:border-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                                            placeholder="0"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            disabled={!hasPrice}
                                                                            onClick={() => adjustQuantity(product, variant, 1)}
                                                                            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-sm hover:bg-neutral-50 disabled:opacity-40"
                                                                        >
                                                                            +
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </Fragment>
                                            ))}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="space-y-4 md:hidden">
                            {groupedProducts.map((group) => (
                                <div key={group.label} className="space-y-3">
                                    <div className={`px-1 text-xs font-semibold uppercase tracking-[0.18em] ${getGroupStyles(group.label).text}`}>
                                        {group.label}
                                    </div>
                                    {group.products.map((product) => (
                                        <div key={product.id} className="rounded-[20px] border border-neutral-200 bg-white overflow-hidden">
                                            <div className="bg-neutral-50 px-4 py-3">
                                                <div className="font-medium text-neutral-900">{product.name}</div>
                                            </div>

                                            <div className="divide-y divide-neutral-100">
                                                {sortVariantsBySize(product.variants).map((variant) => {
                                                    const price = getB2BVariantPrice(variant, customer.customerType);
                                                    const hasPrice = hasB2BVariantPrice(variant, customer.customerType);
                                                    const key = getLineKey(product.id, variant.id);

                                                    return (
                                                        <div key={key} className="p-4">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <div className="text-sm font-medium text-neutral-900">
                                                                        {variant.label}
                                                                        {getVariantAlcoholLabel(variant) ? ` · ${getVariantAlcoholLabel(variant)}` : ""}
                                                                    </div>
                                                                    {getCaseSizeLabel(product, variant) ? (
                                                                        <div className="mt-1 text-xs text-neutral-500">
                                                                            {getCaseSizeLabel(product, variant)}
                                                                        </div>
                                                                    ) : null}
                                                                    <div className="mt-1 text-sm text-neutral-600">
                                                                        {formatB2BPriceExVat(price)}
                                                                    </div>
                                                                    {!hasPrice ? (
                                                                        <a
                                                                            href={`mailto:${B2B_PRICE_CONTACT_EMAIL}`}
                                                                            className="mt-1 inline-block text-xs text-neutral-500 underline-offset-4 hover:underline"
                                                                        >
                                                                            {B2B_PRICE_CONTACT_EMAIL}
                                                                        </a>
                                                                    ) : null}
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        disabled={!hasPrice}
                                                                        onClick={() => adjustQuantity(product, variant, -1)}
                                                                        className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-sm hover:bg-neutral-50 disabled:opacity-40"
                                                                    >
                                                                        −
                                                                    </button>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        value={quantities[key] || ""}
                                                                        disabled={!hasPrice}
                                                                        onChange={(e) => setQuantity(product, variant, e.target.value)}
                                                                        className="w-14 rounded-[10px] border border-neutral-200 bg-white px-2 py-1 text-center text-sm outline-none [appearance:textfield] focus:border-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                                        placeholder="0"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        disabled={!hasPrice}
                                                                        onClick={() => adjustQuantity(product, variant, 1)}
                                                                        className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-sm hover:bg-neutral-50 disabled:opacity-40"
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                        {!sortedFilteredProducts.length ? (
                            <div className="px-4 py-10 text-center text-sm text-neutral-500">
                                Ingen produkt funne.
                            </div>
                        ) : null}
                    </section>
                ) : (
                    <section className="mt-6 space-y-8">
                        {groupedProducts.map((group) => (
                            <div key={group.label}>
                                <div className={`mb-4 border-b pb-2 text-xs font-semibold uppercase tracking-[0.18em] ${getGroupStyles(group.label).text}`}>
                                    {group.label}
                                </div>
                                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                                    {group.products.map((product) => (
                                        <article key={product.id} className="rounded-[24px] border border-neutral-200 bg-white p-5">
                                            <div className="aspect-square overflow-hidden rounded-[18px] bg-neutral-100">
                                                <img
                                                    src={product.imageUrl || "/logoDark.png"}
                                                    alt={product.name}
                                                    className="h-full w-full object-contain p-4"
                                                />
                                            </div>

                                            <h2 className="mt-2 text-xl font-medium">{product.name}</h2>
                                            {product.shortDescription ? (
                                                <p className="mt-2 text-sm leading-6 text-neutral-600">{product.shortDescription}</p>
                                            ) : null}
                                            <div className="mt-4 space-y-3">
                                                {sortVariantsBySize(product.variants).map((variant) => {
                                                    const price = getB2BVariantPrice(variant, customer.customerType);
                                                    const hasPrice = hasB2BVariantPrice(variant, customer.customerType);
                                                    const key = getLineKey(product.id, variant.id);

                                                    return (
                                                        <div key={variant.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-neutral-100 bg-neutral-50 px-3 py-2">
                                                            <div>
                                                                <div className="text-sm font-medium">
                                                                    {variant.label}
                                                                    {getVariantAlcoholLabel(variant) ? ` · ${getVariantAlcoholLabel(variant)}` : ""}
                                                                </div>
                                                                {getCaseSizeLabel(product, variant) ? (
                                                                    <div className="text-xs text-neutral-500">
                                                                        {getCaseSizeLabel(product, variant)}
                                                                    </div>
                                                                ) : null}
                                                                <div className="text-xs text-neutral-500">{formatB2BPriceExVat(price)}</div>
                                                                {!hasPrice ? (
                                                                    <a href={`mailto:${B2B_PRICE_CONTACT_EMAIL}`} className="text-xs text-neutral-500 underline-offset-4 hover:underline">
                                                                        {B2B_PRICE_CONTACT_EMAIL}
                                                                    </a>
                                                                ) : null}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    disabled={!hasPrice}
                                                                    onClick={() => adjustQuantity(product, variant, -1)}
                                                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-sm hover:bg-neutral-50 disabled:opacity-40"
                                                                >
                                                                    −
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={quantities[key] || ""}
                                                                    disabled={!hasPrice}
                                                                    onChange={(e) => setQuantity(product, variant, e.target.value)}
                                                                    className="w-14 rounded-[10px] border border-neutral-200 bg-white px-2 py-1 text-center text-sm outline-none [appearance:textfield] focus:border-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                                    placeholder="0"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    disabled={!hasPrice}
                                                                    onClick={() => adjustQuantity(product, variant, 1)}
                                                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-sm hover:bg-neutral-50 disabled:opacity-40"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </section>
                )}

                <div className="mt-6 flex gap-3">
                    <Link
                        href="/account"
                        className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"
                    >
                        ← Min konto
                    </Link>
                </div>
            </div>

            <div className={`${isOrderOpen ? "fixed inset-0 z-50" : "hidden"} xl:fixed xl:bottom-0 xl:left-auto xl:right-0 xl:top-[113px] xl:z-20 xl:block xl:w-[390px]`}>
                    <button
                        type="button"
                        aria-label="Lukk bestilling"
                        onClick={() => setIsOrderOpen(false)}
                        className="absolute inset-0 bg-black/25 xl:hidden"
                    />
                    <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-[color:var(--account-canvas)] shadow-2xl xl:relative xl:h-full xl:max-w-none xl:border-l xl:border-[color:var(--account-line)] xl:shadow-none">
                        <div className="border-b border-[color:var(--account-line)] bg-[color:var(--account-surface)] px-6 py-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Bestilling</p>
                                    <h2 className="mt-1 text-2xl tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
                                        {customer.displayName || customer.companyName}
                                    </h2>
                                    <p className="mt-1 text-sm text-neutral-500">
                                        {orderLineCount} varetypar · {orderItemCount} einingar · {formatB2BPriceExVat(orderSubtotal)}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsOrderOpen(false)}
                                    className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm transition hover:bg-neutral-50 xl:hidden"
                                >
                                    Lukk
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5">
                            {orderLines.length ? (
                                <div className="space-y-6">
                                    {([
                                        ["Valldal Safteri", orderGroups.safteri, "text-rose-700"],
                                        ["Valldal Bryggeri", orderGroups.bryggeri, "text-amber-700"],
                                    ] as const).map(([title, lines, colorClass]) => {
                                        if (!lines.length) return null;

                                        const subtotal = lines.reduce(
                                            (sum, line) => sum + line.quantity * line.unitPrice,
                                            0
                                        );

                                        return (
                                            <div key={title}>
                                                <div className={`mb-3 text-xs font-semibold uppercase tracking-[0.18em] ${colorClass}`}>
                                                    {title}
                                                </div>

                                                <div className="space-y-3">
                                                    {lines.map((line) => (
                                                        <div key={getLineKey(line.productId, line.variantId)} className="rounded-[18px] border border-neutral-200 bg-white p-4">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div>
                                                                    <div className="font-medium text-neutral-900">{line.productName}</div>
                                                                    <div className="mt-1 text-xs text-neutral-500">
                                                                        {[line.category, line.variantLabel]
                                                                            .filter(Boolean)
                                                                            .join(" / ")}
                                                                    </div>
                                                                    {getOrderLineCaseBreakdown(line) ? (
                                                                        <div className="mt-1 text-xs text-neutral-500">
                                                                            {getOrderLineCaseBreakdown(line)}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                                <div className="text-right text-sm font-medium">
                                                                    {formatB2BPriceExVat(line.quantity * line.unitPrice)}
                                                                </div>
                                                            </div>
                                                            <div className="mt-3 flex items-center justify-between gap-3">
                                                                <div className="text-xs text-neutral-500">
                                                                    {formatB2BPriceExVat(line.unitPrice)} per eining
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateOrderLineQuantity(line.productId, line.variantId, line.quantity - 1)}
                                                                        className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-sm hover:bg-neutral-50"
                                                                    >
                                                                        −
                                                                    </button>

                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        value={line.quantity}
                                                                        onChange={(e) =>
                                                                            updateOrderLineQuantity(
                                                                                line.productId,
                                                                                line.variantId,
                                                                                Math.max(0, Math.floor(Number(e.target.value) || 0))
                                                                            )
                                                                        }
                                                                        className="w-16 rounded-[10px] border border-neutral-200 bg-white px-2 py-1 text-center text-sm outline-none [appearance:textfield] focus:border-neutral-800 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                                    />

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateOrderLineQuantity(line.productId, line.variantId, line.quantity + 1)}
                                                                        className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-sm hover:bg-neutral-50"
                                                                    >
                                                                        +
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateOrderLineQuantity(line.productId, line.variantId, 0)}
                                                                        className="ml-2 text-xs text-neutral-500 underline-offset-4 hover:underline"
                                                                    >
                                                                        Fjern
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="mt-3 text-right text-sm font-medium text-neutral-700">
                                                    Delsum: {formatB2BPriceExVat(subtotal)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="rounded-[18px] border border-neutral-200 bg-white p-5 text-sm text-neutral-600">
                                    Ingen produkt er lagt til enno.
                                </div>
                            )}
                        </div>

                        <div className="border-t border-[color:var(--account-line)] bg-[color:var(--account-surface)] px-6 py-5">
                            <div className="mb-4 flex items-center justify-between text-sm">
                                <span className="text-neutral-600">Sum</span>
                                <span className="font-medium text-neutral-900">{formatB2BPriceExVat(orderSubtotal)}</span>
                            </div>
                            {customer?.sandboxEnabled ? (
                                <label className="mb-4 flex items-start gap-3 rounded-[14px] border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
                                    <input
                                        type="checkbox"
                                        checked={sendSandboxEmails}
                                        onChange={(event) => setSendSandboxEmails(event.target.checked)}
                                        className="mt-0.5 h-4 w-4"
                                    />
                                    <span>
                                        Send test-e-post til meg
                                        <span className="mt-1 block text-xs text-violet-700">E-post er elles slått av for sandbox-ordrar.</span>
                                    </span>
                                </label>
                            ) : null}
                            <button
                                type="button"
                                onClick={submitOrder}
                                disabled={!orderLines.length || submittingOrder}
                                className="w-full rounded-full bg-[color:var(--account-accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--account-accent-hover)] disabled:opacity-50"
                            >
                                {submittingOrder ? "Sender …" : "Send bestilling"}
                            </button>
                            {orderLines.length ? (
                                <button
                                    type="button"
                                    onClick={clearOrder}
                                    className="mt-3 w-full rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"
                                >
                                    Tøm bestilling
                                </button>
                            ) : null}
                            <p className="mt-3 text-center text-xs text-neutral-500">
                                Prisane blir viste eks. mva. for innlogga B2B-kundar.
                            </p>
                        </div>
                    </aside>
            </div>
        </main>
    );
}
