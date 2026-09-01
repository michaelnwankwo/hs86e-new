import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-4 py-16 text-center">
      <h1 className="font-display text-3xl text-ink">Page not found</h1>
      <Link href="/events" className="mt-6 inline-block text-sm text-gold">
        Back to events
      </Link>
    </div>
  );
}
