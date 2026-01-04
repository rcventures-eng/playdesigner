import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

interface FormatSelectorProps {
  isVisible: boolean;
  onSelectFormat: (format: string) => void;
}

const formats = [
  { id: "5v5", label: "5-on-5 Flag" },
  { id: "7v7", label: "7-on-7 Flag" },
  { id: "9v9", label: "9-on-9 Flag" },
  { id: "11v11", label: "11-on-11 Tackle" },
];

export function FormatSelector({ isVisible, onSelectFormat }: FormatSelectorProps) {
  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-x-0 top-0 bottom-0 z-50 bg-background flex flex-col"
      data-testid="format-selector-overlay"
    >
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <h2 
          className="text-2xl font-bold text-center mb-8 text-foreground"
          data-testid="text-format-title"
        >
          Choose Your Game Format
        </h2>
        
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          {formats.map((format) => (
            <Button
              key={format.id}
              onClick={() => onSelectFormat(format.id)}
              variant="default"
              className="h-20 font-medium text-base flex flex-col gap-1"
              data-testid={`button-format-${format.id}`}
            >
              <Users className="w-6 h-6" />
              <span>{format.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
