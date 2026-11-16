import { RouteSkeleton } from "@/components/ui/RouteSkeleton";

// Non-blocking placeholder for route transitions; the gold GoldTopLoader in the
// AppHeader is the progress indicator. No full-screen blocker.
export default function Loading() {
  return <RouteSkeleton variant="tickets" />;
}
