import { useState, useEffect, useCallback, useRef } from "react";
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { renderPlaysToImages, type PlayImageData } from "@/lib/renderPlayToImage";
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
  Edit3,
  Image,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Play {
  id: number;
  name: string;
  type: string;
  concept?: string | null;
  formation?: string | null;
  situation?: string | null;
  data?: any;
  displayOrder?: number;
}

interface BlankPage {
  id: number;
  teamId: number;
  title: string;
  notes?: string | null;
  displayOrder: number;
}

// Unified item type for merged plays and blank pages
interface ExportItem {
  itemType: 'play' | 'blankPage';
  id: number;
  displayOrder: number;
  // Play fields
  name?: string;
  type?: string;
  concept?: string | null;
  formation?: string | null;
  situation?: string | null;
  data?: any;
  // Blank page fields
  title?: string;
  notes?: string | null;
}

interface TeamExportData {
  team: {
    id: number;
    name: string;
    year?: string;
    coverImageUrl?: string | null;
  };
  plays: Play[];
  blankPages?: BlankPage[];
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
  const [docsPlaysPerPage, setDocsPlaysPerPage] = useState<number>(2);
  const [slidesPlaysPerPage, setSlidesPlaysPerPage] = useState<number>(1);
  const [selectedItems, setSelectedItems] = useState<string[]>([]); // Format: "play-{id}" or "blankPage-{id}"
  const [documentName, setDocumentName] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [renderingProgress, setRenderingProgress] = useState<{ current: number; total: number } | null>(null);
  const [exportResult, setExportResult] = useState<{
    docUrl?: string;
    slidesUrl?: string;
    errors: string[];
  } | null>(null);
  const [orderedItems, setOrderedItems] = useState<ExportItem[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const draggedIndexRef = useRef<number | null>(null);

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

  // Initialize ordered items and selected items when data loads
  useEffect(() => {
    if (exportData) {
      // Merge plays and blank pages into unified items
      const playItems: ExportItem[] = (exportData.plays || []).map(p => ({
        itemType: 'play' as const,
        id: p.id,
        displayOrder: p.displayOrder ?? 0,
        name: p.name,
        type: p.type,
        concept: p.concept,
        formation: p.formation,
        situation: p.situation,
        data: p.data,
      }));
      
      const blankPageItems: ExportItem[] = (exportData.blankPages || []).map(bp => ({
        itemType: 'blankPage' as const,
        id: bp.id,
        displayOrder: bp.displayOrder,
        title: bp.title,
        notes: bp.notes,
      }));
      
      // Merge and sort by displayOrder
      const mergedItems = [...playItems, ...blankPageItems].sort((a, b) => a.displayOrder - b.displayOrder);
      setOrderedItems(mergedItems);
      
      // Select all items by default
      setSelectedItems(mergedItems.map(item => `${item.itemType}-${item.id}`));
    }
  }, [exportData]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setExportResult(null);
      setIsExporting(false);
      // Set default document name based on team name and current year
      const year = new Date().getFullYear();
      setDocumentName(`${teamName} Playbook - ${year}`);
      refetchStatus();
    }
  }, [open, refetchStatus, teamName]);

  const toggleItemSelection = useCallback((itemKey: string) => {
    setSelectedItems((prev) =>
      prev.includes(itemKey)
        ? prev.filter((key) => key !== itemKey)
        : [...prev, itemKey]
    );
  }, []);

  const selectAllItems = useCallback(() => {
    if (orderedItems.length > 0) {
      setSelectedItems(orderedItems.map((item) => `${item.itemType}-${item.id}`));
    }
  }, [orderedItems]);

  const deselectAllItems = useCallback(() => {
    setSelectedItems([]);
  }, []);

  // Drag and drop handlers for reordering items
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    draggedIndexRef.current = index;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = draggedIndexRef.current;
    
    if (sourceIndex === null || sourceIndex === targetIndex) return;
    
    // Reorder the items as the user drags
    setOrderedItems((prev) => {
      const newItems = [...prev];
      const draggedItem = newItems[sourceIndex];
      newItems.splice(sourceIndex, 1);
      newItems.splice(targetIndex, 0, draggedItem);
      return newItems;
    });
    
    // Update both ref and state to stay in sync
    draggedIndexRef.current = targetIndex;
    setDraggedIndex(targetIndex);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDragEnd = useCallback(() => {
    draggedIndexRef.current = null;
    setDraggedIndex(null);
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

  // Export mutation with improved error handling
  const exportMutation = useMutation({
    mutationFn: async () => {
      setIsExporting(true);
      setRenderingProgress(null);
      console.log("Starting Google Drive export...", { teamId, generateDoc, generateSlides, selectedItems: selectedItems.length, documentName });
      
      // Filter selected items by type
      const selectedItemsFiltered = orderedItems.filter(item => 
        selectedItems.includes(`${item.itemType}-${item.id}`)
      );
      
      // Separate plays and blank pages, maintaining order
      const selectedPlays = selectedItemsFiltered.filter(item => item.itemType === 'play');
      const selectedBlankPages = selectedItemsFiltered.filter(item => item.itemType === 'blankPage');
      
      // Create ordered item list for export (includes both types)
      const orderedExportItems = selectedItemsFiltered.map(item => ({
        type: item.itemType,
        id: item.id,
        // Include blank page details for export
        ...(item.itemType === 'blankPage' ? { title: item.title, notes: item.notes } : {})
      }));
      
      // Render plays to images for both Docs and Slides
      console.log("Rendering plays to images...");
      let playImages: Record<number, PlayImageData> = {};
      
      if ((generateSlides || generateDoc) && selectedPlays.length > 0) {
        try {
          // Transform plays to handle null -> undefined for type compatibility
          const playsForRendering = selectedPlays.map(p => ({
            id: p.id,
            name: p.name!,
            type: p.type!,
            data: p.data,
            formation: p.formation ?? undefined,
            concept: p.concept ?? undefined,
            situation: p.situation ?? undefined,
          }));
          
          // Use higher resolution (3x) for 4-play grid layout to ensure crisp images at larger display size
          const pixelRatio = (generateDoc && docsPlaysPerPage >= 4) ? 3 : 2;
          
          playImages = await renderPlaysToImages(
            playsForRendering,
            (current, total) => {
              setRenderingProgress({ current, total });
            },
            pixelRatio
          );
          console.log(`Rendered ${Object.keys(playImages).length} play images`);
        } catch (error) {
          console.error("Error rendering play images:", error);
        }
      }
      
      setRenderingProgress(null);
      
      const response = await apiRequest("POST", `/api/teams/${teamId}/export-to-drive`, {
        generateDoc,
        generateSlides,
        orderedItems: orderedExportItems,  // New: ordered list of plays and blank pages
        playImages,  // Includes { base64, width, height } per play
        documentName: documentName.trim() || `${teamName} Playbook`,
        playsPerPage: docsPlaysPerPage,
        slidesPlaysPerPage: slidesPlaysPerPage,
      });
      
      console.log("Export API response status:", response.status);
      
      // Parse JSON only once
      const data = await response.json().catch(() => ({ error: "Failed to parse response" }));
      
      if (!response.ok) {
        console.error("Export API error:", data);
        // Create error with code attached for session expiry detection
        const error = new Error(data.error || `Export failed with status ${response.status}`) as Error & { code?: string };
        error.code = data.code;
        throw error;
      }
      
      console.log("Export API success:", data);
      return data;
    },
    onSuccess: (data) => {
      setIsExporting(false);
      setExportResult({
        docUrl: data.docUrl,
        slidesUrl: data.slidesUrl,
        errors: data.errors || [],
      });
      
      if (data.docUrl || data.slidesUrl) {
        const itemCount = data.playsExported + (data.blankPagesExported || 0);
        toast({
          title: "Export Complete!",
          description: `Successfully exported ${itemCount} items to Google Drive.`,
        });
      } else if (data.errors && data.errors.length > 0) {
        toast({
          title: "Export Completed with Errors",
          description: data.errors[0],
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      setIsExporting(false);
      console.error("Export mutation error:", error);
      
      // Check if session expired (invalid_grant error)
      // Check both the error code and message text for reliability
      const isSessionExpired = 
        error.code === "SESSION_EXPIRED" ||
        error.message?.includes("session has expired") ||
        error.message?.includes("Please disconnect and reconnect");
      
      if (isSessionExpired) {
        // Invalidate the status cache to show disconnected state
        queryClient.invalidateQueries({ queryKey: ["/api/google-drive/status"] });
        toast({
          title: "Session Expired",
          description: "Your Google Drive session has expired. Please reconnect your account.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Export Failed",
          description: error.message || "Failed to export to Google Drive. Please try again.",
          variant: "destructive",
        });
      }
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

    if (selectedItems.length === 0) {
      toast({
        title: "Select items",
        description: "Please select at least one play or section divider to export.",
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
              {/* Document Name Input */}
              <div className="space-y-3">
                <Label htmlFor="documentName" className="text-white text-base font-medium flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />
                  Document Name
                </Label>
                <Input
                  id="documentName"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="Enter a name for your exported files"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
                  data-testid="input-document-name"
                />
                <p className="text-gray-400 text-sm">
                  This name will be used for both Google Doc and Slides files
                </p>
              </div>

              {/* Format Selection */}
              <div className="space-y-3">
                <Label className="text-white text-base font-medium">Export Format</Label>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <Checkbox
                        checked={generateDoc}
                        onCheckedChange={(checked) => setGenerateDoc(!!checked)}
                        data-testid="checkbox-generate-doc"
                      />
                      <FileText className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="text-white font-medium">Google Doc (Handout Format)</p>
                        <p className="text-gray-400 text-sm">Printable playbook format</p>
                      </div>
                    </label>
                    <Select
                      value={docsPlaysPerPage.toString()}
                      onValueChange={(val) => setDocsPlaysPerPage(parseInt(val))}
                    >
                      <SelectTrigger 
                        className="w-[140px] bg-zinc-700 border-zinc-600 text-white"
                        data-testid="select-docs-plays-per-page"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 play per page</SelectItem>
                        <SelectItem value="2">2 plays per page</SelectItem>
                        <SelectItem value="4">4 plays per page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <Checkbox
                        checked={generateSlides}
                        onCheckedChange={(checked) => setGenerateSlides(!!checked)}
                        data-testid="checkbox-generate-slides"
                      />
                      <Presentation className="w-5 h-5 text-orange-400" />
                      <div>
                        <p className="text-white font-medium">Google Slides (Presentation Format)</p>
                        <p className="text-gray-400 text-sm">For team meetings</p>
                      </div>
                    </label>
                    <Select
                      value={slidesPlaysPerPage.toString()}
                      onValueChange={(val) => setSlidesPlaysPerPage(parseInt(val))}
                    >
                      <SelectTrigger 
                        className="w-[140px] bg-zinc-700 border-zinc-600 text-white"
                        data-testid="select-slides-plays-per-page"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 play per slide</SelectItem>
                        <SelectItem value="2">2 plays per slide</SelectItem>
                        <SelectItem value="4">4 plays per slide</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Item Selection (Plays + Blank Pages) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-white text-base font-medium">
                    Select Items ({selectedItems.length} of {orderedItems.length})
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllItems}
                      className="text-gray-400 hover:text-white"
                      data-testid="button-select-all-items"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={deselectAllItems}
                      className="text-gray-400 hover:text-white"
                      data-testid="button-deselect-all-items"
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
                
                {playsLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : orderedItems.length === 0 ? (
                  <div className="p-4 bg-zinc-800 rounded-lg text-center text-gray-400">
                    No plays or section dividers assigned to this team yet.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-1 bg-zinc-800 rounded-lg p-2">
                    {orderedItems.map((item, index) => {
                      const itemKey = `${item.itemType}-${item.id}`;
                      const isBlankPage = item.itemType === 'blankPage';
                      
                      return (
                        <div
                          key={itemKey}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragEnter={(e) => handleDragEnter(e, index)}
                          onDragOver={handleDragOver}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-3 p-2 rounded cursor-grab active:cursor-grabbing transition-colors select-none ${
                            draggedIndex === index 
                              ? "bg-zinc-600 opacity-50" 
                              : "hover:bg-zinc-700"
                          } ${isBlankPage ? "border border-dashed border-gray-500" : ""}`}
                          data-testid={`draggable-${item.itemType}-${item.id}`}
                        >
                          <GripVertical className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <Checkbox
                            checked={selectedItems.includes(itemKey)}
                            onCheckedChange={() => toggleItemSelection(itemKey)}
                            data-testid={`checkbox-${item.itemType}-${item.id}`}
                          />
                          {isBlankPage ? (
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <p className="text-gray-300 truncate">{item.title || "Untitled Section"}</p>
                              </div>
                              {item.notes && (
                                <p className="text-gray-500 text-xs truncate ml-6">{item.notes}</p>
                              )}
                            </div>
                          ) : (
                            <div className="flex-1 min-w-0">
                              <p className="text-white truncate">{item.name}</p>
                              <p className="text-gray-400 text-xs truncate">
                                {item.type} {item.formation && `• ${item.formation}`} {item.concept && `• ${item.concept}`}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                disabled={isExporting || exportMutation.isPending || orderedItems.length === 0 || !documentName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-generate-files"
              >
                {isExporting || exportMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {renderingProgress ? (
                      <>
                        <Image className="w-4 h-4 mr-1" />
                        Rendering play {renderingProgress.current} of {renderingProgress.total}...
                      </>
                    ) : (
                      "Generating files..."
                    )}
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
