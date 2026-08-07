
// NEW FILE CONTENT BELOW

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { CustomerType } from "@/lib/customersFirestore";
import {
    fetchB2BProducts,
    formatB2BPriceExVat,
    getB2BVariantPrice,
    hasB2BVariantPrice,
    type B2BProduct,
    type B2BProductBrand,
    type B2BVariant,
} from "@/lib/productsB2B";
import { createOrder } from "@/lib/ordersFirestore";
import { sendAdminCustomerEmail } from "@/lib/customerEmailActions";
import { groupOrderLinesByBrand } from "@/lib/orderLineSorting";
import ProductOrderPicker, { type ProductOrderLine } from "../../../components/admin/ProductOrderPicker";

type BrandFilter = "alle" | B2BProductBrand;

type ManualOrderLine = {
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

type ManualCustomer = {
    id: string;
    companyName: string;
    displayName: string;
    sameAsCompanyName: boolean;
    contactName: string;
    email: string;
    phone: string;
    organizationNumber: string;
    customerType: CustomerType;
    customerSource: "registered" | "manual";
    authUid: string;
};

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
        if (weightDiff !== 0) return weightDiff;
        return a.name.localeCompare(b.name, "nb");
    });
}

function getProductGroupLabel(product: B2BProduct) {
    return `${brandLabel(product.brand)} · ${product.category || "Anna"}`;
}

