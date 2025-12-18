import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Settings, 
  Database, 
  FileText, 
  Home, 
  Save, 
  RefreshCw,
  LogOut,
  Mail,
  Send,
  Key,
  Shield,
  Star,
  Eye,
  LayoutGrid,
  Globe,
  Lock
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { PlayPreview } from "@/components/PlayPreview";

type AdminTab = "logic" | "presets" | "logs" | "email" | "plays";
type GameFormat = "5v5" | "7v7" | "9v9" | "11v11";

interface AILog {
  id: number;
  prompt: string;
  hasImage: boolean;
  uploadedImage: string | null;
  timestamp: string;
  status: string;
  previewJson: any;
  feedbackNotes: string | null;
  rating: number;
  correctDiagram: string | null;
}

interface FormationPlayer {
  label: string;
  x: number;
  y: number;
  colorKey: string;
  side: "offense" | "defense";
}

interface ConfigData {
  logicDictionary: Record<string, unknown>;
}

interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  favoriteNFLTeam: string | null;
  isAdmin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}

type SortColumn = "email" | "firstName" | "favoriteNFLTeam" | "lastLoginIp" | "createdAt" | "lastLoginAt";
type SortOrder = "asc" | "desc";

interface AdminPlay {
  id: number;
  name: string;
  type: string;
  formation: string | null;
  isPublic: boolean | null;
  createdAt: string;
  userId: string;
  userEmail: string | null;
  userFirstName: string | null;
}

