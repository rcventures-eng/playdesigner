import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Shield, Shirt } from "lucide-react";
import { FOOTBALL_CONFIG } from "@shared/football-config";
import { PlayerActionMenu } from "./PlayerActionMenu";
import type { DraftPlayer, DraftRoute } from "@/hooks/usePlayDraft";

interface MobileCanvasProps {
  players: DraftPlayer[];
  routes: DraftRoute[];
  format: string;
  side: "offense" | "defense";
  onPlayersChange: (players: DraftPlayer[]) => void;
  onRoutesChange: (routes: DraftRoute[]) => void;
  onFormatChange: (format: string) => void;
  onSideChange: (side: "offense" | "defense") => void;
  onOpenAI: () => void;
  showControls?: boolean;
}

const LONG_PRESS_DURATION = 500;
const PLAYER_HIT_RADIUS = 24;

export function MobileCanvas({
  players,
  routes,
  format,
  side,
  onPlayersChange,
  onRoutesChange,
  onFormatChange,
  onSideChange,
  onOpenAI,
  showControls = false,
}: MobileCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeRoutePlayerId, setActiveRoutePlayerId] = useState<string | null>(null);
  const [currentRoutePoints, setCurrentRoutePoints] = useState<{ x: number; y: number }[]>([]);
  const [menuPlayer, setMenuPlayer] = useState<{ id: string; label: string; x: number; y: number } | null>(null);
  const [routeStyle, setRouteStyle] = useState<"straight" | "curved">("straight");
  const [isPrimaryRoute, setIsPrimaryRoute] = useState(false);
  const [isMotion, setIsMotion] = useState(false);
  const [activePlayerColor, setActivePlayerColor] = useState<string>("#9ca3af");
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const { field, colors } = FOOTBALL_CONFIG;
  const [isTouchingPlayer, setIsTouchingPlayer] = useState(false);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      
      // Scale to fit width exactly (edge-to-edge), maintain aspect ratio
      const newScale = containerWidth / field.width;
      setScale(newScale);
      
      // Center the view on the line of scrimmage (where players are)
      // field.losY = 284 is where the LOS and players are positioned
      const scaledLosY = field.losY * newScale;
      const offsetY = containerHeight / 2 - scaledLosY;
      
      setOffset({
        x: 0,
        y: offsetY,
      });
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [field.width, field.height, field.losY]);

  const screenToField = useCallback(
    (screenX: number, screenY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: (screenX - rect.left - offset.x) / scale,
        y: (screenY - rect.top - offset.y) / scale,
      };
    },
    [scale, offset]
  );

  const findPlayerAtPoint = useCallback(
    (x: number, y: number): DraftPlayer | null => {
      for (const player of [...players].reverse()) {
        const dx = player.x - x;
        const dy = player.y - y;
        if (dx * dx + dy * dy <= PLAYER_HIT_RADIUS * PLAYER_HIT_RADIUS) {
          return player;
        }
      }
      return null;
    },
    [players]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const fieldPos = screenToField(e.clientX, e.clientY);
      const player = findPlayerAtPoint(fieldPos.x, fieldPos.y);
      pointerStartRef.current = { x: e.clientX, y: e.clientY };

      if (player) {
        // Only capture pointer when touching a player - allows scroll elsewhere
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setIsTouchingPlayer(true);
        
        longPressTimerRef.current = setTimeout(() => {
          setMenuPlayer({
            id: player.id,
            label: player.label,
            x: player.x,
            y: player.y,
          });
          longPressTimerRef.current = null;
        }, LONG_PRESS_DURATION);

        setDraggedPlayerId(player.id);
      } else if (activeRoutePlayerId) {
        // Drawing route - capture events
        e.preventDefault();
        setIsTouchingPlayer(true);
        setCurrentRoutePoints((prev) => [...prev, fieldPos]);
      }
      // If not touching player and not drawing route, allow default scroll behavior
    },
    [screenToField, findPlayerAtPoint, activeRoutePlayerId]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const fieldPos = screenToField(e.clientX, e.clientY);

      if (pointerStartRef.current && longPressTimerRef.current) {
        const dx = e.clientX - pointerStartRef.current.x;
        const dy = e.clientY - pointerStartRef.current.y;
        const moved = Math.sqrt(dx * dx + dy * dy);
        if (moved > 10) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }

      if (activeRoutePlayerId && currentRoutePoints.length > 0) {
        const lastPoint = currentRoutePoints[currentRoutePoints.length - 1];
        const dist = Math.hypot(fieldPos.x - lastPoint.x, fieldPos.y - lastPoint.y);
        if (dist > 10) {
          setCurrentRoutePoints((prev) => [...prev, fieldPos]);
        }
        return;
      }

      if (draggedPlayerId && !activeRoutePlayerId && !menuPlayer) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }

        const clampedX = Math.max(field.sidePadding, Math.min(field.width - field.sidePadding, fieldPos.x));
        const clampedY = Math.max(field.headerHeight, Math.min(field.height - field.bottomPadding, fieldPos.y));

        onPlayersChange(
          players.map((p) =>
            p.id === draggedPlayerId ? { ...p, x: clampedX, y: clampedY } : p
          )
        );
      }
    },
    [
      screenToField,
      draggedPlayerId,
      activeRoutePlayerId,
      currentRoutePoints,
      players,
      onPlayersChange,
      field,
      menuPlayer,
    ]
  );

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (activeRoutePlayerId && currentRoutePoints.length > 1) {
      // Get the player to find their color
      const player = players.find(p => p.id === activeRoutePlayerId);
      const routeColor = player?.color || activePlayerColor;
      
      const newRoute: DraftRoute = {
        id: `route-${Date.now()}`,
        playerId: activeRoutePlayerId,
        points: currentRoutePoints,
        style: routeStyle,
        isPrimary: isPrimaryRoute || routes.length === 0,
        isMotion: isMotion,
        color: routeColor,
      };
      onRoutesChange([...routes, newRoute]);
      setActiveRoutePlayerId(null);
      setCurrentRoutePoints([]);
      setIsPrimaryRoute(false);
      setIsMotion(false);
    }

    setDraggedPlayerId(null);
    setIsTouchingPlayer(false);
    pointerStartRef.current = null;
  }, [activeRoutePlayerId, currentRoutePoints, routes, onRoutesChange, routeStyle, isPrimaryRoute, isMotion, players, activePlayerColor]);

  const handleMenuAction = useCallback((action: {
    type: "pass" | "run" | "block" | "blitz" | "man" | "zone";
    style: "straight" | "curved";
    isMotion?: boolean;
    isPrimary?: boolean;
  }) => {
    if (!menuPlayer) return;

    setRouteStyle(action.style);
    setIsPrimaryRoute(action.isPrimary || false);
    setIsMotion(action.isMotion || false);
    
    if (action.type === "block") {
      setMenuPlayer(null);
      return;
    }

    const player = players.find(p => p.id === menuPlayer.id);
    if (player) {
      setActiveRoutePlayerId(player.id);
      setCurrentRoutePoints([{ x: player.x, y: player.y }]);
      setActivePlayerColor(player.color);
    }
    
    setMenuPlayer(null);
  }, [menuPlayer, players]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const containerWidth = containerRef.current?.clientWidth || 800;
    const containerHeight = containerRef.current?.clientHeight || 400;
    
    canvas.width = containerWidth * dpr;
    canvas.height = containerHeight * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, containerWidth, containerHeight);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    ctx.fillStyle = "#166534";
    ctx.fillRect(0, 0, field.width, field.height);

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    const yardLines = [];
    for (let y = field.headerHeight; y < field.height; y += field.pixelsPerYard * 5) {
      yardLines.push(y);
      ctx.beginPath();
      ctx.moveTo(field.sidePadding, y);
      ctx.lineTo(field.width - field.sidePadding, y);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    const yardNumbers = [10, 20, 30, 40, 50, 40, 30, 20, 10];
    yardLines.forEach((y, i) => {
      if (i < yardNumbers.length) {
        ctx.fillText(String(yardNumbers[i]), field.sidePadding - 20, y);
        ctx.fillText(String(yardNumbers[i]), field.width - field.sidePadding + 20, y);
      }
    });

    const hashX1 = field.width / 2 - 80;
    const hashX2 = field.width / 2 + 80;
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    yardLines.forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(hashX1 - 8, y);
      ctx.lineTo(hashX1 + 8, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hashX2 - 8, y);
      ctx.lineTo(hashX2 + 8, y);
      ctx.stroke();
    });

    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(field.sidePadding, field.losY);
    ctx.lineTo(field.width - field.sidePadding, field.losY);
    ctx.stroke();

    routes.forEach((route) => {
      if (route.points.length < 2) return;
      
      // Use the route's stored color (player color), fallback to gray
      const routeColor = route.color || "#9ca3af";
      ctx.strokeStyle = routeColor;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      // Helper to draw a smooth curve through points
      const drawSmoothCurve = (points: { x: number; y: number }[]) => {
        if (points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        
        if (route.style === "curved" && points.length > 2) {
          // Catmull-Rom style smoothing
          for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            
            // Control points for cubic bezier
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
          }
        } else {
          // Straight style - connect points directly
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
        }
        ctx.stroke();
      };
      
      // Helper to draw arrowhead
      const drawArrow = (last: { x: number; y: number }, prev: { x: number; y: number }) => {
        const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
        const arrowSize = 10;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(
          last.x - arrowSize * Math.cos(angle - Math.PI / 6),
          last.y - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(
          last.x - arrowSize * Math.cos(angle + Math.PI / 6),
          last.y - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      };
      
      // For motion routes, split at line of scrimmage
      if (route.isMotion) {
        const losY = field.losY;
        const belowLOS: { x: number; y: number }[] = [];
        const aboveLOS: { x: number; y: number }[] = [];
        
        for (let i = 0; i < route.points.length; i++) {
          const pt = route.points[i];
          const isAbove = pt.y < losY;
          
          // Check if we're crossing the LOS between this point and the previous
          if (i > 0) {
            const prevPt = route.points[i - 1];
            const prevIsAbove = prevPt.y < losY;
            
            if (isAbove !== prevIsAbove) {
              // Calculate crossing point
              const t = (losY - prevPt.y) / (pt.y - prevPt.y);
              const crossX = prevPt.x + t * (pt.x - prevPt.x);
              const crossPoint = { x: crossX, y: losY };
              
              // Add crossing point to BOTH segments to ensure continuity
              belowLOS.push(crossPoint);
              aboveLOS.push({ ...crossPoint }); // Clone to avoid reference issues
            }
          }
          
          // Add point to appropriate segment
          if (isAbove) {
            aboveLOS.push(pt);
          } else {
            belowLOS.push(pt);
          }
        }
        
        // Draw below LOS with dotted line (pre-snap motion)
        if (belowLOS.length >= 2) {
          ctx.setLineDash([6, 6]);
          drawSmoothCurve(belowLOS);
          ctx.setLineDash([]);
        }
        
        // Draw above LOS with solid line (post-snap)
        if (aboveLOS.length >= 2) {
          ctx.setLineDash([]);
          drawSmoothCurve(aboveLOS);
        }
        
        // Draw arrowhead at the final point of the route
        const last = route.points[route.points.length - 1];
        const prev = route.points[route.points.length - 2];
        ctx.setLineDash([]);
        drawArrow(last, prev);
      } else {
        // Regular route
        drawSmoothCurve(route.points);
        
        // Draw arrowhead at end
        const last = route.points[route.points.length - 1];
        const prev = route.points[route.points.length - 2];
        drawArrow(last, prev);
      }
      
      // Draw primary receiver indicator (filled dot at route end)
      if (route.isPrimary) {
        const last = route.points[route.points.length - 1];
        ctx.beginPath();
        ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = routeColor;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
        // Reset stroke color for next route
        ctx.strokeStyle = routeColor;
      }
    });

    if (currentRoutePoints.length > 1) {
      // Use the active player's color for the preview
      ctx.strokeStyle = activePlayerColor;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(currentRoutePoints[0].x, currentRoutePoints[0].y);
      for (let i = 1; i < currentRoutePoints.length; i++) {
        ctx.lineTo(currentRoutePoints[i].x, currentRoutePoints[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    players.forEach((player) => {
      const isDrawingRoute = activeRoutePlayerId === player.id;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = player.color;
      ctx.fill();
      ctx.strokeStyle = isDrawingRoute ? "#22c55e" : (player.side === "offense" ? "#000" : "#fff");
      ctx.lineWidth = isDrawingRoute ? 4 : 2;
      ctx.stroke();

      ctx.fillStyle = player.side === "offense" ? "#fff" : "#000";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(player.label, player.x, player.y);
    });

    ctx.restore();
  }, [players, routes, currentRoutePoints, scale, offset, field, colors, activeRoutePlayerId, activePlayerColor]);

  return (
    <div className="flex flex-col h-full" data-testid="mobile-canvas">
      {showControls && (
        <div className="flex items-center justify-between gap-2 p-2 bg-card border-b">
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border">
              <button
                onClick={() => onSideChange("offense")}
                className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1 ${
                  side === "offense"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent"
                }`}
                data-testid="button-offense"
              >
                <Shirt className="w-4 h-4" />
                OFF
              </button>
              <button
                onClick={() => onSideChange("defense")}
                className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1 ${
                  side === "defense"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent"
                }`}
                data-testid="button-defense"
              >
                <Shield className="w-4 h-4" />
                DEF
              </button>
            </div>

            <Select value={format} onValueChange={onFormatChange}>
              <SelectTrigger className="w-[100px] h-8" data-testid="select-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5v5">5v5 Flag</SelectItem>
                <SelectItem value="7v7">7v7 Flag</SelectItem>
                <SelectItem value="9v9">9v9 Flag</SelectItem>
                <SelectItem value="11v11">11v11</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={onOpenAI}
            size="sm"
            className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white h-8"
            data-testid="button-ai-mode"
          >
            <Sparkles className="w-4 h-4 mr-1" />
            AI Mode
          </Button>
        </div>
      )}

      <div
        ref={containerRef}
        className={`flex-1 relative ${isTouchingPlayer || activeRoutePlayerId ? 'touch-none' : 'touch-pan-y'}`}
        style={{ backgroundColor: '#166534' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />
        
        {activeRoutePlayerId && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur px-4 py-2 rounded-full text-sm font-medium">
            Tap to add route points, lift to finish
          </div>
        )}
      </div>

      <PlayerActionMenu
        isVisible={!!menuPlayer}
        playerId={menuPlayer?.id || ""}
        playerLabel={menuPlayer?.label || ""}
        position={{ x: menuPlayer?.x || 0, y: menuPlayer?.y || 0 }}
        side={side}
        onClose={() => setMenuPlayer(null)}
        onSelectAction={handleMenuAction}
      />
    </div>
  );
}
