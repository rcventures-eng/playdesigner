import { useState, useEffect, useCallback, useRef } from "react";
import { toPng } from "html-to-image";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMobileDetection } from "@/hooks/useMobileDetection";
import { useOrientation } from "@/hooks/useOrientation";
import { usePlayDraft, type DraftPlayer, type DraftRoute } from "@/hooks/usePlayDraft";
import { OrientationPrompt } from "./OrientationPrompt";
import { FormatSelector } from "./FormatSelector";
import { MobileCanvas } from "./MobileCanvas";
import { AIPromptOverlay } from "./AIPromptOverlay";
import { PlayDetailsForm } from "./PlayDetailsForm";
import { SaveExportPanel } from "./SaveExportPanel";
import { WizardNavigation } from "./WizardNavigation";
import { UserProfileMenu } from "./UserProfileMenu";
import { Button } from "@/components/ui/button";
import SignUpModal from "@/components/SignUpModal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getFormation, resolveColorKey, type FormationPlayer } from "@shared/football-config";
import { User, Sparkles, Shield, Shirt } from "lucide-react";
import rcFootballLogo from "@assets/RC_Football_1765082048330.png";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type WizardStep = 1 | 2 | 3;

interface GeneratePlayResponse {
  success: boolean;
  play?: {
    name?: string;
    data?: {
      players?: Array<FormationPlayer & { id?: string; color?: string }>;
      routes?: DraftRoute[];
    };
  };
}

