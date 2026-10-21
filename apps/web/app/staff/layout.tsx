import Link from "next/link";
import type { ReactNode } from "react";
import { requireStaff } from "@/lib/staff";

export const metadata = { title: "Staff — Sentinela" };

export default async function StaffLayout({ children }: { children: ReactNode }) {
  await requireStaff();
  return (
    <div className="flex-1 bg-[#F2F7FA]">
      <header className="bg-n1 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
          <Link href="/staff" className="font-[family-name:var(--font-archivo)] text-lg font-extrabold tracking-wide">
            SENTINELA <span className="ml-2 rounded-full bg-teal px-2.5 py-0.5 align-middle text-xs font-semibold">STAFF</span>
          </Link>
          <p className="text-xs text-ice/70">Área interna DataDops</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
