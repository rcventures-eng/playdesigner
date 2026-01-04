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
import { FOOTBALL_CONFIG, FORMATIONS, getFormation, resolveColorKey } from "@shared/football-config";
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
}

const LONG_PRESS_DURATION = 500;

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
}: MobileCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeRoutePlayerId, setActiveRoutePlayerId] = useState<string | null>(null);
  const [currentRoutePoints, setCurrentRoutePoints] = useState<{ x: number; y: number }[]>([]);

  const { field, colors } = FOOTBALL_CONFIG;

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const scaleX = containerWidth / field.width;
      const scaleY = containerHeight / field.height;
      const newScale = Math.min(scaleX, scaleY);
      setScale(newScale);
      setOffset({
        x: (containerWidth - field.width * newScale) / 2,
        y: (containerHeight - field.height * newScale) / 2,
      });
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [field.width, field.height]);

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
      const hitRadius = 20;
      for (const player of [...players].reverse()) {
        const dx = player.x - x;
        const dy = player.y - y;
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
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

      if (player) {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        
        longPressTimerRef.current = setTimeout(() => {
          setActiveRoutePlayerId(player.id);
          setCurrentRoutePoints([{ x: player.x, y: player.y }]);
          longPressTimerRef.current = null;
        }, LONG_PRESS_DURATION);

        setDraggedPlayerId(player.id);
      }
    },
    [screenToField, findPlayerAtPoint]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const fieldPos = screenToField(e.clientX, e.clientY);

      if (activeRoutePlayerId && currentRoutePoints.length > 0) {
        const lastPoint = currentRoutePoints[currentRoutePoints.length - 1];
        const dist = Math.hypot(fieldPos.x - lastPoint.x, fieldPos.y - lastPoint.y);
        if (dist > 10) {
          setCurrentRoutePoints((prev) => [...prev, fieldPos]);
        }
        return;
      }

      if (draggedPlayerId && !activeRoutePlayerId) {
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
    ]
  );

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (activeRoutePlayerId && currentRoutePoints.length > 1) {
      const newRoute: DraftRoute = {
        id: `route-${Date.now()}`,
        playerId: activeRoutePlayerId,
        points: currentRoutePoints,
        style: "straight",
        isPrimary: routes.length === 0,
      };
      onRoutesChange([...routes, newRoute]);
    }

    setDraggedPlayerId(null);
    setActiveRoutePlayerId(null);
    setCurrentRoutePoints([]);
  }, [activeRoutePlayerId, currentRoutePoints, routes, onRoutesChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    ctx.fillStyle = "#166534";
    ctx.fillRect(0, 0, field.width, field.height);

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    for (let y = field.headerHeight; y < field.height; y += field.pixelsPerYard * 5) {
      ctx.beginPath();
      ctx.moveTo(field.sidePadding, y);
      ctx.lineTo(field.width - field.sidePadding, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(field.sidePadding, field.losY);
    ctx.lineTo(field.width - field.sidePadding, field.losY);
    ctx.stroke();

    routes.forEach((route) => {
      if (route.points.length < 2) return;
      ctx.strokeStyle = route.isPrimary ? colors.routes.primary : "#9ca3af";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(route.points[0].x, route.points[0].y);
      for (let i = 1; i < route.points.length; i++) {
        ctx.lineTo(route.points[i].x, route.points[i].y);
      }
      ctx.stroke();

      const last = route.points[route.points.length - 1];
      const prev = route.points[route.points.length - 2];
      const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
      const arrowSize = 8;
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
    });

    if (currentRoutePoints.length > 1) {
      ctx.strokeStyle = colors.routes.primary;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(currentRoutePoints[0].x, currentRoutePoints[0].y);
      for (let i = 1; i < currentRoutePoints.length; i++) {
        ctx.lineTo(currentRoutePoints[i].x, currentRoutePoints[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    players.forEach((player) => {
      ctx.beginPath();
      ctx.arc(player.x, player.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = player.color;
      ctx.fill();
      ctx.strokeStyle = player.side === "offense" ? "#000" : "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = player.side === "offense" ? "#fff" : "#000";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(player.label, player.x, player.y);
    });

    ctx.restore();
  }, [players, routes, currentRoutePoints, scale, offset, field, colors]);

  return (
    <div className="flex flex-col h-full" data-testid="mobile-canvas">
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
            <SelectTrigger className="w-[120px] h-8" data-testid="select-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5v5">5v5 Flag</SelectItem>
              <SelectItem value="7v7">7v7 Flag</SelectItem>
              <SelectItem value="9v9">9v9 Flag</SelectItem>
              <SelectItem value="11v11">11v11 Tackle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={onOpenAI}
          className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white h-8"
          data-testid="button-ai-mode"
        >
          <Sparkles className="w-4 h-4 mr-1" />
          AI Mode
        </Button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas
          ref={canvasRef}
          width={containerRef.current?.clientWidth || 800}
          height={containerRef.current?.clientHeight || 400}
          className="absolute inset-0 w-full h-full"
        />
      </div>
    </div>
  );
}
