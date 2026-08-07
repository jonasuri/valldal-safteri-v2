export const SANDBOX_USER_EMAIL = "jonassolvaguri@gmail.com";

const ADMIN_EMAILS = new Set([
    "post@valldalsafteri.no",
    SANDBOX_USER_EMAIL,
]);

export function isAdminEmail(email: string | null | undefined) {
    return Boolean(email && ADMIN_EMAILS.has(email.trim().toLowerCase()));
}

export function isSandboxEmail(email: string | null | undefined) {
    return email?.trim().toLowerCase() === SANDBOX_USER_EMAIL;
}

export function canSendOrderEmails(order: Record<string, any>) {
    return order.sandbox?.enabled !== true || order.sandbox?.sendEmails === true;
}
