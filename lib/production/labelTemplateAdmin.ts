export type LabelTemplateKind = "product" | "box";

export type LabelVariableField = {
    id: string;
    type: "date" | "batch";
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
};

export type LabelTemplateVersion = {
    id: string;
    recipeId: string;
    outputId: string;
    outputName: string;
    kind: LabelTemplateKind;
    version: number;
    fileName: string;
    storagePath: string;
    active: boolean;
    calibrationStatus?: "ready" | "required";
    pageWidth: number;
    pageHeight: number;
    pageCount: number;
    dateFieldFound: boolean;
    batchFieldFound: boolean;
    annotationCount: number;
    labelsPerSheet: number;
    unitsPerBox?: number;
    dateOffsetX: number;
    dateOffsetY: number;
    batchOffsetX: number;
    batchOffsetY: number;
    fontSize?: number;
    variableFields?: LabelVariableField[];
    createdAt?: string | null;
    createdBy?: { uid: string; email: string | null };
};

export function labelTemplateKey(outputId: string, kind: LabelTemplateKind) {
    return `${outputId}_${kind}`;
}
