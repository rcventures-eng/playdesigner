import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText,
  Presentation,
  Loader2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  GripVertical,
  Link2,
  Unlink,
} from "lucide-react";

interface Play {
  id: number;
  name: string;
  type: string;
  concept?: string | null;
  formation?: string | null;
  data?: any;
}

interface TeamExportData {
  team: {
    id: number;
    name: string;
    year?: string;
    coverImageUrl?: string | null;
  };
  plays: Play[];
}

interface GoogleDriveExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: number;
  teamName: string;
}

export default function GoogleDriveExportModal({
  open,
  onOpenChange,
  teamId,
  teamName,
}: GoogleDriveExportModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generateDoc, setGenerateDoc] = useState(true);
  const [generateSlides, setGenerateSlides] = useState(true);
  const [selectedPlays, setSelectedPlays] = useState<number[]>([]);
  const [exportResult, setExportResult] = useState<{
    docUrl?: string;
    slidesUrl?: string;
    errors: string[];
  } | null>(null);

  // Check Google Drive connection status
  const { data: driveStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<{ connected: boolean; error?: string }>({
    queryKey: ["/api/google-drive/status"],
    enabled: open,
  });

  // Fetch plays for export
  const { data: exportData, isLoading: playsLoading } = useQuery<TeamExportData>({
    queryKey: ["/api/teams", teamId, "plays-for-export"],
    enabled: open && teamId > 0,
  });

  // Initialize selected plays when data loads
  useEffect(() => {
    if (exportData?.plays) {
      setSelectedPlays(exportData.plays.map((p) => p.id));
    }
  }, [exportData]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setExportResult(null);
      refetchStatus();
    }
  }, [open, refetchStatus]);

  const togglePlaySelection = useCallback((playId: number) => {
    setSelectedPlays((prev) =>
      prev.includes(playId)
        ? prev.filter((id) => id !== playId)
        : [...prev, playId]
    );
  }, []);

  const selectAllPlays = useCallback(() => {
    if (exportData?.plays) {
      setSelectedPlays(exportData.plays.map((p) => p.id));
    }
  }, [exportData]);

  const deselectAllPlays = useCallback(() => {
    setSelectedPlays([]);
  }, []);

  // Connect Google Drive mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/google-drive/authorize", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to start authorization");
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Redirect to Google OAuth
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Google Drive",
        variant: "destructive",
      });
    },
  });

  // Disconnect Google Drive mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/google-drive/disconnect");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google-drive/status"] });
      toast({
        title: "Disconnected",
        description: "Google Drive has been disconnected from your account.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect Google Drive",
        variant: "destructive",
      });
    },
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/teams/${teamId}/export-to-drive`, {
        generateDoc,
        generateSlides,
        playIds: selectedPlays,
        playImages: {},
      });
      return response.json();
    },
    onSuccess: (data) => {
      setExportResult({
        docUrl: data.docUrl,
        slidesUrl: data.slidesUrl,
        errors: data.errors || [],
      });
      
      if (data.docUrl || data.slidesUrl) {
        toast({
          title: "Export Complete!",
          description: `Successfully exported ${data.playsExported} plays to Google Drive.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export to Google Drive",
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    if (!generateDoc && !generateSlides) {
      toast({
        title: "Select a format",
        description: "Please select at least one export format (Doc or Slides).",
        variant: "destructive",
      });
      return;
    }

    if (selectedPlays.length === 0) {
      toast({
        title: "Select plays",
        description: "Please select at least one play to export.",
        variant: "destructive",
      });
      return;
    }

    exportMutation.mutate();
  };

  const handleConnect = () => {
    connectMutation.mutate();
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  const isConnected = driveStatus?.connected ?? false;
  const plays = exportData?.plays || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-zinc-900 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <svg viewBox="0 0 87.3 78" className="w-6 h-6">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
              <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
              <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
              <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
              <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
              <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
            </svg>
            Export to Google Drive
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Export "{teamName}" playbook to Google Docs and/or Slides.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Connection Status */}
          {statusLoading ? (
            <div className="flex items-center gap-3 p-4 bg-zinc-800 rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              <p className="text-gray-400">Checking Google Drive connection...</p>
            </div>
          ) : isConnected ? (
            <div className="flex items-center justify-between p-4 bg-green-900/30 border border-green-600/50 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-green-200 font-medium">Google Drive Connected</p>
                  <p className="text-green-200/70 text-sm">
                    Ready to export your playbook
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnectMutation.isPending}
                className="text-gray-400 hover:text-white hover:bg-zinc-700"
                data-testid="button-disconnect-drive"
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Unlink className="w-4 h-4 mr-1" />
                    Disconnect
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <div>
                  <p className="text-yellow-200 font-medium">Google Drive Not Connected</p>
                  <p className="text-yellow-200/70 text-sm">
                    Connect your Google account to export playbooks
                  </p>
                </div>
              </div>
              <Button
                onClick={handleConnect}
                disabled={connectMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-connect-drive"
              >
                {connectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-1" />
                    Connect
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Export Results */}
          {exportResult && (exportResult.docUrl || exportResult.slidesUrl) && (
            <div className="space-y-3 p-4 bg-green-900/30 border border-green-600/50 rounded-lg">
              <div className="flex items-center gap-2 text-green-200 font-medium">
                <CheckCircle2 className="w-5 h-5" />
                Export Successful!
              </div>
              <div className="space-y-2">
                {exportResult.docUrl && (
                  <a
                    href={exportResult.docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 underline"
                    data-testid="link-export-doc"
                  >
                    <FileText className="w-4 h-4" />
                    Open Google Doc
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {exportResult.slidesUrl && (
                  <a
                    href={exportResult.slidesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 underline"
                    data-testid="link-export-slides"
                  >
                    <Presentation className="w-4 h-4" />
                    Open Google Slides
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              {exportResult.errors.length > 0 && (
                <div className="mt-2 text-yellow-200 text-sm">
                  <p className="font-medium">Warnings:</p>
                  <ul className="list-disc list-inside">
                    {exportResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Only show export options if connected */}
          {isConnected && (
            <>
              {/* Format Selection */}
              <div className="space-y-3">
                <Label className="text-white text-base font-medium">Export Format</Label>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-750 transition-colors">
                    <Checkbox
                      checked={generateDoc}
                      onCheckedChange={(checked) => setGenerateDoc(!!checked)}
                      data-testid="checkbox-generate-doc"
                    />
                    <FileText className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-white font-medium">Google Doc (Handout Format)</p>
                      <p className="text-gray-400 text-sm">Printable playbook with 2 plays per page</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-750 transition-colors">
                    <Checkbox
                      checked={generateSlides}
                      onCheckedChange={(checked) => setGenerateSlides(!!checked)}
                      data-testid="checkbox-generate-slides"
                    />
                    <Presentation className="w-5 h-5 text-orange-400" />
                    <div>
                      <p className="text-white font-medium">Google Slides (Presentation Format)</p>
                      <p className="text-gray-400 text-sm">One play per slide for team meetings</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Play Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-white text-base font-medium">
                    Select Plays ({selectedPlays.length} of {plays.length})
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllPlays}
                      className="text-gray-400 hover:text-white"
                      data-testid="button-select-all-plays"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={deselectAllPlays}
                      className="text-gray-400 hover:text-white"
                      data-testid="button-deselect-all-plays"
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
                
                {playsLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : plays.length === 0 ? (
                  <div className="p-4 bg-zinc-800 rounded-lg text-center text-gray-400">
                    No plays assigned to this team yet.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-1 bg-zinc-800 rounded-lg p-2">
                    {plays.map((play) => (
                      <label
                        key={play.id}
                        className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-zinc-700 transition-colors"
                      >
                        <GripVertical className="w-4 h-4 text-gray-500" />
                        <Checkbox
                          checked={selectedPlays.includes(play.id)}
                          onCheckedChange={() => togglePlaySelection(play.id)}
                          data-testid={`checkbox-play-${play.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white truncate">{play.name}</p>
                          <p className="text-gray-400 text-xs truncate">
                            {play.type} {play.formation && `• ${play.formation}`} {play.concept && `• ${play.concept}`}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-700">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-700 text-white hover:bg-zinc-800"
              data-testid="button-cancel-export"
            >
              {exportResult ? "Close" : "Cancel"}
            </Button>
            {isConnected && !exportResult && (
              <Button
                onClick={handleExport}
                disabled={exportMutation.isPending || plays.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-generate-files"
              >
                {exportMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Files"
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
