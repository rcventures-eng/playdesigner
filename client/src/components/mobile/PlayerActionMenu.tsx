import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ArrowRight, Footprints, Shield, Minus, Waves, Zap, Star, MoveHorizontal, Check } from "lucide-react";
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
  const [routeType, setRouteType] = useState<"pass" | "run" | "block" | "blitz" | "man" | "zone" | null>(null);
  const [style, setStyle] = useState<"straight" | "curved">("straight");
  const [isMotion, setIsMotion] = useState(false);
  const [isPrimary, setIsPrimary] = useState(false);

  const handleRouteTypeSelect = useCallback((type: "pass" | "run" | "block" | "blitz" | "man" | "zone") => {
    setRouteType(type);
    
    // For Run, Block, or defensive actions - immediately start drawing
    if (type === "run" || type === "block" || type === "blitz" || type === "man" || type === "zone") {
      onSelectAction({
        type,
        style: "straight",
        isMotion: false,
        isPrimary: false,
      });
      onClose();
    }
    // For Pass, keep menu open for additional options
  }, [onSelectAction, onClose]);

  const handleDrawRoute = useCallback(() => {
    if (routeType === "pass") {
      onSelectAction({
        type: "pass",
        style,
        isMotion,
        isPrimary,
      });
      onClose();
    }
  }, [routeType, style, isMotion, isPrimary, onSelectAction, onClose]);

  const handleOverlayClick = useCallback(() => {
    // If Pass was selected, auto-start drawing with current selections
    if (routeType === "pass") {
      onSelectAction({
        type: "pass",
        style,
        isMotion,
        isPrimary,
      });
    }
    onClose();
  }, [routeType, style, isMotion, isPrimary, onSelectAction, onClose]);

  const handleCloseButton = useCallback(() => {
    // Close button just closes without starting drawing
    onClose();
  }, [onClose]);

  if (!isVisible) return null;

  const offenseActions = [
    { type: "pass" as const, label: "Pass Route", icon: ArrowRight },
    { type: "run" as const, label: "Run Route", icon: Footprints },
    { type: "block" as const, label: "Block", icon: Shield },
  ];

  const defenseActions = [
    { type: "blitz" as const, label: "Blitz", icon: Zap },
    { type: "man" as const, label: "Man Coverage", icon: ArrowRight },
    { type: "zone" as const, label: "Zone", icon: Shield },
  ];

  const actions = side === "offense" ? offenseActions : defenseActions;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center p-4"
      onClick={handleOverlayClick}
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
            onClick={handleCloseButton}
            data-testid="button-close-menu"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Select Action */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Select Action</p>
            <div className="grid grid-cols-3 gap-2">
              {actions.map((action) => (
                <Button
                  key={action.type}
                  variant="outline"
                  className={cn(
                    "flex flex-col h-16 gap-1 transition-colors",
                    routeType === action.type && "bg-orange-500 text-white border-orange-500 hover:bg-orange-600 hover:border-orange-600"
                  )}
                  onClick={() => handleRouteTypeSelect(action.type)}
                  data-testid={`button-action-${action.type}`}
                >
                  <action.icon className="w-5 h-5" />
                  <span className="text-xs">{action.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Route Style - Only visible for Pass routes */}
          {routeType === "pass" && (
            <>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Route Style</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 transition-colors",
                      style === "straight" && "bg-orange-500 text-white border-orange-500 hover:bg-orange-600 hover:border-orange-600"
                    )}
                    onClick={() => setStyle("straight")}
                    data-testid="button-style-straight"
                  >
                    <Minus className="w-4 h-4" />
                    Straight
                  </Button>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 transition-colors",
                      style === "curved" && "bg-orange-500 text-white border-orange-500 hover:bg-orange-600 hover:border-orange-600"
                    )}
                    onClick={() => setStyle("curved")}
                    data-testid="button-style-curved"
                  >
                    <Waves className="w-4 h-4" />
                    Curved
                  </Button>
                </div>
              </div>

              {/* Options */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Options</p>
                <div className="flex gap-3">
                  <label 
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer flex-1 transition-colors",
                      isMotion ? "bg-orange-500/10 border-orange-500" : "border-border bg-background"
                    )}
                    data-testid="checkbox-motion"
                  >
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                      isMotion ? "bg-orange-500 border-orange-500" : "border-muted-foreground"
                    )}>
                      {isMotion && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <input 
                      type="checkbox"
                      className="sr-only"
                      checked={isMotion}
                      onChange={(e) => setIsMotion(e.target.checked)}
                    />
                    <MoveHorizontal className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Motion</span>
                  </label>
                  <label 
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer flex-1 transition-colors",
                      isPrimary ? "bg-orange-500/10 border-orange-500" : "border-border bg-background"
                    )}
                    data-testid="checkbox-primary"
                  >
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                      isPrimary ? "bg-orange-500 border-orange-500" : "border-muted-foreground"
                    )}>
                      {isPrimary && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <input 
                      type="checkbox"
                      className="sr-only"
                      checked={isPrimary}
                      onChange={(e) => setIsPrimary(e.target.checked)}
                    />
                    <Star className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Primary</span>
                  </label>
                </div>
              </div>

              {/* Draw Route CTA */}
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6"
                onClick={handleDrawRoute}
                data-testid="button-draw-route"
              >
                Draw Route
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
