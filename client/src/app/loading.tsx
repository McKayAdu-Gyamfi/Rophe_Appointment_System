import { LoadingScreen } from "@/components/loading";

// Shown while the next page's code downloads, so a tap on the nav gets an
// answer straight away instead of the old page sitting there unchanged.
export default function Loading() {
  return <LoadingScreen />;
}
