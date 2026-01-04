import { useState, useEffect, useCallback } from "react";
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
import { Button } from "@/components/ui/button";
import SignUpModal from "@/components/SignUpModal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getFormation, resolveColorKey, type FormationPlayer } from "@shared/football-config";
import { User } from "lucide-react";

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
  } = usePlayDraft();

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [side, setSide] = useState<"offense" | "defense">("offense");
  const [showFormatSelector, setShowFormatSelector] = useState(true);
  const [showAIOverlay, setShowAIOverlay] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [validationError, setValidationError] = useState("");

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
    retry: false,
  });

  const isAuthenticated = !!user;

  const generatePlayMutation = useMutation({
    mutationFn: async (params: { prompt: string; format: string; type: string }) => {
      const response = await apiRequest("POST", "/api/generate-play", params);
      return response.json() as Promise<GeneratePlayResponse>;
    },
    onSuccess: (data) => {
      if (data.success && data.play) {
        const playData = data.play.data || data.play;

        if (playData.players) {
          setPlayers(
            playData.players.map((p, i) => ({
              id: p.id || `ai-player-${i}-${Date.now()}`,
              label: p.label,
              x: p.x,
              y: p.y,
              color: p.color || (p.colorKey ? resolveColorKey(p.colorKey) : "#6b7280"),
              side: p.side || side,
            }))
          );
        }

        if (playData.routes) {
          setRoutes(playData.routes);
        }

        if (data.play.name) {
          setName(data.play.name);
        }

        setShowAIOverlay(false);
        toast({
          title: "Play generated!",
          description: "Your AI-generated play is ready to edit.",
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

  const handleSignUp = useCallback(() => {
    setShowSignUp(true);
  }, []);

  const handleLogin = useCallback(() => {
    setShowSignUp(true);
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

      <header className="flex items-center justify-between p-2 border-b bg-card">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">RC Football</span>
        </div>
        {isAuthenticated ? (
          <div className="text-sm text-muted-foreground">
            Hey Coach {(user as { username?: string })?.username || ""}
          </div>
        ) : (
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowSignUp(true)}
              data-testid="button-login-header"
            >
              Log In
            </Button>
            <Button 
              size="sm" 
              onClick={() => setShowSignUp(true)}
              data-testid="button-signup-header"
            >
              <User className="w-4 h-4 mr-1" />
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
      />

      <AIPromptOverlay
        isVisible={showAIOverlay}
        onClose={() => setShowAIOverlay(false)}
        onGeneratePlay={handleGeneratePlay}
        isGenerating={generatePlayMutation.isPending}
      />

      <SignUpModal
        open={showSignUp}
        onOpenChange={(open) => {
          setShowSignUp(open);
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
          }
        }}
      />
    </div>
  );
}
