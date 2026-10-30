import { lazy, Suspense } from "react";
import { Input } from "@/components/ui/input";

// The map library is only downloaded on pages that actually show a map.
const LocationPicker = lazy(() => import("./LocationPicker"));

interface LocationFieldProps {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  height?: number;
  className?: string;
}

/** Address input with a live map (see LocationPicker). Falls back to a plain input while loading. */
export function LocationField(props: LocationFieldProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-2">
          <Input value={props.value} onChange={(e) => props.onChange(e.target.value)} placeholder={props.placeholder ?? "Search or type your address"} maxLength={200} />
          <div className="animate-pulse rounded-xl bg-muted" style={{ height: props.height ?? 220 }} />
        </div>
      }
    >
      <LocationPicker {...props} />
    </Suspense>
  );
}
