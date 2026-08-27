"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { arrayUnion, collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { updateOrderLines, type OrderStatus } from "@/lib/ordersFirestore";
import { confirmAdminOrder, sendAdminCustomerEmail, setAdminOrderStatus } from "@/lib/customerEmailActions";
import { groupOrderLinesByBrand } from "@/lib/orderLineSorting";
import ProductOrderPicker from "../../../components/admin/ProductOrderPicker";
import { useSystemFeedback } from "@/app/components/SystemFeedback";
import OrderDeliveryDialog from "@/app/components/admin/OrderDeliveryDialog";
import { requireActiveOperator } from "@/lib/adminOperators";

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

type ApprovalResponse =
    | "deliver_partial_later"
    | "deliver_partial_cancel_rest"
    | "wait_for_complete";

type BackorderStatus = "none" | "open" | "cancelled" | "waiting_for_stock" | "created";

type ApprovalResponseSource = "customer_portal" | "phone" | "email" | "in_person" | "other";

type OrderDetail = {
    id: string;
    orderNumber: string | null;
    status: OrderStatus;
    customerId: string;
    customerName: string;
    customerDisplayName: string;
    customerCompanyName: string;
    customerEmail: string;
    customerType: string;
    customerPhone: string;
    customerContactName: string;
    organizationNumber: string;
    lineCount: number;
    unitCount: number;
    totalExVat: number;
    lines: OrderLine[];
    packingLines: PackingLine[];
    createdAt: string;
    operatorHistory: Array<{
        action: string;
        operator: { id: string; name: string };
        occurredAt: string;
    }>;
    approval: {
        required: boolean;
        status: string;
        response: ApprovalResponse | null;
        respondedBy: string | null;
        respondedForCustomer: boolean;
        responseSource: ApprovalResponseSource | null;
        adminNote: string | null;
    };
    backorder: {
        status: BackorderStatus;
        createdFromApproval: ApprovalResponse | null;
        createdOrderId: string | null;
    };
    sandbox: {
        enabled: boolean;
        sendEmails: boolean;
        orderMode: "customer" | "manual";
    };
    invoice: {
        status: "not_invoiced" | "invoiced";
        invoicedAt: string | null;
    };
    deliverySignature: {
        signedBy: string;
        signedAt: string | null;
        signatureDataUrl: string;
    } | null;
};

type CustomerDetail = {
    id: string;
    companyName: string;
    displayName: string;
    sameAsCompanyName: boolean;
    authUid: string;
    customerSource: "registered" | "manual";
    contactName: string;
    email: string;
    phone: string;
    organizationNumber: string;
    openingHours: string;
};

type OrderChangeRequest = {
    id: string;
    orderId: string;
    orderNumber: string | null;
    customerId: string;
    customerName: string;
    type: "add_lines";
    status: "pending" | "approved" | "rejected";
    message: string;
    adminNote: string;
    createdAt: string;
};

const statusLabels: Record<OrderStatus, string> = {
    new: "Ny",
    processing: "Under behandling",
    packed: "Pakka",
    partial: "Delpakka",
    picked_up: "Henta",
    shipped: "Sendt",
    delivered: "Levert",
    change_requested: "Ventande godkjenning",
    cancelled: "Kansellert",
};

const statusStyles: Record<OrderStatus, string> = {
    new: "border-blue-200 bg-blue-50 text-blue-700",
    processing: "border-amber-200 bg-amber-50 text-amber-800",
    packed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    partial: "border-amber-200 bg-amber-50 text-amber-800",
    picked_up: "border-emerald-200 bg-emerald-50 text-emerald-800",
    shipped: "border-emerald-200 bg-emerald-50 text-emerald-800",
    delivered: "border-emerald-200 bg-emerald-50 text-emerald-800",
    change_requested: "border-rose-200 bg-rose-50 text-rose-700",
    cancelled: "border-neutral-200 bg-neutral-50 text-neutral-500",
};

function formatCurrency(value: number) {
    return new Intl.NumberFormat("nb-NO", {
        style: "currency",
        currency: "NOK",
        maximumFractionDigits: 2,
    }).format(value);
}

function formatDate(value: any) {
    if (value?.toDate) {
        return value.toDate().toLocaleString("nb-NO", {
            dateStyle: "medium",
            timeStyle: "short",
        });
    }

    return "—";
}

function approvalResponseLabel(response: ApprovalResponse | null) {
    if (response === "deliver_partial_later") {
        return "Send det som er pakka no. Resten ettersendast seinare.";
    }

    if (response === "deliver_partial_cancel_rest") {
        return "Send det som er pakka no. Det som manglar blir fjerna.";
    }

    if (response === "wait_for_complete") {
        return "Vent til heile bestillinga er klar før levering.";
    }

    return "Ikkje svart enno";
}

function backorderStatusLabel(status: BackorderStatus) {
    const labels: Record<BackorderStatus, string> = {
        none: "Ingen restordre",
        open: "Restordre open",
        cancelled: "Rest sletta etter kundesvar",
        waiting_for_stock: "Ventar på varer",
        created: "Restordre oppretta",
    };

    return labels[status];
}


function mapOrder(id: string, data: any): OrderDetail {
    const customerCompanyName =
        typeof data.customerCompanyName === "string" && data.customerCompanyName.trim()
            ? data.customerCompanyName
            : typeof data.customerName === "string"
                ? data.customerName
                : "Ukjend kunde";

    const customerDisplayName =
        typeof data.customerDisplayName === "string" && data.customerDisplayName.trim()
            ? data.customerDisplayName
            : customerCompanyName;

    return {
        id,
        orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : null,
        status: (data.status || "new") as OrderStatus,
        customerId: typeof data.customerId === "string" ? data.customerId : "",
        customerName: customerDisplayName,
        customerDisplayName,
        customerCompanyName,
        customerEmail: typeof data.customerEmail === "string" ? data.customerEmail : "",
        customerType: typeof data.customerType === "string" ? data.customerType : "",
        customerPhone: typeof data.customerPhone === "string" ? data.customerPhone : "",
        customerContactName: typeof data.customerContactName === "string" ? data.customerContactName : "",
        organizationNumber: typeof data.organizationNumber === "string" ? data.organizationNumber : "",
        lineCount: typeof data.lineCount === "number" ? data.lineCount : 0,
        unitCount: typeof data.unitCount === "number" ? data.unitCount : 0,
        totalExVat: typeof data.totalExVat === "number" ? data.totalExVat : 0,
        lines: Array.isArray(data.lines) ? data.lines : [],
        packingLines: Array.isArray(data.packing?.lines) ? data.packing.lines : [],
        createdAt: formatDate(data.createdAt),
        operatorHistory: Array.isArray(data.operatorHistory)
            ? data.operatorHistory.flatMap((item: any) =>
                item?.operator?.name
                    ? [{
                        action: typeof item.action === "string" ? item.action : "updated",
                        operator: { id: String(item.operator.id || ""), name: item.operator.name },
                        occurredAt: item.occurredAt ? formatDate(item.occurredAt) : "—",
                    }]
                    : [])
            : [],
        approval: {
            required: data.approval?.required === true,
            status: typeof data.approval?.status === "string" ? data.approval.status : "not_required",
            response: typeof data.approval?.response === "string" ? data.approval.response : null,
            respondedBy: typeof data.approval?.respondedBy === "string" ? data.approval.respondedBy : null,
            respondedForCustomer: data.approval?.respondedForCustomer === true,
            responseSource:
                typeof data.approval?.responseSource === "string"
                    ? data.approval.responseSource
                    : null,
            adminNote: typeof data.approval?.adminNote === "string" ? data.approval.adminNote : null,
        },
        backorder: {
            status: typeof data.backorder?.status === "string" ? data.backorder.status : "none",
            createdFromApproval:
                typeof data.backorder?.createdFromApproval === "string"
                    ? data.backorder.createdFromApproval
                    : null,
            createdOrderId:
                typeof data.backorder?.createdOrderId === "string"
                    ? data.backorder.createdOrderId
                    : null,
        },
        sandbox: {
            enabled: data.sandbox?.enabled === true,
            sendEmails: data.sandbox?.sendEmails === true,
            orderMode: data.sandbox?.orderMode === "manual" ? "manual" : "customer",
        },
        invoice: {
            status: data.invoice?.status === "invoiced" ? "invoiced" : "not_invoiced",
            invoicedAt: data.invoice?.invoicedAt ? formatDate(data.invoice.invoicedAt) : null,
        },
        deliverySignature: data.deliverySignature?.signatureDataUrl
            ? {
                signedBy: typeof data.deliverySignature.signedBy === "string" ? data.deliverySignature.signedBy : "",
                signedAt: data.deliverySignature.signedAt ? formatDate(data.deliverySignature.signedAt) : null,
                signatureDataUrl: data.deliverySignature.signatureDataUrl,
            }
            : null,
    };
}

