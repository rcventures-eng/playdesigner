import { useState } from "react";
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
  const [newTeamCoverUrl, setNewTeamCoverUrl] = useState("");

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
          className={`${sidebarCollapsed ? "w-16" : "w-64"} border-r border-gray-200 bg-gray-50 flex flex-col transition-all duration-300`}
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
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    selectedTeamId === team.id
                      ? "bg-orange-100 text-orange-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  data-testid={`team-item-${team.id}`}
                >
                  <FolderOpen className="w-4 h-4 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 truncate">{team.name}</span>
                      <span className="text-xs text-gray-500">{team.year}</span>
                    </>
                  )}
                </button>
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
                  <Link href={`/plays?teamId=${selectedTeam.id}`}>
                    <Button
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      data-testid="button-view-plays"
                    >
                      View Plays
                    </Button>
                  </Link>
                </div>
                {selectedTeam.coverImageUrl && (
                  <div className="mb-6">
                    <img
                      src={selectedTeam.coverImageUrl}
                      alt={`${selectedTeam.name} cover`}
                      className="w-full max-w-2xl h-48 object-cover rounded-lg"
                    />
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
              <p className="text-xs text-gray-500">
                Ideal dimensions: 672×192 OR 3.5:1 aspect ratio
              </p>
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
    </div>
  );
}
