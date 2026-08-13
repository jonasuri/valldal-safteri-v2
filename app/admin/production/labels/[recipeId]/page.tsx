import LabelTemplatesPage from "../page";

export default async function RecipeLabelTemplatesPage({
  params,
}: {
  params: Promise<{ recipeId: string }>;
}) {
  const { recipeId } = await params;
  return <LabelTemplatesPage recipeId={recipeId} />;
}
