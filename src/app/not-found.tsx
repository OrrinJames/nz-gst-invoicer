import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-2 pt-12 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-sm text-slate-600">That page doesn’t exist, or it belongs to another account.</p>
      <Link href="/" className="text-sm font-medium text-teal-700 hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
