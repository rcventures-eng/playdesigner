import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Copy, Plus, Trash2, Circle as CircleIcon, MoveHorizontal, PenTool, Square as SquareIcon, Type, Hexagon } from "lucide-react";
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
  type: "primary" | "secondary" | "decision" | "blocking";
  style: "straight" | "curved";
  priority?: number;
  isMotion?: boolean;
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

export default function PlayDesigner() {
  const [playType, setPlayType] = useState<"offense" | "defense" | "special">("offense");
  const [players, setPlayers] = useState<Player[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedShape, setSelectedShape] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [tool, setTool] = useState<"select" | "player" | "route" | "shape" | "label">("select");
  const [shapeType, setShapeType] = useState<"circle" | "oval" | "square" | "rectangle">("circle");
  const [shapeColor, setShapeColor] = useState("#ec4899");
  const [routeType, setRouteType] = useState<"primary" | "secondary" | "decision" | "blocking">("primary");
  const [routeStyle, setRouteStyle] = useState<"straight" | "curved">("straight");
  const [isMotion, setIsMotion] = useState(false);
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const offenseColors = ["#22c55e", "#3b82f6", "#ef4444", "#eab308", "#000000", "#f97316", "#6b7280"];
  const defenseColors = ["#92400e", "#db2777", "#9333ea"];
  const shapeColors = ["#ec4899", "#3b82f6", "#86efac"];
  const colors = playType === "offense" ? offenseColors : defenseColors;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editingPlayer) return;
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
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPlayer, selectedRoute, selectedShape, editingPlayer]);

  const addPlayer = (color: string) => {
    const newPlayer: Player = {
      id: `player-${Date.now()}`,
      x: 344,
      y: 540,
      color,
    };
    setPlayers([...players, newPlayer]);
    setTool("select");
  };

  const deleteSelected = () => {
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

  const handlePlayerMouseDown = (e: React.MouseEvent, playerId: string) => {
    if (tool === "select") {
      e.stopPropagation();
      const player = players.find(p => p.id === playerId);
      if (player) {
        setSelectedPlayer(playerId);
        setSelectedRoute(null);
        setSelectedShape(null);
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
      setSelectedPlayer(playerId);
      const player = players.find(p => p.id === playerId);
      if (player) {
        setCurrentRoutePoints([{ x: player.x, y: player.y }]);
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
    if (isDragging && selectedPlayer) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const newX = e.clientX - rect.left - dragOffset.x;
        const newY = e.clientY - rect.top - dragOffset.y;
        setPlayers(players.map(p =>
          p.id === selectedPlayer ? { ...p, x: Math.max(36, Math.min(652, newX)), y: Math.max(36, Math.min(624, newY)) } : p
        ));
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isDrawingRoute) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setCurrentRoutePoints([...currentRoutePoints, { x, y }]);
      }
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (isDrawingRoute) {
      finishRoute();
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (tool === "shape" && playType === "defense") {
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
    if (isDrawingRoute && selectedPlayer && currentRoutePoints.length > 1) {
      const newRoute: Route = {
        id: `route-${Date.now()}`,
        playerId: selectedPlayer,
        points: currentRoutePoints,
        type: routeType,
        style: routeStyle,
        isMotion: isMotion,
        priority: routeType === "secondary" ? 2 : undefined,
      };
      setRoutes([...routes, newRoute]);
    }
    setIsDrawingRoute(false);
    setCurrentRoutePoints([]);
  };

  const exportAsImage = async () => {
    if (!canvasRef.current) return;
    
    try {
      const dataUrl = await toPng(canvasRef.current, {
        width: parseInt(exportWidth),
        height: parseInt(exportHeight),
        style: {
          transform: `scale(${parseInt(exportWidth) / 640})`,
          transformOrigin: 'top left',
        },
        skipFonts: true,
      });
      
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
      const dataUrl = await toPng(canvasRef.current, {
        skipFonts: true,
      });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      
      toast({
        title: "Copied!",
        description: "Play copied to clipboard",
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

  const getRouteColor = (type: string) => {
    switch (type) {
      case "primary": return "#ef4444";
      case "decision": return "#3b82f6";
      case "blocking": return "#f97316";
      default: return "#000000";
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
          onClick={(e) => {
            e.stopPropagation();
            setSelectedShape(shape.id);
            setSelectedPlayer(null);
            setSelectedRoute(null);
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
          onClick={(e) => {
            e.stopPropagation();
            setSelectedShape(shape.id);
            setSelectedPlayer(null);
            setSelectedRoute(null);
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
          onClick={(e) => {
            e.stopPropagation();
            setSelectedShape(shape.id);
            setSelectedPlayer(null);
            setSelectedRoute(null);
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
          onClick={(e) => {
            e.stopPropagation();
            setSelectedShape(shape.id);
            setSelectedPlayer(null);
            setSelectedRoute(null);
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
              Formation: {metadata.formation}
            </Badge>
          )}
          {metadata.concept && (
            <Badge variant="secondary" className="bg-secondary/80 text-secondary-foreground font-medium px-3 py-1.5" data-testid="badge-concept">
              Concept: {metadata.concept}
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
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={tool === "select" ? "default" : "secondary"}
                  onClick={() => setTool("select")}
                  data-testid="button-tool-select"
                  className="justify-start"
                >
                  <MoveHorizontal className="h-4 w-4 mr-2" />
                  Select
                </Button>
                <Button
                  size="sm"
                  variant={tool === "route" ? "default" : "secondary"}
                  onClick={() => setTool("route")}
                  data-testid="button-tool-route"
                  className="justify-start"
                >
                  <PenTool className="h-4 w-4 mr-2" />
                  Route
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
                </div>
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
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant={routeType === "primary" ? "default" : "outline"}
                        onClick={() => setRouteType("primary")}
                        data-testid="button-route-primary"
                      >
                        Primary
                      </Button>
                      <Button
                        size="sm"
                        variant={routeType === "secondary" ? "default" : "outline"}
                        onClick={() => setRouteType("secondary")}
                        data-testid="button-route-secondary"
                      >
                        2nd/3rd
                      </Button>
                      <Button
                        size="sm"
                        variant={routeType === "decision" ? "default" : "outline"}
                        onClick={() => setRouteType("decision")}
                        data-testid="button-route-decision"
                      >
                        Decision
                      </Button>
                      <Button
                        size="sm"
                        variant={routeType === "blocking" ? "default" : "outline"}
                        onClick={() => setRouteType("blocking")}
                        data-testid="button-route-blocking"
                      >
                        Blocking
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

            {(selectedPlayer || selectedRoute || selectedShape) && (
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
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
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
                
                {/* Line of scrimmage (8 yards from bottom = y=540) */}
                <line x1="24" y1="540" x2="664" y2="540" stroke="white" strokeWidth="6" />
              </svg>

              <svg className="absolute inset-0 w-full h-full">
                {shapes.map(shape => renderShape(shape))}

                {routes.filter(r => showBlocking || r.type !== "blocking").map((route) => (
                  <g key={route.id}>
                    <path
                      d={getRoutePath(route)}
                      stroke={getRouteColor(route.type)}
                      strokeWidth="3"
                      fill="none"
                      strokeDasharray={route.isMotion ? "5,5" : "none"}
                      markerEnd="url(#arrowhead)"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRoute(route.id);
                        setSelectedPlayer(null);
                        setSelectedShape(null);
                      }}
                      className="cursor-pointer"
                      data-testid={`route-${route.id}`}
                    />
                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <polygon points="0 0, 10 3, 0 6" fill={getRouteColor(route.type)} />
                      </marker>
                    </defs>
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
                  </g>
                ))}

                {isDrawingRoute && currentRoutePoints.length > 0 && (
                  <g>
                    <path
                      d={getRoutePath({ points: currentRoutePoints, type: routeType, style: routeStyle } as Route)}
                      stroke={getRouteColor(routeType)}
                      strokeWidth="3"
                      fill="none"
                      strokeDasharray={isMotion ? "5,5" : "none"}
                      opacity="0.5"
                    />
                    {currentRoutePoints.map((point, idx) => (
                      <circle key={idx} cx={point.x} cy={point.y} r="4" fill="white" stroke="#000" strokeWidth="1" />
                    ))}
                  </g>
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
                  }}
                  onMouseDown={(e) => handlePlayerMouseDown(e, player.id)}
                  onDoubleClick={(e) => handlePlayerDoubleClick(e, player.id)}
                  data-testid={`player-${player.id}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                      selectedPlayer === player.id ? "ring-2 ring-cyan-400" : ""
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

              <div
                className="absolute"
                style={{ left: 329, top: 532.5, width: 30, height: 15 }}
                data-testid="football"
              >
                <svg width="30" height="15" viewBox="0 0 30 15">
                  <ellipse cx="15" cy="7.5" rx="14" ry="6.5" fill="#8B4513" stroke="#654321" strokeWidth="1" />
                  <line x1="10" y1="5" x2="10" y2="10" stroke="#FFFFFF" strokeWidth="0.5" />
                  <line x1="12.5" y1="4" x2="12.5" y2="11" stroke="#FFFFFF" strokeWidth="0.5" />
                  <line x1="15" y1="3.5" x2="15" y2="11.5" stroke="#FFFFFF" strokeWidth="0.5" />
                  <line x1="17.5" y1="4" x2="17.5" y2="11" stroke="#FFFFFF" strokeWidth="0.5" />
                  <line x1="20" y1="5" x2="20" y2="10" stroke="#FFFFFF" strokeWidth="0.5" />
                </svg>
              </div>
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
