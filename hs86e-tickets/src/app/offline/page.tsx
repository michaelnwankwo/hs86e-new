import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="px-4 py-16 text-center">
      <h1 className="font-display text-3xl text-ink">You&apos;re offline</h1>
      <p className="mt-3 text-sm text-ink-muted">
        The ticket wallet and door scanner stay available from the installed PWA cache.
      </p>
      <div className="mt-6 flex justify-center gap-3 text-sm text-gold">
        <Link href="/tickets">Wallet</Link>
        <Link href="/scan">Scanner</Link>
      </div>
    </div>
  );
}
