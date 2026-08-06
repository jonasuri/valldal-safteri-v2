import nodemailer from "nodemailer";
import type { ApprovalResponse } from "@/lib/ordersFirestore";

type OrderLine = Record<string, unknown>;
type OrderData = Record<string, unknown> & { lines?: OrderLine[] };

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    })[character]!);
}

function text(value: unknown, fallback = "—") {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0;
}

function money(value: unknown) {
    return new Intl.NumberFormat("nn-NO", { style: "currency", currency: "NOK" }).format(number(value));
}

function orderLabel(orderId: string, order: OrderData) {
    return text(order.orderNumber, orderId.slice(0, 8).toUpperCase());
}

function customerName(order: OrderData) {
    return text(order.customerDisplayName, text(order.customerName, "kunde"));
}

function transport() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    if (!host || !user || !pass) throw new Error("MISSING_SMTP_CONFIG");
    return nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 465),
        secure: (process.env.SMTP_SECURE || "true") === "true",
        auth: { user, pass },
    });
}

function frame(title: string, content: string) {
    return `<div style="background:#f3f0e9;padding:32px 16px;font-family:Arial,sans-serif;color:#1b1b18">
        <div style="max-width:640px;margin:0 auto;background:#fffdf8;padding:36px;border:1px solid #e3dfd5;border-radius:8px">
            <p style="margin:0 0 24px;font-size:12px;letter-spacing:.18em;font-weight:700">VALLDAL SAFTERI</p>
            <h1 style="margin:0 0 22px;font-family:Georgia,serif;font-size:32px;font-weight:400">${escapeHtml(title)}</h1>
            ${content}
            <div style="border-top:1px solid #ddd9cf;margin-top:34px;padding-top:22px;font-size:14px;line-height:1.6">
                Beste helsing<br><strong>Valldal Safteri</strong><br>
                <a href="mailto:post@valldalsafteri.no" style="color:#1b1b18">post@valldalsafteri.no</a>
            </div>
        </div>
    </div>`;
}

function sender() {
    return process.env.CUSTOMER_SMTP_FROM || "Valldal Safteri <varsling@valldalsafteri.no>";
}

function commonMessage(orderId: string, order: OrderData) {
    return {
        from: sender(),
        to: text(order.customerEmail, ""),
        replyTo: "post@valldalsafteri.no",
        headers: { "X-Valldal-Order-ID": orderId },
    };
}

function orderRows(order: OrderData, packing = false) {
    const lines = Array.isArray(order.lines) ? order.lines : [];
    const packingLines = Array.isArray((order.packing as Record<string, unknown> | undefined)?.lines)
        ? (order.packing as { lines: OrderLine[] }).lines : [];
    return lines.flatMap((line) => {
        const packed = packingLines.find((item) =>
            text(item.productId) === text(line.productId) && text(item.variantId) === text(line.variantId)
        );
        const quantity = packing ? number(packed?.packedQuantity) : number(line.quantity);
        if (packing && quantity <= 0) return [];
        const price = number(line.unitPrice);
        return [{
            name: text(line.productName), variant: text(line.variantLabel), quantity, price,
        }];
    });
}

function rowsHtml(rows: ReturnType<typeof orderRows>, showPrices: boolean) {
    return `<table style="width:100%;border-collapse:collapse;margin-top:24px"><tbody>${rows.map((row) =>
        `<tr><td style="padding:12px 8px;border-bottom:1px solid #e3dfd5"><strong>${escapeHtml(row.name)}</strong><br><span style="color:#69675f;font-size:14px">${escapeHtml(row.variant)}</span></td><td style="padding:12px 8px;border-bottom:1px solid #e3dfd5;text-align:right;white-space:nowrap">${row.quantity} stk${showPrices ? `<br>${escapeHtml(money(row.quantity * row.price))}` : ""}</td></tr>`
    ).join("")}</tbody></table>`;
}

export async function sendCustomerOrderConfirmation(orderId: string, order: OrderData) {
    const email = text(order.customerEmail, "");
    if (!email) throw new Error("MISSING_CUSTOMER_EMAIL");
    const label = orderLabel(orderId, order);
    const rows = orderRows(order);
    const plainRows = rows.map((row) => `${row.quantity} × ${row.name} – ${row.variant}: ${money(row.quantity * row.price)}`);
    await transport().sendMail({
        ...commonMessage(orderId, order),
        subject: `Ordrebekrefting ${label} – Valldal Safteri`,
        text: [`Hei ${customerName(order)},`, "", "Vi har registrert bestillinga dykkar.", `Ordre: ${label}`, "", ...plainRows, "", `Totalt: ${money(order.totalExVat)} eks. mva.`, text(order.note, "") ? `Merknad: ${text(order.note)}` : "", "", "Ta kontakt dersom noko ikkje stemmer.", "", "Beste helsing", "Valldal Safteri", "post@valldalsafteri.no"].filter(Boolean).join("\n"),
        html: frame("Ordrebekrefting", `<p style="font-size:16px;line-height:1.65">Hei ${escapeHtml(customerName(order))},</p><p style="font-size:16px;line-height:1.65">Vi har registrert bestillinga dykkar.</p><p style="font-size:14px;color:#69675f">Ordre ${escapeHtml(label)}</p>${rowsHtml(rows, true)}<p style="text-align:right;font-size:17px"><strong>Totalt ${escapeHtml(money(order.totalExVat))} eks. mva.</strong></p>${text(order.note, "") ? `<p style="padding:14px 16px;background:#f7f5f1"><strong>Merknad:</strong> ${escapeHtml(text(order.note))}</p>` : ""}<p style="font-size:14px;color:#69675f">Ta kontakt dersom noko ikkje stemmer.</p>`),
    });
}

