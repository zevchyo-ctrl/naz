import NazMoviesApp from "@/components/NazMoviesApp";
import { getSettings } from "@/lib/settingsServer";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/defaults";

export const dynamic = "force-dynamic";

export default async function Page() {
  let settings = DEFAULT_PLATFORM_SETTINGS;
  try {
    settings = await getSettings();
  } catch (e) {
    console.error("Failed to load settings for first render:", e);
  }
  return <NazMoviesApp initialSettings={settings} />;
}
