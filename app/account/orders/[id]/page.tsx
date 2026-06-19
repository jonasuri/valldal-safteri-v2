

"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { addDoc, collection, doc, getDocs, limit, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { submitOrderApprovalResponse } from "@/lib/ordersFirestore";
import { groupOrderLinesByBrand } from "@/lib/orderLineSorting";

type AccountCustomer = {
    id: string;
    active: boolean;
};

type OrderLine = {
    productId: string;
    productName: string;
    variantId: string;
    variantLabel: string;
    brand: "safteri" | "bryggeri";
    category?: string | null;
    categoryName?: string | null;
    subcategory?: string | null;
    subcategoryName?: string | null;
    quantity: number;
    unitPrice: number;
};

type PackingLine = {
    productId: string;
    variantId: string;
    orderedQuantity: number;
    packedQuantity: number | null;
    missingQuantity: number | null;
};

type CustomerOrder = {
    id: string;
    orderNumber: string | null;
    status: string;
    customerId: string;
    customerName: string;
    customerDisplayName: string;
    customerCompanyName: string;
    totalExVat: number;
    lineCount: number;
    unitCount: number;
    lines: OrderLine[];
    packingLines: PackingLine[];
    approval: {
        required: boolean;
        status: string;
        response: string | null;
    };
    createdAtLabel: string;
    isBackorder: boolean;
    parentOrderNumber: string | null;
};

type OrderChangeRequest = {
    id: string;
    status: "pending" | "approved" | "rejected";
    message: string;
    adminNote: string;
    createdAtLabel: string;
};

type ApprovalResponse =
    | "deliver_partial_later"
    | "deliver_partial_cancel_rest"
    | "wait_for_complete";

function canRequestOrderChange(order: CustomerOrder) {
    return ["new", "processing", "change_requested"].includes(order.status);
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("nb-NO", {
        style: "currency",
        currency: "NOK",
        maximumFractionDigits: 2,
    }).format(value);
}

function formatDate(value: any) {
    if (value?.toDate) {
        return value.toDate().toLocaleDateString("nb-NO", {
            day: "2-digit",
            month: "long",
            year: "numeric",
        });
    }

    return "—";
}

function orderStatusLabel(status: string) {
    const labels: Record<string, string> = {
        new: "Ny bestilling",
        processing: "Under behandling",
        packed: "Pakka",
        partial: "Delpakka",
        change_requested: "Handling krevst",
        picked_up: "Henta",
        shipped: "Sendt",
        delivered: "Levert",
        cancelled: "Kansellert",
    };

    return labels[status] || "Under behandling";
}

function orderStatusDescription(status: string) {
    if (status === "change_requested") {
        return "Vi treng svar frå dykk før bestillinga kan behandlast vidare.";
    }

    if (status === "partial") {
        return "Bestillinga er delpakka. Vi tek kontakt dersom vi treng avklaring.";
    }

    if (status === "packed") {
        return "Bestillinga er pakka og klar for vidare handtering.";
    }

    if (status === "shipped") return "Bestillinga er sendt.";
    if (status === "picked_up") return "Bestillinga er henta.";
    if (status === "delivered") return "Bestillinga er levert.";

    return "Bestillinga er registrert og blir behandla vidare av Valldal.";
}


function orderStatusStyles(status: string) {
    if (status === "change_requested") return "border-amber-300 bg-amber-50 text-amber-900";
    if (status === "partial") return "border-amber-200 bg-amber-50 text-amber-800";
    if (["packed", "picked_up", "shipped", "delivered"].includes(status)) {
        return "border-emerald-200 bg-emerald-50 text-emerald-800";
    }
    if (status === "cancelled") return "border-neutral-200 bg-neutral-50 text-neutral-500";
    return "border-neutral-200 bg-neutral-50 text-neutral-700";
}

