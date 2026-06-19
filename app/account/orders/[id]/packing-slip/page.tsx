"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDocs, limit, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import PackingSlipDocument from "@/app/components/orders/PackingSlipDocument";

type OrderLine = {
    productId: string;
    productName: string;
    variantId: string;
    variantLabel: string;
    brand: "safteri" | "bryggeri";
    category?: string | null;
    subcategory?: string | null;
    categoryName?: string | null;
    subcategoryName?: string | null;
    quantity: number;
    unitPrice: number;
};

type PackingLine = {
    productId: string;
    variantId: string;
    orderedQuantity?: number | null;
    packedQuantity: number | null;
    missingQuantity?: number | null;
};

type CustomerOrder = {
    id: string;
    orderNumber: string | null;
    customerId: string;
    customerName: string;
    customerDisplayName: string;
    customerCompanyName: string;
    customerContactName: string;
    customerEmail: string;
    customerPhone: string;
    organizationNumber: string;
    signatureUrl?: string | null;
    signedAt?: string | null;
    signedBy?: string | null;
    deliveryType?: "delivered" | "picked_up" | null;
    customerType: string;
    approvalResponse?: string | null;
    totalExVat: number;
    packingLines: PackingLine[];
    lines: OrderLine[];
    createdAtLabel: string;
};

type AccountCustomer = {
    id: string;
};

async function fetchCustomerByAuthUid(authUid: string): Promise<AccountCustomer | null> {
    const snapshot = await getDocs(
        query(collection(db, "customers"), where("authUid", "==", authUid), limit(1))
    );

    const docSnap = snapshot.docs[0];

    if (!docSnap) {
        return null;
    }

    return {
        id: docSnap.id,
    };
}

function formatDate(value: any) {
    if (value?.toDate) {
        return value.toDate().toLocaleDateString("nb-NO", {
            dateStyle: "medium",
        });
    }

    return "—";
}

function mapOrder(id: string, data: any): CustomerOrder {
    const customerCompanyName =
        typeof data.customerCompanyName === "string" && data.customerCompanyName.trim()
            ? data.customerCompanyName
            : typeof data.customerName === "string"
                ? data.customerName
                : "";

    const customerDisplayName =
        typeof data.customerDisplayName === "string" && data.customerDisplayName.trim()
            ? data.customerDisplayName
            : customerCompanyName;

    return {
        id,
        orderNumber: data.orderNumber ?? null,
        customerId: data.customerId ?? "",
        customerName: customerDisplayName,
        customerDisplayName,
        customerCompanyName,
        customerContactName: typeof data.customerContactName === "string" ? data.customerContactName : "",
        customerEmail: data.customerEmail ?? "",
        customerPhone: typeof data.customerPhone === "string" ? data.customerPhone : "",
        organizationNumber: typeof data.organizationNumber === "string" ? data.organizationNumber : "",
        signatureUrl:
            typeof data.deliverySignature?.signatureDataUrl === "string"
                ? data.deliverySignature.signatureDataUrl
                : null,
        signedAt: data.deliverySignature?.signedAt ? formatDate(data.deliverySignature.signedAt) : null,
        signedBy:
            typeof data.deliverySignature?.signedBy === "string"
                ? data.deliverySignature.signedBy
                : null,
        deliveryType:
            data.deliverySignature?.deliveryType === "picked_up"
                ? "picked_up"
                : data.deliverySignature?.deliveryType === "delivered"
                    ? "delivered"
                    : null,
        customerType: data.customerType ?? "",
        approvalResponse:
            typeof data.approval?.response === "string"
                ? data.approval.response
                : null,
        totalExVat: typeof data.totalExVat === "number" ? data.totalExVat : 0,
        packingLines: Array.isArray(data.packing?.lines) ? data.packing.lines : [],
        lines: Array.isArray(data.lines) ? data.lines : [],
        createdAtLabel: formatDate(data.createdAt),
    };
}

function getPackingLine(order: CustomerOrder, line: OrderLine) {
    return order.packingLines.find(
        (item) => item.productId === line.productId && item.variantId === line.variantId
    );
}

function getPackedQuantity(order: CustomerOrder, line: OrderLine) {
    const match = getPackingLine(order, line);
    return typeof match?.packedQuantity === "number" ? match.packedQuantity : 0;
}

function getMissingQuantity(order: CustomerOrder, line: OrderLine) {
    const match = getPackingLine(order, line);

    if (typeof match?.missingQuantity === "number") {
        return match.missingQuantity;
    }

    return Math.max(0, line.quantity - getPackedQuantity(order, line));
}

