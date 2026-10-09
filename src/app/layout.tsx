import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/login/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NZ GST Invoicer", template: "%s · NZ GST Invoicer" },
  description: "Create GST-compliant tax invoices for New Zealand freelancers.",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/clients", label: "Clients" },
  { href: "/settings", label: "Business details" },
];

export default async function RootLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en-NZ">
      <body>
        {user ? (
          <header className="no-print border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
              <Link href="/" className="font-semibold text-teal-800">
                NZ GST Invoicer
              </Link>
              <nav className="flex flex-wrap gap-4 text-sm text-slate-600">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} className="hover:text-slate-900">
                    {item.label}
                  </Link>
                ))}
              </nav>
              <form action={signOutAction} className="ml-auto">
                <button type="submit" className="text-sm text-slate-500 hover:text-slate-900">
                  Sign out
                </button>
              </form>
            </div>
          </header>
        ) : null}
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
