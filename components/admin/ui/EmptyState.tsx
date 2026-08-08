export function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
      {message}
    </p>
  );
}