export function MobilePlayDesigner() {
  const { isMobileOrTablet } = useMobileDetection();
  const { isPortrait } = useOrientation();
  const { toast } = useToast();
  
  const {
    draft,
    isLoaded,
    canUndo,
    setPlayers,
    setRoutes,
    setShapes,
    setPlayNotes,
    setFootballs,
    setFormat,
    setName,
    setSituationTags,
    setConceptTags,
    clearDraft,
    pushToUndoStack,
    undo,
  } = usePlayDraft();

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [side, setSide] = useState<"offense" | "defense">("offense");
  const [showFormatSelector, setShowFormatSelector] = useState(true);
  const [showAIOverlay, setShowAIOverlay] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"signup" | "login">("signup");
  const [validationError, setValidationError] = useState("");
  
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const { data: user } = useQuery({
    queryKey: ["/api/me"],
    retry: false,
  });

  const isAuthenticated = !!user;

  const generatePlayMutation = useMutation({
    mutationFn: async (params: { prompt: string; format: string; type: string }) => {
      const response = await apiRequest("POST", "/api/generate-play", params);
      return response.json() as Promise<GeneratePlayResponse>;
    },
    onSuccess: (data) => {
      const playDataRaw = data.play?.data || data.play;
      const playersData = playDataRaw && "players" in playDataRaw ? playDataRaw.players : undefined;
      const routesData = playDataRaw && "routes" in playDataRaw ? playDataRaw.routes : undefined;
      
      // Be forgiving - show players even if routes are incomplete
      const hasPlayers = playersData && playersData.length > 0;
      const hasRoutes = routesData && routesData.length > 0;

      if (hasPlayers) {
        setPlayers(
          playersData.map((p: FormationPlayer & { id?: string; color?: string }, i: number) => ({
            id: p.id || `ai-player-${i}-${Date.now()}`,
            label: p.label,
            x: p.x,
            y: p.y,
            color: p.color || (p.colorKey ? resolveColorKey(p.colorKey) : "#6b7280"),
            side: p.side || side,
          }))
        );
      }

      if (hasRoutes) {
        setRoutes(routesData);
      }

      if (data.play?.name) {
        setName(data.play.name);
      }

      setShowAIOverlay(false);

      if (hasPlayers) {
        // Success - we got players, show appropriate message
        if (hasRoutes) {
          toast({
            title: "Play generated!",
            description: "Your AI-generated play is ready to edit.",
          });
        } else {
          // Players generated but no routes - still usable, soft warning
          toast({
            title: "Play generated",
            description: "Formation set up. You can draw routes manually.",
          });
        }
      } else {
        // No players at all - this is a failure
        const errorMsg = (data as unknown as { error?: string })?.error || "The AI could not generate a valid play from your description.";
        toast({
          title: "Generation incomplete",
          description: errorMsg,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Generation failed",
        description: "Could not generate play. Please try again.",
        variant: "destructive",
      });
    },
  });

  const savePlayMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/plays", {
        name: draft.name,
        type: side === "offense" ? "Offense" : "Defense",
        formation: `${draft.format} ${side === "offense" ? "Spread" : "Base"}`,
        data: {
          players: draft.players,
          routes: draft.routes,
          shapes: draft.shapes,
          playNotes: draft.playNotes,
          footballs: draft.footballs,
        },
        situation: draft.situationTags.length > 0 ? draft.situationTags[0] : null,
        concept: draft.conceptTags.length > 0 ? draft.conceptTags[0] : null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plays"] });
      clearDraft();
      toast({
        title: "Play saved!",
        description: "Your play has been added to your library.",
      });
    },
    onError: () => {
      toast({
        title: "Save failed",
        description: "Could not save play. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (isLoaded && draft.format && draft.players.length > 0) {
      setShowFormatSelector(false);
    }
  }, [isLoaded, draft.format, draft.players.length]);

  const loadFormation = useCallback(
    (formatId: string, loadSide: "offense" | "defense") => {
      const formation = getFormation(
        formatId as "5v5" | "7v7" | "9v9" | "11v11",
        loadSide,
        loadSide === "offense" ? "spread" : "base"
      );

      if (formation) {
        const newPlayers: DraftPlayer[] = formation.players.map((p, i) => ({
          id: `player-${loadSide}-${i}-${Date.now()}`,
          label: p.label,
          x: p.x,
          y: p.y,
          color: resolveColorKey(p.colorKey),
          side: p.side,
        }));
        setPlayers(newPlayers);
        setRoutes([]);
      }
    },
    [setPlayers, setRoutes]
  );

  const handleFormatSelect = useCallback(
    (formatId: string) => {
      setFormat(formatId);
      loadFormation(formatId, side);
      setShowFormatSelector(false);
    },
    [setFormat, loadFormation, side]
  );

  const handleFormatChange = useCallback(
    (formatId: string) => {
      setFormat(formatId);
      loadFormation(formatId, side);
    },
    [setFormat, loadFormation, side]
  );

  const handleSideChange = useCallback(
    (newSide: "offense" | "defense") => {
      setSide(newSide);
      if (draft.format) {
        loadFormation(draft.format, newSide);
      }
    },
    [draft.format, loadFormation]
  );

  const handleGeneratePlay = useCallback(
    (prompt: string) => {
      generatePlayMutation.mutate({
        prompt,
        format: draft.format || "7v7",
        type: side === "offense" ? "Offense" : "Defense",
      });
    },
    [draft.format, side, generatePlayMutation]
  );

  const handleStepChange = useCallback(
    (step: WizardStep) => {
      if (step === 2 && currentStep === 1) {
        if (draft.players.length === 0) {
          toast({
            title: "Add players first",
            description: "Please select a format to add players to the field.",
            variant: "destructive",
          });
          return;
        }
        setCompletedSteps((prev) => (prev.includes(1) ? prev : [...prev, 1]));
      }

      if (step === 3 && currentStep === 2) {
        if (!draft.name.trim()) {
          setValidationError("Play name is required");
          return;
        }
        setCompletedSteps((prev) => (prev.includes(2) ? prev : [...prev, 2]));
      }

      setValidationError("");
      setCurrentStep(step);
    },
    [currentStep, draft.players.length, draft.name, toast]
  );

  const handleDownload = useCallback(async () => {
    toast({
      title: "Downloading...",
      description: "Preparing your play image.",
    });
  }, [toast]);

  const handleSaveToPlays = useCallback(async () => {
    if (!isAuthenticated) return;
    savePlayMutation.mutate();
  }, [isAuthenticated, savePlayMutation]);

  const handleAddToTeam = useCallback(() => {
    toast({
      title: "Coming soon",
      description: "Team playbook integration is under development.",
    });
  }, [toast]);

  const handleExportToDrive = useCallback(() => {
    toast({
      title: "Coming soon",
      description: "Google Drive export is under development.",
    });
  }, [toast]);

  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);

  // Track if there are routes or if formation is loaded (for Clear Play logic)
  const hasRoutes = draft.routes.length > 0;
  const hasPlayers = draft.players.length > 0;
  const canClear = hasRoutes || hasPlayers;

  const handleClear = useCallback(() => {
    // Push to undo stack before making changes for undo parity
    pushToUndoStack();
    
    if (hasRoutes) {
      // First press: Clear routes but keep formation
      setRoutes([]);
      setShapes([]);
      setPlayNotes([]);
      setFootballs([]);
    } else if (hasPlayers) {
      // Second press: Remove formation entirely, show format selector
      setPlayers([]);
      setRoutes([]);
      setShowFormatSelector(true);
    }
  }, [hasRoutes, hasPlayers, setRoutes, setShapes, setPlayNotes, setFootballs, setPlayers, pushToUndoStack]);

  const handleScreenshot = useCallback(async () => {
    // Try main canvas first, then fall back to mini preview
    const canvasElement = document.querySelector('[data-testid="mobile-canvas"]') 
      || document.querySelector('[data-testid="play-preview"]');
    if (!canvasElement) {
      toast({
        title: "Screenshot failed",
        description: "Could not find the canvas element.",
        variant: "destructive",
      });
      return;
    }

    try {
      const dataUrl = await toPng(canvasElement as HTMLElement, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#166534',
        skipFonts: true,
      });

      // Add watermark to the image
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        
        // Add subtle watermark in bottom-right corner (10px font, scaled for 2x pixel ratio)
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('Built in RC Football', canvas.width - 8, canvas.height - 8);
      }

      const watermarkedDataUrl = canvas.toDataURL('image/png');

      // Convert to blob and use share API to save to Photos
      const response = await fetch(watermarkedDataUrl);
      const blob = await response.blob();
      const file = new File([blob], `${draft.name || 'play'}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        // Fallback: trigger download
        const link = document.createElement('a');
        link.download = `${draft.name || 'play'}-${Date.now()}.png`;
        link.href = watermarkedDataUrl;
        link.click();
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return;
      }
      console.error('Screenshot failed:', error);
      toast({
        title: "Screenshot failed",
        description: "Could not capture the canvas.",
        variant: "destructive",
      });
    }
  }, [draft.name, toast]);

  const handleShare = useCallback(async () => {
    // Try main canvas first, then fall back to mini preview
    const canvasElement = document.querySelector('[data-testid="mobile-canvas"]')
      || document.querySelector('[data-testid="play-preview"]');
    if (!canvasElement) {
      toast({
        title: "Share failed",
        description: "Could not find the canvas element.",
        variant: "destructive",
      });
      return;
    }

    try {
      const dataUrl = await toPng(canvasElement as HTMLElement, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#166534',
        skipFonts: true,
      });

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `${draft.name || 'play'}.png`, { type: 'image/png' });

      // Use Web Share API if available (iOS and modern Android)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: draft.name || 'Football Play',
          text: 'Check out this play I designed!',
          files: [file],
        });
      } else {
        // Fallback: download the image
        const link = document.createElement('a');
        link.download = `${draft.name || 'play'}-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (error: any) {
      // User cancelled sharing is not an error
      if (error?.name === 'AbortError') {
        return;
      }
      console.error('Share failed:', error);
      toast({
        title: "Share failed",
        description: "Could not share the play.",
        variant: "destructive",
      });
    }
  }, [draft.name, toast]);

  const handleSignUp = useCallback(() => {
    setAuthModalMode("signup");
    setShowAuthModal(true);
  }, []);

  const handleLogin = useCallback(() => {
    setAuthModalMode("login");
    setShowAuthModal(true);
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col h-screen bg-background"
      data-testid="mobile-play-designer"
    >
      <OrientationPrompt isVisible={isMobileOrTablet && isPortrait} />

      <header className="flex items-center justify-between gap-1 px-2 py-1.5 border-b bg-card overflow-x-auto">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <img 
            src={rcFootballLogo} 
            alt="RC Football" 
            className="h-6 w-auto"
            data-testid="brand-logo"
          />
          <span className="font-bold text-sm whitespace-nowrap hidden sm:inline">RC Football</span>
        </div>
        
        {currentStep === 1 && !showFormatSelector && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="flex rounded-md overflow-hidden border">
              <button
                onClick={() => handleSideChange("offense")}
                className={`px-2 py-1 text-xs font-medium flex items-center gap-1 ${
                  side === "offense"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background"
                }`}
                data-testid="button-offense-header"
              >
                <Shirt className="w-3 h-3" />
                OFF
              </button>
              <button
                onClick={() => handleSideChange("defense")}
                className={`px-2 py-1 text-xs font-medium flex items-center gap-1 ${
                  side === "defense"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background"
                }`}
                data-testid="button-defense-header"
              >
                <Shield className="w-3 h-3" />
                DEF
              </button>
            </div>

            <Select value={draft.format || "7v7"} onValueChange={handleFormatChange}>
              <SelectTrigger className="w-[80px] h-7 text-xs" data-testid="select-format-header">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5v5">5v5</SelectItem>
                <SelectItem value="7v7">7v7</SelectItem>
                <SelectItem value="9v9">9v9</SelectItem>
                <SelectItem value="11v11">11v11</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => setShowAIOverlay(true)}
              size="sm"
              className="h-7 text-xs bg-gradient-to-r from-purple-500 to-purple-600 text-white px-2"
              data-testid="button-ai-mode-header"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              AI
            </Button>
          </div>
        )}

        {isAuthenticated ? (
          <UserProfileMenu
            user={user as { username?: string; email?: string; firstName?: string }}
            onLogout={() => {}}
          />
        ) : (
          <div className="flex gap-1 flex-shrink-0">
            <Button 
              variant="ghost" 
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => {
                setAuthModalMode("login");
                setShowAuthModal(true);
              }}
              data-testid="button-login-header"
            >
              Log In
            </Button>
            <Button 
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => {
                setAuthModalMode("signup");
                setShowAuthModal(true);
              }}
              data-testid="button-signup-header"
            >
              Sign Up
            </Button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-hidden relative">
        {currentStep === 1 && (
          <>
            <FormatSelector
              isVisible={showFormatSelector}
              onSelectFormat={handleFormatSelect}
            />
            <MobileCanvas
              players={draft.players}
              routes={draft.routes}
              format={draft.format || "7v7"}
              side={side}
              onPlayersChange={setPlayers}
              onRoutesChange={setRoutes}
              onFormatChange={handleFormatChange}
              onSideChange={handleSideChange}
              onOpenAI={() => setShowAIOverlay(true)}
              onPushToUndoStack={pushToUndoStack}
            />
          </>
        )}

        {currentStep === 2 && (
          <PlayDetailsForm
            players={draft.players}
            routes={draft.routes}
            name={draft.name}
            onNameChange={setName}
            situationTags={draft.situationTags}
            onSituationTagsChange={setSituationTags}
            conceptTags={draft.conceptTags}
            onConceptTagsChange={setConceptTags}
            onEditPlay={() => setCurrentStep(1)}
            validationError={validationError}
            gameFormat={draft.format || "7v7"}
          />
        )}

        {currentStep === 3 && (
          <SaveExportPanel
            players={draft.players}
            routes={draft.routes}
            playName={draft.name}
            isAuthenticated={isAuthenticated}
            isSaving={savePlayMutation.isPending}
            onDownload={handleDownload}
            onSaveToPlays={handleSaveToPlays}
            onAddToTeam={handleAddToTeam}
            onExportToDrive={handleExportToDrive}
            onSignUp={handleSignUp}
            onLogin={handleLogin}
          />
        )}
      </main>

      <WizardNavigation
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepChange={handleStepChange}
        canUndo={canUndo}
        canClear={canClear}
        onUndo={handleUndo}
        onClear={handleClear}
        onScreenshot={handleScreenshot}
        onShare={handleShare}
      />

      <AIPromptOverlay
        isVisible={showAIOverlay}
        onClose={() => setShowAIOverlay(false)}
        onGeneratePlay={handleGeneratePlay}
        isGenerating={generatePlayMutation.isPending}
      />

      <SignUpModal
        open={showAuthModal}
        onOpenChange={(open) => {
          setShowAuthModal(open);
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ["/api/me"] });
          }
        }}
        initialMode={authModalMode}
      />
    </div>
  );
}
