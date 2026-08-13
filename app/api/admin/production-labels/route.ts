import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { PDFDict, PDFDocument, PDFName, StandardFonts, rgb } from "pdf-lib";
import {
  getAdminAuth,
  getAdminFirestore,
  getAdminStorageBucket,
} from "@/lib/firebaseAdmin";
import {
  BLUEBERRY_JAM_RECIPE_ID,
  blueberryJamLabelTemplates,
} from "@/lib/production/labelTemplates";
import { allProductionRecipes } from "@/lib/production/recipes.generated";

export const runtime = "nodejs";

type LabelKind = "product" | "box";

function asDate(value: unknown): Date | null {
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function bestBefore(productionDate: Date) {
  const date = new Date(productionDate);
  date.setFullYear(date.getFullYear() + 1);
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "Europe/Oslo",
  }).format(date);
}

type ActiveTemplate = {
  storagePath?: string;
  labelsPerSheet?: number;
  unitsPerBox?: number;
  dateOffsetX?: number;
  dateOffsetY?: number;
  batchOffsetX?: number;
  batchOffsetY?: number;
  fontSize?: number;
  variableFields?: Array<{
    id: string;
    type: "date" | "batch";
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
  }>;
};

async function filledTemplate(
  relativePath: string,
  date: string,
  batchNumber: string,
  activeTemplate?: ActiveTemplate,
) {
  const bytes = activeTemplate?.storagePath
    ? await getAdminStorageBucket()
        .file(activeTemplate.storagePath)
        .download()
        .then(([data]) => data)
    : await readFile(path.join(process.cwd(), relativePath));
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  if (activeTemplate?.variableFields?.length) {
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for (const page of pdf.getPages()) {
      page.node.delete(PDFName.of("Annots"));
      for (const field of activeTemplate.variableFields) {
        const text = field.type === "date" ? date : batchNumber;
        page.drawText(text, {
          x: field.x,
          y: field.y + Math.max(0, (field.height - field.fontSize) / 2),
          size: field.fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }
    return pdf;
  }
  const dateField = form.getTextField("Dato");
  const batchField = form.getTextField("Partnr");
  dateField.setText(date);
  batchField.setText(batchNumber);
  if (activeTemplate?.fontSize) {
    dateField.setFontSize(activeTemplate.fontSize);
    batchField.setFontSize(activeTemplate.fontSize);
  }
  for (const widget of dateField.acroField.getWidgets()) {
    const rect = widget.getRectangle();
    widget.setRectangle({
      x: rect.x + (activeTemplate?.dateOffsetX || 0),
      y: rect.y + (activeTemplate?.dateOffsetY || 0),
      width: rect.width,
      height: rect.height,
    });
  }
  for (const widget of batchField.acroField.getWidgets()) {
    const rect = widget.getRectangle();
    widget.setRectangle({
      x: rect.x + (activeTemplate?.batchOffsetX || 0),
      y: rect.y + (activeTemplate?.batchOffsetY || 0),
      width: rect.width,
      height: rect.height,
    });
  }
  for (const fieldName of ["DatoMaster", "BatchMaster"]) {
    const field = form.getFieldMaybe(fieldName);
    if (field) form.removeField(field);
  }
  form.flatten();
  // Illustrator/Acrobat-malane kan innehalde gamle kommentarikon og popup-
  // merknader. Skjemafelta er no statiske, så ingen annotasjonar skal vere
  // att i den utskriftsklare PDF-en.
  for (const page of pdf.getPages()) page.node.delete(PDFName.of("Annots"));
  return pdf;
}

async function duplicateTemplatePage(pdf: PDFDocument) {
  const originalPage = pdf.getPage(0);
  const [copiedPage] = await pdf.copyPages(pdf, [0]);

  // copyPages lagar nye referansar for Illustrator-laga. Kople dei tilbake
  // til laga på originalsida, slik at «ikkje print» også gjeld side 2+.
  const originalProperties = originalPage.node
    .Resources()
    ?.lookupMaybe(PDFName.of("Properties"), PDFDict);
  const copiedProperties = copiedPage.node
    .Resources()
    ?.lookupMaybe(PDFName.of("Properties"), PDFDict);
  if (originalProperties && copiedProperties) {
    for (const key of copiedProperties.keys()) {
      const originalReference = originalProperties.get(key);
      if (originalReference) copiedProperties.set(key, originalReference);
    }
  }
  copiedPage.node.delete(PDFName.of("Annots"));
  pdf.addPage(copiedPage);
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
    const decoded = await getAdminAuth().verifyIdToken(authorization.slice(7));

    const body = (await request.json()) as {
      batchId?: unknown;
      kind?: unknown;
      outputId?: unknown;
    };
    const batchId = typeof body.batchId === "string" ? body.batchId.trim() : "";
    const outputId =
      typeof body.outputId === "string" ? body.outputId.trim() : "";
    const kind: LabelKind | null =
      body.kind === "product" || body.kind === "box" ? body.kind : null;
    if (!batchId || !outputId || !kind) throw new Error("INVALID_REQUEST");

    const snapshot = await getAdminFirestore()
      .collection("productionBatches")
      .doc(batchId)
      .get();
    if (!snapshot.exists) throw new Error("BATCH_NOT_FOUND");
    const batch = snapshot.data() || {};
    if (batch.status !== "completed") throw new Error("BATCH_NOT_COMPLETED");

    const productionDate = asDate(batch.completedAt) || asDate(batch.createdAt);
    const batchNumber =
      typeof batch.batchNumber === "string" ? batch.batchNumber : "";
    if (!productionDate || !batchNumber) throw new Error("BATCH_DATA_MISSING");
    const outputQuantities = (batch.outputQuantities || {}) as Record<
      string,
      string | number
    >;
    const recipe = allProductionRecipes.find(
      (item) => item.id === batch.recipeId,
    );
    const output = recipe?.outputs.find((item) => item.id === outputId);
    if (!recipe || !output) throw new Error("LABELS_NOT_CONFIGURED");
    const settings = (
      await getAdminFirestore()
        .collection("productionSettings")
        .doc("labels")
        .get()
    ).data() as
      | {
          boxLabelsPerSheet?: number;
          bySize?: Record<
            string,
            { labelsPerSheet?: number; unitsPerBox?: number }
          >;
        }
      | undefined;
    const sizeDefaults =
      settings?.bySize?.[
        `${String(output.contentAmount).replace(".", "-")}-${output.contentUnit}`
      ];
    const template = blueberryJamLabelTemplates[outputId];
    const quantity = Math.max(
      0,
      Number(String(outputQuantities[outputId] || 0).replace(",", ".")) || 0,
    );
    if (!quantity)
      throw new Error(kind === "box" ? "NO_BOX_LABELS" : "NO_PRODUCT_LABELS");

    const activeTemplateSnapshot = await getAdminFirestore()
      .collection("productionLabelTemplates")
      .where("templateKey", "==", `${outputId}_${kind}`)
      .get();
    const activeTemplateDocument = activeTemplateSnapshot.docs.find(
      (item) => item.data().active === true,
    );
    const activeTemplate = activeTemplateDocument?.data() as
      ActiveTemplate | undefined;
    let templatePath: string | undefined;
    let sheets = 0;
    if (kind === "product") {
      templatePath = template?.productTemplate;
      sheets = Math.ceil(
        quantity /
          (sizeDefaults?.labelsPerSheet ||
            activeTemplate?.labelsPerSheet ||
            template?.labelsPerSheet ||
            output.labelsPerSheet),
      );
    } else if (
      (activeTemplate?.storagePath || template?.boxTemplate) &&
      (sizeDefaults?.unitsPerBox ||
        activeTemplate?.unitsPerBox ||
        template?.unitsPerBox)
    ) {
      const boxes = Math.ceil(
        quantity /
          (sizeDefaults?.unitsPerBox ||
            activeTemplate?.unitsPerBox ||
            template!.unitsPerBox!),
      );
      templatePath = template?.boxTemplate;
      sheets = Math.ceil(
        boxes /
          (settings?.boxLabelsPerSheet ||
            activeTemplate?.labelsPerSheet ||
            template?.boxLabelsPerSheet ||
            8),
      );
    }
    if ((!templatePath && !activeTemplate?.storagePath) || !sheets)
      throw new Error(kind === "box" ? "NO_BOX_LABELS" : "NO_PRODUCT_LABELS");
    const filled = await filledTemplate(
      templatePath || "",
      bestBefore(productionDate),
      batchNumber,
      activeTemplate,
    );
    for (let index = 1; index < sheets; index += 1)
      await duplicateTemplatePage(filled);
    const pdfBytes = await filled.save();
    const downloadKey = `${outputId}_${kind}`;
    await snapshot.ref.update({
      [`labelDownloads.${downloadKey}`]: {
        downloadedAt: new Date(),
        downloadedBy: { uid: decoded.uid, email: decoded.email || null },
        sheets,
      },
    });
    const suffix = kind === "product" ? "produktetikettar" : "eskeetikettar";
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${batchNumber}-${suffix}.pdf"`,
        "Cache-Control": "no-store",
        "X-Print-Copies": String(sheets),
      },
    });
  } catch (error) {
    console.error("Etikettutskrift feila", error);
    const message =
      error instanceof Error ? error.message : "LABEL_GENERATION_FAILED";
    const status =
      message === "UNAUTHORIZED"
        ? 401
        : message === "BATCH_NOT_FOUND"
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
