"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Variant {
    label: string;
    itemNumber: string;
    barcode: string;
}

interface Product {
    id: string;
    category: string;
    name: string;
    variants: Variant[];
}

const VARIANT_ORDER = [
    "80 ml",
    "195 ml",
    "390 ml",
    "1 kg",
    "2,5 kg",
    "7,5 kg",
    "80 g",
    "250 ml",
    "0,33 l",
    "0,5 l",
    "0,7 l",
    "0,75 l",
    "2,5 l",
    "5 l",
];

function getVariantSortIndex(label: string) {
    const index = VARIANT_ORDER.findIndex(
        (value) => value.toLowerCase() === String(label).trim().toLowerCase()
    );

    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export default function ProductListPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("all");

    useEffect(() => {
        async function fetchProducts() {
            try {
                // Try to order by category and name server-side
                const productsRef = collection(db, "products");
                const q = query(productsRef, orderBy("category"), orderBy("name"));
                const querySnapshot = await getDocs(q);

                const productsData: Product[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    productsData.push({
                        id: doc.id,
                        category: data.category || "",
                        name: data.name || "",
                        variants: data.variants || [],
                    });
                });

                // If ordering failed or data missing, fallback to client-side sort
                productsData.sort((a, b) => {
                    if (a.category !== b.category) {
                        return a.category.localeCompare(b.category);
                    }
                    return a.name.localeCompare(b.name);
                });

                setProducts(productsData);
            } catch {
                // If query fails (e.g. orderBy on multiple fields not supported), fallback
                const productsRef = collection(db, "products");
                const querySnapshot = await getDocs(productsRef);

                const productsData: Product[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    productsData.push({
                        id: doc.id,
                        category: data.category || "",
                        name: data.name || "",
                        variants: data.variants || [],
                    });
                });

                productsData.sort((a, b) => {
                    if (a.category !== b.category) {
                        return a.category.localeCompare(b.category);
                    }
                    return a.name.localeCompare(b.name);
                });

                setProducts(productsData);
            }
        }

        fetchProducts();
    }, []);

    const categories = Array.from(
        new Set(products.map((product) => product.category).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "nb"));

    const visibleProducts = selectedCategory === "all"
        ? products
        : products.filter((product) => product.category === selectedCategory);

    const rows = visibleProducts.flatMap((product) =>
        product.variants.map((variant) => ({
            category: product.category,
            productName: product.name,
            variantLabel: variant.label,
            itemNumber: variant.itemNumber,
            barcode: variant.barcode,
        }))
    );

    rows.sort((a, b) => {
        if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
        }
        if (a.productName !== b.productName) {
            return a.productName.localeCompare(b.productName);
        }
        const indexDiff = getVariantSortIndex(a.variantLabel) - getVariantSortIndex(b.variantLabel);
        if (indexDiff !== 0) {
            return indexDiff;
        }
        return a.variantLabel.localeCompare(b.variantLabel, "nb");
    });

    return (
        <div className="p-6">
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold mb-1">Vareliste</h1>
                    <p className="text-sm text-neutral-500">For utskrift og registrering i Duett.</p>
                </div>

                <div className="flex flex-wrap gap-2 print:hidden">
                    <Link
                        href="/admin/products"
                        className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                        ← Tilbake
                    </Link>
                    <button
                        onClick={() => window.print()}
                        className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200"
                    >
                        Skriv ut
                    </button>
                </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2 print:hidden">
                <button
                    type="button"
                    onClick={() => setSelectedCategory("all")}
                    className={
                        "rounded-full border px-3 py-1.5 text-xs font-medium " +
                        (selectedCategory === "all"
                            ? "border-neutral-900 bg-neutral-900 text-white"
                            : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
                    }
                >
                    Alle
                </button>

                {categories.map((category) => (
                    <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedCategory(category)}
                        className={
                            "rounded-full border px-3 py-1.5 text-xs font-medium " +
                            (selectedCategory === category
                                ? "border-neutral-900 bg-neutral-900 text-white"
                                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
                        }
                    >
                        {category}
                    </button>
                ))}
            </div>
            <div className="bg-white rounded-md shadow-sm border border-neutral-200 overflow-x-auto">
                <table className="w-full text-sm text-left text-neutral-700">
                    <thead className="bg-neutral-50 border-b border-neutral-200">
                        <tr>
                            <th scope="col" className="px-4 py-2 font-semibold">Kategori</th>
                            <th scope="col" className="px-4 py-2 font-semibold">Produkt</th>
                            <th scope="col" className="px-4 py-2 font-semibold">Variant</th>
                            <th scope="col" className="px-4 py-2 font-semibold">Varenummer</th>
                            <th scope="col" className="px-4 py-2 font-semibold">Strekkode</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr
                                key={`${row.category}-${row.productName}-${row.variantLabel}-${i}`}
                                className={
                                    (i % 2 === 0 ? "bg-white " : "bg-neutral-50 ") +
                                    (i > 0 && rows[i - 1].productName !== row.productName
                                        ? "border-t-4 border-neutral-200"
                                        : "")
                                }
                            >
                                <td className="px-4 py-2">{row.category}</td>
                                <td className="px-4 py-2">{row.productName}</td>
                                <td className="px-4 py-2">{row.variantLabel}</td>
                                <td className="px-4 py-2">{row.itemNumber}</td>
                                <td className="px-4 py-2">{row.barcode}</td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-4 text-center text-neutral-500">
                                    Ingen produkt funne.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