interface PlaysResponse {
  plays: AdminPlay[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface FormationVariant {
  players: FormationPlayer[];
}

interface SideFormations {
  [key: string]: FormationVariant | undefined;
}

interface PresetsData {
  [key: string]: {
    offense?: SideFormations;
    defense?: SideFormations;
  };
}

interface AdminDashboardProps {
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
}

export default function AdminDashboard({ isAdmin, setIsAdmin }: AdminDashboardProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>("logic");
  const [logicJson, setLogicJson] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<GameFormat | null>(null);
  const [selectedSide, setSelectedSide] = useState<"offense" | "defense">("offense");
  const [presetPlayers, setPresetPlayers] = useState<FormationPlayer[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [resetPasswordEmail, setResetPasswordEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [usersSortBy, setUsersSortBy] = useState<SortColumn>("createdAt");
  const [usersSortOrder, setUsersSortOrder] = useState<SortOrder>("desc");
  const [usersPage, setUsersPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AILog | null>(null);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [correctDiagramUpload, setCorrectDiagramUpload] = useState<string | null>(null);
  const [playsPage, setPlaysPage] = useState(1);
  const { toast } = useToast();

  // Check admin status from server (secure endpoint)
  const { data: adminCheck, isLoading: adminCheckLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    queryFn: async () => {
      const response = await fetch("/api/admin/check", { credentials: "include" });
      return response.json();
    },
  });

  // Update isAdmin state based on server response
  useEffect(() => {
    if (adminCheck?.isAdmin && !isAdmin) {
      setIsAdmin(true);
    }
  }, [adminCheck, isAdmin, setIsAdmin]);

  // Redirect if not admin (after admin check completes)
  useEffect(() => {
    if (!adminCheckLoading && !adminCheck?.isAdmin && !isAdmin) {
      setLocation("/");
    }
  }, [isAdmin, adminCheck, adminCheckLoading, setLocation]);

  // Fetch logic dictionary (uses session-based auth)
  const { data: configData, isLoading: configLoading } = useQuery<ConfigData>({
    queryKey: ["/api/admin/config"],
    queryFn: async () => {
      const response = await fetch("/api/admin/config", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch config");
      return response.json();
    },
    enabled: isAdmin,
  });

  // Fetch AI logs (uses session-based auth)
  // Fetch once when admin is confirmed, cache for use on logs tab
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery<AILog[]>({
    queryKey: ["/api/admin/logs"],
    queryFn: async () => {
      const response = await fetch("/api/admin/logs", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch logs");
      return response.json();
    },
    enabled: isAdmin || adminCheck?.isAdmin,
  });

  // Fetch presets (uses session-based auth)
  const { data: presetsData } = useQuery<PresetsData>({
    queryKey: ["/api/admin/presets"],
    queryFn: async () => {
      const response = await fetch("/api/admin/presets", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch presets");
      return response.json();
    },
    enabled: isAdmin,
  });

  // Fetch users for email management (uses session-based auth)
  // Fetch once when admin is confirmed, cache for use on email tab
  const { data: usersResponse, isLoading: usersLoading, refetch: refetchUsers } = useQuery<UsersResponse>({
    queryKey: ["/api/admin/users", usersPage, usersSortBy, usersSortOrder],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: usersPage.toString(),
        limit: "20",
        sortBy: usersSortBy,
        sortOrder: usersSortOrder,
      });
      const response = await fetch(`/api/admin/users?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
    enabled: isAdmin || adminCheck?.isAdmin,
  });

  const handleSort = (column: SortColumn) => {
    if (usersSortBy === column) {
      setUsersSortOrder(usersSortOrder === "asc" ? "desc" : "asc");
    } else {
      setUsersSortBy(column);
      setUsersSortOrder("desc");
    }
    setUsersPage(1);
  };

  // Fetch plays for management (uses session-based auth)
  const { data: playsResponse, isLoading: playsLoading, refetch: refetchPlays } = useQuery<PlaysResponse>({
    queryKey: ["/api/admin/plays", playsPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: playsPage.toString(),
        limit: "20",
      });
      const response = await fetch(`/api/admin/plays?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch plays");
      return response.json();
    },
    enabled: isAdmin || adminCheck?.isAdmin,
  });

  // Toggle play public status mutation
  const togglePlayPublicMutation = useMutation({
    mutationFn: async (playId: number) => {
      const response = await fetch(`/api/admin/plays/${playId}/toggle-public`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to toggle play visibility");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plays"], exact: false });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Send welcome email mutation (uses session-based auth)
  const sendWelcomeEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch("/api/admin/resend-welcome-email", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send email");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
      setEmailInput("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Admin password reset mutation (uses session-based auth)
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await fetch("/api/admin/reset-user-password", {
        method: "POST",
        body: JSON.stringify({ email, newPassword: password }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reset password");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
      setResetPasswordEmail("");
      setNewPassword("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update feedback mutation for AI logs
  const updateFeedbackMutation = useMutation({
    mutationFn: async ({ id, rating, feedbackNotes, correctDiagram }: { id: number; rating: number; feedbackNotes: string; correctDiagram?: string | null }) => {
      const response = await fetch(`/api/admin/logs/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ rating, feedbackNotes, correctDiagram }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save feedback");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Feedback saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      setInspectModalOpen(false);
      setSelectedLog(null);
      setCorrectDiagramUpload(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenInspectModal = (log: AILog) => {
    setSelectedLog(log);
    setFeedbackRating(log.rating || 0);
    setFeedbackNotes(log.feedbackNotes || "");
    setCorrectDiagramUpload(log.correctDiagram || null);
    setInspectModalOpen(true);
  };

  const handleSaveFeedback = () => {
    if (selectedLog) {
      updateFeedbackMutation.mutate({
        id: selectedLog.id,
        rating: feedbackRating,
        feedbackNotes: feedbackNotes,
        correctDiagram: correctDiagramUpload,
      });
    }
  };

  const handleCorrectDiagramUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSizeBytes = 2 * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        toast({ 
          title: "File too large", 
          description: "Please upload an image smaller than 2MB", 
          variant: "destructive" 
        });
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setCorrectDiagramUpload(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (configData?.logicDictionary) {
      setLogicJson(JSON.stringify(configData.logicDictionary, null, 2));
    }
  }, [configData]);

  useEffect(() => {
    if (presetsData && selectedFormat) {
      const sideData = presetsData[selectedFormat]?.[selectedSide];
      const formationData = sideData?.spread || sideData?.base;
      if (formationData?.players) {
        setPresetPlayers(formationData.players);
      }
    }
  }, [presetsData, selectedFormat, selectedSide]);

  // Save logic mutation (uses session-based auth)
  const saveLogicMutation = useMutation({
    mutationFn: async (json: string) => {
      const parsed = JSON.parse(json);
      const response = await fetch("/api/admin/config", {
        method: "POST",
        body: JSON.stringify({ logicDictionary: parsed }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to save");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Logic dictionary saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/config"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveLogic = () => {
    try {
      JSON.parse(logicJson);
      setJsonError("");
      saveLogicMutation.mutate(logicJson);
    } catch (e) {
      setJsonError("Invalid JSON format");
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setLocation("/");
  };

  const handlePlayerCoordChange = (index: number, field: "x" | "y", value: string) => {
    const numValue = parseInt(value) || 0;
    setPresetPlayers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: numValue };
      return updated;
    });
  };

  if (!isAdmin) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center text-white">
        <p>Checking authorization...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex" data-testid="admin-dashboard">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className={`text-xl font-bold ${import.meta.env.DEV ? "text-pink-400" : "text-orange-400"}`}>
            Admin Dashboard
            {import.meta.env.DEV && <span className="ml-2 text-xs bg-pink-500/20 px-2 py-0.5 rounded">DEV</span>}
          </h1>
          <p className="text-xs text-slate-400 mt-1">RC Football Configuration</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab("logic")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeTab === "logic" 
                ? "bg-orange-500/20 text-orange-400" 
                : "text-slate-300 hover:bg-slate-800"
            }`}
            data-testid="tab-logic"
          >
            <Settings className="w-4 h-4" />
            AI Logic
          </button>
          <button
            onClick={() => setActiveTab("presets")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeTab === "presets" 
                ? "bg-orange-500/20 text-orange-400" 
                : "text-slate-300 hover:bg-slate-800"
            }`}
            data-testid="tab-presets"
          >
            <Database className="w-4 h-4" />
            Presets
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeTab === "logs" 
                ? "bg-orange-500/20 text-orange-400" 
                : "text-slate-300 hover:bg-slate-800"
            }`}
            data-testid="tab-logs"
          >
            <FileText className="w-4 h-4" />
            Logs
          </button>
          <button
            onClick={() => setActiveTab("email")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeTab === "email" 
                ? "bg-orange-500/20 text-orange-400" 
                : "text-slate-300 hover:bg-slate-800"
            }`}
            data-testid="tab-email"
          >
            <Mail className="w-4 h-4" />
            Email
          </button>
          <button
            onClick={() => setActiveTab("plays")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeTab === "plays" 
                ? "bg-orange-500/20 text-orange-400" 
                : "text-slate-300 hover:bg-slate-800"
            }`}
            data-testid="tab-plays"
          >
            <LayoutGrid className="w-4 h-4" />
            Plays
          </button>
        </nav>

        <div className="p-4 border-t border-slate-700 space-y-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start gap-2 text-slate-300 border-slate-600"
            onClick={() => setLocation("/")}
            data-testid="button-back-home"
          >
            <Home className="w-4 h-4" />
            Back to App
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-slate-900/50 border-b border-slate-700 flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold text-white">
            {activeTab === "logic" && "AI Logic Dictionary"}
            {activeTab === "presets" && "Formation Presets"}
            {activeTab === "logs" && "AI Generation Logs"}
            {activeTab === "email" && "Email Management"}
            {activeTab === "plays" && "Play Management"}
          </h2>
          {activeTab === "logic" && (
            <Button 
              onClick={handleSaveLogic}
              disabled={saveLogicMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="button-save-logic"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveLogicMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          )}
          {activeTab === "logs" && (
            <Button 
              variant="outline"
              onClick={() => refetchLogs()}
              className="border-slate-600 text-slate-300"
              data-testid="button-refresh-logs"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          )}
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6">
          {/* AI Logic Tab */}
          {activeTab === "logic" && (
            <div className="space-y-4" data-testid="content-logic">
              {configLoading ? (
                <div className="text-slate-400">Loading configuration...</div>
              ) : (
                <>
                  {jsonError && (
                    <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                      {jsonError}
                    </div>
                  )}
                  <Textarea
                    value={logicJson}
                    onChange={(e) => {
                      setLogicJson(e.target.value);
                      setJsonError("");
                    }}
                    className="min-h-[calc(100vh-220px)] font-mono text-sm bg-slate-800 border-slate-600 text-slate-200"
                    placeholder="Loading logic dictionary..."
                    data-testid="textarea-logic"
                  />
                </>
              )}
            </div>
          )}

          {/* Presets Tab */}
          {activeTab === "presets" && (
            <div className="space-y-6" data-testid="content-presets">
              <div className="flex gap-4">
                {(["5v5", "7v7", "9v9", "11v11"] as GameFormat[]).map((format) => (
                  <Button
                    key={format}
                    variant={selectedFormat === format ? "default" : "outline"}
                    onClick={() => setSelectedFormat(format)}
                    className={selectedFormat === format 
                      ? "bg-orange-500 hover:bg-orange-600" 
                      : "border-slate-600 text-slate-300"
                    }
                    data-testid={`button-format-${format}`}
                  >
                    {format}
                  </Button>
                ))}
              </div>

              {selectedFormat && (
                <>
                  <div className="flex gap-2">
                    <Button
                      variant={selectedSide === "offense" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSide("offense")}
                      className={selectedSide === "offense" ? "bg-green-600" : "border-slate-600 text-slate-300"}
                      data-testid="button-side-offense"
                    >
                      Offense
                    </Button>
                    <Button
                      variant={selectedSide === "defense" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSide("defense")}
                      className={selectedSide === "defense" ? "bg-red-600" : "border-slate-600 text-slate-300"}
                      data-testid="button-side-defense"
                    >
                      Defense
                    </Button>
                  </div>

                  <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                    <div className="grid grid-cols-4 gap-4 p-4 bg-slate-800 border-b border-slate-700 text-sm font-medium text-slate-300">
                      <div>Label</div>
                      <div>X Position</div>
                      <div>Y Position</div>
                      <div>Color Key</div>
                    </div>
                    {presetPlayers.map((player, index) => (
                      <div 
                        key={index}
                        className="grid grid-cols-4 gap-4 p-4 border-b border-slate-700/50 text-sm"
                        data-testid={`player-row-${index}`}
                      >
                        <div className="text-white font-medium" data-testid={`text-player-label-${index}`}>{player.label}</div>
                        <Input
                          type="number"
                          value={player.x}
                          onChange={(e) => handlePlayerCoordChange(index, "x", e.target.value)}
                          className="bg-slate-800 border-slate-600 text-white h-8"
                          data-testid={`input-x-${index}`}
                        />
                        <Input
                          type="number"
                          value={player.y}
                          onChange={(e) => handlePlayerCoordChange(index, "y", e.target.value)}
                          className="bg-slate-800 border-slate-600 text-white h-8"
                          data-testid={`input-y-${index}`}
                        />
                        <div className="text-slate-400 text-xs truncate" data-testid={`text-player-colorkey-${index}`}>{player.colorKey}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    Note: Preset editing is read-only in this version. Changes will not persist.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === "logs" && (
            <div className="space-y-4" data-testid="content-logs">
              {logsLoading ? (
                <div className="text-slate-400">Loading logs...</div>
              ) : (
                <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 p-4 bg-slate-800 border-b border-slate-700 text-sm font-medium text-slate-300">
                    <div className="col-span-1">#</div>
                    <div className="col-span-4">Prompt</div>
                    <div className="col-span-1">Type</div>
                    <div className="col-span-1">Action</div>
                    <div className="col-span-2">Rating</div>
                    <div className="col-span-2">Timestamp</div>
                    <div className="col-span-1">Status</div>
                  </div>
                  {(!logsData || logsData.length === 0) ? (
                    <div className="p-8 text-center text-slate-500">
                      No AI generation logs yet. Generate a play to see logs here.
                    </div>
                  ) : (
                    logsData.map((log, index) => (
                      <div 
                        key={log.id}
                        className="grid grid-cols-12 gap-2 p-4 border-b border-slate-700/50 text-sm items-start"
                        data-testid={`log-row-${log.id}`}
                      >
                        <div className="col-span-1 text-slate-400" data-testid={`text-log-index-${log.id}`}>{index + 1}</div>
                        <div className="col-span-4 text-white break-words whitespace-normal" data-testid={`text-log-prompt-${log.id}`}>
                          {log.prompt || "(image upload)"}
                        </div>
                        <div className="col-span-1 text-slate-300" data-testid={`text-log-type-${log.id}`}>
                          {log.hasImage ? "Image" : "Text"}
                        </div>
                        <div className="col-span-1">
                          {log.previewJson && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                              onClick={() => handleOpenInspectModal(log)}
                              data-testid={`button-view-log-${log.id}`}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                          )}
                        </div>
                        <div className="col-span-2 flex gap-0.5" data-testid={`text-log-rating-${log.id}`}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${
                                star <= (log.rating || 0)
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-slate-600"
                              }`}
                            />
                          ))}
                        </div>
                        <div className="col-span-2 text-slate-400 text-xs break-words whitespace-normal" data-testid={`text-log-timestamp-${log.id}`}>
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                        <div className="col-span-1" data-testid={`text-log-status-${log.id}`}>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            log.status === "success" 
                              ? "bg-green-500/20 text-green-400" 
                              : "bg-red-500/20 text-red-400"
                          }`}>
                            {log.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Email Tab */}
          {activeTab === "email" && (
            <div className="space-y-6" data-testid="content-email">
              {/* Send Welcome Email Form */}
              <div className="bg-slate-900 rounded-lg border border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Send Welcome Email</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Enter an email address to resend the welcome email. The user must have an account.
                </p>
                <div className="flex gap-3">
                  <Input
                    type="email"
                    placeholder="coach@example.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="flex-1 bg-slate-800 border-slate-600 text-white"
                    data-testid="input-email-address"
                  />
                  <Button
                    onClick={() => sendWelcomeEmailMutation.mutate(emailInput)}
                    disabled={!emailInput || sendWelcomeEmailMutation.isPending}
                    className="bg-orange-500 hover:bg-orange-600"
                    data-testid="button-send-email"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {sendWelcomeEmailMutation.isPending ? "Sending..." : "Send Email"}
                  </Button>
                </div>
              </div>

              {/* Admin Password Reset Form */}
              <div className="bg-slate-900 rounded-lg border border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Reset User Password</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Reset a user's password directly. Enter their email and a new password.
                </p>
                <div className="space-y-3">
                  <Input
                    type="email"
                    placeholder="User email address"
                    value={resetPasswordEmail}
                    onChange={(e) => setResetPasswordEmail(e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white"
                    data-testid="input-reset-email"
                  />
                  <Input
                    type="password"
                    placeholder="New password (min 8 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white"
                    data-testid="input-new-password"
                  />
                  <Button
                    onClick={() => resetPasswordMutation.mutate({ email: resetPasswordEmail, password: newPassword })}
                    disabled={!resetPasswordEmail || !newPassword || newPassword.length < 8 || resetPasswordMutation.isPending}
                    className="w-full bg-orange-500 hover:bg-orange-600"
                    data-testid="button-reset-password"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                  </Button>
                </div>
              </div>

              {/* Registered Users List */}
              <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                  <h3 className="text-lg font-semibold text-white">Registered Users</h3>
                  <p className="text-sm text-slate-400">
                    {usersResponse ? `${usersResponse.total} users total` : "Loading..."}
                  </p>
                </div>
                {usersLoading ? (
                  <div className="p-8 text-center text-slate-400">Loading users...</div>
                ) : !usersResponse || usersResponse.users.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No registered users yet.</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="table-users">
                        <thead className="bg-slate-800/50">
                          <tr>
                            <th
                              className="text-left p-3 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                              onClick={() => handleSort("email")}
                              data-testid="th-email"
                            >
                              <div className="flex items-center gap-1">
                                Email
                                {usersSortBy === "email" && (
                                  <span className="text-orange-400">{usersSortOrder === "asc" ? "↑" : "↓"}</span>
                                )}
                              </div>
                            </th>
                            <th
                              className="text-left p-3 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                              onClick={() => handleSort("firstName")}
                              data-testid="th-first-name"
                            >
                              <div className="flex items-center gap-1">
                                First Name
                                {usersSortBy === "firstName" && (
                                  <span className="text-orange-400">{usersSortOrder === "asc" ? "↑" : "↓"}</span>
                                )}
                              </div>
                            </th>
                            <th
                              className="text-left p-3 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                              onClick={() => handleSort("favoriteNFLTeam")}
                              data-testid="th-favorite-team"
                            >
                              <div className="flex items-center gap-1">
                                Favorite NFL Team
                                {usersSortBy === "favoriteNFLTeam" && (
                                  <span className="text-orange-400">{usersSortOrder === "asc" ? "↑" : "↓"}</span>
                                )}
                              </div>
                            </th>
                            <th
                              className="text-left p-3 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                              onClick={() => handleSort("lastLoginIp")}
                              data-testid="th-ip-address"
                            >
                              <div className="flex items-center gap-1">
                                IP Address
                                {usersSortBy === "lastLoginIp" && (
                                  <span className="text-orange-400">{usersSortOrder === "asc" ? "↑" : "↓"}</span>
                                )}
                              </div>
                            </th>
                            <th
                              className="text-left p-3 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                              onClick={() => handleSort("createdAt")}
                              data-testid="th-created-at"
                            >
                              <div className="flex items-center gap-1">
                                Account Created
                                {usersSortBy === "createdAt" && (
                                  <span className="text-orange-400">{usersSortOrder === "asc" ? "↑" : "↓"}</span>
                                )}
                              </div>
                            </th>
                            <th
                              className="text-left p-3 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                              onClick={() => handleSort("lastLoginAt")}
                              data-testid="th-last-login"
                            >
                              <div className="flex items-center gap-1">
                                Last Login
                                {usersSortBy === "lastLoginAt" && (
                                  <span className="text-orange-400">{usersSortOrder === "asc" ? "↑" : "↓"}</span>
                                )}
                              </div>
                            </th>
                            <th className="text-right p-3 text-slate-400 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {usersResponse.users.map((user, index) => (
                            <tr
                              key={user.id}
                              className={`hover:bg-slate-800/50 transition-colors ${index % 2 === 1 ? "bg-slate-800/20" : ""}`}
                              data-testid={`user-row-${user.id}`}
                            >
                              <td className="p-3 text-slate-300 font-medium" data-testid={`text-user-email-${user.id}`}>
                                {user.email}
                              </td>
                              <td className="p-3 text-slate-300" data-testid={`text-user-name-${user.id}`}>
                                {user.firstName || "—"}
                              </td>
                              <td className="p-3 text-slate-300" data-testid={`text-user-team-${user.id}`}>
                                {user.favoriteNFLTeam || "—"}
                              </td>
                              <td className="p-3 text-slate-400 font-mono text-xs" data-testid={`text-user-ip-${user.id}`}>
                                {user.lastLoginIp || "—"}
                              </td>
                              <td className="p-3 text-slate-300" data-testid={`text-user-created-${user.id}`}>
                                {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "—"}
                              </td>
                              <td className="p-3 text-slate-300" data-testid={`text-user-login-${user.id}`}>
                                {user.lastLoginAt ? format(new Date(user.lastLoginAt), "MMM d, yyyy h:mm a") : "Never"}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => sendWelcomeEmailMutation.mutate(user.email)}
                                    disabled={sendWelcomeEmailMutation.isPending}
                                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                    data-testid={`button-send-to-${user.id}`}
                                  >
                                    <Mail className="w-3 h-3 mr-1" />
                                    Email
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setResetPasswordEmail(user.email)}
                                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                    data-testid={`button-reset-${user.id}`}
                                  >
                                    <Key className="w-3 h-3 mr-1" />
                                    Reset
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Pagination Controls */}
                    {usersResponse.totalPages > 1 && (
                      <div className="flex items-center justify-between p-4 border-t border-slate-700">
                        <div className="text-sm text-slate-400">
                          Page {usersResponse.page} of {usersResponse.totalPages}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                            disabled={usersPage === 1 || usersLoading}
                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                            data-testid="button-prev-page"
                          >
                            Previous
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setUsersPage(p => Math.min(usersResponse.totalPages, p + 1))}
                            disabled={usersPage >= usersResponse.totalPages || usersLoading}
                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                            data-testid="button-next-page"
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Plays Tab */}
          {activeTab === "plays" && (
            <div className="space-y-6" data-testid="content-plays">
              <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">All Plays</h3>
                    <p className="text-sm text-slate-400">
                      {playsResponse ? `${playsResponse.pagination.total} plays total` : "Loading..."}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchPlays()}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    data-testid="button-refresh-plays"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
                {playsLoading ? (
                  <div className="p-8 text-center text-slate-400">Loading plays...</div>
                ) : !playsResponse || playsResponse.plays.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No plays found.</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="table-plays">
                        <thead className="bg-slate-800/50">
                          <tr>
                            <th className="text-left p-3 text-slate-400 font-medium">Play Name</th>
                            <th className="text-left p-3 text-slate-400 font-medium">Type</th>
                            <th className="text-left p-3 text-slate-400 font-medium">Formation</th>
                            <th className="text-left p-3 text-slate-400 font-medium">Owner</th>
                            <th className="text-left p-3 text-slate-400 font-medium">Created</th>
                            <th className="text-center p-3 text-slate-400 font-medium">Public</th>
                            <th className="text-right p-3 text-slate-400 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {playsResponse.plays.map((play) => (
                            <tr key={play.id} className="hover:bg-slate-800/50" data-testid={`row-play-${play.id}`}>
                              <td className="p-3 text-white font-medium" data-testid={`text-play-name-${play.id}`}>
                                {play.name}
                              </td>
                              <td className="p-3">
                                <Badge variant="outline" className="capitalize">
                                  {play.type}
                                </Badge>
                              </td>
                              <td className="p-3 text-slate-300" data-testid={`text-play-formation-${play.id}`}>
                                {play.formation || "—"}
                              </td>
                              <td className="p-3 text-slate-300" data-testid={`text-play-owner-${play.id}`}>
                                <div className="flex flex-col">
                                  <span className="text-xs text-slate-400">{play.userEmail || "Unknown"}</span>
                                  {play.userFirstName && (
                                    <span className="text-xs text-slate-500">{play.userFirstName}</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-slate-300" data-testid={`text-play-created-${play.id}`}>
                                {play.createdAt ? format(new Date(play.createdAt), "MMM d, yyyy") : "—"}
                              </td>
                              <td className="p-3 text-center">
                                {play.isPublic ? (
                                  <Globe className="w-4 h-4 text-green-400 mx-auto" />
                                ) : (
                                  <Lock className="w-4 h-4 text-slate-500 mx-auto" />
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <Button
                                  size="sm"
                                  variant={play.isPublic ? "outline" : "default"}
                                  onClick={() => togglePlayPublicMutation.mutate(play.id)}
                                  disabled={togglePlayPublicMutation.isPending}
                                  className={play.isPublic 
                                    ? "border-slate-600 text-slate-300 hover:bg-slate-700" 
                                    : "bg-green-600 hover:bg-green-700"
                                  }
                                  data-testid={`button-toggle-public-${play.id}`}
                                >
                                  {play.isPublic ? (
                                    <>
                                      <Lock className="w-3 h-3 mr-1" />
                                      Make Private
                                    </>
                                  ) : (
                                    <>
                                      <Globe className="w-3 h-3 mr-1" />
                                      Make Public
                                    </>
                                  )}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Pagination Controls */}
                    {playsResponse.pagination.totalPages > 1 && (
                      <div className="flex items-center justify-between p-4 border-t border-slate-700">
                        <div className="text-sm text-slate-400">
                          Page {playsResponse.pagination.page} of {playsResponse.pagination.totalPages}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPlaysPage(p => Math.max(1, p - 1))}
                            disabled={playsPage === 1 || playsLoading}
                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                            data-testid="button-plays-prev-page"
                          >
                            Previous
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPlaysPage(p => Math.min(playsResponse.pagination.totalPages, p + 1))}
                            disabled={playsPage >= playsResponse.pagination.totalPages || playsLoading}
                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                            data-testid="button-plays-next-page"
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Inspect Log Modal */}
      <Dialog open={inspectModalOpen} onOpenChange={setInspectModalOpen}>
        <DialogContent className="max-w-5xl bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-orange-400">Inspect AI Generation</DialogTitle>
            <DialogDescription className="text-slate-400">
              Review and rate this AI-generated play to improve future generations.
            </DialogDescription>
          </DialogHeader>
          
          {selectedLog && (
            <div className="grid grid-cols-2 gap-6">
              {/* Left Side: Play Preview - scrollable */}
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                <h3 className="text-sm font-medium text-slate-300">Generated Play Preview</h3>
                <div className="flex items-center justify-center bg-slate-800 rounded-lg p-4 h-[280px]">
                  {selectedLog.previewJson ? (
                    <PlayPreview 
                      playData={selectedLog.previewJson} 
                      playType="offense" 
                      scale={0.6}
                    />
                  ) : (
                    <div className="text-slate-500 text-sm">No preview available</div>
                  )}
                </div>
                
                {/* Prompt - shown between generated play and uploaded image */}
                <div className="bg-slate-800/50 rounded-lg p-3 text-sm">
                  <span className="text-slate-400">Prompt: </span>
                  <span className="text-white break-words">{selectedLog.prompt || "(image upload)"}</span>
                </div>
                
                {/* Show uploaded image if this was an image generation */}
                {selectedLog.hasImage && selectedLog.uploadedImage && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-slate-300">Original Uploaded Image</h4>
                    <div className="bg-slate-800 rounded-lg p-4 h-[280px] flex items-center justify-center">
                      <img 
                        src={selectedLog.uploadedImage} 
                        alt="Uploaded play diagram" 
                        className="max-w-full max-h-full object-contain rounded"
                        data-testid="img-uploaded-play"
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <span className="text-slate-400">Type:</span>
                    <span className="text-white">{selectedLog.hasImage ? "Image" : "Text"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-400">Status:</span>
                    <span className={selectedLog.status === "success" ? "text-green-400" : "text-red-400"}>
                      {selectedLog.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Side: Feedback Form */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-300">Rate This Generation</h3>
                
                {/* Star Rating */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Quality Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        className="p-1 hover:scale-110 transition-transform"
                        data-testid={`button-star-${star}`}
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= feedbackRating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-slate-600 hover:text-slate-400"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    High-rated plays (4-5 stars) will be used as examples to improve future AI generations.
                  </p>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Feedback Notes</label>
                  <Textarea
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    placeholder="What made this generation good or bad? Any specific issues or improvements?"
                    className="min-h-[150px] bg-slate-800 border-slate-600 text-white"
                    data-testid="textarea-feedback-notes"
                  />
                </div>

                {/* Save Button */}
                <Button
                  onClick={handleSaveFeedback}
                  disabled={updateFeedbackMutation.isPending}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  data-testid="button-save-feedback"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateFeedbackMutation.isPending ? "Saving..." : "Save Feedback"}
                </Button>

                {/* Upload Correct Diagram */}
                <div className="space-y-2 pt-4 border-t border-slate-700">
                  <label className="text-xs text-slate-400">Upload Correct Diagram</label>
                  <p className="text-xs text-slate-500">
                    Upload the correct version of this play diagram for AI training comparison (max 2MB).
                  </p>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleCorrectDiagramUpload}
                    className="bg-slate-800 border-slate-600 text-white file:bg-slate-700 file:text-white file:border-0 file:mr-2"
                    data-testid="input-correct-diagram"
                  />
                  {correctDiagramUpload && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-green-400">Correct diagram uploaded</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCorrectDiagramUpload(null)}
                          className="text-red-400 hover:text-red-300 h-6 px-2"
                          data-testid="button-remove-correct-diagram"
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="bg-slate-800 rounded-lg p-2 h-[150px] flex items-center justify-center">
                        <img 
                          src={correctDiagramUpload} 
                          alt="Correct diagram" 
                          className="max-w-full max-h-full object-contain rounded"
                          data-testid="img-correct-diagram-preview"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
