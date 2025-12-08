import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { 
  Settings, 
  Database, 
  FileText, 
  Home, 
  Save, 
  RefreshCw,
  LogOut,
  Mail,
  Send
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AdminTab = "logic" | "presets" | "logs" | "email";
type GameFormat = "5v5" | "7v7" | "9v9" | "11v11";

interface AILog {
  id: number;
  prompt: string;
  hasImage: boolean;
  timestamp: string;
  status: string;
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
  favoriteTeam: string | null;
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
  const { toast } = useToast();

  // Check URL key as fallback auth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key");
    if (key === "fuzzy2622") {
      setIsAdmin(true);
    }
  }, [setIsAdmin]);

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("key") !== "fuzzy2622") {
        setLocation("/");
      }
    }
  }, [isAdmin, setLocation]);

  // Fetch logic dictionary
  const { data: configData, isLoading: configLoading } = useQuery<ConfigData>({
    queryKey: ["/api/admin/config"],
    enabled: isAdmin,
  });

  // Fetch AI logs
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery<AILog[]>({
    queryKey: ["/api/admin/logs"],
    enabled: isAdmin && activeTab === "logs",
  });

  // Fetch presets
  const { data: presetsData } = useQuery<PresetsData>({
    queryKey: ["/api/admin/presets"],
    enabled: isAdmin,
  });

  // Fetch users for email management (include admin key and credentials)
  const { data: usersData, isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const response = await fetch("/api/admin/users?key=fuzzy2622", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
    enabled: isAdmin && activeTab === "email",
  });

  // Send welcome email mutation (include admin key)
  const sendWelcomeEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch("/api/admin/resend-welcome-email?key=fuzzy2622", {
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

  // Save logic mutation
  const saveLogicMutation = useMutation({
    mutationFn: async (json: string) => {
      const parsed = JSON.parse(json);
      const response = await fetch("/api/admin/config", {
        method: "POST",
        body: JSON.stringify({ logicDictionary: parsed }),
        headers: { "Content-Type": "application/json" },
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
          <h1 className="text-xl font-bold text-orange-400">Admin Dashboard</h1>
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
                  <div className="grid grid-cols-12 gap-4 p-4 bg-slate-800 border-b border-slate-700 text-sm font-medium text-slate-300">
                    <div className="col-span-1">#</div>
                    <div className="col-span-6">Prompt</div>
                    <div className="col-span-2">Type</div>
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
                        className="grid grid-cols-12 gap-4 p-4 border-b border-slate-700/50 text-sm"
                        data-testid={`log-row-${log.id}`}
                      >
                        <div className="col-span-1 text-slate-400" data-testid={`text-log-index-${log.id}`}>{index + 1}</div>
                        <div className="col-span-6 text-white truncate" title={log.prompt} data-testid={`text-log-prompt-${log.id}`}>
                          {log.prompt || "(image upload)"}
                        </div>
                        <div className="col-span-2 text-slate-300" data-testid={`text-log-type-${log.id}`}>
                          {log.hasImage ? "Image" : "Text"}
                        </div>
                        <div className="col-span-2 text-slate-400 text-xs" data-testid={`text-log-timestamp-${log.id}`}>
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

              {/* Registered Users List */}
              <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                  <h3 className="text-lg font-semibold text-white">Registered Users</h3>
                  <p className="text-sm text-slate-400">Click on any user to populate the email field</p>
                </div>
                {usersLoading ? (
                  <div className="p-8 text-center text-slate-400">Loading users...</div>
                ) : !usersData || usersData.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No registered users yet.</div>
                ) : (
                  <div className="divide-y divide-slate-700/50">
                    {usersData.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => setEmailInput(user.email)}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors text-left"
                        data-testid={`user-row-${user.id}`}
                      >
                        <div>
                          <div className="text-white font-medium" data-testid={`text-user-email-${user.id}`}>
                            {user.email}
                          </div>
                          <div className="text-sm text-slate-400">
                            {user.firstName || "No name"} 
                            {user.favoriteTeam && ` • ${user.favoriteTeam}`}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            sendWelcomeEmailMutation.mutate(user.email);
                          }}
                          disabled={sendWelcomeEmailMutation.isPending}
                          className="border-slate-600 text-slate-300 hover:bg-slate-700"
                          data-testid={`button-send-to-${user.id}`}
                        >
                          <Mail className="w-3 h-3 mr-1" />
                          Send
                        </Button>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
