"use client";

import { useParams, useRouter } from "next/navigation";
import OrderDeliveryDialog from "@/app/components/admin/OrderDeliveryDialog";

export default function OrderSignaturePage() {
    const params = useParams();
    const router = useRouter();
    const orderId = typeof params.id === "string" ? params.id : "";
    const returnToOrder = () => router.push(`/admin/orders/${orderId}`);

    return (
        <main className="min-h-screen bg-[#f7f5f1] px-4 py-8 text-neutral-900 md:px-6">
            <OrderDeliveryDialog orderId={orderId} onClose={returnToOrder} onComplete={returnToOrder} />
        </main>
    );
}
