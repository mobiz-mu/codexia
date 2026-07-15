type FaqEntry = { id: string; question: string; answer: string };

/**
 * Uses the native HTML `<details name="...">` grouping so only one entry in
 * the group can be open at a time — no client JS needed. `groupName` must be
 * unique per accordion instance on the page (e.g. per FAQ category) so
 * separate accordions don't fight over the same open/closed state.
 */
export function FaqAccordion({
  entries,
  groupName,
  layout = "list",
}: {
  entries: FaqEntry[];
  groupName: string;
  layout?: "list" | "grid";
}) {
  return (
    <div
      className={
        layout === "grid"
          ? "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:[grid-auto-flow:column] sm:[grid-template-rows:repeat(5,auto)]"
          : "flex flex-col gap-3"
      }
    >
      {entries.map((entry) => (
        <details
          key={entry.id}
          name={groupName}
          className="group rounded-xl border border-border bg-background p-4 transition-colors open:border-primary open:bg-primary-tint/30 sm:p-5"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink marker:content-none">
            {entry.question}
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-base font-bold leading-none text-primary transition-all duration-200 group-open:rotate-45 group-open:bg-primary group-open:text-white"
              aria-hidden="true"
            >
              +
            </span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted">{entry.answer}</p>
        </details>
      ))}
    </div>
  );
}
