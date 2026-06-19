import React from "react";
import { groupOrderLinesByBrand } from "@/lib/orderLineSorting";

export type OrderConfirmationLine = {
    productId: string;
    productName: string;
    variantId: string;
    variantLabel: string;
    brand?: string | null;
    category?: string | null;
    subcategory?: string | null;
    categoryName?: string | null;
    subcategoryName?: string | null;
    quantity: number;
    unitPrice: number;
    lineTotalExVat?: number;
};

export type OrderConfirmationDocumentData = {
    orderNumber: string;
    customerName: string;
    customerCompanyName?: string | null;
    customerContactName?: string | null;
    customerEmail?: string;
    customerPhone?: string;
    organizationNumber?: string;
    createdAt: string;
    totalExVat: number;
    lines: OrderConfirmationLine[];
};

type Props = {
    order: OrderConfirmationDocumentData;
    logoPath?: string;
    footerText?: string;
};

const companyInfo = {
    name: "Valldal Safteri AS",
    address: "Syltegata 15, 6210 Valldal",
    organizationNumber: "936845517",
};

function getLineCategory(line: OrderConfirmationLine) {
    return [line.categoryName || line.category, line.subcategoryName || line.subcategory]
        .filter(Boolean)
        .join(" / ");
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("nb-NO", {
        style: "currency",
        currency: "NOK",
        maximumFractionDigits: 0,
    }).format(value);
}

export default function OrderConfirmationDocuments({
    order,
    logoPath = "/logo.png",
    footerText = "Dette dokumentet er generert frå ordresystemet.",
}: Props) {
    const groupedLines = groupOrderLinesByBrand(order.lines);

    const customerCompanyName = order.customerCompanyName?.trim() || "";
    const showCompanyName = Boolean(
        customerCompanyName && customerCompanyName !== order.customerName
    );

    return (
        <article className="rounded-[28px] border border-neutral-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-10 print:shadow-none">
            <header className="border-b border-neutral-200 pb-8">
                <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between print:flex-row">
                    <div>
                        <img src={logoPath} alt="Valldal" className="h-14 w-auto" />
                        <div className="mt-5 text-sm leading-6 text-neutral-700">
                            <div className="font-medium text-neutral-950">{companyInfo.name}</div>
                            <div>{companyInfo.address}</div>
                            <div>Org.nr. {companyInfo.organizationNumber}</div>
                        </div>
                    </div>

                    <div className="text-sm md:text-right print:text-right">
                        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
                            Ordrebekreftelse
                        </h1>
                        <dl className="mt-4 space-y-1 text-neutral-600">
                            <div>
                                <dt className="inline">Ordre: </dt>
                                <dd className="inline font-medium text-neutral-900">
                                    {order.orderNumber}
                                </dd>
                            </div>
                            <div>
                                <dt className="inline">Dato: </dt>
                                <dd className="inline font-medium text-neutral-900">
                                    {order.createdAt}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </header>

            <section className="grid gap-6 border-b border-neutral-200 py-8 md:grid-cols-2 print:grid-cols-2">
                <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4 print:rounded-none print:bg-white print:p-3">
                    <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                        Til kunde
                    </h2>
                    <div className="mt-3 text-sm leading-6 text-neutral-700">
                        <div className="font-medium text-neutral-950">{order.customerName}</div>
                        {showCompanyName ? (
                            <div className="text-neutral-600">Fakturerast til: {customerCompanyName}</div>
                        ) : null}
                        {order.organizationNumber ? <div>Org.nr. {order.organizationNumber}</div> : null}
                        {order.customerContactName ? <div>Kontakt: {order.customerContactName}</div> : null}
                        {order.customerPhone ? <div>Telefon: {order.customerPhone}</div> : null}
                        {order.customerEmail ? <div>E-post: {order.customerEmail}</div> : null}
                    </div>
                </div>

                <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4 print:rounded-none print:bg-white print:p-3">
                    <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                        Dokumentinformasjon
                    </h2>
                    <dl className="mt-3 space-y-1 text-sm leading-6 text-neutral-700">
                        <div className="flex justify-between gap-4">
                            <dt>Dokument</dt>
                            <dd className="font-medium text-neutral-950">Ordrebekreftelse</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt>Ordrenummer</dt>
                            <dd className="font-medium text-neutral-950">{order.orderNumber}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt>Ordredato</dt>
                            <dd className="font-medium text-neutral-950">{order.createdAt}</dd>
                        </div>
                    </dl>
                </div>
            </section>

            <section className="py-8">
                <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Bestilte varer
                </h2>

                <div className="mt-4 overflow-hidden rounded-[18px] border border-neutral-200">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-50 text-xs uppercase tracking-[0.12em] text-neutral-500">
                            <tr>
                                <th className="px-4 py-3 font-medium">Vare</th>
                                <th className="px-4 py-3 font-medium">Variant</th>
                                <th className="px-4 py-3 text-right font-medium">Antal</th>
                                <th className="px-4 py-3 text-right font-medium">Pris</th>
                                <th className="px-4 py-3 text-right font-medium">Sum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {([
                                ["Valldal Safteri", groupedLines.safteri, "text-rose-700"],
                                ["Valldal Bryggeri", groupedLines.bryggeri, "text-amber-700"],
                            ] as const).map(([title, lines, colorClass]) => {
                                if (!lines.length) return null;

                                return (
                                    <React.Fragment key={title}>
                                        <tr className="bg-neutral-50">
                                            <td
                                                colSpan={5}
                                                className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${colorClass}`}
                                            >
                                                {title}
                                            </td>
                                        </tr>

                                        {lines.map((line) => {
                                            const lineTotal =
                                                typeof line.lineTotalExVat === "number"
                                                    ? line.lineTotalExVat
                                                    : line.quantity * line.unitPrice;

                                            return (
                                                <tr key={`${line.productId}-${line.variantId}`}>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-neutral-900">{line.productName}</div>
                                                        {getLineCategory(line) ? (
                                                            <div className="mt-1 text-xs text-neutral-500">
                                                                {getLineCategory(line)}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                    <td className="px-4 py-3 text-neutral-600">
                                                        {line.variantLabel}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">{line.quantity}</td>
                                                    <td className="px-4 py-3 text-right">{formatCurrency(line.unitPrice)}</td>
                                                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(lineTotal)}</td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot className="border-t border-neutral-200 bg-neutral-50">
                            <tr>
                                <td colSpan={4} className="px-4 py-3 text-right font-medium">
                                    Sum eks. mva.
                                </td>
                                <td className="px-4 py-3 text-right font-semibold">
                                    {formatCurrency(order.totalExVat)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>

            <footer className="border-t border-neutral-200 pt-6 text-xs leading-5 text-neutral-500">
                <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
                    <p>{footerText}</p>
                    <div className="md:text-right print:text-right">
                        <div className="font-medium text-neutral-700">{companyInfo.name}</div>
                        <div>{companyInfo.address}</div>
                        <div>Org.nr. {companyInfo.organizationNumber}</div>
                    </div>
                </div>
            </footer>
        </article>
    );
}
