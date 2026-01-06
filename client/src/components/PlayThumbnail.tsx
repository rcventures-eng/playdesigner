import { useMemo } from "react";
import { StickyNote } from "lucide-react";
import { FOOTBALL_CONFIG, resolveColorKey } from "@shared/football-config";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Player {
  id: string;
  label: string;
  x: number;
  y: number;
  color?: string;
  colorKey?: string;
  side: "offense" | "defense";
}

interface Route {
  id: string;
  playerId: string;
  points: { x: number; y: number }[];
  type: string;
  style: "curved" | "straight";
  isMotion?: boolean;
  priority?: number;
  color?: string;
}

interface Shape {
  id: string;
  playerId: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface Football {
  id: string;
  x: number;
  y: number;
  hasPlayAction?: boolean;
}

interface PlayData {
  players?: Player[];
  routes?: Route[];
  shapes?: Shape[];
  football?: { x: number; y: number };
  footballs?: Football[];
  playAction?: { x: number; y: number };
  isPlayAction?: boolean;
  overlayPlayers?: Player[];
  overlayRoutes?: Route[];
}

interface PlayThumbnailProps {
  playData: PlayData | null;
  playType: "offense" | "defense" | "special";
  playName?: string;
  notes?: string | null;
  width?: number;
  height?: number;
  showNoteIndicator?: boolean;
}

const FIELD = {
  WIDTH: FOOTBALL_CONFIG.field.width,
  HEIGHT: FOOTBALL_CONFIG.field.height,
  HEADER_HEIGHT: FOOTBALL_CONFIG.field.headerHeight,
  FIELD_LEFT: FOOTBALL_CONFIG.field.sidePadding,
  FIELD_RIGHT: FOOTBALL_CONFIG.field.width - FOOTBALL_CONFIG.field.sidePadding,
  LOS_Y: FOOTBALL_CONFIG.field.losY,
  BOTTOM_PADDING: FOOTBALL_CONFIG.field.bottomPadding,
  FIELD_HEIGHT: FOOTBALL_CONFIG.field.height - FOOTBALL_CONFIG.field.headerHeight,
  getFieldStartY: (playType: string) => playType === "defense" ? 0 : FOOTBALL_CONFIG.field.headerHeight,
  getHeaderStartY: (playType: string) => playType === "defense" ? FOOTBALL_CONFIG.field.height - FOOTBALL_CONFIG.field.headerHeight : 0,
  getLosY: (playType: string) => playType === "defense" ? FOOTBALL_CONFIG.field.losY - FOOTBALL_CONFIG.field.headerHeight : FOOTBALL_CONFIG.field.losY,
};

function generateCurvedPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    path += ` Q ${p0.x} ${p0.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
}

function getPlayerColor(player: Player): string {
  if (player.color && player.color.startsWith("#")) {
    return player.color;
  }
  if (player.colorKey) {
    return resolveColorKey(player.colorKey);
  }
  if (player.color) {
    return resolveColorKey(player.color);
  }
  return player.side === "defense" ? "#87CEEB" : "#6b7280";
}

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function calculateBoundingBox(playData: PlayData, playType: string): BoundingBox {
  const players = [...(playData.players || []), ...(playData.overlayPlayers || [])];
  const routes = [...(playData.routes || []), ...(playData.overlayRoutes || [])];
  const shapes = playData.shapes || [];
  const footballs = playData.footballs || [];
  const legacyFootball = playData.football;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const PLAYER_RADIUS = 16;

  players.forEach(p => {
    minX = Math.min(minX, p.x - PLAYER_RADIUS);
    maxX = Math.max(maxX, p.x + PLAYER_RADIUS);
    minY = Math.min(minY, p.y - PLAYER_RADIUS);
    maxY = Math.max(maxY, p.y + PLAYER_RADIUS);
  });

  routes.forEach(route => {
    route.points.forEach(pt => {
      minX = Math.min(minX, pt.x - 8);
      maxX = Math.max(maxX, pt.x + 8);
      minY = Math.min(minY, pt.y - 8);
      maxY = Math.max(maxY, pt.y + 8);
    });
  });

  shapes.forEach(shape => {
    minX = Math.min(minX, shape.x);
    maxX = Math.max(maxX, shape.x + shape.width);
    minY = Math.min(minY, shape.y);
    maxY = Math.max(maxY, shape.y + shape.height);
  });

  footballs.forEach(fb => {
    minX = Math.min(minX, fb.x - 15);
    maxX = Math.max(maxX, fb.x + 15);
    minY = Math.min(minY, fb.y - 10);
    maxY = Math.max(maxY, fb.y + 20);
  });

  if (legacyFootball && footballs.length === 0) {
    minX = Math.min(minX, legacyFootball.x - 15);
    maxX = Math.max(maxX, legacyFootball.x + 15);
    minY = Math.min(minY, legacyFootball.y - 10);
    maxY = Math.max(maxY, legacyFootball.y + 20);
  }

  if (minX === Infinity) {
    const losY = FIELD.getLosY(playType);
    return {
      minX: FIELD.FIELD_LEFT,
      maxX: FIELD.FIELD_RIGHT,
      minY: losY - 80,
      maxY: losY + 80,
    };
  }

  const padding = 20;
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
}

export function PlayThumbnail({ 
  playData, 
  playType, 
  playName,
  notes,
  width = 128, 
  height = 80,
  showNoteIndicator = true,
}: PlayThumbnailProps) {
  const players = playData?.players || [];
  const routes = playData?.routes || [];
  const shapes = playData?.shapes || [];
  const overlayPlayers = playData?.overlayPlayers || [];
  const overlayRoutes = playData?.overlayRoutes || [];
  
  const rawFootballs = playData?.footballs || [];
  const legacyFootball = playData?.football;
  const legacyPlayAction = playData?.playAction;
  const legacyIsPlayAction = playData?.isPlayAction;
  
  const footballs = rawFootballs.map((fb) => ({
    ...fb,
    hasPlayAction: fb.hasPlayAction ?? legacyIsPlayAction ?? false
  }));
  
  const losY = FIELD.getLosY(playType);
  
  const allPlayers = [...players, ...overlayPlayers];
  const allRoutes = [...routes, ...overlayRoutes];

  const viewBox = useMemo(() => {
    if (!playData || allPlayers.length === 0) {
      return {
        x: FIELD.FIELD_LEFT - 10,
        y: losY - 100,
        width: FIELD.FIELD_RIGHT - FIELD.FIELD_LEFT + 20,
        height: 200,
      };
    }

    const bbox = calculateBoundingBox(playData, playType);
    
    const contentWidth = bbox.maxX - bbox.minX;
    const contentHeight = bbox.maxY - bbox.minY;
    
    const aspectRatio = width / height;
    const contentAspect = contentWidth / contentHeight;
    
    let viewWidth: number;
    let viewHeight: number;
    
    if (contentAspect > aspectRatio) {
      viewWidth = contentWidth;
      viewHeight = contentWidth / aspectRatio;
    } else {
      viewHeight = contentHeight;
      viewWidth = contentHeight * aspectRatio;
    }
    
    const centerX = (bbox.minX + bbox.maxX) / 2;
    const centerY = (bbox.minY + bbox.maxY) / 2;
    
    return {
      x: centerX - viewWidth / 2,
      y: centerY - viewHeight / 2,
      width: viewWidth,
      height: viewHeight,
    };
  }, [playData, playType, allPlayers.length, width, height, losY]);

  const scale = viewBox.width / 400;
  const playerSize = Math.max(14, 12 / Math.max(0.5, scale));
  const routeWidth = Math.max(3, 2 / Math.max(0.5, scale));
  const primaryRouteWidth = Math.max(5, 4 / Math.max(0.5, scale));
  const fontSize = Math.max(11, 10 / Math.max(0.5, scale));

  const hasNotes = notes && notes.trim().length > 0;

  return (
    <div 
      className="relative rounded overflow-hidden bg-gradient-to-b from-green-600 to-green-700"
      style={{ width, height }}
    >
      <svg 
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect
          x={viewBox.x - 100}
          y={viewBox.y - 100}
          width={viewBox.width + 200}
          height={viewBox.height + 200}
          fill="url(#fieldGradient)"
        />
        
        <defs>
          <linearGradient id="fieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
        </defs>
        
        {Array.from({ length: 10 }, (_, i) => {
          const yardLineY = losY - 180 + i * 40;
          return (
            <line
              key={`yard-${i}`}
              x1={FIELD.FIELD_LEFT}
              y1={yardLineY}
              x2={FIELD.FIELD_RIGHT}
              y2={yardLineY}
              stroke="white"
              strokeWidth={1.5}
              opacity={0.25}
            />
          );
        })}
        
        <line
          x1={FIELD.FIELD_LEFT}
          y1={losY}
          x2={FIELD.FIELD_RIGHT}
          y2={losY}
          stroke="#3b82f6"
          strokeWidth={Math.max(4, 3 / Math.max(0.5, scale))}
          opacity={0.9}
        />
        
        {footballs.map((fb) => (
          <g key={fb.id}>
            <ellipse
              cx={fb.x}
              cy={fb.y}
              rx={12}
              ry={7}
              fill="#8B4513"
              stroke="#5C3317"
              strokeWidth={1.5}
            />
            {fb.hasPlayAction && (
              <g>
                <circle cx={fb.x} cy={fb.y + 14} r={10} fill="black" />
                <text x={fb.x} y={fb.y + 18} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold">PA</text>
              </g>
            )}
          </g>
        ))}
        
        {legacyFootball && footballs.length === 0 && (
          <g>
            <ellipse
              cx={legacyFootball.x}
              cy={legacyFootball.y}
              rx={12}
              ry={7}
              fill="#8B4513"
              stroke="#5C3317"
              strokeWidth={1.5}
            />
            {(legacyPlayAction || legacyIsPlayAction) && (
              <g>
                <circle cx={legacyPlayAction?.x || legacyFootball.x} cy={legacyPlayAction?.y || legacyFootball.y + 14} r={10} fill="black" />
                <text x={legacyPlayAction?.x || legacyFootball.x} y={(legacyPlayAction?.y || legacyFootball.y + 14) + 4} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold">PA</text>
              </g>
            )}
          </g>
        )}
        
        {shapes.map((shape) => (
          <ellipse
            key={shape.id}
            cx={shape.x + shape.width / 2}
            cy={shape.y + shape.height / 2}
            rx={shape.width / 2}
            ry={shape.height / 2}
            fill={shape.color}
            opacity={0.35}
            stroke={shape.color}
            strokeWidth={2.5}
          />
        ))}
        
        {allRoutes.map((route) => {
          if (route.points.length < 2) return null;
          const isPrimary = route.priority === 1;
          const isMotion = route.isMotion;
          const strokeColor = route.color || "#ffffff";
          
          const pathD = route.style === "curved" 
            ? generateCurvedPath(route.points)
            : route.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          
          const lastPoint = route.points[route.points.length - 1];
          const secondLastPoint = route.points[route.points.length - 2];
          const angle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
          
          const arrowSize = isPrimary ? 8 : 6;
          
          return (
            <g key={route.id}>
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={isPrimary ? primaryRouteWidth : routeWidth}
                strokeDasharray={isMotion ? "8,5" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polygon
                points={`0,${-arrowSize/2} ${arrowSize},0 0,${arrowSize/2}`}
                fill={strokeColor}
                transform={`translate(${lastPoint.x}, ${lastPoint.y}) rotate(${angle * 180 / Math.PI})`}
              />
            </g>
          );
        })}
        
        {allPlayers.map((player) => {
          const isDefense = player.side === "defense";
          const playerColor = getPlayerColor(player);
          
          if (isDefense) {
            return (
              <g key={player.id}>
                <line
                  x1={player.x - playerSize}
                  y1={player.y - playerSize}
                  x2={player.x + playerSize}
                  y2={player.y + playerSize}
                  stroke={playerColor}
                  strokeWidth={4}
                />
                <line
                  x1={player.x + playerSize}
                  y1={player.y - playerSize}
                  x2={player.x - playerSize}
                  y2={player.y + playerSize}
                  stroke={playerColor}
                  strokeWidth={4}
                />
                <text
                  x={player.x}
                  y={player.y - playerSize - 5}
                  textAnchor="middle"
                  fill="white"
                  fontSize={fontSize}
                  fontWeight="bold"
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth={0.5}
                  paintOrder="stroke"
                >
                  {player.label}
                </text>
              </g>
            );
          }
          
          return (
            <g key={player.id}>
              <circle
                cx={player.x}
                cy={player.y}
                r={playerSize}
                fill={playerColor}
                stroke="white"
                strokeWidth={2.5}
              />
              <text
                x={player.x}
                y={player.y + fontSize * 0.35}
                textAnchor="middle"
                fill="white"
                fontSize={fontSize}
                fontWeight="bold"
              >
                {player.label}
              </text>
            </g>
          );
        })}
      </svg>
      
      {showNoteIndicator && hasNotes && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className="absolute bottom-1 right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-sm cursor-help"
              data-testid="note-indicator"
            >
              <StickyNote className="w-3 h-3 text-white" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <p className="text-sm">{notes}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
