import { BadgeCheck, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Small trust badges. Shows only what has been genuinely verified. */
export function VerifiedBadges({
  phone,
  id,
  demo = false,
  className = "",
}: {
  phone?: boolean;
  id?: boolean;
  /** Identity checks are simulated (demo mode): label it honestly. */
  demo?: boolean;
  className?: string;
}) {
  if (!phone && !id) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {id && (
        <Badge variant="success" className="gap-1">
          <BadgeCheck size={12} /> {demo ? "Demo ID check" : "ID verified"}
        </Badge>
      )}
      {phone && (
        <Badge variant="success" className="gap-1">
          <Smartphone size={12} /> Phone verified
        </Badge>
      )}
    </span>
  );
}
