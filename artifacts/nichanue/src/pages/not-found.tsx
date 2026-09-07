import { ArrowLeft, CircleAlert } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#f5f8f9] p-6 text-[#174b5b]">
      <div className="w-full max-w-md rounded-2xl border border-[#dbe3e5] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-[#fff3f1] text-[#b8554b]"><CircleAlert size={28} /></div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[.16em] text-[#1c6b5d]">404 / Page not found</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">This page is unavailable.</h1>
        <p className="mt-3 text-sm leading-6 text-[#63747a]">Return to the home page to begin your Nichanue application.</p>
        <Link href="/" data-testid="link-back-home" className="focus-ring mt-7 inline-flex items-center gap-2 rounded-lg bg-[#174b5b] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#123d4a]"><ArrowLeft size={16} /> Return home</Link>
      </div>
    </main>
  );
}
