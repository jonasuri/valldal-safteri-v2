"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDocs, limit, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import OrderConfirmationDocument from "@/app/components/orders/OrderConfirmationDocument";

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
    customerType: string;
    totalExVat: number;
    lineCount: number;
    unitCount: number;
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
        orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : null,
        customerId: typeof data.customerId === "string" ? data.customerId : "",
        customerName: customerDisplayName,
        customerDisplayName,
        customerCompanyName,
        customerContactName: typeof data.customerContactName === "string" ? data.customerContactName : "",
        customerEmail: typeof data.customerEmail === "string" ? data.customerEmail : "",
        customerPhone: typeof data.customerPhone === "string" ? data.customerPhone : "",
        organizationNumber: typeof data.organizationNumber === "string" ? data.organizationNumber : "",
        customerType: typeof data.customerType === "string" ? data.customerType : "",
        totalExVat: typeof data.totalExVat === "number" ? data.totalExVat : 0,
        lineCount: typeof data.lineCount === "number" ? data.lineCount : 0,
        unitCount: typeof data.unitCount === "number" ? data.unitCount : 0,
        lines: Array.isArray(data.lines) ? data.lines : [],
        createdAtLabel: formatDate(data.createdAt),
    };
}

export default function AccountOrderConfirmationPage() {
    const params = useParams();
    const orderId = typeof params.id === "string" ? params.id : "";
    const [user, setUser] = useState<User | null>(null);
    const [customerId, setCustomerId] = useState<string | null>(null);
    const [order, setOrder] = useState<CustomerOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
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

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user || !customerId || !orderId) return;

        const unsubscribe = onSnapshot(doc(db, "orders", orderId), (snapshot) => {
            if (!snapshot.exists()) {
                setError("Fann ikkje bestillinga.");
                setOrder(null);
                setLoading(false);
                return;
            }

            const nextOrder = mapOrder(snapshot.id, snapshot.data());

            if (nextOrder.customerId !== customerId) {
                setError("Du har ikkje tilgang til denne bestillinga.");
                setOrder(null);
                setLoading(false);
                return;
            }

            setOrder(nextOrder);
            setError("");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, customerId, orderId]);

    if (loading) {
        return (
            <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
                <div className="mx-auto max-w-4xl px-6 py-10 text-sm text-neutral-600">
                    Hentar ordrebekreftelse …
                </div>
            </main>
        );
    }

    if (!user || error || !order) {
        return (
            <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
                <div className="mx-auto max-w-4xl px-6 py-10">
                    <Link href="/account/orders" className="text-sm text-neutral-600 underline-offset-4 hover:underline">
                        ← Tilbake til bestillingar
                    </Link>
                    <div className="mt-6 rounded-[24px] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                        {error || "Logg inn for å sjå ordrebekreftelse."}
                    </div>
                </div>
            </main>
        );
    }

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

                <OrderConfirmationDocument
                    order={{
                        orderNumber: order.orderNumber || "Ordrenummer kjem",
                        customerName: order.customerDisplayName || order.customerName || "—",
                        customerCompanyName: order.customerCompanyName,
                        customerContactName: order.customerContactName,
                        customerEmail: order.customerEmail,
                        customerPhone: order.customerPhone,
                        organizationNumber: order.organizationNumber,
                        createdAt: order.createdAtLabel,
                        totalExVat: order.totalExVat,
                        lines: order.lines,
                    }}
                    footerText="Ordrebekreftelsen er basert på bestillinga slik ho vart sendt inn. Endeleg levering kan avvike dersom varer blir delpakka eller sett på restordre."
                />
            </div>
        </main>
    );
}