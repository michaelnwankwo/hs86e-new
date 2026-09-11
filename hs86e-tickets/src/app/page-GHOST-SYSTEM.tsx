import { redirect } from "next/navigation";

/**
 * Root landing route.
 *
 * Visiting "/" (address bar, bookmarks, PWA launch, marketing links)
 * immediately redirects to the Events page, the app's default landing route.
 */
export default function HomePage() {
  redirect("/events");
}
