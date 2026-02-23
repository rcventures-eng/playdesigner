import { toPng } from "html-to-image";
import { createRoot } from "react-dom/client";
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
  hasRPO?: boolean;
}

interface PlayNote {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

interface PlayData {
  players?: Player[];
  routes?: Route[];
  shapes?: Shape[];
  football?: { x: number; y: number };
  footballs?: Football[];
  playAction?: { x: number; y: number };
  isPlayAction?: boolean;
  isRPO?: boolean;
  overlayPlayers?: Player[];
  overlayRoutes?: Route[];
  notes?: PlayNote[];
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

interface PlayMetadata {
  name?: string;
  formation?: string;
  concept?: string;
  situation?: string;
}

function PlaySVGForExport({ 
  playData, 
  playType, 
  playName,
  metadata,
  isLessColor = false
}: { 
  playData: PlayData | null; 
  playType: "offense" | "defense" | "special"; 
  playName?: string;
  metadata?: PlayMetadata;
  isLessColor?: boolean;
}) {
  const players = playData?.players || [];
  const routes = playData?.routes || [];
  const shapes = playData?.shapes || [];
  const overlayPlayers = playData?.overlayPlayers || [];
  const overlayRoutes = playData?.overlayRoutes || [];
  const notes = playData?.notes || [];
  
  const rawFootballs = playData?.footballs || [];
  const legacyFootball = playData?.football;
  const legacyPlayAction = playData?.playAction;
  const legacyIsPlayAction = playData?.isPlayAction;
  const legacyIsRPO = playData?.isRPO;
  
  const footballs = rawFootballs.map((fb) => ({
    ...fb,
    hasPlayAction: fb.hasPlayAction ?? legacyIsPlayAction ?? false,
    hasRPO: fb.hasRPO ?? legacyIsRPO ?? false
  }));
  
  const fieldStartY = FIELD.getFieldStartY(playType);
  const losY = FIELD.getLosY(playType);
  
  const allPlayers = [...players, ...overlayPlayers];
  const allRoutes = [...routes, ...overlayRoutes];

  return (
    <div 
      style={{ 
        width: FIELD.WIDTH,
        height: FIELD.HEIGHT,
        background: isLessColor ? '#FFFFFF' : 'linear-gradient(to bottom, #16a34a, #15803d)',
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
        border: isLessColor ? '3px solid #16a34a' : 'none',
        boxSizing: 'border-box',
      }}
    >
      <svg 
        viewBox={`0 0 ${FIELD.WIDTH} ${FIELD.HEIGHT}`}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect
          x={0}
          y={FIELD.getHeaderStartY(playType)}
          width={FIELD.WIDTH}
          height={FIELD.HEADER_HEIGHT}
          fill="white"
        />
        
        {/* Render metadata boxes like the Play Designer */}
        {(() => {
          const headerY = FIELD.getHeaderStartY(playType);
          const boxHeight = 30;
          const boxY = headerY + (FIELD.HEADER_HEIGHT - boxHeight) / 2;
          const boxRadius = 5;
          const fontSize = 13;
          const padding = 10;
          const gap = 8;
          
          // Get display name (prefer metadata.name, fallback to playName)
          const displayName = metadata?.name || playName || "";
          const formation = metadata?.formation || "";
          const concept = metadata?.concept || "";
          const situation = metadata?.situation || "";
          
          // Calculate box widths based on content (approximate)
          const charWidth = 6.5;
          const nameWidth = displayName ? Math.max(70, displayName.length * charWidth + padding * 2) : 0;
          const formationWidth = formation ? Math.max(90, ("Formation: " + formation).length * charWidth + padding * 2) : 0;
          const conceptWidth = concept ? Math.max(70, ("Concept: " + concept).length * charWidth + padding * 2) : 0;
          const situationWidth = situation ? Math.max(80, ("Situation: " + situation).length * charWidth + padding * 2) : 0;
          
          // Calculate total width and starting X to center
          const totalWidth = [nameWidth, formationWidth, conceptWidth, situationWidth]
            .filter(w => w > 0)
            .reduce((sum, w, i, arr) => sum + w + (i < arr.length - 1 ? gap : 0), 0);
          let currentX = (FIELD.WIDTH - totalWidth) / 2;
          
          const boxes: JSX.Element[] = [];
          
          // High-contrast box styling for Less Color mode
          const boxFill = isLessColor ? "#FFFFFF" : undefined;
          const boxStroke = isLessColor ? "#000000" : undefined;
          const boxTextFill = isLessColor ? "#000000" : "white";
          
          // Play name box (orange, or white with black border in less color mode)
          if (displayName) {
            boxes.push(
              <g key="name">
                <rect
                  x={currentX}
                  y={boxY}
                  width={nameWidth}
                  height={boxHeight}
                  rx={boxRadius}
                  fill={boxFill || "#ea580c"}
                  stroke={boxStroke}
                  strokeWidth={boxStroke ? 1 : 0}
                />
                <text
                  x={currentX + nameWidth / 2}
                  y={boxY + boxHeight / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={boxTextFill}
                  fontSize={fontSize}
                  fontWeight="bold"
                >
                  {displayName}
                </text>
              </g>
            );
            currentX += nameWidth + gap;
          }
          
          // Formation box (dark gray, or white with black border in less color mode)
          if (formation) {
            boxes.push(
              <g key="formation">
                <rect
                  x={currentX}
                  y={boxY}
                  width={formationWidth}
                  height={boxHeight}
                  rx={boxRadius}
                  fill={boxFill || "#374151"}
                  stroke={boxStroke}
                  strokeWidth={boxStroke ? 1 : 0}
                />
                <text
                  x={currentX + formationWidth / 2}
                  y={boxY + boxHeight / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={boxTextFill}
                  fontSize={fontSize}
                  fontWeight="500"
                >
                  Formation: {formation}
                </text>
              </g>
            );
            currentX += formationWidth + gap;
          }
          
          // Concept box (dark gray, or white with black border in less color mode)
          if (concept) {
            boxes.push(
              <g key="concept">
                <rect
                  x={currentX}
                  y={boxY}
                  width={conceptWidth}
                  height={boxHeight}
                  rx={boxRadius}
                  fill={boxFill || "#374151"}
                  stroke={boxStroke}
                  strokeWidth={boxStroke ? 1 : 0}
                />
                <text
                  x={currentX + conceptWidth / 2}
                  y={boxY + boxHeight / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={boxTextFill}
                  fontSize={fontSize}
                  fontWeight="500"
                >
                  Concept: {concept}
                </text>
              </g>
            );
            currentX += conceptWidth + gap;
          }
          
          // Situation box (dark gray, or white with black border in less color mode)
          if (situation) {
            boxes.push(
              <g key="situation">
                <rect
                  x={currentX}
                  y={boxY}
                  width={situationWidth}
                  height={boxHeight}
                  rx={boxRadius}
                  fill={boxFill || "#374151"}
                  stroke={boxStroke}
                  strokeWidth={boxStroke ? 1 : 0}
                />
                <text
                  x={currentX + situationWidth / 2}
                  y={boxY + boxHeight / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={boxTextFill}
                  fontSize={fontSize}
                  fontWeight="500"
                >
                  Situation: {situation}
                </text>
              </g>
            );
          }
          
          return boxes;
        })()}
        
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
              stroke={isLessColor ? "#16a34a" : "white"}
              strokeWidth={2}
              opacity={isLessColor ? 0.6 : 0.3}
            />
          );
        })}
        
        <line
          x1={FIELD.FIELD_LEFT}
          y1={losY}
          x2={FIELD.FIELD_RIGHT}
          y2={losY}
          stroke="#3b82f6"
          strokeWidth={3}
          opacity={0.8}
        />
        
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
            {fb.hasRPO && (
              <g>
                <circle cx={fb.x + (fb.hasPlayAction ? 20 : 0)} cy={fb.y + 12} r={9} fill="white" stroke="black" strokeWidth={1.5} />
                <text x={fb.x + (fb.hasPlayAction ? 20 : 0)} y={fb.y + 12} textAnchor="middle" dominantBaseline="middle" fill="black" fontSize={8} fontWeight="bold">RPO</text>
              </g>
            )}
          </g>
        ))}
        
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
            {legacyIsRPO && (
              <g>
                <circle cx={legacyFootball.x + ((legacyPlayAction || legacyIsPlayAction) ? 20 : 0)} cy={legacyFootball.y + 12} r={9} fill="white" stroke="black" strokeWidth={1.5} />
                <text x={legacyFootball.x + ((legacyPlayAction || legacyIsPlayAction) ? 20 : 0)} y={legacyFootball.y + 12} textAnchor="middle" dominantBaseline="middle" fill="black" fontSize={8} fontWeight="bold">RPO</text>
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
            opacity={0.3}
            stroke={shape.color}
            strokeWidth={2}
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
          
          let lastPoint = route.points[route.points.length - 1];
          let secondLastPoint = route.points[route.points.length - 2];
          for (let i = route.points.length - 2; i >= 0; i--) {
            const dx = lastPoint.x - route.points[i].x;
            const dy = lastPoint.y - route.points[i].y;
            if (Math.sqrt(dx * dx + dy * dy) >= 2) {
              secondLastPoint = route.points[i];
              break;
            }
          }
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
              <polygon
                points={`0,-5 10,0 0,5`}
                fill={strokeColor}
                transform={`translate(${lastPoint.x}, ${lastPoint.y}) rotate(${angle * 180 / Math.PI})`}
              />
            </g>
          );
        })}
        
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
      
      {/* Play Notes - rendered as HTML overlays for export */}
      {notes.map((note) => (
        <div
          key={note.id}
          style={{
            position: 'absolute',
            left: note.x,
            top: note.y,
            width: note.width,
            minHeight: note.height,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(0, 0, 0, 0.2)',
            borderRadius: 4,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            padding: '4px 6px',
            fontSize: 11,
            lineHeight: 1.3,
            color: '#000000',
            overflow: 'hidden',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {note.text}
        </div>
      ))}
    </div>
  );
}