function approvalResponseLabel(response: ApprovalResponse | string | null) {
    if (response === "deliver_partial_later") {
        return "Send det som er pakka no. Resten kan ettersendast seinare.";
    }

    if (response === "deliver_partial_cancel_rest") {
        return "Send det som er pakka no, og fjern det som manglar.";
    }

    if (response === "wait_for_complete") {
        return "Vent til heile bestillinga er klar før levering.";
    }

    return "Ikkje valt";
}

function approvalResponseDescription(response: ApprovalResponse | string | null) {
    if (response === "deliver_partial_later") {
        return "Vi sender dei varene som er pakka no. Manglande varer blir følgde opp som restordre.";
    }

    if (response === "deliver_partial_cancel_rest") {
        return "Vi sender dei varene som er pakka no. Varer som manglar blir fjerna frå denne bestillinga.";
    }

    if (response === "wait_for_complete") {
        return "Vi ventar med levering til heile bestillinga kan leverast samla.";
    }

    return "Vel eit alternativ for å sjå kva som skjer vidare.";
}


function getLineKey(line: OrderLine) {
    return `${line.productId}-${line.variantId}`;
}

function getPackingLine(order: CustomerOrder, line: OrderLine) {
    return order.packingLines.find(
        (item) => item.productId === line.productId && item.variantId === line.variantId
    );
}

function hasPackingData(order: CustomerOrder) {
    return order.packingLines.some((line) => typeof line.packedQuantity === "number");
}

function mapOrder(id: string, data: any): CustomerOrder {
    const customerCompanyName =
        typeof data.customerCompanyName === "string" && data.customerCompanyName.trim()
            ? data.customerCompanyName
            : typeof data.customerName === "string"
                ? data.customerName
                : "";

    const customerDisplayName =
        typeof data.customerDisplayName === "string" && data.customerDisplayName.trim()
            ? data.customerDisplayName
            : customerCompanyName;

    return {
        id,
        orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : null,
        status: typeof data.status === "string" ? data.status : "new",
        customerId: typeof data.customerId === "string" ? data.customerId : "",
        customerName: customerDisplayName,
        customerDisplayName,
        customerCompanyName,
        totalExVat: typeof data.totalExVat === "number" ? data.totalExVat : 0,
        lineCount: typeof data.lineCount === "number" ? data.lineCount : 0,
        unitCount: typeof data.unitCount === "number" ? data.unitCount : 0,
        lines: Array.isArray(data.lines) ? data.lines : [],
        packingLines: Array.isArray(data.packing?.lines) ? data.packing.lines : [],
        approval: {
            required: data.approval?.required === true,
            status: typeof data.approval?.status === "string" ? data.approval.status : "not_required",
            response: typeof data.approval?.response === "string" ? data.approval.response : null,
        },
        createdAtLabel: formatDate(data.createdAt),
        isBackorder: data.isBackorder === true,
        parentOrderNumber: typeof data.parentOrderNumber === "string" ? data.parentOrderNumber : null,
    };
}

function mapOrderChangeRequest(id: string, data: any): OrderChangeRequest {
    return {
        id,
        status:
            data.status === "approved" || data.status === "rejected"
                ? data.status
                : "pending",
        message: typeof data.message === "string" ? data.message : "",
        adminNote: typeof data.adminNote === "string" ? data.adminNote : "",
        createdAtLabel: formatDate(data.createdAt),
    };
}

async function fetchCustomerForUser(user: User): Promise<AccountCustomer | null> {
    const snapshot = await getDocs(
        query(collection(db, "customers"), where("authUid", "==", user.uid), limit(1))
    );

    if (snapshot.empty) return null;

    const docSnap = snapshot.docs[0];
    const data = docSnap.data();

    return {
        id: docSnap.id,
        active: typeof data.active === "boolean" ? data.active : true,
    };
}

