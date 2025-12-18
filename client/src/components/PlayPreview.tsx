import { FOOTBALL_CONFIG, resolveColorKey } from "@shared/football-config";

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

interface PlayPreviewProps {
  playData: PlayData | null;
  playType: "offense" | "defense" | "special";
  playName?: string;
  formation?: string;
  scale?: number;
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

export function PlayPreview({ playData, playType, playName, formation, scale = 0.3 }: PlayPreviewProps) {
  const players = playData?.players || [];
  const routes = playData?.routes || [];
  const shapes = playData?.shapes || [];
  const overlayPlayers = playData?.overlayPlayers || [];
  const overlayRoutes = playData?.overlayRoutes || [];
  
  // Support both new footballs array format and legacy single football format
  const rawFootballs = playData?.footballs || [];
  const legacyFootball = playData?.football;
  const legacyPlayAction = playData?.playAction;
  const legacyIsPlayAction = playData?.isPlayAction;
  
  // Migrate footballs that don't have hasPlayAction set - apply global isPlayAction if present
  const footballs = rawFootballs.map((fb) => ({
    ...fb,
    hasPlayAction: fb.hasPlayAction ?? legacyIsPlayAction ?? false
  }));
  
  const fieldStartY = FIELD.getFieldStartY(playType);
  const losY = FIELD.getLosY(playType);
  
  const allPlayers = [...players, ...overlayPlayers];
  const allRoutes = [...routes, ...overlayRoutes];

  return (
    <div 
      className="relative rounded overflow-hidden bg-gradient-to-b from-green-600 to-green-700"
      style={{ 
        width: FIELD.WIDTH * scale, 
        height: FIELD.HEIGHT * scale,
      }}
    >
      <svg 
        viewBox={`0 0 ${FIELD.WIDTH} ${FIELD.HEIGHT}`}
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* White header */}
        <rect
          x={0}
          y={FIELD.getHeaderStartY(playType)}
          width={FIELD.WIDTH}
          height={FIELD.HEADER_HEIGHT}
          fill="white"
        />
        
        {/* Play name in header */}
        {playName && (
          <text
            x={FIELD.WIDTH / 2}
            y={FIELD.getHeaderStartY(playType) + FIELD.HEADER_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ea580c"
            fontSize={14}
            fontWeight="bold"
          >
            {playName}
          </text>
        )}
        
        {/* Field lines */}
        {Array.from({ length: Math.floor(FIELD.FIELD_HEIGHT / 60) + 1 }, (_, i) => {
          const y = fieldStartY + i * 60;
          if (y > fieldStartY + FIELD.FIELD_HEIGHT - FIELD.BOTTOM_PADDING) return null;
          return (
            <line
              key={`yard-${i}`}
              x1={FIELD.FIELD_LEFT}
              y1={y}
              x2={FIELD.FIELD_RIGHT}
              y2={y}
              stroke="white"
              strokeWidth={2}
              opacity={0.3}
            />
          );
        })}
        
        {/* Line of scrimmage */}
        <line
          x1={FIELD.FIELD_LEFT}
          y1={losY}
          x2={FIELD.FIELD_RIGHT}
          y2={losY}
          stroke="#3b82f6"
          strokeWidth={3}
          opacity={0.8}
        />
        
        {/* Footballs - new format with individual PA flags */}
        {footballs.map((fb) => (
          <g key={fb.id}>
            <ellipse
              cx={fb.x}
              cy={fb.y}
              rx={10}
              ry={6}
              fill="#8B4513"
              stroke="#5C3317"
              strokeWidth={1}
            />
            {fb.hasPlayAction && (
              <g>
                <circle cx={fb.x} cy={fb.y + 12} r={8} fill="black" />
                <text x={fb.x} y={fb.y + 16} textAnchor="middle" fill="white" fontSize={10} fontWeight="bold">PA</text>
              </g>
            )}
          </g>
        ))}
        
        {/* Legacy football support - single football with separate playAction */}
        {legacyFootball && footballs.length === 0 && (
          <g>
            <ellipse
              cx={legacyFootball.x}
              cy={legacyFootball.y}
              rx={10}
              ry={6}
              fill="#8B4513"
              stroke="#5C3317"
              strokeWidth={1}
            />
            {(legacyPlayAction || legacyIsPlayAction) && (
              <g>
                <circle cx={legacyPlayAction?.x || legacyFootball.x} cy={legacyPlayAction?.y || legacyFootball.y + 12} r={8} fill="black" />
                <text x={legacyPlayAction?.x || legacyFootball.x} y={(legacyPlayAction?.y || legacyFootball.y + 12) + 4} textAnchor="middle" fill="white" fontSize={10} fontWeight="bold">PA</text>
              </g>
            )}
          </g>
        )}
        
        {/* Shapes (zone coverage) */}
        {shapes.map((shape) => (
          <ellipse
            key={shape.id}
            cx={shape.x + shape.width / 2}
            cy={shape.y + shape.height / 2}
            rx={shape.width / 2}
            ry={shape.height / 2}
            fill={shape.color}
            opacity={0.3}
            stroke={shape.color}
            strokeWidth={2}
          />
        ))}
        
        {/* Routes */}
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
          
          return (
            <g key={route.id}>
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={isPrimary ? 4 : 2}
                strokeDasharray={isMotion ? "6,4" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Arrowhead */}
              <polygon
                points={`0,-5 10,0 0,5`}
                fill={strokeColor}
                transform={`translate(${lastPoint.x}, ${lastPoint.y}) rotate(${angle * 180 / Math.PI})`}
              />
            </g>
          );
        })}
        
        {/* Players */}
        {allPlayers.map((player) => {
          const isDefense = player.side === "defense";
          const size = 12;
          const playerColor = getPlayerColor(player);
          
          if (isDefense) {
            return (
              <g key={player.id}>
                <line
                  x1={player.x - size}
                  y1={player.y - size}
                  x2={player.x + size}
                  y2={player.y + size}
                  stroke={playerColor}
                  strokeWidth={3}
                />
                <line
                  x1={player.x + size}
                  y1={player.y - size}
                  x2={player.x - size}
                  y2={player.y + size}
                  stroke={playerColor}
                  strokeWidth={3}
                />
                <text
                  x={player.x}
                  y={player.y - size - 4}
                  textAnchor="middle"
                  fill="white"
                  fontSize={10}
                  fontWeight="bold"
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
                r={size}
                fill={playerColor}
                stroke="white"
                strokeWidth={2}
              />
              <text
                x={player.x}
                y={player.y + 4}
                textAnchor="middle"
                fill="white"
                fontSize={10}
                fontWeight="bold"
              >
                {player.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