export interface RenderedPlayImage {
  base64: string;
  width: number;
  height: number;
}

export async function renderPlayToBase64(
  playData: PlayData | null,
  playType: "offense" | "defense" | "special",
  playName?: string,
  metadata?: PlayMetadata,
  pixelRatio: number = 2,
  isLessColor: boolean = false
): Promise<RenderedPlayImage> {
  return new Promise((resolve, reject) => {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    document.body.appendChild(container);

    const root = createRoot(container);
    
    root.render(
      <PlaySVGForExport
        playData={playData}
        playType={playType}
        playName={playName}
        metadata={metadata}
        isLessColor={isLessColor}
      />
    );

    setTimeout(async () => {
      try {
        const element = container.firstChild as HTMLElement;
        if (!element) {
          throw new Error("Failed to render play element");
        }

        const dataUrl = await toPng(element, {
          quality: 1.0,
          pixelRatio: pixelRatio,
          backgroundColor: isLessColor ? '#FFFFFF' : '#16a34a',
        });

        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        
        // Get actual rendered dimensions (native * pixelRatio)
        const width = FIELD.WIDTH * pixelRatio;
        const height = FIELD.HEIGHT * pixelRatio;
        
        root.unmount();
        document.body.removeChild(container);
        
        resolve({ base64, width, height });
      } catch (error) {
        root.unmount();
        document.body.removeChild(container);
        reject(error);
      }
    }, 100);
  });
}

