import { Grid3X3, Tag, Download, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardNavigationProps {
  currentStep: 1 | 2 | 3;
  completedSteps: number[];
  onStepChange: (step: 1 | 2 | 3) => void;
  canProceed?: boolean;
}

const steps = [
  { id: 1 as const, label: "Field", icon: Grid3X3 },
  { id: 2 as const, label: "Details", icon: Tag },
  { id: 3 as const, label: "Save", icon: Download },
];

export function WizardNavigation({
  currentStep,
  completedSteps,
  onStepChange,
  canProceed = true,
}: WizardNavigationProps) {
  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border"
      data-testid="wizard-navigation"
    >
      <div className="flex justify-around items-center h-16">
        {steps.map((step) => {
          const isActive = currentStep === step.id;
          const isCompleted = completedSteps.includes(step.id);
          const Icon = step.icon;

          return (
            <button
              key={step.id}
              onClick={() => {
                onStepChange(step.id);
              }}
              disabled={step.id > currentStep + 1}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 min-w-[80px] transition-colors",
                isActive && "text-orange-500",
                !isActive && isCompleted && "text-green-500",
                !isActive && !isCompleted && "text-muted-foreground"
              )}
              data-testid={`button-step-${step.id}`}
            >
              <div className="relative">
                {isCompleted && !isActive ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <span className="text-xs font-medium">{step.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
