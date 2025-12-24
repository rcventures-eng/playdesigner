import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Team } from "@shared/schema";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  LogIn,
  UserPlus,
  FolderOpen,
  Trash2,
  Pencil,
  Upload,
} from "lucide-react";

export default function TeamPlaybooks() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamYear, setNewTeamYear] = useState("2025");
  const [newTeamGameFormat, setNewTeamGameFormat] = useState("5v5");
  const [newTeamCoverUrl, setNewTeamCoverUrl] = useState("");

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTeamId, setEditTeamId] = useState<number | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamYear, setEditTeamYear] = useState("2025");
  const [editTeamGameFormat, setEditTeamGameFormat] = useState("5v5");
  const [editTeamCoverUrl, setEditTeamCoverUrl] = useState("");

  // File input refs for image upload
  const createFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const { data: user, isLoading: userLoading } = useQuery<{
    id: string;
    email: string;
    firstName: string;
  } | null>({
    queryKey: ["/api/me"],
  });

  const { data: teams = [], isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    enabled: !!user,
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      year: string;
      coverImageUrl?: string;
    }) => {
      return apiRequest("POST", "/api/teams", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setShowCreateModal(false);
      setNewTeamName("");
      setNewTeamYear("2025");
      setNewTeamGameFormat("5v5");
      setNewTeamCoverUrl("");
      toast({
        title: "Team created!",
        description: "Your new team playbook has been created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create team",
        variant: "destructive",
      });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: number) => {
      return apiRequest("DELETE", `/api/teams/${teamId}`);
    },
    onSuccess: (_data, deletedTeamId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      if (selectedTeamId === deletedTeamId) {
        setSelectedTeamId(null);
      }
      toast({
        title: "Team deleted",
        description: "The team has been removed from your playbooks.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete team",
        variant: "destructive",
      });
    },
  });

  const handleDeleteTeam = (teamId: number, teamName: string) => {
    if (window.confirm(`Are you sure you want to delete "${teamName}"? This action cannot be undone.`)) {
      deleteTeamMutation.mutate(teamId);
    }
  };

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) {
      toast({
        title: "Team name required",
        description: "Please enter a name for your team.",
        variant: "destructive",
      });
      return;
    }
    createTeamMutation.mutate({
      name: newTeamName.trim(),
      year: newTeamYear,
      coverImageUrl: newTeamCoverUrl.trim() || undefined,
    });
  };

  const updateTeamMutation = useMutation({
    mutationFn: async (data: {
      id: number;
      name: string;
      year: string;
      coverImageUrl?: string;
    }) => {
      return apiRequest("PATCH", `/api/teams/${data.id}`, {
        name: data.name,
        year: data.year,
        coverImageUrl: data.coverImageUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setShowEditModal(false);
      setEditTeamId(null);
      setEditTeamName("");
      setEditTeamYear("2025");
      setEditTeamGameFormat("5v5");
      setEditTeamCoverUrl("");
      toast({
        title: "Team updated!",
        description: "Your team playbook has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update team",
        variant: "destructive",
      });
    },
  });

  const handleEditTeam = (team: Team) => {
    setEditTeamId(team.id);
    setEditTeamName(team.name);
    setEditTeamYear(team.year || "2025");
    setEditTeamCoverUrl(team.coverImageUrl || "");
    setShowEditModal(true);
  };

  const handleUpdateTeam = () => {
    if (!editTeamId || !editTeamName.trim()) {
      toast({
        title: "Team name required",
        description: "Please enter a name for your team.",
        variant: "destructive",
      });
      return;
    }
    updateTeamMutation.mutate({
      id: editTeamId,
      name: editTeamName.trim(),
      year: editTeamYear,
      coverImageUrl: editTeamCoverUrl.trim() || undefined,
    });
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setUrl: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setUrl(base64);
      toast({
        title: "Image uploaded",
        description: "Your cover image has been added.",
      });
    };
    reader.onerror = () => {
      toast({
        title: "Upload failed",
        description: "Could not read the image file.",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <TopNav
          isAdmin={isAdmin}
          setIsAdmin={setIsAdmin}
          showSignUp={showSignUp}
          setShowSignUp={setShowSignUp}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <TopNav
          isAdmin={isAdmin}
          setIsAdmin={setIsAdmin}
          showSignUp={showSignUp}
          setShowSignUp={setShowSignUp}
        />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="max-w-md text-center space-y-6">
            <Users className="w-16 h-16 text-orange-500 mx-auto" />
            <h1 className="text-3xl font-bold text-gray-900">Team Playbooks</h1>
            <p className="text-gray-600">
              Sign in to create and manage your team playbooks.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate("/")}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                data-testid="button-login-prompt"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Log In
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/?signup=true")}
                data-testid="button-signup-prompt"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Create Account
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <TopNav
        isAdmin={isAdmin}
        setIsAdmin={setIsAdmin}
        showSignUp={showSignUp}
        setShowSignUp={setShowSignUp}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${sidebarCollapsed ? "w-16" : "w-96"} border-r border-gray-200 bg-gray-50 flex flex-col transition-all duration-300`}
          data-testid="sidebar-teams"
        >
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            {!sidebarCollapsed && (
              <h2 className="font-semibold text-gray-900">Teams</h2>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              data-testid="button-toggle-sidebar"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </Button>
          </div>

          <nav className="flex-1 p-2 space-y-1 overflow-auto">
            {teamsLoading ? (
              <div className="p-3 text-gray-500 text-sm">Loading teams...</div>
            ) : teams.length === 0 ? (
              <div className="p-3 text-gray-500 text-sm">
                {sidebarCollapsed ? "" : "No teams yet"}
              </div>
            ) : (
              teams.map((team) => (
                <ContextMenu key={team.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                        selectedTeamId === team.id
                          ? "bg-orange-100 text-orange-700"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                      data-testid={`team-item-${team.id}`}
                    >
                      <button
                        onClick={() => setSelectedTeamId(team.id)}
                        className="flex-1 flex items-center gap-3 text-left"
                      >
                        <FolderOpen className="w-4 h-4 flex-shrink-0" />
                        {!sidebarCollapsed && (
                          <>
                            <span className="flex-1 truncate">{team.name}</span>
                            <span className="text-xs text-gray-500">{team.year}</span>
                          </>
                        )}
                      </button>
                      {!sidebarCollapsed && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTeam(team.id, team.name);
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete team"
                          data-testid={`button-delete-team-${team.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="bg-white border-gray-200">
                    <ContextMenuItem
                      onClick={() => setSelectedTeamId(team.id)}
                      className="cursor-pointer"
                    >
                      <FolderOpen className="w-4 h-4 mr-2" />
                      Open Playbook
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => handleDeleteTeam(team.id, team.name)}
                      className="cursor-pointer text-red-600 focus:text-red-600"
                      data-testid={`context-delete-team-${team.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Team
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))
            )}
          </nav>

          {!sidebarCollapsed && (
            <div className="p-4 border-t border-gray-200 space-y-2">
              <Button
                onClick={() => setShowCreateModal(true)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                data-testid="button-create-team-sidebar"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Team
              </Button>
              <Link href="/">
                <Button
                  variant="outline"
                  className="w-full"
                  data-testid="button-back-designer"
                >
                  Back to Designer
                </Button>
              </Link>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col pl-4">
          {/* Header */}
          <header className="p-6 border-b border-gray-200">
            <h1
              className="text-5xl font-bold text-gray-900 text-center mb-6"
              data-testid="text-page-title"
            >
              Team Playbooks
            </h1>
          </header>

          {/* Content Area */}
          <div className="flex-1 p-6 pr-8 overflow-auto">
            {teams.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Users className="w-16 h-16 text-gray-300 mb-4" />
                <h3
                  className="text-xl font-medium text-gray-900 mb-2"
                  data-testid="text-empty-title"
                >
                  No Team Playbooks Yet
                </h3>
                <p className="text-gray-500 mb-6 max-w-md">
                  Create your first team playbook to organize your plays by
                  team, season, or league.
                </p>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  data-testid="button-create-team-cta"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Team Playbook
                </Button>
              </div>
            ) : selectedTeam ? (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedTeam.name}
                    </h2>
                    <p className="text-gray-500">Season: {selectedTeam.year}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleEditTeam(selectedTeam)}
                      className="border-zinc-600 text-zinc-700 hover:bg-zinc-100"
                      data-testid="button-edit-team"
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Link href={`/plays?teamId=${selectedTeam.id}`}>
                      <Button
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        data-testid="button-view-plays"
                      >
                        View Plays
                      </Button>
                    </Link>
                  </div>
                </div>
                {selectedTeam.coverImageUrl ? (
                  <div className="mb-6 relative group max-w-2xl">
                    <img
                      src={selectedTeam.coverImageUrl}
                      alt={`${selectedTeam.name} cover`}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => handleDeleteTeam(selectedTeam.id, selectedTeam.name)}
                      className="absolute top-3 right-3 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete team"
                      data-testid="button-delete-team-cover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="mb-6 relative group max-w-2xl bg-gray-100 h-48 rounded-lg flex items-center justify-center">
                    <FolderOpen className="w-16 h-16 text-gray-300" />
                    <button
                      onClick={() => handleDeleteTeam(selectedTeam.id, selectedTeam.name)}
                      className="absolute top-3 right-3 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete team"
                      data-testid="button-delete-team-cover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <p className="text-gray-600">
                  Select a team from the sidebar or create a new one to get
                  started.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <FolderOpen className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Select a Team
                </h3>
                <p className="text-gray-500">
                  Choose a team from the sidebar to view its details.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Create Team Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              Create Team Playbook
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Add a new team to organize your plays.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="team-name" className="text-white">
                Team Name
              </Label>
              <Input
                id="team-name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Enter team name"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
                data-testid="input-team-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-year" className="text-white">
                Year
              </Label>
              <Select value={newTeamYear} onValueChange={setNewTeamYear}>
                <SelectTrigger
                  className="bg-zinc-800 border-zinc-700 text-white"
                  data-testid="select-team-year"
                >
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="2024" className="text-white">
                    2024
                  </SelectItem>
                  <SelectItem value="2025" className="text-white">
                    2025
                  </SelectItem>
                  <SelectItem value="2026" className="text-white">
                    2026
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-game-format" className="text-white">
                Game Format
              </Label>
              <Select value={newTeamGameFormat} onValueChange={setNewTeamGameFormat}>
                <SelectTrigger
                  className="bg-zinc-800 border-zinc-700 text-white"
                  data-testid="select-team-game-format"
                >
                  <SelectValue placeholder="Select game format" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="5v5" className="text-white">
                    5-on-5
                  </SelectItem>
                  <SelectItem value="7v7" className="text-white">
                    7-on-7
                  </SelectItem>
                  <SelectItem value="9v9" className="text-white">
                    9-on-9
                  </SelectItem>
                  <SelectItem value="11v11" className="text-white">
                    11-on-11
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Upload Playbook Cover Image</Label>
              <input
                type="file"
                ref={createFileInputRef}
                onChange={(e) => handleImageUpload(e, setNewTeamCoverUrl)}
                accept="image/*"
                className="hidden"
                data-testid="input-create-cover-file"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => createFileInputRef.current?.click()}
                className="w-full border-zinc-700 text-white hover:bg-zinc-800"
                data-testid="button-upload-create-cover"
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose Image
              </Button>
              {newTeamCoverUrl && (
                <div className="mt-2 relative">
                  <img
                    src={newTeamCoverUrl}
                    alt="Cover preview"
                    className="w-full h-24 object-cover rounded-md"
                  />
                  <button
                    type="button"
                    onClick={() => setNewTeamCoverUrl("")}
                    className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs"
                    data-testid="button-remove-create-cover"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-500">
                16:9 aspect ratio for best resolution
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-cover" className="text-white">
                Cover Image URL (optional)
              </Label>
              <Input
                id="team-cover"
                value={newTeamCoverUrl}
                onChange={(e) => setNewTeamCoverUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
                data-testid="input-team-cover"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="border-zinc-700 text-white hover:bg-zinc-800"
                data-testid="button-cancel-create"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTeam}
                disabled={createTeamMutation.isPending}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                data-testid="button-submit-create"
              >
                {createTeamMutation.isPending ? "Creating..." : "Create Team"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Team Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Team Playbook</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update your team's details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-team-name" className="text-white">
                Team Name
              </Label>
              <Input
                id="edit-team-name"
                value={editTeamName}
                onChange={(e) => setEditTeamName(e.target.value)}
                placeholder="Enter team name"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
                data-testid="input-edit-team-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team-year" className="text-white">
                Year
              </Label>
              <Select value={editTeamYear} onValueChange={setEditTeamYear}>
                <SelectTrigger
                  className="bg-zinc-800 border-zinc-700 text-white"
                  data-testid="select-edit-team-year"
                >
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="2024" className="text-white">
                    2024
                  </SelectItem>
                  <SelectItem value="2025" className="text-white">
                    2025
                  </SelectItem>
                  <SelectItem value="2026" className="text-white">
                    2026
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-game-format" className="text-white">
                Game Format
              </Label>
              <Select value={editTeamGameFormat} onValueChange={setEditTeamGameFormat}>
                <SelectTrigger
                  className="bg-zinc-800 border-zinc-700 text-white"
                  data-testid="select-edit-game-format"
                >
                  <SelectValue placeholder="Select game format" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="5v5" className="text-white">
                    5-on-5
                  </SelectItem>
                  <SelectItem value="7v7" className="text-white">
                    7-on-7
                  </SelectItem>
                  <SelectItem value="9v9" className="text-white">
                    9-on-9
                  </SelectItem>
                  <SelectItem value="11v11" className="text-white">
                    11-on-11
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Upload Playbook Cover Image</Label>
              <input
                type="file"
                ref={editFileInputRef}
                onChange={(e) => handleImageUpload(e, setEditTeamCoverUrl)}
                accept="image/*"
                className="hidden"
                data-testid="input-edit-cover-file"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => editFileInputRef.current?.click()}
                className="w-full border-zinc-700 text-white hover:bg-zinc-800"
                data-testid="button-upload-edit-cover"
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose Image
              </Button>
              {editTeamCoverUrl && (
                <div className="mt-2 relative">
                  <img
                    src={editTeamCoverUrl}
                    alt="Cover preview"
                    className="w-full h-24 object-cover rounded-md"
                  />
                  <button
                    type="button"
                    onClick={() => setEditTeamCoverUrl("")}
                    className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs"
                    data-testid="button-remove-edit-cover"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-500">
                16:9 aspect ratio for best resolution
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team-cover" className="text-white">
                Cover Image URL (optional)
              </Label>
              <Input
                id="edit-team-cover"
                value={editTeamCoverUrl}
                onChange={(e) => setEditTeamCoverUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
                data-testid="input-edit-team-cover"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="border-zinc-700 text-white hover:bg-zinc-800"
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateTeam}
                disabled={updateTeamMutation.isPending}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                data-testid="button-submit-edit"
              >
                {updateTeamMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
