import nodemailer from "nodemailer";

export type InternalOrderEvent = "new_order" | "change_request" | "approval_response";

type OrderLine = {
    productName?: unknown;
    variantLabel?: unknown;
    quantity?: unknown;
    unitPrice?: unknown;
};

type OrderData = Record<string, unknown> & {
    lines?: OrderLine[];
};

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    })[character]!);
}

function text(value: unknown, fallback = "—") {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function money(value: unknown) {
    return typeof value === "number"
        ? new Intl.NumberFormat("nn-NO", { style: "currency", currency: "NOK" }).format(value)
        : "—";
}

function siteUrl() {
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, "")}`;
    }
    return "http://localhost:3000";
}

function eventTitle(event: InternalOrderEvent) {
    if (event === "new_order") return "Ny bestilling";
    if (event === "change_request") return "Ny endringsførespurnad";
    return "Nytt svar på kundegodkjenning";
}

function approvalLabel(value: unknown) {
    if (value === "deliver_partial_later") return "Lever det som er klart, og ettersend resten";
    if (value === "deliver_partial_cancel_rest") return "Lever det som er klart, og stryk resten";
    if (value === "wait_for_complete") return "Vent til heile bestillinga er klar";
    return "Svar registrert";
}

export async function sendInternalOrderEmail({
    event,
    orderId,
    order,
    message,
}: {
    event: InternalOrderEvent;
    orderId: string;
    order: OrderData;
    message?: string;
}) {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    if (!host || !user || !pass) throw new Error("MISSING_SMTP_CONFIG");

    const customer = text(order.customerDisplayName, text(order.customerName));
    const company = text(order.customerCompanyName, customer);
    const orderLabel = text(order.orderNumber, "Ny ordre utan ordrenummer");
    const title = eventTitle(event);
    const adminUrl = `${siteUrl()}/admin/orders/${encodeURIComponent(orderId)}`;
    const confirmationUrl = `${adminUrl}/confirmation`;
    const lines = Array.isArray(order.lines) ? order.lines : [];
    const lineText = lines.map((line) => {
        const quantity = Number(line.quantity) || 0;
        const unitPrice = Number(line.unitPrice) || 0;
        return `${quantity} × ${text(line.productName)} – ${text(line.variantLabel)} · ${money(unitPrice * quantity)}`;
    });
    const eventDetail = event === "change_request"
        ? `Ønskje: ${message?.trim() || "Sjå førespurnaden i ordren."}`
        : event === "approval_response"
            ? `Kunden svarte: ${approvalLabel((order.approval as Record<string, unknown> | undefined)?.response)}`
            : "Ei ny bestilling er registrert i kundeportalen.";

    const transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 465),
        secure: (process.env.SMTP_SECURE || "true") === "true",
        auth: { user, pass },
    });

    await transporter.sendMail({
        from: process.env.SMTP_FROM || "Valldal Safteri <post@valldalsafteri.no>",
        to: process.env.INTERNAL_ORDER_EMAIL || "ordre@valldalsafteri.no",
        replyTo: "post@valldalsafteri.no",
        subject: `${title}: ${customer}`,
        text: [
            title,
            "",
            eventDetail,
            "",
            `Kunde: ${customer}`,
            company !== customer ? `Fakturerast til: ${company}` : "",
            `Kontaktperson: ${text(order.customerContactName)}`,
            `Ordre: ${orderLabel}`,
            `E-post: ${text(order.customerEmail)}`,
            `Telefon: ${text(order.customerPhone)}`,
            `Org.nr.: ${text(order.organizationNumber)}`,
            `Sum: ${money(order.totalExVat)} eks. mva.`,
            text(order.note, "") ? `Merknad: ${text(order.note)}` : "",
            "",
            ...lineText,
            "",
            `Opne ordren: ${adminUrl}`,
            event === "new_order" ? `Ordrebekrefting: ${confirmationUrl}` : "",
        ].filter(Boolean).join("\n"),
        html: `<div style="background:#f3f0e9;padding:32px 16px;font-family:Arial,sans-serif;color:#1b1b18">
            <div style="max-width:640px;margin:0 auto;background:#fffdf8;padding:36px;border:1px solid #e3dfd5;border-radius:8px">
                <p style="margin:0 0 24px;font-size:12px;letter-spacing:.18em;font-weight:700">VALLDAL SAFTERI · ORDRE</p>
                <h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:32px;font-weight:400">${escapeHtml(title)}</h1>
                <p style="font-size:16px;line-height:1.6">${escapeHtml(eventDetail)}</p>
                <div style="margin:24px 0;padding:20px;background:#f7f5f1;border-radius:6px;line-height:1.7">
                    <strong>${escapeHtml(customer)}</strong>${company !== customer ? `<br>Fakturerast til: ${escapeHtml(company)}` : ""}<br>
                    ${escapeHtml(orderLabel)}<br>
                    Kontakt: ${escapeHtml(text(order.customerContactName))}<br>
                    ${escapeHtml(text(order.customerEmail))} · ${escapeHtml(text(order.customerPhone))}<br>
                    Org.nr.: ${escapeHtml(text(order.organizationNumber))}
                </div>
                ${text(order.note, "") ? `<p style="padding:14px 16px;border-left:3px solid #b7aa8d;background:#fffaf0"><strong>Merknad:</strong> ${escapeHtml(text(order.note))}</p>` : ""}
                ${lineText.length ? `<table style="width:100%;border-collapse:collapse;margin-top:24px"><tbody>${lines.map((line) => {
                    const quantity = Number(line.quantity) || 0;
                    const unitPrice = Number(line.unitPrice) || 0;
                    return `<tr><td style="padding:12px 8px;border-bottom:1px solid #e3dfd5"><strong>${escapeHtml(text(line.productName))}</strong><br><span style="color:#69675f;font-size:14px">${escapeHtml(text(line.variantLabel))}</span></td><td style="padding:12px 8px;border-bottom:1px solid #e3dfd5;text-align:right;white-space:nowrap">${quantity} × ${escapeHtml(money(unitPrice))}<br><strong>${escapeHtml(money(quantity * unitPrice))}</strong></td></tr>`;
                }).join("")}</tbody><tfoot><tr><td style="padding:18px 8px 8px;font-weight:700">Totalt eks. mva.</td><td style="padding:18px 8px 8px;text-align:right;font-weight:700">${escapeHtml(money(order.totalExVat))}</td></tr></tfoot></table>` : ""}
                <p style="margin:30px 0 0"><a href="${escapeHtml(event === "new_order" ? confirmationUrl : adminUrl)}" style="display:inline-block;background:#1b1b18;color:#fffdf8;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700">${event === "new_order" ? "Opne ordrebekreftinga" : "Opne ordren"} →</a></p>
                ${event === "new_order" ? `<p style="margin:14px 0 0;font-size:14px"><a href="${escapeHtml(adminUrl)}" style="color:#1b1b18">Gå til behandling av ordren</a></p>` : ""}
            </div>
        </div>`,
    });
}