export default function AccountOrderDetailPage() {
    const params = useParams();
    const orderId = typeof params.id === "string" ? params.id : "";
    const searchParams = useSearchParams();
    const cameFromAccount = searchParams.get("from") === "account";

    const [customer, setCustomer] = useState<AccountCustomer | null>(null);
    const [order, setOrder] = useState<CustomerOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [savingApproval, setSavingApproval] = useState(false);
    const [selectedApprovalResponse, setSelectedApprovalResponse] = useState<ApprovalResponse | null>(null);
    const [changeRequestMessage, setChangeRequestMessage] = useState("");
    const [submittingChangeRequest, setSubmittingChangeRequest] = useState(false);
    const [changeRequestSuccess, setChangeRequestSuccess] = useState("");
    const [changeRequests, setChangeRequests] = useState<OrderChangeRequest[]>([]);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setCustomer(null);
            setOrder(null);
            setError("");

            if (!user) {
                setLoading(false);
                return;
            }

            try {
                const nextCustomer = await fetchCustomerForUser(user);
                setCustomer(nextCustomer);

                if (!nextCustomer) {
                    setError("Brukaren er ikkje knytt til ein B2B-kunde enno.");
                    setLoading(false);
                    return;
                }

                if (!nextCustomer.active) {
                    setError("Kundekontoen er ikkje aktiv. Ta kontakt med Valldal Safteri.");
                    setLoading(false);
                    return;
                }
            } catch (err) {
                console.error(err);
                setError("Kunne ikkje hente kundedata.");
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!orderId || !customer) return;

        const unsubscribeOrder = onSnapshot(doc(db, "orders", orderId), (snapshot) => {
            if (!snapshot.exists()) {
                setOrder(null);
                setError("Fann ikkje bestillinga.");
                setLoading(false);
                return;
            }

            const nextOrder = mapOrder(snapshot.id, snapshot.data());

            if (nextOrder.customerId !== customer.id) {
                setOrder(null);
                setError("Denne bestillinga høyrer ikkje til denne kundekontoen.");
                setLoading(false);
                return;
            }

            setOrder(nextOrder);
            setLoading(false);
        });

        return () => unsubscribeOrder();
    }, [orderId, customer]);

    useEffect(() => {
        if (!orderId || !customer) return;

        const requestsQuery = query(
            collection(db, "orderChangeRequests"),
            where("orderId", "==", orderId),
            where("customerId", "==", customer.id)
        );

        const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
            setChangeRequests(
                snapshot.docs
                    .map((requestDoc) =>
                        mapOrderChangeRequest(requestDoc.id, requestDoc.data())
                    )
                    .sort((a, b) => b.createdAtLabel.localeCompare(a.createdAtLabel))
            );
        });

        return () => unsubscribeRequests();
    }, [orderId, customer]);

    async function handleApprovalResponse() {
        if (!order || !selectedApprovalResponse) return;

        try {
            setSavingApproval(true);
            await submitOrderApprovalResponse(order.id, selectedApprovalResponse);
        } catch (error) {
            console.error(error);
            window.alert("Kunne ikkje lagre svaret.");
        } finally {
            setSavingApproval(false);
        }
    }

    async function submitAddItemsRequest() {
        if (!order || !customer) return;

        const message = changeRequestMessage.trim();

        if (!message) {
            window.alert("Skriv kva de ønskjer å legge til bestillinga.");
            return;
        }

        if (!canRequestOrderChange(order)) {
            window.alert("Denne bestillinga er alt for langt i behandling til at de kan sende endringsønske her.");
            return;
        }

        try {
            setSubmittingChangeRequest(true);
            setChangeRequestSuccess("");

            await addDoc(collection(db, "orderChangeRequests"), {
                orderId: order.id,
                orderNumber: order.orderNumber,
                customerId: customer.id,
                customerName: order.customerDisplayName || order.customerName,
                customerDisplayName: order.customerDisplayName || order.customerName,
                customerCompanyName: order.customerCompanyName,
                type: "add_lines",
                status: "pending",
                message,
                lines: [],
                source: "customer_portal",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            setChangeRequestMessage("");
            setChangeRequestSuccess("Førespurnaden er sendt. Vi vurderer han før bestillinga eventuelt blir endra.");
        } catch (error) {
            console.error(error);
            window.alert("Kunne ikkje sende førespurnaden. Prøv igjen.");
        } finally {
            setSubmittingChangeRequest(false);
        }
    }

    const groupedLines = order ? groupOrderLinesByBrand(order.lines) : { safteri: [], bryggeri: [] };
    const showPackingSlip = order ? hasPackingData(order) : false;
    const pendingChangeRequests = changeRequests.filter((request) => request.status === "pending");

    const missingLines = order
        ? order.lines
            .map((line) => {
                const packingLine = getPackingLine(order, line);
                const missingQuantity = typeof packingLine?.missingQuantity === "number" ? packingLine.missingQuantity : 0;

                return {
                    ...line,
                    missingQuantity,
                };
            })
            .filter((line) => line.missingQuantity > 0)
        : [];

    const onlyShowMissingLinesOnMobile = order?.status === "change_requested" && order.approval.status !== "answered";

    if (loading) {
        return (
            <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
                <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-neutral-600 md:px-6">
                    Hentar bestilling …
                </div>
            </main>
        );
    }

    if (error || !order) {
        return (
            <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
                <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
                    <Link
                        href={cameFromAccount ? "/account" : "/account/orders"}
                        className="text-sm text-neutral-600 underline-offset-4 hover:underline"
                    >
                        ← {cameFromAccount ? "Tilbake til Min side" : "Tilbake til bestillingar"}
                    </Link>

                    <div className="mt-6 rounded-[24px] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                        {error || "Kunne ikkje hente bestillinga."}
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
            <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
                <Link
                    href={cameFromAccount ? "/account" : "/account/orders"}
                    className="text-sm text-neutral-600 underline-offset-4 hover:underline"
                >
                    ← {cameFromAccount ? "Tilbake til Min side" : "Tilbake til bestillingar"}
                </Link>

                <div className="mt-6 rounded-[24px] border border-rose-100 bg-[#fffafa] p-6">
                    <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                        Bestilling
                    </p>
                    {order.isBackorder ? (
                        <div className="mt-3 inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-800">
                            Restordre
                        </div>
                    ) : null}

                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                        {order.orderNumber || "Ordrenummer kjem"}
                    </h1>

                    <div className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600">
                        <div>{order.customerDisplayName || order.customerName} · {order.createdAtLabel}</div>
                        {order.customerCompanyName && order.customerCompanyName !== (order.customerDisplayName || order.customerName) ? (
                            <div className="text-xs leading-5 text-neutral-500">
                                Fakturerast til: {order.customerCompanyName}
                            </div>
                        ) : null}
                    </div>
                    {order.isBackorder ? (
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                            Dette er ein restordre frå ei tidlegare bestilling
                            {order.parentOrderNumber ? ` (${order.parentOrderNumber})` : ""}. Ordren blir behandla vidare med eige ordrenummer.
                        </p>
                    ) : null}

                    {!order.orderNumber ? (
                        <p className="mt-2 text-sm text-neutral-500">
                            Bestillinga er motteken. Ordrenummer blir tildelt når ho er registrert i ordresystemet vårt.
                        </p>
                    ) : null}
                </div>

                {order.status === "cancelled" ? (
                    <section className="mt-6 rounded-[24px] border border-neutral-300 bg-neutral-100 p-6 text-neutral-800">
                        <h2 className="text-lg font-medium">Bestillinga er kansellert</h2>
                        <p className="mt-2 text-sm leading-6 text-neutral-700">
                            Denne bestillinga er kansellert og blir ikkje behandla vidare. Ta kontakt med oss dersom dette ikkje stemmer.
                        </p>
                    </section>
                ) : null}

                <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
                    <section className={`rounded-[24px] border border-neutral-200 bg-white p-6 ${onlyShowMissingLinesOnMobile ? "hidden md:block" : ""}`}>
                        <h2 className="text-lg font-medium">Ordrelinjer</h2>

                        <div className="mt-5 space-y-8">
                            {([
                                ["Valldal Safteri", groupedLines.safteri, "text-rose-700"],
                                ["Valldal Bryggeri", groupedLines.bryggeri, "text-amber-700"],
                            ] as const).map(([title, lines, colorClass]) => {
                                if (!lines.length) return null;

                                const subtotal = lines.reduce(
                                    (sum, line) => sum + line.quantity * line.unitPrice,
                                    0
                                );

                                return (
                                    <div key={title}>
                                        <div className={`mb-3 text-xs font-semibold uppercase tracking-[0.18em] ${colorClass}`}>
                                            {title}
                                        </div>

                                        <div className="space-y-3">
                                            {lines.map((line) => {
                                                const packingLine = getPackingLine(order, line);
                                                const packedQuantity = packingLine?.packedQuantity;
                                                const missingQuantity = packingLine?.missingQuantity;
                                                const hasPacking = typeof packedQuantity === "number";

                                                return (
                                                    <div key={getLineKey(line)} className="rounded-[18px] border border-neutral-200 bg-white p-4">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div>
                                                                <div className="font-medium text-neutral-900">
                                                                    {line.productName}
                                                                </div>
                                                                <div className="mt-1 text-xs text-neutral-500">
                                                                    {[line.categoryName || line.category, line.variantLabel]
                                                                        .filter(Boolean)
                                                                        .join(" / ")}
                                                                </div>
                                                            </div>
                                                            <div className="text-right text-sm font-medium text-neutral-900">
                                                                {formatCurrency(line.quantity * line.unitPrice)} eks. mva.
                                                            </div>
                                                        </div>

                                                        <div className="mt-4 grid gap-3 text-sm text-neutral-600 md:grid-cols-3">
                                                            <div>
                                                                <span className="text-xs uppercase tracking-[0.12em] text-neutral-400">Bestilt</span>
                                                                <div className="mt-1 font-medium text-neutral-900">{line.quantity} stk</div>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs uppercase tracking-[0.12em] text-neutral-400">Pakka</span>
                                                                <div className="mt-1 font-medium text-neutral-900">
                                                                    {hasPacking ? `${packedQuantity} stk` : "—"}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs uppercase tracking-[0.12em] text-neutral-400">Manglar</span>
                                                                <div className={`mt-1 font-medium ${missingQuantity && missingQuantity > 0 ? "text-amber-800" : "text-neutral-900"}`}>
                                                                    {hasPacking ? `${missingQuantity || 0} stk` : "—"}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-3 text-right text-sm font-medium text-neutral-700">
                                            Delsum: {formatCurrency(subtotal)} eks. mva.
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <aside className="space-y-6">
                        {order.isBackorder ? (
                            <section className="rounded-[24px] border border-rose-100 bg-[#fffafa] p-6">
                                <h2 className="text-lg font-medium text-rose-900">Restordre</h2>
                                <p className="mt-3 text-sm leading-6 text-neutral-600">
                                    Denne bestillinga inneheld varer som stod att frå ei tidlegare bestilling.
                                </p>
                                {order.parentOrderNumber ? (
                                    <p className="mt-3 text-sm text-neutral-500">
                                        Opphavleg ordre: {order.parentOrderNumber}
                                    </p>
                                ) : null}
                            </section>
                        ) : null}
                        <section className="rounded-[24px] border border-neutral-200 bg-white p-6">
                            <h2 className="text-lg font-medium">Status</h2>

                            <div className={`mt-4 rounded-full border px-3 py-2 text-sm font-medium ${orderStatusStyles(order.status)}`}>
                                {orderStatusLabel(order.status)}
                            </div>

                            <p className="mt-3 text-sm leading-6 text-neutral-600">
                                {orderStatusDescription(order.status)}
                            </p>
                        </section>

                        {canRequestOrderChange(order) ? (
                            <section className="rounded-[24px] border border-neutral-200 bg-white p-6">
                                <h2 className="text-lg font-medium">Legg til varer</h2>
                                <p className="mt-3 text-sm leading-6 text-neutral-600">
                                    Treng de å legge til noko på bestillinga, kan de sende ein førespurnad her. Ordren blir ikkje endra før vi har kontrollert og godkjent endringa.
                                </p>

                                {pendingChangeRequests.length ? (
                                    <div className="mt-4 rounded-[14px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                                        De har ein førespurnad som ventar på behandling.
                                    </div>
                                ) : null}

                                <label className="mt-4 block text-sm font-medium text-neutral-800">
                                    Kva ønskjer de å legge til?
                                    <textarea
                                        value={changeRequestMessage}
                                        onChange={(event) => {
                                            setChangeRequestMessage(event.target.value);
                                            setChangeRequestSuccess("");
                                        }}
                                        rows={4}
                                        className="mt-2 w-full rounded-[14px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neutral-700"
                                        placeholder="Til dømes: Legg gjerne til 6 flasker bringebærsaft 0,75 l dersom det er mogleg."
                                    />
                                </label>

                                {changeRequestSuccess ? (
                                    <div className="mt-3 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                        {changeRequestSuccess}
                                    </div>
                                ) : null}

                                <button
                                    type="button"
                                    onClick={submitAddItemsRequest}
                                    disabled={submittingChangeRequest || !changeRequestMessage.trim()}
                                    className="mt-4 w-full rounded-full border border-neutral-900 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {submittingChangeRequest ? "Sender …" : "Send førespurnad"}
                                </button>
                            </section>
                        ) : null}

                        {changeRequests.length ? (
                            <section className="rounded-[24px] border border-neutral-200 bg-white p-6">
                                <h2 className="text-lg font-medium">Endringsførespurnader</h2>
                                <div className="mt-4 space-y-3">
                                    {changeRequests.map((request) => (
                                        <div key={request.id} className="rounded-[16px] border border-neutral-200 bg-neutral-50 p-4 text-sm">
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="font-medium text-neutral-900">
                                                    {request.status === "pending"
                                                        ? "Ventar på behandling"
                                                        : request.status === "approved"
                                                            ? "Godkjend/handtert"
                                                            : "Avvist"}
                                                </span>
                                                <span className="text-xs text-neutral-500">{request.createdAtLabel}</span>
                                            </div>
                                            {request.message ? (
                                                <div className="mt-2 whitespace-pre-line text-xs leading-5 text-neutral-600">
                                                    {request.message}
                                                </div>
                                            ) : null}
                                            {request.status === "approved" ? (
                                                <div className="mt-3 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
                                                    Vi har behandla førespurnaden. Sjå oppdatert bestilling eller ta kontakt dersom noko ikkje stemmer.
                                                </div>
                                            ) : null}
                                            {request.status === "rejected" ? (
                                                <div className="mt-3 rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-xs leading-5 text-neutral-600">
                                                    Førespurnaden vart ikkje lagt inn på bestillinga. Ta kontakt dersom de ønskjer å avklare noko.
                                                </div>
                                            ) : null}
                                            {request.adminNote && request.status !== "pending" ? (
                                                <div className="mt-2 text-xs leading-5 text-neutral-500">
                                                    Notat: {request.adminNote}
                                                </div>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        <section className="rounded-[24px] border border-neutral-200 bg-white p-6">
                            <h2 className="text-lg font-medium">Oppsummering</h2>

                            <div className="mt-4 space-y-2 text-sm text-neutral-600">
                                <div className="flex justify-between gap-4">
                                    <span>Varetypar</span>
                                    <span>{order.lineCount}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span>Einingar</span>
                                    <span>{order.unitCount}</span>
                                </div>
                                <div className="flex justify-between gap-4 border-t border-neutral-200 pt-3 font-medium text-neutral-900">
                                    <span>Sum</span>
                                    <span>{formatCurrency(order.totalExVat)} eks. mva.</span>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-[24px] border border-neutral-200 bg-white p-6">
                            <h2 className="text-lg font-medium">Dokument</h2>

                            <div className="mt-4 space-y-3">
                                <Link
                                    href={`/account/orders/${order.id}/confirmation`}
                                    className="flex w-full items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-900 transition hover:bg-rose-100"
                                >
                                    Sjå ordrebekreftelse
                                </Link>

                                {showPackingSlip ? (
                                    <Link
                                        href={`/account/orders/${order.id}/packing-slip`}
                                        className="flex w-full items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
                                    >
                                        Sjå følgeseddel
                                    </Link>
                                ) : (
                                    <div className="rounded-[14px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                                        Følgeseddel blir tilgjengeleg når bestillinga er pakka.
                                    </div>
                                )}
                            </div>
                        </section>

                        {order.status === "change_requested" && order.approval.status !== "answered" ? (
                            <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-6">
                                <h2 className="text-lg font-medium text-amber-900">
                                    Handling krevst
                                </h2>

                                <p className="mt-3 text-sm leading-6 text-amber-800">
                                    Nokre varer manglar. Vel korleis de ønskjer at vi skal handtere resten av bestillinga.
                                </p>
                                {missingLines.length ? (
                                    <div className="mt-5 rounded-[18px] border border-amber-200 bg-white p-4">
                                        <h3 className="text-sm font-medium text-amber-950">
                                            Varer som manglar
                                        </h3>
                                        <div className="mt-3 space-y-2">
                                            {missingLines.map((line) => (
                                                <div
                                                    key={`${line.productId}-${line.variantId}`}
                                                    className="flex items-start justify-between gap-4 rounded-[12px] border border-amber-100 bg-amber-50/60 px-3 py-2 text-sm"
                                                >
                                                    <div>
                                                        <div className="font-medium text-neutral-900">
                                                            {line.productName}
                                                        </div>
                                                        <div className="mt-0.5 text-xs text-neutral-500">
                                                            {[line.categoryName || line.category, line.variantLabel]
                                                                .filter(Boolean)
                                                                .join(" / ")}
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 font-medium text-amber-900">
                                                        {line.missingQuantity} stk
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                <div className="mt-5 space-y-3">
                                    {([
                                        "deliver_partial_later",
                                        "deliver_partial_cancel_rest",
                                        "wait_for_complete",
                                    ] as ApprovalResponse[]).map((response) => {
                                        const selected = selectedApprovalResponse === response;

                                        return (
                                            <button
                                                key={response}
                                                type="button"
                                                disabled={savingApproval}
                                                onClick={() => setSelectedApprovalResponse(response)}
                                                className={`w-full rounded-[14px] border px-4 py-3 text-left text-sm transition disabled:opacity-50 ${selected
                                                    ? "border-amber-700 bg-white text-neutral-900"
                                                    : "border-amber-300 bg-white/80 text-neutral-800 hover:bg-white"
                                                    }`}
                                            >
                                                <span className="font-medium">{approvalResponseLabel(response)}</span>
                                                <span className="mt-1 block text-xs leading-5 text-neutral-500">
                                                    {approvalResponseDescription(response)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mt-5 rounded-[14px] border border-amber-200 bg-white px-4 py-3 text-sm text-amber-900">
                                    {approvalResponseDescription(selectedApprovalResponse)}
                                </div>

                                <button
                                    type="button"
                                    disabled={!selectedApprovalResponse || savingApproval}
                                    onClick={handleApprovalResponse}
                                    className="mt-4 w-full rounded-full bg-amber-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {savingApproval ? "Lagrar svar …" : "Bekreft val"}
                                </button>
                            </section>
                        ) : null}
                        {order.approval.status === "answered" ? (
                            <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-6">
                                <h2 className="text-lg font-medium text-emerald-900">
                                    Svaret er registrert
                                </h2>

                                <p className="mt-3 text-sm leading-6 text-emerald-800">
                                    {approvalResponseDescription(order.approval.response)}
                                </p>
                            </section>
                        ) : null}
                    </aside>
                </div>
            </div>
        </main>
    );
}