import { NextRequest, NextResponse } from "next/server";
import { PDFArray, PDFDocument, PDFName } from "pdf-lib";
import {
  getAdminAuth,
  getAdminFirestore,
  getAdminStorageBucket,
} from "@/lib/firebaseAdmin";
import { allProductionRecipes } from "@/lib/production/recipes.generated";
import {
  labelTemplateKey,
  type LabelTemplateKind,
  type LabelVariableField,
} from "@/lib/production/labelTemplateAdmin";

export const runtime = "nodejs";

async function admin(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
  return getAdminAuth().verifyIdToken(authorization.slice(7));
}

async function importVariableFields(
  storagePath: string,
): Promise<LabelVariableField[]> {
  const [bytes] = await getAdminStorageBucket().file(storagePath).download();
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  const variableFields: LabelVariableField[] = [];
  const importWidgets = (name: string, type: "date" | "batch") => {
    const field = form.getFieldMaybe(name);
    if (!field || !("acroField" in field)) return;
    field.acroField.getWidgets().forEach((widget, index) => {
      const rect = widget.getRectangle();
      variableFields.push({
        id: `${type}-${index + 1}`,
        type,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        fontSize: 7,
      });
    });
  };
  importWidgets("Dato", "date");
  importWidgets("Partnr", "batch");
  return variableFields;
}

