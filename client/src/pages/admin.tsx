import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Shield
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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
  isAdmin: boolean;
  createdAt: string;
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
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const response = await fetch("/api/admin/users", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      console.log("Admin User Data Received:", data);
      return data;
    },
    enabled: isAdmin || adminCheck?.isAdmin,
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
                  <p className="text-sm text-slate-400">Send welcome email or reset password for any user</p>
                </div>
                {usersLoading ? (
                  <div className="p-8 text-center text-slate-400">Loading users...</div>
                ) : !usersData || usersData.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No registered users yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-users">
                      <thead className="bg-slate-800/50">
                        <tr>
                          <th className="text-left p-3 text-slate-400 font-medium">Date Joined</th>
                          <th className="text-left p-3 text-slate-400 font-medium">Email</th>
                          <th className="text-left p-3 text-slate-400 font-medium">First Name</th>
                          <th className="text-left p-3 text-slate-400 font-medium">Favorite Team</th>
                          <th className="text-left p-3 text-slate-400 font-medium">Role</th>
                          <th className="text-right p-3 text-slate-400 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {usersData.map((user) => (
                          <tr
                            key={user.id}
                            className="hover:bg-slate-800/50 transition-colors"
                            data-testid={`user-row-${user.id}`}
                          >
                            <td className="p-3 text-slate-300" data-testid={`text-user-date-${user.id}`}>
                              {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "N/A"}
                            </td>
                            <td className="p-3 text-white font-medium" data-testid={`text-user-email-${user.id}`}>
                              {user.email}
                            </td>
                            <td className="p-3 text-slate-300" data-testid={`text-user-name-${user.id}`}>
                              {user.firstName || "N/A"}
                            </td>
                            <td className="p-3 text-slate-300" data-testid={`text-user-team-${user.id}`}>
                              {user.favoriteTeam || "N/A"}
                            </td>
                            <td className="p-3" data-testid={`text-user-role-${user.id}`}>
                              {user.isAdmin ? (
                                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                                  <Shield className="w-3 h-3 mr-1" />
                                  Admin
                                </Badge>
                              ) : (
                                <span className="text-slate-500">User</span>
                              )}
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
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