function getGroupStyles(label: string) {
    if (label.startsWith("Safteri")) {
        return {
            card: "border-rose-100 bg-rose-50/40",
            text: "text-rose-700",
        };
    }

    return {
        card: "border-amber-100 bg-amber-50/40",
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

function formatCurrency(value: number) {
    return new Intl.NumberFormat("nb-NO", {
        style: "currency",
        currency: "NOK",
        maximumFractionDigits: 2,
    }).format(value);
}

export default function NewManualOrderPage() {
    const router = useRouter();
    const [products, setProducts] = useState<B2BProduct[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [customers, setCustomers] = useState<ManualCustomer[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [customerSearch, setCustomerSearch] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [customerName, setCustomerName] = useState("");
    const [customerDisplayName, setCustomerDisplayName] = useState("");
    const [sameAsCompanyName, setSameAsCompanyName] = useState(true);
    const [customerContactName, setCustomerContactName] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [organizationNumber, setOrganizationNumber] = useState("");
    const [customerType, setCustomerType] = useState<CustomerType>("retail");
    const [note, setNote] = useState("");

    const [queryText, setQueryText] = useState("");
    const [brandFilter, setBrandFilter] = useState<BrandFilter>("alle");
    const [lines, setLines] = useState<ProductOrderLine[]>([]);

    useEffect(() => {
        async function loadProducts() {
            try {
                setLoadingProducts(true);
                setError(null);
                const nextProducts = await fetchB2BProducts();
                setProducts(nextProducts.filter((product) => product.active));
            } catch (err) {
                console.error(err);
                setError("Kunne ikkje hente produkt.");
            } finally {
                setLoadingProducts(false);
            }
        }

        void loadProducts();
    }, []);

    useEffect(() => {
        async function loadCustomers() {
            try {
                setLoadingCustomers(true);
                const snapshot = await getDocs(query(collection(db, "customers"), orderBy("companyName", "asc")));

                setCustomers(
                    snapshot.docs.map((docSnap) => {
                        const data = docSnap.data() as any;
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
                            email: typeof data.email === "string" ? data.email : "",
                            phone: typeof data.phone === "string" ? data.phone : "",
                            organizationNumber: typeof data.organizationNumber === "string" ? data.organizationNumber : "",
                            customerType: data.customerType === "grossist" ? "grossist" : "retail",
                            customerSource: data.customerSource === "manual" ? "manual" : "registered",
                            authUid: typeof data.authUid === "string" ? data.authUid : "",
                        } satisfies ManualCustomer;
                    })
                );
            } catch (err) {
                console.error(err);
                setError("Kunne ikkje hente kunderegisteret.");
            } finally {
                setLoadingCustomers(false);
            }
        }

        void loadCustomers();
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
                    variant.label.toLowerCase().includes(q) || variant.sku.toLowerCase().includes(q)
                )
            );
        });
    }, [products, queryText, brandFilter]);

    const groupedProducts = useMemo(
        () => groupProductsByCategory(sortProducts(filteredProducts)),
        [filteredProducts]
    );

    const filteredCustomers = useMemo(() => {
        const q = customerSearch.trim().toLowerCase();
        if (!q) return customers.slice(0, 8);

        return customers
            .filter((customer) =>
                customer.displayName.toLowerCase().includes(q) ||
                customer.companyName.toLowerCase().includes(q) ||
                customer.contactName.toLowerCase().includes(q) ||
                customer.email.toLowerCase().includes(q) ||
                customer.phone.toLowerCase().includes(q) ||
                customer.organizationNumber.toLowerCase().includes(q)
            )
            .slice(0, 8);
    }, [customers, customerSearch]);


    const groupedLines = useMemo(
        () => groupOrderLinesByBrand(lines as ManualOrderLine[]),
        [lines]
    );
    const totalExVat = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const unitCount = lines.reduce((sum, line) => sum + line.quantity, 0);


    function selectCustomer(customer: ManualCustomer) {
        setSelectedCustomerId(customer.id);
        setCustomerName(customer.companyName);
        setCustomerDisplayName(customer.displayName || customer.companyName);
        setSameAsCompanyName(customer.sameAsCompanyName);
        setCustomerContactName(customer.contactName);
        setCustomerEmail(customer.email);
        setCustomerPhone(customer.phone);
        setOrganizationNumber(customer.organizationNumber);
        setCustomerType(customer.customerType);
        setCustomerSearch(customer.displayName || customer.companyName);
    }

    function clearSelectedCustomer() {
        setSelectedCustomerId(null);
        setCustomerName("");
        setCustomerDisplayName("");
        setSameAsCompanyName(true);
        setCustomerContactName("");
        setCustomerEmail("");
        setCustomerPhone("");
        setOrganizationNumber("");
        setCustomerSearch("");
    }

    function updateCustomerSearch(value: string) {
        if (selectedCustomerId) {
            setSelectedCustomerId(null);
            setCustomerName("");
            setCustomerDisplayName("");
            setSameAsCompanyName(true);
            setCustomerContactName("");
            setCustomerEmail("");
            setCustomerPhone("");
            setOrganizationNumber("");
        }
        setCustomerSearch(value);
    }

    function updateCustomerName(value: string) {
        setCustomerName(value);
        if (sameAsCompanyName) {
            setCustomerDisplayName(value);
        }
    }

    function updateSameAsCompanyName(value: boolean) {
        setSameAsCompanyName(value);
        if (value) {
            setCustomerDisplayName(customerName);
        }
    }

    function updateOrderLineQuantity(productId: string, variantId: string, quantity: number) {
        setLines((currentLines) =>
            currentLines
                .map((line) =>
                    line.productId === productId && line.variantId === variantId
                        ? { ...line, quantity }
                        : line
                )
                .filter((line) => line.quantity > 0)
        );
    }

    async function createManualCustomer() {
        const companyName = customerName.trim();
        const displayName = sameAsCompanyName ? companyName : customerDisplayName.trim();
        const customerRef = await addDoc(collection(db, "customers"), {
            companyName,
            displayName,
            sameAsCompanyName,
            contactName: customerContactName.trim(),
            email: customerEmail.trim(),
            phone: customerPhone.trim(),
            organizationNumber: organizationNumber.trim(),
            openingHours: "",
            authUid: "",
            customerSource: "manual",
            customerType,
            active: true,
            profileCompleted: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        return customerRef.id;
    }

    async function saveOrder() {
        const companyName = customerName.trim();
        const displayName = sameAsCompanyName ? companyName : customerDisplayName.trim();

        if (!companyName) {
            setError("Skriv inn firmanamn/fakturanamn.");
            return;
        }

        if (!displayName) {
            setError("Skriv inn visningsnamn når det ikkje er same som firmanamn.");
            return;
        }

        if (!lines.length) {
            setError("Legg til minst éi varelinje.");
            return;
        }

        try {
            setSaving(true);
            setError(null);
            const customerId = selectedCustomerId ?? (await createManualCustomer());

            const orderId = await createOrder({
                customerId,
                customerName: displayName,
                customerDisplayName: displayName,
                customerCompanyName: companyName,
                customerEmail: customerEmail.trim(),
                customerType,
                customerPhone: customerPhone.trim(),
                customerContactName: customerContactName.trim(),
                organizationNumber: organizationNumber.trim(),
                source: "manual",
                note: note.trim(),
                lines: lines.map((line) => ({
                    productId: line.productId,
                    productName: line.productName,
                    variantId: line.variantId,
                    variantLabel: line.variantLabel,
                    brand: line.brand,
                    category: line.category,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                })),
                totalExVat,
                lineCount: lines.length,
                unitCount,
            });

            if (customerEmail.trim() && auth.currentUser) {
                await sendAdminCustomerEmail(auth.currentUser, orderId, "confirmation").catch((emailError) => {
                    console.error("Kunne ikkje sende automatisk ordrebekrefting for manuell ordre", emailError);
                });
            }

            router.push(`/admin/orders/${orderId}`);
        } catch (err) {
            console.error(err);
            setError("Kunne ikkje opprette ordre.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className="min-h-screen text-[color:var(--admin-ink)]">
            <div className="mx-auto max-w-7xl px-5 py-7 md:px-8 md:py-12">
                <header className="border-b border-[color:var(--admin-line)] pb-8">
                    <div>
                        <Link
                            href="/admin/orders"
                            className="text-xs font-medium text-[color:var(--admin-muted)] underline-offset-4 hover:text-[color:var(--admin-ink)] hover:underline"
                        >
                            ← Tilbake til ordre
                        </Link>
                        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--admin-muted)]">Ny ordre</p>
                        <h1 className="mt-2 text-3xl tracking-tight md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>Registrer manuell ordre</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--admin-muted)]">
                            For bestillingar som kjem på telefon, e-post eller direkte. Vel kunde, legg til varer og kontroller samandraget før ordren blir oppretta.
                        </p>
                    </div>
                </header>

                {error ? (
                    <div className="mt-6 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                        {error}
                    </div>
                ) : null}

                <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_0.8fr]">
                    <div className="space-y-6">
                        <section className="rounded-[22px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:p-6">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-muted)]">Steg 1</p>
                            <h2 className="mt-1 text-lg font-semibold tracking-tight">Vel kunde</h2>
                            <p className="mt-1 text-sm text-[color:var(--admin-muted)]">
                                Søk først i kunderegisteret. Dersom kunden ikkje finst, kan du opprette ein manuell kunde her.
                            </p>
                            <div className="mt-5 rounded-[16px] border border-[color:var(--admin-line)] bg-black/[0.018] p-4">
                                <label className="block">
                                    <span className="text-sm font-medium">Søk i kunderegister</span>
                                    <input
                                        type="search"
                                        value={customerSearch}
                                        onChange={(event) => updateCustomerSearch(event.target.value)}
                                        placeholder="Søk namn, kontaktperson, e-post, telefon eller org.nr."
                                        className="mt-2 w-full rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm outline-none focus:border-neutral-500"
                                    />
                                </label>

                                {selectedCustomerId ? (
                                    <div className="mt-3 flex items-center justify-between gap-3 rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                        <span>Vald kunde frå kunderegisteret</span>
                                        <button
                                            type="button"
                                            onClick={clearSelectedCustomer}
                                            className="font-medium underline-offset-4 hover:underline"
                                        >
                                            Tøm
                                        </button>
                                    </div>
                                ) : customerSearch.trim() ? (
                                    <div className="mt-3 space-y-2">
                                        {loadingCustomers ? (
                                            <div className="text-sm text-neutral-500">Søkjer i kunderegister …</div>
                                        ) : filteredCustomers.length ? (
                                            filteredCustomers.map((customer) => (
                                                <button
                                                    key={customer.id}
                                                    type="button"
                                                    onClick={() => selectCustomer(customer)}
                                                    className="block w-full rounded-[14px] border border-neutral-200 bg-white px-3 py-2 text-left text-sm transition hover:bg-neutral-50"
                                                >
                                                    <div className="font-medium text-neutral-900">
                                                        {customer.displayName || customer.companyName || "Utan namn"}
                                                    </div>
                                                    {customer.displayName && customer.displayName !== customer.companyName ? (
                                                        <div className="mt-1 text-xs text-neutral-500">
                                                            Fakturerast til: {customer.companyName}
                                                        </div>
                                                    ) : null}
                                                    <div className="mt-1 text-xs text-neutral-500">
                                                        {[customer.contactName, customer.email, customer.phone]
                                                            .filter(Boolean)
                                                            .join(" · ") || "Ingen kontaktinfo"}
                                                    </div>
                                                    <div className="mt-1 text-xs text-neutral-400">
                                                        {customer.customerSource === "manual" || !customer.authUid
                                                            ? "Manuell kunde"
                                                            : "Kundekonto"}
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="text-sm text-neutral-500">
                                                Ingen treff. Fyll ut felta under, så blir kunden lagra som manuell kunde når ordren blir oppretta.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="mt-3 text-sm text-neutral-500">
                                        Søk opp eksisterande kunde, eller fyll ut ny kunde manuelt under.
                                    </p>
                                )}
                            </div>

                            <div className="mt-5 grid gap-4 md:grid-cols-2">
                                <label className="block">
                                    <span className="text-sm font-medium">Firmanamn / fakturanamn *</span>
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(event) => updateCustomerName(event.target.value)}
                                        className="mt-2 w-full rounded-[12px] border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                                    />
                                </label>
                                <div className="space-y-2 rounded-[12px] border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-800 md:col-span-2">
                                    <label className="flex items-start gap-3 font-medium">
                                        <input
                                            type="checkbox"
                                            checked={sameAsCompanyName}
                                            onChange={(event) => updateSameAsCompanyName(event.target.checked)}
                                            disabled={!!selectedCustomerId}
                                            className="mt-1 h-4 w-4 disabled:opacity-50"
                                        />
                                        <span>
                                            Visningsnamn er same som firmanamn
                                            <span className="mt-1 block text-xs font-normal text-neutral-500">
                                                Avhuk berre dersom kunden bestiller som butikk/profilnamn, men skal fakturerast til eit anna firmanamn.
                                            </span>
                                        </span>
                                    </label>

                                    <label className="block space-y-1 text-sm font-medium text-neutral-800">
                                        Visningsnamn / butikknamn
                                        <input
                                            type="text"
                                            value={customerDisplayName}
                                            onChange={(event) => setCustomerDisplayName(event.target.value)}
                                            disabled={sameAsCompanyName || !!selectedCustomerId}
                                            className="w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-500 disabled:bg-neutral-100 disabled:text-neutral-500"
                                            placeholder="T.d. Bunnpris Valldal"
                                        />
                                        <span className="block text-xs font-normal text-neutral-500">
                                            Dette blir brukt i ordreoversikt og plukking. Fakturering brukar firmanamn/fakturanamn.
                                        </span>
                                    </label>
                                </div>

                                <label className="block">
                                    <span className="text-sm font-medium">Prisgruppe</span>
                                    <select
                                        value={customerType}
                                        onChange={(event) => setCustomerType(event.target.value as CustomerType)}
                                        className="mt-2 w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500"
                                    >
                                        <option value="retail">Retail</option>
                                        <option value="grossist">Grossist</option>
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-medium">Kontaktperson</span>
                                    <input
                                        type="text"
                                        value={customerContactName}
                                        onChange={(event) => setCustomerContactName(event.target.value)}
                                        className="mt-2 w-full rounded-[12px] border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-medium">E-post</span>
                                    <input
                                        type="email"
                                        value={customerEmail}
                                        onChange={(event) => setCustomerEmail(event.target.value)}
                                        className="mt-2 w-full rounded-[12px] border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-medium">Telefon</span>
                                    <input
                                        type="tel"
                                        value={customerPhone}
                                        onChange={(event) => setCustomerPhone(event.target.value)}
                                        className="mt-2 w-full rounded-[12px] border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-medium">Org.nr.</span>
                                    <input
                                        type="text"
                                        value={organizationNumber}
                                        onChange={(event) => setOrganizationNumber(event.target.value)}
                                        className="mt-2 w-full rounded-[12px] border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                                    />
                                </label>

                                <label className="block md:col-span-2">
                                    <span className="text-sm font-medium">Merknad</span>
                                    <textarea
                                        value={note}
                                        onChange={(event) => setNote(event.target.value)}
                                        rows={3}
                                        className="mt-2 w-full rounded-[12px] border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                                    />
                                </label>
                            </div>
                        </section>

                        <div>
                            <div className="mb-3 px-1">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-muted)]">Steg 2</p>
                                <h2 className="mt-1 text-lg font-semibold tracking-tight">Legg til varer</h2>
                            </div>
                            <ProductOrderPicker
                                customerType={customerType}
                                mode="create"
                                lines={lines}
                                onChange={setLines}
                                title="Produkt og mengde"
                                description={`Same produktliste som kunden brukar. Prisgruppe: ${customerTypeLabel(customerType)}.`}
                                showProductsBeforeSearch={true}
                            />
                        </div>
                    </div>

                    <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
                        <section className="rounded-[22px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 shadow-sm md:p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-muted)]">Steg 3</p>
                                    <h2 className="mt-1 text-lg font-semibold tracking-tight">Kontroller ordre</h2>
                                    <p className="mt-1 text-sm text-neutral-500">
                                        {selectedCustomerId ? "Manuell ordre · kunde frå register" : "Manuell ordre · ny manuell kunde"}
                                    </p>
                                </div>
                                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-600">
                                    Manuell
                                </span>
                            </div>

                            <div className="mt-5 space-y-5">
                                {([
                                    ["Valldal Safteri", groupedLines.safteri, "text-rose-700"],
                                    ["Valldal Bryggeri", groupedLines.bryggeri, "text-amber-700"],
                                ] as const).map(([title, groupLines, colorClass]) => {
                                    if (!groupLines.length) return null;

                                    return (
                                        <div key={title}>
                                            <div className={`mb-2 text-xs font-semibold uppercase tracking-[0.18em] ${colorClass}`}>
                                                {title}
                                            </div>
                                            <div className="space-y-2">
                                                {groupLines.map((line) => (
                                                    <div
                                                        key={`${line.productId}-${line.variantId}`}
                                                        className="rounded-[14px] border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <div className="font-medium text-neutral-900">{line.productName}</div>
                                                                <div className="mt-1 text-xs text-neutral-500">
                                                                    {[line.category, line.variantLabel].filter(Boolean).join(" / ")}
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateOrderLineQuantity(line.productId, line.variantId, 0)}
                                                                className="text-xs text-neutral-500 underline-offset-4 hover:underline"
                                                            >
                                                                Fjern
                                                            </button>
                                                        </div>
                                                        <div className="mt-3 flex items-center justify-between gap-3">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={line.quantity > 0 ? line.quantity : ""}
                                                                onChange={(event) => updateOrderLineQuantity(
                                                                    line.productId,
                                                                    line.variantId,
                                                                    Math.max(0, Math.floor(Number(event.target.value) || 0))
                                                                )}
                                                                className="w-20 rounded-[10px] border border-neutral-200 px-2 py-1 text-sm outline-none [appearance:textfield] focus:border-neutral-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                            />
                                                            <div className="text-right text-sm text-neutral-700">
                                                                {formatCurrency(line.quantity * line.unitPrice)} eks. mva.
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}

                                {!lines.length ? (
                                    <div className="rounded-[14px] border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
                                        Ingen varelinjer lagt til.
                                    </div>
                                ) : null}
                            </div>

                            <div className="mt-5 border-t border-neutral-200 pt-4 text-sm">
                                <div className="flex justify-between gap-4 text-neutral-600">
                                    <span>Varetypar</span>
                                    <span>{lines.length}</span>
                                </div>
                                <div className="mt-2 flex justify-between gap-4 text-neutral-600">
                                    <span>Einingar</span>
                                    <span>{unitCount}</span>
                                </div>
                                <div className="mt-3 flex justify-between gap-4 font-medium text-neutral-950">
                                    <span>Sum</span>
                                    <span>{formatCurrency(totalExVat)} eks. mva.</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={saveOrder}
                                disabled={saving || !customerName.trim() || !lines.length}
                                className="mt-5 w-full rounded-full bg-[color:var(--admin-accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--admin-accent-hover)] disabled:opacity-50"
                            >
                                {saving ? "Opprettar ordre …" : "Opprett ordre"}
                            </button>
                        </section>
                    </aside>
                </div>
            </div>
        </main>
    );
}