function deliveredLines(order: CustomerOrder) {
    return order.lines.filter((line) => getPackedQuantity(order, line) > 0);
}

export default function AccountPackingSlipPage() {
    const params = useParams();
    const [user, setUser] = useState<User | null>(null);
    const [customerId, setCustomerId] = useState<string | null>(null);
    const [order, setOrder] = useState<CustomerOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
            setUser(nextUser);
            setCustomerId(null);

            if (!nextUser) {
                setLoading(false);
                return;
            }

            fetchCustomerByAuthUid(nextUser.uid)
                .then((customer) => {
                    if (!customer) {
                        setError("Fann ikkje kundekontoen din.");
                        setLoading(false);
                        return;
                    }

                    setCustomerId(customer.id);
                })
                .catch((err) => {
                    console.error(err);
                    setError("Kunne ikkje hente kundekontoen din.");
                    setLoading(false);
                });
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!user || !customerId || !params?.id) return;
        setLoading(true);
        const ref = doc(db, "orders", params.id as string);
        const unsubscribe = onSnapshot(
            ref,
            (docSnap) => {
                if (!docSnap.exists()) {
                    setError("Fant ikkje bestillinga.");
                    setOrder(null);
                    setLoading(false);
                    return;
                }
                const data = docSnap.data();
                const nextOrder = mapOrder(docSnap.id, data);

                if (nextOrder.customerId !== customerId) {
                    setError("Du har ikkje tilgang til denne bestillinga.");
                    setOrder(null);
                    setLoading(false);
                    return;
                }

                setOrder(nextOrder);
                setError(null);
                setLoading(false);
            },
            (err) => {
                setError("Klarte ikkje hente bestillinga.");
                setOrder(null);
                setLoading(false);
            }
        );
        return () => unsubscribe();
    }, [user, customerId, params?.id]);

    const unauthorized = !user;

    if (loading) {
        return (
            <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
                <div className="mx-auto max-w-4xl px-6 py-10 text-sm text-neutral-600">
                    Hentar følgeseddel …
                </div>
            </main>
        );
    }

    if (error || unauthorized || !order) {
        return (
            <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
                <div className="mx-auto max-w-4xl px-6 py-10">
                    <Link href="/account/orders" className="text-sm text-neutral-600 underline-offset-4 hover:underline">
                        ← Tilbake til bestillingar
                    </Link>
                    <div className="mt-6 rounded-[24px] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                        {unauthorized
                            ? "Du har ikkje tilgang til denne bestillinga."
                            : error || "Logg inn for å sjå følgeseddel."}
                    </div>
                </div>
            </main>
        );
    }

    const visibleLines = deliveredLines(order);
    const packingSlipLines = visibleLines.map((line) => ({
        ...line,
        packedQuantity: getPackedQuantity(order, line),
        missingQuantity: getMissingQuantity(order, line),
    }));

    return (
        <main className="min-h-screen bg-[#f7f5f1] text-neutral-900 print:bg-white">
            <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 print:max-w-none print:px-0 print:py-0">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
                    <Link
                        href={`/account/orders/${order.id}`}
                        className="text-sm text-neutral-600 underline-offset-4 hover:underline"
                    >
                        ← Tilbake til bestilling
                    </Link>

                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"
                    >
                        Skriv ut / lagre som PDF
                    </button>
                </div>

                {packingSlipLines.length ? (
                    <PackingSlipDocument
                        order={{
                            orderNumber: order.orderNumber || "Ordrenummer kjem",
                            customerName: order.customerDisplayName || order.customerName || "—",
                            customerCompanyName: order.customerCompanyName,
                            customerContactName: order.customerContactName,
                            customerEmail: order.customerEmail,
                            customerPhone: order.customerPhone,
                            organizationNumber: order.organizationNumber,
                            signatureUrl: order.signatureUrl,
                            signedAt: order.signedAt,
                            signedBy: order.signedBy,
                            deliveryType: order.deliveryType,
                            missingLinesDisposition:
                                order.approvalResponse === "deliver_partial_cancel_rest"
                                    ? "cancelled"
                                    : order.approvalResponse === "wait_for_complete"
                                        ? "waiting_for_stock"
                                        : "backorder",
                            createdAt: order.createdAtLabel,
                            lines: packingSlipLines,
                        }}
                        footerText="Følgeseddelen viser varene som er registrerte som pakka og sendt frå Valldal Safteri."
                    />
                ) : (
                    <div className="rounded-[24px] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500 shadow-sm">
                        Ingen varer er registrerte som pakka enno.
                    </div>
                )}
            </div>
        </main>
    );
}