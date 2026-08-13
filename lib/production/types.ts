export type RecipeIngredient = {
    id: string;
    name: string;
    amount: number;
    unit: "kg" | "l" | "g" | "ml";
    isPrimary?: boolean;
    tracksRawMaterialBatch?: boolean;
    adjustmentPercent?: number;
    note?: string;
};

export type RecipeProcessStep = {
    id: string;
    title: string;
    detail?: string;
};

export type RecipeWarning = {
    id: string;
    text: string;
};

export type ProductionRecipe = {
    id: string;
    name: string;
    category: string;
    version: number;
    basisPrimaryAmount: number;
    preferredCookPrimaryAmount: number;
    recommendedProductionAmount?: number;
    maxCookPrimaryAmount?: number;
    primaryUnit: "kg" | "l";
    expectedYield: number;
    expectedYieldUnit: "kg" | "l";
    yieldConfidence?: "recipe" | "estimated";
    ingredients: RecipeIngredient[];
    process: RecipeProcessStep[];
    warnings?: RecipeWarning[];
    outputs: RecipeOutput[];
};

export type RecipeOutput = {
    id: string;
    sku?: string;
    name: string;
    contentAmount: number;
    contentUnit: "ml" | "l" | "kg";
    labelsPerSheet: number;
    forecastEnabled?: boolean;
    monthlySales?: number[];
};

export type CookPlan = {
    fullCooks: number;
    halfCooks: number;
    cookCount: number;
    plannedPrimaryAmount: number;
    difference: number;
    differencePercent: number;
};
