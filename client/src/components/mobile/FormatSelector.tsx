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
      className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      data-testid="format-selector-overlay"
    >
      <div className="bg-card rounded-lg p-6 max-w-md w-full">
        <h2 
          className="text-xl font-bold text-center mb-6 text-card-foreground"
          data-testid="text-format-title"
        >
          Choose Your Game Format
        </h2>
        
        <div className="grid grid-cols-2 gap-3">
          {formats.map((format) => (
            <Button
              key={format.id}
              onClick={() => onSelectFormat(format.id)}
              variant="default"
              className="h-14 font-medium text-base"
              data-testid={`button-format-${format.id}`}
            >
              <Users className="w-4 h-4 mr-2" />
              {format.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
