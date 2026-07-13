import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

function substitute(text: string, variables: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] ?? match);
}

export async function getTemplateOverride(
  key: string,
  locale: "en" | "fr",
  variables: Record<string, string>
): Promise<{ subject: string; html: string } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("key", key)
    .eq("locale", locale)
    .maybeSingle();

  if (!data) return null;

  return {
    subject: substitute(data.subject, variables),
    html: substitute(data.body, variables).replace(/\n/g, "<br/>"),
  };
}
