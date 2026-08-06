import nodemailer from "nodemailer";

function escapeHtml(value: string) {
    return value.replace(
        /[&<>"']/g,
        (character) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;",
            })[character]!,
    );
}

function smtpTransport() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;

    if (!host || !user || !pass) {
        throw new Error("MISSING_SMTP_CONFIG");
    }

    return nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 465),
        secure: (process.env.SMTP_SECURE || "true") === "true",
        auth: { user, pass },
    });
}

export async function sendCustomerAccessEmail({
    email,
    name,
    resetUrl,
}: {
    email: string;
    name: string;
    resetUrl: string;
}) {
    const sender =
        process.env.SMTP_FROM ||
        "Valldal Safteri <post@valldalsafteri.no>";
    const greetingName = name.trim() || "kunde";

    await smtpTransport().sendMail({
        from: sender,
        to: email,
        subject: "Opprett eller endre passord hos Valldal Safteri",
        text: [
            `Hei ${greetingName},`,
            "",
            "Du kan opprette eller endre passordet til kundekontoen din hos Valldal Safteri med lenka under.",
            "",
            resetUrl,
            "",
            "Lenka er personleg og kan berre brukast éin gong. Dersom du ikkje bad om denne e-posten, kan du sjå bort frå han.",
            "",
            "Beste helsing",
            "Valldal Safteri",
            "post@valldalsafteri.no",
        ].join("\n"),
        html: `
            <div style="background:#f3f0e9;padding:40px 16px;font-family:Arial,sans-serif;color:#1b1b18">
                <div style="max-width:600px;margin:0 auto;background:#fffdf8;padding:42px;border:1px solid #e3dfd5;border-radius:8px">
                    <p style="margin:0 0 32px;font-size:12px;letter-spacing:.18em;font-weight:700">VALLDAL SAFTERI</p>
                    <h1 style="margin:0 0 24px;font-family:Georgia,serif;font-size:36px;font-weight:400;line-height:1.12">Vel ditt passord.</h1>
                    <p style="font-size:17px;line-height:1.65">Hei ${escapeHtml(greetingName)},</p>
                    <p style="font-size:17px;line-height:1.65">Du kan opprette eller endre passordet til kundekontoen din hos Valldal Safteri med knappen under.</p>
                    <p style="margin:34px 0">
                        <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#1b1b18;color:#fffdf8;text-decoration:none;padding:16px 24px;border-radius:999px;font-weight:700">Vel passord →</a>
                    </p>
                    <p style="font-size:14px;line-height:1.6;color:#69675f">Lenka er personleg og kan berre brukast éin gong. Dersom du ikkje bad om denne e-posten, kan du sjå bort frå han.</p>
                    <div style="border-top:1px solid #ddd9cf;margin-top:34px;padding-top:22px;font-size:14px;line-height:1.6">
                        Beste helsing<br><strong>Valldal Safteri</strong><br>
                        <a href="mailto:post@valldalsafteri.no" style="color:#1b1b18">post@valldalsafteri.no</a>
                    </div>
                </div>
            </div>
        `,
    });
}
