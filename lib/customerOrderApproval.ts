import type { User } from "firebase/auth";
import type { ApprovalResponse } from "@/lib/ordersFirestore";

export async function submitCustomerOrderApproval({
    user,
    orderId,
    response,
}: {
    user: User;
    orderId: string;
    response: ApprovalResponse;
}) {
    const token = await user.getIdToken();
    const result = await fetch("/api/account/order-approval", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId, response }),
    });
    if (!result.ok) {
        const body = await result.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || `ORDER_APPROVAL_${result.status}`);
    }
}
