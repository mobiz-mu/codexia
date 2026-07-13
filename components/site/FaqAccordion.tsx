type FaqEntry = { id: string; question: string; answer: string };

export function FaqAccordion({ entries }: { entries: FaqEntry[] }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      {entries.map((entry) => (
        <details key={entry.id} className="group p-4">
          <summary className="cursor-pointer list-none font-medium text-ink marker:content-none">
            <span className="flex items-center justify-between gap-4">
              {entry.question}
              <span className="shrink-0 text-muted transition-transform group-open:rotate-45">+</span>
            </span>
          </summary>
          <p className="mt-3 text-sm text-muted">{entry.answer}</p>
        </details>
      ))}
    </div>
  );
}
