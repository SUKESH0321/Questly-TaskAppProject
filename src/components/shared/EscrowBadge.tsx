import { Badge } from "@/components/ui/badge";
import type { EscrowStatus } from "@/types/payment";

const statusConfig: Record<EscrowStatus, { label: string; className: string }> = {
  pending: { label: "Payment Pending", className: "bg-yellow-100 text-yellow-800" },
  held: { label: "Payment Held (Escrow)", className: "bg-blue-100 text-blue-800" },
  released: { label: "Payment Released", className: "bg-green-100 text-green-800" },
  refunded: { label: "Refunded", className: "bg-gray-100 text-gray-800" },
  disputed: { label: "Disputed", className: "bg-red-100 text-red-800" },
};

export function EscrowBadge({ status }: { status: EscrowStatus }) {
  const config = statusConfig[status];
  return <Badge className={config.className}>{config.label}</Badge>;
}
