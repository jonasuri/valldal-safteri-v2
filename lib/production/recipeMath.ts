import type { CookPlan, ProductionRecipe, RecipeIngredient } from "./types";

function round(value: number, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function createCookPlans(targetAmount: number, fullCookAmount: number): CookPlan[] {
    if (!Number.isFinite(targetAmount) || targetAmount <= 0 || fullCookAmount <= 0) return [];

    const halfCookAmount = fullCookAmount / 2;
    const approximateHalfCooks = targetAmount / halfCookAmount;
    const candidates = new Map<number, CookPlan>();

    for (let halfUnits = Math.max(1, Math.floor(approximateHalfCooks) - 2); halfUnits <= Math.ceil(approximateHalfCooks) + 2; halfUnits += 1) {
        const fullCooks = Math.floor(halfUnits / 2);
        const halfCooks = halfUnits % 2;
        const plannedPrimaryAmount = halfUnits * halfCookAmount;
        const difference = plannedPrimaryAmount - targetAmount;
        candidates.set(halfUnits, {
            fullCooks,
            halfCooks,
            cookCount: fullCooks + halfCooks,
            plannedPrimaryAmount: round(plannedPrimaryAmount),
            difference: round(difference),
            differencePercent: round((difference / targetAmount) * 100, 1),
        });
    }

    return [...candidates.values()]
        .sort((a, b) => {
            const score = (plan: CookPlan) =>
                Math.abs(plan.differencePercent) +
                (plan.difference < 0 ? 1.5 : 0) +
                plan.halfCooks * 2.5 +
                plan.cookCount * 0.05;
            return score(a) - score(b);
        })
        .slice(0, 3);
}

export function scaleIngredient(ingredient: RecipeIngredient, recipe: ProductionRecipe, plannedPrimaryAmount: number) {
    const scale = plannedPrimaryAmount / recipe.basisPrimaryAmount;
    const baseAmount = ingredient.amount * scale;
    const adjustmentAmount = baseAmount * ((ingredient.adjustmentPercent || 0) / 100);
    return {
        baseAmount: round(baseAmount, ingredient.unit === "g" || ingredient.unit === "ml" ? 1 : 2),
        adjustmentAmount: round(adjustmentAmount, ingredient.unit === "g" || ingredient.unit === "ml" ? 1 : 2),
        totalAmount: round(baseAmount + adjustmentAmount, ingredient.unit === "g" || ingredient.unit === "ml" ? 1 : 2),
    };
}

export function scaleExpectedYield(recipe: ProductionRecipe, plannedPrimaryAmount: number) {
    return round(recipe.expectedYield * (plannedPrimaryAmount / recipe.basisPrimaryAmount), 1);
}
