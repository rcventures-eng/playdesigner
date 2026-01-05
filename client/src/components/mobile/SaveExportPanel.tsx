import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Download, 
  User, 
  Key, 
  Save, 
  FolderOpen, 
  Cloud,
  Check,
  Loader2 
} from "lucide-react";
import type { DraftPlayer, DraftRoute } from "@/hooks/usePlayDraft";

interface SaveExportPanelProps {
  players: DraftPlayer[];
  routes: DraftRoute[];
  playName: string;
  isAuthenticated: boolean;
  isSaving: boolean;
  onDownload: () => Promise<void>;
  onSaveToPlays: () => Promise<void>;
  onAddToTeam: () => void;
  onExportToDrive: () => void;
  onSignUp: () => void;
  onLogin: () => void;
}

export function SaveExportPanel({
  players,
  routes,
  playName,
  isAuthenticated,
  isSaving,
  onDownload,
  onSaveToPlays,
  onAddToTeam,
  onExportToDrive,
  onSignUp,
  onLogin,
}: SaveExportPanelProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSave = async () => {
    await onSaveToPlays();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div 
      className="flex gap-4 h-full p-4 pb-20"
      data-testid="save-export-panel"
    >
      <div className="w-44 shrink-0 space-y-2">
        <div className="relative bg-green-800 rounded-lg aspect-[16/10] overflow-hidden" data-testid="play-preview">
          <MiniPreview players={players} routes={routes} />
        </div>
        <p className="text-sm font-medium text-center truncate">{playName}</p>
        
        {!isAuthenticated && (
          <div className="p-2 border border-green-500 rounded-lg bg-green-500/10">
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Your play is saved in this session.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {isAuthenticated ? (
          <>
            <ActionCard
              icon={Save}
              iconBg="bg-green-500"
              title="Save to My Plays"
              subtitle="Add to your personal library"
              onClick={handleSave}
              isLoading={isSaving}
              isSuccess={saveSuccess}
              highlighted
              testId="button-save-to-plays"
            />

            <ActionCard
              icon={FolderOpen}
              iconBg="bg-blue-500"
              title="Add to Team Playbook"
              subtitle="Select a team"
              onClick={onAddToTeam}
              testId="button-add-to-team"
            />

            <ActionCard
              icon={Download}
              iconBg="bg-gray-500"
              title="Download Play"
              subtitle="Save as PNG image"
              onClick={handleDownload}
              isLoading={isDownloading}
              testId="button-download"
            />

            <ActionCard
              icon={Cloud}
              iconBg="bg-purple-500"
              title="Export to Google Drive"
              subtitle="Docs or Slides format"
              onClick={onExportToDrive}
              testId="button-export-drive"
            />
          </>
        ) : (
          <>
            <ActionCard
              icon={Download}
              iconBg="bg-green-500"
              title="Download Play"
              subtitle="Save as PNG image to your device"
              onClick={handleDownload}
              isLoading={isDownloading}
              testId="button-download"
            />

            <div className="flex items-center gap-2 py-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or save permanently</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <ActionCard
              icon={User}
              iconBg="bg-orange-500"
              title="Create Free Account"
              subtitle="Save unlimited plays, sync across devices"
              onClick={onSignUp}
              highlighted
              testId="button-signup"
            />

            <ActionCard
              icon={Key}
              iconBg="bg-gray-500"
              title="Log In"
              subtitle="Already have an account?"
              onClick={onLogin}
              testId="button-login"
            />
          </>
        )}
      </div>
    </div>
  );
}

interface ActionCardProps {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  isLoading?: boolean;
  isSuccess?: boolean;
  highlighted?: boolean;
  testId: string;
}

function ActionCard({
  icon: Icon,
  iconBg,
  title,
  subtitle,
  onClick,
  isLoading,
  isSuccess,
  highlighted,
  testId,
}: ActionCardProps) {
  return (
    <Card
      className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
        highlighted ? "border-orange-500 border-2" : ""
      }`}
      onClick={isLoading ? undefined : onClick}
      data-testid={testId}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : isSuccess ? (
            <Check className="w-5 h-5 text-white" />
          ) : (
            <Icon className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
      </div>
    </Card>
  );
}

function MiniPreview({ 
  players, 
  routes 
}: { 
  players: DraftPlayer[]; 
  routes: DraftRoute[]; 
}) {
  const fieldWidth = 694;
  const fieldHeight = 392;

  return (
    <svg
      viewBox={`0 0 ${fieldWidth} ${fieldHeight}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <line x1={fieldWidth / 2} y1={284} x2={fieldWidth / 2 - 40} y2={284} stroke="#fff" strokeWidth="2" opacity="0.5" />
      <line x1={fieldWidth / 2} y1={284} x2={fieldWidth / 2 + 40} y2={284} stroke="#fff" strokeWidth="2" opacity="0.5" />

      {routes.map((route) => {
        if (route.points.length < 2) return null;
        const pathD = route.points
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
          .join(" ");
        return (
          <path
            key={route.id}
            d={pathD}
            stroke={route.isPrimary ? "#ef4444" : "#9ca3af"}
            strokeWidth="2"
            fill="none"
          />
        );
      })}

      {players.map((player) => (
        <g key={player.id}>
          <circle
            cx={player.x}
            cy={player.y}
            r={12}
            fill={player.color}
            stroke={player.side === "offense" ? "#000" : "#fff"}
            strokeWidth="2"
          />
          <text
            x={player.x}
            y={player.y + 4}
            textAnchor="middle"
            fontSize="10"
            fontWeight="bold"
            fill={player.side === "offense" ? "#fff" : "#000"}
          >
            {player.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
