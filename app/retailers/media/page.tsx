"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { listRetailerMedia, type RetailerMediaItem } from "@/lib/retailerMedia";

const CAT_LABEL: Record<string, string> = {
    saft: "Saft",
    sylte_gele: "Sylte og gelé",
    frisk: "Frisk",
    rein: "Rein",
    ol: "Øl",
    sider: "Sider",
};

function group(items: RetailerMediaItem[]) {
    const byCat: Record<string, Record<string, RetailerMediaItem[]>> = {};
    for (const it of items.filter((x) => x.active !== false)) {
        byCat[it.category] ||= {};
        byCat[it.category][it.productName] ||= [];
        byCat[it.category][it.productName].push(it);
    }
    return byCat;
}

export default function RetailerMediaPage() {
    const [items, setItems] = useState<RetailerMediaItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const res = await listRetailerMedia();
                setItems(res);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const grouped = useMemo(() => group(items), [items]);

    return (
        <main className="mx-auto max-w-6xl px-4 py-12">
            <h1 className="text-3xl font-semibold">Produktbilete (forhandlar)</h1>
            <p className="mt-2 text-sm text-neutral-600">
                Last ned bilete til bruk i nettbutikk, kampanjar og menyar.
            </p>

            {loading ? (
                <p className="mt-6 text-sm text-neutral-600">Lastar…</p>
            ) : (
                <div className="mt-10 space-y-16">
                    {Object.keys(CAT_LABEL).map((cat) => {
                        const products = grouped[cat] || {};
                        const productNames = Object.keys(products);
                        if (!productNames.length) return null;

                        return (
                            <section key={cat}>
                                <h2 className="text-2xl font-medium">{CAT_LABEL[cat]}</h2>

                                <div className="mt-6 space-y-10">
                                    {productNames.map((name) => {
                                        const pics = products[name] || [];
                                        return (
                                            <div key={name}>
                                                <h3 className="text-lg font-medium">{name}</h3>

                                                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                                    {pics.map((it) => (
                                                        <div key={it.id} className="rounded-2xl border border-black/10 bg-white p-4">
                                                            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100">
                                                                <Image src={it.imageUrl} alt={`${name} ${it.sizeLabel}`} fill className="object-contain" />
                                                            </div>

                                                            <div className="mt-3 flex items-center justify-between gap-3">
                                                                <div className="text-sm text-neutral-700">{it.sizeLabel}</div>

                                                                <a
                                                                    href={it.imageUrl}
                                                                    download={it.fileName || undefined}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="rounded-xl bg-black px-3 py-1.5 text-sm text-white hover:opacity-90"
                                                                >
                                                                    Last ned
                                                                </a>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}
        </main>
    );
}