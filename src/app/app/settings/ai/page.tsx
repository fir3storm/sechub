import { redirect } from "next/navigation";

export default function AISettingsRedirect() {
  redirect("/app/settings/integrations");
}
