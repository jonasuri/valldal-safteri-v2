"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { sortOrderLines } from "@/lib/orderLineSorting";
import PackingSlipDocument from "@/app/components/orders/PackingSlipDocument";

type OrderLine = {
    productId: string;
    productName: string;
    variantId: string;
    variantLabel: string;
    quantity: number;
    unitPrice?: number;
    category?: string | null;
    subcategory?: string | null;
    categoryName?: string | null;
    subcategoryName?: string | null;
};

type PackingLine = {
    productId: string;
    variantId: string;
    orderedQuantity: number;
    packedQuantity: number | null;
    missingQuantity: number | null;
};

type PackingSlipLine = OrderLine & {
    packedQuantity: number;
    missingQuantity: number;
};

type PackingSlipOrder = {
    id: string;
    orderNumber: string;
    customerName: string;
    customerContactName: string;
    customerEmail: string;
    customerPhone: string;
    organizationNumber: string;
    signatureUrl?: string | null;
    signedAt?: string | null;
    signedBy?: string | null;
    deliveryType?: "delivered" | "picked_up" | null;
    approvalResponse?: string | null;
    createdAt: string;
    lines: PackingSlipLine[];
};

function formatDate(value: any) {
    if (!value?.toDate) return "—";
    return value.toDate().toLocaleDateString("nb-NO");
}

function getLineKey(line: { productId: string; variantId: string }) {
    return `${line.productId}-${line.variantId}`;
}

function sortLines(lines: PackingSlipLine[]) {
    return sortOrderLines(lines);
}

function mapOrder(id: string, data: any): PackingSlipOrder {
    const orderLines: OrderLine[] = Array.isArray(data.lines) ? data.lines : [];
    const packingLines: PackingLine[] = Array.isArray(data.packing?.lines) ? data.packing.lines : [];
    const packingByKey = new Map(packingLines.map((line) => [getLineKey(line), line]));

    const lines = orderLines.map((line) => {
        const packingLine = packingByKey.get(getLineKey(line));
        const packedQuantity =
            typeof packingLine?.packedQuantity === "number" ? packingLine.packedQuantity : line.quantity;
        const missingQuantity =
            typeof packingLine?.missingQuantity === "number"
                ? packingLine.missingQuantity
                : Math.max(0, line.quantity - packedQuantity);

        return {
            ...line,
            packedQuantity,
            missingQuantity,
        };
    });

    return {
        id,
        orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : id.slice(0, 8).toUpperCase(),
        customerName: typeof data.customerName === "string" ? data.customerName : "Ukjend kunde",
        customerContactName: typeof data.customerContactName === "string" ? data.customerContactName : "",
        customerEmail: typeof data.customerEmail === "string" ? data.customerEmail : "",
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
        approvalResponse:
            typeof data.approval?.response === "string"
                ? data.approval.response
                : null,
        createdAt: formatDate(data.createdAt),
        lines: sortLines(lines),
    };
}

export default function AdminPackingSlipPage() {
    const params = useParams();
    const orderId = typeof params.id === "string" ? params.id : "";
    const [order, setOrder] = useState<PackingSlipOrder | null>(null);
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
                <div className="mx-auto max-w-4xl text-sm text-neutral-500">Laster følgeseddel …</div>
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

                <PackingSlipDocument
                    order={{
                        ...order,
                        missingLinesDisposition:
                            order.approvalResponse === "deliver_partial_cancel_rest"
                                ? "cancelled"
                                : order.approvalResponse === "wait_for_complete"
                                    ? "waiting_for_stock"
                                    : "backorder",
                    }}
                    footerText="Dette dokumentet er henta frå adminsystemet. Ved avvik er det registrerte ordregrunnlaget i systemet gjeldande."
                />
            </div>
        </main>
    );
}
