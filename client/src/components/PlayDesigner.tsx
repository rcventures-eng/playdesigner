import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Copy, Plus, Trash2, Circle, MoveHorizontal, PenTool, Square, Type } from "lucide-react";
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
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "player" | "route" | "zone" | "label">("select");
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
  const [exportWidth, setExportWidth] = useState("694");
  const [exportHeight, setExportHeight] = useState("392");
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDrawingRoute, setIsDrawingRoute] = useState(false);
  const [currentRoutePoints, setCurrentRoutePoints] = useState<{ x: number; y: number }[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const offenseColors = ["#22c55e", "#3b82f6", "#ef4444", "#eab308", "#000000", "#f97316", "#6b7280"];
  const defenseColors = ["#92400e", "#db2777", "#9333ea"];
  const colors = playType === "offense" ? offenseColors : defenseColors;

  const addPlayer = (color: string) => {
    const newPlayer: Player = {
      id: `player-${Date.now()}`,
      x: 400,
      y: 200,
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
  };

  const handlePlayerMouseDown = (e: React.MouseEvent, playerId: string) => {
    if (tool === "select") {
      e.stopPropagation();
      const player = players.find(p => p.id === playerId);
      if (player) {
        setSelectedPlayer(playerId);
        setSelectedRoute(null);
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
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const player = players.find(p => p.id === playerId);
        if (player) {
          setCurrentRoutePoints([{ x: player.x, y: player.y }]);
        }
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isDragging && selectedPlayer) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const newX = e.clientX - rect.left - dragOffset.x;
        const newY = e.clientY - rect.top - dragOffset.y;
        setPlayers(players.map(p =>
          p.id === selectedPlayer ? { ...p, x: Math.max(0, Math.min(800, newX)), y: Math.max(0, Math.min(400, newY)) } : p
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

  const finishRoute = () => {
    if (isDrawingRoute && selectedPlayer && currentRoutePoints.length > 1) {
      const newRoute: Route = {
        id: `route-${Date.now()}`,
        playerId: selectedPlayer,
        points: currentRoutePoints,
        type: routeType,
        style: routeStyle,
        isMotion: isMotion && currentRoutePoints[0].y > 200,
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
          transform: `scale(${parseInt(exportWidth) / 800})`,
          transformOrigin: 'top left',
        },
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
      const dataUrl = await toPng(canvasRef.current);
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

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className="w-80 border-r border-border bg-card flex flex-col overflow-hidden">
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
                <Input
                  id="formation"
                  data-testid="input-formation"
                  placeholder="I-Formation, Shotgun..."
                  value={metadata.formation}
                  onChange={(e) => setMetadata({ ...metadata, formation: e.target.value })}
                  className="h-8 text-sm"
                />
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
                  variant={tool === "zone" ? "default" : "secondary"}
                  onClick={() => setTool("zone")}
                  data-testid="button-tool-zone"
                  className="justify-start"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Zone
                </Button>
              )}
              <Button
                size="sm"
                variant={tool === "label" ? "default" : "secondary"}
                onClick={() => setTool("label")}
                data-testid="button-tool-label"
                className="justify-start"
              >
                <Type className="h-4 w-4 mr-2" />
                Label
              </Button>
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
                    Finish Route
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

          {(selectedPlayer || selectedRoute) && (
            <Button
              size="sm"
              variant="destructive"
              onClick={deleteSelected}
              data-testid="button-delete-selected"
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 bg-muted/30 p-8 overflow-auto flex items-center justify-center">
        <div className="bg-background rounded-lg shadow-lg p-4">
          <div
            ref={canvasRef}
            className="relative bg-gradient-to-b from-green-700 to-green-600 rounded cursor-crosshair"
            style={{ width: 800, height: 400 }}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onClick={handleCanvasClick}
            data-testid="canvas-field"
          >
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                <pattern id="hashmarks" x="0" y="0" width="80" height="40" patternUnits="userSpaceOnUse">
                  <line x1="40" y1="0" x2="40" y2="40" stroke="white" strokeWidth="1" opacity="0.3" />
                </pattern>
              </defs>
              <rect width="800" height="400" fill="url(#hashmarks)" />
              <line x1="0" y1="200" x2="800" y2="200" stroke="white" strokeWidth="3" />
              <text x="400" y="195" fill="white" fontSize="12" textAnchor="middle" opacity="0.5">Line of Scrimmage</text>
            </svg>

            {routes.filter(r => showBlocking || r.type !== "blocking").map((route) => (
              <svg key={route.id} className="absolute inset-0 w-full h-full pointer-events-none">
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
                  }}
                  className="pointer-events-auto cursor-pointer"
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
              </svg>
            ))}

            {isDrawingRoute && currentRoutePoints.length > 0 && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
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
              </svg>
            )}

            {players.map((player) => (
              <div
                key={player.id}
                className="absolute cursor-pointer hover:scale-110 transition-transform"
                style={{
                  left: player.x - 24,
                  top: player.y - 24,
                  width: 48,
                  height: 48,
                }}
                onMouseDown={(e) => handlePlayerMouseDown(e, player.id)}
                data-testid={`player-${player.id}`}
              >
                <div
                  className={`w-12 h-12 rounded-full border-4 flex items-center justify-center text-white font-bold text-sm ${
                    selectedPlayer === player.id ? "ring-4 ring-cyan-400" : ""
                  }`}
                  style={{ backgroundColor: player.color, borderColor: "white" }}
                >
                  {player.label || ""}
                </div>
              </div>
            ))}

            <div
              className="absolute cursor-pointer"
              style={{ left: 370, top: 185, width: 60, height: 30 }}
              data-testid="football"
            >
              <svg width="60" height="30" viewBox="0 0 60 30">
                <ellipse cx="30" cy="15" rx="28" ry="13" fill="#8B4513" stroke="#654321" strokeWidth="2" />
                <line x1="20" y1="10" x2="20" y2="20" stroke="#FFFFFF" strokeWidth="1" />
                <line x1="25" y1="8" x2="25" y2="22" stroke="#FFFFFF" strokeWidth="1" />
                <line x1="30" y1="7" x2="30" y2="23" stroke="#FFFFFF" strokeWidth="1" />
                <line x1="35" y1="8" x2="35" y2="22" stroke="#FFFFFF" strokeWidth="1" />
                <line x1="40" y1="10" x2="40" y2="20" stroke="#FFFFFF" strokeWidth="1" />
              </svg>
            </div>
          </div>

          {metadata.name && (
            <div className="mt-4 text-center">
              <Badge variant="outline" className="text-sm" data-testid="badge-play-name">
                {metadata.name}
              </Badge>
              {metadata.formation && (
                <Badge variant="secondary" className="ml-2 text-sm" data-testid="badge-formation">
                  {metadata.formation}
                </Badge>
              )}
              {metadata.concept && (
                <Badge variant="secondary" className="ml-2 text-sm" data-testid="badge-concept">
                  {metadata.concept}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
