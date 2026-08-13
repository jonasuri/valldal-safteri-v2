"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  createCustomer,
  listenToCustomers,
  updateCustomer,
  type AdminCustomerRow,
  type CustomerType,
} from "@/lib/customersFirestore";
import { useSystemFeedback } from "@/app/components/SystemFeedback";

type CustomerFilter = "all" | "account" | "manual" | "inactive";
type CustomerOutlet = {
  id: string;
  name: string;
  place: string;
  kind: string;
  address: string;
  links: Array<{ label: string; url: string }>;
  hasSafteri: boolean;
  hasBryggeri: boolean;
  customerId?: string;
  lat?: number | null;
  lng?: number | null;
};
type OutletDraft = Omit<CustomerOutlet, "id" | "customerId" | "lat" | "lng"> & {
  website: string;
  facebook: string;
  instagram: string;
};
const emptyOutletDraft: OutletDraft = {
  name: "",
  place: "",
  kind: "Butikk",
  address: "",
  links: [],
  hasSafteri: true,
  hasBryggeri: false,
  website: "",
  facebook: "",
  instagram: "",
};

type CustomerForm = {
  companyName: string;
  displayName: string;
  sameAsCompanyName: boolean;
  contactName: string;
  email: string;
  phone: string;
  organizationNumber: string;
  openingHours: string;
  legalAddress: string;
  visitingAddress: string;
  visitingLat: number | null;
  visitingLng: number | null;
  customerType: CustomerType;
  active: boolean;
};

const emptyForm: CustomerForm = {
  companyName: "",
  displayName: "",
  sameAsCompanyName: true,
  contactName: "",
  email: "",
  phone: "",
  organizationNumber: "",
  openingHours: "",
  legalAddress: "",
  visitingAddress: "",
  visitingLat: null,
  visitingLng: null,
  customerType: "retail",
  active: true,
};

function customerToForm(customer: AdminCustomerRow): CustomerForm {
  return {
    companyName: customer.companyName,
    displayName: customer.displayName || customer.companyName,
    sameAsCompanyName: customer.sameAsCompanyName,
    contactName: customer.contactName,
    email: customer.email,
    phone: customer.phone,
    organizationNumber: customer.organizationNumber,
    openingHours: customer.openingHours,
    legalAddress: customer.legalAddress,
    visitingAddress: customer.visitingAddress,
    visitingLat: customer.visitingLat ?? null,
    visitingLng: customer.visitingLng ?? null,
    customerType: customer.customerType,
    active: customer.active,
  };
}

function customerTypeLabel(type: CustomerType) {
  return type === "grossist" ? "Grossist" : "Retail";
}