export async function GET(request: NextRequest) {
  try {
    await admin(request);
    const templateId = request.nextUrl.searchParams.get("file");
    if (templateId) {
      const template = await getAdminFirestore()
        .collection("productionLabelTemplates")
        .doc(templateId)
        .get();
      if (!template.exists || !template.data()?.storagePath)
        throw new Error("NOT_FOUND");
      const [bytes] = await getAdminStorageBucket()
        .file(template.data()!.storagePath)
        .download();
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "no-store",
        },
      });
    }
    const snapshot = await getAdminFirestore()
      .collection("productionLabelTemplates")
      .orderBy("createdAt", "desc")
      .get();
    const templates = await Promise.all(
      snapshot.docs.map(async (item) => {
        const data = item.data();
        let variableFields = data.variableFields as
          LabelVariableField[] | undefined;
        if (
          (!variableFields || !variableFields.length) &&
          data.storagePath &&
          (data.dateFieldFound || data.batchFieldFound)
        ) {
          variableFields = await importVariableFields(data.storagePath);
          if (variableFields.length) {
            const ready =
              variableFields.some((field) => field.type === "date") &&
              variableFields.some((field) => field.type === "batch");
            await item.ref.update({
              variableFields,
              calibrationStatus: ready ? "ready" : "required",
            });
          }
        }
        return {
          id: item.id,
          ...data,
          ...(variableFields ? { variableFields } : {}),
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        };
      }),
    );
    const settingsSnapshot = await getAdminFirestore()
      .collection("productionSettings")
      .doc("labels")
      .get();
    return NextResponse.json({
      templates,
      settings: settingsSnapshot.data() || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "FAILED" },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await admin(request);
    const data = await request.formData();
    const file = data.get("file");
    const outputId = String(data.get("outputId") || "");
    const recipeId = String(data.get("recipeId") || "");
    const outputName = String(data.get("outputName") || "");
    const kind = String(data.get("kind") || "") as LabelTemplateKind;
    const labelsPerSheet = Number(data.get("labelsPerSheet") || 0);
    const unitsPerBox = Number(data.get("unitsPerBox") || 0) || undefined;
    if (
      !(file instanceof File) ||
      file.type !== "application/pdf" ||
      !recipeId ||
      !outputId ||
      !outputName ||
      !["product", "box"].includes(kind) ||
      !labelsPerSheet
    )
      throw new Error("INVALID_REQUEST");
    const recipe = allProductionRecipes.find((item) => item.id === recipeId);
    if (!recipe?.outputs.some((item) => item.id === outputId))
      throw new Error("OUTPUT_NOT_CONFIGURED");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await PDFDocument.load(bytes);
    const form = pdf.getForm();
    const fields = form.getFields().map((field) => field.getName());
    const variableFields: LabelVariableField[] = [];
    const importWidgets = (name: string, type: "date" | "batch") => {
      const field = form.getFieldMaybe(name);
      if (!field || !("acroField" in field)) return;
      field.acroField.getWidgets().forEach((widget, index) => {
        const rect = widget.getRectangle();
        variableFields.push({
          id: `${type}-${index + 1}`,
          type,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          fontSize: 7,
        });
      });
    };
    importWidgets("Dato", "date");
    importWidgets("Partnr", "batch");
    const page = pdf.getPage(0);
    const annotationCount =
      page.node.lookupMaybe(PDFName.of("Annots"), PDFArray)?.size() || 0;
    const db = getAdminFirestore();
    const key = labelTemplateKey(outputId, kind);
    const existing = await db
      .collection("productionLabelTemplates")
      .where("templateKey", "==", key)
      .get();
    const version =
      existing.docs.reduce(
        (max, item) => Math.max(max, Number(item.data().version || 0)),
        0,
      ) + 1;
    const ref = db.collection("productionLabelTemplates").doc();
    const storagePath = `production-label-templates/${recipeId}/${outputId}/${kind}/v${version}-${ref.id}.pdf`;
    await getAdminStorageBucket().file(storagePath).save(Buffer.from(bytes), {
      contentType: "application/pdf",
      resumable: false,
    });
    const batch = db.batch();
    const ready =
      variableFields.some((item) => item.type === "date") &&
      variableFields.some((item) => item.type === "batch");
    if (ready)
      existing.docs
        .filter((item) => item.data().active)
        .forEach((item) => batch.update(item.ref, { active: false }));
    batch.set(ref, {
      templateKey: key,
      recipeId,
      outputId,
      outputName,
      kind,
      version,
      fileName: file.name,
      storagePath,
      active: ready,
      calibrationStatus: ready ? "ready" : "required",
      pageWidth: page.getWidth(),
      pageHeight: page.getHeight(),
      pageCount: pdf.getPageCount(),
      dateFieldFound: fields.includes("Dato"),
      batchFieldFound: fields.includes("Partnr"),
      annotationCount,
      labelsPerSheet,
      ...(unitsPerBox ? { unitsPerBox } : {}),
      dateOffsetX: 0,
      dateOffsetY: 0,
      batchOffsetX: 0,
      batchOffsetY: 0,
      variableFields,
      createdAt: new Date(),
      createdBy: { uid: user.uid, email: user.email || null },
    });
    await batch.commit();
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    console.error("Opplasting av etikettmal feila", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "UPLOAD_FAILED" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await admin(request);
    const body = (await request.json()) as Record<string, unknown>;
    if (body.settings && typeof body.settings === "object") {
      await getAdminFirestore()
        .collection("productionSettings")
        .doc("labels")
        .set(body.settings as Record<string, unknown>, { merge: true });
      return NextResponse.json({ ok: true });
    }
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) throw new Error("INVALID_REQUEST");
    const ref = getAdminFirestore()
      .collection("productionLabelTemplates")
      .doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new Error("NOT_FOUND");
    const allowed = [
      "dateOffsetX",
      "dateOffsetY",
      "batchOffsetX",
      "batchOffsetY",
      "fontSize",
      "labelsPerSheet",
      "unitsPerBox",
    ];
    const updates: Record<string, unknown> = Object.fromEntries(
      allowed.flatMap((key) =>
        typeof body[key] === "number" ? [[key, body[key]]] : [],
      ),
    );
    if (Array.isArray(body.variableFields)) {
      updates.variableFields = body.variableFields;
      const types = new Set(
        (body.variableFields as Array<{ type?: unknown }>).map(
          (item) => item.type,
        ),
      );
      updates.calibrationStatus =
        types.has("date") && types.has("batch") ? "ready" : "required";
    }
    if (body.active === true) {
      const effectiveFields = (updates.variableFields ||
        snapshot.data()?.variableFields ||
        []) as LabelVariableField[];
      if (
        !effectiveFields.some((item) => item.type === "date") ||
        !effectiveFields.some((item) => item.type === "batch")
      )
        throw new Error("CALIBRATION_REQUIRED");
      const siblings = await getAdminFirestore()
        .collection("productionLabelTemplates")
        .where("templateKey", "==", snapshot.data()?.templateKey)
        .get();
      const batch = getAdminFirestore().batch();
      siblings.docs.forEach((item) =>
        batch.update(item.ref, { active: item.id === id }),
      );
      await batch.commit();
    }
    if (Object.keys(updates).length) await ref.update(updates);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "UPDATE_FAILED" },
      { status: 400 },
    );
  }
}
