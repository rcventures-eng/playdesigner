import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Copy, Plus, Trash2, Circle as CircleIcon, MoveHorizontal, PenTool, Square as SquareIcon, Type, Hexagon, RotateCcw, Flag } from "lucide-react";
import { toPng } from "html-to-image";
import { useToast } from "@/hooks/use-toast";
import underConstructionImage from "@assets/generated_images/under_construction_warning_banner.png";

const FIELD = {
  WIDTH: 694,
  HEIGHT: 392,
  HEADER_HEIGHT: 60,
  SIDE_PADDING: 27,
  BOTTOM_PADDING: 12,
  PIXELS_PER_YARD: 12,
  get FIELD_TOP() { return this.HEADER_HEIGHT; },
  get FIELD_LEFT() { return this.SIDE_PADDING; },
  get FIELD_RIGHT() { return this.WIDTH - this.SIDE_PADDING; },
  get FIELD_WIDTH() { return this.WIDTH - this.SIDE_PADDING * 2; },
  get FIELD_HEIGHT() { return this.HEIGHT - this.HEADER_HEIGHT; },
  get LOS_Y() { return this.HEIGHT - this.BOTTOM_PADDING - 8 * this.PIXELS_PER_YARD; },
  get PLAYER_BOUNDS() {
    return {
      minX: this.FIELD_LEFT + 12,
      maxX: this.FIELD_RIGHT - 12,
      minY: this.FIELD_TOP + 12,
      maxY: this.HEIGHT - this.BOTTOM_PADDING - 12,
    };
  },
  get LEFT_HASH_X() { return this.FIELD_LEFT + 160; },
  get RIGHT_HASH_X() { return this.FIELD_RIGHT - 160; },
};

interface Player {
  id: string;
  x: number;
  y: number;
  color: string;
  label?: string;
}

interface Route {
  id: string;
  playerId: string;
  points: { x: number; y: number }[];
  type: "pass" | "run" | "blocking";
  style: "straight" | "curved";
  priority?: number;
  isMotion?: boolean;
  color?: string;
}

interface Shape {
  id: string;
  type: "circle" | "oval" | "square" | "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface PlayMetadata {
  name: string;
  formation: string;
  concept: string;
  personnel: string;
}

interface Football {
  id: string;
  x: number;
  y: number;
}

interface HistoryState {
  players: Player[];
  routes: Route[];
  shapes: Shape[];
  footballs: Football[];
  metadata: { name: string; formation: string; concept: string; personnel: string };
}

