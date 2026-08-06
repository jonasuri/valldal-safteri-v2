import type { User } from "firebase/auth";

type InternalOrderEvent = "new_order" | "change_request" | "approval_response";

export async function notifyInternalOrder({
    user,
    orderId,
    event,
    message,
}: {
    user: User;
    orderId: string;
    event: InternalOrderEvent;
    message?: string;
}) {
    try {
        const token = await user.getIdToken();
        const response = await fetch("/api/internal/order-notification", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ orderId, event, message }),
        });
        if (!response.ok) throw new Error(`ORDER_NOTIFICATION_${response.status}`);
    } catch (error) {
        // Ordren eller kundesvaret er allereie lagra. E-postfeil skal ikkje stoppe kunden.
        console.error("Kunne ikkje sende internt ordrevarsel", error);
    }
}
