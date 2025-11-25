import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Copy, Plus, Trash2, Circle as CircleIcon, MoveHorizontal, PenTool, Square as SquareIcon, Type, Hexagon, RotateCcw } from "lucide-react";
import { toPng } from "html-to-image";
import { useToast } from "@/hooks/use-toast";

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

interface HistoryState {
  players: Player[];
  routes: Route[];
  shapes: Shape[];
  football: { x: number; y: number } | null;
}

export default function PlayDesigner() {
  const [playType, setPlayType] = useState<"offense" | "defense" | "special">("offense");
  const [players, setPlayers] = useState<Player[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [football, setFootball] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedShape, setSelectedShape] = useState<string | null>(null);
  const [selectedFootball, setSelectedFootball] = useState(false);
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
  const [exportWidth, setExportWidth] = useState("688");
  const [exportHeight, setExportHeight] = useState("660");
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const currentRoutePointsRef = useRef<{ x: number; y: number }[]>([]);
  const { toast } = useToast();

  const offenseColors = ["#39ff14", "#1d4ed8", "#ef4444", "#eab308", "#000000", "#f97316", "#6b7280"];
  const defenseColors = ["#92400e", "#db2777", "#9333ea"];
  const shapeColors = ["#ec4899", "#1d4ed8", "#86efac"];
  const colors = playType === "offense" ? offenseColors : defenseColors;
  
  const conceptLabels: Record<string, string> = {
    "outside-run": "Outside Run",
    "inside-run": "Inside Run",
    "short-pass": "Short Pass",
    "deep-pass": "Deep Pass",
    "rpo": "RPO",
    "screen": "Screen",
  };
  
  // Preset positions for offensive players based on standard formation
  // Field: 688x660, padding 24px, line of scrimmage at y=504
  const offensePositions: Record<string, { x: number; y: number }> = {
    "#39ff14": { x: 344, y: 580 },  // Neon Green - Running back (center, 6 yards back)
    "#1d4ed8": { x: 80, y: 504 },   // Blue - Split end (far left on line)
    "#ef4444": { x: 608, y: 504 },  // Red - Right receiver (far right on line)
    "#eab308": { x: 240, y: 504 },  // Yellow - Left guard (left of center on line)
    "#000000": { x: 344, y: 504 },  // Black - Center (middle on line)
    "#f97316": { x: 400, y: 540 },  // Orange - Quarterback (behind line, slightly right)
    "#6b7280": { x: 448, y: 504 },  // Gray - Right guard (right of center on line)
  };
  
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
    setSelectedFootball(false);
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
            football: football ? { ...football } : null
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
          setFootball(null);
          setSelectedFootball(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPlayer, selectedRoute, selectedShape, selectedFootball, editingPlayer, selectedElements, players, routes, shapes, football]);

  const addPlayer = (color: string) => {
    saveToHistory();
    
    // Use preset position for offense players, default to center for defense
    const position = playType === "offense" && offensePositions[color] 
      ? offensePositions[color] 
      : { x: 344, y: 504 };
    
    const newPlayer: Player = {
      id: `player-${Date.now()}`,
      x: position.x,
      y: position.y,
      color,
    };
    setPlayers([...players, newPlayer]);
    
    // Switch to select mode so user can immediately reposition if needed
    setTool("select");
  };

  const addFootball = () => {
    saveToHistory();
    setFootball({ x: 344, y: 504 });
    setTool("select");
  };

  const saveToHistory = () => {
    setHistory(prev => [...prev, {
      players: JSON.parse(JSON.stringify(players)),
      routes: JSON.parse(JSON.stringify(routes)),
      shapes: JSON.parse(JSON.stringify(shapes)),
      football: football ? { ...football } : null
    }]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setPlayers(previousState.players);
    setRoutes(previousState.routes);
    setShapes(previousState.shapes);
    setFootball(previousState.football);
    setHistory(prev => prev.slice(0, -1));
    setSelectedPlayer(null);
    setSelectedRoute(null);
    setSelectedShape(null);
    setSelectedFootball(false);
    setSelectedElements({ players: [], routes: [] });
  };

  const deleteSelected = () => {
    const hasSelection = selectedFootball || selectedPlayer || selectedRoute || selectedShape;
    if (hasSelection) saveToHistory();
    
    if (selectedFootball) {
      setFootball(null);
      setSelectedFootball(false);
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

  const handlePlayerMouseDown = (e: React.MouseEvent, playerId: string) => {
    if (tool === "select") {
      e.stopPropagation();
      const player = players.find(p => p.id === playerId);
      if (player) {
        saveToHistory();
        setSelectedPlayer(playerId);
        setSelectedRoute(null);
        setSelectedShape(null);
        setSelectedElements({ players: [], routes: [] });
        setIsDragging(true);
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          setDragOffset({
            x: e.clientX - rect.left - player.x,
            y: e.clientY - rect.top - player.y,
          });
        }
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

  const handlePlayerDoubleClick = (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    const player = players.find(p => p.id === playerId);
    if (player) {
      setEditingPlayer(playerId);
      setEditingLabel(player.label || "");
    }
  };

  const handleFootballMouseDown = (e: React.MouseEvent) => {
    if (tool === "select" && football) {
      e.stopPropagation();
      saveToHistory();
      setSelectedFootball(true);
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

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isDragging && selectedPlayer && tool === "select") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const newX = e.clientX - rect.left - dragOffset.x;
        const newY = e.clientY - rect.top - dragOffset.y;
        setPlayers(players.map(p =>
          p.id === selectedPlayer ? { ...p, x: Math.max(36, Math.min(652, newX)), y: Math.max(36, Math.min(624, newY)) } : p
        ));
      }
    }
    
    // Handle football dragging
    if (isDragging && selectedFootball && football && tool === "select") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const newX = e.clientX - rect.left - dragOffset.x;
        const newY = e.clientY - rect.top - dragOffset.y;
        setFootball({ 
          x: Math.max(36, Math.min(652, newX)), 
          y: Math.max(36, Math.min(624, newY)) 
        });
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

  const handleCanvasClick = (e: React.MouseEvent) => {
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
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
        setSelectedFootball(false);
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

  const handleShapeMouseMove = (e: React.MouseEvent) => {
    if (isDrawingShape && shapeStart) {
      // Visual feedback could be added here
    }
  };

  const handleShapeMouseUp = (e: React.MouseEvent) => {
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
  };

  const generateScaledExport = async (targetWidth: number, targetHeight: number): Promise<string> => {
    if (!canvasRef.current) throw new Error("Canvas not available");
    
    const CANVAS_WIDTH = 688;
    const CANVAS_HEIGHT = 660;
    
    const fullSizeDataUrl = await toPng(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      skipFonts: true,
    });
    
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
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Failed to load image for scaling"));
      img.src = fullSizeDataUrl;
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

  // Split motion route at LOS (y=504) - returns { belowLOS: points[], aboveLOS: points[] }
  const splitMotionRouteAtLOS = (points: { x: number; y: number }[]) => {
    const LOS_Y = 504;
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
    <div className="flex flex-col h-screen w-full overflow-hidden">
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

      <div className="flex flex-1 overflow-hidden">
        <div className="w-96 border-r border-border bg-card flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border">
            <h1 className="text-xl font-bold text-foreground mb-4">Play Designer</h1>
            <Tabs value={playType} onValueChange={(v) => setPlayType(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="offense" data-testid="tab-offense">Offense</TabsTrigger>
                <TabsTrigger value="defense" data-testid="tab-defense">Defense</TabsTrigger>
                <TabsTrigger value="special" data-testid="tab-special">Special</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm text-foreground">Play Metadata</h3>
              <div className="space-y-2">
                <div>
                  <Label htmlFor="play-name" className="text-xs">Name</Label>
                  <Input
                    id="play-name"
                    data-testid="input-play-name"
                    placeholder="Play name..."
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
                          <SelectValue placeholder="Select concept" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="outside-run">Outside Run</SelectItem>
                          <SelectItem value="inside-run">Inside Run</SelectItem>
                          <SelectItem value="short-pass">Short Pass</SelectItem>
                          <SelectItem value="deep-pass">Deep Pass</SelectItem>
                          <SelectItem value="rpo">RPO</SelectItem>
                          <SelectItem value="screen-pass">Screen Pass</SelectItem>
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

            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm text-foreground">Tools</h3>
              <div className="grid grid-cols-3 gap-1.5">
                <Button
                  size="sm"
                  variant={tool === "select" ? "default" : "secondary"}
                  onClick={() => setTool("select")}
                  data-testid="button-tool-select"
                  className="justify-start px-2"
                >
                  <MoveHorizontal className="h-4 w-4 mr-1" />
                  Select
                </Button>
                <Button
                  size="sm"
                  variant={tool === "route" ? "default" : "secondary"}
                  onClick={() => setTool("route")}
                  data-testid="button-tool-route"
                  className="justify-start px-2"
                >
                  <PenTool className="h-4 w-4 mr-1" />
                  Route
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={undo}
                  disabled={history.length === 0}
                  data-testid="button-tool-undo"
                  className="justify-start px-2"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Undo
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
                    disabled={football !== null}
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
                {football && (
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

            <Card className="p-4 space-y-3">
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
                  Export as Image
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

        <div className="flex-1 bg-muted/30 p-2 overflow-auto flex items-center justify-center">
          <div className="bg-background rounded-lg shadow-lg p-2">
            <div
              ref={canvasRef}
              className="relative bg-gradient-to-r from-green-700 to-green-600 rounded cursor-crosshair"
              style={{ width: 688, height: 660 }}
              onMouseMove={(e) => {
                handleCanvasMouseMove(e);
                handleShapeMouseMove(e);
              }}
              onMouseUp={(e) => {
                handleCanvasMouseUp();
                handleShapeMouseUp(e);
              }}
              onMouseDown={handleCanvasMouseDown}
              onClick={handleCanvasClick}
              onDoubleClick={handleCanvasDoubleClick}
              data-testid="canvas-field"
            >
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                {/* 5-yard horizontal lines (thicker) */}
                {Array.from({ length: 11 }, (_, i) => {
                  const y = 24 + i * 60;
                  return (
                    <line
                      key={`yard-${i}`}
                      x1="24"
                      y1={y}
                      x2="664"
                      y2={y}
                      stroke="white"
                      strokeWidth="4"
                      opacity="0.3"
                    />
                  );
                })}
                
                {/* 1-yard tick marks on LEFT edge */}
                {Array.from({ length: 51 }, (_, i) => {
                  const y = 24 + i * 12;
                  return (
                    <line
                      key={`left-tick-${i}`}
                      x1="24"
                      y1={y}
                      x2="36"
                      y2={y}
                      stroke="white"
                      strokeWidth="2"
                      opacity="0.8"
                    />
                  );
                })}
                
                {/* 1-yard tick marks on RIGHT edge */}
                {Array.from({ length: 51 }, (_, i) => {
                  const y = 24 + i * 12;
                  return (
                    <line
                      key={`right-tick-${i}`}
                      x1="652"
                      y1={y}
                      x2="664"
                      y2={y}
                      stroke="white"
                      strokeWidth="2"
                      opacity="0.8"
                    />
                  );
                })}
                
                {/* Hash marks in middle (NCAA style - 40 feet / 13.33 yards from each sideline) */}
                {Array.from({ length: 51 }, (_, i) => {
                  const y = 24 + i * 12;
                  return (
                    <g key={`hash-${i}`}>
                      <line x1="178" y1={y} x2="190" y2={y} stroke="white" strokeWidth="2" opacity="0.6" />
                      <line x1="498" y1={y} x2="510" y2={y} stroke="white" strokeWidth="2" opacity="0.6" />
                    </g>
                  );
                })}
                
                {/* Line of scrimmage (9 yards from bottom = y=504) */}
                <line x1="24" y1="504" x2="664" y2="504" stroke="white" strokeWidth="6" />
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
                          const crossedLOS = endPoint && endPoint.y < 504;
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
                                    setSelectedFootball(false);
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
                                    setSelectedFootball(false);
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
                          setSelectedFootball(false);
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
                      const crossedLOS = endPoint && endPoint.y < 504;
                      
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
                  className="absolute cursor-pointer hover:scale-110 transition-transform"
                  style={{
                    left: player.x - 12,
                    top: player.y - 12,
                    width: 24,
                    height: 24,
                    zIndex: 10,
                    pointerEvents: "auto",
                  }}
                  onMouseDown={(e) => handlePlayerMouseDown(e, player.id)}
                  onDoubleClick={(e) => handlePlayerDoubleClick(e, player.id)}
                  data-testid={`player-${player.id}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                      (selectedPlayer === player.id || selectedElements.players.includes(player.id)) ? "ring-2 ring-cyan-400" : ""
                    }`}
                    style={{ backgroundColor: player.color }}
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

              {football && (
                <div
                  className={`absolute cursor-pointer hover:scale-110 transition-transform ${
                    selectedFootball ? "ring-2 ring-cyan-400 rounded-full" : ""
                  }`}
                  style={{ 
                    left: football.x - 5, 
                    top: football.y - 10, 
                    width: 10, 
                    height: 20,
                    zIndex: 50
                  }}
                  onMouseDown={handleFootballMouseDown}
                  data-testid="football"
                >
                  <svg width="10" height="20" viewBox="0 0 20 40">
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
                      data-testid="play-action-marker"
                    >
                      <circle cx="10" cy="10" r="10" fill="black" stroke="#000" strokeWidth="2" />
                      <text x="10" y="14" fill="white" fontSize="12" fontWeight="bold" textAnchor="middle">PA</text>
                    </svg>
                  )}
                </div>
              )}

              {/* Metadata overlay on field - centered in middle 5-yard row (y=84-144) */}
              {(metadata.name || metadata.formation || metadata.concept || metadata.personnel) && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: 84,
                    left: 24,
                    width: 640,
                    height: 60,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 20,
                  }}
                  data-testid="metadata-overlay"
                >
                  <div
                    className="flex flex-wrap items-center justify-center gap-2"
                    style={{ maxWidth: 620 }}
                  >
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
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-80 border-l border-border bg-card p-4">
          <h3 className="font-semibold text-sm text-foreground mb-3">Quick Tips</h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>• Click player circles to select and drag them</p>
            <p>• Double-click circles to add labels (max 2 chars)</p>
            <p>• Press Delete/Backspace to remove selected items</p>
            <p>• Use Route tool: click player, add waypoints, double-click to finish</p>
            {playType === "defense" && <p>• Use Shape tool to draw coverage zones</p>}
            <p>• Export plays at custom sizes for playbooks</p>
          </div>
        </div>
      </div>
    </div>
  );
}