export default function PlayDesigner() {
  const [playType, setPlayType] = useState<"offense" | "defense" | "special">("offense");
  const [players, setPlayers] = useState<Player[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [footballs, setFootballs] = useState<Football[]>([]);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedShape, setSelectedShape] = useState<string | null>(null);
  const [selectedFootball, setSelectedFootball] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [tool, setTool] = useState<"select" | "player" | "route" | "shape" | "label">("select");
  const [shapeType, setShapeType] = useState<"circle" | "oval" | "square" | "rectangle">("circle");
  const [shapeColor, setShapeColor] = useState("#ec4899");
  const [routeType, setRouteType] = useState<"pass" | "run" | "blocking">("pass");
  const [makePrimary, setMakePrimary] = useState(false);
  const [routeStyle, setRouteStyle] = useState<"straight" | "curved">("straight");
  const [isMotion, setIsMotion] = useState(false);
  const [isPlayAction, setIsPlayAction] = useState(false);
  const [showBlocking, setShowBlocking] = useState(true);
  const [metadata, setMetadata] = useState<PlayMetadata>({
    name: "",
    formation: "",
    concept: "",
    personnel: "",
  });
  const [exportWidth, setExportWidth] = useState(String(FIELD.WIDTH));
  const [exportHeight, setExportHeight] = useState(String(FIELD.HEIGHT));
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDrawingRoute, setIsDrawingRoute] = useState(false);
  const [currentRoutePoints, setCurrentRoutePoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawingShape, setIsDrawingShape] = useState(false);
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [draggingRoutePoint, setDraggingRoutePoint] = useState<{ routeId: string; pointIndex: number } | null>(null);
  const [lassoStart, setLassoStart] = useState<{ x: number; y: number } | null>(null);
  const [lassoEnd, setLassoEnd] = useState<{ x: number; y: number } | null>(null);
  const [selectedElements, setSelectedElements] = useState<{ players: string[]; routes: string[] }>({ players: [], routes: [] });
  const [isDraggingStraightRoute, setIsDraggingStraightRoute] = useState(false);
  
  // Long-press menu state (optimized - minimal state, CSS handles hover visuals)
  const [longPressMenuOpen, setLongPressMenuOpen] = useState(false);
  const [longPressMenuPosition, setLongPressMenuPosition] = useState({ x: 0, y: 0 });
  const [longPressPlayerId, setLongPressPlayerId] = useState<string | null>(null);
  const [longPressPlayerRef, setLongPressPlayerRef] = useState<string | null>(null);
  const [isLongPressHolding, setIsLongPressHolding] = useState(false);
  // Hover state controls column VISIBILITY (not styling - that's CSS)
  const [hoveredRouteType, setHoveredRouteType] = useState<"pass" | "run" | "blocking" | null>(null);
  const [hoveredRouteStyle, setHoveredRouteStyle] = useState<"straight" | "curved" | null>(null);
  // Only checkbox state remains in React (user clicks)
  const [menuMotion, setMenuMotion] = useState(false);
  const [menuMakePrimary, setMenuMakePrimary] = useState(false);
  const [menuConfirming, setMenuConfirming] = useState(false);
  // Pending route selection - stored when user selects Style, cleared when they click player to confirm
  const [pendingRouteSelection, setPendingRouteSelection] = useState<{
    playerId: string;
    type: "pass" | "run" | "blocking";
    style: "straight" | "curved";
    motion: boolean;
    primary: boolean;
  } | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const currentRoutePointsRef = useRef<{ x: number; y: number }[]>([]);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressStartPos = useRef<{ x: number; y: number } | null>(null);
  // Pending drag intent - drag only starts after long-press is cancelled
  const pendingDragRef = useRef<{ playerId: string; offset: { x: number; y: number } } | null>(null);
  const { toast } = useToast();

  const offenseColors = ["#39ff14", "#1d4ed8", "#ef4444", "#eab308", "#000000", "#f97316", "#6b7280"];
  const defenseColors = ["#92400e", "#db2777", "#9333ea"];
  const shapeColors = ["#ec4899", "#1d4ed8", "#86efac"];
  const colors = playType === "offense" ? offenseColors : defenseColors;
  
  const conceptLabels: Record<string, string> = {
    "outside-run": "Outside Run",
    "inside-run": "Inside Run",
    "short-pass": "Short Pass",
    "medium-pass": "Medium Pass",
    "deep-pass": "Deep Pass",
    "play-action-pass": "Play Action Pass",
    "rpo": "RPO",
    "screen-pass": "Screen Pass",
    "trick": "Trick",
  };
  
  // Player positioning constants (used for spacing calculations)
  const centerX = FIELD.WIDTH / 2;
  const PLAYER_SIZE = 24;  // Players are 24px (w-6 h-6)
  const GAP_SIZE = 6;      // Small gap between adjacent players
  const SPACING_UNIT = PLAYER_SIZE + GAP_SIZE;  // 30px spacing unit for formations
  const FILL_ORDER = [0, -1, 1, -2, 2];  // Center, left, right, further left, further right

  // Preset positions for offensive players based on standard formation
  // Uses FIELD config and spacing constants for positioning relative to LOS
  const offensePositions: Record<string, { x: number; y: number }> = {
    "#39ff14": { x: centerX, y: FIELD.LOS_Y + 6 * FIELD.PIXELS_PER_YARD },  // Green - Running back (center, 6 yards back)
    "#1d4ed8": { x: FIELD.FIELD_LEFT + 50, y: FIELD.LOS_Y },   // Blue (Z) - Split end (far left on line)
    "#ef4444": { x: FIELD.FIELD_RIGHT - 50, y: FIELD.LOS_Y },  // Red (X) - Right receiver (far right on line)
    "#eab308": { x: centerX - (3 * (PLAYER_SIZE + GAP_SIZE)), y: FIELD.LOS_Y },  // Yellow (Y) - Slot -3 (left of LT)
    "#000000": { x: centerX, y: FIELD.LOS_Y + PLAYER_SIZE + 5 },  // Black (QB) - Behind Center with 5px gap
    "#f97316": { x: centerX + (3 * (PLAYER_SIZE + GAP_SIZE)), y: FIELD.LOS_Y },  // Orange (TE) - Slot +3 (right of RT)
    "#6b7280": { x: centerX, y: FIELD.LOS_Y },  // Gray - default (will be overridden by sequence)
  };
  
  // Generate gray positions using the center-out formula
  // x = centerX + (offset * (PLAYER_SIZE + GAP_SIZE))
  const grayPositions = FILL_ORDER.map(offset => ({
    x: centerX + (offset * (PLAYER_SIZE + GAP_SIZE)),
    y: FIELD.LOS_Y
  }));

  // Auto-labels for each color when players are added
  const colorLabels: Record<string, string> = {
    "#000000": "QB",   // Black - Quarterback
    "#39ff14": "RB",   // Green - Running back
    "#1d4ed8": "Z",    // Blue - Z receiver (split end)
    "#eab308": "Y",    // Yellow - Y receiver (slot/tight)
    "#ef4444": "X",    // Red - X receiver (flanker)
    "#f97316": "TE",   // Orange - Tight end
  };

  // Sequential labels for gray offensive linemen (C, LG, RG, LT, RT, then OL for extras)
  const grayLabels = ["C", "LG", "RG", "LT", "RT"];
  
  const formationLabels: Record<string, string> = {
    "man-to-man": "Man-to-Man",
    "zone": "Zone",
    "blitz": "Blitz",
    "field-goal": "Field Goal",
    "punt": "Punt",
    "kickoff": "Kickoff",
    "punt-return": "Punt Return",
    "kickoff-return": "Kickoff Return",
  };
  
  const getFormattedLabel = (value: string, labels: Record<string, string>) => {
    return labels[value] || value;
  };

  useEffect(() => {
    setIsDrawingRoute(false);
    setCurrentRoutePoints([]);
    currentRoutePointsRef.current = [];
    setIsDraggingStraightRoute(false);
    setLassoStart(null);
    setLassoEnd(null);
    setIsDrawingShape(false);
    setShapeStart(null);
    setSelectedPlayer(null);
    setSelectedRoute(null);
    setSelectedShape(null);
    setSelectedFootball(null);
    setSelectedElements({ players: [], routes: [] });
    setIsDragging(false);
    setDraggingRoutePoint(null);
  }, [tool]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editingPlayer) return;
        
        const hasSelection = selectedElements.players.length > 0 || selectedElements.routes.length > 0 ||
          selectedPlayer || selectedRoute || selectedShape || selectedFootball;
        
        if (hasSelection) {
          setHistory(prev => [...prev, {
            players: JSON.parse(JSON.stringify(players)),
            routes: JSON.parse(JSON.stringify(routes)),
            shapes: JSON.parse(JSON.stringify(shapes)),
            footballs: JSON.parse(JSON.stringify(footballs)),
            metadata: JSON.parse(JSON.stringify(metadata))
          }]);
        }
        
        if (selectedElements.players.length > 0 || selectedElements.routes.length > 0) {
          setPlayers(prev => prev.filter(p => !selectedElements.players.includes(p.id)));
          setRoutes(prev => prev.filter(r => 
            !selectedElements.routes.includes(r.id) && 
            !selectedElements.players.includes(r.playerId)
          ));
          setSelectedElements({ players: [], routes: [] });
          return;
        }
        
        if (selectedPlayer) {
          setPlayers(prev => prev.filter(p => p.id !== selectedPlayer));
          setRoutes(prev => prev.filter(r => r.playerId !== selectedPlayer));
          setSelectedPlayer(null);
        }
        if (selectedRoute) {
          setRoutes(prev => prev.filter(r => r.id !== selectedRoute));
          setSelectedRoute(null);
        }
        if (selectedShape) {
          setShapes(prev => prev.filter(s => s.id !== selectedShape));
          setSelectedShape(null);
        }
        if (selectedFootball) {
          setFootballs(prev => prev.filter(f => f.id !== selectedFootball));
          setSelectedFootball(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPlayer, selectedRoute, selectedShape, selectedFootball, editingPlayer, selectedElements, players, routes, shapes, footballs, metadata]);

  // Handle click-outside to close long-press menu and cancel long-press on window mouseup
  useEffect(() => {
    const handleWindowMouseUp = () => {
      cancelLongPress();
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close during confirmation dwell
      if (menuConfirming) return;
      
      const target = e.target as HTMLElement;
      if (longPressMenuOpen && !target.closest('[data-testid="long-press-menu"]')) {
        closeLongPressMenu();
      }
    };
    
    window.addEventListener("mouseup", handleWindowMouseUp);
    document.addEventListener("click", handleClickOutside);
    
    return () => {
      window.removeEventListener("mouseup", handleWindowMouseUp);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [longPressMenuOpen, menuConfirming]);

  // Dynamic QB positioning based on Formation field (Shotgun/Pistol = deeper, otherwise under center)
  useEffect(() => {
    const formation = metadata.formation.toLowerCase();
    const isShotgunOrPistol = formation.includes("shotgun") || formation.includes("pistol");
    
    // Find QB player
    const qbIndex = players.findIndex(p => p.label === "QB");
    if (qbIndex === -1) return;
    
    const qb = players[qbIndex];
    const underCenterY = FIELD.LOS_Y + PLAYER_SIZE + 4;
    const shotgunY = FIELD.LOS_Y + 40;
    const targetY = isShotgunOrPistol ? shotgunY : underCenterY;
    
    // Only update if position actually needs to change
    if (Math.abs(qb.y - targetY) > 1) {
      setPlayers(prev => prev.map((p, i) => 
        i === qbIndex ? { ...p, y: targetY } : p
      ));
    }
  }, [metadata.formation]);

  const addPlayer = (color: string) => {
    saveToHistory();
    
    let position: { x: number; y: number };
    let label: string | undefined;
    
    // For gray players on offense, use sequential positions and labels based on how many exist
    if (playType === "offense" && color === "#6b7280") {
      const existingGrayCount = players.filter(p => p.color === "#6b7280").length;
      const positionIndex = existingGrayCount % grayPositions.length;
      position = grayPositions[positionIndex];
      // Assign sequential label: C, LG, RG, LT, RT, then OL for any extras
      label = existingGrayCount < grayLabels.length ? grayLabels[existingGrayCount] : "OL";
    } else {
      // Use preset position for other offense players, default to center for defense
      position = playType === "offense" && offensePositions[color] 
        ? offensePositions[color] 
        : { x: FIELD.WIDTH / 2, y: FIELD.LOS_Y };
      // Assign color-based label for offense (no auto-labels for defense)
      if (playType === "offense" && colorLabels[color]) {
        label = colorLabels[color];
      }
    }
    
    const newPlayer: Player = {
      id: `player-${Date.now()}`,
      x: position.x,
      y: position.y,
      color,
      label,
    };
    setPlayers([...players, newPlayer]);
    
    // Switch to select mode so user can immediately reposition if needed
    setTool("select");
  };

  const addFootball = () => {
    saveToHistory();
    const newFootball: Football = {
      id: `football-${Date.now()}`,
      x: FIELD.WIDTH / 2,
      y: FIELD.LOS_Y
    };
    setFootballs([...footballs, newFootball]);
    setTool("select");
  };

  const saveToHistory = () => {
    setHistory(prev => [...prev, {
      players: JSON.parse(JSON.stringify(players)),
      routes: JSON.parse(JSON.stringify(routes)),
      shapes: JSON.parse(JSON.stringify(shapes)),
      footballs: JSON.parse(JSON.stringify(footballs)),
      metadata: JSON.parse(JSON.stringify(metadata))
    }]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setPlayers(previousState.players);
    setRoutes(previousState.routes);
    setShapes(previousState.shapes);
    setFootballs(previousState.footballs);
    setMetadata(previousState.metadata);
    setHistory(prev => prev.slice(0, -1));
    setSelectedPlayer(null);
    setSelectedRoute(null);
    setSelectedShape(null);
    setSelectedFootball(null);
    setSelectedElements({ players: [], routes: [] });
  };

  const clearAll = () => {
    // Save to history so user can undo the clear action
    if (players.length > 0 || routes.length > 0 || shapes.length > 0 || footballs.length > 0) {
      saveToHistory();
    }
    setPlayers([]);
    setRoutes([]);
    setShapes([]);
    setFootballs([]);
    setMetadata({ name: "", formation: "", concept: "", personnel: "" });
    setSelectedPlayer(null);
    setSelectedRoute(null);
    setSelectedShape(null);
    setSelectedFootball(null);
    setSelectedElements({ players: [], routes: [] });
  };

  const generate5v5Formation = (): Player[] => {
    return [
      { id: `player-${Date.now()}-1`, x: centerX, y: FIELD.LOS_Y + PLAYER_SIZE + 4, color: "#000000", label: "QB" },
      { id: `player-${Date.now()}-2`, x: centerX, y: FIELD.LOS_Y + 75, color: "#39ff14", label: "RB" },
      { id: `player-${Date.now()}-3`, x: centerX - (2 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#eab308", label: "Y" },
      { id: `player-${Date.now()}-4`, x: centerX - (6 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#1d4ed8", label: "Z" },
      { id: `player-${Date.now()}-5`, x: centerX + (6 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#ef4444", label: "X" },
    ];
  };

  const handleLoad5v5 = () => {
    if (players.length > 0 || routes.length > 0 || shapes.length > 0 || footballs.length > 0) {
      saveToHistory();
    }
    setPlayers(generate5v5Formation());
    setRoutes([]);
    setShapes([]);
    setFootballs([]);
    setMetadata({ name: "", formation: "", concept: "", personnel: "" });
    setSelectedPlayer(null);
    setSelectedRoute(null);
    setSelectedShape(null);
    setSelectedFootball(null);
    setSelectedElements({ players: [], routes: [] });
    setTool("select");
  };

  const generate7v7Formation = (): Player[] => {
    return [
      { id: `player-${Date.now()}-1`, x: centerX, y: FIELD.LOS_Y, color: "#6b7280", label: "C" },
      { id: `player-${Date.now()}-2`, x: centerX, y: FIELD.LOS_Y + PLAYER_SIZE + 4, color: "#000000", label: "QB" },
      { id: `player-${Date.now()}-3`, x: centerX, y: FIELD.LOS_Y + 75, color: "#39ff14", label: "RB" },
      { id: `player-${Date.now()}-4`, x: centerX - (2.5 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#eab308", label: "Y" },
      { id: `player-${Date.now()}-5`, x: centerX + (2.5 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#f97316", label: "TE" },
      { id: `player-${Date.now()}-6`, x: centerX - (6.5 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#1d4ed8", label: "Z" },
      { id: `player-${Date.now()}-7`, x: centerX + (6.5 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#ef4444", label: "X" },
    ];
  };

  const handleLoad7v7 = () => {
    if (players.length > 0 || routes.length > 0 || shapes.length > 0 || footballs.length > 0) {
      saveToHistory();
    }
    setPlayers(generate7v7Formation());
    setRoutes([]);
    setShapes([]);
    setFootballs([]);
    setMetadata({ name: "", formation: "", concept: "", personnel: "" });
    setSelectedPlayer(null);
    setSelectedRoute(null);
    setSelectedShape(null);
    setSelectedFootball(null);
    setSelectedElements({ players: [], routes: [] });
    setTool("select");
  };

  const generate9v9Formation = (): Player[] => {
    return [
      // Interior Line (3 Gray Squares) - slots 0, -1, +1 (NO tackles at ±2)
      { id: `player-${Date.now()}-1`, x: centerX, y: FIELD.LOS_Y, color: "#6b7280", label: "C" },
      { id: `player-${Date.now()}-2`, x: centerX - (1 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#6b7280", label: "LG" },
      { id: `player-${Date.now()}-3`, x: centerX + (1 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#6b7280", label: "RG" },
      // Ends (Circles) - slots -3, +3 (preserving gap where tackles would be)
      { id: `player-${Date.now()}-4`, x: centerX - (3 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#eab308", label: "Y" },
      { id: `player-${Date.now()}-5`, x: centerX + (3 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#f97316", label: "TE" },
      // Wideouts (Circles) - slots -7, +7
      { id: `player-${Date.now()}-6`, x: centerX - (7 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#1d4ed8", label: "Z" },
      { id: `player-${Date.now()}-7`, x: centerX + (7 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#ef4444", label: "X" },
      // Backfield (Circles) - stacked center
      { id: `player-${Date.now()}-8`, x: centerX, y: FIELD.LOS_Y + PLAYER_SIZE + 4, color: "#000000", label: "QB" },
      { id: `player-${Date.now()}-9`, x: centerX, y: FIELD.LOS_Y + 75, color: "#39ff14", label: "RB" },
    ];
  };

  const handleLoad9v9 = () => {
    if (players.length > 0 || routes.length > 0 || shapes.length > 0 || footballs.length > 0) {
      saveToHistory();
    }
    setPlayers(generate9v9Formation());
    setRoutes([]);
    setShapes([]);
    setFootballs([]);
    setMetadata({ name: "", formation: "", concept: "", personnel: "" });
    setSelectedPlayer(null);
    setSelectedRoute(null);
    setSelectedShape(null);
    setSelectedFootball(null);
    setSelectedElements({ players: [], routes: [] });
    setTool("select");
  };

  const generate11v11Formation = (): Player[] => {
    return [
      // Offensive Line (5 Gray Squares) - slots 0, -1, +1, -2, +2
      { id: `player-${Date.now()}-1`, x: centerX, y: FIELD.LOS_Y, color: "#6b7280", label: "C" },
      { id: `player-${Date.now()}-2`, x: centerX - (1 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#6b7280", label: "LG" },
      { id: `player-${Date.now()}-3`, x: centerX + (1 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#6b7280", label: "RG" },
      { id: `player-${Date.now()}-4`, x: centerX - (2 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#6b7280", label: "LT" },
      { id: `player-${Date.now()}-5`, x: centerX + (2 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#6b7280", label: "RT" },
      // Tight Ends / Slots (Circles) - slots -3, +3
      { id: `player-${Date.now()}-6`, x: centerX - (3 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#eab308", label: "Y" },
      { id: `player-${Date.now()}-7`, x: centerX + (3 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#f97316", label: "TE" },
      // Wideouts (Circles) - slots -7, +7
      { id: `player-${Date.now()}-8`, x: centerX - (7 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#1d4ed8", label: "Z" },
      { id: `player-${Date.now()}-9`, x: centerX + (7 * SPACING_UNIT), y: FIELD.LOS_Y, color: "#ef4444", label: "X" },
      // Backfield (Circles) - stacked center
      { id: `player-${Date.now()}-10`, x: centerX, y: FIELD.LOS_Y + PLAYER_SIZE + 4, color: "#000000", label: "QB" },
      { id: `player-${Date.now()}-11`, x: centerX, y: FIELD.LOS_Y + 75, color: "#39ff14", label: "RB" },
    ];
  };

  const handleLoad11v11 = () => {
    if (players.length > 0 || routes.length > 0 || shapes.length > 0 || footballs.length > 0) {
      saveToHistory();
    }
    setPlayers(generate11v11Formation());
    setRoutes([]);
    setShapes([]);
    setFootballs([]);
    setMetadata({ name: "", formation: "", concept: "", personnel: "" });
    setSelectedPlayer(null);
    setSelectedRoute(null);
    setSelectedShape(null);
    setSelectedFootball(null);
    setSelectedElements({ players: [], routes: [] });
    setTool("select");
  };

  const deleteSelected = () => {
    const hasSelection = selectedFootball || selectedPlayer || selectedRoute || selectedShape;
    if (hasSelection) saveToHistory();
    
    if (selectedFootball) {
      setFootballs(footballs.filter(f => f.id !== selectedFootball));
      setSelectedFootball(null);
    }
    if (selectedPlayer) {
      setPlayers(players.filter(p => p.id !== selectedPlayer));
      setRoutes(routes.filter(r => r.playerId !== selectedPlayer));
      setSelectedPlayer(null);
    }
    if (selectedRoute) {
      setRoutes(routes.filter(r => r.id !== selectedRoute));
      setSelectedRoute(null);
    }
    if (selectedShape) {
      setShapes(shapes.filter(s => s.id !== selectedShape));
      setSelectedShape(null);
    }
  };

  const calculateAngleDifference = (p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}) => {
    const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    
    const angle1 = Math.atan2(v1.y, v1.x);
    const angle2 = Math.atan2(v2.y, v2.x);
    
    let diff = Math.abs(angle2 - angle1);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    
    return diff * (180 / Math.PI);
  };

  const simplifyPoints = (points: {x: number, y: number}[], tolerance: number = 3): {x: number, y: number}[] => {
    if (points.length <= 2) return points;
    
    const result: {x: number, y: number}[] = [points[0]];
    
    for (let i = 1; i < points.length - 1; i++) {
      const dist = Math.sqrt(
        Math.pow(points[i].x - result[result.length - 1].x, 2) + 
        Math.pow(points[i].y - result[result.length - 1].y, 2)
      );
      
      if (dist > tolerance) {
        result.push(points[i]);
      }
    }
    
    result.push(points[points.length - 1]);
    return result;
  };

  const handlePlayerPointerDown = (e: React.PointerEvent, playerId: string) => {
    // Check if there's a pending route selection waiting for confirmation
    if (pendingRouteSelection && pendingRouteSelection.playerId === playerId) {
      e.stopPropagation();
      const player = players.find(p => p.id === playerId);
      if (player) {
        // Start the route with the stored selection
        setRouteType(pendingRouteSelection.type);
        setRouteStyle(pendingRouteSelection.style);
        setIsMotion(pendingRouteSelection.motion);
        setMakePrimary(pendingRouteSelection.primary);
        
        setTool("route");
        setIsDrawingRoute(true);
        setIsDraggingStraightRoute(true);
        setSelectedPlayer(playerId);
        setSelectedElements({ players: [], routes: [] });
        
        const initialPoint = { x: player.x, y: player.y };
        setCurrentRoutePoints([initialPoint]);
        currentRoutePointsRef.current = [initialPoint];
        
        // Clear the pending selection
        setPendingRouteSelection(null);
      }
      return;
    }
    
    if (tool === "select") {
      e.stopPropagation();
      const player = players.find(p => p.id === playerId);
      if (player) {
        saveToHistory();
        setSelectedPlayer(playerId);
        setSelectedRoute(null);
        setSelectedShape(null);
        setSelectedElements({ players: [], routes: [] });
        
        // DON'T start dragging immediately - store intent and wait
        // Drag only starts if long-press is cancelled (movement detected)
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          pendingDragRef.current = {
            playerId,
            offset: {
              x: e.clientX - rect.left - player.x,
              y: e.clientY - rect.top - player.y,
            }
          };
        }
        
        // Start long-press with IMMEDIATE visual feedback (80ms ring appears)
        setLongPressPlayerRef(playerId);
        longPressStartPos.current = { x: e.clientX, y: e.clientY };
        // Show holding state immediately for instant feedback
        requestAnimationFrame(() => setIsLongPressHolding(true));
        
        longPressTimerRef.current = setTimeout(() => {
          // Long press detected - open menu anchored under player center
          setIsLongPressHolding(false);
          setLongPressPlayerId(playerId);
          pendingDragRef.current = null; // Clear drag intent - menu wins
          
          // Calculate menu position with max width clamping
          const rect = canvasRef.current?.getBoundingClientRect();
          const maxMenuWidth = 380; // Max expanded width
          if (rect) {
            const menuX = rect.left + player.x;
            const menuY = rect.top + player.y + 16;
            const clampedX = Math.max(8, Math.min(menuX, window.innerWidth - maxMenuWidth - 10));
            setLongPressMenuPosition({ x: clampedX, y: menuY });
          } else {
            setLongPressMenuPosition({ x: e.clientX, y: e.clientY + 20 });
          }
          
          setLongPressMenuOpen(true);
          // Reset menu state - these are only set on CLICK, not hover
          setMenuMotion(false);
          setMenuMakePrimary(false);
        }, 280); // Slightly faster detection
      }
    } else if (tool === "route") {
      e.stopPropagation();
      setIsDrawingRoute(true);
      setIsDraggingStraightRoute(true);
      setSelectedPlayer(playerId);
      setSelectedElements({ players: [], routes: [] });
      const player = players.find(p => p.id === playerId);
      if (player) {
        const initialPoint = { x: player.x, y: player.y };
        setCurrentRoutePoints([initialPoint]);
        currentRoutePointsRef.current = [initialPoint];
      }
    }
  };
  
  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // If there was a pending drag intent, activate it now
    if (pendingDragRef.current) {
      setIsDragging(true);
      setDragOffset(pendingDragRef.current.offset);
      pendingDragRef.current = null;
    }
    setLongPressPlayerRef(null);
    setIsLongPressHolding(false);
    longPressStartPos.current = null;
  };
  
  const closeLongPressMenu = () => {
    setLongPressMenuOpen(false);
    setLongPressPlayerId(null);
    setHoveredRouteType(null);
    setHoveredRouteStyle(null);
    setMenuMotion(false);
    setMenuMakePrimary(false);
    setMenuConfirming(false);
  };
  
  // Debounce ref to prevent double-clicking
  const routeStartDebounceRef = useRef(false);
  
  const startRouteFromMenu = (type: "pass" | "run" | "blocking" | null, style: "straight" | "curved") => {
    // Guard against null type (race condition protection)
    if (!type || !longPressPlayerId || menuConfirming || routeStartDebounceRef.current) return;
    routeStartDebounceRef.current = true;
    setTimeout(() => { routeStartDebounceRef.current = false; }, 600);
    
    const player = players.find(p => p.id === longPressPlayerId);
    if (!player) return;
    
    const playerId = longPressPlayerId;
    
    // Store pending selection - route starts when user hovers over the player
    setPendingRouteSelection({
      playerId,
      type,
      style,
      motion: type === "blocking" ? false : menuMotion,
      primary: type === "blocking" ? false : menuMakePrimary,
    });
    
    // Close the menu - user will hover over player to start drawing
    closeLongPressMenu();
  };
  
  const executeRouteStart = (type: "pass" | "run" | "blocking", style: "straight" | "curved", player: { x: number; y: number }, playerId: string) => {
    // Set route options (motion and primary only apply to pass/run, not blocking)
    setRouteType(type);
    setRouteStyle(style);
    if (type === "blocking") {
      setIsMotion(false);
      setMakePrimary(false);
    } else {
      const applyMotion = menuMotion;
      const applyPrimary = menuMakePrimary;
      setIsMotion(applyMotion);
      setMakePrimary(applyPrimary);
    }
    
    // Start route drawing
    setTool("route");
    setIsDrawingRoute(true);
    setIsDraggingStraightRoute(true);
    setSelectedPlayer(playerId);
    setSelectedElements({ players: [], routes: [] });
    
    const initialPoint = { x: player.x, y: player.y };
    setCurrentRoutePoints([initialPoint]);
    currentRoutePointsRef.current = [initialPoint];
    
    // If not in confirming mode (no options selected), close immediately
    if (!menuConfirming) {
      closeLongPressMenu();
    }
    // Otherwise, let the confirmation timer close the menu
  };

  const handlePlayerDoubleClick = (e: React.PointerEvent, playerId: string) => {
    e.stopPropagation();
    cancelLongPress();
    const player = players.find(p => p.id === playerId);
    if (player) {
      setEditingPlayer(playerId);
      setEditingLabel(player.label || "");
    }
  };

  const handleFootballPointerDown = (e: React.PointerEvent, footballId: string) => {
    const football = footballs.find(f => f.id === footballId);
    if (tool === "select" && football) {
      e.stopPropagation();
      saveToHistory();
      setSelectedFootball(footballId);
      setSelectedPlayer(null);
      setSelectedRoute(null);
      setSelectedShape(null);
      setSelectedElements({ players: [], routes: [] });
      setIsDragging(true);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left - football.x,
          y: e.clientY - rect.top - football.y,
        });
      }
    }
  };

  const handleLabelChange = (value: string) => {
    const upperValue = value.toUpperCase().slice(0, 2);
    setEditingLabel(upperValue);
  };

  const finishLabelEdit = () => {
    if (editingPlayer) {
      setPlayers(players.map(p =>
        p.id === editingPlayer ? { ...p, label: editingLabel } : p
      ));
      setEditingPlayer(null);
      setEditingLabel("");
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    // Cancel long-press if mouse moves more than 8 pixels (prevents menu opening during drag)
    if (longPressStartPos.current && longPressTimerRef.current) {
      const dx = e.clientX - longPressStartPos.current.x;
      const dy = e.clientY - longPressStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 20) {
        cancelLongPress();
      }
    }
    
    const bounds = FIELD.PLAYER_BOUNDS;
    if (isDragging && selectedPlayer && tool === "select") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const newX = e.clientX - rect.left - dragOffset.x;
        const newY = e.clientY - rect.top - dragOffset.y;
        setPlayers(players.map(p =>
          p.id === selectedPlayer ? { ...p, x: Math.max(bounds.minX, Math.min(bounds.maxX, newX)), y: Math.max(bounds.minY, Math.min(bounds.maxY, newY)) } : p
        ));
      }
    }
    
    // Handle football dragging
    if (isDragging && selectedFootball && tool === "select") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const newX = e.clientX - rect.left - dragOffset.x;
        const newY = e.clientY - rect.top - dragOffset.y;
        setFootballs(footballs.map(f =>
          f.id === selectedFootball ? { 
            ...f,
            x: Math.max(bounds.minX, Math.min(bounds.maxX, newX)), 
            y: Math.max(bounds.minY, Math.min(bounds.maxY, newY)) 
          } : f
        ));
      }
    }
    
    if (tool === "route" && isDraggingStraightRoute && isDrawingRoute && currentRoutePointsRef.current.length >= 1) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const currentPoint = { x, y };
        
        if (routeStyle === "straight") {
          const points = currentRoutePointsRef.current;
          const ANGLE_THRESHOLD = 50;
          const MIN_SEGMENT_LENGTH = 20;
          
          if (points.length === 1) {
            const newPoints = [points[0], currentPoint];
            setCurrentRoutePoints(newPoints);
            currentRoutePointsRef.current = newPoints;
          } else if (points.length >= 2) {
            const lastVertex = points[points.length - 2];
            const lastPoint = points[points.length - 1];
            
            const segmentLength = Math.sqrt(
              Math.pow(currentPoint.x - lastVertex.x, 2) + 
              Math.pow(currentPoint.y - lastVertex.y, 2)
            );
            
            if (segmentLength > MIN_SEGMENT_LENGTH && points.length >= 2) {
              const angleDiff = calculateAngleDifference(lastVertex, lastPoint, currentPoint);
              
              if (angleDiff > ANGLE_THRESHOLD) {
                const newPoints = [...points.slice(0, -1), lastPoint, currentPoint];
                setCurrentRoutePoints(newPoints);
                currentRoutePointsRef.current = newPoints;
              } else {
                const newPoints = [...points.slice(0, -1), currentPoint];
                setCurrentRoutePoints(newPoints);
                currentRoutePointsRef.current = newPoints;
              }
            } else {
              const newPoints = [...points.slice(0, -1), currentPoint];
              setCurrentRoutePoints(newPoints);
              currentRoutePointsRef.current = newPoints;
            }
          }
        } else if (routeStyle === "curved") {
          const points = currentRoutePointsRef.current;
          const lastPoint = points[points.length - 1];
          
          const dist = Math.sqrt(
            Math.pow(currentPoint.x - lastPoint.x, 2) + 
            Math.pow(currentPoint.y - lastPoint.y, 2)
          );
          
          if (dist > 2) {
            const newPoints = [...points, currentPoint];
            setCurrentRoutePoints(newPoints);
            currentRoutePointsRef.current = newPoints;
          }
        }
      }
    }
    
    if (draggingRoutePoint) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setRoutes(prevRoutes => prevRoutes.map(r => {
          if (r.id === draggingRoutePoint.routeId) {
            const newPoints = [...r.points];
            newPoints[draggingRoutePoint.pointIndex] = { x, y };
            return { ...r, points: newPoints };
          }
          return r;
        }));
      }
    }
    
    if (tool === "select" && lassoStart && !isDragging && !draggingRoutePoint && !isDraggingStraightRoute) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setLassoEnd({ x, y });
      }
    }
  };

  const handleCanvasMouseUp = () => {
    // Cancel long-press timer if mouse released before 300ms
    cancelLongPress();
    
    if (tool === "route" && isDraggingStraightRoute && isDrawingRoute && currentRoutePointsRef.current.length >= 2) {
      finishRoute();
      setIsDraggingStraightRoute(false);
      setIsDragging(false);
      setDraggingRoutePoint(null);
      return;
    }
    
    setIsDragging(false);
    setDraggingRoutePoint(null);
    
    if (tool === "select" && lassoStart) {
      if (lassoEnd) {
        const minX = Math.min(lassoStart.x, lassoEnd.x);
        const maxX = Math.max(lassoStart.x, lassoEnd.x);
        const minY = Math.min(lassoStart.y, lassoEnd.y);
        const maxY = Math.max(lassoStart.y, lassoEnd.y);
        
        const selectedPlayerIds = players
          .filter(p => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY)
          .map(p => p.id);
        
        const selectedRouteIds = routes
          .filter(r => r.points.some(point => 
            point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
          ))
          .map(r => r.id);
        
        setSelectedElements({ players: selectedPlayerIds, routes: selectedRouteIds });
      } else {
        setSelectedElements({ players: [], routes: [] });
      }
      
      setLassoStart(null);
      setLassoEnd(null);
    }
  };

  const handleCanvasClick = () => {
  };

  const handleCanvasDoubleClick = () => {
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-testid^="player-"]')) {
      return;
    }
    
    if (tool === "select") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setLassoStart({ x, y });
        setLassoEnd({ x, y });
        setSelectedElements({ players: [], routes: [] });
        setSelectedPlayer(null);
        setSelectedRoute(null);
        setSelectedShape(null);
        setSelectedFootball(null);
      }
    } else if (tool === "shape" && playType === "defense") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setShapeStart({ x, y });
        setIsDrawingShape(true);
      }
    }
  };

  const handleShapePointerMove = (e: React.PointerEvent) => {
    if (isDrawingShape && shapeStart) {
      // Visual feedback could be added here
    }
  };

  const handleShapePointerUp = (e: React.PointerEvent) => {
    if (isDrawingShape && shapeStart) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const width = Math.abs(x - shapeStart.x);
        const height = Math.abs(y - shapeStart.y);
        
        if (width > 20 && height > 20) {
          saveToHistory();
          const newShape: Shape = {
            id: `shape-${Date.now()}`,
            type: shapeType,
            x: Math.min(shapeStart.x, x),
            y: Math.min(shapeStart.y, y),
            width,
            height,
            color: shapeColor,
          };
          setShapes([...shapes, newShape]);
        }
      }
      setIsDrawingShape(false);
      setShapeStart(null);
    }
  };

  const finishRoute = () => {
    if (isDrawingRoute && selectedPlayer && currentRoutePointsRef.current.length >= 2) {
      saveToHistory();
      let finalPoints = currentRoutePointsRef.current.map(p => ({ ...p }));
      
      if (routeStyle === "curved") {
        finalPoints = simplifyPoints(finalPoints, 5);
      }
      
      const player = players.find(p => p.id === selectedPlayer);
      const playerColor = player?.color || "#000000";
      
      const newRoute: Route = {
        id: `route-${Date.now()}`,
        playerId: selectedPlayer,
        points: finalPoints,
        type: routeType,
        style: routeStyle,
        isMotion: isMotion,
        priority: makePrimary ? 1 : undefined,
        color: playerColor,
      };
      setRoutes(prev => [...prev, newRoute]);
    }
    setIsDrawingRoute(false);
    setCurrentRoutePoints([]);
    currentRoutePointsRef.current = [];
    setSelectedElements({ players: [], routes: [] });
    setIsDraggingStraightRoute(false);
    setTool("select");
    setMakePrimary(false);
    setIsMotion(false);
    setIsPlayAction(false);
    // Close the long-press menu when route is completed
    closeLongPressMenu();
  };

  const handleBackgroundClick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setSelectedPlayer(null);
      setSelectedRoute(null);
      setSelectedShape(null);
      setSelectedFootball(null);
      setSelectedElements({ players: [], routes: [] });
    }
  };

  const generateScaledExport = async (targetWidth: number, targetHeight: number): Promise<string> => {
    if (!canvasRef.current) throw new Error("Canvas not available");
    
    // Path 1: Native size (694x392) - direct capture, pixel-perfect quality
    const isNativeSize = targetWidth === FIELD.WIDTH && targetHeight === FIELD.HEIGHT;
    
    if (isNativeSize) {
      return await toPng(canvasRef.current, {
        width: FIELD.WIDTH,
        height: FIELD.HEIGHT,
        skipFonts: true,
        pixelRatio: 1,
      });
    }
    
    // Path 2: Other sizes - capture at 2x resolution, then downscale for crisp results
    const highResDataUrl = await toPng(canvasRef.current, {
      width: FIELD.WIDTH,
      height: FIELD.HEIGHT,
      skipFonts: true,
      pixelRatio: 2, // Capture at 2x resolution (1388x784)
    });
    
    // Downscale the high-res capture to target dimensions
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        
        // High-quality downscaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        
        // Draw the high-res image scaled down to target size
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Failed to load image for scaling"));
      img.src = highResDataUrl;
    });
  };

  const exportAsImage = async () => {
    if (!canvasRef.current) return;
    
    try {
      const targetWidth = parseInt(exportWidth);
      const targetHeight = parseInt(exportHeight);
      const dataUrl = await generateScaledExport(targetWidth, targetHeight);
      
      const link = document.createElement("a");
      link.download = `${metadata.name || "play"}.png`;
      link.href = dataUrl;
      link.click();
      
      toast({
        title: "Export Successful",
        description: `Play exported as ${exportWidth}x${exportHeight} image`,
      });
    } catch (err) {
      toast({
        title: "Export Failed",
        description: "Failed to export image",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = async () => {
    if (!canvasRef.current) return;
    
    try {
      const targetWidth = parseInt(exportWidth);
      const targetHeight = parseInt(exportHeight);
      const dataUrl = await generateScaledExport(targetWidth, targetHeight);
      
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      
      toast({
        title: "Copied!",
        description: `Play copied to clipboard at ${exportWidth}x${exportHeight}`,
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const getRoutePath = (route: Route) => {
    if (route.points.length < 2) return "";
    const points = route.points;
    if (route.style === "straight") {
      return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
    } else {
      let path = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];
        if (next) {
          const cp1x = prev.x + (curr.x - prev.x) * 0.5;
          const cp1y = prev.y + (curr.y - prev.y) * 0.5;
          path += ` Q ${cp1x} ${cp1y} ${curr.x} ${curr.y}`;
        } else {
          path += ` L ${curr.x} ${curr.y}`;
        }
      }
      return path;
    }
  };

  const getRouteColor = (route: Route | { type: string; color?: string }) => {
    if (route.type === "blocking") return "#ffffff";
    if (route.type === "run") return "#000000";
    return route.color || "#000000";
  };

  // Split motion route at LOS - returns { belowLOS: points[], aboveLOS: points[] }
  const splitMotionRouteAtLOS = (points: { x: number; y: number }[]) => {
    const LOS_Y = FIELD.LOS_Y;
    const belowLOS: { x: number; y: number }[] = [];
    const aboveLOS: { x: number; y: number }[] = [];
    
    if (points.length === 0) return { belowLOS, aboveLOS };
    
    // Add the first point to the appropriate array
    if (points[0].y >= LOS_Y) {
      belowLOS.push(points[0]);
    } else {
      aboveLOS.push(points[0]);
    }
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      
      // Check if we're crossing the LOS between prev and curr
      const prevBelow = prev.y >= LOS_Y;
      const currBelow = curr.y >= LOS_Y;
      
      if (prevBelow !== currBelow) {
        // Crossing the LOS - calculate intersection point
        const t = (LOS_Y - prev.y) / (curr.y - prev.y);
        const intersectX = prev.x + t * (curr.x - prev.x);
        const intersectPoint = { x: intersectX, y: LOS_Y };
        
        if (prevBelow) {
          // Moving from below to above LOS
          belowLOS.push(intersectPoint);
          aboveLOS.push(intersectPoint);
          aboveLOS.push(curr);
        } else {
          // Moving from above to below LOS
          aboveLOS.push(intersectPoint);
          belowLOS.push(intersectPoint);
          belowLOS.push(curr);
        }
      } else if (currBelow) {
        // Staying below LOS
        belowLOS.push(curr);
      } else {
        // Staying above LOS
        aboveLOS.push(curr);
      }
    }
    
    return { belowLOS, aboveLOS };
  };

  // Generate path string for a subset of points using route style
  const getRoutePathForPoints = (points: { x: number; y: number }[], style: string) => {
    if (points.length < 2) return "";
    if (style === "straight") {
      return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
    } else {
      let path = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];
        if (next) {
          const cp1x = prev.x + (curr.x - prev.x) * 0.5;
          const cp1y = prev.y + (curr.y - prev.y) * 0.5;
          path += ` Q ${cp1x} ${cp1y} ${curr.x} ${curr.y}`;
        } else {
          path += ` L ${curr.x} ${curr.y}`;
        }
      }
      return path;
    }
  };

  const renderShape = (shape: Shape) => {
    const isSelected = selectedShape === shape.id;
    const strokeColor = isSelected ? "#06b6d4" : "transparent";
    
    if (shape.type === "circle") {
      const radius = Math.min(shape.width, shape.height) / 2;
      return (
        <ellipse
          key={shape.id}
          cx={shape.x + shape.width / 2}
          cy={shape.y + shape.height / 2}
          rx={radius}
          ry={radius}
          fill={shape.color}
          fillOpacity="0.3"
          stroke={strokeColor}
          strokeWidth="3"
          className="cursor-pointer"
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedShape(shape.id);
            setSelectedPlayer(null);
            setSelectedRoute(null);
            setSelectedElements({ players: [], routes: [] });
          }}
          data-testid={`shape-${shape.id}`}
        />
      );
    } else if (shape.type === "oval") {
      return (
        <ellipse
          key={shape.id}
          cx={shape.x + shape.width / 2}
          cy={shape.y + shape.height / 2}
          rx={shape.width / 2}
          ry={shape.height / 2}
          fill={shape.color}
          fillOpacity="0.3"
          stroke={strokeColor}
          strokeWidth="3"
          className="cursor-pointer"
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedShape(shape.id);
            setSelectedPlayer(null);
            setSelectedRoute(null);
            setSelectedElements({ players: [], routes: [] });
          }}
          data-testid={`shape-${shape.id}`}
        />
      );
    } else if (shape.type === "square") {
      const size = Math.min(shape.width, shape.height);
      return (
        <rect
          key={shape.id}
          x={shape.x}
          y={shape.y}
          width={size}
          height={size}
          fill={shape.color}
          fillOpacity="0.3"
          stroke={strokeColor}
          strokeWidth="3"
          className="cursor-pointer"
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedShape(shape.id);
            setSelectedPlayer(null);
            setSelectedRoute(null);
            setSelectedElements({ players: [], routes: [] });
          }}
          data-testid={`shape-${shape.id}`}
        />
      );
    } else {
      return (
        <rect
          key={shape.id}
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          fill={shape.color}
          fillOpacity="0.3"
          stroke={strokeColor}
          strokeWidth="3"
          className="cursor-pointer"
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedShape(shape.id);
            setSelectedPlayer(null);
            setSelectedRoute(null);
            setSelectedElements({ players: [], routes: [] });
          }}
          data-testid={`shape-${shape.id}`}
        />
      );
    }
  };

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden bg-background ${isLongPressHolding || longPressMenuOpen ? "select-none" : ""}`}>
      {(metadata.name || metadata.formation || metadata.concept || metadata.personnel) && (
        <div className="bg-gradient-to-r from-[#1a2332] to-[#2a3342] border-b border-border px-6 py-3 flex items-center gap-3 flex-wrap">
          {metadata.name && (
            <Badge variant="default" className="bg-primary text-primary-foreground font-semibold px-3 py-1.5 text-base" data-testid="badge-play-name">
              {metadata.name}
            </Badge>
          )}
          {metadata.formation && (
            <Badge variant="secondary" className="bg-secondary/80 text-secondary-foreground font-medium px-3 py-1.5" data-testid="badge-formation">
              Formation: {getFormattedLabel(metadata.formation, formationLabels)}
            </Badge>
          )}
          {metadata.concept && (
            <Badge variant="secondary" className="bg-secondary/80 text-secondary-foreground font-medium px-3 py-1.5" data-testid="badge-concept">
              Concept: {getFormattedLabel(metadata.concept, conceptLabels)}
            </Badge>
          )}
          {metadata.personnel && (
            <Badge variant="secondary" className="bg-secondary/80 text-secondary-foreground font-medium px-3 py-1.5" data-testid="badge-personnel">
              Personnel: {metadata.personnel}
            </Badge>
          )}
        </div>
      )}

      <div className="flex flex-row flex-1 overflow-hidden">
        <div className="w-96 min-w-72 flex-shrink border-r border-border bg-card flex flex-col h-full overflow-y-auto">
          <div className="p-3 border-b border-border">
            <h1 className="text-xl font-bold text-foreground mb-2">Play Designer</h1>
            <Tabs value={playType} onValueChange={(v) => setPlayType(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="offense" data-testid="tab-offense">Offense</TabsTrigger>
                <TabsTrigger value="defense" data-testid="tab-defense">Defense</TabsTrigger>
                <TabsTrigger value="special" data-testid="tab-special">Special</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto pt-2 px-4 pb-2 space-y-2">
            <Card className="p-3 space-y-2">
              <h3 className="font-semibold text-sm text-foreground">Play Metadata</h3>
              <div className="space-y-2">
                <div>
                  <Label htmlFor="play-name" className="text-xs">Name</Label>
                  <Input
                    id="play-name"
                    data-testid="input-play-name"
                    placeholder="Play Name..."
                    value={metadata.name}
                    onChange={(e) => setMetadata({ ...metadata, name: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="formation" className="text-xs">Formation</Label>
                  {playType === "offense" && (
                    <Input
                      id="formation"
                      data-testid="input-formation"
                      placeholder="I-Formation, Shotgun..."
                      value={metadata.formation}
                      onChange={(e) => setMetadata({ ...metadata, formation: e.target.value })}
                      className="h-8 text-sm"
                    />
                  )}
                  {playType === "defense" && (
                    <Select value={metadata.formation} onValueChange={(v) => setMetadata({ ...metadata, formation: v })}>
                      <SelectTrigger id="formation" data-testid="select-formation" className="h-8 text-sm">
                        <SelectValue placeholder="Select formation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="man-to-man">Man-to-Man</SelectItem>
                        <SelectItem value="zone">Zone</SelectItem>
                        <SelectItem value="zone-blitz">Zone Blitz</SelectItem>
                        <SelectItem value="blitz">Blitz</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {playType === "special" && (
                    <Select value={metadata.formation} onValueChange={(v) => setMetadata({ ...metadata, formation: v })}>
                      <SelectTrigger id="formation" data-testid="select-formation" className="h-8 text-sm">
                        <SelectValue placeholder="Select formation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="field-goal">Field Goal</SelectItem>
                        <SelectItem value="punt">Punt</SelectItem>
                        <SelectItem value="kickoff">Kickoff</SelectItem>
                        <SelectItem value="kickoff-return">Kickoff Return</SelectItem>
                        <SelectItem value="punt-return">Punt Return</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {playType === "offense" && (
                  <>
                    <div>
                      <Label htmlFor="concept" className="text-xs">Concept</Label>
                      <Select value={metadata.concept} onValueChange={(v) => setMetadata({ ...metadata, concept: v })}>
                        <SelectTrigger id="concept" data-testid="select-concept" className="h-8 text-sm">
                          <SelectValue placeholder="Select Concept" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="outside-run">Outside Run</SelectItem>
                          <SelectItem value="inside-run">Inside Run</SelectItem>
                          <SelectItem value="short-pass">Short Pass</SelectItem>
                          <SelectItem value="medium-pass">Medium Pass</SelectItem>
                          <SelectItem value="deep-pass">Deep Pass</SelectItem>
                          <SelectItem value="play-action-pass">Play Action Pass</SelectItem>
                          <SelectItem value="rpo">RPO</SelectItem>
                          <SelectItem value="screen-pass">Screen Pass</SelectItem>
                          <SelectItem value="trick">Trick</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="personnel" className="text-xs">Personnel</Label>
                      <Input
                        id="personnel"
                        data-testid="input-personnel"
                        placeholder="1RB, 3WR, 1TE..."
                        value={metadata.personnel}
                        onChange={(e) => setMetadata({ ...metadata, personnel: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </>
                )}
                {playType === "defense" && (
                  <div>
                    <Label htmlFor="personnel" className="text-xs">Personnel</Label>
                    <Input
                      id="personnel"
                      data-testid="input-personnel"
                      placeholder="4-3, 3-4, Nickel..."
                      value={metadata.personnel}
                      onChange={(e) => setMetadata({ ...metadata, personnel: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                )}
                {playType === "special" && (
                  <div>
                    <Label htmlFor="personnel" className="text-xs">Personnel</Label>
                    <Input
                      id="personnel"
                      data-testid="input-personnel"
                      placeholder="Special teams setup..."
                      value={metadata.personnel}
                      onChange={(e) => setMetadata({ ...metadata, personnel: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-3 space-y-2">
              <h3 className="font-semibold text-sm text-foreground">Tools</h3>
              <div className="grid grid-cols-3 gap-1.5">
                <Button
                  size="sm"
                  variant={tool === "select" ? "default" : "secondary"}
                  onClick={() => setTool("select")}
                  data-testid="button-tool-select"
                  className="flex justify-center items-center gap-1"
                >
                  <MoveHorizontal className="h-4 w-4" />
                  Select
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={undo}
                  disabled={history.length === 0}
                  data-testid="button-tool-undo"
                  className="flex justify-center items-center gap-1"
                >
                  <RotateCcw className="h-4 w-4" />
                  Undo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearAll}
                  data-testid="button-clear-all"
                  className="flex justify-center items-center gap-1 bg-white text-black border-gray-300"
                >
                  Clear All
                </Button>
                {playType === "defense" && (
                  <Button
                    size="sm"
                    variant={tool === "shape" ? "default" : "secondary"}
                    onClick={() => setTool("shape")}
                    data-testid="button-tool-shape"
                    className="justify-start"
                  >
                    <SquareIcon className="h-4 w-4 mr-2" />
                    Shape
                  </Button>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-foreground">Preloaded Game Format</h3>
                <div className="flex flex-col gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid="button-format-5on5"
                    onClick={handleLoad5v5}
                    className="w-full justify-center bg-green-600 hover:bg-green-700 text-white border-0"
                  >
                    <Flag className="h-4 w-4 text-red-500 mr-2" />
                    5-on-5 Flag
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid="button-format-7on7"
                    onClick={handleLoad7v7}
                    className="w-full justify-center bg-green-600 hover:bg-green-700 text-white border-0"
                  >
                    <Flag className="h-4 w-4 text-red-500 mr-2" />
                    7-on-7 Flag
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid="button-format-9on9"
                    onClick={handleLoad9v9}
                    className="w-full justify-center bg-green-600 hover:bg-green-700 text-white border-0"
                  >
                    <Flag className="h-4 w-4 text-red-500 mr-2" />
                    9-on-9 Flag
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid="button-format-11on11"
                    onClick={handleLoad11v11}
                    className="w-full justify-center bg-green-600 hover:bg-green-700 text-white border-0"
                  >
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 20 40" fill="currentColor">
                      <ellipse cx="10" cy="20" rx="9.5" ry="19.5" fill="#8B4513" stroke="#654321" strokeWidth="1" />
                      <line x1="10" y1="2" x2="10" y2="38" stroke="#FFFFFF" strokeWidth="1.2" />
                    </svg>
                    11-on-11 Tackle
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs">Add Players</Label>
                <div className="grid grid-cols-4 gap-2">
                  {colors.map((color, idx) => (
                    <Button
                      key={color}
                      size="icon"
                      data-testid={`button-add-player-${idx}`}
                      onClick={() => addPlayer(color)}
                      className="h-9 w-9"
                      style={{ backgroundColor: color }}
                    >
                      <Plus className="h-4 w-4 text-white" />
                    </Button>
                  ))}
                  <Button
                    size="icon"
                    variant="outline"
                    data-testid="button-add-football"
                    onClick={addFootball}
                    className="h-9 w-9"
                  >
                    <svg width="16" height="16" viewBox="0 0 20 40" fill="currentColor">
                      <ellipse cx="10" cy="20" rx="9.5" ry="19.5" fill="#8B4513" stroke="#654321" strokeWidth="1" />
                      <line x1="10" y1="2" x2="10" y2="38" stroke="#FFFFFF" strokeWidth="1.2" />
                      <line x1="4" y1="13" x2="16" y2="13" stroke="#FFFFFF" strokeWidth="0.6" />
                      <line x1="3" y1="16.5" x2="17" y2="16.5" stroke="#FFFFFF" strokeWidth="0.6" />
                      <line x1="2.5" y1="20" x2="17.5" y2="20" stroke="#FFFFFF" strokeWidth="0.6" />
                      <line x1="3" y1="23.5" x2="17" y2="23.5" stroke="#FFFFFF" strokeWidth="0.6" />
                      <line x1="4" y1="27" x2="16" y2="27" stroke="#FFFFFF" strokeWidth="0.6" />
                    </svg>
                  </Button>
                </div>
                {footballs.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="play-action"
                      checked={isPlayAction}
                      onChange={(e) => setIsPlayAction(e.target.checked)}
                      className="rounded"
                      data-testid="checkbox-play-action"
                    />
                    <Label htmlFor="play-action" className="text-xs">Play-Action</Label>
                  </div>
                )}
              </div>

              {tool === "shape" && playType === "defense" && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs">Shape Type</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant={shapeType === "circle" ? "default" : "outline"}
                        onClick={() => setShapeType("circle")}
                        data-testid="button-shape-circle"
                      >
                        Circle
                      </Button>
                      <Button
                        size="sm"
                        variant={shapeType === "oval" ? "default" : "outline"}
                        onClick={() => setShapeType("oval")}
                        data-testid="button-shape-oval"
                      >
                        Oval
                      </Button>
                      <Button
                        size="sm"
                        variant={shapeType === "square" ? "default" : "outline"}
                        onClick={() => setShapeType("square")}
                        data-testid="button-shape-square"
                      >
                        Square
                      </Button>
                      <Button
                        size="sm"
                        variant={shapeType === "rectangle" ? "default" : "outline"}
                        onClick={() => setShapeType("rectangle")}
                        data-testid="button-shape-rectangle"
                      >
                        Rectangle
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Shape Color</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {shapeColors.map((color, idx) => (
                        <Button
                          key={color}
                          size="sm"
                          variant={shapeColor === color ? "default" : "outline"}
                          onClick={() => setShapeColor(color)}
                          data-testid={`button-shape-color-${idx}`}
                          className="h-8"
                          style={{ backgroundColor: shapeColor === color ? color : 'transparent', borderColor: color, color: shapeColor === color ? 'white' : color }}
                        >
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {tool === "route" && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs">Route Type</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      <Button
                        size="sm"
                        variant={routeType === "pass" ? "default" : "secondary"}
                        onClick={() => setRouteType("pass")}
                        data-testid="button-route-pass"
                        className="px-2"
                      >
                        Pass
                      </Button>
                      <Button
                        size="sm"
                        variant={routeType === "run" ? "default" : "secondary"}
                        onClick={() => setRouteType("run")}
                        data-testid="button-route-run"
                        className="px-2"
                      >
                        Run
                      </Button>
                      <Button
                        size="sm"
                        variant={makePrimary ? "default" : "secondary"}
                        onClick={() => setMakePrimary(!makePrimary)}
                        data-testid="button-make-primary"
                        className="px-2 flex items-center gap-1"
                      >
                        <span className="inline-flex items-center justify-center w-4 h-4 bg-white text-black rounded-full text-xs font-bold">1</span>
                        Primary
                      </Button>
                      <Button
                        size="sm"
                        variant={routeType === "blocking" ? "default" : "secondary"}
                        onClick={() => setRouteType("blocking")}
                        data-testid="button-route-blocking"
                        className="px-2"
                      >
                        Block
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Style</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant={routeStyle === "straight" ? "default" : "outline"}
                        onClick={() => setRouteStyle("straight")}
                        data-testid="button-style-straight"
                      >
                        Straight
                      </Button>
                      <Button
                        size="sm"
                        variant={routeStyle === "curved" ? "default" : "outline"}
                        onClick={() => setRouteStyle("curved")}
                        data-testid="button-style-curved"
                      >
                        Curved
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="motion"
                      checked={isMotion}
                      onChange={(e) => setIsMotion(e.target.checked)}
                      className="rounded"
                      data-testid="checkbox-motion"
                    />
                    <Label htmlFor="motion" className="text-xs">Motion (dotted)</Label>
                  </div>

                  {isDrawingRoute && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={finishRoute}
                      data-testid="button-finish-route"
                      className="w-full"
                    >
                      Finish Route (or double-click)
                    </Button>
                  )}
                </>
              )}
            </Card>

            <Card className="p-3 space-y-2">
              <h3 className="font-semibold text-sm text-foreground">Export</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="export-width" className="text-xs">Width (px)</Label>
                  <Input
                    id="export-width"
                    data-testid="input-export-width"
                    type="number"
                    value={exportWidth}
                    onChange={(e) => setExportWidth(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="export-height" className="text-xs">Height (px)</Label>
                  <Input
                    id="export-height"
                    data-testid="input-export-height"
                    type="number"
                    value={exportHeight}
                    onChange={(e) => setExportHeight(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={exportAsImage}
                  data-testid="button-export"
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download as Image
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyToClipboard}
                  data-testid="button-copy"
                  className="w-full"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </Button>
              </div>
            </Card>

            {(selectedPlayer || selectedRoute || selectedShape || selectedFootball) && (
              <Button
                size="sm"
                variant="destructive"
                onClick={deleteSelected}
                data-testid="button-delete-selected"
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected (Del)
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 h-full relative bg-muted/30 p-2 overflow-auto flex items-center justify-center" onClick={handleBackgroundClick}>
          {(playType === "defense" || playType === "special") && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
              <img 
                src={underConstructionImage} 
                alt="Under Construction" 
                className="max-w-lg max-h-96 object-contain"
                data-testid="under-construction-image"
              />
            </div>
          )}
          <div className="bg-background rounded-lg shadow-lg p-2">
            <div
              ref={canvasRef}
              className="relative rounded cursor-crosshair overflow-hidden"
              style={{ width: FIELD.WIDTH, height: FIELD.HEIGHT, touchAction: "none" }}
              onPointerMove={(e) => {
                handleCanvasPointerMove(e);
                handleShapePointerMove(e);
              }}
              onPointerUp={(e) => {
                handleCanvasMouseUp();
                handleShapePointerUp(e);
              }}
              onPointerDown={handleCanvasPointerDown}
              onClick={handleCanvasClick}
              onDoubleClick={handleCanvasDoubleClick}
              onPointerLeave={cancelLongPress}
              onPointerCancel={cancelLongPress}
              data-testid="canvas-field"
            >
              {/* White header for metadata */}
              <div 
                className="absolute top-0 left-0 right-0 flex items-center justify-center"
                style={{ height: FIELD.HEADER_HEIGHT, backgroundColor: "#ffffff", zIndex: 25 }}
              >
                {(metadata.name || metadata.formation || metadata.concept || metadata.personnel) && (
                  <div className="flex flex-wrap items-center justify-center gap-2 px-4">
                    {metadata.name && (
                      <div
                        className="px-3 py-1.5 rounded text-white font-semibold text-sm"
                        style={{ backgroundColor: "#ea580c" }}
                        data-testid="overlay-play-name"
                      >
                        {metadata.name}
                      </div>
                    )}
                    {metadata.formation && (
                      <div
                        className="px-3 py-1.5 rounded text-white font-medium text-sm"
                        style={{ backgroundColor: "#374151" }}
                        data-testid="overlay-formation"
                      >
                        Formation: {getFormattedLabel(metadata.formation, formationLabels)}
                      </div>
                    )}
                    {metadata.concept && (
                      <div
                        className="px-3 py-1.5 rounded text-white font-medium text-sm"
                        style={{ backgroundColor: "#374151" }}
                        data-testid="overlay-concept"
                      >
                        Concept: {getFormattedLabel(metadata.concept, conceptLabels)}
                      </div>
                    )}
                    {metadata.personnel && (
                      <div
                        className="px-3 py-1.5 rounded text-white font-medium text-sm"
                        style={{ backgroundColor: "#374151" }}
                        data-testid="overlay-personnel"
                      >
                        Personnel: {metadata.personnel}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Green field area */}
              <div 
                className="absolute bg-gradient-to-b from-green-600 to-green-700"
                style={{ 
                  top: FIELD.HEADER_HEIGHT, 
                  left: 0, 
                  right: 0, 
                  bottom: 0,
                  zIndex: 0 
                }}
              />
              
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                {/* 5-yard horizontal lines (thicker) - only in field area */}
                {Array.from({ length: Math.floor(FIELD.FIELD_HEIGHT / 60) + 1 }, (_, i) => {
                  const y = FIELD.FIELD_TOP + i * 60;
                  if (y > FIELD.HEIGHT - FIELD.BOTTOM_PADDING) return null;
                  return (
                    <line
                      key={`yard-${i}`}
                      x1={FIELD.FIELD_LEFT}
                      y1={y}
                      x2={FIELD.FIELD_RIGHT}
                      y2={y}
                      stroke="white"
                      strokeWidth="4"
                      opacity="0.3"
                    />
                  );
                })}
                
                {/* 1-yard tick marks on LEFT edge */}
                {Array.from({ length: Math.floor(FIELD.FIELD_HEIGHT / 12) + 1 }, (_, i) => {
                  const y = FIELD.FIELD_TOP + i * 12;
                  if (y > FIELD.HEIGHT - FIELD.BOTTOM_PADDING) return null;
                  return (
                    <line
                      key={`left-tick-${i}`}
                      x1={FIELD.FIELD_LEFT}
                      y1={y}
                      x2={FIELD.FIELD_LEFT + 12}
                      y2={y}
                      stroke="white"
                      strokeWidth="2"
                      opacity="0.8"
                    />
                  );
                })}
                
                {/* 1-yard tick marks on RIGHT edge */}
                {Array.from({ length: Math.floor(FIELD.FIELD_HEIGHT / 12) + 1 }, (_, i) => {
                  const y = FIELD.FIELD_TOP + i * 12;
                  if (y > FIELD.HEIGHT - FIELD.BOTTOM_PADDING) return null;
                  return (
                    <line
                      key={`right-tick-${i}`}
                      x1={FIELD.FIELD_RIGHT - 12}
                      y1={y}
                      x2={FIELD.FIELD_RIGHT}
                      y2={y}
                      stroke="white"
                      strokeWidth="2"
                      opacity="0.8"
                    />
                  );
                })}
                
                {/* Hash marks in middle (NCAA style) */}
                {Array.from({ length: Math.floor(FIELD.FIELD_HEIGHT / 12) + 1 }, (_, i) => {
                  const y = FIELD.FIELD_TOP + i * 12;
                  if (y > FIELD.HEIGHT - FIELD.BOTTOM_PADDING) return null;
                  return (
                    <g key={`hash-${i}`}>
                      <line x1={FIELD.LEFT_HASH_X - 6} y1={y} x2={FIELD.LEFT_HASH_X + 6} y2={y} stroke="white" strokeWidth="2" opacity="0.6" />
                      <line x1={FIELD.RIGHT_HASH_X - 6} y1={y} x2={FIELD.RIGHT_HASH_X + 6} y2={y} stroke="white" strokeWidth="2" opacity="0.6" />
                    </g>
                  );
                })}
                
                {/* Line of scrimmage */}
                <line x1={FIELD.FIELD_LEFT} y1={FIELD.LOS_Y} x2={FIELD.FIELD_RIGHT} y2={FIELD.LOS_Y} stroke="white" strokeWidth="6" />
              </svg>

              <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none", zIndex: 2 }}>
                <defs>
                  <marker id="arrowhead-blocking" markerWidth="4" markerHeight="4" refX="1" refY="2" orient="auto">
                    <line x1="1" y1="0" x2="1" y2="4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                  </marker>
                  {Array.from(new Set([...routes.map(r => getRouteColor(r)), ...offenseColors, ...defenseColors, "#000000"])).map(color => (
                    <marker key={`arrowhead-${color}`} id={`arrowhead-${color.replace('#', '')}`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                      <polygon points="0 0, 8 3, 0 6" fill={color} />
                    </marker>
                  ))}
                </defs>
                
                {shapes.map(shape => renderShape(shape))}

                {routes.filter(r => showBlocking || r.type !== "blocking").map((route) => (
                  <g key={route.id}>
                    {selectedElements.routes.includes(route.id) && (
                      <path
                        d={getRoutePath(route)}
                        stroke="#06b6d4"
                        strokeWidth="6"
                        fill="none"
                        opacity="0.4"
                      />
                    )}
                    {route.isMotion ? (
                      <>
                        {(() => {
                          const { belowLOS, aboveLOS } = splitMotionRouteAtLOS(route.points);
                          const endPoint = route.points[route.points.length - 1];
                          const crossedLOS = endPoint && endPoint.y < FIELD.LOS_Y;
                          return (
                            <>
                              {belowLOS.length >= 2 && (
                                <path
                                  d={getRoutePathForPoints(belowLOS, route.style)}
                                  stroke={getRouteColor(route)}
                                  strokeWidth="3.6"
                                  fill="none"
                                  strokeDasharray="5,5"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedRoute(route.id);
                                    setSelectedPlayer(null);
                                    setSelectedShape(null);
                                    setSelectedFootball(null);
                                    setSelectedElements({ players: [], routes: [] });
                                  }}
                                  className="cursor-pointer"
                                  style={{ pointerEvents: "auto" }}
                                />
                              )}
                              {aboveLOS.length >= 2 && (
                                <path
                                  d={getRoutePathForPoints(aboveLOS, route.style)}
                                  stroke={getRouteColor(route)}
                                  strokeWidth="3.6"
                                  fill="none"
                                  markerEnd={crossedLOS ? `url(#arrowhead-${getRouteColor(route).replace('#', '')})` : undefined}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedRoute(route.id);
                                    setSelectedPlayer(null);
                                    setSelectedShape(null);
                                    setSelectedFootball(null);
                                    setSelectedElements({ players: [], routes: [] });
                                  }}
                                  className="cursor-pointer"
                                  style={{ pointerEvents: "auto" }}
                                  data-testid={`route-${route.id}`}
                                />
                              )}
                              {belowLOS.length >= 2 && aboveLOS.length < 2 && (
                                <path
                                  d={getRoutePathForPoints(belowLOS, route.style)}
                                  stroke="transparent"
                                  strokeWidth="3.6"
                                  fill="none"
                                  data-testid={`route-${route.id}`}
                                  style={{ pointerEvents: "none" }}
                                />
                              )}
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <path
                        d={getRoutePath(route)}
                        stroke={getRouteColor(route)}
                        strokeWidth="3.6"
                        fill="none"
                        markerEnd={(() => {
                          if (route.type === "blocking") {
                            return "url(#arrowhead-blocking)";
                          }
                          return `url(#arrowhead-${getRouteColor(route).replace('#', '')})`;
                        })()}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRoute(route.id);
                          setSelectedPlayer(null);
                          setSelectedShape(null);
                          setSelectedFootball(null);
                          setSelectedElements({ players: [], routes: [] });
                        }}
                        className="cursor-pointer"
                        style={{ pointerEvents: "auto" }}
                        data-testid={`route-${route.id}`}
                      />
                    )}
                    {route.priority && route.points.length > 0 && (
                      <g>
                        <circle
                          cx={route.points[route.points.length - 1].x}
                          cy={route.points[route.points.length - 1].y}
                          r="10"
                          fill="white"
                          stroke="#000"
                          strokeWidth="2"
                        />
                        <text
                          x={route.points[route.points.length - 1].x}
                          y={route.points[route.points.length - 1].y + 4}
                          fill="black"
                          fontSize="12"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {route.priority}
                        </text>
                      </g>
                    )}
                    {selectedRoute === route.id && route.points.map((point, idx) => (
                      <circle
                        key={idx}
                        cx={point.x}
                        cy={point.y}
                        r="6"
                        fill="#06b6d4"
                        stroke="#fff"
                        strokeWidth="2"
                        className="cursor-move"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDraggingRoutePoint({ routeId: route.id, pointIndex: idx });
                        }}
                        data-testid={`route-point-${route.id}-${idx}`}
                      />
                    ))}
                  </g>
                ))}

                {isDrawingRoute && currentRoutePoints.length > 0 && selectedPlayer && (
                  <g>
                    {(() => {
                      const player = players.find(p => p.id === selectedPlayer);
                      const playerColor = player?.color || "#000000";
                      const previewColor = routeType === "blocking" ? "#ffffff" : (routeType === "run" ? "#000000" : playerColor);
                      const endPoint = currentRoutePoints[currentRoutePoints.length - 1];
                      const crossedLOS = endPoint && endPoint.y < FIELD.LOS_Y;
                      
                      if (isMotion) {
                        const { belowLOS, aboveLOS } = splitMotionRouteAtLOS(currentRoutePoints);
                        return (
                          <>
                            {belowLOS.length >= 2 && (
                              <path
                                d={getRoutePathForPoints(belowLOS, routeStyle)}
                                stroke={previewColor}
                                strokeWidth="3.6"
                                fill="none"
                                strokeDasharray="5,5"
                                opacity="0.5"
                              />
                            )}
                            {aboveLOS.length >= 2 && (
                              <path
                                d={getRoutePathForPoints(aboveLOS, routeStyle)}
                                stroke={previewColor}
                                strokeWidth="3.6"
                                fill="none"
                                markerEnd={crossedLOS ? `url(#arrowhead-${previewColor.replace('#', '')})` : undefined}
                                opacity="0.5"
                              />
                            )}
                          </>
                        );
                      }
                      
                      return (
                        <path
                          d={getRoutePath({ points: currentRoutePoints, type: routeType, style: routeStyle } as Route)}
                          stroke={previewColor}
                          strokeWidth="3.6"
                          fill="none"
                          markerEnd={(() => {
                            if (routeType === "blocking") {
                              return "url(#arrowhead-blocking)";
                            }
                            return `url(#arrowhead-${previewColor.replace('#', '')})`;
                          })()}
                          opacity="0.5"
                        />
                      );
                    })()}
                  </g>
                )}
                
                {lassoStart && lassoEnd && (
                  <rect
                    x={Math.min(lassoStart.x, lassoEnd.x)}
                    y={Math.min(lassoStart.y, lassoEnd.y)}
                    width={Math.abs(lassoEnd.x - lassoStart.x)}
                    height={Math.abs(lassoEnd.y - lassoStart.y)}
                    stroke="#06b6d4"
                    strokeWidth="2"
                    fill="rgba(6, 182, 212, 0.1)"
                    strokeDasharray="5,5"
                  />
                )}
              </svg>

              {players.map((player) => (
                <div
                  key={player.id}
                  className="absolute cursor-pointer"
                  style={{
                    left: player.x - 12,
                    top: player.y - 12,
                    width: 24,
                    height: 24,
                    zIndex: 10,
                    pointerEvents: "auto",
                    transform: "translateZ(0)",
                    touchAction: "none",
                  }}
                  onPointerDown={(e) => handlePlayerPointerDown(e, player.id)}
                  onDoubleClick={(e) => handlePlayerDoubleClick(e as unknown as React.PointerEvent, player.id)}
                  onPointerEnter={() => {
                    if (pendingRouteSelection && pendingRouteSelection.playerId === player.id) {
                      // Capture all values immediately before any state changes
                      const pending = { ...pendingRouteSelection };
                      const playerX = player.x;
                      const playerY = player.y;
                      const pId = player.id;
                      
                      // Clear pending state and long press
                      setPendingRouteSelection(null);
                      cancelLongPress();
                      
                      // Set tool to route - this triggers the tool-change effect
                      setTool("route");
                      
                      // Double RAF to ensure we're past the tool-change effect
                      requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                          setRouteType(pending.type);
                          setRouteStyle(pending.style);
                          setIsMotion(pending.motion);
                          setMakePrimary(pending.primary);
                          setIsDrawingRoute(true);
                          setIsDraggingStraightRoute(true);
                          setSelectedPlayer(pId);
                          setSelectedElements({ players: [], routes: [] });
                          
                          const initialPoint = { x: playerX, y: playerY };
                          setCurrentRoutePoints([initialPoint]);
                          currentRoutePointsRef.current = [initialPoint];
                        });
                      });
                    }
                  }}
                  data-testid={`player-${player.id}`}
                >
                  <div
                    className={`w-6 h-6 ${
                      playType === "offense" && player.color === "#6b7280" ? "" : "rounded-full"
                    } flex items-center justify-center text-white font-bold text-xs ${
                      pendingRouteSelection?.playerId === player.id ? "player-pending-route" : ""
                    }`}
                    style={{ 
                      backgroundColor: player.color,
                      transition: "transform 80ms ease-out, box-shadow 80ms ease-out",
                      transform: isLongPressHolding && longPressPlayerRef === player.id ? "scale(1.1)" : "scale(1)",
                      // Immediate pressed ring feedback (within 80ms) - but NOT when pending route (glow takes over)
                      animation: isLongPressHolding && longPressPlayerRef === player.id && !pendingRouteSelection ? "pressRing 280ms ease-out forwards" : "none",
                      // Selection rings - pending route glow is handled by CSS class
                      boxShadow: pendingRouteSelection?.playerId === player.id
                        ? "none" // CSS animation handles the glow
                        : longPressPlayerId === player.id 
                          ? "0 0 0 4px rgba(251, 146, 60, 0.8)" 
                          : (selectedPlayer === player.id || selectedElements.players.includes(player.id)) 
                            ? "0 0 0 2px rgba(34, 211, 238, 1)" 
                            : "none",
                    }}
                  >
                    {editingPlayer === player.id ? (
                      <input
                        type="text"
                        value={editingLabel}
                        onChange={(e) => handleLabelChange(e.target.value)}
                        onBlur={finishLabelEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") finishLabelEdit();
                        }}
                        autoFocus
                        maxLength={2}
                        className="w-full h-full bg-transparent text-center text-white font-bold text-xs outline-none uppercase"
                        data-testid={`input-label-${player.id}`}
                      />
                    ) : (
                      <span className="text-xs">{player.label || ""}</span>
                    )}
                  </div>
                </div>
              ))}

              {footballs.map((football) => (
                <div
                  key={football.id}
                  className={`absolute cursor-pointer hover:scale-110 transition-transform ${
                    selectedFootball === football.id ? "ring-2 ring-cyan-400 rounded-full" : ""
                  }`}
                  style={{ 
                    left: football.x - 5, 
                    top: football.y - 10, 
                    width: 10, 
                    height: 20,
                    zIndex: 50
                  }}
                  onPointerDown={(e) => handleFootballPointerDown(e, football.id)}
                  data-testid={`football-${football.id}`}
                >
                  <svg width="10" height="20" viewBox="0 0 20 40" style={{ pointerEvents: 'none' }}>
                    <ellipse cx="10" cy="20" rx="8.75" ry="18.9" fill="#8B4513" stroke="#654321" strokeWidth="1" />
                    <line x1="10" y1="3" x2="10" y2="37" stroke="#FFFFFF" strokeWidth="1.2" />
                    <line x1="4.5" y1="13" x2="15.5" y2="13" stroke="#FFFFFF" strokeWidth="0.6" />
                    <line x1="3.5" y1="16.5" x2="16.5" y2="16.5" stroke="#FFFFFF" strokeWidth="0.6" />
                    <line x1="3" y1="20" x2="17" y2="20" stroke="#FFFFFF" strokeWidth="0.6" />
                    <line x1="3.5" y1="23.5" x2="16.5" y2="23.5" stroke="#FFFFFF" strokeWidth="0.6" />
                    <line x1="4.5" y1="27" x2="15.5" y2="27" stroke="#FFFFFF" strokeWidth="0.6" />
                  </svg>
                  {isPlayAction && (
                    <svg 
                      width="22" 
                      height="22" 
                      viewBox="-1 -1 22 22"
                      style={{ 
                        position: 'absolute', 
                        left: -1, 
                        top: 9,
                        pointerEvents: 'none'
                      }}
                      data-testid={`play-action-marker-${football.id}`}
                    >
                      <circle cx="10" cy="10" r="10" fill="black" stroke="#000" strokeWidth="2" />
                      <text x="10" y="14" fill="white" fontSize="12" fontWeight="bold" textAnchor="middle">PA</text>
                    </svg>
                  )}
                </div>
              ))}

            </div>
          </div>
        </div>

        <div className="w-96 border-l border-border bg-card p-4 overflow-y-auto">
          <h3 className="font-semibold text-base text-foreground mb-3">🏈 How to Build Your Play</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground mt-3">1. Add Players</p>
            <p>🎮 Choose a Game Format preset (5v5, 7v7, or 11v11) to instantly load a formation, or add players one at a time using the colored icons.</p>
            
            <p className="font-semibold text-foreground mt-3">2. Position & Label</p>
            <p>👆 <span className="font-medium">Move:</span> Click and drag quickly to reposition.</p>
            <p>✏️ <span className="font-medium">Rename:</span> Double-click a player circle to edit its label (e.g., QB, WR, LT).</p>
            
            <p className="font-semibold text-foreground mt-3">3. Draw Routes</p>
            <p>👇 Long-press any player to open the Route Menu:</p>
            <p>🎯 Choose <span className="font-medium">Pass</span>, <span className="font-medium">Run</span>, or <span className="font-medium">Block</span></p>
            <p>📐 Select <span className="font-medium">Straight</span> or <span className="font-medium">Curved</span></p>
            <p>💨 Toggle <span className="font-medium">Motion</span> for pre-snap movement</p>
            <p>⭐ Toggle <span className="font-medium">Primary</span> to mark the main target</p>
            <p>Click points on the field to draw, then click the player again to finish.</p>
            
            <p className="font-semibold text-foreground mt-3">4. Tag Your Play</p>
            <p>📝 Use the metadata fields to organize your playbook:</p>
            <p><span className="font-medium">Name</span> your play (e.g., "Mesh Left")</p>
            <p><span className="font-medium">Formation</span> (e.g., "Shotgun", "I-Form")</p>
            <p><span className="font-medium">Concept</span> (e.g., "Play Action", "Screen")</p>
            <p><span className="font-medium">Personnel</span> grouping (e.g., "1RB/3WR/1TE" or "2RB/2TE/1WR" etc.)</p>
            
            <p className="font-semibold text-foreground mt-3">5. Quick Actions</p>
            <p>↩️ <span className="font-medium">Undo</span> reverses your last change</p>
            <p>🗑️ <span className="font-medium">Clear All</span> wipes the field clean</p>
            
            <p className="font-semibold text-foreground mt-3">6. Save to Your Playbook</p>
            <p>📥 <span className="font-medium">Download</span> saves as an image for printing</p>
            <p>📋 <span className="font-medium">Copy</span> puts it on your clipboard for pasting into docs or slides</p>
          </div>
        </div>
      </div>
      
      {/* Long-press cascading menu - GPU-ACCELERATED SMOOTH CASCADE */}
      {longPressMenuOpen && (
        <div
          data-testid="long-press-menu"
          className="fixed z-[100] select-none lp-menu"
          style={{
            left: longPressMenuPosition.x,
            top: longPressMenuPosition.y,
            animation: "menuEnter 120ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Container - fixed max width, GPU-accelerated */}
          <div 
            className="bg-gray-800 rounded-lg shadow-xl border border-gray-600 relative flex"
            style={{ contain: "layout paint" }}
          >
            {/* Fast confirmation overlay - 500ms, non-blocking, transform-only */}
            {menuConfirming && (
              <div 
                data-testid="menu-confirm-overlay"
                className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-green-600 rounded-lg"
                style={{
                  animation: "confirmFast 500ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
                }}
              >
                {/* Compact animated checkmark */}
                <div className="relative w-12 h-12 mb-2">
                  <svg viewBox="0 0 52 52" className="w-full h-full">
                    <circle cx="26" cy="26" r="24" fill="none" stroke="white" strokeWidth="3" opacity="0.3" />
                    <path 
                      fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                      d="M14 27l8 8 16-16"
                      style={{
                        strokeDasharray: 50,
                        strokeDashoffset: 50,
                        animation: "checkStrokeFast 200ms ease-out 100ms forwards",
                      }}
                    />
                  </svg>
                </div>
                <div className="text-white text-base font-bold tracking-wide">APPLIED</div>
                <div className="text-white/90 text-xs font-medium mt-0.5">
                  {menuMotion && menuMakePrimary ? "Motion + Primary" : menuMotion ? "Motion" : menuMakePrimary ? "Primary" : "Route"}
                </div>
                {/* GPU-accelerated progress bar (transform: scaleX instead of width) */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-800 overflow-hidden">
                  <div className="h-full bg-white w-full" style={{ animation: "progressFillFast 500ms linear forwards" }} />
                </div>
              </div>
            )}
            
            {/* Level 1: Route Types - always visible */}
            <div className="flex flex-col" style={{ width: 108, flexShrink: 0 }}>
              <div className="px-3 py-1.5 bg-gray-700/50 border-b border-gray-600">
                <span className="text-white text-xs font-semibold">Route Type</span>
              </div>
              {(["pass", "run", "blocking"] as const).map((type) => (
                <div
                  key={type}
                  className="lp-menu-item px-3 py-2 text-sm cursor-pointer flex items-center justify-between text-gray-200"
                  data-testid={`menu-route-type-${type}`}
                  onMouseEnter={() => !menuConfirming && setHoveredRouteType(type)}
                  data-active={hoveredRouteType === type}
                >
                  <span className="capitalize font-medium">{type === "blocking" ? "Block" : type}</span>
                  <span className="text-xs opacity-60">▶</span>
                </div>
              ))}
            </div>
            
            {/* Level 2: Styles - slides in from right */}
            {hoveredRouteType && (
              <div 
                className="flex flex-col border-l border-gray-600" 
                style={{ 
                  width: 118, 
                  flexShrink: 0,
                  animation: "columnSlideIn 100ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
                }}
              >
                <div className="px-3 py-1.5 bg-gray-700/50 border-b border-gray-600">
                  <span className="text-white text-xs font-semibold">Style</span>
                </div>
                {(["straight", "curved"] as const).map((style) => (
                  <div
                    key={style}
                    className="lp-menu-item px-3 py-2 text-sm cursor-pointer flex items-center justify-between text-gray-200"
                    data-testid={`menu-route-style-${style}`}
                    onMouseEnter={() => {
                      if (!menuConfirming) {
                        setHoveredRouteStyle(style);
                        // Set pending route on HOVER - player will glow, menu stays open
                        if (hoveredRouteType && longPressPlayerId) {
                          setPendingRouteSelection({
                            playerId: longPressPlayerId,
                            type: hoveredRouteType,
                            style: style,
                            motion: menuMotion,
                            primary: menuMakePrimary,
                          });
                        }
                      }
                    }}
                    data-active={hoveredRouteStyle === style}
                  >
                    <span className="capitalize font-medium">{style}</span>
                    {hoveredRouteType !== "blocking" && <span className="text-xs opacity-60">▶</span>}
                  </div>
                ))}
              </div>
            )}
            
            {/* Level 3: Options - slides in from right (Pass/Run only) */}
            {hoveredRouteType && hoveredRouteType !== "blocking" && hoveredRouteStyle && (
              <div 
                className="flex flex-col border-l border-gray-600"
                style={{ 
                  width: 140, 
                  flexShrink: 0,
                  animation: "columnSlideIn 100ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
                }}
              >
                <div className="px-3 py-1.5 bg-gray-700/50 border-b border-gray-600">
                  <span className="text-white text-xs font-semibold">Options</span>
                </div>
                <label
                  className="lp-checkbox-item flex items-center px-3 py-2 text-sm cursor-pointer text-gray-200"
                  data-testid="menu-motion-checkbox"
                  data-checked={menuMotion}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={`w-4 h-4 rounded border-2 mr-2 flex items-center justify-center ${
                    menuMotion ? "bg-orange-500 border-orange-500" : "border-gray-400"
                  }`} style={{ transition: "all 80ms ease-out" }}>
                    {menuMotion && <span className="text-white text-[10px] font-bold">✓</span>}
                  </div>
                  <input type="checkbox" checked={menuMotion} onChange={(e) => {
                    if (!menuConfirming) {
                      const newMotion = e.target.checked;
                      setMenuMotion(newMotion);
                      // Update pending selection if it exists
                      if (pendingRouteSelection && hoveredRouteType && hoveredRouteStyle) {
                        setPendingRouteSelection({
                          ...pendingRouteSelection,
                          motion: newMotion,
                        });
                      }
                    }
                  }} className="sr-only" />
                  <span className="font-medium text-xs">Motion?</span>
                </label>
                <label
                  className="lp-checkbox-item flex items-center px-3 py-2 text-sm cursor-pointer text-gray-200"
                  data-testid="menu-primary-checkbox"
                  data-checked={menuMakePrimary}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={`w-4 h-4 rounded border-2 mr-2 flex items-center justify-center ${
                    menuMakePrimary ? "bg-orange-500 border-orange-500" : "border-gray-400"
                  }`} style={{ transition: "all 80ms ease-out" }}>
                    {menuMakePrimary && <span className="text-white text-[10px] font-bold">✓</span>}
                  </div>
                  <input type="checkbox" checked={menuMakePrimary} onChange={(e) => {
                    if (!menuConfirming) {
                      const newPrimary = e.target.checked;
                      setMenuMakePrimary(newPrimary);
                      // Update pending selection if it exists
                      if (pendingRouteSelection && hoveredRouteType && hoveredRouteStyle) {
                        setPendingRouteSelection({
                          ...pendingRouteSelection,
                          primary: newPrimary,
                        });
                      }
                    }
                  }} className="sr-only" />
                  <span className="font-medium text-xs">Primary?</span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
