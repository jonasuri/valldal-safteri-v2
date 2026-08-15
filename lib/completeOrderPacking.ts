import type { User } from "firebase/auth";
import { requireActiveOperator } from "@/lib/adminOperators";

type PackingLine = {
    productId: string;
    variantId: string;
    orderedQuantity: number;
    packedQuantity: number | null;
    missingQuantity: number | null;
};

export async function completeOrderPacking({
    user,
    orderId,
    packingLines,
}: {
    user: User;
    orderId: string;
    packingLines: PackingLine[];
}) {
    const token = await user.getIdToken();
    const operator = requireActiveOperator();
    const response = await fetch("/api/admin/orders/complete-packing", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId, packingLines, operator }),
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || `COMPLETE_PACKING_${response.status}`);
    }
}
