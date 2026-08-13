import { collection, doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { ProductionRecipe, RecipeProcessStep, RecipeWarning } from "./types";

function clean<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizeLegacyRecipe(source: ProductionRecipe): ProductionRecipe {
    const recipe = clean(source);
    if (recipe.warnings) return recipe;
    const normalSteps = recipe.process.filter((step) => !step.id.startsWith("note-"));
    let extraSteps: RecipeProcessStep[] = [];
    let warnings: RecipeWarning[] = [];
    if (recipe.name === "Jordbærsylte") {
        extraSteps = [{ id: "prepare-strawberries", title: "Stapp jordbær før koking" }];
        warnings = [{ id: "boils-over", text: "Pass på, koker lett over" }];
    } else if (recipe.name === "Jordbær og Rabarbra") {
        extraSteps = [{ id: "cook-rhubarb", title: "Kok rabarbra i 3 minutt" }, { id: "add-strawberries", title: "Tilset jordbær" }];
    } else if (recipe.name === "Plommesylte") {
        extraSteps = [{ id: "prepare-plums", title: "Varm lett til steinen slepper, sil og hell tilbake i kjelen" }];
    } else if (recipe.name === "Stikkelsbærsylte") {
        extraSteps = [{ id: "blend-gooseberries", title: "Knus med stavmiksar før koking" }];
    } else if (recipe.name === "1001 Natt") {
        normalSteps.push({ id: "finish-spices", title: "Tilset vaniljesukker og anis til slutt, og smak til" });
    }
    return { ...recipe, process: [...extraSteps, ...normalSteps], warnings };
}

export function subscribeProductionRecipeOverrides(callback: (recipes: Record<string, ProductionRecipe>) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(collection(db, "productionRecipes"), (snapshot) => {
        callback(Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data().recipe as ProductionRecipe])));
    }, onError);
}

export async function saveProductionRecipe(recipe: ProductionRecipe) {
    const user = auth.currentUser;
    if (!user) throw new Error("Du må vere innlogga for å redigere oppskrifta.");
    const nextRecipe = { ...clean(recipe), version: recipe.version + 1 };
    await setDoc(doc(db, "productionRecipes", recipe.id), {
        recipe: nextRecipe,
        updatedAt: serverTimestamp(),
        updatedBy: { uid: user.uid, email: user.email || null },
    });
    return nextRecipe;
}
