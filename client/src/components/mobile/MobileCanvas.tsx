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
import { useToast } from "@/hooks/use-toast";

interface PlayNote {
  id: string;
  x: number;
  y: number;
  text: string;
  backgroundColor?: string;
}

interface MobileCanvasProps {
  players: DraftPlayer[];
  routes: DraftRoute[];
  playNotes: PlayNote[];
  format: string;
  side: "offense" | "defense";
  notesMode: boolean;
  onPlayersChange: (players: DraftPlayer[]) => void;
  onRoutesChange: (routes: DraftRoute[]) => void;
  onPlayNotesChange: (notes: PlayNote[]) => void;
  onFormatChange: (format: string) => void;
  onSideChange: (side: "offense" | "defense") => void;
  onOpenAI: () => void;
  onPushToUndoStack?: () => void;
  showControls?: boolean;
}

const LONG_PRESS_DURATION = 300;
const PLAYER_HIT_RADIUS = 24;

// Aggressive touch isolation - lock ALL scrolling when interacting with players/routes
function lockAllScroll() {
  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.touchAction = 'none';
}

function unlockAllScroll() {
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
  document.documentElement.style.overflow = '';
  document.documentElement.style.touchAction = '';
}

export function MobileCanvas({
  players,
  routes,
  playNotes,
  format,
  side,
  notesMode,
  onPlayersChange,
  onRoutesChange,
  onPlayNotesChange,
  onFormatChange,
  onSideChange,
  onOpenAI,
  onPushToUndoStack,
  showControls = false,
}: MobileCanvasProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
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
  const [activeRouteType, setActiveRouteType] = useState<"pass" | "run" | "block" | "blitz" | "man" | "zone">("pass");
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastMoveTimeRef = useRef<number>(0);

  const { field, colors } = FOOTBALL_CONFIG;
  const [isTouchingPlayer, setIsTouchingPlayer] = useState(false);

  // Cleanup scroll locks when component unmounts
  useEffect(() => {
    return () => {
      unlockAllScroll();
    };
  }, []);

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

      // Notes mode - tap to add a new note
      if (notesMode && !player) {
        onPushToUndoStack?.();
        const newNote: PlayNote = {
          id: `note-${Date.now()}`,
          x: fieldPos.x - 50, // Center the note on tap
          y: fieldPos.y - 30,
          text: "",
          backgroundColor: "#FFFACD", // Default yellow post-it color
        };
        onPlayNotesChange([...playNotes, newNote]);
        setEditingNoteId(newNote.id);
        setEditingNoteText("");
        return;
      }

      if (player) {
        // AGGRESSIVE touch isolation for iOS
        e.preventDefault();
        e.stopPropagation();
        
        // Capture pointer to this element
        const target = e.target as HTMLElement;
        target.setPointerCapture(e.pointerId);
        
        // Lock ALL scrolling everywhere
        lockAllScroll();
        if (containerRef.current) {
          containerRef.current.style.overflow = 'hidden';
          containerRef.current.style.touchAction = 'none';
        }
        
        // Push current state to undo stack BEFORE making changes
        onPushToUndoStack?.();
        
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
        // Drawing route - AGGRESSIVE touch isolation
        e.preventDefault();
        e.stopPropagation();
        
        // Lock ALL scrolling everywhere
        lockAllScroll();
        if (containerRef.current) {
          containerRef.current.style.overflow = 'hidden';
          containerRef.current.style.touchAction = 'none';
        }
        
        setIsTouchingPlayer(true);
        setCurrentRoutePoints((prev) => [...prev, fieldPos]);
      }
      // If not touching player and not drawing route, allow default scroll behavior
    },
    [screenToField, findPlayerAtPoint, activeRoutePlayerId, onPushToUndoStack, notesMode, playNotes, onPlayNotesChange]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // If we're in an active interaction, prevent default behavior
      if (isTouchingPlayer || draggedPlayerId || activeRoutePlayerId) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      // Throttle move updates to ~60fps for smoother performance
      const now = performance.now();
      if (now - lastMoveTimeRef.current < 16) {
        return; // Skip if less than 16ms since last update
      }
      lastMoveTimeRef.current = now;

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
      isTouchingPlayer,
    ]
  );

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Unlock ALL scroll - restore everything
    unlockAllScroll();
    if (containerRef.current) {
      containerRef.current.style.overflow = '';
      containerRef.current.style.touchAction = '';
    }

    if (activeRoutePlayerId && currentRoutePoints.length > 1) {
      // Get the player to find their color
      const player = players.find(p => p.id === activeRoutePlayerId);
      
      // Determine route color based on type:
      // - Run routes: always black
      // - Block routes: always white
      // - Pass routes: use player color
      let routeColor = player?.color || activePlayerColor;
      if (activeRouteType === "run") {
        routeColor = "#000000"; // Black for run routes
      } else if (activeRouteType === "block") {
        routeColor = "#FFFFFF"; // White for block routes
      }
      
      const newRoute: DraftRoute = {
        id: `route-${Date.now()}`,
        playerId: activeRoutePlayerId,
        points: currentRoutePoints,
        style: routeStyle,
        routeType: activeRouteType,
        isPrimary: isPrimaryRoute || routes.length === 0,
        isMotion: isMotion,
        color: routeColor,
      };
      onRoutesChange([...routes, newRoute]);
      setActiveRoutePlayerId(null);
      setCurrentRoutePoints([]);
      setIsPrimaryRoute(false);
      setIsMotion(false);
      setActiveRouteType("pass"); // Reset to default
    }

    setDraggedPlayerId(null);
    setIsTouchingPlayer(false);
    pointerStartRef.current = null;
  }, [activeRoutePlayerId, currentRoutePoints, routes, onRoutesChange, routeStyle, isPrimaryRoute, isMotion, players, activePlayerColor]);

  // Helper: Find QB position for Blitz targeting
  const getQBPosition = useCallback((): { x: number; y: number } => {
    const qb = players.find(p => p.label === "QB");
    if (qb) return { x: qb.x, y: qb.y };
    // Default QB position (center, behind LOS)
    return { x: field.centerX, y: field.losY + 30 };
  }, [players, field]);

  // Helper: Find nearest offensive player for Man coverage
  const getNearestOffensivePlayer = useCallback((defenderPos: { x: number; y: number }) => {
    const offensivePlayers = players.filter(p => p.side === "offense" || !p.side);
    if (offensivePlayers.length === 0) return null;
    
    // Find players already covered by Man coverage
    const coveredPlayerIds = routes
      .filter(r => r.routeType === "man" && r.targetPlayerId)
      .map(r => r.targetPlayerId);
    
    const uncoveredPlayers = offensivePlayers.filter(p => !coveredPlayerIds.includes(p.id));
    const candidatePlayers = uncoveredPlayers.length > 0 ? uncoveredPlayers : offensivePlayers;
    
    let nearest = candidatePlayers[0];
    let minDist = Infinity;
    for (const p of candidatePlayers) {
      const dist = Math.sqrt(Math.pow(p.x - defenderPos.x, 2) + Math.pow(p.y - defenderPos.y, 2));
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    }
    return nearest;
  }, [players, routes]);

  const handleMenuAction = useCallback((action: {
    type: "pass" | "run" | "block" | "blitz" | "man" | "zone";
    style: "straight" | "curved";
    isMotion?: boolean;
    isPrimary?: boolean;
  }) => {
    if (!menuPlayer) return;

    const player = players.find(p => p.id === menuPlayer.id);
    if (!player) {
      setMenuPlayer(null);
      return;
    }

    // Push current state to undo stack BEFORE any changes
    onPushToUndoStack?.();

    // Blitz: Auto-create route to QB position
    if (action.type === "blitz") {
      const qbPos = getQBPosition();
      const newRoute: DraftRoute = {
        id: `route-${Date.now()}`,
        playerId: player.id,
        points: [{ x: player.x, y: player.y }, qbPos],
        style: "straight",
        routeType: "blitz",
        isPrimary: false,
        isMotion: false,
        color: "#ef4444", // Red for blitz
      };
      onRoutesChange([...routes, newRoute]);
      setMenuPlayer(null);
      return;
    }

    // Man: Auto-create route to nearest offensive player
    if (action.type === "man") {
      const offensivePlayers = players.filter(p => p.side === "offense" || !p.side);
      const oneYardBehindLOS = field.losY + field.pixelsPerYard;
      
      let targetX = player.x;
      let targetY = oneYardBehindLOS;
      let targetPlayerId: string | undefined = undefined;
      
      if (offensivePlayers.length > 0) {
        const targetPlayer = getNearestOffensivePlayer({ x: player.x, y: player.y });
        if (targetPlayer) {
          targetX = targetPlayer.x;
          targetY = targetPlayer.y;
          targetPlayerId = targetPlayer.id;
        }
      }
      
      // Check if target player is already covered by ANOTHER defender (not this one)
      const existingCoverage = routes.filter(
        r => r.routeType === "man" && r.targetPlayerId === targetPlayerId && r.playerId !== player.id
      );
      
      const newRoute: DraftRoute = {
        id: `route-${Date.now()}`,
        playerId: player.id,
        points: [{ x: player.x, y: player.y }, { x: targetX, y: targetY }],
        style: "straight",
        routeType: "man",
        isPrimary: false,
        isMotion: false,
        color: "#888888", // Gray for man coverage
        targetPlayerId: targetPlayerId,
      };
      onRoutesChange([...routes, newRoute]);
      setMenuPlayer(null);
      
      // Show warning if duplicate coverage
      if (existingCoverage.length > 0 && targetPlayerId) {
        const targetPlayerLabel = offensivePlayers.find(p => p.id === targetPlayerId)?.label || "player";
        toast({
          title: "Double Coverage",
          description: `Multiple defenders now cover ${targetPlayerLabel}`,
        });
      }
      return;
    }

    // Zone: Start drawing mode (existing behavior)
    // Pass/Run/Block: Start drawing mode (existing behavior)
    setRouteStyle(action.style);
    setIsPrimaryRoute(action.isPrimary || false);
    setIsMotion(action.isMotion || false);
    setActiveRouteType(action.type);

    // Lock scroll when route drawing mode starts
    lockAllScroll();
    if (containerRef.current) {
      containerRef.current.style.overflow = 'hidden';
      containerRef.current.style.touchAction = 'none';
    }
    
    setActiveRoutePlayerId(player.id);
    setCurrentRoutePoints([{ x: player.x, y: player.y }]);
    setActivePlayerColor(player.color);
    setIsTouchingPlayer(true); // Ensure touch state is set
    
    setMenuPlayer(null);
  }, [menuPlayer, players, routes, onRoutesChange, onPushToUndoStack, getQBPosition, getNearestOffensivePlayer, field, toast]);

  // Dynamic Man coverage sync: Keep Man routes updated when covered players move
  useEffect(() => {
    const manRoutes = routes.filter(r => r.routeType === "man" && r.targetPlayerId);
    if (manRoutes.length === 0) return;

    let hasUpdates = false;
    const updatedRoutes = routes.map(route => {
      if (route.routeType === "man" && route.targetPlayerId) {
        const targetPlayer = players.find(p => p.id === route.targetPlayerId);
        const defender = players.find(p => p.id === route.playerId);
        
        if (targetPlayer && defender && route.points.length >= 2) {
          const currentEndpoint = route.points[route.points.length - 1];
          const currentStart = route.points[0];
          
          const endpointNeedsUpdate = Math.abs(currentEndpoint.x - targetPlayer.x) > 0.5 || 
                                      Math.abs(currentEndpoint.y - targetPlayer.y) > 0.5;
          const startNeedsUpdate = Math.abs(currentStart.x - defender.x) > 0.5 || 
                                   Math.abs(currentStart.y - defender.y) > 0.5;
          
          if (endpointNeedsUpdate || startNeedsUpdate) {
            hasUpdates = true;
            const updatedPoints = [...route.points];
            if (startNeedsUpdate) {
              updatedPoints[0] = { x: defender.x, y: defender.y };
            }
            if (endpointNeedsUpdate) {
              updatedPoints[updatedPoints.length - 1] = { x: targetPlayer.x, y: targetPlayer.y };
            }
            return { ...route, points: updatedPoints };
          }
        }
      }
      return route;
    });
    
    if (hasUpdates) {
      onRoutesChange(updatedRoutes);
    }
  }, [players, routes, onRoutesChange]);

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

    // Field background - gradient from green-600 to green-700 to match desktop
    const gradient = ctx.createLinearGradient(0, 0, 0, field.height);
    gradient.addColorStop(0, "#16a34a"); // green-600
    gradient.addColorStop(1, "#15803d"); // green-700
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, field.width, field.height);

    // 5-yard lines
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    const yardLines: number[] = [];
    for (let y = field.headerHeight; y < field.height; y += field.pixelsPerYard * 5) {
      yardLines.push(y);
      ctx.beginPath();
      ctx.moveTo(field.sidePadding, y);
      ctx.lineTo(field.width - field.sidePadding, y);
      ctx.stroke();
    }

    // 1-yard tick marks on left and right edges
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    for (let y = field.headerHeight; y < field.height; y += field.pixelsPerYard) {
      // Left tick
      ctx.beginPath();
      ctx.moveTo(field.sidePadding, y);
      ctx.lineTo(field.sidePadding + 12, y);
      ctx.stroke();
      // Right tick
      ctx.beginPath();
      ctx.moveTo(field.width - field.sidePadding - 12, y);
      ctx.lineTo(field.width - field.sidePadding, y);
      ctx.stroke();
    }

    // Yard numbers with rotation (matching desktop)
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = "bold 24px 'Arial Narrow', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    const leftX = field.width * 0.15;
    const rightX = field.width * 0.85;
    
    // Show key yard markers: 30, 40, 50 relative to LOS
    const yardMarkers = [
      { label: "30", yOffset: 18 },    // Below LOS
      { label: "40", yOffset: -102 },  // Above LOS  
      { label: "50", yOffset: -222 },  // Further above
    ];
    
    yardMarkers.forEach(({ label, yOffset }) => {
      const y = field.losY + yOffset;
      if (y > 0 && y < field.height) {
        // Left side - rotated -90 degrees
        ctx.save();
        ctx.translate(leftX, y);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(label, 0, 0);
        ctx.restore();
        
        // Right side - rotated +90 degrees
        ctx.save();
        ctx.translate(rightX, y);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    });

    // Hash marks
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
        // Regular route - use dashed line for Man coverage
        if (route.routeType === "man") {
          ctx.setLineDash([6, 4]); // Dashed line for Man coverage
        }
        drawSmoothCurve(route.points);
        ctx.setLineDash([]); // Reset dash pattern
        
        // Draw arrowhead at end
        const last = route.points[route.points.length - 1];
        const prev = route.points[route.points.length - 2];
        drawArrow(last, prev);
      }
      
      // Primary route indicator: white circle with "1" at endpoint (same as desktop)
      if (route.isPrimary) {
        const endpoint = route.points[route.points.length - 1];
        
        // White circle with dark border
        ctx.beginPath();
        ctx.arc(endpoint.x, endpoint.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // "1" text inside
        ctx.fillStyle = 'black';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('1', endpoint.x, endpoint.y);
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
      const isDragging = draggedPlayerId === player.id && !menuPlayer;
      
      // Visual feedback: larger radius and shadow when dragging
      const baseRadius = 16;
      const radius = isDragging ? baseRadius + 4 : baseRadius;
      
      // Draw shadow when dragging
      if (isDragging) {
        ctx.beginPath();
        ctx.arc(player.x + 2, player.y + 2, radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fill();
      }
      
      ctx.beginPath();
      ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = player.color;
      ctx.fill();
      
      // Different border when dragging vs drawing route
      if (isDragging) {
        ctx.strokeStyle = "#fbbf24"; // Yellow/amber when dragging
        ctx.lineWidth = 4;
      } else if (isDrawingRoute) {
        ctx.strokeStyle = "#22c55e"; // Green when drawing route
        ctx.lineWidth = 4;
      } else {
        ctx.strokeStyle = player.side === "offense" ? "#000" : "#fff";
        ctx.lineWidth = 2;
      }
      ctx.stroke();

      ctx.fillStyle = player.side === "offense" ? "#fff" : "#000";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(player.label, player.x, player.y);
    });

    // Render play notes (post-it style)
    playNotes.forEach((note) => {
      const noteWidth = 100;
      const noteHeight = 60;
      
      // Use note's background color or default yellow
      const bgColor = note.backgroundColor || "#FFFACD";
      ctx.fillStyle = bgColor;
      ctx.fillRect(note.x, note.y, noteWidth, noteHeight);
      
      // Border - derive from background color
      ctx.strokeStyle = "#E6DB74";
      ctx.lineWidth = 1;
      ctx.strokeRect(note.x, note.y, noteWidth, noteHeight);
      
      // Note text
      ctx.fillStyle = "#333";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      
      // Word wrap the text
      const maxWidth = noteWidth - 8;
      const words = (note.text || "Tap to edit...").split(' ');
      let line = '';
      let y = note.y + 4;
      const lineHeight = 14;
      
      words.forEach((word) => {
        const testLine = line + (line ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line) {
          ctx.fillText(line, note.x + 4, y);
          line = word;
          y += lineHeight;
        } else {
          line = testLine;
        }
      });
      ctx.fillText(line, note.x + 4, y);
    });

    ctx.restore();
  }, [players, routes, playNotes, currentRoutePoints, scale, offset, field, colors, activeRoutePlayerId, activePlayerColor, draggedPlayerId, menuPlayer]);

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
        
        {/* Drag indicator */}
        {draggedPlayerId && !menuPlayer && !activeRoutePlayerId && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500/90 text-black backdrop-blur px-4 py-2 rounded-full text-sm font-medium shadow-lg">
            Dragging player...
          </div>
        )}
        
        {/* Route drawing indicator */}
        {activeRoutePlayerId && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-green-500/90 text-black backdrop-blur px-4 py-2 rounded-full text-sm font-medium shadow-lg">
            Drawing route... lift finger to finish
          </div>
        )}
        
        {/* Notes mode indicator */}
        {notesMode && !editingNoteId && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-400/90 text-black backdrop-blur px-4 py-2 rounded-full text-sm font-medium shadow-lg">
            Tap anywhere to add a note
          </div>
        )}
        
        {/* Note editing overlays */}
        {playNotes.map((note) => {
          const isEditing = editingNoteId === note.id;
          const noteWidth = 100;
          const noteHeight = 60;
          const noteX = offset.x + note.x * scale;
          const noteY = offset.y + note.y * scale;
          
          return (
            <div
              key={note.id}
              className={`absolute ${isEditing ? 'z-20' : 'z-10'}`}
              style={{
                left: noteX,
                top: noteY,
                width: noteWidth * scale,
                height: noteHeight * scale,
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!isEditing) {
                  setEditingNoteId(note.id);
                  setEditingNoteText(note.text);
                }
              }}
              data-testid={`note-overlay-${note.id}`}
            >
              {isEditing && (
                <div 
                  className="absolute inset-0 border-2 border-orange-400 rounded shadow-lg"
                  style={{ 
                    transform: `scale(${1/scale})`,
                    transformOrigin: 'top left',
                    width: 120,
                    height: 80,
                    backgroundColor: note.backgroundColor || '#FFFACD',
                  }}
                >
                  <textarea
                    autoFocus
                    value={editingNoteText}
                    onChange={(e) => setEditingNoteText(e.target.value)}
                    onBlur={() => {
                      onPlayNotesChange(
                        playNotes.map((n) =>
                          n.id === note.id ? { ...n, text: editingNoteText } : n
                        )
                      );
                      setEditingNoteId(null);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Escape') {
                        setEditingNoteId(null);
                      }
                    }}
                    className="w-full h-full p-2 bg-transparent border-none outline-none resize-none text-sm text-gray-800"
                    placeholder="Add note text..."
                    data-testid={`note-input-${note.id}`}
                  />
                </div>
              )}
            </div>
          );
        })}
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
