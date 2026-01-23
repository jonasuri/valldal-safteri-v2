"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
    deleteRetailerMedia,
    listRetailerMedia,
    setRetailerMediaActive,
    uploadRetailerMedia,
    type RetailerMediaCategory,
    type RetailerMediaItem,
} from "@/lib/retailerMedia";

const CATEGORY_LABELS: Record<RetailerMediaCategory, string> = {
    saft: "Saft",
    sylte_gele: "Sylte og gelé",
    frisk: "Frisk",
    rein: "Rein",
    ol: "Øl",
    sider: "Sider",
};

export default function AdminRetailerMediaPage() {
    const [items, setItems] = useState<RetailerMediaItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [category, setCategory] = useState<RetailerMediaCategory>("saft");
    const [productName, setProductName] = useState("");
    const [sizeLabel, setSizeLabel] = useState("");
    const [file, setFile] = useState<File | null>(null);

    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    async function refresh() {
        setLoading(true);
        try {
            const res = await listRetailerMedia();
            setItems(res);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 2500);
        return () => clearTimeout(t);
    }, [toast]);

    const grouped = useMemo(() => {
        const byCat: Record<string, RetailerMediaItem[]> = {};
        for (const it of items) {
            (byCat[it.category] ||= []).push(it);
        }
        return byCat;
    }, [items]);

    async function onUpload() {
        if (!productName.trim()) return setToast("Skriv produktnamn.");
        if (!sizeLabel.trim()) return setToast("Skriv storleik (t.d. 0.7L / 195 ml).");
        if (!file) return setToast("Vel ei bildefil.");

        setSaving(true);
        try {
            await uploadRetailerMedia({
                category,
                productName: productName.trim(),
                sizeLabel: sizeLabel.trim(),
                file,
            });

            setToast("Lasta opp ✅");
            setProductName("");
            setSizeLabel("");
            setFile(null);

            // reset file input visually (simple trick: reload list + let input be re-picked)
            await refresh();
        } catch (e: any) {
            setToast(e?.message || "Kunne ikkje laste opp.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className="mx-auto max-w-5xl px-4 py-10">
            <div className="flex items-start justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-semibold">Retailer-bilete (midlertidig)</h1>
                    <p className="mt-1 text-sm text-neutral-600">
                        Last opp produktbilete som forhandlarar kan laste ned.
                    </p>
                </div>
                <a
                    href="/retailers/media"
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm hover:bg-black/[0.03]"
                >
                    Opne nedlastingsside →
                </a>
            </div>

            <section className="mt-8 rounded-2xl border border-black/10 bg-white p-5">
                <h2 className="text-lg font-medium">Last opp nytt bilete</h2>

                <div className="mt-4 grid gap-4 md:grid-cols-4">
                    <label className="grid gap-1 text-sm">
                        <span className="text-neutral-600">Kategori</span>
                        <select
                            className="rounded-xl border border-black/10 px-3 py-2"
                            value={category}
                            onChange={(e) => setCategory(e.target.value as RetailerMediaCategory)}
                        >
                            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>
                                    {v}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="grid gap-1 text-sm md:col-span-1">
                        <span className="text-neutral-600">Produktnamn</span>
                        <input
                            className="rounded-xl border border-black/10 px-3 py-2"
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            placeholder="Eplesaft"
                        />
                    </label>

                    <label className="grid gap-1 text-sm">
                        <span className="text-neutral-600">Storleik (label)</span>
                        <input
                            className="rounded-xl border border-black/10 px-3 py-2"
                            value={sizeLabel}
                            onChange={(e) => setSizeLabel(e.target.value)}
                            placeholder="0.7L / 195 ml"
                        />
                    </label>

                    <label className="grid gap-1 text-sm">
                        <span className="text-neutral-600">Fil</span>
                        <input
                            className="rounded-xl border border-black/10 px-3 py-2"
                            type="file"
                            accept="image/*"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                    </label>
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <button
                        onClick={onUpload}
                        disabled={saving}
                        className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                        {saving ? "Laster opp..." : "Last opp"}
                    </button>

                    {toast && (
                        <div className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-neutral-700">
                            {toast}
                        </div>
                    )}
                </div>
            </section>

            <section className="mt-10">
                <h2 className="text-lg font-medium">Eksisterande</h2>
                {loading ? (
                    <p className="mt-3 text-sm text-neutral-600">Lastar…</p>
                ) : items.length === 0 ? (
                    <p className="mt-3 text-sm text-neutral-600">Ingen bilete enno.</p>
                ) : (
                    <div className="mt-4 space-y-10">
                        {Object.keys(CATEGORY_LABELS).map((cat) => {
                            const list = grouped[cat] || [];
                            if (!list.length) return null;

                            return (
                                <div key={cat}>
                                    <h3 className="text-base font-medium">{CATEGORY_LABELS[cat as RetailerMediaCategory]}</h3>
                                    <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        {list.map((it) => (
                                            <div key={it.id} className="rounded-2xl border border-black/10 bg-white p-3">
                                                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100">
                                                    <Image src={it.imageUrl} alt={it.productName} fill className="object-contain" />
                                                </div>

                                                <div className="mt-3">
                                                    <div className="text-sm font-medium">{it.productName}</div>
                                                    <div className="text-xs text-neutral-600">{it.sizeLabel}</div>
                                                </div>

                                                <div className="mt-3 flex items-center justify-between gap-3">
                                                    <label className="flex items-center gap-2 text-sm">
                                                        <input
                                                            type="checkbox"
                                                            checked={it.active !== false}
                                                            onChange={async (e) => {
                                                                await setRetailerMediaActive(it.id, e.target.checked);
                                                                await refresh();
                                                            }}
                                                        />
                                                        Aktiv
                                                    </label>

                                                    <button
                                                        className="rounded-xl border border-black/10 px-3 py-1.5 text-sm hover:bg-black/[0.03]"
                                                        onClick={async () => {
                                                            if (!confirm("Slette dette biletet?")) return;
                                                            await deleteRetailerMedia(it);
                                                            await refresh();
                                                        }}
                                                    >
                                                        Slett
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
}