const APPROVAL_CHOICES: Array<{ value: ApprovalResponse; label: string }> = [
    { value: "deliver_partial_later", label: "Send det som er klart, og ettersend resten" },
    { value: "deliver_partial_cancel_rest", label: "Send det som er klart, og stryk resten" },
    { value: "wait_for_complete", label: "Vent til heile bestillinga er klar" },
];

export async function sendCustomerApprovalEmail(orderId: string, order: OrderData, approvalUrl: (choice: ApprovalResponse) => string) {
    const email = text(order.customerEmail, "");
    if (!email) throw new Error("MISSING_CUSTOMER_EMAIL");
    const rows = orderRows(order, true);
    const packingLines = Array.isArray((order.packing as { lines?: OrderLine[] } | undefined)?.lines)
        ? (order.packing as { lines: OrderLine[] }).lines : [];
    const missing = (Array.isArray(order.lines) ? order.lines : []).flatMap((line) => {
        const packed = packingLines.find((item) => text(item.productId) === text(line.productId) && text(item.variantId) === text(line.variantId));
        const quantity = Math.max(0, number(line.quantity) - number(packed?.packedQuantity));
        return quantity ? [`${text(line.productName)} – ${text(line.variantLabel)}: ${quantity} stk`] : [];
    });
    const buttons = APPROVAL_CHOICES.map((choice) => `<p style="margin:12px 0"><a href="${escapeHtml(approvalUrl(choice.value))}" style="display:block;border:1px solid #b7aa8d;border-radius:8px;padding:14px 16px;color:#1b1b18;text-decoration:none;font-weight:700">${escapeHtml(choice.label)} →</a></p>`).join("");
    await transport().sendMail({
        ...commonMessage(orderId, order),
        subject: `Vi treng svar på ordre ${orderLabel(orderId, order)}`,
        text: [`Hei ${customerName(order)},`, "", "Nokre varer manglar. Vel korleis vi skal handtere bestillinga:", "", ...APPROVAL_CHOICES.map((choice) => `${choice.label}: ${approvalUrl(choice.value)}`), "", "Manglar:", ...missing, "", "Beste helsing", "Valldal Safteri"].join("\n"),
        html: frame("Vi treng eit svar frå dykk", `<p style="font-size:16px;line-height:1.65">Hei ${escapeHtml(customerName(order))},</p><p style="font-size:16px;line-height:1.65">Nokre varer i bestillinga manglar. Vel korleis de ønskjer at vi skal handtere ordren.</p><div style="margin:22px 0;padding:16px;background:#fff7e6"><strong>Manglar</strong><ul style="line-height:1.7">${missing.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>${buttons}<p style="font-size:13px;color:#69675f">Valet blir først registrert etter at de har stadfesta det på sida som opnar seg.</p>${rows.length ? `<p style="margin-top:28px"><strong>Allereie pakka</strong></p>${rowsHtml(rows, false)}` : ""}`),
    });
}

export async function sendCustomerPackingSlip(orderId: string, order: OrderData, status: string) {
    const email = text(order.customerEmail, "");
    if (!email) throw new Error("MISSING_CUSTOMER_EMAIL");
    const rows = orderRows(order, true);
    const statusText = status === "shipped" ? "Bestillinga er send" : status === "picked_up" ? "Bestillinga er henta" : "Bestillinga er levert";
    await transport().sendMail({
        ...commonMessage(orderId, order),
        subject: `${statusText}: ordre ${orderLabel(orderId, order)}`,
        text: [`Hei ${customerName(order)},`, "", `${statusText}. Her er følgjesetelen:`, "", ...rows.map((row) => `${row.quantity} × ${row.name} – ${row.variant}`), "", "Beste helsing", "Valldal Safteri"].join("\n"),
        html: frame(statusText, `<p style="font-size:16px;line-height:1.65">Hei ${escapeHtml(customerName(order))},</p><p style="font-size:16px;line-height:1.65">${escapeHtml(statusText)}. Nedanfor finn de følgjesetelen.</p><p style="font-size:14px;color:#69675f">Ordre ${escapeHtml(orderLabel(orderId, order))}</p>${rowsHtml(rows, false)}`),
    });
}
