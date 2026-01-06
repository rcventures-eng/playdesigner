import { Grid3X3, Tag, Download, Check, Undo2, Camera, Share2, Trash2, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardNavigationProps {
  currentStep: 1 | 2 | 3;
  completedSteps: number[];
  onStepChange: (step: 1 | 2 | 3) => void;
  canProceed?: boolean;
  canUndo?: boolean;
  canClear?: boolean;
  notesActive?: boolean;
  onUndo?: () => void;
  onClear?: () => void;
  onScreenshot?: () => void;
  onShare?: () => void;
  onToggleNotes?: () => void;
}

const steps = [
  { id: 1 as const, label: "Field", icon: Grid3X3, stepNum: "1" },
  { id: 2 as const, label: "Details", icon: Tag, stepNum: "2" },
  { id: 3 as const, label: "Save", icon: Download, stepNum: "3" },
];

export function WizardNavigation({
  currentStep,
  completedSteps,
  onStepChange,
  canProceed = true,
  canUndo = false,
  canClear = false,
  notesActive = false,
  onUndo,
  onClear,
  onScreenshot,
  onShare,
  onToggleNotes,
}: WizardNavigationProps) {
  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-area-inset-bottom"
      data-testid="wizard-navigation"
    >
      <div className="flex items-center h-14 px-2">
        {/* Wizard Steps - Left aligned, smaller */}
        <div className="flex items-center gap-1">
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
                  "flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 min-w-[48px] rounded-md transition-colors",
                  isActive && "text-orange-500 bg-orange-500/10",
                  !isActive && isCompleted && "text-green-500",
                  !isActive && !isCompleted && "text-muted-foreground",
                  step.id > currentStep + 1 && "opacity-50"
                )}
                data-testid={`button-step-${step.id}`}
              >
                <div className="relative">
                  {isCompleted && !isActive ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span className="text-[10px] font-medium">{step.label}</span>
                <span 
                  className={cn(
                    "w-3.5 h-3.5 text-[9px] font-medium rounded-full flex items-center justify-center",
                    isActive && "bg-orange-500 text-white",
                    !isActive && isCompleted && "bg-green-500 text-white",
                    !isActive && !isCompleted && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted && !isActive ? <Check className="w-2 h-2" /> : step.stepNum}
                </span>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-border mx-2" />

        {/* Tools Section - Right side */}
        <div className="flex items-center gap-1 ml-auto">
          {/* Undo Action Button */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 min-w-[44px] rounded-md border transition-colors",
              canUndo 
                ? "text-foreground border-border hover:bg-accent active:bg-accent/80"
                : "text-muted-foreground/50 border-border/50 cursor-not-allowed"
            )}
            data-testid="button-undo"
          >
            <Undo2 className="w-4 h-4" />
            <span className="text-[9px] font-medium whitespace-nowrap">Undo Action</span>
          </button>

          {/* Clear Play Button */}
          <button
            onClick={onClear}
            disabled={!canClear}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 min-w-[44px] rounded-md border transition-colors",
              canClear 
                ? "text-foreground border-border hover:bg-accent active:bg-accent/80"
                : "text-muted-foreground/50 border-border/50 cursor-not-allowed"
            )}
            data-testid="button-clear"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-[9px] font-medium whitespace-nowrap">Clear Play</span>
          </button>

          {/* Notes Button - Apple Notes style */}
          <button
            onClick={onToggleNotes}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 min-w-[44px] rounded-md border transition-colors",
              notesActive
                ? "bg-gradient-to-br from-yellow-300 to-yellow-400 border-yellow-500 text-yellow-900"
                : "border-yellow-400 text-yellow-600 hover:bg-yellow-50 active:bg-yellow-100"
            )}
            data-testid="button-notes"
          >
            <StickyNote className="w-4 h-4" />
            <span className="text-[9px] font-medium">Notes</span>
          </button>

          {/* Screenshot Button */}
          <button
            onClick={onScreenshot}
            className="flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 min-w-[44px] rounded-md border border-border text-foreground hover:bg-accent active:bg-accent/80 transition-colors"
            data-testid="button-screenshot"
          >
            <Camera className="w-4 h-4" />
            <span className="text-[9px] font-medium">Screenshot</span>
          </button>

          {/* Share Button */}
          <button
            onClick={onShare}
            className="flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 min-w-[44px] rounded-md border border-border text-foreground hover:bg-accent active:bg-accent/80 transition-colors"
            data-testid="button-share"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-[9px] font-medium">Share</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
