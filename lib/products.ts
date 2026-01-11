export type ProductCategory =
    | "Safteri - Saft"
    | "Safteri - Sylte"
    | "Safteri - Gele"
    | "Safteri - Frisk"
    | "Safteri - Rein"
    | "Safteri - Saus"
    | "Bryggeri - Øl"
    | "Bryggeri - Sider";

export type Unit = "ml" | "L" | "kg";

export type Variant = {
    id: string;
    size: number;
    unit: Unit;
    label: string;
    active?: boolean;
    imageSrc?: string;
    imageAlt?: string;
};

export type Nutrition = {
    energyKj: number;
    energyKcal: number;
    fat: number;
    saturatedFat: number;
    carbs: number;
    sugars: number;
    protein: number;
    salt: number;
};

export type Product = {
    id: string;
    slug: string;
    brand: "Safteri" | "Bryggeri";
    category: ProductCategory;
    name: string;
    shortDesc: string;
    longDesc?: string;
    ingredients?: string;
    allergens?: string[];
    nutrition?: Nutrition; // per 100 g / 100 ml
    images: { src: string; alt: string }[];
    variants: Variant[];
    alcohol?: { abv?: number; ageLimit: 18 };
};

export const products: Product[] = [
    // ─────────────────────────────
    // SAFTERI – SYLTE / GELE
    // ─────────────────────────────
    {
        id: "jordbaersylte",
        slug: "jordbaersylte",
        brand: "Safteri",
        category: "Safteri - Sylte",
        name: "Jordbærsylte",
        shortDesc: "Klassisk jordbærsylte laga av heile bær.",
        longDesc: "Sidan 1919 har vi produsert sylte med respekt for råvara og handverket. Jordbærsylta er laga av heile bær og kokt varsamt for å ta vare på smak, farge og konsistens. Eigna både til kvardag og fest – like naturleg på frukostbordet som til dessert og bakst.",
        ingredients: "Jordbær, sukker, pektin",
        allergens: [],
        nutrition: {
            energyKj: 780,
            energyKcal: 185,
            fat: 0.2,
            saturatedFat: 0,
            carbs: 45,
            sugars: 44,
            protein: 0.6,
            salt: 0,
        },
        images: [{ src: "/products/jordbaersylte.jpg", alt: "Jordbærsylte" }],
        variants: [
            { id: "55ml", size: 55, unit: "ml", label: "55 ml" },
            { id: "195ml", size: 195, unit: "ml", label: "195 ml", imageSrc: "/products/jordbaersylte-195.jpg", imageAlt: "Jordbærsylte 195 ml" },
            { id: "390ml", size: 390, unit: "ml", label: "390 ml" },
            { id: "1kg", size: 1, unit: "kg", label: "1 kg" },
            { id: "2.5kg", size: 2.5, unit: "kg", label: "2,5 kg" },
        ],

    },
    {
        id: "bringebaersylte",
        slug: "bringebaersylte",
        brand: "Safteri",
        category: "Safteri - Sylte",
        name: "Bringebærsylte",
        shortDesc: "Klassisk bringebærsylte laga av heile bær.",
        images: [{ src: "/products/bringebaersylte.jpg", alt: "Bringebæesylte" }],
        variants: [
            { id: "55ml", size: 55, unit: "ml", label: "55 ml" },
            { id: "195ml", size: 195, unit: "ml", label: "195 ml" },
            { id: "390ml", size: 390, unit: "ml", label: "390 ml" },
            { id: "1kg", size: 1, unit: "kg", label: "1 kg" },
            { id: "2.5kg", size: 2.5, unit: "kg", label: "2,5 kg" },
        ],

    },
    {
        id: "ripsgele",
        slug: "ripsgele",
        brand: "Safteri",
        category: "Safteri - Gele",
        name: "Ripsgele",
        shortDesc: "Klar og frisk gele av rips.",
        images: [{ src: "/products/ripsgele.jpg", alt: "Ripsgele" }],
        variants: [
            { id: "195ml", size: 195, unit: "ml", label: "195 ml" },
            { id: "390ml", size: 390, unit: "ml", label: "390 ml" },
        ],
    },

    // ─────────────────────────────
    // SAFTERI – SAFT / FRISK / REIN
    // ─────────────────────────────
    {
        id: "eplesaft",
        slug: "eplesaft",
        brand: "Safteri",
        category: "Safteri - Saft",
        name: "Eplesaft",
        shortDesc: "Rein eplesaft pressa av norske eple.",
        longDesc: "Rein eplesaft pressa av nøye utvalde eple. Safta er varsamt pasteurisert for å bevare den naturlege smaken av frukt, utan tilsetjingar eller konsentrat. Drikkast kald – åleine eller til mat.",
        ingredients: "Eple",
        allergens: [],
        nutrition: {
            energyKj: 190,
            energyKcal: 45,
            fat: 0,
            saturatedFat: 0,
            carbs: 10.5,
            sugars: 10.5,
            protein: 0.1,
            salt: 0,
        },
        images: [{ src: "/products/eplesaft.jpg", alt: "Eplesaft" }],
        variants: [
            { id: "0.7l", size: 0.7, unit: "L", label: "0,7 L", imageSrc: "/products/eplesaft-07.jpg", imageAlt: "Eplesaft 0,7 L" },
            { id: "2.5l", size: 2.5, unit: "L", label: "2,5 L" },
            { id: "5l", size: 5, unit: "L", label: "5 L" },
        ],
    },
    {
        id: "frisk-blaabaer",
        slug: "frisk-blaabaer",
        brand: "Safteri",
        category: "Safteri - Frisk",
        name: "Frisk Blåbær",
        shortDesc: "Ferdig blanda saft – klar til å drikkast.",
        images: [{ src: "/products/frisk-svartbaer.jpg", alt: "Frisk Svartbær" }],
        variants: [{ id: "0.33l", size: 0.33, unit: "L", label: "0,33 L" }],
    },
    {
        id: "rein-eple",
        slug: "rein-eple",
        brand: "Safteri",
        category: "Safteri - Rein",
        name: "Rein Eple",
        shortDesc: "Pressa frukt – ingenting tilsett.",
        images: [{ src: "/products/rein-eple.jpg", alt: "Rein Eple" }],
        variants: [
            { id: "0.33l", size: 0.33, unit: "L", label: "0,33 L" },
            { id: "0.75l", size: 0.75, unit: "L", label: "0,75 L" },
        ],
    },

    // ─────────────────────────────
    // BRYGGERI – ØL / SIDER
    // ─────────────────────────────
    {
        id: "pilsner",
        slug: "pilsner",
        brand: "Bryggeri",
        category: "Bryggeri - Øl",
        name: "Pilsner",
        shortDesc: "Lyst og balansert øl med rein avslutning.",
        longDesc: "Lyst og balansert øl brygga i små seriar for jamn kvalitet og rein avslutning. Ei presis og tradisjonell tolking – laga med respekt for råvara og prosessen.",
        ingredients: "Vatn, byggmalt, humle, gjær",
        allergens: ["Gluten (bygg)"],
        nutrition: {
            energyKj: 170,
            energyKcal: 40,
            fat: 0,
            saturatedFat: 0,
            carbs: 3.2,
            sugars: 0.2,
            protein: 0.3,
            salt: 0,
        },
        images: [{ src: "/products/fjordpils.jpg", alt: "Fjordpils" }],
        variants: [{ id: "0.5l", size: 0.5, unit: "L", label: "0,5 L" }],
        alcohol: { abv: 4.7, ageLimit: 18 },
    },
    {
        id: "eplesider",
        slug: "eplesider",
        brand: "Bryggeri",
        category: "Bryggeri - Sider",
        name: "Eplesider",
        shortDesc: "Sider med tydeleg frukt og presis avslutning.",
        longDesc: "Sider med tydeleg frukt og presis avslutning. Forma av råvare, sesong og tid – og laga i avgrensa batchar for kontroll og balanse.",
        ingredients: "Eple, vatn, sukker, gjær",
        allergens: ["Sulfitt"],
        nutrition: {
            energyKj: 190,
            energyKcal: 45,
            fat: 0,
            saturatedFat: 0,
            carbs: 10.5,
            sugars: 10.5,
            protein: 0.1,
            salt: 0,
        },
        images: [{ src: "/products/eplesider.jpg", alt: "Eplesider" }],
        variants: [
            { id: "0.33l", size: 0.33, unit: "L", label: "0,33 L" },
            { id: "0.75l", size: 0.75, unit: "L", label: "0,75 L" },
        ],
        alcohol: { abv: 4.7, ageLimit: 18 },
    },
];