export interface PlayImageData {
  base64: string;
  width: number;
  height: number;
}

export async function renderPlaysToImages(
  plays: Array<{
    id: number;
    name: string;
    type: string;
    data?: any;
    formation?: string;
    concept?: string;
    situation?: string;
  }>,
  onProgress?: (current: number, total: number) => void,
  pixelRatio: number = 2,
  isLessColor: boolean = false
): Promise<Record<number, PlayImageData>> {
  const images: Record<number, PlayImageData> = {};
  
  for (let i = 0; i < plays.length; i++) {
    const play = plays[i];
    
    if (onProgress) {
      onProgress(i + 1, plays.length);
    }
    
    try {
      const playData = typeof play.data === 'string' ? JSON.parse(play.data) : play.data;
      const playType = (play.type || 'offense') as "offense" | "defense" | "special";
      
      // Build metadata for the header
      const metadata: PlayMetadata = {
        name: play.name,
        formation: play.formation,
        concept: play.concept,
        situation: play.situation,
      };
      
      const result = await renderPlayToBase64(playData, playType, play.name, metadata, pixelRatio, isLessColor);
      images[play.id] = result;
    } catch (error) {
      console.error(`Failed to render play ${play.id} (${play.name}):`, error);
    }
  }
  
  return images;
}
