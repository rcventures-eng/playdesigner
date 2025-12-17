import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Tag, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const CONCEPT_OPTIONS = [
  { value: "run", label: "Run", color: "bg-green-600" },
  { value: "pass", label: "Pass", color: "bg-blue-600" },
  { value: "play-action", label: "Play-Action", color: "bg-purple-600" },
  { value: "rpo", label: "RPO", color: "bg-orange-600" },
  { value: "trick", label: "Trick", color: "bg-pink-600" },
] as const;

export type ConceptType = typeof CONCEPT_OPTIONS[number]["value"];

interface TagPopoverProps {
  playId: number;
  currentConcept?: string | null;
  onConceptChange?: (concept: ConceptType) => void;
  triggerClassName?: string;
  disabled?: boolean;
}

export function TagPopover({ 
  playId, 
  currentConcept, 
  onConceptChange,
  triggerClassName,
  disabled = false
}: TagPopoverProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const updateConceptMutation = useMutation({
    mutationFn: async (concept: ConceptType) => {
      const response = await apiRequest("PATCH", `/api/plays/${playId}`, { concept });
      return response.json();
    },
    onSuccess: (_, concept) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plays"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/templates"] });
      toast({
        title: "Tag updated",
        description: `Play tagged as "${CONCEPT_OPTIONS.find(o => o.value === concept)?.label}"`,
      });
      onConceptChange?.(concept);
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSelect = (concept: ConceptType) => {
    updateConceptMutation.mutate(concept);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setOpen(true);
          }}
          className={triggerClassName || "p-1.5 rounded-full bg-white/80 text-gray-500 hover:bg-white hover:text-orange-500 transition-colors"}
          data-testid={`button-tag-${playId}`}
          disabled={disabled}
        >
          <Tag className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-48 p-2 bg-[#1a2332] border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <p className="text-xs text-gray-400 px-2 py-1 font-medium uppercase tracking-wide">
            Tag Play As
          </p>
          {CONCEPT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              disabled={updateConceptMutation.isPending}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm font-medium transition-colors ${
                currentConcept === option.value
                  ? `${option.color} text-white`
                  : "text-gray-300 hover:bg-gray-700"
              }`}
              data-testid={`tag-option-${option.value}`}
            >
              <span className={`w-3 h-3 rounded-full ${option.color}`} />
              <span className="flex-1">{option.label}</span>
              {currentConcept === option.value && (
                <Check className="w-4 h-4" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { CONCEPT_OPTIONS };
