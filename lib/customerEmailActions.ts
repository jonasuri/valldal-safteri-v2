import type { User } from "firebase/auth";
import type { OrderStatus } from "@/lib/ordersFirestore";
import { requireActiveOperator } from "@/lib/adminOperators";

async function post(url: string, user: User, body: Record<string, unknown>) {
    const token = await user.getIdToken();
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error || `REQUEST_${response.status}`);
    }
    return response.json();
}

export function sendAutomaticOrderConfirmation(user: User, orderId: string) {
    return post("/api/account/order-confirmation", user, { orderId });
}
export function sendAdminCustomerEmail(user: User, orderId: string, type: "confirmation" | "approval" | "packing_slip") {
    return post("/api/admin/orders/customer-email", user, { orderId, type });
}
export function setAdminOrderStatus(user: User, orderId: string, status: OrderStatus) {
    return post("/api/admin/orders/status", user, { orderId, status, operator: requireActiveOperator() });
}
export function confirmAdminOrder(user: User, orderId: string) {
    return post("/api/admin/orders/confirm", user, { orderId, operator: requireActiveOperator() });
}
export function registerAdminApproval(
    user: User,
    orderId: string,
    response: "deliver_partial_later" | "deliver_partial_cancel_rest" | "wait_for_complete",
    responseSource: "phone" | "email" | "in_person" | "other",
    adminNote: string,
) {
    return post("/api/admin/orders/approval", user, {
        orderId,
        response,
        responseSource,
        adminNote,
        operator: requireActiveOperator(),
    });
}
