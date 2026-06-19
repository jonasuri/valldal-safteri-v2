"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import OrderConfirmationDocument from "@/app/components/orders/OrderConfirmationDocument";

type OrderLine = {
    productId: string;
    productName: string;
    variantId: string;
    variantLabel: string;
    quantity: number;
    unitPrice: number;
    lineTotalExVat?: number;
};

type OrderConfirmation = {
    id: string;
    orderNumber: string;
    customerName: string;
    customerDisplayName: string;
    customerCompanyName: string;
    customerContactName: string;
    customerEmail: string;
    customerPhone: string;
    organizationNumber: string;
    createdAt: string;
    lines: OrderLine[];
    totalExVat: number;
};

function formatDate(value: any) {
    if (!value?.toDate) return "—";
    return value.toDate().toLocaleDateString("nb-NO");
}

function mapOrder(id: string, data: any): OrderConfirmation {
    const customerCompanyName =
        typeof data.customerCompanyName === "string" && data.customerCompanyName.trim()
            ? data.customerCompanyName
            : typeof data.customerName === "string"
                ? data.customerName
                : "Ukjend kunde";

    const customerDisplayName =
        typeof data.customerDisplayName === "string" && data.customerDisplayName.trim()
            ? data.customerDisplayName
            : customerCompanyName;

    return {
        id,
        orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : id.slice(0, 8).toUpperCase(),
        customerName: customerDisplayName,
        customerDisplayName,
        customerCompanyName,
        customerContactName: typeof data.customerContactName === "string" ? data.customerContactName : "",
        customerEmail: typeof data.customerEmail === "string" ? data.customerEmail : "",
        customerPhone: typeof data.customerPhone === "string" ? data.customerPhone : "",
        organizationNumber: typeof data.organizationNumber === "string" ? data.organizationNumber : "",
        createdAt: formatDate(data.createdAt),
        lines: Array.isArray(data.lines) ? data.lines : [],
        totalExVat: typeof data.totalExVat === "number" ? data.totalExVat : 0,
    };
}

export default function AdminOrderConfirmationPage() {
    const params = useParams();
    const orderId = typeof params.id === "string" ? params.id : "";
    const [order, setOrder] = useState<OrderConfirmation | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!orderId) return;

        const unsubscribe = onSnapshot(doc(db, "orders", orderId), (snapshot) => {
            if (!snapshot.exists()) {
                setOrder(null);
                setLoading(false);
                return;
            }

            setOrder(mapOrder(snapshot.id, snapshot.data()));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [orderId]);

    if (loading) {
        return (
            <main className="min-h-screen bg-neutral-50 px-4 py-10 text-neutral-900">
                <div className="mx-auto max-w-4xl text-sm text-neutral-500">Laster ordrebekreftelse …</div>
            </main>
        );
    }

    if (!order) {
        return (
            <main className="min-h-screen bg-neutral-50 px-4 py-10 text-neutral-900">
                <div className="mx-auto max-w-4xl rounded-[24px] border border-neutral-200 bg-white p-8">
                    <h1 className="text-xl font-medium">Fann ikkje ordre</h1>
                    <Link href="/admin/orders" className="mt-4 inline-flex text-sm font-medium underline">
                        Tilbake til ordre
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-neutral-50 px-4 py-8 text-neutral-900 print:bg-white print:px-0 print:py-0">
            <div className="mx-auto max-w-4xl print:max-w-none">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
                    <Link
                        href={`/admin/orders/${order.id}`}
                        className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                    >
                        ← Tilbake til ordre
                    </Link>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                    >
                        Skriv ut / lag PDF
                    </button>
                </div>

                <OrderConfirmationDocument
                    order={order}
                    footerText="Dette dokumentet er henta frå adminsystemet. Ved avvik er det registrerte ordregrunnlaget i systemet gjeldande."
                />
            </div>
        </main>
    );
}