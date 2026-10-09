"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-3 pt-12 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-slate-600">The request couldn’t be completed. Please try again.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
      >
        Try again
      </button>
    </div>
  );
}