export default function AdminCustomersPage() {
  const { notify, confirmAction } = useSystemFeedback();
  const [customers, setCustomers] = useState<AdminCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState("");
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] =
    useState<AdminCustomerRow | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [initialForm, setInitialForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sendingPasswordLink, setSendingPasswordLink] = useState(false);
  const [formError, setFormError] = useState("");
  const [businessSearch, setBusinessSearch] = useState("");
  const [businessResults, setBusinessResults] = useState<
    Array<{
      organizationNumber: string;
      name: string;
      address: string;
      active: boolean;
    }>
  >([]);
  const [addressResults, setAddressResults] = useState<
    Array<{ address: string; lat: number | null; lng: number | null }>
  >([]);
  const [searchingBusiness, setSearchingBusiness] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [outlets, setOutlets] = useState<CustomerOutlet[]>([]);
  const [outletSaving, setOutletSaving] = useState(false);
  const [outletFormOpen, setOutletFormOpen] = useState(false);
  const [outletDraft, setOutletDraft] = useState<OutletDraft>(emptyOutletDraft);
  const [editingOutletId, setEditingOutletId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = listenToCustomers((nextCustomers) => {
      setCustomers(nextCustomers);
      setLoading(false);
      setSelectedCustomer((current) => {
        if (!current) return null;
        return (
          nextCustomers.find((customer) => customer.id === current.id) ||
          current
        );
      });
    });
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    getDoc(doc(db, "content", "global")).then((snapshot) =>
      setOutlets(
        Array.isArray(snapshot.data()?.outlets) ? snapshot.data()!.outlets : [],
      ),
    );
  }, []);

  const counts = useMemo(
    () => ({
      all: customers.length,
      account: customers.filter((customer) => Boolean(customer.authUid)).length,
      manual: customers.filter((customer) => !customer.authUid).length,
      inactive: customers.filter((customer) => !customer.active).length,
    }),
    [customers],
  );

  const filteredCustomers = useMemo(() => {
    const search = queryText.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "account" && Boolean(customer.authUid)) ||
        (filter === "manual" && !customer.authUid) ||
        (filter === "inactive" && !customer.active);
      if (!matchesFilter) return false;
      if (!search) return true;
      return [
        customer.companyName,
        customer.displayName,
        customer.contactName,
        customer.email,
        customer.phone,
        customer.organizationNumber,
      ].some((value) => value.toLowerCase().includes(search));
    });
  }, [customers, filter, queryText]);

  const hasChanges = JSON.stringify(form) !== JSON.stringify(initialForm);

  function openNewCustomer() {
    setSelectedCustomer(null);
    setForm(emptyForm);
    setInitialForm(emptyForm);
    setFormError("");
    setPanelOpen(true);
    setBusinessSearch("");
    setBusinessResults([]);
    setAddressResults([]);
  }

  async function searchBrreg() {
    const q = businessSearch.trim();
    if (q.length < 2) return;
    setSearchingBusiness(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(
        `/api/admin/brreg?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const body = await response.json();
      setBusinessResults(body.items || []);
    } finally {
      setSearchingBusiness(false);
    }
  }
  async function searchAddress() {
    const q = form.visitingAddress.trim();
    if (q.length < 3) return;
    setSearchingAddress(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(
        `/api/admin/address-search?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const body = await response.json();
      setAddressResults(body.items || []);
    } finally {
      setSearchingAddress(false);
    }
  }
  async function saveOutlets(next: CustomerOutlet[], success: string) {
    setOutletSaving(true);
    try {
      await setDoc(
        doc(db, "content", "global"),
        { outlets: next, updatedAt: new Date() },
        { merge: true },
      );
      setOutlets(next);
      notify(success, "success");
    } finally {
      setOutletSaving(false);
    }
  }
  async function linkOutlet(outletId: string) {
    if (!selectedCustomer) return;
    await saveOutlets(
      outlets.map((item) =>
        item.id === outletId
          ? { ...item, customerId: selectedCustomer.id }
          : item,
      ),
      "Utsalsstaden er kopla til kunden.",
    );
  }
  async function unlinkOutlet(outletId: string) {
    await saveOutlets(
      outlets.map((item) =>
        item.id === outletId ? { ...item, customerId: "" } : item,
      ),
      "Koplinga er fjerna.",
    );
  }
  function openOutletForm() {
    setEditingOutletId(null);
    setOutletDraft({
      ...emptyOutletDraft,
      name: form.displayName || form.companyName,
      place: form.visitingAddress.split(",").at(-1)?.trim() || "",
      address: form.visitingAddress || form.legalAddress,
    });
    setOutletFormOpen(true);
  }
  function openOutletEdit(outlet: CustomerOutlet) {
    const link = (label: string) =>
      outlet.links.find(
        (item) => item.label.toLowerCase() === label.toLowerCase(),
      )?.url || "";
    const standardLabels = new Set(["nettside", "facebook", "instagram"]);
    setEditingOutletId(outlet.id);
    setOutletDraft({
      name: outlet.name,
      place: outlet.place,
      kind: outlet.kind,
      address: outlet.address,
      hasSafteri: outlet.hasSafteri,
      hasBryggeri: outlet.hasBryggeri,
      links: outlet.links.filter(
        (item) => !standardLabels.has(item.label.toLowerCase()),
      ),
      website: link("Nettside"),
      facebook: link("Facebook"),
      instagram: link("Instagram"),
    });
    setOutletFormOpen(true);
  }
  async function saveOutletForCustomer() {
    if (!selectedCustomer) return;
    const knownLinks = [
      { label: "Nettside", url: outletDraft.website },
      { label: "Facebook", url: outletDraft.facebook },
      { label: "Instagram", url: outletDraft.instagram },
    ]
      .filter((item) => item.url.trim())
      .map((item) => ({ ...item, url: item.url.trim() }));
    const existing = editingOutletId
      ? outlets.find((item) => item.id === editingOutletId)
      : undefined;
    const next: CustomerOutlet = {
      id:
        editingOutletId ||
        `outlet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: outletDraft.name.trim(),
      place: outletDraft.place.trim(),
      kind: outletDraft.kind.trim(),
      address: outletDraft.address.trim(),
      links: [...outletDraft.links, ...knownLinks],
      hasSafteri: outletDraft.hasSafteri,
      hasBryggeri: outletDraft.hasBryggeri,
      customerId: selectedCustomer.id,
      lat: existing?.lat ?? form.visitingLat,
      lng: existing?.lng ?? form.visitingLng,
    };
    await saveOutlets(
      editingOutletId
        ? outlets.map((item) => (item.id === editingOutletId ? next : item))
        : [next, ...outlets],
      editingOutletId
        ? "Utsalsstaden er oppdatert."
        : "Ny utsalsstad er oppretta og kopla til kunden.",
    );
    setOutletFormOpen(false);
    setEditingOutletId(null);
  }

  function openCustomer(customer: AdminCustomerRow) {
    const nextForm = customerToForm(customer);
    setSelectedCustomer(customer);
    setForm(nextForm);
    setInitialForm(nextForm);
    setFormError("");
    setPanelOpen(true);
  }

  async function closePanel() {
    if (hasChanges) {
      const confirmed = await confirmAction({
        title: "Forkast endringane?",
        message: "Endringar som ikkje er lagra, går tapt.",
        confirmLabel: "Forkast endringar",
        destructive: true,
      });
      if (!confirmed) return;
    }
    setPanelOpen(false);
    setFormError("");
  }

  function updateForm<K extends keyof CustomerForm>(
    key: K,
    value: CustomerForm[K],
  ) {
    setForm((current) => {
      if (key === "companyName") {
        const companyName = String(value);
        return {
          ...current,
          companyName,
          displayName: current.sameAsCompanyName
            ? companyName
            : current.displayName,
        };
      }
      if (key === "sameAsCompanyName") {
        const sameAsCompanyName = Boolean(value);
        return {
          ...current,
          sameAsCompanyName,
          displayName: sameAsCompanyName
            ? current.companyName
            : current.displayName,
        };
      }
      return { ...current, [key]: value };
    });
    setFormError("");
  }

  async function saveCustomer() {
    const companyName = form.companyName.trim();
    const displayName = form.sameAsCompanyName
      ? companyName
      : form.displayName.trim();
    const email = form.email.trim().toLowerCase();

    if (!companyName) {
      setFormError("Firmanamn er påkravd.");
      return;
    }
    if (!displayName) {
      setFormError("Visningsnamn er påkravd.");
      return;
    }
    if (!email) {
      setFormError("E-post er påkravd.");
      return;
    }

    const payload = {
      companyName,
      displayName,
      sameAsCompanyName: form.sameAsCompanyName,
      contactName: form.contactName.trim(),
      email,
      phone: form.phone.trim(),
      organizationNumber: form.organizationNumber.trim(),
      openingHours: form.openingHours.trim(),
      legalAddress: form.legalAddress.trim(),
      visitingAddress: form.visitingAddress.trim(),
      visitingLat: form.visitingLat,
      visitingLng: form.visitingLng,
      customerType: form.customerType,
      active: form.active,
      profileCompleted: Boolean(
        companyName &&
        form.contactName.trim() &&
        form.phone.trim() &&
        form.organizationNumber.trim(),
      ),
    };

    setSaving(true);
    setFormError("");
    try {
      if (selectedCustomer) {
        await updateCustomer(selectedCustomer.id, payload);
        const savedForm = { ...form, ...payload };
        setForm(savedForm);
        setInitialForm(savedForm);
        notify("Kunden er oppdatert.", "success");
      } else {
        await createCustomer(payload);
        setPanelOpen(false);
        notify("Kunden er oppretta.", "success");
      }
    } catch (error) {
      console.error(error);
      setFormError(
        selectedCustomer
          ? "Kunne ikkje lagre endringane."
          : "Kunne ikkje opprette kunden.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordLink() {
    if (!selectedCustomer || !form.email.trim()) return;
    setSendingPasswordLink(true);
    setFormError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("UNAUTHORIZED");
      const response = await fetch("/api/account/password-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ customerId: selectedCustomer.id }),
      });
      if (!response.ok) throw new Error("PASSWORD_LINK_FAILED");
      notify(
        selectedCustomer.authUid
          ? "Ny passordlenke er send til kunden."
          : "Kundekontoen er oppretta, og tilgang er send.",
        "success",
      );
    } catch (error) {
      console.error(error);
      setFormError("Kunne ikkje opprette kundekonto eller sende passordlenke.");
    } finally {
      setSendingPasswordLink(false);
    }
  }

  return (
    <main className="min-h-screen text-[color:var(--admin-ink)]">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
        <header className="flex flex-col gap-5 border-b border-[color:var(--admin-line)] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--admin-muted)]">
              Kundar
            </p>
            <h1
              className="mt-2 text-3xl tracking-tight md:text-4xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Kunderegister
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--admin-muted)]">
              Kontaktinformasjon, prisgruppe og tilgang til kundeområdet på éin
              stad.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewCustomer}
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--admin-accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--admin-accent-hover)]"
          >
            Ny kunde
          </button>
        </header>

        <section className="mt-7 rounded-[20px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="admin-scrollbar flex gap-1 overflow-x-auto">
              {(
                [
                  ["all", "Alle"],
                  ["account", "Med kundekonto"],
                  ["manual", "Manuelle"],
                  ["inactive", "Inaktive"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition ${
                    filter === value
                      ? "bg-[color:var(--admin-ink)] text-white"
                      : "text-[color:var(--admin-muted)] hover:bg-black/5"
                  }`}
                >
                  {label}{" "}
                  <span className="ml-1 opacity-60">{counts[value]}</span>
                </button>
              ))}
            </div>
            <label className="relative block w-full lg:w-80">
              <span className="sr-only">Søk i kunderegisteret</span>
              <input
                type="search"
                value={queryText}
                onChange={(event) => setQueryText(event.target.value)}
                className="w-full rounded-full border border-[color:var(--admin-line-strong)] bg-white px-4 py-2.5 text-sm outline-none"
                placeholder="Søk etter firma, kontakt eller e-post"
              />
            </label>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[20px] border border-[color:var(--admin-line)] bg-[color:var(--admin-card)]">
          <div className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_110px_130px_40px] gap-4 border-b border-[color:var(--admin-line)] bg-black/[0.018] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--admin-faint)] md:grid">
            <span>Kunde</span>
            <span>Kontakt</span>
            <span>Type</span>
            <span>Tilgang</span>
            <span />
          </div>
          <div className="divide-y divide-[color:var(--admin-line)]">
            {loading ? (
              <p className="px-5 py-12 text-center text-sm text-[color:var(--admin-muted)]">
                Lastar kundar …
              </p>
            ) : filteredCustomers.length ? (
              filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => openCustomer(customer)}
                  className="group grid w-full gap-3 px-5 py-4 text-left transition hover:bg-black/[0.025] md:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_110px_130px_40px] md:items-center md:gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {customer.displayName || customer.companyName}
                      </p>
                      {!customer.active ? (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
                          Inaktiv
                        </span>
                      ) : null}
                    </div>
                    {customer.displayName &&
                    customer.displayName !== customer.companyName ? (
                      <p className="mt-1 truncate text-xs text-[color:var(--admin-muted)]">
                        Faktura: {customer.companyName}
                      </p>
                    ) : null}
                  </div>
                  <div className="min-w-0 text-xs text-[color:var(--admin-muted)]">
                    <p className="truncate text-sm text-[color:var(--admin-ink)]">
                      {customer.contactName || "Ingen kontaktperson"}
                    </p>
                    <p className="mt-1 truncate">{customer.email}</p>
                  </div>
                  <span className="w-fit rounded-full bg-[color:var(--admin-active)] px-2.5 py-1 text-[11px] text-[color:var(--admin-muted)]">
                    {customerTypeLabel(customer.customerType)}
                  </span>
                  <span
                    className={`w-fit rounded-full px-2.5 py-1 text-[11px] ${
                      customer.authUid
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {customer.authUid ? "Kundekonto" : "Manuell"}
                  </span>
                  <span className="hidden text-right text-[color:var(--admin-faint)] transition group-hover:translate-x-0.5 md:block">
                    →
                  </span>
                </button>
              ))
            ) : (
              <div className="px-5 py-14 text-center">
                <p className="text-sm font-medium">Ingen kundar funne</p>
                <p className="mt-1 text-xs text-[color:var(--admin-muted)]">
                  Prøv eit anna søk eller filter.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {panelOpen ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) void closePanel();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-panel-title"
            className="flex h-full w-full max-w-2xl flex-col border-l border-[color:var(--admin-line)] bg-[color:var(--admin-surface)] shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-[color:var(--admin-line)] px-5 py-5 md:px-7">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-muted)]">
                  {selectedCustomer ? "Kundekort" : "Ny kunde"}
                </p>
                <h2
                  id="customer-panel-title"
                  className="mt-1 text-2xl tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {selectedCustomer
                    ? selectedCustomer.displayName ||
                      selectedCustomer.companyName
                    : "Opprett kunde"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => void closePanel()}
                className="rounded-full border border-[color:var(--admin-line)] bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
                aria-label="Lukk kundekort"
              >
                Lukk
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-6 md:px-7">
              <section className="mb-6 rounded-[16px] border border-[color:var(--admin-line)] bg-white p-4">
                <h3 className="text-sm font-semibold">
                  Finn verksemd i Brønnøysund
                </h3>
                <p className="mt-1 text-xs text-[color:var(--admin-muted)]">
                  Søk etter namn eller organisasjonsnummer. Du vel sjølv korrekt
                  verksemd før felta blir fylte ut.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={businessSearch}
                    onChange={(event) => setBusinessSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void searchBrreg();
                      }
                    }}
                    placeholder="Firmanamn eller org.nr."
                    className="min-w-0 flex-1 rounded-[10px] border border-[color:var(--admin-line-strong)] px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={searchBrreg}
                    disabled={searchingBusiness}
                    className="admin-button-secondary px-4 py-2 text-xs"
                  >
                    {searchingBusiness ? "Søkjer …" : "Søk"}
                  </button>
                </div>
                {businessResults.length ? (
                  <div className="mt-3 divide-y divide-[color:var(--admin-line)] rounded-[10px] border border-[color:var(--admin-line)]">
                    {businessResults.map((item) => (
                      <button
                        key={item.organizationNumber}
                        type="button"
                        onClick={() => {
                          setForm((current) => ({
                            ...current,
                            companyName: item.name,
                            displayName: current.sameAsCompanyName
                              ? item.name
                              : current.displayName,
                            organizationNumber: item.organizationNumber,
                            legalAddress: item.address,
                            visitingAddress:
                              current.visitingAddress || item.address,
                          }));
                          setBusinessResults([]);
                        }}
                        className="block w-full px-3 py-2.5 text-left hover:bg-[color:var(--admin-active)]"
                      >
                        <span className="block text-sm font-medium">
                          {item.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-[color:var(--admin-muted)]">
                          {item.organizationNumber} ·{" "}
                          {item.address || "Adresse manglar"}
                          {!item.active ? " · sletta" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                  Firmanamn / fakturanamn
                  <input
                    type="text"
                    value={form.companyName}
                    onChange={(event) =>
                      updateForm("companyName", event.target.value)
                    }
                    className="w-full rounded-[12px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm font-normal outline-none"
                  />
                </label>
                <div className="rounded-[14px] border border-[color:var(--admin-line)] bg-black/[0.018] p-4 sm:col-span-2">
                  <label className="flex items-center gap-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={form.sameAsCompanyName}
                      onChange={(event) =>
                        updateForm("sameAsCompanyName", event.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    Bruk firmanamnet som visningsnamn
                  </label>
                  {!form.sameAsCompanyName ? (
                    <label className="mt-4 block space-y-1.5 text-sm font-medium">
                      Visningsnamn / butikknamn
                      <input
                        type="text"
                        value={form.displayName}
                        onChange={(event) =>
                          updateForm("displayName", event.target.value)
                        }
                        className="w-full rounded-[12px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm font-normal outline-none"
                      />
                    </label>
                  ) : null}
                </div>
                <label className="space-y-1.5 text-sm font-medium">
                  Kontaktperson
                  <input
                    type="text"
                    value={form.contactName}
                    onChange={(event) =>
                      updateForm("contactName", event.target.value)
                    }
                    className="w-full rounded-[12px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm font-normal outline-none"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Telefon
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) =>
                      updateForm("phone", event.target.value)
                    }
                    className="w-full rounded-[12px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm font-normal outline-none"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  E-post
                  <input
                    type="email"
                    value={form.email}
                    disabled={Boolean(selectedCustomer?.authUid)}
                    onChange={(event) =>
                      updateForm("email", event.target.value)
                    }
                    className="w-full rounded-[12px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm font-normal outline-none disabled:bg-neutral-100 disabled:text-neutral-500"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Organisasjonsnummer
                  <input
                    type="text"
                    value={form.organizationNumber}
                    onChange={(event) =>
                      updateForm("organizationNumber", event.target.value)
                    }
                    className="w-full rounded-[12px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm font-normal outline-none"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                  Juridisk/registrert adresse
                  <input
                    type="text"
                    value={form.legalAddress}
                    onChange={(event) =>
                      updateForm("legalAddress", event.target.value)
                    }
                    className="w-full rounded-[12px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm font-normal outline-none"
                  />
                </label>
                <div className="sm:col-span-2">
                  <label className="space-y-1.5 text-sm font-medium">
                    Besøksadresse
                    <input
                      type="text"
                      value={form.visitingAddress}
                      onChange={(event) => {
                        updateForm("visitingAddress", event.target.value);
                        setAddressResults([]);
                      }}
                      className="w-full rounded-[12px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm font-normal outline-none"
                    />
                  </label>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={searchAddress}
                      disabled={
                        searchingAddress ||
                        form.visitingAddress.trim().length < 3
                      }
                      className="admin-button-secondary px-3 py-1.5 text-xs"
                    >
                      {searchingAddress ? "Søkjer …" : "Søk etter adresse"}
                    </button>
                    {form.visitingLat != null ? (
                      <span className="text-xs text-emerald-700">
                        Adresse stadfesta
                      </span>
                    ) : null}
                  </div>
                  {addressResults.length ? (
                    <div className="mt-2 divide-y divide-[color:var(--admin-line)] rounded-[10px] border border-[color:var(--admin-line)] bg-white">
                      {addressResults.map((item, index) => (
                        <button
                          key={`${item.address}-${index}`}
                          type="button"
                          onClick={() => {
                            setForm((current) => ({
                              ...current,
                              visitingAddress: item.address,
                              visitingLat: item.lat,
                              visitingLng: item.lng,
                            }));
                            setAddressResults([]);
                          }}
                          className="block w-full px-3 py-2 text-left text-xs hover:bg-[color:var(--admin-active)]"
                        >
                          {item.address}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                  Opningstider / leveringsinformasjon
                  <textarea
                    rows={3}
                    value={form.openingHours}
                    onChange={(event) =>
                      updateForm("openingHours", event.target.value)
                    }
                    className="w-full rounded-[12px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm font-normal outline-none"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Kundetype
                  <select
                    value={form.customerType}
                    onChange={(event) =>
                      updateForm(
                        "customerType",
                        event.target.value as CustomerType,
                      )
                    }
                    className="w-full rounded-[12px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2.5 text-sm font-normal outline-none"
                  >
                    <option value="retail">Retail</option>
                    <option value="grossist">Grossist</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 rounded-[12px] border border-[color:var(--admin-line)] bg-black/[0.018] px-3 py-2.5 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) =>
                      updateForm("active", event.target.checked)
                    }
                    className="h-4 w-4"
                  />{" "}
                  Aktiv kunde
                </label>
              </div>

              {selectedCustomer ? (
                <section className="mt-7 rounded-[16px] border border-[color:var(--admin-line)] bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">Utsalsstader</h3>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--admin-muted)]">
                        Kople eksisterande utsal eller opprett ein ny stad frå
                        denne kunden.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openOutletForm}
                      disabled={outletSaving}
                      className="admin-button-secondary shrink-0 px-3 py-2 text-xs"
                    >
                      + Ny utsalsstad
                    </button>
                  </div>
                  {outletFormOpen ? (
                    <div className="mt-4 rounded-[14px] border border-[color:var(--admin-line)] bg-[color:var(--admin-active)] p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold">
                          Namn
                          <input
                            value={outletDraft.name}
                            onChange={(event) =>
                              setOutletDraft({
                                ...outletDraft,
                                name: event.target.value,
                              })
                            }
                            className="mt-1.5 w-full rounded-[9px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2 font-normal"
                          />
                        </label>
                        <label className="text-xs font-semibold">
                          Type stad
                          <input
                            value={outletDraft.kind}
                            onChange={(event) =>
                              setOutletDraft({
                                ...outletDraft,
                                kind: event.target.value,
                              })
                            }
                            placeholder="Butikk, kafé, hotell …"
                            className="mt-1.5 w-full rounded-[9px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2 font-normal"
                          />
                        </label>
                        <label className="text-xs font-semibold">
                          Stad
                          <input
                            value={outletDraft.place}
                            onChange={(event) =>
                              setOutletDraft({
                                ...outletDraft,
                                place: event.target.value,
                              })
                            }
                            className="mt-1.5 w-full rounded-[9px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2 font-normal"
                          />
                        </label>
                        <label className="text-xs font-semibold">
                          Adresse
                          <input
                            value={outletDraft.address}
                            onChange={(event) =>
                              setOutletDraft({
                                ...outletDraft,
                                address: event.target.value,
                              })
                            }
                            className="mt-1.5 w-full rounded-[9px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2 font-normal"
                          />
                        </label>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-xs font-medium">
                          <input
                            type="checkbox"
                            checked={outletDraft.hasSafteri}
                            onChange={(event) =>
                              setOutletDraft({
                                ...outletDraft,
                                hasSafteri: event.target.checked,
                              })
                            }
                          />
                          Safteri
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium">
                          <input
                            type="checkbox"
                            checked={outletDraft.hasBryggeri}
                            onChange={(event) =>
                              setOutletDraft({
                                ...outletDraft,
                                hasBryggeri: event.target.checked,
                              })
                            }
                          />
                          Bryggeri
                        </label>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        {(
                          [
                            ["website", "Nettside"],
                            ["facebook", "Facebook"],
                            ["instagram", "Instagram"],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key} className="text-xs font-semibold">
                            {label}
                            <input
                              type="url"
                              value={outletDraft[key]}
                              onChange={(event) =>
                                setOutletDraft({
                                  ...outletDraft,
                                  [key]: event.target.value,
                                })
                              }
                              placeholder="https://…"
                              className="mt-1.5 w-full rounded-[9px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2 font-normal"
                            />
                          </label>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setOutletFormOpen(false);
                            setEditingOutletId(null);
                          }}
                          className="admin-button-secondary px-3 py-2 text-xs"
                        >
                          Avbryt
                        </button>
                        <button
                          type="button"
                          onClick={saveOutletForCustomer}
                          disabled={
                            outletSaving ||
                            !outletDraft.name.trim() ||
                            (!outletDraft.hasSafteri &&
                              !outletDraft.hasBryggeri)
                          }
                          className="rounded-full bg-[color:var(--admin-accent)] px-4 py-2 text-xs font-medium text-white disabled:opacity-45"
                        >
                          {outletSaving
                            ? "Lagrar …"
                            : editingOutletId
                              ? "Lagre endringar"
                              : "Opprett utsalsstad"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {outlets.filter(
                    (item) => item.customerId === selectedCustomer.id,
                  ).length ? (
                    <div className="mt-4 divide-y divide-[color:var(--admin-line)] rounded-[10px] border border-[color:var(--admin-line)]">
                      {outlets
                        .filter(
                          (item) => item.customerId === selectedCustomer.id,
                        )
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 px-3 py-2.5"
                          >
                            <div>
                              <p className="text-sm font-medium">{item.name}</p>
                              <p className="mt-0.5 text-xs text-[color:var(--admin-muted)]">
                                {item.address ||
                                  item.place ||
                                  "Adresse manglar"}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-3">
                              <button
                                type="button"
                                onClick={() => openOutletEdit(item)}
                                disabled={outletSaving}
                                className="text-xs font-medium text-[color:var(--admin-accent)] hover:underline"
                              >
                                Rediger
                              </button>
                              <button
                                type="button"
                                onClick={() => unlinkOutlet(item.id)}
                                disabled={outletSaving}
                                className="text-xs text-[color:var(--admin-muted)] hover:text-red-700"
                              >
                                Fjern kopling
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-[color:var(--admin-muted)]">
                      Ingen utsalsstader er kopla til kunden enno.
                    </p>
                  )}
                  {outlets.some((item) => !item.customerId) ? (
                    <label className="mt-4 block text-xs font-semibold">
                      Kople eksisterande utsalsstad
                      <select
                        defaultValue=""
                        onChange={(event) => {
                          if (event.target.value)
                            void linkOutlet(event.target.value);
                          event.target.value = "";
                        }}
                        disabled={outletSaving}
                        className="mt-2 w-full rounded-[10px] border border-[color:var(--admin-line-strong)] bg-white px-3 py-2 text-sm font-normal"
                      >
                        <option value="">Vel utsalsstad …</option>
                        {outlets
                          .filter((item) => !item.customerId)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} · {item.place || item.address}
                            </option>
                          ))}
                      </select>
                    </label>
                  ) : null}
                </section>
              ) : null}

              {selectedCustomer ? (
                <section className="mt-7 rounded-[16px] border border-[color:var(--admin-line)] bg-white p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">
                        Tilgang til kundeområdet
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--admin-muted)]">
                        {selectedCustomer.authUid
                          ? "Kundekontoen er aktiv. Send ei ny lenke dersom kunden treng nytt passord."
                          : "Kunden er registrert utan innlogging. Kontoen blir oppretta når du sender tilgang."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={sendPasswordLink}
                      disabled={sendingPasswordLink || !form.email.trim()}
                      className="admin-button-secondary shrink-0 px-4 py-2 text-xs disabled:opacity-50"
                    >
                      {sendingPasswordLink
                        ? "Sender …"
                        : selectedCustomer.authUid
                          ? "Send ny passordlenke"
                          : "Opprett konto og send tilgang"}
                    </button>
                  </div>
                </section>
              ) : null}

              {formError ? (
                <p
                  role="alert"
                  className="mt-5 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {formError}
                </p>
              ) : null}
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-[color:var(--admin-line)] bg-[color:var(--admin-surface)] px-5 py-4 sm:flex-row sm:justify-end md:px-7">
              <button
                type="button"
                onClick={() => void closePanel()}
                className="admin-button-secondary px-5 py-2.5 text-sm"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={saveCustomer}
                disabled={saving || (Boolean(selectedCustomer) && !hasChanges)}
                className="rounded-full bg-[color:var(--admin-accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--admin-accent-hover)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {saving
                  ? "Lagrar …"
                  : selectedCustomer
                    ? "Lagre endringar"
                    : "Opprett kunde"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
