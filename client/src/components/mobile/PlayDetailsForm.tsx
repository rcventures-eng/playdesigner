import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITUATIONAL_TAGS } from "@shared/logic-dictionary";
import type { DraftPlayer, DraftRoute } from "@/hooks/usePlayDraft";

interface PlayDetailsFormProps {
  players: DraftPlayer[];
  routes: DraftRoute[];
  name: string;
  onNameChange: (name: string) => void;
  situationTags: string[];
  onSituationTagsChange: (tags: string[]) => void;
  conceptTags: string[];
  onConceptTagsChange: (tags: string[]) => void;
  onEditPlay: () => void;
  validationError?: string;
  gameFormat?: string;
}

const CONCEPT_OPTIONS = [
  { value: "run", label: "Run" },
  { value: "pass", label: "Pass" },
  { value: "play-action", label: "Play-Action" },
  { value: "rpo", label: "RPO" },
  { value: "trick", label: "Trick" },
];

export function PlayDetailsForm({
  players,
  routes,
  name,
  onNameChange,
  situationTags,
  onSituationTagsChange,
  conceptTags,
  onConceptTagsChange,
  onEditPlay,
  validationError,
  gameFormat = "5v5",
}: PlayDetailsFormProps) {
  const formatKey = gameFormat as keyof typeof SITUATIONAL_TAGS;
  const situationOptions = SITUATIONAL_TAGS[formatKey] || SITUATIONAL_TAGS["5v5"];

  const toggleSituationTag = (tag: string) => {
    if (situationTags.includes(tag)) {
      onSituationTagsChange(situationTags.filter((t) => t !== tag));
    } else {
      onSituationTagsChange([...situationTags, tag]);
    }
  };

  const toggleConceptTag = (tag: string) => {
    if (conceptTags.includes(tag)) {
      onConceptTagsChange(conceptTags.filter((t) => t !== tag));
    } else {
      onConceptTagsChange([...conceptTags, tag]);
    }
  };

  return (
    <div 
      className="flex gap-4 h-full p-4 pb-20"
      data-testid="play-details-form"
    >
      <div className="w-36 shrink-0">
        <div className="relative bg-green-800 rounded-lg aspect-[16/10] overflow-hidden" data-testid="play-preview">
          <MiniPreview players={players} routes={routes} />
          <Button
            onClick={onEditPlay}
            size="sm"
            variant="secondary"
            className="absolute bottom-2 right-2 h-7 text-xs"
            data-testid="button-edit-play"
          >
            <Pencil className="w-3 h-3 mr-1" />
            Edit
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <Label htmlFor="play-name">Play Name *</Label>
          <Input
            id="play-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Enter play name"
            className={cn(validationError && !name.trim() && "border-red-500")}
            data-testid="input-play-name"
          />
          {validationError && !name.trim() && (
            <p className="text-xs text-red-500">{validationError}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Concept</Label>
          <div className="flex flex-wrap gap-2">
            {CONCEPT_OPTIONS.map((option) => (
              <Badge
                key={option.value}
                variant={conceptTags.includes(option.value) ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-colors"
                )}
                onClick={() => toggleConceptTag(option.value)}
                data-testid={`tag-concept-${option.value}`}
              >
                {option.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Situation</Label>
          <div className="flex flex-wrap gap-2">
            {situationOptions.map((tag) => (
              <Badge
                key={tag}
                variant={situationTags.includes(tag) ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-colors"
                )}
                onClick={() => toggleSituationTag(tag)}
                data-testid={`tag-situation-${tag.replace(/\s+/g, "-").toLowerCase()}`}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniPreview({ 
  players, 
  routes 
}: { 
  players: DraftPlayer[]; 
  routes: DraftRoute[]; 
}) {
  const fieldWidth = 694;
  const fieldHeight = 392;

  return (
    <svg
      viewBox={`0 0 ${fieldWidth} ${fieldHeight}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <line x1={fieldWidth / 2} y1={284} x2={fieldWidth / 2 - 40} y2={284} stroke="#fff" strokeWidth="2" opacity="0.5" />
      <line x1={fieldWidth / 2} y1={284} x2={fieldWidth / 2 + 40} y2={284} stroke="#fff" strokeWidth="2" opacity="0.5" />

      {routes.map((route) => {
        if (route.points.length < 2) return null;
        const pathD = route.points
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
          .join(" ");
        return (
          <path
            key={route.id}
            d={pathD}
            stroke={route.isPrimary ? "#ef4444" : "#9ca3af"}
            strokeWidth="2"
            fill="none"
          />
        );
      })}

      {players.map((player) => (
        <g key={player.id}>
          <circle
            cx={player.x}
            cy={player.y}
            r={12}
            fill={player.color}
            stroke={player.side === "offense" ? "#000" : "#fff"}
            strokeWidth="2"
          />
          <text
            x={player.x}
            y={player.y + 4}
            textAnchor="middle"
            fontSize="10"
            fontWeight="bold"
            fill={player.side === "offense" ? "#fff" : "#000"}
          >
            {player.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
