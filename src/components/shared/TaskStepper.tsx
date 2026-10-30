import { Check, Hourglass, Lock, Sparkles, UserCheck, Rocket } from "lucide-react";
import { motion } from "framer-motion";

export type StepperInput = {
  status: "open" | "in_progress" | "completed" | string;
  hasWorker: boolean;
  paymentStatus?: string;
  workerMarkedDone?: boolean;
};

const STEPS = [
  { label: "Posted", hint: "Open for applications", icon: Rocket },
  { label: "Tasker chosen", hint: "Assigned to a tasker", icon: UserCheck },
  { label: "In escrow", hint: "Payment secured", icon: Lock },
  { label: "Work done", hint: "Tasker finished", icon: Hourglass },
  { label: "Paid", hint: "Payment released", icon: Sparkles },
];

/** Which step is current (0-4). 5 means everything is complete. */
export function currentStep(i: StepperInput): number {
  if (i.status === "completed" || i.paymentStatus === "released") return 5;
  if (i.paymentStatus === "held") return i.workerMarkedDone ? 4 : 3;
  if (i.hasWorker) return 2;
  return 1;
}

/** Visual lifecycle of a task, so both sides always know what happens next. */
export function TaskStepper(input: StepperInput) {
  const current = currentStep(input);

  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Task progress">
      {STEPS.map((step, i) => {
        const isDone = i + 1 < current || current === 5;
        const isCurrent = i + 1 === current && current < 5;
        return (
          <li key={step.label} className="relative flex flex-col items-center text-center">
            {i > 0 && (
              <span
                className={`absolute right-1/2 top-[18px] h-0.5 w-full ${
                  i + 1 <= current || current === 5 ? "bg-accent" : "bg-border"
                }`}
                aria-hidden="true"
              />
            )}
            <motion.span
              initial={false}
              animate={{ scale: isCurrent ? 1.08 : 1 }}
              className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                isDone
                  ? "border-accent bg-accent text-accent-foreground"
                  : isCurrent
                    ? "border-primary bg-primary text-primary-foreground shadow-glow"
                    : "border-border bg-card text-muted-foreground"
              }`}
            >
              {isDone ? <Check size={17} strokeWidth={3} /> : <step.icon size={16} />}
            </motion.span>
            <span className={`mt-2 text-[11px] font-bold leading-tight sm:text-xs ${isCurrent ? "text-foreground" : isDone ? "text-foreground/80" : "text-muted-foreground"}`}>
              {step.label}
            </span>
            <span className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">{step.hint}</span>
          </li>
        );
      })}
    </ol>
  );
}
