import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePaymentStore } from "@/stores/paymentStore";
import { LogoMark } from "@/components/shared/Logo";

interface PaymentModalProps {
  taskId: string;
  amount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PaymentModal({ taskId, amount, open, onOpenChange, onSuccess }: PaymentModalProps) {
  const initiatePayment = usePaymentStore((s) => s.initiatePayment);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await initiatePayment(taskId, amount);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { error?: string } } }).response?.data
              ?.error
          : undefined;
      setError(message || "Payment failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm & Hold Payment</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="mb-4 flex justify-center"><LogoMark size={88} /></div>
          <p className="text-sm text-muted-foreground">
            This amount will be held in escrow until the task is marked complete and you release it to the tasker.
          </p>
          <p className="mt-4 text-2xl font-semibold">₹{amount}</p>
          {error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handlePay} disabled={isProcessing}>
            {isProcessing ? "Processing..." : `Pay ₹${amount}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}