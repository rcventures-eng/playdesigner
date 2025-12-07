import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Copy, Plus, Trash2, Circle as CircleIcon, MoveHorizontal, PenTool, Square as SquareIcon, Type, Hexagon, RotateCcw, Flag, Camera, X, Loader2, Sparkles } from "lucide-react";
import { toPng } from "html-to-image";
import { useToast } from "@/hooks/use-toast";
import underConstructionImage from "@assets/generated_images/under_construction_warning_banner.png";
import { FOOTBALL_CONFIG, FORMATIONS, resolveColorKey, type FormationPlayer } from "../../../shared/football-config";

const CONFIG_FIELD = FOOTBALL_CONFIG.field;
const FIELD = {
  WIDTH: CONFIG_FIELD.width,
  HEIGHT: CONFIG_FIELD.height,
  HEADER_HEIGHT: CONFIG_FIELD.headerHeight,
  SIDE_PADDING: CONFIG_FIELD.sidePadding,
  BOTTOM_PADDING: CONFIG_FIELD.bottomPadding,
  PIXELS_PER_YARD: CONFIG_FIELD.pixelsPerYard,
  LOS_Y: CONFIG_FIELD.losY,
  get FIELD_TOP() { return this.HEADER_HEIGHT; },
  get FIELD_LEFT() { return this.SIDE_PADDING; },
  get FIELD_RIGHT() { return this.WIDTH - this.SIDE_PADDING; },
  get FIELD_WIDTH() { return this.WIDTH - this.SIDE_PADDING * 2; },
  get FIELD_HEIGHT() { return this.HEIGHT - this.HEADER_HEIGHT; },
  getPlayerBounds(activeTab: "offense" | "defense" | "special" | "ai-beta") {
    const isDefense = activeTab === "defense";
    return {
      minX: this.FIELD_LEFT + 12,
      maxX: this.FIELD_RIGHT - 12,
      minY: isDefense ? 12 : this.FIELD_TOP + 12,
      maxY: isDefense ? this.HEIGHT - this.HEADER_HEIGHT - 12 : this.HEIGHT - this.BOTTOM_PADDING - 12,
    };
  },
  getFieldStartY(activeTab: "offense" | "defense" | "special" | "ai-beta") {
    return activeTab === "defense" ? 0 : this.HEADER_HEIGHT;
  },
  getHeaderStartY(activeTab: "offense" | "defense" | "special" | "ai-beta") {
    return activeTab === "defense" ? (this.HEIGHT - this.HEADER_HEIGHT) : 0;
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
  side?: "offense" | "defense";
}

interface Route {
  id: string;
  playerId: string;
  points: { x: number; y: number }[];
  type: "pass" | "run" | "blocking" | "assignment";
  style: "straight" | "curved" | "linear" | "area";
  priority?: number;
  isMotion?: boolean;
  color?: string;
  defensiveAction?: "blitz" | "man" | "zone";
  targetPlayerId?: string;
  shapeType?: "circle" | "oval" | "square" | "rectangle";
}

interface Shape {
  id: string;
  playerId: string;
  type: "circle" | "oval" | "rectangle";
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
  defenseConcept: string;
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
  metadata: { name: string; formation: string; concept: string; defenseConcept: string; personnel: string };
}

interface PlayTypeState {
  players: Player[];
  routes: Route[];
  shapes: Shape[];
  footballs: Football[];
  metadata: PlayMetadata;
  history: HistoryState[];
}

const createEmptyPlayTypeState = (): PlayTypeState => ({
  players: [],
  routes: [],
  shapes: [],
  footballs: [],
  metadata: { name: "", formation: "", concept: "", defenseConcept: "", personnel: "" },
  history: [],
});

// Shared helper to load formations from config
// size: "5v5" | "7v7" | "9v9" | "11v11"
// side: "offense" | "defense" 
// variation: defaults to "spread" for offense, "base" for defense
function loadFormationFromConfig(
  size: "5v5" | "7v7" | "9v9" | "11v11",
  side: "offense" | "defense",
  variation?: string
): Player[] {
  const defaultVariation = side === "offense" ? "spread" : "base";
  const formationData = FORMATIONS[size]?.[side]?.[variation || defaultVariation];
  
  if (!formationData) {
    console.warn(`Formation not found: ${size}/${side}/${variation || defaultVariation}`);
    return [];
  }
  
  const ts = Date.now();
  return formationData.players.map((p: FormationPlayer, index: number) => ({
    id: `player-${ts}-${index + 1}`,
    x: p.x,
    y: p.y,
    color: resolveColorKey(p.colorKey),
    label: p.label,
    side: p.side,
  }));
}

type PlayTypeKey = "offense" | "defense" | "special" | "ai-beta";

export default function PlayDesigner() {
  const [playType, setPlayType] = useState<PlayTypeKey>("offense");
  const [players, setPlayers] = useState<Player[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [footballs, setFootballs] = useState<Football[]>([]);
  const [history, setHistory] = useState<HistoryState[]>([]);
  
  const [playTypeStates, setPlayTypeStates] = useState<Record<PlayTypeKey, PlayTypeState>>({
    offense: createEmptyPlayTypeState(),
    defense: createEmptyPlayTypeState(),
    special: createEmptyPlayTypeState(),
    "ai-beta": createEmptyPlayTypeState(),
  });
  const playTypeStatesRef = useRef<Record<PlayTypeKey, PlayTypeState>>({
    offense: createEmptyPlayTypeState(),
    defense: createEmptyPlayTypeState(),
    special: createEmptyPlayTypeState(),
    "ai-beta": createEmptyPlayTypeState(),
  });
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedShape, setSelectedShape] = useState<string | null>(null);
  const [selectedFootball, setSelectedFootball] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [tool, setTool] = useState<"select" | "player" | "route" | "shape" | "label">("select");
  const [shapeType, setShapeType] = useState<"circle" | "oval" | "rectangle">("circle");
  const [shapeColor, setShapeColor] = useState(FOOTBALL_CONFIG.colors.shapes.pink);
  const [routeType, setRouteType] = useState<"pass" | "run" | "blocking" | "assignment">("pass");
  const [makePrimary, setMakePrimary] = useState(false);
  const [routeStyle, setRouteStyle] = useState<"straight" | "curved" | "linear" | "area">("straight");
  const [isMotion, setIsMotion] = useState(false);
  const [isPlayAction, setIsPlayAction] = useState(false);
  const [showBlocking, setShowBlocking] = useState(true);
  const [includeOffense, setIncludeOffense] = useState(true);
  const [specialPrompt, setSpecialPrompt] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [metadata, setMetadata] = useState<PlayMetadata>({
    name: "",
    formation: "",
    concept: "",
    defenseConcept: "",
    personnel: "",
  });
  const [exportWidth, setExportWidth] = useState(String(FIELD.WIDTH));
  const [exportHeight, setExportHeight] = useState(String(FIELD.HEIGHT));
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);  // Immediate sync ref for dragging state
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });  // Immediate sync ref for drag offset
  const draggingPlayerRef = useRef<string | null>(null);  // Immediate sync ref for which player is being dragged
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [shapeDragOffset, setShapeDragOffset] = useState({ x: 0, y: 0 });
  const [isResizingShape, setIsResizingShape] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<"nw" | "ne" | "sw" | "se" | null>(null);
  const [resizeStartData, setResizeStartData] = useState<{ x: number; y: number; width: number; height: number; startX: number; startY: number } | null>(null);
  const [isDrawingRoute, setIsDrawingRoute] = useState(false);
  const [currentRoutePoints, setCurrentRoutePoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawingShape, setIsDrawingShape] = useState(false);
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [draggingRoutePoint, setDraggingRoutePoint] = useState<{ routeId: string; pointIndex: number } | null>(null);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const editingRouteStartPoints = useRef<{ x: number; y: number }[] | null>(null);
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
  const [hoveredRouteType, setHoveredRouteType] = useState<"pass" | "run" | "blocking" | "assignment" | null>(null);
  const [hoveredRouteStyle, setHoveredRouteStyle] = useState<"straight" | "curved" | "linear" | "area" | null>(null);
  // Only checkbox state remains in React (user clicks)
  const [menuMotion, setMenuMotion] = useState(false);
  const [menuMakePrimary, setMenuMakePrimary] = useState(false);
  const [menuConfirming, setMenuConfirming] = useState(false);
  // Pending route selection - stored when user selects Style, cleared when they click player to confirm
  const [pendingRouteSelection, setPendingRouteSelection] = useState<{
    playerId: string;
    type: "pass" | "run" | "blocking" | "assignment";
    style: "straight" | "curved" | "linear" | "area";
    motion: boolean;
    primary: boolean;
    defensiveAction?: "blitz" | "man" | "zone";
  } | null>(null);
  // Defensive assignment menu state
  const [hoveredDefensiveAction, setHoveredDefensiveAction] = useState<"blitz" | "man" | "zone" | null>(null);
  const [hoveredZoneShape, setHoveredZoneShape] = useState<"circle" | "oval" | "rectangle" | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const fieldContainerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const currentRoutePointsRef = useRef<{ x: number; y: number }[]>([]);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressStartPos = useRef<{ x: number; y: number } | null>(null);
  const currentPointerPos = useRef<{ x: number; y: number } | null>(null);
  // Pending drag intent - drag only starts after long-press is cancelled
  const pendingDragRef = useRef<{ playerId: string; offset: { x: number; y: number } } | null>(null);
  // Suppress the click event that follows a long-press menu opening
  const suppressNextClickRef = useRef(false);
  const { toast } = useToast();

  const { colors: CONFIG_COLORS, labels: CONFIG_LABELS } = FOOTBALL_CONFIG;
  const CONFIG_ROUTES = CONFIG_COLORS.routes;
  const CONFIG_UI = CONFIG_COLORS.ui;
  const CONFIG_SHAPES = CONFIG_COLORS.shapes;
  const offenseColors = [
    CONFIG_COLORS.offense.rb,
    CONFIG_COLORS.offense.receiverZ,
    CONFIG_COLORS.offense.receiverX,
    CONFIG_COLORS.offense.slotY,
    CONFIG_COLORS.offense.qb,
    CONFIG_COLORS.offense.te,
    CONFIG_COLORS.offense.default,
  ];
  const defenseColors = [
    CONFIG_COLORS.defense.linebacker,
    CONFIG_COLORS.defense.lineman,
    CONFIG_COLORS.defense.secondary,
  ];
  const shapeColors = [
    CONFIG_COLORS.shapes.pink,
    CONFIG_COLORS.shapes.blue,
    CONFIG_COLORS.shapes.green,
  ];
  const colors = (playType === "offense" || playType === "special" || playType === "ai-beta") ? offenseColors : defenseColors;
  
  const conceptLabels: Record<string, string> = {
    // Offense concepts
    "outside-run": "Outside Run",
    "inside-run": "Inside Run",
    "short-pass": "Short Pass",
    "medium-pass": "Medium Pass",
    "deep-pass": "Deep Pass",
    "play-action-pass": "Play Action Pass",
    "rpo": "RPO",
    "screen-pass": "Screen Pass",
    "trick": "Trick",
    // Defense concepts
    "man-to-man": "Man-to-Man",
    "zone": "Zone",
    "zone-blitz": "Zone Blitz",
    "blitz": "Blitz",
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
    [CONFIG_COLORS.offense.rb]: { x: centerX, y: FIELD.LOS_Y + 6 * FIELD.PIXELS_PER_YARD },  // Green - Running back (center, 6 yards back)
    [CONFIG_COLORS.offense.receiverZ]: { x: FIELD.FIELD_LEFT + 50, y: FIELD.LOS_Y },   // Blue (Z) - Split end (far left on line)
    [CONFIG_COLORS.offense.receiverX]: { x: FIELD.FIELD_RIGHT - 50, y: FIELD.LOS_Y },  // Red (X) - Right receiver (far right on line)
    [CONFIG_COLORS.offense.slotY]: { x: centerX - (3 * (PLAYER_SIZE + GAP_SIZE)), y: FIELD.LOS_Y },  // Yellow (Y) - Slot -3 (left of LT)
    [CONFIG_COLORS.offense.qb]: { x: centerX, y: FIELD.LOS_Y + PLAYER_SIZE + 5 },  // Black (QB) - Behind Center with 5px gap
    [CONFIG_COLORS.offense.te]: { x: centerX + (3 * (PLAYER_SIZE + GAP_SIZE)), y: FIELD.LOS_Y },  // Orange (TE) - Slot +3 (right of RT)
    [CONFIG_COLORS.offense.default]: { x: centerX, y: FIELD.LOS_Y },  // Gray - default (will be overridden by sequence)
  };
  
  // Generate gray positions using the center-out formula
  // x = centerX + (offset * (PLAYER_SIZE + GAP_SIZE))
  const grayPositions = FILL_ORDER.map(offset => ({
    x: centerX + (offset * (PLAYER_SIZE + GAP_SIZE)),
    y: FIELD.LOS_Y
  }));

  const colorLabels: Record<string, string> = CONFIG_LABELS.offense;
  const defenseColorLabels: Record<string, string> = CONFIG_LABELS.defense;

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

  const handlePlayTypeChange = (newPlayType: PlayTypeKey) => {
    if (newPlayType === playType) return;
    
    const currentState: PlayTypeState = {
      players: JSON.parse(JSON.stringify(players)),
      routes: JSON.parse(JSON.stringify(routes)),
      shapes: JSON.parse(JSON.stringify(shapes)),
      footballs: JSON.parse(JSON.stringify(footballs)),
      metadata: JSON.parse(JSON.stringify(metadata)),
      history: JSON.parse(JSON.stringify(history)),
    };
    
    playTypeStatesRef.current = {
      ...playTypeStatesRef.current,
      [playType]: currentState
    };
    
    const targetState = playTypeStatesRef.current[newPlayType];
    
    setPlayTypeStates(playTypeStatesRef.current);
    
    setPlayers(JSON.parse(JSON.stringify(targetState.players)));
    setRoutes(JSON.parse(JSON.stringify(targetState.routes)));
    setShapes(JSON.parse(JSON.stringify(targetState.shapes)));
    setFootballs(JSON.parse(JSON.stringify(targetState.footballs)));
    setMetadata(JSON.parse(JSON.stringify(targetState.metadata)));
    setHistory(JSON.parse(JSON.stringify(targetState.history)));
    
    setSelectedPlayer(null);
    setSelectedRoute(null);
    setSelectedShape(null);
    setSelectedFootball(null);
    setSelectedElements({ players: [], routes: [] });
    setTool("select");
    
    setPlayType(newPlayType);
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
    isDraggingRef.current = false;
    setIsDragging(false);
    setDraggingRoutePoint(null);
  }, [tool]);

  // Responsive scaling: measure container and calculate scale factor
  useEffect(() => {
    const calculateScale = () => {
      if (!fieldContainerRef.current) return;
      const container = fieldContainerRef.current;
      const availableWidth = container.clientWidth - 40; // 20px margin on each side
      const availableHeight = container.clientHeight - 40;
      
      const scaleX = availableWidth / FIELD.WIDTH;
      const scaleY = availableHeight / FIELD.HEIGHT;
      const newScale = Math.max(0.4, Math.min(scaleX, scaleY, 1)); // Clamp between 0.4 and 1
      
      setScale(newScale);
    };
    
    calculateScale();
    
    const resizeObserver = new ResizeObserver(calculateScale);
    if (fieldContainerRef.current) {
      resizeObserver.observe(fieldContainerRef.current);
    }
    
    window.addEventListener("resize", calculateScale);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", calculateScale);
    };
  }, []);

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

  // Handle click-outside to close long-press menu and cancel long-press on window pointerup
  useEffect(() => {
    const handleWindowPointerUp = () => {
      cancelLongPress();
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      // Suppress the click event that follows a long-press menu opening
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        return;
      }
      
      // Don't close during confirmation dwell
      if (menuConfirming) return;
      
      const target = e.target as HTMLElement;
      if (longPressMenuOpen && !target.closest('[data-testid="long-press-menu"]')) {
        closeLongPressMenu();
      }
    };
    
    window.addEventListener("pointerup", handleWindowPointerUp);
    document.addEventListener("click", handleClickOutside);
    
    return () => {
      window.removeEventListener("pointerup", handleWindowPointerUp);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [longPressMenuOpen, menuConfirming]);

  // Dynamic QB positioning based on Formation field (Shotgun/Pistol = deeper, otherwise under center)
  // Only applies to offense - defense formations don't affect QB positioning
  useEffect(() => {
    if (playType !== "offense") return;
    
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
  }, [metadata.formation, playType]);

  // Dynamic linking: Keep Man coverage routes synced with target player positions
  // This effect runs whenever players change and updates route endpoints accordingly
  // We use functional update to access current routes without causing infinite loops
  useEffect(() => {
    setRoutes(currentRoutes => {
      // Find all Man coverage routes with target players
      const manRoutes = currentRoutes.filter(r => 
        r.type === "assignment" && r.defensiveAction === "man" && r.targetPlayerId
      );
      
      if (manRoutes.length === 0) return currentRoutes;
      
      let hasUpdates = false;
      const updatedRoutes = currentRoutes.map(route => {
        if (route.type === "assignment" && route.defensiveAction === "man" && route.targetPlayerId) {
          // Find the target player's current position
          const targetPlayer = players.find(p => p.id === route.targetPlayerId);
          // Find the defender player (route owner)
          const defender = players.find(p => p.id === route.playerId);
          
          if (targetPlayer && defender && route.points.length >= 2) {
            const currentEndpoint = route.points[route.points.length - 1];
            const currentStart = route.points[0];
            
            // Check if endpoint or start needs updating
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
      
      // Only return new array if there were actual updates
      return hasUpdates ? updatedRoutes : currentRoutes;
    });
  }, [players]);

  const addPlayer = (color: string) => {
    saveToHistory();
    
    let position: { x: number; y: number };
    let label: string | undefined;
    
    // For gray players on offense or AI Beta, use sequential positions and labels based on how many exist
    const isOffensiveTab = playType === "offense" || playType === "ai-beta";
    if (isOffensiveTab && color === CONFIG_COLORS.offense.default) {
      const existingGrayCount = players.filter(p => p.color === CONFIG_COLORS.offense.default).length;
      const positionIndex = existingGrayCount % grayPositions.length;
      position = grayPositions[positionIndex];
      // Assign sequential label: C, LG, RG, LT, RT, then OL for any extras
      label = existingGrayCount < grayLabels.length ? grayLabels[existingGrayCount] : "OL";
    } else {
      // Use preset position for other offense/AI Beta players, default to center for defense
      position = isOffensiveTab && offensePositions[color] 
        ? offensePositions[color] 
        : { x: FIELD.WIDTH / 2, y: FIELD.LOS_Y };
      // Assign color-based label for offense/AI Beta or defense
      if (isOffensiveTab && colorLabels[color]) {
        label = colorLabels[color];
      } else if (playType === "defense" && defenseColorLabels[color]) {
        label = defenseColorLabels[color];
      }
    }
    
    const newPlayer: Player = {
      id: `player-${Date.now()}`,
      x: position.x,
      y: position.y,
      color,
      label,
      side: playType === "defense" ? "defense" : "offense",
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
    setMetadata({ name: "", formation: "", concept: "", defenseConcept: "", personnel: "" });
    setSelectedPlayer(null);
    setSelectedRoute(null);
    setSelectedShape(null);
    setSelectedFootball(null);
    setSelectedElements({ players: [], routes: [] });
    // Note: Don't reset includeOffense here - preserve checkbox state across clear
  };

  // Offense formation generators - now use shared config
  const generate5v5Formation = (): Player[] => loadFormationFromConfig("5v5", "offense");
  const generate7v7Formation = (): Player[] => loadFormationFromConfig("7v7", "offense");
  const generate9v9Formation = (): Player[] => loadFormationFromConfig("9v9", "offense");
  const generate11v11Formation = (): Player[] => loadFormationFromConfig("11v11", "offense");

  const handleLoad5v5 = () => {
    if (players.length > 0 || routes.length > 0 || shapes.length > 0 || footballs.length > 0) {
      saveToHistory();
    }
    setPlayers(generate5v5Formation());
    setRoutes([]);
    setShapes([]);
    setFootballs([]);
    setMetadata(prev => ({ ...prev, name: "", formation: "", concept: "", personnel: "" }));
    setSelectedPlayer(null);
    setSelectedRoute(null);
    setSelectedShape(null);
    setSelectedFootball(null);
    setSelectedElements({ players: [], routes: [] });
    setTool("select");
  };

  const handleLoad7v7 = () => {
    if (players.length > 0 || routes.length > 0 || shapes.length > 0 || footballs.length > 0) {
      saveToHistory();
    }
    setPlayers(generate7v7Formation());
    setRoutes([]);
    setShapes([]);
    setFootballs([]);
    setMetadata(prev => ({ ...prev, name: "", formation: "", concept: "", personnel: "" }));
    setSelectedPlayer(null);
    setSelectedRoute(null);
    setSelectedShape(null);
    setSelectedFootball(null);
    setSelectedElements({ players: [], routes: [] });
    setTool("select");
  };

  const handleLoad9v9 = () => {
    if (players.length > 0 || routes.length > 0 || shapes.length > 0 || footballs.length > 0) {
      saveToHistory();
    }
    setPlayers(generate9v9Formation());
    setRoutes([]);
    setShapes([]);
    setFootballs([]);
    setMetadata(prev => ({ ...prev, name: "", formation: "", concept: "", personnel: "" }));
    setSelectedPlayer(null);
    setSelectedRoute(null);
    setSelectedShape(null);
    setSelectedFootball(null);
    setSelectedElements({ players: [], routes: [] });
    setTool("select");
  };

  const handleLoad11v11 = () => {
    if (players.length > 0 || routes.length > 0 || shapes.length > 0 || footballs.length > 0) {
      saveToHistory();
    }
    setPlayers(generate11v11Formation());
    setRoutes([]);
    setShapes([]);
    setFootballs([]);
    setMetadata(prev => ({ ...prev, name: "", formation: "", concept: "", personnel: "" }));
    setSelectedPlayer(null);
    setSelectedRoute(null);
    setSelectedShape(null);
    setSelectedFootball(null);
    setSelectedElements({ players: [], routes: [] });
    setTool("select");
  };

  // Defense formation generators - now use shared config
  const generateDefense5v5Formation = (): Player[] => loadFormationFromConfig("5v5", "defense");
  const generateDefense7v7Formation = (): Player[] => loadFormationFromConfig("7v7", "defense");
  const generateDefense9v9Formation = (): Player[] => loadFormationFromConfig("9v9", "defense");
  const generateDefense11v11Formation = (): Player[] => loadFormationFromConfig("11v11", "defense");

  // Offense formations for Defense tab - RB positioned beside QB on the right (fits within defense layout bounds)
  const generateOffense5v5ForDefenseTab = (): Player[] => {
    const ts = Date.now();
    return [
      { id: `player-${ts}-o1`, x: centerX, y: FIELD.LOS_Y + PLAYER_SIZE + 4, color: CONFIG_COLORS.offense.qb, label: "QB", side: "offense" as const },
      { id: `player-${ts}-o2`, x: centerX + (2 * SPACING_UNIT), y: FIELD.LOS_Y + PLAYER_SIZE + 4, color: CONFIG_COLORS.offense.rb, label: "RB", side: "offense" as const },
      { id: `player-${ts}-o3`, x: centerX - (2 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.slotY, label: "Y", side: "offense" as const },
      { id: `player-${ts}-o4`, x: centerX - (6 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.receiverZ, label: "Z", side: "offense" as const },
      { id: `player-${ts}-o5`, x: centerX + (6 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.receiverX, label: "X", side: "offense" as const },
    ];
  };

  const generateOffense7v7ForDefenseTab = (): Player[] => {
    const ts = Date.now();
    return [
      { id: `player-${ts}-o1`, x: centerX, y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.default, label: "C", side: "offense" as const },
      { id: `player-${ts}-o2`, x: centerX, y: FIELD.LOS_Y + PLAYER_SIZE + 4, color: CONFIG_COLORS.offense.qb, label: "QB", side: "offense" as const },
      { id: `player-${ts}-o3`, x: centerX + (2 * SPACING_UNIT), y: FIELD.LOS_Y + PLAYER_SIZE + 4, color: CONFIG_COLORS.offense.rb, label: "RB", side: "offense" as const },
      { id: `player-${ts}-o4`, x: centerX - (2.5 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.slotY, label: "Y", side: "offense" as const },
      { id: `player-${ts}-o5`, x: centerX + (2.5 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.te, label: "TE", side: "offense" as const },
      { id: `player-${ts}-o6`, x: centerX - (6.5 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.receiverZ, label: "Z", side: "offense" as const },
      { id: `player-${ts}-o7`, x: centerX + (6.5 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.receiverX, label: "X", side: "offense" as const },
    ];
  };

  const generateOffense9v9ForDefenseTab = (): Player[] => {
    const ts = Date.now();
    return [
      // Interior Line (3 Gray)
      { id: `player-${ts}-o1`, x: centerX, y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.default, label: "C", side: "offense" as const },
      { id: `player-${ts}-o2`, x: centerX - (1 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.default, label: "LG", side: "offense" as const },
      { id: `player-${ts}-o3`, x: centerX + (1 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.default, label: "RG", side: "offense" as const },
      // Ends
      { id: `player-${ts}-o4`, x: centerX - (3 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.slotY, label: "Y", side: "offense" as const },
      { id: `player-${ts}-o5`, x: centerX + (3 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.te, label: "TE", side: "offense" as const },
      // Wideouts
      { id: `player-${ts}-o6`, x: centerX - (7 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.receiverZ, label: "Z", side: "offense" as const },
      { id: `player-${ts}-o7`, x: centerX + (7 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.receiverX, label: "X", side: "offense" as const },
      // Backfield - RB beside QB on right
      { id: `player-${ts}-o8`, x: centerX, y: FIELD.LOS_Y + PLAYER_SIZE + 4, color: CONFIG_COLORS.offense.qb, label: "QB", side: "offense" as const },
      { id: `player-${ts}-o9`, x: centerX + (2 * SPACING_UNIT), y: FIELD.LOS_Y + PLAYER_SIZE + 4, color: CONFIG_COLORS.offense.rb, label: "RB", side: "offense" as const },
    ];
  };

  const generateOffense11v11ForDefenseTab = (): Player[] => {
    const ts = Date.now();
    return [
      // Offensive Line (5 Gray)
      { id: `player-${ts}-o1`, x: centerX, y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.default, label: "C", side: "offense" as const },
      { id: `player-${ts}-o2`, x: centerX - (1 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.default, label: "LG", side: "offense" as const },
      { id: `player-${ts}-o3`, x: centerX + (1 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.default, label: "RG", side: "offense" as const },
      { id: `player-${ts}-o4`, x: centerX - (2 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.default, label: "LT", side: "offense" as const },
      { id: `player-${ts}-o5`, x: centerX + (2 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.default, label: "RT", side: "offense" as const },
      // Tight Ends / Slots
      { id: `player-${ts}-o6`, x: centerX - (3 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.slotY, label: "Y", side: "offense" as const },
      { id: `player-${ts}-o7`, x: centerX + (3 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.te, label: "TE", side: "offense" as const },
      // Wideouts
      { id: `player-${ts}-o8`, x: centerX - (7 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.receiverZ, label: "Z", side: "offense" as const },
      { id: `player-${ts}-o9`, x: centerX + (7 * SPACING_UNIT), y: FIELD.LOS_Y, color: CONFIG_COLORS.offense.receiverX, label: "X", side: "offense" as const },
      // Backfield - RB beside QB on right
      { id: `player-${ts}-o10`, x: centerX, y: FIELD.LOS_Y + PLAYER_SIZE + 4, color: CONFIG_COLORS.offense.qb, label: "QB", side: "offense" as const },
      { id: `player-${ts}-o11`, x: centerX + (2 * SPACING_UNIT), y: FIELD.LOS_Y + PLAYER_SIZE + 4, color: CONFIG_COLORS.offense.rb, label: "RB", side: "offense" as const },
    ];
  };

  // Helper to clamp player positions to current tab bounds
  const clampPlayersToCurrentBounds = (playerList: Player[], activeTab: PlayTypeKey): Player[] => {
    const bounds = FIELD.getPlayerBounds(activeTab);
    return playerList.map(p => ({
      ...p,
      x: Math.max(bounds.minX, Math.min(bounds.maxX, p.x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, p.y)),
    }));
  };

  const loadDefensePreset = (format: string, withOffense: boolean) => {
    if (players.length > 0 || routes.length > 0 || shapes.length > 0 || footballs.length > 0) {
      saveToHistory();
    }
    
    let defensePlayers: Player[] = [];
    let offensePlayers: Player[] = [];
    
    switch (format) {
      case "5v5":
        defensePlayers = generateDefense5v5Formation();
        if (withOffense) offensePlayers = generateOffense5v5ForDefenseTab();
        break;
      case "7v7":
        defensePlayers = generateDefense7v7Formation();
        if (withOffense) offensePlayers = generateOffense7v7ForDefenseTab();
        break;
      case "9v9":
        defensePlayers = generateDefense9v9Formation();
        if (withOffense) offensePlayers = generateOffense9v9ForDefenseTab();
        break;
      case "11v11":
        defensePlayers = generateDefense11v11Formation();
        if (withOffense) offensePlayers = generateOffense11v11ForDefenseTab();
        break;
      default:
        defensePlayers = [];
    }
    
    // Clamp all players to defense tab bounds (ensures offensive players fit in smaller field area)
    const allPlayers = withOffense ? [...defensePlayers, ...offensePlayers] : defensePlayers;
    const newPlayers = clampPlayersToCurrentBounds(allPlayers, "defense");
    const newRoutes: Route[] = [];
    const newShapes: Shape[] = [];
    const newFootballs: Football[] = [];
    const newMetadata = { ...metadata, name: "", formation: "", personnel: "" };
    
    setPlayers(newPlayers);
    setRoutes(newRoutes);
    setShapes(newShapes);
    setFootballs(newFootballs);
    setMetadata(newMetadata);
    setSelectedPlayer(null);
    setSelectedRoute(null);
    setSelectedShape(null);
    setSelectedFootball(null);
    setSelectedElements({ players: [], routes: [] });
    setTool("select");
    
    playTypeStatesRef.current = {
      ...playTypeStatesRef.current,
      defense: {
        players: newPlayers,
        routes: newRoutes,
        shapes: newShapes,
        footballs: newFootballs,
        metadata: newMetadata,
        history: [],
      }
    };
    setPlayTypeStates(playTypeStatesRef.current);
    
    console.log(`Defense ${format} preset loaded${withOffense ? ' with offense' : ''}`);
  };

  const handleGameFormatClick = (format: "5v5" | "7v7" | "9v9" | "11v11") => {
    if (playType === "defense") {
      loadDefensePreset(format, includeOffense);
    } else {
      switch (format) {
        case "5v5": handleLoad5v5(); break;
        case "7v7": handleLoad7v7(); break;
        case "9v9": handleLoad9v9(); break;
        case "11v11": handleLoad11v11(); break;
      }
    }
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

  // Helper: Find QB position (for Blitz auto-targeting)
  const getQBPosition = (): { x: number; y: number } => {
    const qb = players.find(p => p.label === "QB");
    if (qb) return { x: qb.x, y: qb.y };
    // Default QB position (center, behind LOS)
    return { x: centerX, y: FIELD.LOS_Y + 30 };
  };

  // Helper: Find nearest unclaimed offensive player (for Man coverage)
  const getNearestUnclaimedOffensivePlayer = (defenderPos: { x: number; y: number }): Player | null => {
    const offensivePlayers = players.filter(p => p.side === "offense" || !p.side);
    // Find players already claimed by Man coverage
    const claimedPlayerIds = routes
      .filter(r => r.type === "assignment" && r.defensiveAction === "man" && r.targetPlayerId)
      .map(r => r.targetPlayerId);
    
    const unclaimedPlayers = offensivePlayers.filter(p => !claimedPlayerIds.includes(p.id));
    if (unclaimedPlayers.length === 0) return offensivePlayers[0] || null;
    
    // Find nearest unclaimed player
    let nearest = unclaimedPlayers[0];
    let minDist = Infinity;
    for (const p of unclaimedPlayers) {
      const dist = Math.sqrt(Math.pow(p.x - defenderPos.x, 2) + Math.pow(p.y - defenderPos.y, 2));
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    }
    return nearest;
  };

  const handlePlayerPointerDown = (e: React.PointerEvent, playerId: string) => {
    // Check if there's a pending route selection waiting for confirmation
    if (pendingRouteSelection && pendingRouteSelection.playerId === playerId) {
      e.stopPropagation();
      const player = players.find(p => p.id === playerId);
      if (player) {
        // Handle defensive assignments (Blitz/Man)
        if (pendingRouteSelection.type === "assignment" && pendingRouteSelection.defensiveAction) {
          const action = pendingRouteSelection.defensiveAction;
          
          if (action === "blitz") {
            // Blitz: Auto-draw line to QB position
            const qbPos = getQBPosition();
            const newRoute: Route = {
              id: `route-${Date.now()}`,
              playerId: playerId,
              points: [{ x: player.x, y: player.y }, qbPos],
              type: "assignment",
              style: pendingRouteSelection.style,
              defensiveAction: "blitz",
              color: CONFIG_COLORS.offense.receiverX,
            };
            saveToHistory();
            setRoutes([...routes, newRoute]);
            setPendingRouteSelection(null);
            return;
          }
          
          if (action === "man") {
            // Man: Auto-snap to nearest unclaimed offensive player
            const targetPlayer = getNearestUnclaimedOffensivePlayer({ x: player.x, y: player.y });
            if (targetPlayer) {
              const newRoute: Route = {
                id: `route-${Date.now()}`,
                playerId: playerId,
                points: [{ x: player.x, y: player.y }, { x: targetPlayer.x, y: targetPlayer.y }],
                type: "assignment",
                style: pendingRouteSelection.style,
                defensiveAction: "man",
                targetPlayerId: targetPlayer.id,
                color: CONFIG_ROUTES.man,
              };
              saveToHistory();
              setRoutes([...routes, newRoute]);
              setPendingRouteSelection(null);
              return;
            }
          }
        }
        
        // Standard offensive route handling
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
              x: (e.clientX - rect.left) / scale - player.x,
              y: (e.clientY - rect.top) / scale - player.y,
            }
          };
        }
        
        // Start long-press with IMMEDIATE visual feedback (80ms ring appears)
        setLongPressPlayerRef(playerId);
        longPressStartPos.current = { x: e.clientX, y: e.clientY };
        currentPointerPos.current = { x: e.clientX, y: e.clientY };
        // Show holding state immediately for instant feedback
        requestAnimationFrame(() => setIsLongPressHolding(true));
        
        longPressTimerRef.current = setTimeout(() => {
          // Before opening menu, check if user has started dragging
          // If pendingDragRef has been used to activate dragging, don't open menu
          if (isDraggingRef.current) {
            return; // Drag already started, don't open menu
          }
          
          // Also check if pointer has moved significantly since pointerdown
          // This catches cases where pointermove hasn't fired cancelLongPress yet
          if (longPressStartPos.current && currentPointerPos.current) {
            const dx = currentPointerPos.current.x - longPressStartPos.current.x;
            const dy = currentPointerPos.current.y - longPressStartPos.current.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 8) {
              // User moved - treat as drag, not long-press
              cancelLongPress();
              return;
            }
          }
          
          // Long press detected - open menu anchored under player center
          setIsLongPressHolding(false);
          setLongPressPlayerId(playerId);
          pendingDragRef.current = null; // Clear drag intent - menu wins
          
          // Calculate menu position with max width clamping
          // Menu is positioned in screen coordinates, so multiply logical player position by scale
          const rect = canvasRef.current?.getBoundingClientRect();
          const maxMenuWidth = 380; // Max expanded width
          if (rect) {
            const menuX = rect.left + player.x * scale;
            const menuY = rect.top + player.y * scale + 16;
            const clampedX = Math.max(8, Math.min(menuX, window.innerWidth - maxMenuWidth - 10));
            setLongPressMenuPosition({ x: clampedX, y: menuY });
          } else {
            setLongPressMenuPosition({ x: e.clientX, y: e.clientY + 20 });
          }
          
          setLongPressMenuOpen(true);
          // Suppress the click event that will follow the pointer release
          suppressNextClickRef.current = true;
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
      isDraggingRef.current = true;  // Immediately sync for same-event access
      setIsDragging(true);
      dragOffsetRef.current = pendingDragRef.current.offset;  // Immediately sync for same-event access
      setDragOffset(pendingDragRef.current.offset);
      draggingPlayerRef.current = pendingDragRef.current.playerId;  // Track which player is being dragged
      pendingDragRef.current = null;
    }
    setLongPressPlayerRef(null);
    setIsLongPressHolding(false);
    longPressStartPos.current = null;
    currentPointerPos.current = null;
  };
  
  const closeLongPressMenu = () => {
    setLongPressMenuOpen(false);
    setLongPressPlayerId(null);
    setHoveredRouteType(null);
    setHoveredRouteStyle(null);
    setHoveredDefensiveAction(null);
    setHoveredZoneShape(null);
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
      isDraggingRef.current = true;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const offset = {
          x: (e.clientX - rect.left) / scale - football.x,
          y: (e.clientY - rect.top) / scale - football.y,
        };
        dragOffsetRef.current = offset;
        setDragOffset(offset);
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
    // Always track current pointer position for long-press timer check
    currentPointerPos.current = { x: e.clientX, y: e.clientY };
    
    // Cancel long-press if mouse moves more than 8 pixels (prevents menu opening during drag)
    if (longPressStartPos.current && longPressTimerRef.current) {
      const dx = e.clientX - longPressStartPos.current.x;
      const dy = e.clientY - longPressStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 8) {
        cancelLongPress();
      }
    }
    
    const bounds = FIELD.getPlayerBounds(playType);
    // Use refs for immediate access (state may not be updated yet in same event)
    // Check draggingPlayerRef first as it's set synchronously in cancelLongPress
    const dragPlayerIdRef = draggingPlayerRef.current;
    const dragPlayerId = dragPlayerIdRef || selectedPlayer;
    if ((isDragging || isDraggingRef.current) && dragPlayerId && tool === "select") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        // Get current player position before updating
        const currentPlayer = players.find(p => p.id === dragPlayerId);
        // Use dragOffsetRef for immediate access (state may not be updated yet after cancelLongPress)
        const offset = dragOffsetRef.current;
        const newX = Math.max(bounds.minX, Math.min(bounds.maxX, (e.clientX - rect.left) / scale - offset.x));
        const newY = Math.max(bounds.minY, Math.min(bounds.maxY, (e.clientY - rect.top) / scale - offset.y));
        
        // Calculate movement delta for route shifting
        const deltaX = currentPlayer ? newX - currentPlayer.x : 0;
        const deltaY = currentPlayer ? newY - currentPlayer.y : 0;
        
        setPlayers(players.map(p =>
          p.id === dragPlayerId ? { ...p, x: newX, y: newY } : p
        ));
        
        // Update routes when player moves
        setRoutes(prevRoutes => {
          let hasUpdates = false;
          const updatedRoutes = prevRoutes.map(r => {
            // Shift entire route when the route's owner player is moved (non-assignment routes)
            if (r.playerId === dragPlayerId && r.type !== "assignment") {
              if (deltaX !== 0 || deltaY !== 0) {
                hasUpdates = true;
                const shiftedPoints = r.points.map(p => ({
                  x: p.x + deltaX,
                  y: p.y + deltaY
                }));
                return { ...r, points: shiftedPoints };
              }
            }
            // Update Man coverage endpoint when target player is moved
            if (r.type === "assignment" && r.defensiveAction === "man" && r.targetPlayerId === dragPlayerId) {
              hasUpdates = true;
              const updatedPoints = [...r.points];
              if (updatedPoints.length >= 2) {
                updatedPoints[updatedPoints.length - 1] = { x: newX, y: newY };
              }
              return { ...r, points: updatedPoints };
            }
            // Update route start point when the defensive player is moved
            if (r.type === "assignment" && r.playerId === dragPlayerId) {
              hasUpdates = true;
              const updatedPoints = [...r.points];
              if (updatedPoints.length >= 1) {
                updatedPoints[0] = { x: newX, y: newY };
              }
              return { ...r, points: updatedPoints };
            }
            return r;
          });
          return hasUpdates ? updatedRoutes : prevRoutes;
        });
      }
    }
    
    // Handle football dragging
    if ((isDragging || isDraggingRef.current) && selectedFootball && tool === "select") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const offset = dragOffsetRef.current;
        const newX = (e.clientX - rect.left) / scale - offset.x;
        const newY = (e.clientY - rect.top) / scale - offset.y;
        setFootballs(footballs.map(f =>
          f.id === selectedFootball ? { 
            ...f,
            x: Math.max(bounds.minX, Math.min(bounds.maxX, newX)), 
            y: Math.max(bounds.minY, Math.min(bounds.maxY, newY)) 
          } : f
        ));
      }
    }
    
    // Handle zone shape resizing (check before dragging to prevent conflicts)
    if (isResizingShape && selectedShape && resizeHandle && resizeStartData && tool === "select") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const currentX = (e.clientX - rect.left) / scale;
        const currentY = (e.clientY - rect.top) / scale;
        const deltaX = currentX - resizeStartData.startX;
        const deltaY = currentY - resizeStartData.startY;
        
        let newX = resizeStartData.x;
        let newY = resizeStartData.y;
        let newWidth = resizeStartData.width;
        let newHeight = resizeStartData.height;
        
        const MIN_SIZE = 20;
        const maxRight = FIELD.FIELD_RIGHT;
        const maxBottom = FIELD.HEIGHT - FIELD.BOTTOM_PADDING;
        
        // Apply delta based on which handle is being dragged
        switch (resizeHandle) {
          case "nw":
            newX = resizeStartData.x + deltaX;
            newY = resizeStartData.y + deltaY;
            newWidth = resizeStartData.width - deltaX;
            newHeight = resizeStartData.height - deltaY;
            break;
          case "ne":
            newY = resizeStartData.y + deltaY;
            newWidth = resizeStartData.width + deltaX;
            newHeight = resizeStartData.height - deltaY;
            break;
          case "sw":
            newX = resizeStartData.x + deltaX;
            newWidth = resizeStartData.width - deltaX;
            newHeight = resizeStartData.height + deltaY;
            break;
          case "se":
            newWidth = resizeStartData.width + deltaX;
            newHeight = resizeStartData.height + deltaY;
            break;
        }
        
        // Enforce minimum size
        if (newWidth < MIN_SIZE) {
          if (resizeHandle === "nw" || resizeHandle === "sw") {
            newX = resizeStartData.x + resizeStartData.width - MIN_SIZE;
          }
          newWidth = MIN_SIZE;
        }
        if (newHeight < MIN_SIZE) {
          if (resizeHandle === "nw" || resizeHandle === "ne") {
            newY = resizeStartData.y + resizeStartData.height - MIN_SIZE;
          }
          newHeight = MIN_SIZE;
        }
        
        // Keep position within field bounds (use dynamic bounds for Defense tab)
        const shapeBounds = FIELD.getPlayerBounds(playType);
        newX = Math.max(FIELD.FIELD_LEFT, newX);
        newY = Math.max(shapeBounds.minY - 12, newY);
        
        // Clamp width and height so shape stays within field
        newWidth = Math.min(newWidth, maxRight - newX);
        newHeight = Math.min(newHeight, maxBottom - newY);
        
        // Re-enforce minimum size after clamping
        newWidth = Math.max(MIN_SIZE, newWidth);
        newHeight = Math.max(MIN_SIZE, newHeight);
        
        // Use functional update to avoid stale closure
        setShapes(prev => prev.map(s =>
          s.id === selectedShape ? { ...s, x: newX, y: newY, width: newWidth, height: newHeight } : s
        ));
      }
      return; // Early return to prevent drag logic from running
    }
    
    // Handle zone shape dragging (only if not resizing)
    if (isDraggingShape && selectedShape && tool === "select") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        // Use functional update to get current shape state
        setShapes(prev => {
          const shape = prev.find(s => s.id === selectedShape);
          if (!shape) return prev;
          
          const newX = (e.clientX - rect.left) / scale - shapeDragOffset.x;
          const newY = (e.clientY - rect.top) / scale - shapeDragOffset.y;
          // Keep shape within field bounds (use dynamic bounds for Defense tab)
          const shapeBounds = FIELD.getPlayerBounds(playType);
          const boundedX = Math.max(FIELD.FIELD_LEFT, Math.min(FIELD.FIELD_RIGHT - shape.width, newX));
          const boundedY = Math.max(shapeBounds.minY - 12, Math.min(shapeBounds.maxY + 12 - shape.height, newY));
          
          return prev.map(s =>
            s.id === selectedShape ? { ...s, x: boundedX, y: boundedY } : s
          );
        });
      }
    }
    
    if (tool === "route" && isDraggingStraightRoute && isDrawingRoute && currentRoutePointsRef.current.length >= 1) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
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
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        
        // First point (index 0) stays attached to player - skip updating it
        if (draggingRoutePoint.pointIndex === 0) {
          return;
        }
        
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
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
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
      isDraggingRef.current = false;
      dragOffsetRef.current = { x: 0, y: 0 };
      draggingPlayerRef.current = null;
      setIsDragging(false);
      setDraggingRoutePoint(null);
      setIsDraggingShape(false);
      setIsResizingShape(false);
      setResizeHandle(null);
      setResizeStartData(null);
      return;
    }
    
    isDraggingRef.current = false;
    dragOffsetRef.current = { x: 0, y: 0 };
    draggingPlayerRef.current = null;
    setIsDragging(false);
    setDraggingRoutePoint(null);
    setIsDraggingShape(false);
    setIsResizingShape(false);
    setResizeHandle(null);
    setResizeStartData(null);
    
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
    
    // Exit route edit mode when clicking on canvas background
    if (editingRouteId) {
      const targetEl = e.target as HTMLElement;
      // Only exit if not clicking on a route or route handle
      if (!targetEl.closest('[data-route-id]') && !targetEl.closest('[data-route-handle]')) {
        setEditingRouteId(null);
        editingRouteStartPoints.current = null;
      }
    }
    
    if (tool === "select") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
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
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
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
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        const width = Math.abs(x - shapeStart.x);
        const height = Math.abs(y - shapeStart.y);
        
        if (width > 20 && height > 20) {
          saveToHistory();
          const newShape: Shape = {
            id: `shape-${Date.now()}`,
            playerId: selectedPlayer || "",
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
      const playerColor = player?.color || CONFIG_ROUTES.run;
      
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Clear any existing preview before starting new upload
    if (uploadedImage) {
      setUploadedImage(null);
    }
    
    // Show upload state
    setIsUploading(true);
    
    // Convert file to base64 for preview and API
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      // Store base64 for later use with API
      setUploadedImage(base64);
      setIsUploading(false);
    };
    reader.onerror = () => {
      toast({
        title: "Upload failed",
        description: "Could not read the image file",
        variant: "destructive",
      });
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
    
    // Reset file input so same file can be selected again
    e.target.value = "";
  };
  
  const handleImageGenerate = () => {
    if (!uploadedImage) return;
    handleGeneratePlay(uploadedImage);
  };

  const dismissUploadedImage = () => {
    setUploadedImage(null);
  };

  const handleGeneratePlay = async (imageBase64?: string) => {
    if (!specialPrompt.trim() && !imageBase64) {
      toast({
        title: "Missing input",
        description: "Please enter a play description or upload an image",
        variant: "destructive",
      });
      return;
    }

    // Save current state to history so user can undo the AI generation
    // Always save, even if canvas is empty, so users can undo back to empty state
    saveToHistory();

    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate-play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: specialPrompt.trim() || undefined,
          image: imageBase64 || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate play");
      }

      const playData = await response.json();
      
      // Debug: Log AI response to verify mechanics flags
      console.log("AI Play Response:", playData);
      console.log("Mechanics flags:", playData.mechanics);

      // Validate and apply the generated players
      if (playData.players && Array.isArray(playData.players)) {
        const validPlayers = playData.players.map((p: any) => ({
          id: p.id || `player-${Date.now()}-${Math.random()}`,
          x: Math.max(FIELD.SIDE_PADDING, Math.min(FIELD.WIDTH - FIELD.SIDE_PADDING, p.x || 347)),
          y: Math.max(72, Math.min(368, p.y || 300)),
          color: p.color || CONFIG_COLORS.offense.rb,
          label: p.label || "WR",
          side: p.side || "offense",
        }));
        setPlayers(validPlayers);
      }

      // Validate and apply the generated routes
      if (playData.routes && Array.isArray(playData.routes)) {
        const validRoutes = playData.routes.map((r: any) => ({
          id: r.id || `route-${Date.now()}-${Math.random()}`,
          playerId: r.playerId,
          type: r.type || "curved",
          style: r.style || "solid",
          color: r.color || CONFIG_COLORS.offense.rb,
          points: Array.isArray(r.points) ? r.points : [],
          isPrimary: r.isPrimary || false,
          isMotion: r.isMotion || false,
        }));
        setRoutes(validRoutes);
      }

      // Clear shapes for fresh AI-generated play
      setShapes([]);
      
      // Handle footballs from AI response (or create default at LOS)
      if (playData.footballs && Array.isArray(playData.footballs) && playData.footballs.length > 0) {
        const validFootballs = playData.footballs.map((f: any) => ({
          id: f.id || `football-${Date.now()}-${Math.random()}`,
          x: f.x || Math.floor(FIELD.WIDTH / 2),
          y: f.y || FIELD.LOS_Y,
        }));
        setFootballs(validFootballs);
      } else {
        // Create a default football at LOS center if AI didn't provide one
        setFootballs([{
          id: `football-${Date.now()}`,
          x: Math.floor(FIELD.WIDTH / 2),
          y: FIELD.LOS_Y,
        }]);
      }
      
      // Handle AI mechanics flags (play action, motion, etc.)
      if (playData.mechanics) {
        // Toggle play action marker if AI detected play action in prompt
        if (playData.mechanics.hasPlayAction === true) {
          setIsPlayAction(true);
        } else {
          setIsPlayAction(false);
        }
        
        // Handle pre-snap motion - mark relevant routes as motion routes
        if (playData.mechanics.preSnapMotion === true && playData.routes) {
          // Find any routes that should be motion routes and update them
          const updatedRoutes = playData.routes.map((r: any) => ({
            ...r,
            isMotion: r.isMotion || false,
          }));
          setRoutes(updatedRoutes.map((r: any) => ({
            id: r.id || `route-${Date.now()}-${Math.random()}`,
            playerId: r.playerId,
            type: r.type || "curved",
            style: r.style || "solid",
            color: r.color || CONFIG_COLORS.offense.rb,
            points: Array.isArray(r.points) ? r.points : [],
            isPrimary: r.isPrimary || false,
            isMotion: r.isMotion || false,
          })));
        }
      } else {
        // No mechanics in response - reset play action
        setIsPlayAction(false);
      }
      
      // Clear the prompt after successful generation
      setSpecialPrompt("");
      
      // Clear uploaded image if used
      if (imageBase64) {
        dismissUploadedImage();
      }

      toast({
        title: "Play generated!",
        description: playData.mechanics?.hasPlayAction ? "Play created with play-action!" : "The AI has created your play on the field",
      });
    } catch (error: any) {
      console.error("Generate play error:", error);
      toast({
        title: "Generation failed",
        description: error.message || "Could not generate the play. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
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
      setIncludeOffense(false);
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
      setIncludeOffense(false);
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

  const getRouteColor = (route: Route | { type: string; color?: string; defensiveAction?: string }) => {
    if (route.type === "blocking") return CONFIG_ROUTES.blocking;
    if (route.type === "run") return CONFIG_ROUTES.run;
    if (route.type === "assignment") {
      if ((route as Route).defensiveAction === "blitz") return CONFIG_ROUTES.blitz; // Red for Blitz
      if ((route as Route).defensiveAction === "man") return CONFIG_ROUTES.man; // Gray for Man Coverage
    }
    return route.color || CONFIG_ROUTES.run;
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

  // Render the stem line connecting a player to their tethered zone shape
  const renderStem = (shape: Shape) => {
    if (!shape.playerId) return null;
    
    const player = players.find(p => p.id === shape.playerId);
    if (!player) return null;
    
    const shapeCenter = {
      x: shape.x + shape.width / 2,
      y: shape.y + shape.height / 2,
    };
    
    // Calculate distance from player to shape center
    const distance = Math.sqrt(
      Math.pow(player.x - shapeCenter.x, 2) + 
      Math.pow(player.y - shapeCenter.y, 2)
    );
    
    // Hide stem if player is inside/overlapping the zone (within a threshold)
    const overlapThreshold = Math.min(shape.width, shape.height) / 2;
    if (distance < overlapThreshold) return null;
    
    return (
      <line
        key={`stem-${shape.id}`}
        x1={player.x}
        y1={player.y}
        x2={shapeCenter.x}
        y2={shapeCenter.y}
        stroke={shape.color}
        strokeWidth="2"
        strokeOpacity="0.8"
        data-testid={`stem-${shape.id}`}
      />
    );
  };

  // Handle shape pointer down for dragging
  const handleShapePointerDown = (e: React.PointerEvent, shape: Shape) => {
    e.stopPropagation();
    if (tool !== "select") return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const clickX = (e.clientX - rect.left) / scale;
    const clickY = (e.clientY - rect.top) / scale;
    
    // Calculate offset from shape top-left corner
    setShapeDragOffset({
      x: clickX - shape.x,
      y: clickY - shape.y,
    });
    
    setSelectedShape(shape.id);
    setSelectedPlayer(null);
    setSelectedRoute(null);
    setSelectedElements({ players: [], routes: [] });
    
    // Clear resize state to prevent conflicts
    setIsResizingShape(false);
    setResizeHandle(null);
    setResizeStartData(null);
    setIsDraggingShape(true);
    
    // Save to history at start of drag for undo support
    saveToHistory();
  };

  const renderShape = (shape: Shape) => {
    const isSelected = selectedShape === shape.id;
    // Show subtle border normally, highlight border when selected
    const strokeColor = isSelected ? CONFIG_UI.selection : shape.color;
    const strokeOpacity = isSelected ? 1 : 0.6;
    
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
          fillOpacity="0.25"
          stroke={strokeColor}
          strokeWidth={isSelected ? 3 : 2}
          strokeOpacity={strokeOpacity}
          className="cursor-move"
          style={{ pointerEvents: "auto" }}
          onPointerDown={(e) => handleShapePointerDown(e, shape)}
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
          fillOpacity="0.25"
          stroke={strokeColor}
          strokeWidth={isSelected ? 3 : 2}
          strokeOpacity={strokeOpacity}
          className="cursor-move"
          style={{ pointerEvents: "auto" }}
          onPointerDown={(e) => handleShapePointerDown(e, shape)}
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
          rx="4"
          ry="4"
          fill={shape.color}
          fillOpacity="0.25"
          stroke={strokeColor}
          strokeWidth={isSelected ? 3 : 2}
          strokeOpacity={strokeOpacity}
          className="cursor-move"
          style={{ pointerEvents: "auto" }}
          onPointerDown={(e) => handleShapePointerDown(e, shape)}
          data-testid={`shape-${shape.id}`}
        />
      );
    }
  };

  // Handle resize handle pointer down
  const handleResizeHandlePointerDown = (e: React.PointerEvent, shape: Shape, handle: "nw" | "ne" | "sw" | "se") => {
    e.stopPropagation();
    if (tool !== "select") return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Clear dragging state to prevent conflicts
    setIsDraggingShape(false);
    setIsResizingShape(true);
    setResizeHandle(handle);
    setResizeStartData({
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      startX: (e.clientX - rect.left) / scale,
      startY: (e.clientY - rect.top) / scale,
    });
    
    // Save to history at start of resize for undo support
    saveToHistory();
  };

  // Render resize handles for selected shape
  const renderResizeHandles = (shape: Shape) => {
    if (selectedShape !== shape.id || tool !== "select") return null;
    
    const handleSize = 8;
    const halfSize = handleSize / 2;
    
    // Calculate handle positions at corners
    const handles = [
      { id: "nw", x: shape.x - halfSize, y: shape.y - halfSize, cursor: "nwse-resize" },
      { id: "ne", x: shape.x + shape.width - halfSize, y: shape.y - halfSize, cursor: "nesw-resize" },
      { id: "sw", x: shape.x - halfSize, y: shape.y + shape.height - halfSize, cursor: "nesw-resize" },
      { id: "se", x: shape.x + shape.width - halfSize, y: shape.y + shape.height - halfSize, cursor: "nwse-resize" },
    ] as const;
    
    return (
      <g key={`handles-${shape.id}`}>
        {handles.map((handle) => (
          <rect
            key={handle.id}
            x={handle.x}
            y={handle.y}
            width={handleSize}
            height={handleSize}
            fill="#ffffff"
            stroke={CONFIG_UI.selection}
            strokeWidth={2}
            style={{ cursor: handle.cursor, pointerEvents: "auto" }}
            onPointerDown={(e) => handleResizeHandlePointerDown(e, shape, handle.id as "nw" | "ne" | "sw" | "se")}
            data-testid={`resize-handle-${handle.id}-${shape.id}`}
          />
        ))}
      </g>
    );
  };

  return (
    <div className={`h-screen w-screen bg-slate-950 p-4 flex flex-col gap-4 overflow-hidden ${isLongPressHolding || longPressMenuOpen ? "select-none" : ""}`}>
      {(metadata.name || metadata.formation || metadata.concept || metadata.defenseConcept || metadata.personnel) && (
        <div className="bg-gradient-to-r from-[#1a2332] to-[#2a3342] rounded-2xl border border-white/10 px-6 py-3 flex items-center gap-3 flex-wrap">
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
          {metadata.defenseConcept && (
            <Badge variant="secondary" className="bg-secondary/80 text-secondary-foreground font-medium px-3 py-1.5" data-testid="badge-defense-concept">
              Concept: {getFormattedLabel(metadata.defenseConcept, conceptLabels)}
            </Badge>
          )}
          {metadata.personnel && (
            <Badge variant="secondary" className="bg-secondary/80 text-secondary-foreground font-medium px-3 py-1.5" data-testid="badge-personnel">
              Personnel: {metadata.personnel}
            </Badge>
          )}
        </div>
      )}

      <div className="flex flex-row flex-1 gap-4 overflow-hidden">
        <div className="w-96 min-w-72 flex-shrink rounded-2xl border border-white/10 shadow-2xl overflow-hidden bg-slate-900/95 flex flex-col h-full overflow-y-auto">
          <div className="p-3 border-b border-border">
            <h1 className="text-xl font-bold text-foreground mb-2">Play Designer</h1>
            <Tabs value={playType} onValueChange={(v) => handlePlayTypeChange(v as PlayTypeKey)} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="offense" data-testid="tab-offense" className="text-[11px] font-semibold px-1">Offense</TabsTrigger>
                <TabsTrigger value="defense" data-testid="tab-defense" className="text-[11px] font-semibold px-1">Defense</TabsTrigger>
                <TabsTrigger value="special" data-testid="tab-special" className="text-[11px] font-semibold px-1 opacity-50 cursor-not-allowed pointer-events-none">Special</TabsTrigger>
                <TabsTrigger value="ai-beta" data-testid="tab-ai-beta" className="text-[11px] font-semibold px-1">
                  <Sparkles className="w-3 h-3 mr-1 text-orange-500" />
                  AI Beta
                </TabsTrigger>
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
                  <Label htmlFor="formation" className="text-xs">{playType === "defense" ? "Concept" : "Formation"}</Label>
                  {(playType === "offense" || playType === "ai-beta") && (
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
                    <Select value={metadata.defenseConcept} onValueChange={(v) => setMetadata({ ...metadata, defenseConcept: v === "clear_selection" ? "" : v })}>
                      <SelectTrigger id="defense-concept" data-testid="select-defense-concept" className="h-8 text-sm">
                        <SelectValue placeholder="Select Concept" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="clear_selection">None</SelectItem>
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
                {(playType === "offense" || playType === "ai-beta") && (
                  <>
                    <div>
                      <Label htmlFor="concept" className="text-xs">Concept</Label>
                      <Select value={metadata.concept} onValueChange={(v) => setMetadata({ ...metadata, concept: v === "clear_selection" ? "" : v })}>
                        <SelectTrigger id="concept" data-testid="select-concept" className="h-8 text-sm">
                          <SelectValue placeholder="Select Concept" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clear_selection">None</SelectItem>
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
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-sm text-foreground">Preloaded Game Format</h3>
                  {playType === "defense" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="include-offense"
                        checked={includeOffense}
                        onChange={(e) => setIncludeOffense(e.target.checked)}
                        className="rounded"
                        data-testid="checkbox-include-offense"
                      />
                      <Label htmlFor="include-offense" className="text-xs">Add Offense?</Label>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid="button-format-5on5"
                    onClick={() => handleGameFormatClick("5v5")}
                    className="w-full justify-center bg-green-600 hover:bg-green-700 text-white border-0"
                  >
                    <Flag className="h-4 w-4 text-red-500 mr-2" />
                    5-on-5 Flag
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid="button-format-7on7"
                    onClick={() => handleGameFormatClick("7v7")}
                    className="w-full justify-center bg-green-600 hover:bg-green-700 text-white border-0"
                  >
                    <Flag className="h-4 w-4 text-red-500 mr-2" />
                    7-on-7 Flag
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid="button-format-9on9"
                    onClick={() => handleGameFormatClick("9v9")}
                    className="w-full justify-center bg-green-600 hover:bg-green-700 text-white border-0"
                  >
                    <Flag className="h-4 w-4 text-red-500 mr-2" />
                    9-on-9 Flag
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid="button-format-11on11"
                    onClick={() => handleGameFormatClick("11v11")}
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
                    <div className="grid grid-cols-3 gap-2">
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

        <div 
          ref={fieldContainerRef}
          className="flex-1 h-full relative rounded-2xl bg-slate-900/50 border border-white/5 overflow-hidden flex flex-col items-center justify-center"
          onClick={handleBackgroundClick}
        >
          {/* Layer B: AI Play Creator Interface - Fixed size, centered over field (DOES NOT SCALE) */}
          {(playType === "special" || playType === "ai-beta") && (
            <div 
              className="absolute inset-0 z-20 flex items-start justify-center pt-16 pointer-events-none"
              data-testid="special-ai-overlay"
            >
              <div 
                className="flex flex-col items-center gap-4 pointer-events-auto max-w-[90%]"
                style={{ width: FIELD.WIDTH, maxWidth: "90%" }}
                data-testid="special-ai-creator"
              >
                {/* Headline */}
                <h2 className="text-3xl font-bold text-white drop-shadow-md" data-testid="ai-headline">
                  🏈 What's the play call coach?
                </h2>
                
                {/* Glassmorphic Input Container - Hero Size */}
                <div className="w-full bg-slate-900/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 flex flex-col shadow-xl gap-2">
                  <textarea
                    placeholder="Explain the play..."
                    value={specialPrompt}
                    onChange={(e) => setSpecialPrompt(e.target.value)}
                    className="flex-1 h-28 bg-transparent text-white placeholder-white/50 outline-none p-4 resize-none"
                    data-testid="ai-input"
                  />
                  {/* Bottom row with Upload and Submit buttons on the right */}
                  <div className="flex justify-end items-center gap-2">
                    {/* Hidden file input */}
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="file-input-upload"
                    />
                    {/* Upload button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 px-2 py-1 rounded text-xs font-medium transition-colors flex items-center justify-center"
                      data-testid="button-upload-play"
                    >
                      {isUploading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>Upload Play</>
                      )}
                    </button>
                    {/* Submit button */}
                    <button
                      onClick={() => handleGeneratePlay(uploadedImage || undefined)}
                      disabled={isGenerating || (!specialPrompt.trim() && !uploadedImage)}
                      className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
                      data-testid="ai-submit-button"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Thumbnail Preview */}
                {uploadedImage && (
                  <div className="relative w-16 h-16" data-testid="upload-thumbnail-container">
                    <img
                      src={uploadedImage}
                      alt="Uploaded play"
                      className="w-16 h-16 rounded-lg object-cover border border-white/20"
                      data-testid="upload-thumbnail"
                    />
                    <button
                      onClick={dismissUploadedImage}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg"
                      data-testid="button-dismiss-thumbnail"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                
                {/* Suggestion Chips */}
                <div className="flex flex-wrap justify-center gap-2">
                  <button 
                    className="bg-slate-800/80 text-white text-xs border border-white/10 hover:bg-slate-700 rounded-full px-3 py-1 transition-colors"
                    onClick={() => setSpecialPrompt("Pass play to beat Cover 2")}
                    data-testid="chip-cover2"
                  >
                    Pass play to beat Cover 2
                  </button>
                  <button 
                    className="bg-slate-800/80 text-white text-xs border border-white/10 hover:bg-slate-700 rounded-full px-3 py-1 transition-colors"
                    onClick={() => setSpecialPrompt("Run play to beat man")}
                    data-testid="chip-man"
                  >
                    Run play to beat man
                  </button>
                  <button 
                    className="bg-slate-800/80 text-white text-xs border border-white/10 hover:bg-slate-700 rounded-full px-3 py-1 transition-colors"
                    onClick={() => setSpecialPrompt("Quick pass to get a first down vs blitz on 3rd and medium")}
                    data-testid="chip-blitz"
                  >
                    Quick pass to get a first down vs blitz on 3rd and medium
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Layer A: Field Wrapper - SCALES to fit available space */}
          <div 
            className="bg-background rounded-lg shadow-lg p-2"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top center",
            }}
          >
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
              {/* White header for metadata - position flips based on tab */}
              <div 
                className="absolute left-0 right-0 flex items-center justify-center"
                style={{ 
                  top: FIELD.getHeaderStartY(playType), 
                  height: FIELD.HEADER_HEIGHT, 
                  backgroundColor: "#ffffff", 
                  zIndex: 25 
                }}
              >
                {(metadata.name || metadata.formation || metadata.concept || metadata.defenseConcept || metadata.personnel) && (
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
                    {metadata.defenseConcept && (
                      <div
                        className="px-3 py-1.5 rounded text-white font-medium text-sm"
                        style={{ backgroundColor: "#374151" }}
                        data-testid="overlay-defense-concept"
                      >
                        Concept: {getFormattedLabel(metadata.defenseConcept, conceptLabels)}
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
              
              {/* Green field area - position flips based on tab */}
              <div 
                className="absolute bg-gradient-to-b from-green-600 to-green-700"
                style={{ 
                  top: FIELD.getFieldStartY(playType), 
                  left: 0, 
                  right: 0, 
                  height: FIELD.HEIGHT - FIELD.HEADER_HEIGHT,
                  zIndex: 0 
                }}
              />
              
              
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                {/* Dynamic field grid - uses fieldStartY based on tab */}
                {(() => {
                  const fieldStartY = FIELD.getFieldStartY(playType);
                  const fieldEndY = fieldStartY + FIELD.FIELD_HEIGHT;
                  
                  return (
                    <>
                      {/* 5-yard horizontal lines (thicker) */}
                      {Array.from({ length: Math.floor(FIELD.FIELD_HEIGHT / 60) + 1 }, (_, i) => {
                        const y = fieldStartY + i * 60;
                        if (y > fieldEndY - FIELD.BOTTOM_PADDING) return null;
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
                        const y = fieldStartY + i * 12;
                        if (y > fieldEndY - FIELD.BOTTOM_PADDING) return null;
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
                        const y = fieldStartY + i * 12;
                        if (y > fieldEndY - FIELD.BOTTOM_PADDING) return null;
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
                        const y = fieldStartY + i * 12;
                        if (y > fieldEndY - FIELD.BOTTOM_PADDING) return null;
                        return (
                          <g key={`hash-${i}`}>
                            <line x1={FIELD.LEFT_HASH_X - 6} y1={y} x2={FIELD.LEFT_HASH_X + 6} y2={y} stroke="white" strokeWidth="2" opacity="0.6" />
                            <line x1={FIELD.RIGHT_HASH_X - 6} y1={y} x2={FIELD.RIGHT_HASH_X + 6} y2={y} stroke="white" strokeWidth="2" opacity="0.6" />
                          </g>
                        );
                      })}
                      
                      {/* Yard line numbers (sideline orientation like real fields) */}
                      {(() => {
                        const yardNumbers = [
                          { label: "30", y: FIELD.LOS_Y + 12 },
                          { label: "40", y: FIELD.LOS_Y - 108 },
                          { label: "50", y: FIELD.LOS_Y - 228 },
                        ];
                        const leftX = FIELD.WIDTH * 0.15;
                        const rightX = FIELD.WIDTH * 0.85;
                        
                        return yardNumbers.flatMap(({ label, y }) => {
                          if (y < 0 || y > FIELD.HEIGHT) return [];
                          return [
                            <text
                              key={`yard-num-${label}-left`}
                              x={leftX}
                              y={y}
                              fill="white"
                              opacity="0.25"
                              fontSize="32"
                              fontWeight="bold"
                              fontFamily="'Arial Narrow', sans-serif"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              transform={`rotate(-90, ${leftX}, ${y})`}
                            >
                              {label}
                            </text>,
                            <text
                              key={`yard-num-${label}-right`}
                              x={rightX}
                              y={y}
                              fill="white"
                              opacity="0.25"
                              fontSize="32"
                              fontWeight="bold"
                              fontFamily="'Arial Narrow', sans-serif"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              transform={`rotate(90, ${rightX}, ${y})`}
                            >
                              {label}
                            </text>
                          ];
                        });
                      })()}
                    </>
                  );
                })()}
                
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
                
                {/* Render stems first (behind shapes) */}
                {shapes.map(shape => renderStem(shape))}
                
                {/* Render zone shapes (behind routes and players) */}
                {shapes.map(shape => renderShape(shape))}
                
                {/* Render resize handles for selected shape (on top of shapes) */}
                {shapes.map(shape => renderResizeHandles(shape))}

                {routes.filter(r => showBlocking || r.type !== "blocking").map((route) => (
                  <g key={route.id}>
                    {selectedElements.routes.includes(route.id) && (
                      <path
                        d={getRoutePath(route)}
                        stroke={CONFIG_UI.selection}
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
                              {/* Transparent hit area for entire motion route */}
                              <path
                                d={getRoutePath(route)}
                                stroke="rgba(0,0,0,0.001)"
                                strokeWidth="20"
                                fill="none"
                                className="cursor-pointer"
                                style={{ pointerEvents: "stroke", touchAction: "none" }}
                                data-route-id={route.id}
                                data-testid={`route-hitarea-${route.id}`}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRoute(route.id);
                                  setSelectedPlayer(null);
                                  setSelectedShape(null);
                                  setSelectedFootball(null);
                                  setSelectedElements({ players: [], routes: [] });
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setEditingRouteId(route.id);
                                  setSelectedRoute(route.id);
                                  editingRouteStartPoints.current = JSON.parse(JSON.stringify(route.points));
                                }}
                              />
                              {belowLOS.length >= 2 && (
                                <path
                                  d={getRoutePathForPoints(belowLOS, route.style)}
                                  stroke={getRouteColor(route)}
                                  strokeWidth="3.6"
                                  fill="none"
                                  strokeDasharray="5,5"
                                  style={{ pointerEvents: "none" }}
                                />
                              )}
                              {aboveLOS.length >= 2 && (
                                <path
                                  d={getRoutePathForPoints(aboveLOS, route.style)}
                                  stroke={getRouteColor(route)}
                                  strokeWidth="3.6"
                                  fill="none"
                                  markerEnd={crossedLOS ? `url(#arrowhead-${getRouteColor(route).replace('#', '')})` : undefined}
                                  style={{ pointerEvents: "none" }}
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
                      <>
                        {/* Transparent hit area for easier clicking/double-clicking */}
                        <path
                          d={getRoutePath(route)}
                          stroke="rgba(0,0,0,0.001)"
                          strokeWidth="20"
                          fill="none"
                          className="cursor-pointer"
                          style={{ pointerEvents: "stroke", touchAction: "none" }}
                          data-route-id={route.id}
                          data-testid={`route-hitarea-${route.id}`}
                          onPointerDown={(e) => {
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
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingRouteId(route.id);
                            setSelectedRoute(route.id);
                            editingRouteStartPoints.current = JSON.parse(JSON.stringify(route.points));
                          }}
                        />
                        {/* Visible route path */}
                        <path
                          d={getRoutePath(route)}
                          stroke={getRouteColor(route)}
                          strokeWidth="3.6"
                          fill="none"
                          strokeDasharray={route.type === "assignment" && route.defensiveAction === "man" ? "5,5" : undefined}
                          markerEnd={(() => {
                            if (route.type === "blocking") {
                              return "url(#arrowhead-blocking)";
                            }
                            return `url(#arrowhead-${getRouteColor(route).replace('#', '')})`;
                          })()}
                          style={{ pointerEvents: "none" }}
                          data-testid={`route-${route.id}`}
                          data-target-player={route.type === "assignment" && route.defensiveAction === "man" ? route.targetPlayerId : undefined}
                          data-route-type={route.type === "assignment" ? route.defensiveAction : route.type}
                        />
                      </>
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
                    {/* Route edit mode: blue handles when editingRouteId matches */}
                    {editingRouteId === route.id && route.points.map((point, idx) => (
                      <circle
                        key={`edit-${idx}`}
                        cx={point.x}
                        cy={point.y}
                        r="7"
                        fill={idx === 0 ? "#6b7280" : "#3b82f6"}
                        stroke="#fff"
                        strokeWidth="2"
                        className={idx === 0 ? "cursor-not-allowed" : "cursor-move"}
                        style={{ touchAction: "none" }}
                        data-route-handle="true"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          if (idx === 0) return; // First point stays attached to player
                          // Save history before starting drag for undo
                          saveToHistory();
                          setDraggingRoutePoint({ routeId: route.id, pointIndex: idx });
                        }}
                        data-testid={`route-edit-point-${route.id}-${idx}`}
                      />
                    ))}
                    {/* Selection mode: orange handles when just selected (not editing) */}
                    {selectedRoute === route.id && editingRouteId !== route.id && route.points.map((point, idx) => (
                      <circle
                        key={`select-${idx}`}
                        cx={point.x}
                        cy={point.y}
                        r="6"
                        fill={CONFIG_UI.selection}
                        stroke="#fff"
                        strokeWidth="2"
                        className="cursor-move"
                        style={{ touchAction: "none" }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          if (idx === 0) return; // First point stays attached
                          saveToHistory();
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
                      const playerColor = player?.color || CONFIG_ROUTES.run;
                      const previewColor = routeType === "blocking" ? CONFIG_ROUTES.blocking : (routeType === "run" ? CONFIG_ROUTES.run : playerColor);
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
                    stroke={CONFIG_UI.selection}
                    strokeWidth="2"
                    fill={`${CONFIG_UI.selection}1A`}
                    strokeDasharray="5,5"
                  />
                )}
              </svg>

              {players.map((player) => {
                const isDefensivePlayer = player.side === "defense";
                
                return (
                  <div
                    key={player.id}
                    className="absolute cursor-pointer"
                    style={{
                      left: player.x - 12,
                      top: isDefensivePlayer ? player.y - 12 - 20 : player.y - 12,
                      width: 24,
                      height: isDefensivePlayer ? 24 + 20 : 24,
                      zIndex: 10,
                      pointerEvents: "auto",
                      transform: "translateZ(0)",
                      touchAction: "none",
                    }}
                    onPointerDown={(e) => handlePlayerPointerDown(e, player.id)}
                    onDoubleClick={(e) => handlePlayerDoubleClick(e as unknown as React.PointerEvent, player.id)}
                    onPointerEnter={() => {
                      if (pendingRouteSelection && pendingRouteSelection.playerId === player.id) {
                        const pending = { ...pendingRouteSelection };
                        const playerX = player.x;
                        const playerY = player.y;
                        const pId = player.id;
                        
                        setPendingRouteSelection(null);
                        cancelLongPress();
                        
                        setTool("route");
                        
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
                    {isDefensivePlayer ? (
                      <>
                        <div 
                          className="w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-sm absolute top-0 left-1/2 -translate-x-1/2 z-10"
                          style={{ transform: `translateX(-50%) scale(${1 / scale})`, transformOrigin: 'center center' }}
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
                              className="w-4 h-4 bg-transparent text-center text-[9px] font-bold text-black outline-none uppercase"
                              data-testid={`input-label-${player.id}`}
                            />
                          ) : (
                            <span className="text-[9px] font-bold text-black">{player.label || ""}</span>
                          )}
                        </div>
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          style={{
                            position: 'absolute',
                            top: 20,
                            left: 0,
                            transition: "transform 80ms ease-out",
                            transform: isLongPressHolding && longPressPlayerRef === player.id ? "scale(1.1)" : "scale(1)",
                            filter: pendingRouteSelection?.playerId === player.id
                              ? "none"
                              : longPressPlayerId === player.id 
                                ? "drop-shadow(0 0 4px rgba(251, 146, 60, 0.8))" 
                                : (selectedPlayer === player.id || selectedElements.players.includes(player.id)) 
                                  ? "drop-shadow(0 0 2px rgba(34, 211, 238, 1))" 
                                  : "none",
                          }}
                          className={pendingRouteSelection?.playerId === player.id ? "player-pending-route" : ""}
                        >
                          <line x1="4" y1="4" x2="20" y2="20" stroke={player.color} strokeWidth="4" strokeLinecap="round" />
                          <line x1="20" y1="4" x2="4" y2="20" stroke={player.color} strokeWidth="4" strokeLinecap="round" />
                        </svg>
                      </>
                    ) : (
                      <div
                        className={`w-6 h-6 ${
                          playType === "offense" && player.color === CONFIG_COLORS.offense.default ? "" : "rounded-full"
                        } flex items-center justify-center text-white font-bold text-xs ${
                          pendingRouteSelection?.playerId === player.id ? "player-pending-route" : ""
                        }`}
                        style={{ 
                          backgroundColor: player.color,
                          transition: "transform 80ms ease-out, box-shadow 80ms ease-out",
                          transform: isLongPressHolding && longPressPlayerRef === player.id ? "scale(1.1)" : "scale(1)",
                          animation: isLongPressHolding && longPressPlayerRef === player.id && !pendingRouteSelection ? "pressRing 280ms ease-out forwards" : "none",
                          boxShadow: pendingRouteSelection?.playerId === player.id
                            ? "none"
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
                            style={{ transform: `scale(${1 / scale})`, transformOrigin: 'center center' }}
                            data-testid={`input-label-${player.id}`}
                          />
                        ) : (
                          <span className="text-xs" style={{ transform: `scale(${1 / scale})`, transformOrigin: 'center center' }}>{player.label || ""}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

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
                        pointerEvents: 'none',
                        transform: `scale(${1 / scale})`,
                        transformOrigin: 'center center'
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
          
          {/* Under Construction Sign - Special Teams Tab Only - Centered in bottom fourth of screen */}
          {playType === "special" && (
            <div 
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
              style={{ top: "87.5%", zIndex: 50 }}
            >
              <img 
                src={underConstructionImage} 
                alt="Under Construction" 
                className="w-48 opacity-90"
                data-testid="under-construction-image"
              />
            </div>
          )}
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
            
            {(() => {
              const longPressedPlayer = players.find(p => p.id === longPressPlayerId);
              const isDefensivePlayer = longPressedPlayer?.side === "defense";
              
              if (isDefensivePlayer) {
                // DEFENSIVE MENU - Assignment types
                return (
                  <>
                    {/* Level 1: Assignment Types */}
                    <div className="flex flex-col" style={{ width: 108, flexShrink: 0 }}>
                      <div className="px-3 py-1.5 bg-gray-700/50 border-b border-gray-600">
                        <span className="text-white text-xs font-semibold">Assignment</span>
                      </div>
                      {(["blitz", "man", "zone"] as const).map((action) => (
                        <div
                          key={action}
                          className="lp-menu-item px-3 py-2 text-sm cursor-pointer flex items-center justify-between text-gray-200"
                          data-testid={`menu-defensive-action-${action}`}
                          onMouseEnter={() => {
                            if (!menuConfirming) {
                              setHoveredDefensiveAction(action);
                              // Auto-switch to "area" when Zone is hovered (Zone cannot be Linear)
                              if (action === "zone") {
                                setHoveredRouteStyle("area");
                              }
                            }
                          }}
                          data-active={hoveredDefensiveAction === action}
                        >
                          <span className="capitalize font-medium">{action === "man" ? "Man" : action === "blitz" ? "Blitz" : "Zone"}</span>
                          <span className="text-xs opacity-60">▶</span>
                        </div>
                      ))}
                    </div>
                    
                    {/* Level 2: Style for Blitz/Man/Zone */}
                    {hoveredDefensiveAction && (
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
                        {/* Zone only shows Area (filter out Linear), Blitz/Man show both */}
                        {(hoveredDefensiveAction === "zone" ? ["area"] as const : ["linear", "area"] as const).map((style) => (
                          <div
                            key={style}
                            className="lp-menu-item px-3 py-2 text-sm cursor-pointer flex items-center justify-between text-gray-200"
                            data-testid={`menu-defensive-style-${style}`}
                            onMouseEnter={() => {
                              if (!menuConfirming) {
                                setHoveredRouteStyle(style);
                              }
                            }}
                            onClick={() => {
                              if (!hoveredDefensiveAction || !longPressPlayerId) return;
                              const player = players.find(p => p.id === longPressPlayerId);
                              if (!player) return;
                              
                              // For Blitz and Man, auto-create the assignment immediately
                              if (hoveredDefensiveAction === "blitz") {
                                const qbPos = getQBPosition();
                                const newRoute: Route = {
                                  id: `route-${Date.now()}`,
                                  playerId: longPressPlayerId,
                                  points: [{ x: player.x, y: player.y }, qbPos],
                                  type: "assignment",
                                  style: style,
                                  defensiveAction: "blitz",
                                  color: CONFIG_COLORS.offense.receiverX,
                                };
                                saveToHistory();
                                setRoutes(prev => [...prev, newRoute]);
                                closeLongPressMenu();
                              } else if (hoveredDefensiveAction === "man") {
                                const targetPlayer = getNearestUnclaimedOffensivePlayer({ x: player.x, y: player.y });
                                if (targetPlayer) {
                                  const newRoute: Route = {
                                    id: `route-${Date.now()}`,
                                    playerId: longPressPlayerId,
                                    points: [{ x: player.x, y: player.y }, { x: targetPlayer.x, y: targetPlayer.y }],
                                    type: "assignment",
                                    style: style,
                                    defensiveAction: "man",
                                    targetPlayerId: targetPlayer.id,
                                    color: CONFIG_ROUTES.man,
                                  };
                                  saveToHistory();
                                  setRoutes(prev => [...prev, newRoute]);
                                  closeLongPressMenu();
                                }
                              }
                              // Zone + Area will show Shape column, so don't close menu here
                            }}
                            data-active={hoveredRouteStyle === style}
                          >
                            <span className="capitalize font-medium">{style}</span>
                            {/* Zone + Area shows Shape column, so add arrow */}
                            {hoveredDefensiveAction === "zone" && style === "area" && (
                              <span className="text-xs opacity-60">▶</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Level 3: Shape for Zone + Area */}
                    {hoveredDefensiveAction === "zone" && hoveredRouteStyle === "area" && (
                      <div 
                        className="flex flex-col border-l border-gray-600" 
                        style={{ 
                          width: 110, 
                          flexShrink: 0,
                          animation: "columnSlideIn 100ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
                        }}
                      >
                        <div className="px-3 py-1.5 bg-gray-700/50 border-b border-gray-600">
                          <span className="text-white text-xs font-semibold">Shape</span>
                        </div>
                        {(["circle", "oval", "rectangle"] as const).map((shape) => (
                          <div
                            key={shape}
                            className="lp-menu-item px-3 py-2 text-sm cursor-pointer flex items-center justify-between text-gray-200"
                            data-testid={`menu-zone-shape-${shape}`}
                            onMouseEnter={() => {
                              if (!menuConfirming) {
                                setHoveredZoneShape(shape);
                              }
                            }}
                            onClick={() => {
                              if (!longPressPlayerId) return;
                              const player = players.find(p => p.id === longPressPlayerId);
                              if (!player) return;
                              
                              // Create tethered zone shape at player position
                              const defaultSizes: Record<string, { width: number; height: number }> = {
                                circle: { width: 50, height: 50 },
                                oval: { width: 70, height: 45 },
                                rectangle: { width: 60, height: 45 },
                              };
                              const size = defaultSizes[shape];
                              
                              const newShape: Shape = {
                                id: `shape-${Date.now()}`,
                                playerId: longPressPlayerId,
                                type: shape,
                                x: player.x - size.width / 2,
                                y: player.y - size.height / 2,
                                width: size.width,
                                height: size.height,
                                color: player.color,
                              };
                              
                              saveToHistory();
                              setShapes(prev => [...prev, newShape]);
                              closeLongPressMenu();
                            }}
                            data-active={hoveredZoneShape === shape}
                          >
                            <span className="capitalize font-medium">{shape}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              }
              
              // OFFENSIVE MENU - Route types
              return (
                <>
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
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
