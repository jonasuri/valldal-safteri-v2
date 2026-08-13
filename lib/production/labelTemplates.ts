export type LabelTemplate = {
    outputId: string;
    productTemplate: string;
    labelsPerSheet: number;
    unitsPerBox?: number;
    boxTemplate?: string;
    boxLabelsPerSheet?: number;
};

export const BLUEBERRY_JAM_RECIPE_ID = "sylte-blab-rsylte-v1";

export const blueberryJamLabelTemplates: Record<string, LabelTemplate> = {
    "blab-rsylte-10011": {
        outputId: "blab-rsylte-10011",
        productTemplate: "assets/label-templates/blabaersylte/80ml.pdf",
        labelsPerSheet: 14,
        unitsPerBox: 30,
    },
    "blab-rsylte-10012": {
        outputId: "blab-rsylte-10012",
        productTemplate: "assets/label-templates/blabaersylte/195ml.pdf",
        labelsPerSheet: 8,
        unitsPerBox: 16,
        boxTemplate: "assets/label-templates/blabaersylte/box-195ml.pdf",
        boxLabelsPerSheet: 8,
    },
    "blab-rsylte-10013": {
        outputId: "blab-rsylte-10013",
        productTemplate: "assets/label-templates/blabaersylte/390ml.pdf",
        labelsPerSheet: 8,
        unitsPerBox: 9,
        boxTemplate: "assets/label-templates/blabaersylte/box-390ml.pdf",
        boxLabelsPerSheet: 8,
    },
    "blab-rsylte-10014": {
        outputId: "blab-rsylte-10014",
        productTemplate: "assets/label-templates/blabaersylte/1kg.pdf",
        labelsPerSheet: 8,
    },
    "blab-rsylte-10015": {
        outputId: "blab-rsylte-10015",
        productTemplate: "assets/label-templates/blabaersylte/2-5kg.pdf",
        labelsPerSheet: 8,
    },
};

