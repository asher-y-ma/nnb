import { StudioWorkspace } from "@/components/studio/studio-workspace";

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string; restore?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const activeModule =
    resolvedSearchParams.module === "main" ||
    resolvedSearchParams.module === "detail" ||
    resolvedSearchParams.module === "style-clone" ||
    resolvedSearchParams.module === "retouch" ||
    resolvedSearchParams.module === "fashion" ||
    resolvedSearchParams.module === "commerce"
      ? resolvedSearchParams.module
      : "main";

  return (
    <StudioWorkspace
      activeModule={activeModule}
      restoreJobId={resolvedSearchParams.restore}
    />
  );
}
