import type { Metadata } from "next";
import { listEmailTemplateOverrides } from "@/lib/actions/admin/email-templates";
import { KNOWN_TEMPLATE_KEYS } from "@/lib/email/template-keys";
import { EmailTemplateEditor } from "@/components/admin/EmailTemplateEditor";

export const metadata: Metadata = { title: "Email Templates" };

export default async function AdminEmailTemplatesPage() {
  const overrides = await listEmailTemplateOverrides();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Email Templates</h1>
      <p className="text-sm text-muted">
        Templates without a saved override use the shipped default design. Variables are substituted
        automatically when the email is sent.
      </p>

      <div className="flex flex-col gap-6">
        {KNOWN_TEMPLATE_KEYS.map((template) =>
          (["en", "fr"] as const).map((locale) => {
            const existing = overrides.find((o) => o.key === template.key && o.locale === locale);
            return (
              <EmailTemplateEditor
                key={`${template.key}-${locale}`}
                templateKey={template.key}
                label={template.label}
                variables={template.variables}
                locale={locale}
                existing={existing ? { subject: existing.subject, body: existing.body } : undefined}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
