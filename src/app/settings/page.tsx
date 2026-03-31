import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  return <SettingsForm authStatus={resolvedSearchParams.auth} />;
}
