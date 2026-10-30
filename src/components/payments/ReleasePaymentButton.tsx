import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePaymentStore } from "@/stores/paymentStore";

export function ReleasePaymentButton({
  taskId,
  onSuccess,
}: {
  taskId: string;
  onSuccess?: () => void;
}) {
  const releasePayment = usePaymentStore((s) => s.releasePayment);
  const [isReleasing, setIsReleasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRelease = async () => {
    setIsReleasing(true);
    setError(null);
    setSuccess(false);
    try {
      await releasePayment(taskId);
      setSuccess(true);
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { error?: string } } }).response?.data
              ?.error
          : undefined;
      setError(message || "Failed to release payment. Please try again.");
    } finally {
      setIsReleasing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleRelease} disabled={isReleasing || success}>
        {isReleasing
          ? "Releasing..."
          : success
            ? "Payment Released ✓"
            : "Confirm Task & Release Payment"}
      </Button>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}