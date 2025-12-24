import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { 
  Tag, 
  Check, 
  Archive, 
  ArchiveRestore,
  MapPin,
  Target,
  Flag,
  Zap,
  ArrowUp,
  ArrowRight,
  Crosshair,
  TrendingUp,
  Goal
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SITUATIONAL_TAGS } from "@shared/logic-dictionary";

const CONCEPT_OPTIONS = [
  { value: "run", label: "Run", color: "bg-green-600" },
  { value: "pass", label: "Pass", color: "bg-blue-600" },
  { value: "play-action", label: "Play-Action", color: "bg-purple-600" },
  { value: "rpo", label: "RPO", color: "bg-orange-600" },
  { value: "trick", label: "Trick", color: "bg-pink-600" },
] as const;

const SITUATION_ICONS: Record<string, typeof MapPin> = {
  "Open Field": MapPin,
  "Red Zone": Target,
  "High Red Zone": Target,
  "Low Red Zone": Target,
  "Goal Line": Flag,
  "2pt Conversion": Zap,
  "Backed Up": ArrowUp,
  "Coming Out": ArrowRight,
  "Midfield": Crosshair,
  "Plus Territory": TrendingUp,
};

export type ConceptType = typeof CONCEPT_OPTIONS[number]["value"];

interface TagPopoverProps {
  playId: number;
  currentConcept?: string | null;
  currentSituation?: string | null;
  playData?: any;
  onConceptChange?: (concept: ConceptType) => void;
  onSituationChange?: (situation: string) => void;
  isArchived?: boolean;
  onArchiveChange?: () => void;
  triggerClassName?: string;
  disabled?: boolean;
}

function getGameFormatFromPlayerCount(playData: any): string {
  if (!playData) return "5v5";
  
  const offensePlayers = playData.offensePlayers?.length || 0;
  const defensePlayers = playData.defensePlayers?.length || 0;
  const totalPlayers = Math.max(offensePlayers, defensePlayers);
  
  if (totalPlayers >= 11) return "11v11";
  if (totalPlayers >= 9) return "9v9";
  if (totalPlayers >= 7) return "7v7";
  return "5v5";
}

export function TagPopover({ 
  playId, 
  currentConcept, 
  currentSituation,
  playData,
  onConceptChange,
  onSituationChange,
  isArchived = false,
  onArchiveChange,
  triggerClassName,
  disabled = false
}: TagPopoverProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  const gameFormat = getGameFormatFromPlayerCount(playData);
  const situationalOptions = SITUATIONAL_TAGS[gameFormat] || SITUATIONAL_TAGS["5v5"];

  const updateConceptMutation = useMutation({
    mutationFn: async (concept: ConceptType) => {
      const response = await apiRequest("PATCH", `/api/plays/${playId}`, { concept });
      return response.json();
    },
    onSuccess: (_, concept) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plays"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/templates"] });
      toast({
        title: "Concept updated",
        description: `Play tagged as "${CONCEPT_OPTIONS.find(o => o.value === concept)?.label}"`,
      });
      onConceptChange?.(concept);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update concept",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSituationMutation = useMutation({
    mutationFn: async (situation: string | null) => {
      const response = await apiRequest("PATCH", `/api/plays/${playId}`, { situation });
      return response.json();
    },
    onSuccess: (_, situation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plays"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/templates"] });
      toast({
        title: situation ? "Situation updated" : "Situation cleared",
        description: situation ? `Play tagged as "${situation}"` : "Situation tag removed",
      });
      onSituationChange?.(situation || "");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update situation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/plays/${playId}/archive`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plays"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/templates"] });
      toast({
        title: isArchived ? "Restored" : "Archived",
        description: isArchived ? "Play restored from archive" : "Play moved to archive",
      });
      onArchiveChange?.();
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update archive status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConceptSelect = (concept: ConceptType) => {
    updateConceptMutation.mutate(concept);
  };

  const handleSituationSelect = (situation: string) => {
    if (currentSituation === situation) {
      updateSituationMutation.mutate(null);
    } else {
      updateSituationMutation.mutate(situation);
    }
  };

  const handleArchiveToggle = () => {
    archiveMutation.mutate();
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
            Tag Play By
          </p>
          
          {/* Concept Section */}
          <p className="text-xs text-gray-500 px-2 pt-1 font-medium">
            Concept
          </p>
          {CONCEPT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleConceptSelect(option.value)}
              disabled={updateConceptMutation.isPending}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left text-sm font-medium transition-colors ${
                currentConcept === option.value
                  ? `${option.color} text-white`
                  : "text-gray-300 hover:bg-gray-700"
              }`}
              data-testid={`tag-option-${option.value}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${option.color}`} />
              <span className="flex-1">{option.label}</span>
              {currentConcept === option.value && (
                <Check className="w-3.5 h-3.5" />
              )}
            </button>
          ))}
          
          <div className="border-t border-gray-600 my-2" />
          
          {/* Situational Section */}
          <p className="text-xs text-gray-500 px-2 pt-1 font-medium">
            Situational
          </p>
          {situationalOptions.map((situation) => {
            const IconComponent = SITUATION_ICONS[situation] || MapPin;
            return (
              <button
                key={situation}
                onClick={() => handleSituationSelect(situation)}
                disabled={updateSituationMutation.isPending}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left text-sm font-medium transition-colors ${
                  currentSituation === situation
                    ? "bg-gray-600 text-white"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
                data-testid={`tag-situation-${situation.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <IconComponent className="w-3.5 h-3.5" />
                <span className="flex-1">{situation}</span>
                {currentSituation === situation && (
                  <Check className="w-3.5 h-3.5" />
                )}
              </button>
            );
          })}
          
          <div className="border-t border-gray-600 my-2" />
          
          {/* Archive Section */}
          <button
            onClick={handleArchiveToggle}
            disabled={archiveMutation.isPending}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
            data-testid={`tag-archive-option`}
          >
            {isArchived ? (
              <ArchiveRestore className="w-3.5 h-3.5" />
            ) : (
              <Archive className="w-3.5 h-3.5" />
            )}
            <span className="flex-1">{isArchived ? "Restore from Archive" : "Archive"}</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { CONCEPT_OPTIONS };
