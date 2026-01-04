import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ArrowRight, Footprints, Shield, Minus, Waves, Zap, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerActionMenuProps {
  isVisible: boolean;
  playerId: string;
  playerLabel: string;
  position: { x: number; y: number };
  side: "offense" | "defense";
  onClose: () => void;
  onSelectAction: (action: {
    type: "pass" | "run" | "block" | "blitz" | "man" | "zone";
    style: "straight" | "curved";
    isMotion?: boolean;
    isPrimary?: boolean;
  }) => void;
}

export function PlayerActionMenu({
  isVisible,
  playerId,
  playerLabel,
  position,
  side,
  onClose,
  onSelectAction,
}: PlayerActionMenuProps) {
  if (!isVisible) return null;

  const offenseActions = [
    { type: "pass" as const, label: "Pass Route", icon: ArrowRight, color: "bg-blue-500" },
    { type: "run" as const, label: "Run Route", icon: Footprints, color: "bg-green-500" },
    { type: "block" as const, label: "Block", icon: Shield, color: "bg-gray-500" },
  ];

  const defenseActions = [
    { type: "blitz" as const, label: "Blitz", icon: Zap, color: "bg-red-500" },
    { type: "man" as const, label: "Man Coverage", icon: ArrowRight, color: "bg-blue-500" },
    { type: "zone" as const, label: "Zone", icon: Shield, color: "bg-purple-500" },
  ];

  const actions = side === "offense" ? offenseActions : defenseActions;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center p-4"
      onClick={onClose}
      data-testid="player-action-menu-overlay"
    >
      <Card 
        className="w-full max-w-md p-4 bg-card animate-in slide-in-from-bottom-4"
        onClick={(e) => e.stopPropagation()}
        data-testid="player-action-menu"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">
            Player {playerLabel}
          </h3>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={onClose}
            data-testid="button-close-menu"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Select Action</p>
            <div className="grid grid-cols-3 gap-2">
              {actions.map((action) => (
                <Button
                  key={action.type}
                  variant="outline"
                  className="flex flex-col h-16 gap-1"
                  onClick={() => onSelectAction({
                    type: action.type,
                    style: "straight",
                    isPrimary: false,
                  })}
                  data-testid={`button-action-${action.type}`}
                >
                  <action.icon className="w-5 h-5" />
                  <span className="text-xs">{action.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {side === "offense" && (
            <>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Route Style</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 flex items-center justify-center gap-2"
                    onClick={() => onSelectAction({
                      type: "pass",
                      style: "straight",
                    })}
                    data-testid="button-style-straight"
                  >
                    <Minus className="w-4 h-4" />
                    Straight
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 flex items-center justify-center gap-2"
                    onClick={() => onSelectAction({
                      type: "pass",
                      style: "curved",
                    })}
                    data-testid="button-style-curved"
                  >
                    <Waves className="w-4 h-4" />
                    Curved
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Options</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 flex items-center justify-center gap-2"
                    onClick={() => onSelectAction({
                      type: "pass",
                      style: "straight",
                      isMotion: true,
                    })}
                    data-testid="button-option-motion"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Motion
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 flex items-center justify-center gap-2"
                    onClick={() => onSelectAction({
                      type: "pass",
                      style: "straight",
                      isPrimary: true,
                    })}
                    data-testid="button-option-primary"
                  >
                    <Star className="w-4 h-4" />
                    Primary
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