const operatorActionLabels: Record<string, string> = {
    order_created: "Ordre oppretta",
    order_number_saved: "Ordrenummer registrert",
    order_lines_updated: "Ordrelinjer endra",
    packing_draft_saved: "Plukkliste lagra",
    packing_completed: "Pakking fullført",
    approval_registered: "Kundesvar registrert",
    customer_decision_updated: "Kundeval endra",
    invoice_marked: "Merka som fakturert",
    invoice_reopened: "Flytta tilbake til ikkje fakturert",
    backorder_created: "Restordre oppretta",
    status_processing: "Sett under behandling",
    status_packed: "Merka ferdig pakka",
    status_picked_up: "Merka henta",
    status_shipped: "Merka send",
    status_delivered: "Merka levert",
    status_cancelled: "Ordre kansellert",
};

function operatorUpdate(action: string) {
    const operator = requireActiveOperator();
    return {
        lastUpdatedByOperator: operator,
        operatorHistory: arrayUnion({ action, operator, occurredAt: new Date() }),
    };
}

function mapCustomer(id: string, data: any): CustomerDetail {
    const companyName = typeof data.companyName === "string" ? data.companyName : "";
    const displayName = typeof data.displayName === "string" && data.displayName.trim()
        ? data.displayName
        : companyName;
    return {
        id,
        companyName,
        displayName,
        sameAsCompanyName:
            typeof data.sameAsCompanyName === "boolean"
                ? data.sameAsCompanyName
                : displayName === companyName,
        authUid: typeof data.authUid === "string" ? data.authUid : "",
        customerSource: data.customerSource === "manual" ? "manual" : "registered",
        contactName: typeof data.contactName === "string" ? data.contactName : "",
        email: typeof data.email === "string" ? data.email : "",
        phone: typeof data.phone === "string" ? data.phone : "",
        organizationNumber: typeof data.organizationNumber === "string" ? data.organizationNumber : "",
        openingHours: typeof data.openingHours === "string" ? data.openingHours : "",
    };
}

function mapOrderChangeRequest(id: string, data: any): OrderChangeRequest {
    return {
        id,
        orderId: typeof data.orderId === "string" ? data.orderId : "",
        orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : null,
        customerId: typeof data.customerId === "string" ? data.customerId : "",
        customerName: typeof data.customerName === "string" ? data.customerName : "Ukjend kunde",
        type: "add_lines",
        status:
            data.status === "approved" || data.status === "rejected"
                ? data.status
                : "pending",
        message: typeof data.message === "string" ? data.message : "",
        adminNote: typeof data.adminNote === "string" ? data.adminNote : "",
        createdAt: formatDate(data.createdAt),
    };
}


function getMissingLines(order: OrderDetail) {
    return order.packingLines.filter(
        (line) => typeof line.missingQuantity === "number" && line.missingQuantity > 0
    );
}

function getMissingOrderLines(order: OrderDetail) {
    return order.packingLines
        .filter((line) => typeof line.missingQuantity === "number" && line.missingQuantity > 0)
        .map((packingLine) => {
            const orderLine = order.lines.find(
                (line) => line.productId === packingLine.productId && line.variantId === packingLine.variantId
            );

            if (!orderLine || !packingLine.missingQuantity) return null;

            return {
                ...orderLine,
                quantity: packingLine.missingQuantity,
            };
        })
        .filter((line): line is OrderLine => Boolean(line));
}

