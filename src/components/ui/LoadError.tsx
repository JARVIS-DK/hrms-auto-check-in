"use client";

/** Compact retry card for failed page loads. */
export default function LoadError({
  message = "Couldn’t load this page",
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="surface-3d rounded-2xl px-5 py-10 text-center">
      <p className="text-sm text-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
