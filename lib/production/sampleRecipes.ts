import type { ProductionRecipe } from "./types";

export const strawberryJamRecipe: ProductionRecipe = {
    id: "jordbaersylte-v1",
    name: "Jordbærsylte",
    category: "Sylte",
    version: 1,
    basisPrimaryAmount: 30,
    preferredCookPrimaryAmount: 25,
    primaryUnit: "kg",
    expectedYield: 157.032,
    expectedYieldUnit: "l",
    ingredients: [
        { id: "strawberry", name: "Jordbær", amount: 30, unit: "kg", isPrimary: true, tracksRawMaterialBatch: true },
        { id: "water", name: "Vatn", amount: 5.28, unit: "l" },
        { id: "sugar", name: "Sukker", amount: 22.2, unit: "kg" },
        { id: "pectin", name: "Pektin", amount: 554.4, unit: "g" },
        { id: "citric-acid", name: "Sitronsyre", amount: 126, unit: "g" },
        {
            id: "benzoic-acid",
            name: "Benzosyre",
            amount: 12,
            unit: "g",
            adjustmentPercent: 50,
            note: "50 % tillegg er aktivt i denne versjonen.",
        },
    ],
    process: [
        { id: "heat-1", title: "Varm opp til 80 °C" },
        { id: "sugar", title: "Tilset sukker og pektin", detail: "Bland godt og før roleg inn i koket." },
        { id: "heat-2", title: "Varm opp att til 80 °C" },
        { id: "cook", title: "Kok i 12 minutt" },
        { id: "acid", title: "Tilset syre og benzosyre" },
        { id: "test", title: "Kontroller konsistens og smak" },
    ],
    outputs: [
        { id: "80ml", sku: "10041", name: "Jordbærsylte 80 ml", contentAmount: 80, contentUnit: "ml", labelsPerSheet: 8, forecastEnabled: true, monthlySales: [0, 8, 2, 52, 13, 142, 368, 274, 36, 12, 33, 0] },
        { id: "195ml", sku: "10042", name: "Jordbærsylte 195 ml", contentAmount: 195, contentUnit: "ml", labelsPerSheet: 8, forecastEnabled: true, monthlySales: [14, 21, 2, 20, 49, 125, 341, 256, 53, 0, 24, 29] },
        { id: "390ml", sku: "10043", name: "Jordbærsylte 390 ml", contentAmount: 390, contentUnit: "ml", labelsPerSheet: 8, forecastEnabled: true, monthlySales: [250, 6, 64, 8, 23, 41, 252, 319, 24, 42, 26, 40] },
        { id: "1kg", sku: "10044", name: "Jordbærsylte 1 kg", contentAmount: 1, contentUnit: "kg", labelsPerSheet: 8, forecastEnabled: true, monthlySales: [4, 5, 15, 6, 11, 21, 45, 40, 17, 6, 5, 4] },
        { id: "2-5kg", sku: "10045", name: "Jordbærsylte 2,5 kg", contentAmount: 2.5, contentUnit: "kg", labelsPerSheet: 8, forecastEnabled: true, monthlySales: [0, 1, 4, 4, 4, 4, 33, 14, 14, 4, 3, 0] },
        { id: "7-5kg", name: "Jordbærsylte 7,5 kg", contentAmount: 7.5, contentUnit: "kg", labelsPerSheet: 8, forecastEnabled: false },
    ],
};