export default function AdminOrderDetailPage() {
    const { notify, confirmAction } = useSystemFeedback();
    const params = useParams();
    const orderId = typeof params.id === "string" ? params.id : "";
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [customer, setCustomer] = useState<CustomerDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingStatus, setSavingStatus] = useState(false);
    const [savingInvoice, setSavingInvoice] = useState(false);
    const [creatingBackorder, setCreatingBackorder] = useState(false);
    const [showMobileOrderLines, setShowMobileOrderLines] = useState(false);
    const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
    const [manualApprovalResponse, setManualApprovalResponse] = useState<ApprovalResponse>("deliver_partial_later");
    const [manualApprovalSource, setManualApprovalSource] = useState<ApprovalResponseSource>("phone");
    const [manualApprovalNote, setManualApprovalNote] = useState("");
    const [showManualApprovalForm, setShowManualApprovalForm] = useState(false);
    const [showChangeCustomerDecision, setShowChangeCustomerDecision] = useState(false);
    const [changeRequests, setChangeRequests] = useState<OrderChangeRequest[]>([]);
    const [savingChangeRequestId, setSavingChangeRequestId] = useState<string | null>(null);
    const [changeRequestNotes, setChangeRequestNotes] = useState<Record<string, string>>({});
    const [editingOrderLines, setEditingOrderLines] = useState(false);
    const [editableOrderLines, setEditableOrderLines] = useState<OrderLine[]>([]);
    const [savingOrderLines, setSavingOrderLines] = useState(false);
    const [showSaveOrderLinesConfirm, setShowSaveOrderLinesConfirm] = useState(false);
    const [sendingCustomerEmail, setSendingCustomerEmail] = useState<"confirmation" | "approval" | "packing_slip" | null>(null);
    const [deletingSandboxOrder, setDeletingSandboxOrder] = useState(false);

    useEffect(() => {
        if (!orderId) return;

        const unsubscribe = onSnapshot(doc(db, "orders", orderId), (snapshot) => {
            if (!snapshot.exists()) {
                setOrder(null);
                setLoading(false);
                return;
            }

            const nextOrder = mapOrder(snapshot.id, snapshot.data());
            setOrder(nextOrder);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [orderId]);



    useEffect(() => {
        if (!order?.customerId) {
            setCustomer(null);
            return;
        }

        const unsubscribe = onSnapshot(doc(db, "customers", order.customerId), (snapshot) => {
            if (!snapshot.exists()) {
                setCustomer(null);
                return;
            }

            setCustomer(mapCustomer(snapshot.id, snapshot.data()));
        });

        return () => unsubscribe();
    }, [order?.customerId]);

    useEffect(() => {
        if (!orderId) return;

        const requestsQuery = query(
            collection(db, "orderChangeRequests"),
            where("orderId", "==", orderId)
        );

        const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
            setChangeRequests(
                snapshot.docs
                    .map((requestDoc) =>
                        mapOrderChangeRequest(requestDoc.id, requestDoc.data())
                    )
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            );
        });

        return () => unsubscribe();
    }, [orderId]);

    useEffect(() => {
        if (!orderId || !order) return;

        const updates: Record<string, unknown> = {};

        if (order.status === "new") {
            updates.adminSeenAt = serverTimestamp();
        }

        if (order.approval.status === "answered") {
            updates["approval.adminSeenAt"] = serverTimestamp();
        }

        if (!Object.keys(updates).length) {
            return;
        }

        updateDoc(doc(db, "orders", orderId), updates).catch((error) => {
            console.error("Failed to mark order as seen", error);
        });
    }, [
        orderId,
        order?.status,
        order?.approval.status,
    ]);

    useEffect(() => {
        if (!order || editingOrderLines) return;
        setEditableOrderLines(order.lines);
    }, [order, editingOrderLines]);


    async function updateOrderStatus(nextStatus: OrderStatus) {
        if (nextStatus === "packed") {
            notify("Fullfør pakking frå plukklista. Då blir varene trekte korrekt frå lageret.", "info");
            return;
        }

        if (!orderId) return;

        if (nextStatus === "cancelled") {
            const confirmed = await confirmAction({
                title: "Kanseller ordre?",
                message: "Ordren blir flytta til historikken.",
                confirmLabel: "Kanseller ordre",
                destructive: true,
            });

            if (!confirmed) return;
        }

        try {
            setSavingStatus(true);

            if (!auth.currentUser) throw new Error("UNAUTHORIZED");
            await setAdminOrderStatus(auth.currentUser, orderId, nextStatus);
        } catch (error) {
            console.error(error);
            notify("Kunne ikkje oppdatere status.", "error");
        } finally {
            setSavingStatus(false);
        }
    }

    async function confirmOrder() {
        if (!orderId) return;
        try {
            setSavingStatus(true);
            if (!auth.currentUser) throw new Error("UNAUTHORIZED");
            await confirmAdminOrder(auth.currentUser, orderId);
            notify("Ordren er stadfesta og sett under behandling.", "success");
        } catch (error) {
            console.error(error);
            notify("Kunne ikkje stadfeste ordren.", "error");
        } finally {
            setSavingStatus(false);
        }
    }

    async function markAsInvoiced() {
        if (!orderId || !order?.orderNumber) return;

        try {
            setSavingInvoice(true);

            await updateDoc(doc(db, "orders", orderId), {
                "invoice.status": "invoiced",
                "invoice.invoicedAt": serverTimestamp(),
                ...operatorUpdate("invoice_marked"),
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error(error);
            notify("Kunne ikkje markere ordren som fakturert.", "error");
        } finally {
            setSavingInvoice(false);
        }
    }

    async function markAsNotInvoiced() {
        if (!orderId) return;

        try {
            setSavingInvoice(true);

            await updateDoc(doc(db, "orders", orderId), {
                "invoice.status": "not_invoiced",
                "invoice.invoicedAt": null,
                ...operatorUpdate("invoice_reopened"),
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error(error);
            notify("Kunne ikkje markere ordren som ikkje fakturert.", "error");
        } finally {
            setSavingInvoice(false);
        }
    }

    async function sendForApproval() {
        if (!orderId) return;

        try {
            setSavingStatus(true);
            setSendingCustomerEmail("approval");
            if (!auth.currentUser) throw new Error("UNAUTHORIZED");
            const result = await sendAdminCustomerEmail(auth.currentUser, orderId, "approval") as {
                emailSent?: boolean;
                portalPublished?: boolean;
            };
            notify(
                result.emailSent === false
                    ? "Godkjenninga er publisert i kundeportalen. Sandbox-e-post er ikkje send."
                    : "Godkjenningsførespurnaden er send til kunden og publisert i kundeportalen.",
                "success"
            );
        } catch (error) {
            console.error(error);
            notify("Kunne ikkje sende til kundegodkjenning.", "error");
        } finally {
            setSavingStatus(false);
            setSendingCustomerEmail(null);
        }
    }

    async function sendCustomerDocument(type: "confirmation" | "packing_slip") {
        if (!orderId || !auth.currentUser) return;
        try {
            setSendingCustomerEmail(type);
            await sendAdminCustomerEmail(auth.currentUser, orderId, type);
            notify(type === "confirmation" ? "Ordrebekreftinga er send." : "Følgjesetelen er send.", "success");
        } catch (error) {
            console.error(error);
            notify("Kunne ikkje sende e-posten. Kontroller at kunden har ei gyldig e-postadresse.", "error");
        } finally {
            setSendingCustomerEmail(null);
        }
    }

    async function deleteSandboxOrder() {
        if (!orderId || !order?.sandbox.enabled || !auth.currentUser) return;

        const confirmed = await confirmAction({
            title: "Slett sandbox-ordren?",
            message: "Ordren, eventuelle restordrar og tilknytte testførespurnader blir sletta permanent. Dette kan ikkje angrast.",
            confirmLabel: "Slett testordren",
            destructive: true,
        });
        if (!confirmed) return;

        try {
            setDeletingSandboxOrder(true);
            const token = await auth.currentUser.getIdToken();
            const response = await fetch("/api/admin/orders/sandbox-delete", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ orderId }),
            });
            const result = await response.json().catch(() => ({})) as { error?: string };
            if (!response.ok) throw new Error(result.error || "SANDBOX_DELETE_FAILED");
            window.location.assign("/admin/orders");
        } catch (error) {
            console.error(error);
            notify("Kunne ikkje slette sandbox-ordren.", "error");
        } finally {
            setDeletingSandboxOrder(false);
        }
    }

    async function updateCustomerDecision(
        response: ApprovalResponse,
        options?: {
            responseSource?: ApprovalResponseSource;
            adminNote?: string;
            respondedBy?: string;
            respondedForCustomer?: boolean;
        }
    ) {
        if (!orderId) return;

        const responseSource = options?.responseSource ?? "customer_portal";
        const adminNote = options?.adminNote?.trim() || null;
        const respondedBy = options?.respondedBy ?? "customer";
        const respondedForCustomer = options?.respondedForCustomer === true;

        const approvalUpdates = {
            "approval.status": "answered",
            "approval.response": response,
            "approval.respondedBy": respondedBy,
            "approval.respondedForCustomer": respondedForCustomer,
            "approval.responseSource": responseSource,
            "approval.adminNote": adminNote,
            "approval.respondedAt": serverTimestamp(),
            "approval.adminSeenAt": serverTimestamp(),
        };

        try {
            setSavingStatus(true);

            if (order?.approval.response === response) {
                notify("Dette er allereie kunden sitt registrerte val.", "info");
                return;
            }

            const orderRef = doc(db, "orders", orderId);
            const nextUpdates = response === "deliver_partial_cancel_rest"
                ? {
                    status: "packed",
                    ...approvalUpdates,
                    "backorder.status": "cancelled",
                    "backorder.createdOrderId": null,
                    "backorder.createdAt": null,
                    updatedAt: serverTimestamp(),
                }
                : response === "wait_for_complete"
                    ? {
                        status: "processing",
                        ...approvalUpdates,
                        "backorder.status": "waiting_for_stock",
                        "backorder.createdOrderId": null,
                        "backorder.createdAt": null,
                        updatedAt: serverTimestamp(),
                    }
                    : {
                        status: "packed",
                        ...approvalUpdates,
                        "backorder.status": "open",
                        updatedAt: serverTimestamp(),
                    };
            Object.assign(nextUpdates, operatorUpdate("customer_decision_updated"));

            if (order?.backorder.createdOrderId && response !== "deliver_partial_later") {
                const batch = writeBatch(db);
                batch.delete(doc(db, "orders", order.backorder.createdOrderId));
                batch.update(orderRef, nextUpdates);
                await batch.commit();
            } else {
                await updateDoc(orderRef, nextUpdates);
            }

            setShowChangeCustomerDecision(false);
            notify(
                response === "deliver_partial_cancel_rest"
                    ? "Kundevalet er endra, og restordren er fjerna."
                    : response === "wait_for_complete"
                        ? "Kundevalet er endra. Ordren ventar no på resten."
                        : "Kundevalet er endra. Restordre blir oppretta.",
                "success"
            );
        } catch (error) {
            console.error(error);
            notify(
                error instanceof Error
                    ? error.message
                    : "Kunne ikkje oppdatere kundesvar.",
                "error"
            );
        } finally {
            setSavingStatus(false);
        }
    }

    async function registerCustomerDecisionForCustomer() {
        await updateCustomerDecision(manualApprovalResponse, {
            responseSource: manualApprovalSource,
            adminNote: manualApprovalNote,
            respondedBy: "admin",
            respondedForCustomer: true,
        });
        setManualApprovalNote("");
    }

    async function resolveChangeRequest(
        request: OrderChangeRequest,
        status: "approved" | "rejected"
    ) {
        const adminNote = changeRequestNotes[request.id]?.trim() || "";

        if (status === "approved") {
            const confirmed = await confirmAction({
                title: "Godkjenn førespurnaden?",
                message: "Stadfest at du har kontrollert førespurnaden og gjort nødvendige endringar i ordren. Førespurnaden blir merkt som handtert.",
                confirmLabel: "Merk som handtert",
            });

            if (!confirmed) return;
        }

        try {
            setSavingChangeRequestId(request.id);

            await updateDoc(doc(db, "orderChangeRequests", request.id), {
                status,
                adminNote,
                resolvedBy: "admin",
                resolvedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error(error);
            notify("Kunne ikkje oppdatere førespurnaden.", "error");
        } finally {
            setSavingChangeRequestId(null);
        }
    }

    function startEditingOrderLines() {
        if (!order) return;

        if (!["new", "processing", "change_requested"].includes(order.status)) {
            notify("Denne ordren er komen for langt i behandling til å endrast direkte her.", "error");
            return;
        }

        setEditableOrderLines(order.lines);
        setEditingOrderLines(true);
    }

    function cancelEditingOrderLines() {
        setEditableOrderLines(order?.lines || []);
        setEditingOrderLines(false);
    }

    function updateEditableLineQuantity(productId: string, variantId: string, quantity: number) {
        setEditableOrderLines((prev) =>
            prev.map((line) =>
                line.productId === productId && line.variantId === variantId
                    ? { ...line, quantity }
                    : line
            )
        );
    }

    function removeEditableLine(productId: string, variantId: string) {
        setEditableOrderLines((prev) =>
            prev.filter((line) => !(line.productId === productId && line.variantId === variantId))
        );
    }


    function requestSaveEditedOrderLines() {
        const nextLines = editableOrderLines
            .map((line) => ({
                ...line,
                quantity: Math.max(0, Math.floor(Number(line.quantity) || 0)),
            }))
            .filter((line) => line.quantity > 0);

        if (!nextLines.length) {
            notify("Ordren må ha minst éi varelinje.", "error");
            return;
        }

        setShowSaveOrderLinesConfirm(true);
    }

    async function saveEditedOrderLines() {
        if (!orderId || !order) return;

        const nextLines = editableOrderLines
            .map((line) => ({
                ...line,
                quantity: Math.max(0, Math.floor(Number(line.quantity) || 0)),
            }))
            .filter((line) => line.quantity > 0);

        try {
            setSavingOrderLines(true);
            await updateOrderLines(orderId, nextLines);
            setShowSaveOrderLinesConfirm(false);
            setEditingOrderLines(false);
        } catch (error) {
            console.error(error);
            notify("Kunne ikkje lagre ordrelinjene.", "error");
        } finally {
            setSavingOrderLines(false);
        }
    }
    async function createBackorder() {
        if (!orderId || !order) return;

        const backorderLines = getMissingOrderLines(order);

        if (!backorderLines.length) {
            notify("Det finst ingen manglande varer å opprette restordre frå.", "info");
            return;
        }

        try {
            setCreatingBackorder(true);

            const lineCount = backorderLines.length;
            const unitCount = backorderLines.reduce((sum, line) => sum + line.quantity, 0);
            const totalExVat = backorderLines.reduce(
                (sum, line) => sum + line.quantity * line.unitPrice,
                0
            );

            const backorderRef = doc(db, "orders", `backorder-${orderId}`);
            await setDoc(backorderRef, {
                orderNumber: null,
                status: "new" as OrderStatus,
                customerId: order.customerId,
                customerName: order.customerName,
                customerDisplayName: order.customerDisplayName,
                customerCompanyName: order.customerCompanyName,
                customerEmail: order.customerEmail,
                customerType: order.customerType,
                customerPhone: order.customerPhone,
                customerContactName: order.customerContactName,
                organizationNumber: order.organizationNumber,
                lineCount,
                unitCount,
                totalExVat,
                lines: backorderLines,
                isBackorder: true,
                parentOrderId: order.id,
                parentOrderNumber: order.orderNumber,
                source: order.sandbox.enabled ? order.sandbox.orderMode : "manual",
                sandbox: order.sandbox.enabled ? order.sandbox : null,
                packing: {
                    status: "not_started",
                    lines: backorderLines.map((line) => ({
                        productId: line.productId,
                        variantId: line.variantId,
                        orderedQuantity: line.quantity,
                        packedQuantity: null,
                        missingQuantity: null,
                    })),
                },
                approval: {
                    required: false,
                    status: "not_required",
                    response: null,
                    respondedBy: null,
                    respondedAt: null,
                    message: null,
                },
                backorder: {
                    status: "none",
                    createdFromApproval: null,
                    note: null,
                },
                invoice: {
                    status: "not_invoiced",
                    invoicedAt: null,
                },
                createdByOperator: requireActiveOperator(),
                lastUpdatedByOperator: requireActiveOperator(),
                operatorHistory: [{ action: "order_created", operator: requireActiveOperator(), occurredAt: new Date() }],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            await updateDoc(doc(db, "orders", orderId), {
                "backorder.status": "created",
                "backorder.createdOrderId": backorderRef.id,
                "backorder.createdAt": serverTimestamp(),
                ...operatorUpdate("backorder_created"),
                updatedAt: serverTimestamp(),
            });
            notify("Pakkinga er stadfesta, og restordren er oppretta.", "success");
        } catch (error) {
            console.error(error);
            notify("Kunne ikkje opprette restordre.", "error");
        } finally {
            setCreatingBackorder(false);
        }
    }

    // Automatically create backorder if customer approved deliver_partial_later and backorder is open
    useEffect(() => {
        if (!order || creatingBackorder) return;

        const shouldAutoCreateBackorder =
            order.approval.status === "answered" &&
            order.approval.response === "deliver_partial_later" &&
            order.backorder.status === "open";

        if (!shouldAutoCreateBackorder) {
            return;
        }

        void createBackorder();
    }, [order, creatingBackorder]);

    const groupedLines = order ? groupOrderLinesByBrand(order.lines) : { safteri: [], bryggeri: [] };
    const missingLines = order ? getMissingLines(order) : [];
    const missingOrderLines = order ? getMissingOrderLines(order) : [];

    const packingStatus =
        order?.status === "packed"
            ? "Pakka komplett"
            : order?.status === "partial"
                ? "Delpakka"
                : order?.status === "change_requested"
                    ? "Ventande kundesvar"
                    : "Sjå plukkliste";

    const customerHasPortalAccess = Boolean(customer?.authUid);
    const customerCanReceiveEmail = Boolean(order?.customerEmail?.trim());
    const shouldShowCustomerApprovalButton = order?.status === "partial" && customerCanReceiveEmail;
    const shouldShowCustomerDecision =
        order?.approval.status === "waiting" ||
        order?.status === "partial";
    const pendingChangeRequests = changeRequests.filter((request) => request.status === "pending");
    const resolvedChangeRequests = changeRequests.filter((request) => request.status !== "pending");
    const nextAction = (() => {
        if (order?.status === "new") {
            return {
                eyebrow: "Neste steg",
                title: "Stadfest ordre",
                description: "Kontroller kunde, varer og pris før ordren blir sett under behandling.",
                href: "#order-number",
                label: "Stadfest og start behandling",
            };
        }
        if (order?.status === "processing") {
            return {
                eyebrow: "Neste steg",
                title: "Pakk ordren",
                description: "Opne plukklista, registrer pakka mengde og fullfør pakkinga.",
                href: `/admin/orders/${order.id}/pick`,
                label: "Opne plukkliste",
            };
        }
        if (order?.status === "partial" && order.approval.status !== "waiting") {
            return {
                eyebrow: "Neste steg",
                title: "Avklar manglande varer",
                description: "Send ordren til kunden for godkjenning, eller registrer avtalen manuelt.",
                href: "#packing",
                label: "Gå til kundegodkjenning",
            };
        }
        if (order?.status === "partial" || order?.status === "change_requested") {
            return {
                eyebrow: "Ventar",
                title: order.status === "change_requested" ? "Kunden har sendt eit endringsønske" : "Ventar på kundesvar",
                description: order.status === "change_requested"
                    ? "Kontroller ønsket og oppdater ordren før førespurnaden blir merkt som handtert."
                    : "Kunden må velje korleis dei manglande varene skal handterast.",
                href: "#customer-response",
                label: "Sjå oppfølging",
            };
        }
        if (order?.status === "packed") {
            return {
                eyebrow: "Neste steg",
                title: "Registrer utlevering",
                description: "Marker ordren som send, levert eller henta når varene går frå dykk.",
                href: `/admin/orders/${order.id}/signature`,
                label: "Registrer utlevering",
            };
        }
        if (["shipped", "delivered", "picked_up"].includes(order?.status || "") && order?.invoice.status !== "invoiced") {
            return {
                eyebrow: "Neste steg",
                title: "Merk ordren som fakturert",
                description: "Utleveringa er registrert. Når fakturaen er oppretta, kan ordren avsluttast som fakturert.",
                href: "#invoice",
                label: "Gå til fakturering",
            };
        }
        return {
            eyebrow: "Status",
            title: statusLabels[order?.status || "processing"],
            description: "Ordren er avslutta. Dokument, fakturering og mottak ligg framleis tilgjengeleg nedanfor.",
            href: "#documents",
            label: "Sjå dokument",
        };
    })();

    if (loading) {
        return (
            <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
                <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-neutral-600">
                    Lastar ordre …
                </div>
            </main>
        );
    }

    if (!order) {
        return (
            <main className="min-h-screen bg-[#f7f5f1] text-neutral-900">
                <div className="mx-auto max-w-5xl px-6 py-10">
                    <Link href="/admin/orders" className="text-sm text-neutral-600 underline-offset-4 hover:underline">
                        ← Tilbake til ordre
                    </Link>
                    <div className="mt-6 rounded-[24px] border border-neutral-200 bg-white p-6">
                        <h1 className="text-2xl font-semibold tracking-tight">Fann ikkje ordre</h1>
                        <p className="mt-2 text-sm text-neutral-600">
                            Ordren finst ikkje, eller han er sletta.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="admin-order-detail min-h-screen text-[color:var(--admin-ink)]">
            {showSaveOrderLinesConfirm ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
                    <div className="w-full max-w-md rounded-[24px] border border-neutral-200 bg-white p-6 shadow-xl">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                            Stadfest endring
                        </div>

                        <h2 className="mt-2 text-xl font-semibold tracking-tight text-neutral-950">
                            Lagre endringar på ordren?
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-neutral-600">
                            Ordrelinjene blir oppdaterte, og plukklista blir nullstilt til «ikkje starta». Bruk dette berre før ordren er pakka.
                        </p>

                        <div className="mt-6 grid gap-2 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setShowSaveOrderLinesConfirm(false)}
                                disabled={savingOrderLines}
                                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50"
                            >
                                Avbryt
                            </button>

                            <button
                                type="button"
                                onClick={saveEditedOrderLines}
                                disabled={savingOrderLines}
                                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
                            >
                                {savingOrderLines ? "Lagrar …" : "Lagre endringar"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            <div className="mx-auto max-w-7xl px-5 py-7 md:px-8 md:py-10">
                <Link
                    href="/admin/orders"
                    className="text-xs font-medium text-[color:var(--admin-muted)] underline-offset-4 hover:text-[color:var(--admin-ink)] hover:underline"
                >
                    ← Tilbake til ordre
                </Link>

                <header className="mt-5 rounded-[22px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:mt-6 md:p-7">
                    {order.status === "cancelled" ? (
                        <section className="mt-5 rounded-[24px] border border-neutral-300 bg-neutral-100 p-5 text-neutral-800 md:mt-6 md:p-6">
                            <h2 className="text-lg font-medium">Kansellert ordre</h2>
                            <p className="mt-2 text-sm text-neutral-700">
                                Denne ordren er kansellert og ligg no i historikken.
                            </p>
                        </section>
                    ) : null}
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--admin-muted)]">
                                Ordre
                            </p>

                            {order.sandbox.enabled ? (
                                <span className="mt-3 inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-800">
                                    Sandbox · {order.sandbox.orderMode === "manual" ? "manuell ordre" : "kundekonto"} · e-post {order.sandbox.sendEmails ? "på" : "av"}
                                </span>
                            ) : null}

                            <h1 className="mt-2 break-words text-4xl tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
                                {order.orderNumber || order.id.slice(0, 8).toUpperCase()}
                            </h1>

                            <p className="mt-3 text-base leading-6 text-neutral-600 md:text-sm">
                                {order.customerId ? (
                                    <Link
                                        href={`/admin/customers/${order.customerId}?fromOrder=${order.id}`}
                                        className="underline-offset-4 hover:underline"
                                    >
                                        {customer?.displayName || order.customerDisplayName || order.customerName}
                                    </Link>
                                ) : (
                                    order.customerName
                                )} · {order.createdAt}
                            </p>
                        </div>

                        <span className={`inline-flex w-full rounded-full border px-3 py-2 text-sm md:w-auto md:py-1.5 ${statusStyles[order.status]}`}>
                            {statusLabels[order.status]}
                        </span>
                    </div>
                    {order.sandbox.enabled ? (
                        <div className="mt-5 border-t border-violet-100 pt-4">
                            <button
                                type="button"
                                onClick={deleteSandboxOrder}
                                disabled={deletingSandboxOrder}
                                className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                            >
                                {deletingSandboxOrder ? "Slettar …" : "Slett sandbox-ordre"}
                            </button>
                        </div>
                    ) : null}
                </header>

                <section className={`mt-5 flex flex-col gap-5 rounded-[22px] border p-5 md:flex-row md:items-center md:justify-between md:p-6 ${
                    order.status === "change_requested" || order.status === "partial"
                        ? "border-amber-200 bg-amber-50/80"
                        : "border-[color:var(--admin-line)] bg-[color:var(--admin-card)]"
                }`}>
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-muted)]">{nextAction.eyebrow}</p>
                        <h2 className="mt-2 text-xl font-semibold tracking-tight">{nextAction.title}</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--admin-muted)]">{nextAction.description}</p>
                    </div>
                    {order.status === "new" ? (
                        <button
                            type="button"
                            onClick={confirmOrder}
                            disabled={savingStatus}
                            className="inline-flex w-full shrink-0 items-center justify-center rounded-full bg-[color:var(--admin-accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--admin-accent-hover)] disabled:opacity-50 md:w-auto"
                        >
                            {savingStatus ? "Stadfestar …" : "Stadfest og start behandling"}
                        </button>
                    ) : order.status === "partial" && order.approval.status !== "waiting" && customerCanReceiveEmail ? (
                        <button
                            type="button"
                            onClick={sendForApproval}
                            disabled={savingStatus}
                            className="inline-flex w-full shrink-0 items-center justify-center rounded-full bg-[color:var(--admin-accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--admin-accent-hover)] disabled:opacity-50 md:w-auto"
                        >
                            {sendingCustomerEmail === "approval" ? "Sender …" : "Send til kundegodkjenning"}
                        </button>
                    ) : order.status === "packed" ? (
                        <button
                            type="button"
                            onClick={() => setShowDeliveryDialog(true)}
                            className="inline-flex w-full shrink-0 items-center justify-center rounded-full bg-[color:var(--admin-accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--admin-accent-hover)] md:w-auto"
                        >
                            Registrer utlevering
                        </button>
                    ) : ["shipped", "delivered", "picked_up"].includes(order.status) && order.invoice.status !== "invoiced" ? (
                        <button
                            type="button"
                            onClick={markAsInvoiced}
                            disabled={savingInvoice || !order.orderNumber}
                            className="inline-flex w-full shrink-0 items-center justify-center rounded-full bg-[color:var(--admin-accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--admin-accent-hover)] disabled:opacity-50 md:w-auto"
                        >
                            {savingInvoice ? "Lagrar …" : "Merk som fakturert"}
                        </button>
                    ) : (
                        <Link href={nextAction.href} className="inline-flex shrink-0 items-center justify-center rounded-full bg-[color:var(--admin-accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--admin-accent-hover)]">
                            {nextAction.label}
                        </Link>
                    )}
                </section>

                {showDeliveryDialog ? (
                    <OrderDeliveryDialog
                        orderId={order.id}
                        overlay
                        onClose={() => setShowDeliveryDialog(false)}
                        onComplete={() => setShowDeliveryDialog(false)}
                    />
                ) : null}

                <div className="mt-5 grid gap-5 md:mt-6 md:gap-6 lg:grid-cols-[2fr_1fr]">
                    <section className="hidden rounded-[22px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:block md:p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-medium">Ordrelinjer</h2>
                                <p className="mt-2 text-sm text-neutral-500">
                                    Neste steg er pakking. Her vil bestilt antal, pakka antal og eventuelle restordrer bli registrerte.
                                </p>
                            </div>
                            {!editingOrderLines ? (
                                <button
                                    type="button"
                                    onClick={startEditingOrderLines}
                                    disabled={!["new", "processing", "change_requested"].includes(order.status)}
                                    className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Rediger ordre
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={cancelEditingOrderLines}
                                        disabled={savingOrderLines}
                                        className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50"
                                    >
                                        Avbryt
                                    </button>
                                    <button
                                        type="button"
                                        onClick={requestSaveEditedOrderLines}
                                        disabled={savingOrderLines}
                                        className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
                                    >
                                        {savingOrderLines ? "Lagrar …" : "Lagre endringar"}
                                    </button>
                                </div>
                            )}
                        </div>

                        {editingOrderLines ? (
                            <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                Endringar nullstiller plukklista til ikkje starta. Bruk dette berre før ordren er pakka.
                            </div>
                        ) : null}

                        {editingOrderLines ? (
                            <div className="mt-5">
                                <ProductOrderPicker
                                    customerType={order.customerType}
                                    mode="edit"
                                    lines={editableOrderLines}
                                    onChange={setEditableOrderLines}
                                    title="Legg til eller endre varer"
                                    description="Søk opp produkt, juster antal og lagre endringane når ordren er klar."
                                    showProductsBeforeSearch={false}
                                />
                            </div>
                        ) : null}

                        <div className="mt-5 space-y-8">
                            {([
                                ["Valldal Safteri", groupOrderLinesByBrand(editingOrderLines ? editableOrderLines : order.lines).safteri, "text-rose-700"],
                                ["Valldal Bryggeri", groupOrderLinesByBrand(editingOrderLines ? editableOrderLines : order.lines).bryggeri, "text-amber-700"],
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

                                        {/* Mobile cards block moved outside table */}
                                        <div className="space-y-3 md:hidden">
                                            {lines.map((line) => (
                                                <div
                                                    key={`${line.productId}-${line.variantId}`}
                                                    className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4"
                                                >
                                                    <div className="font-medium text-neutral-900">
                                                        {line.productName}
                                                    </div>
                                                    <div className="mt-1 text-sm text-neutral-500">
                                                        {[line.categoryName || line.category, line.variantLabel]
                                                            .filter(Boolean)
                                                            .join(" / ")}
                                                    </div>

                                                    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                                                        <div>
                                                            <div className="text-xs uppercase tracking-[0.12em] text-neutral-400">
                                                                Antal
                                                            </div>
                                                            <div className="mt-1 font-medium text-neutral-900">
                                                                {line.quantity}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xs uppercase tracking-[0.12em] text-neutral-400">
                                                                Pris
                                                            </div>
                                                            <div className="mt-1 font-medium text-neutral-900">
                                                                {formatCurrency(line.unitPrice)}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xs uppercase tracking-[0.12em] text-neutral-400">
                                                                Sum
                                                            </div>
                                                            <div className="mt-1 font-medium text-neutral-900">
                                                                {formatCurrency(line.quantity * line.unitPrice)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="hidden overflow-hidden rounded-[18px] border border-neutral-200 md:block">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-neutral-50 text-xs uppercase tracking-[0.12em] text-neutral-500">
                                                    <tr>
                                                        <th className="px-4 py-3 font-medium">Produkt</th>
                                                        <th className="px-4 py-3 font-medium">Antal</th>
                                                        <th className="px-4 py-3 font-medium">Pris</th>
                                                        <th className="px-4 py-3 font-medium">Sum</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-neutral-100">
                                                    {lines.map((line) => (
                                                        <tr key={`${line.productId}-${line.variantId}`}>
                                                            <td className="px-4 py-3">
                                                                <div className="font-medium text-neutral-900">
                                                                    {line.productName}
                                                                </div>
                                                                <div className="mt-1 text-xs text-neutral-500">
                                                                    {[line.categoryName || line.category, line.variantLabel]
                                                                        .filter(Boolean)
                                                                        .join(" / ")}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-neutral-700">
                                                                {editingOrderLines ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                updateEditableLineQuantity(
                                                                                    line.productId,
                                                                                    line.variantId,
                                                                                    Math.max(0, line.quantity - 1)
                                                                                )
                                                                            }
                                                                            disabled={line.quantity <= 0}
                                                                            className="h-8 w-8 rounded-full border border-neutral-300 bg-white text-sm disabled:opacity-40"
                                                                        >
                                                                            −
                                                                        </button>

                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            value={line.quantity > 0 ? line.quantity : ""}
                                                                            onChange={(event) =>
                                                                                updateEditableLineQuantity(
                                                                                    line.productId,
                                                                                    line.variantId,
                                                                                    Math.max(0, Math.floor(Number(event.target.value) || 0))
                                                                                )
                                                                            }
                                                                            className="w-16 rounded-[10px] border border-neutral-200 px-2 py-1 text-center text-sm outline-none [appearance:textfield] focus:border-neutral-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                                        />

                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                updateEditableLineQuantity(
                                                                                    line.productId,
                                                                                    line.variantId,
                                                                                    line.quantity + 1
                                                                                )
                                                                            }
                                                                            className="h-8 w-8 rounded-full border border-neutral-300 bg-white text-sm"
                                                                        >
                                                                            +
                                                                        </button>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeEditableLine(line.productId, line.variantId)}
                                                                            className="ml-2 text-xs text-rose-700 underline-offset-4 hover:underline"
                                                                        >
                                                                            Fjern
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    line.quantity
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-neutral-700">
                                                                {formatCurrency(line.unitPrice)} eks. mva.
                                                            </td>
                                                            <td className="px-4 py-3 font-medium text-neutral-900">
                                                                {formatCurrency(line.quantity * line.unitPrice)} eks. mva.
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="mt-3 text-right text-sm font-medium text-neutral-700 md:mt-3">
                                            Delsum: {formatCurrency(subtotal)} eks. mva.
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <aside className="flex flex-col gap-5">
                        {/* 1. Pakking og restordre */}
                        <section id="packing" className="order-2 scroll-mt-6 rounded-[20px] border border-amber-200 bg-amber-50 p-5 md:order-1">
                            <h2 className="text-lg font-medium text-amber-900">Pakking og restordre</h2>

                            <div className="mt-4 space-y-3 text-sm text-amber-900">
                                <div className="flex justify-between gap-4">
                                    <span>Pakkestatus</span>
                                    <span>{packingStatus}</span>
                                </div>
                            </div>

                            <p className="mt-4 text-xs leading-5 text-amber-800">
                                Bruk plukklista når ordren skal pakkast. Dersom noko manglar, blir ordren delpakka og kan sendast vidare til kundegodkjenning.
                            </p>

                            <div className="mt-5 space-y-3">
                                <Link
                                    href={`/admin/orders/${order.id}/pick`}
                                    className="inline-flex w-full items-center justify-center rounded-full bg-amber-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800"
                                >
                                    Opne plukkliste
                                </Link>

                            </div>
                        </section>

                        {/* 2. Kunde */}
                        <section className="order-4 rounded-[20px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:order-2">
                            <div className="flex items-start justify-between gap-4">
                                <h2 className="text-lg font-medium">Kunde</h2>
                                {order.customerId ? (
                                    <Link
                                        href={`/admin/customers/${order.customerId}?fromOrder=${order.id}`}
                                        className="text-sm text-neutral-600 underline-offset-4 hover:underline"
                                    >
                                        Opne kunde →
                                    </Link>
                                ) : null}
                            </div>

                            <div className="mt-4 space-y-2 text-sm text-neutral-600">
                                <div>
                                    <p className="font-medium text-neutral-900">
                                        {customer?.displayName || order.customerDisplayName || order.customerName}
                                    </p>
                                    {(customer?.displayName || order.customerDisplayName) !== (customer?.companyName || order.customerCompanyName) ? (
                                        <p className="mt-1 text-xs text-neutral-500">
                                            Fakturerast til: {customer?.companyName || order.customerCompanyName}
                                        </p>
                                    ) : null}
                                </div>
                                <p>Kontakt: {customer?.contactName || order.customerContactName || "—"}</p>
                                <p>E-post: {customer?.email || order.customerEmail || "Ingen e-post lagra"}</p>
                                <p>Telefon: {customer?.phone || order.customerPhone || "—"}</p>
                                <p>Org.nr.: {customer?.organizationNumber || order.organizationNumber || "—"}</p>
                                <p>Prisgruppe: {order.customerType || "—"}</p>
                                <p>
                                    Kundekonto: {customerHasPortalAccess ? "Ja" : "Nei"}
                                </p>
                            </div>
                        </section>

                        {/* 3. Leveringsinfo (optional) */}
                        {customer?.openingHours ? (
                            <section className="order-5 rounded-[20px] border border-rose-100 bg-[#fffafa] p-5 md:order-3">
                                <h2 className="text-lg font-medium text-rose-900">Leveringsinfo</h2>
                                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-neutral-700">
                                    {customer.openingHours}
                                </p>
                            </section>
                        ) : null}

                        {/* 4. Mottak */}
                        <section className="order-3 rounded-[20px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:order-8">
                            <h2 className="text-lg font-medium">Mottak</h2>
                            <p className="mt-1 text-sm text-neutral-500">
                                Signer digitalt ved levering eller henting.
                            </p>

                            {order.deliverySignature ? (
                                <div className="mt-4 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                                    <div className="font-medium">Signert mottak</div>
                                    <div className="mt-1 text-emerald-800">
                                        {order.deliverySignature.signedBy || "Ukjend mottakar"}
                                        {order.deliverySignature.signedAt ? ` · ${order.deliverySignature.signedAt}` : ""}
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-4 rounded-[14px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                                    Ikkje signert enno.
                                </div>
                            )}

                            <Link
                                href={`/admin/orders/${order.id}/signature`}
                                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                            >
                                {order.deliverySignature ? "Signer på nytt" : "Signer mottak"}
                            </Link>
                        </section>

                        {order.operatorHistory.length ? (
                            <section className="order-7 rounded-[20px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:order-10">
                                <h2 className="text-lg font-medium">Aktivitet</h2>
                                <p className="mt-1 text-sm text-neutral-500">
                                    Kven som har utført dei siste handlingane.
                                </p>
                                <ol className="mt-4 space-y-3">
                                    {[...order.operatorHistory].reverse().slice(0, 8).map((item, index) => (
                                        <li key={`${item.action}-${item.occurredAt}-${index}`} className="border-l-2 border-neutral-200 pl-3 text-sm">
                                            <p className="font-medium text-neutral-800">
                                                {operatorActionLabels[item.action] || "Ordren er oppdatert"}
                                            </p>
                                            <p className="mt-0.5 text-xs text-neutral-500">
                                                {item.operator.name} · {item.occurredAt}
                                            </p>
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        ) : null}

                        {/* 5. Dokument */}
                        <section id="documents" className="order-6 scroll-mt-6 rounded-[20px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:order-9">
                            <h2 className="text-lg font-medium">Dokument</h2>
                            <p className="mt-1 text-sm text-neutral-500">
                                Finn att ordrebekreftelse og følgeseddel for denne ordren.
                            </p>

                            <div className="mt-4 grid gap-2">
                                <Link
                                    href={`/admin/orders/${order.id}/confirmation`}
                                    className="inline-flex items-center justify-between rounded-[14px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800 transition hover:bg-white"
                                >
                                    <span>Ordrebekreftelse</span>
                                    <span aria-hidden="true">→</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => sendCustomerDocument("confirmation")}
                                    disabled={Boolean(sendingCustomerEmail)}
                                    className="inline-flex items-center justify-center rounded-[14px] border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-800 disabled:opacity-50"
                                >
                                    {sendingCustomerEmail === "confirmation" ? "Sender ordrebekrefting …" : "Send ordrebekrefting til kunden"}
                                </button>
                                <Link
                                    href={`/admin/orders/${order.id}/packing-slip`}
                                    className="inline-flex items-center justify-between rounded-[14px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800 transition hover:bg-white"
                                >
                                    <span>Følgeseddel</span>
                                    <span aria-hidden="true">→</span>
                                </Link>
                                {["shipped", "delivered", "picked_up"].includes(order.status) ? (
                                    <button
                                        type="button"
                                        onClick={() => sendCustomerDocument("packing_slip")}
                                        disabled={Boolean(sendingCustomerEmail)}
                                        className="inline-flex items-center justify-center rounded-[14px] border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-800 disabled:opacity-50"
                                    >
                                        {sendingCustomerEmail === "packing_slip" ? "Sender følgjesetel …" : "Send følgjesetel på nytt"}
                                    </button>
                                ) : null}
                            </div>
                        </section>

                        {/* 6. Ordrenummer */}
                        <section id="order-number" className="order-7 scroll-mt-6 rounded-[20px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:order-5">
                            <h2 className="text-lg font-medium">Ordrenummer</h2>
                            <div className="mt-4 rounded-[14px] border border-neutral-200 bg-neutral-50 px-4 py-3 font-medium text-neutral-900">
                                {order.orderNumber || "Blir oppretta ved stadfesting"}
                            </div>
                            <p className="mt-3 text-xs leading-5 text-neutral-500">
                                Ordrenummeret blir oppretta automatisk og følgjer ordren gjennom pakking, levering og fakturering.
                            </p>
                        </section>

                        {/* 7. Fakturering */}
                        <section id="invoice" className="order-8 scroll-mt-6 rounded-[20px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:order-10">
                            <h2 className="text-lg font-medium">Fakturering</h2>

                            <div className="mt-4 rounded-[14px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
                                <div className="mb-3 border-b border-neutral-200 pb-3">
                                    <div className="text-neutral-600">Fakturerast til</div>
                                    <div className="mt-1 font-medium text-neutral-900">
                                        {customer?.companyName || order.customerCompanyName || order.customerName}
                                    </div>
                                    {(customer?.displayName || order.customerDisplayName) !== (customer?.companyName || order.customerCompanyName) ? (
                                        <div className="mt-1 text-xs text-neutral-500">
                                            Bestilling frå: {customer?.displayName || order.customerDisplayName || order.customerName}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-neutral-600">Status</span>
                                    {order.invoice.status === "invoiced" ? (
                                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                                            Fakturert
                                        </span>
                                    ) : (
                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                                            Ikkje fakturert
                                        </span>
                                    )}
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-4">
                                    <span className="text-neutral-600">Fakturanummer</span>
                                    <span className="font-medium text-neutral-900">
                                        {order.orderNumber || "Mangler ordrenummer"}
                                    </span>
                                </div>

                                {order.invoice.invoicedAt ? (
                                    <div className="mt-3 flex items-center justify-between gap-4">
                                        <span className="text-neutral-600">Fakturert</span>
                                        <span className="font-medium text-neutral-900">{order.invoice.invoicedAt}</span>
                                    </div>
                                ) : null}
                            </div>

                            {order.invoice.status === "invoiced" ? (
                                <button
                                    type="button"
                                    onClick={markAsNotInvoiced}
                                    disabled={savingInvoice}
                                    className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50"
                                >
                                    {savingInvoice ? "Lagrar …" : "Merk som ikkje fakturert"}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={markAsInvoiced}
                                    disabled={savingInvoice || !order.orderNumber}
                                    className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-amber-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800 disabled:opacity-50"
                                >
                                    {savingInvoice ? "Lagrar …" : "Merk som fakturert"}
                                </button>
                            )}

                            <p className="mt-3 text-xs leading-5 text-neutral-500">
                                Fakturanummeret er same nummer som ordrenummeret frå fakturasystemet. Ordren må derfor ha ordrenummer før han kan merkast som fakturert.
                            </p>
                        </section>

                        {/* 8. Status */}
                        <section id="order-status" className="order-9 scroll-mt-6 rounded-[20px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:order-6">
                            <h2 className="text-lg font-medium">Status</h2>

                            <select
                                value={order.status}
                                disabled={savingStatus}
                                onChange={(e) => updateOrderStatus(e.target.value as OrderStatus)}
                                className="mt-4 w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm disabled:text-neutral-500"
                            >
                                {Object.entries(statusLabels)
                                    .filter(([value]) => value !== "processing")
                                    .map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                            </select>

                            <p className="mt-3 text-xs leading-5 text-neutral-500">
                                {savingStatus ? "Lagrar status …" : "Status blir oppdatert direkte i ordren."}
                            </p>
                        </section>

                        {/* 9. Oppsummering */}
                        <section className="order-1 rounded-[20px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-5 md:order-4">
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

                        {/* 10. Endringsførespurnader */}
                        <div id="customer-response" className="order-10 scroll-mt-6" aria-hidden="true" />
                        {changeRequests.length ? (
                            <section className="order-10 rounded-[20px] border border-blue-200 bg-blue-50 p-5 md:order-7">
                                <h2 className="text-lg font-medium text-blue-950">Endringsførespurnader</h2>
                                <p className="mt-3 text-sm leading-6 text-blue-900">
                                    Kunden har sendt ønskje om å legge til varer. Ordren blir ikkje endra automatisk; vurder førespurnaden og gjer eventuelle endringar manuelt før han blir markert som handtert.
                                </p>

                                {pendingChangeRequests.length ? (
                                    <div className="mt-5 space-y-4">
                                        {pendingChangeRequests.map((request) => (
                                            <div key={request.id} className="rounded-[16px] border border-blue-200 bg-white p-4 text-sm">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <div className="font-medium text-blue-950">Ny førespurnad</div>
                                                        <div className="mt-1 text-xs text-blue-700">{request.createdAt}</div>
                                                    </div>
                                                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-800">
                                                        Ventar
                                                    </span>
                                                </div>

                                                <div className="mt-3 whitespace-pre-line leading-6 text-neutral-800">
                                                    {request.message || "Ingen melding."}
                                                </div>

                                                <label className="mt-4 block text-sm font-medium text-neutral-800">
                                                    Internt notat
                                                    <textarea
                                                        value={changeRequestNotes[request.id] || ""}
                                                        onChange={(event) =>
                                                            setChangeRequestNotes((prev) => ({
                                                                ...prev,
                                                                [request.id]: event.target.value,
                                                            }))
                                                        }
                                                        rows={3}
                                                        className="mt-2 w-full rounded-[12px] border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-blue-700"
                                                        placeholder="Til dømes: La til varene manuelt i ordren."
                                                    />
                                                </label>

                                                <div className="mt-4 grid gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => resolveChangeRequest(request, "approved")}
                                                        disabled={savingChangeRequestId === request.id}
                                                        className="rounded-full bg-blue-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:opacity-50"
                                                    >
                                                        {savingChangeRequestId === request.id ? "Lagrar …" : "Merk som godkjend/handtert"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => resolveChangeRequest(request, "rejected")}
                                                        disabled={savingChangeRequestId === request.id}
                                                        className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50"
                                                    >
                                                        Avvis førespurnad
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}

                                {resolvedChangeRequests.length ? (
                                    <div className="mt-5 space-y-2">
                                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                                            Tidlegare førespurnader
                                        </div>
                                        {resolvedChangeRequests.map((request) => (
                                            <div key={request.id} className="rounded-[14px] border border-blue-100 bg-white px-4 py-3 text-sm text-neutral-700">
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="font-medium text-neutral-900">
                                                        {request.status === "approved" ? "Godkjend/handtert" : "Avvist"}
                                                    </span>
                                                    <span className="text-xs text-neutral-500">{request.createdAt}</span>
                                                </div>
                                                <div className="mt-2 whitespace-pre-line text-xs leading-5 text-neutral-600">
                                                    {request.message}
                                                </div>
                                                {request.adminNote ? (
                                                    <div className="mt-2 text-xs leading-5 text-neutral-500">
                                                        Notat: {request.adminNote}
                                                    </div>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                            </section>
                        ) : null}
                        {/* 10. Ventar på kundesvar */}
                        {shouldShowCustomerDecision ? (
                            <section className="order-10 rounded-[20px] border border-amber-200 bg-amber-50 p-5 md:order-7">
                                <h2 className="text-lg font-medium text-amber-900">
                                    {order.approval.status === "waiting" ? "Ventar på kundesvar" : "Kundegodkjenning"}
                                </h2>
                                <p className="mt-3 text-sm leading-6 text-amber-800">
                                    {order.approval.status === "waiting"
                                        ? "Godkjenningsførespurnaden er send. Kunden kan svare frå e-posten eller i kundeportalen dersom dei har tilgang."
                                        : customerHasPortalAccess
                                        ? "Kunden kan svare i portalen. Dersom svaret kjem på telefon, e-post eller direkte, kan du registrere valet her på vegner av kunden."
                                        : customerCanReceiveEmail
                                            ? "Send ei godkjenningsførespurnad på e-post. Kunden kan svare direkte frå meldinga utan å ha kundekonto."
                                            : "Denne kunden har ikkje registrert e-postadresse. Ring kunden og registrer avtalen her når de har fått svar."}
                                </p>

                                {shouldShowCustomerApprovalButton ? (
                                    <button
                                        type="button"
                                        onClick={sendForApproval}
                                        disabled={savingStatus}
                                        className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-amber-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800 disabled:opacity-50"
                                    >
                                        {sendingCustomerEmail === "approval" ? "Sender …" : "Send til kundegodkjenning"}
                                    </button>
                                ) : null}

                                {customerCanReceiveEmail && !showManualApprovalForm ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowManualApprovalForm(true)}
                                        className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
                                    >
                                        Registrer svar manuelt
                                    </button>
                                ) : null}

                                {!customerCanReceiveEmail || showManualApprovalForm ? (
                                <div className="mt-5 space-y-4">
                                    <label className="block text-sm font-medium text-amber-950">
                                        Kundesvar
                                        <select
                                            value={manualApprovalResponse}
                                            onChange={(event) => setManualApprovalResponse(event.target.value as ApprovalResponse)}
                                            className="mt-2 w-full rounded-[12px] border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900"
                                        >
                                            <option value="deliver_partial_later">Send det som er klart. Resten ettersendast seinare.</option>
                                            <option value="deliver_partial_cancel_rest">Send det som er klart. Slett resten.</option>
                                            <option value="wait_for_complete">Vent til alt er klart.</option>
                                        </select>
                                    </label>

                                    <label className="block text-sm font-medium text-amber-950">
                                        Svaret kom via
                                        <select
                                            value={manualApprovalSource}
                                            onChange={(event) => setManualApprovalSource(event.target.value as ApprovalResponseSource)}
                                            className="mt-2 w-full rounded-[12px] border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900"
                                        >
                                            <option value="phone">Telefon</option>
                                            <option value="email">E-post</option>
                                            <option value="in_person">Direkte</option>
                                            <option value="other">Anna</option>
                                        </select>
                                    </label>

                                    <label className="block text-sm font-medium text-amber-950">
                                        Internt notat
                                        <textarea
                                            value={manualApprovalNote}
                                            onChange={(event) => setManualApprovalNote(event.target.value)}
                                            rows={3}
                                            className="mt-2 w-full rounded-[12px] border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900"
                                            placeholder="Til dømes: Snakka med Kari på telefon."
                                        />
                                    </label>

                                    <button
                                        type="button"
                                        onClick={registerCustomerDecisionForCustomer}
                                        disabled={savingStatus}
                                        className="inline-flex w-full items-center justify-center rounded-full bg-amber-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800 disabled:opacity-50"
                                    >
                                        {savingStatus ? "Lagrar …" : customerHasPortalAccess ? "Registrer kundesvar" : "Registrer avtale"}
                                    </button>
                                    {customerCanReceiveEmail ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowManualApprovalForm(false)}
                                            className="w-full text-sm text-amber-800 underline-offset-4 hover:underline"
                                        >
                                            Lukk manuell registrering
                                        </button>
                                    ) : null}
                                </div>
                                ) : null}
                            </section>
                        ) : null}
                        {/* 10. Kundesvar */}
                        {order.approval.status === "answered" ? (
                            <section className="order-10 rounded-[20px] border border-emerald-200 bg-emerald-50 p-5 md:order-7">
                                <h2 className="text-lg font-medium text-emerald-900">Kundesvar</h2>

                                {order.approval.respondedBy === "admin" ? (
                                    <div className="mt-4 rounded-[14px] border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900">
                                        <div className="font-medium">Svar registrert av admin</div>
                                        <div className="mt-1 text-emerald-800">
                                            {order.approval.responseSource === "phone"
                                                ? "Telefon"
                                                : order.approval.responseSource === "email"
                                                    ? "E-post"
                                                    : order.approval.responseSource === "in_person"
                                                        ? "Direkte"
                                                        : order.approval.responseSource === "customer_portal"
                                                            ? "Kundeportal"
                                                            : "Anna"}
                                        </div>
                                        {order.approval.adminNote ? (
                                            <div className="mt-2 text-xs leading-5 text-emerald-800">
                                                {order.approval.adminNote}
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}

                                <div className={`mt-4 rounded-[14px] border bg-white px-4 py-3 text-sm font-medium ${order.approval.response === "wait_for_complete" ? "border-amber-300 text-amber-950" : "border-emerald-200 text-emerald-900"}`}>
                                    {order.approval.response === "deliver_partial_later"
                                        ? order.backorder.status === "created"
                                            ? "Klar for levering · restordre oppretta"
                                            : "Klar for levering · opprettar restordre"
                                        : order.approval.response === "deliver_partial_cancel_rest"
                                            ? "Klar for levering · resten er sletta"
                                            : "Kunden ventar på resten · prioriter når varene er tilgjengelege"}
                                </div>
                                {order.approval.response === "wait_for_complete" && missingOrderLines.length > 0 ? (
                                    <div className="mt-4 rounded-[14px] border border-amber-200 bg-white px-4 py-3">
                                        <div className="text-sm font-medium text-amber-900">
                                            Kunden ventar på
                                        </div>

                                        <div className="mt-3 space-y-2">
                                            {missingOrderLines.map((line) => (
                                                <div
                                                    key={`waiting-${line.productId}-${line.variantId}`}
                                                    className="flex items-center justify-between gap-4 text-sm"
                                                >
                                                    <span className="text-neutral-800">
                                                        {line.productName}
                                                    </span>
                                                    <span className="font-medium text-amber-900">
                                                        {line.quantity} stk
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => setShowChangeCustomerDecision((value) => !value)}
                                    className="mt-4 w-full rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
                                >
                                    {showChangeCustomerDecision ? "Lukk endring" : "Kunden ønskjer å endre valet"}
                                </button>

                                {showChangeCustomerDecision ? (
                                <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 p-4">
                                    <p className="text-sm leading-6 text-amber-900">
                                        Bruk dette berre dersom kunden sjølv har endra avgjerda. Dersom du vel «slett resten», blir ei oppretta restordre fjerna.
                                    </p>
                                    <div className="mt-4 grid gap-2">
                                    <button
                                        type="button"
                                        onClick={() => updateCustomerDecision("deliver_partial_later")}
                                        disabled={savingStatus || order.approval.response === "deliver_partial_later"}
                                        className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                                    >
                                        Endre til: lever no + restordre
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => updateCustomerDecision("deliver_partial_cancel_rest")}
                                        disabled={savingStatus || order.approval.response === "deliver_partial_cancel_rest"}
                                        className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                                    >
                                        Endre til: lever no og slett resten
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => updateCustomerDecision("wait_for_complete")}
                                        disabled={savingStatus || order.approval.response === "wait_for_complete"}
                                        className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                                    >
                                        Endre til: vent på resten
                                    </button>
                                    </div>
                                </div>
                                ) : null}
                            </section>
                        ) : null}

                        {/* 11. Restordre */}
                        {order.backorder.status === "open" && missingLines.length > 0 ? (
                            <section className="order-11 rounded-[24px] border border-rose-200 bg-rose-50 p-6 md:order-11">
                                <h2 className="text-lg font-medium text-rose-900">Restordre</h2>

                                <div className="mt-3 rounded-[14px] border border-rose-200 bg-white px-4 py-3 text-sm font-medium text-rose-900">
                                    {backorderStatusLabel(order.backorder.status)}
                                </div>

                                <div className="mt-4 space-y-2">
                                    {missingOrderLines.map((line) => (
                                        <div
                                            key={`${line.productId}-${line.variantId}`}
                                            className="flex items-center justify-between gap-4 rounded-[12px] border border-rose-100 bg-white px-3 py-2 text-sm"
                                        >
                                            <span>
                                                <span className="font-medium text-neutral-900">{line.productName}</span>
                                                <span className="mt-0.5 block text-xs text-neutral-500">{line.variantLabel}</span>
                                            </span>
                                            <span className="shrink-0 font-medium text-rose-900">
                                                {line.quantity} stk
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 rounded-[14px] border border-rose-200 bg-white px-4 py-3 text-sm text-rose-900">
                                    <div className="font-medium">Manglande varer</div>
                                    <div className="mt-1 text-rose-800">
                                        {missingOrderLines.length} varelinjer · {missingOrderLines.reduce((sum, line) => sum + line.quantity, 0)} stk manglar
                                    </div>
                                </div>

                                <p className="mt-4 text-xs leading-5 text-rose-800">
                                    Dette er varer som ikkje vart leverte i første sending og må følgjast opp vidare.
                                </p>
                            </section>
                        ) : null}

                        {/* 12. Restordre oppretta */}
                        {order.backorder.status === "created" ? (
                            <section className="order-12 rounded-[24px] border border-emerald-200 bg-emerald-50 p-6 md:order-12">
                                <h2 className="text-lg font-medium text-emerald-900">Restordre oppretta</h2>
                                <p className="mt-3 text-sm leading-6 text-emerald-800">
                                    Pakkinga er stadfesta og restordren er oppretta automatisk. Denne ordren er klar for levering.
                                </p>
                                {order.backorder.createdOrderId ? (
                                    <Link
                                        href={`/admin/orders/${order.backorder.createdOrderId}`}
                                        className="mt-4 inline-flex rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 transition hover:bg-emerald-100"
                                    >
                                        Opne restordre
                                    </Link>
                                ) : null}
                            </section>
                        ) : null}
                        <section className="order-last rounded-[24px] border border-neutral-200 bg-white p-5 md:hidden">
                            <button
                                type="button"
                                onClick={() => setShowMobileOrderLines((value) => !value)}
                                className="flex w-full items-center justify-between gap-4 text-left"
                            >
                                <div>
                                    <h2 className="text-lg font-medium">Ordrelinjer</h2>
                                    <p className="mt-1 text-sm text-neutral-500">
                                        {order.lineCount} varetypar · {order.unitCount} einingar
                                    </p>
                                </div>
                                <span className="text-sm text-neutral-500">
                                    {showMobileOrderLines ? "Lukk" : "Opne"}
                                </span>
                            </button>

                            {showMobileOrderLines ? (
                                <div className="mt-5 space-y-6">
                                    {([
                                        ["Valldal Safteri", groupedLines.safteri, "text-rose-700"],
                                        ["Valldal Bryggeri", groupedLines.bryggeri, "text-amber-700"],
                                    ] as const).map(([title, lines, colorClass]) => {
                                        if (!lines.length) return null;

                                        return (
                                            <div key={title}>
                                                <div className={`mb-3 text-xs font-semibold uppercase tracking-[0.18em] ${colorClass}`}>
                                                    {title}
                                                </div>
                                                <div className="space-y-3">
                                                    {lines.map((line) => (
                                                        <div
                                                            key={`${line.productId}-${line.variantId}`}
                                                            className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4"
                                                        >
                                                            <div className="font-medium text-neutral-900">
                                                                {line.productName}
                                                            </div>
                                                            <div className="mt-1 text-sm text-neutral-500">
                                                                {[line.categoryName || line.category, line.variantLabel]
                                                                    .filter(Boolean)
                                                                    .join(" / ")}
                                                            </div>
                                                            <div className="mt-3 text-sm text-neutral-700">
                                                                {line.quantity} stk · {formatCurrency(line.quantity * line.unitPrice)} eks. mva.
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </section>
                    </aside>
                </div>
            </div>
        </main>
    );
}
