import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Play } from "@shared/schema";
import { PlayPreview } from "@/components/PlayPreview";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Plus,
  Folder,
  LayoutGrid,
  LogIn,
  UserPlus,
  Edit,
  Lock,
  Heart,
  Globe,
  Copy,
  Trash2,
  Tag
} from "lucide-react";
import { TagPopover } from "@/components/TagPopover";

type PlayType = "offense" | "defense" | "special";
type Category = "all" | "favorites" | "run" | "pass" | "play-action" | "rpo" | "trick";
type SortBy = "name" | "createdAt" | "formation" | "personnel";
type LibrarySection = "my-plays" | "basic-library";

interface PlaysResponse {
  userPlays: Play[];
  publicPlays: Play[];
}

const categoryLabels: Record<Category, string> = {
  all: "All Plays",
  favorites: "Favorites",
  run: "Run",
  pass: "Pass",
  "play-action": "Play-Action",
  rpo: "RPO",
  trick: "Trick",
};

interface PlayData {
  players?: unknown[];
  routes?: unknown[];
  shapes?: unknown[];
  football?: { x: number; y: number };
  playAction?: { x: number; y: number };
  overlayPlayers?: unknown[];
  overlayRoutes?: unknown[];
}

export default function PlayLibrary() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [playType, setPlayType] = useState<PlayType>("offense");
  const [category, setCategory] = useState<Category>("all");
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedPlays, setSelectedPlays] = useState<Set<number>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [doubleClickedPlay, setDoubleClickedPlay] = useState<Play | null>(null);
  const [showPlayDialog, setShowPlayDialog] = useState(false);
  const [myPlaysExpanded, setMyPlaysExpanded] = useState(true);
  const [basicLibraryExpanded, setBasicLibraryExpanded] = useState(true);
  const [premiumLibraryExpanded, setPremiumLibraryExpanded] = useState(false);
  // Default to basic-library - works for both logged in and logged out users
  const [activeSection, setActiveSection] = useState<LibrarySection>("basic-library");
  const [playToDelete, setPlayToDelete] = useState<Play | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const { data: user, isLoading: userLoading } = useQuery<{ id: string; email: string; firstName: string; isAdmin?: boolean } | null>({
    queryKey: ["/api/me"],
  });

  
  // Fetch user's plays (only when authenticated)
  const { data: playsData, isLoading: playsLoading } = useQuery<PlaysResponse>({
    queryKey: ["/api/plays"],
    enabled: !!user,
  });
  
  // Fetch public templates (always available, no auth required)
  const { data: publicTemplates = [], isLoading: templatesLoading } = useQuery<Play[]>({
    queryKey: ["/api/public/templates"],
  });
  
  const userPlays = playsData?.userPlays || [];
  // Use public templates from dedicated endpoint, which works for all users
  const publicPlays = publicTemplates;
  
  // Choose which plays to display based on active section
  const activePlays = activeSection === "my-plays" ? userPlays : publicPlays;
  const playsForType = activePlays.filter((play) => play.type === playType);
  
  const filteredPlays = playsForType.filter((play) => {
    if (category === "all") return true;
    if (category === "favorites") return play.isFavorite === true;
    return play.concept === category;
  });
  
  const sortedPlays = [...filteredPlays].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "createdAt":
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      case "formation":
        return (a.formation || "").localeCompare(b.formation || "");
      case "personnel":
        return (a.personnel || "").localeCompare(b.personnel || "");
      default:
        return 0;
    }
  });
  
  // Category counts for user's plays
  const userPlaysForType = userPlays.filter((p) => p.type === playType);
  const userCategoryCounts = {
    all: userPlaysForType.length,
    favorites: userPlaysForType.filter((p) => p.isFavorite === true).length,
    run: userPlaysForType.filter((p) => p.concept === "run").length,
    pass: userPlaysForType.filter((p) => p.concept === "pass").length,
    "play-action": userPlaysForType.filter((p) => p.concept === "play-action").length,
    rpo: userPlaysForType.filter((p) => p.concept === "rpo").length,
    trick: userPlaysForType.filter((p) => p.concept === "trick").length,
  };
  
  // Category counts for public plays (Basic Library)
  const publicPlaysForType = publicPlays.filter((p) => p.type === playType);
  const publicCategoryCounts = {
    all: publicPlaysForType.length,
    favorites: 0, // No favorites for public plays
    run: publicPlaysForType.filter((p) => p.concept === "run").length,
    pass: publicPlaysForType.filter((p) => p.concept === "pass").length,
    "play-action": publicPlaysForType.filter((p) => p.concept === "play-action").length,
    rpo: publicPlaysForType.filter((p) => p.concept === "rpo").length,
    trick: publicPlaysForType.filter((p) => p.concept === "trick").length,
  };
  
  // Use the counts for the active section
  const categoryCounts = activeSection === "my-plays" ? userCategoryCounts : publicCategoryCounts;
  
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ playId, isFavorite }: { playId: number; isFavorite: boolean }) => {
      return apiRequest("PATCH", `/api/plays/${playId}`, { isFavorite });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plays"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update favorite status",
        variant: "destructive",
      });
    },
  });
  
  // Clone a public template to user's library
  const clonePlayMutation = useMutation({
    mutationFn: async (play: Play) => {
      // Ensure data is a proper object, not a stringified JSON
      let parsedData = play.data;
      if (typeof parsedData === "string") {
        try {
          parsedData = JSON.parse(parsedData);
        } catch {
          parsedData = {};
        }
      }
      
      // Ensure tags is a proper array
      let parsedTags = play.tags;
      if (typeof parsedTags === "string") {
        try {
          parsedTags = JSON.parse(parsedTags);
        } catch {
          parsedTags = [];
        }
      }
      if (!Array.isArray(parsedTags)) {
        parsedTags = [];
      }
      
      return apiRequest("POST", "/api/plays", {
        name: play.name,
        type: play.type,
        concept: play.concept,
        formation: play.formation,
        personnel: play.personnel,
        situation: play.situation,
        data: parsedData,
        tags: parsedTags,
        isFavorite: false,
        clonedFromId: play.id,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plays"] });
      toast({
        title: "Play Added to Library!",
        description: `"${variables.name}" has been saved to your library. You can now edit it.`,
      });
      setActiveSection("my-plays");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save play to your library",
        variant: "destructive",
      });
    },
  });
  
  // Admin: Delete a public play
  const deletePlayMutation = useMutation({
    mutationFn: async (playId: number) => {
      return apiRequest("DELETE", `/api/admin/plays/${playId}`);
    },
    onSuccess: (_, playId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plays"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/templates"] });
      toast({
        title: "Play Deleted",
        description: "The play has been removed from the library.",
      });
      setShowDeleteConfirm(false);
      setPlayToDelete(null);
      setShowPlayDialog(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete play. You may not have permission.",
        variant: "destructive",
      });
    },
  });

  const handleDeletePlay = (e: React.MouseEvent, play: Play) => {
    e.stopPropagation();
    setPlayToDelete(play);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (playToDelete) {
      deletePlayMutation.mutate(playToDelete.id);
    }
  };
  
  const handleToggleFavorite = (e: React.MouseEvent, play: Play) => {
    e.stopPropagation();
    toggleFavoriteMutation.mutate({ playId: play.id, isFavorite: !play.isFavorite });
  };
  
  
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied!",
      description: "Play link has been copied to clipboard.",
    });
  };
  
  const handleExport = () => {
    toast({
      title: "Export started",
      description: "Your plays are being prepared for download...",
    });
    console.log("Export PDF triggered for selected plays:", Array.from(selectedPlays));
  };
  
  const togglePlaySelection = (playId: number) => {
    setSelectedPlays((prev) => {
      const next = new Set(prev);
      if (next.has(playId)) {
        next.delete(playId);
      } else {
        next.add(playId);
      }
      return next;
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
  
  // For unauthenticated users, show the Basic Library section by default
  // They can browse templates but need to sign in to save them

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
        className={`${sidebarCollapsed ? 'w-16' : 'w-64'} border-r border-gray-200 bg-gray-50 flex flex-col transition-all duration-300`}
        data-testid="sidebar-filters"
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {!sidebarCollapsed && (
            <h2 className="font-semibold text-gray-900">Filters</h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            data-testid="button-toggle-sidebar"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
        
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {/* My Plays Section */}
          <div className="space-y-1">
            <button
              onClick={() => {
                setMyPlaysExpanded(!myPlaysExpanded);
                if (!myPlaysExpanded) {
                  setActiveSection("my-plays");
                  setBasicLibraryExpanded(false);
                }
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left font-semibold transition-colors ${
                activeSection === "my-plays" ? 'bg-orange-50 text-orange-700' : 'text-gray-900 hover:bg-gray-100'
              }`}
              data-testid="section-my-plays"
            >
              <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${myPlaysExpanded ? '' : '-rotate-90'}`} />
              {!sidebarCollapsed && <span className="flex-1">My Plays</span>}
            </button>
            {myPlaysExpanded && (
              <div className="ml-2 space-y-1">
                {(Object.entries(categoryLabels) as [Category, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setActiveSection("my-plays");
                      setCategory(key);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-left text-sm transition-colors ${
                      activeSection === "my-plays" && category === key 
                        ? 'bg-orange-100 text-orange-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    data-testid={`filter-${key}`}
                  >
                    {key === "favorites" ? (
                      <Heart className="w-3.5 h-3.5 flex-shrink-0" />
                    ) : (
                      <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                    )}
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1">{label}</span>
                        <span className="text-xs text-gray-500">({userCategoryCounts[key]})</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RC Football Basic Play Library Section */}
          <div className="space-y-1">
            <button
              onClick={() => {
                setBasicLibraryExpanded(!basicLibraryExpanded);
                if (!basicLibraryExpanded) {
                  setActiveSection("basic-library");
                  setMyPlaysExpanded(false);
                }
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left font-semibold transition-colors ${
                activeSection === "basic-library" ? 'bg-orange-50 text-orange-700' : 'text-gray-900 hover:bg-gray-100'
              }`}
              data-testid="section-basic-library"
            >
              <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${basicLibraryExpanded ? '' : '-rotate-90'}`} />
              {!sidebarCollapsed && <span className="flex-1 text-sm">RC Football Basic Play Library</span>}
            </button>
            {basicLibraryExpanded && (
              <div className="ml-2 space-y-1">
                {(Object.entries(categoryLabels) as [Category, string][]).filter(([key]) => key !== "favorites").map(([key, label]) => (
                  <button
                    key={`basic-${key}`}
                    onClick={() => {
                      setActiveSection("basic-library");
                      setCategory(key);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-left text-sm transition-colors ${
                      activeSection === "basic-library" && category === key
                        ? 'bg-orange-100 text-orange-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    data-testid={`basic-filter-${key}`}
                  >
                    <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1">{label}</span>
                        <span className="text-xs text-gray-500">({publicCategoryCounts[key]})</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RC Football Premium Play Library Section */}
          <div className="space-y-1">
            <button
              onClick={() => setPremiumLibraryExpanded(!premiumLibraryExpanded)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
              data-testid="section-premium-library"
            >
              <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${premiumLibraryExpanded ? '' : '-rotate-90'}`} />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-sm">RC Football Premium Play Library</span>
                  <Lock className="w-3.5 h-3.5 text-gray-400" />
                </>
              )}
            </button>
            {premiumLibraryExpanded && (
              <div className="ml-2 space-y-1">
                {(Object.entries(categoryLabels) as [Category, string][]).map(([key, label]) => (
                  <button
                    key={`premium-${key}`}
                    className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-left text-sm text-gray-500 cursor-not-allowed"
                    disabled
                    data-testid={`premium-filter-${key}`}
                  >
                    <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1">{label}</span>
                        <span className="text-xs text-gray-400">(0)</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
        
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-gray-200">
            <Link href="/">
              <Button variant="outline" className="w-full" data-testid="button-back-designer">
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
          {/* Centered Title */}
          <h1 className="text-5xl font-bold text-gray-900 text-center mb-6" data-testid="text-page-title">
            Play Library
          </h1>
          
          
          {/* Centered Play Type Toggle Pills */}
          <div className="flex justify-center mb-6">
            <div className="flex gap-2" data-testid="play-type-tabs">
              {(["offense", "defense", "special"] as PlayType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setPlayType(type)}
                  className={`px-6 py-2 rounded-full font-medium transition-colors border ${
                    playType === type
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  data-testid={`tab-${type}`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          {/* Toolbar Row: GROUP BY on left, Action buttons on right */}
          <div className="flex items-center justify-between">
            {/* Group By Dropdown - Left */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 uppercase tracking-wide">Group By:</span>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                <SelectTrigger className="w-40" data-testid="select-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Play Name</SelectItem>
                  <SelectItem value="createdAt">Date Created</SelectItem>
                  <SelectItem value="formation">Formation</SelectItem>
                  <SelectItem value="personnel">Personnel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Action Buttons - Right */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={handleShare}
                disabled={selectedPlays.size === 0}
                className="bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
                data-testid="button-share"
              >
                Share Play
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExport}
                disabled={selectedPlays.size === 0}
                className="bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
                data-testid="button-export"
              >
                Export Play
              </Button>
              <Link href="/">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="button-new-play">
                  <Plus className="w-4 h-4 mr-2" />
                  New Play
                </Button>
              </Link>
            </div>
          </div>
        </header>
        
        {/* Gallery Grid */}
        <div className="flex-1 p-6 pr-8 overflow-auto">
          {playsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-pulse text-gray-500">Loading plays...</div>
            </div>
          ) : sortedPlays.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <LayoutGrid className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No plays yet</h3>
              <p className="text-gray-500 mb-4">
                Create your first {playType} play to get started.
              </p>
              <Link href="/">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="button-create-first">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Play
                </Button>
              </Link>
            </div>
          ) : (
            <div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              data-testid="plays-grid"
            >
              {sortedPlays.map((play) => (
                <div
                  key={play.id}
                  onClick={() => togglePlaySelection(play.id)}
                  onDoubleClick={() => {
                    setDoubleClickedPlay(play);
                    setShowPlayDialog(true);
                  }}
                  className={`bg-white rounded-lg border ${
                    selectedPlays.has(play.id) 
                      ? 'border-orange-500 ring-2 ring-orange-200' 
                      : 'border-gray-200 hover:border-gray-300'
                  } shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden relative`}
                  data-testid={`play-card-${play.id}`}
                >
                  {/* Official Template Badge for Public Plays */}
                  {play.isPublic && (
                    <div className="absolute top-2 left-2 z-10">
                      <span className="flex items-center gap-1 bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded-full shadow-sm">
                        <Globe className="w-3 h-3" />
                        Official Template
                      </span>
                    </div>
                  )}
                  
                  {/* Quick Action Icons */}
                  <div className="absolute top-2 right-2 flex gap-1 z-10">
                    {!play.isPublic && (
                      <button
                        onClick={(e) => handleToggleFavorite(e, play)}
                        className={`p-1.5 rounded-full transition-colors ${
                          play.isFavorite
                            ? 'bg-red-500 text-white'
                            : 'bg-white/80 text-gray-500 hover:bg-white hover:text-red-500'
                        }`}
                        data-testid={`button-favorite-${play.id}`}
                      >
                        <Heart className={`w-4 h-4 ${play.isFavorite ? 'fill-current' : ''}`} />
                      </button>
                    )}
                    {play.isPublic && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!user) {
                            toast({
                              title: "Sign in required",
                              description: "Please sign in to save templates to your library.",
                            });
                            navigate("/?signup=true");
                            return;
                          }
                          clonePlayMutation.mutate(play);
                        }}
                        className="p-1.5 rounded-full bg-white/80 text-gray-500 hover:bg-white hover:text-blue-600 transition-colors"
                        data-testid={`button-clone-${play.id}`}
                        title="Add to My Library"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                    {/* Admin-only delete button for public plays */}
                    {play.isPublic && user?.isAdmin && (
                      <button
                        onClick={(e) => handleDeletePlay(e, play)}
                        className="p-1.5 rounded-full bg-white/80 text-gray-500 hover:bg-white hover:text-red-600 transition-colors"
                        data-testid={`button-delete-${play.id}`}
                        title="Delete from Library (Admin)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {/* Tag button - only for user's own plays or admin on public plays */}
                    {(!play.isPublic || user?.isAdmin) && user && (
                      <TagPopover
                        playId={play.id}
                        currentConcept={play.concept}
                        triggerClassName="p-1.5 rounded-full bg-white/80 text-gray-500 hover:bg-white hover:text-orange-500 transition-colors"
                      />
                    )}
                  </div>
                  
                  {/* Play Preview */}
                  <div className="h-64 bg-gray-100 flex items-center justify-center">
                    <PlayPreview
                      playData={play.data as any}
                      playType={play.type as PlayType}
                      playName={play.name}
                      formation={play.formation || undefined}
                      scale={0.6}
                    />
                  </div>
                  
                  {/* Play Info */}
                  <div className="p-3 border-t border-gray-100">
                    <h3 className="font-medium text-gray-900 truncate" data-testid={`text-play-name-${play.id}`}>
                      {play.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                      {play.formation && (
                        <span className="bg-gray-100 px-2 py-0.5 rounded">{play.formation}</span>
                      )}
                      {play.personnel && (
                        <span className="bg-gray-100 px-2 py-0.5 rounded">{play.personnel}</span>
                      )}
                      {play.concept && (
                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded capitalize">
                          {play.concept}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      </div>

      {/* Play Actions Dialog */}
      <Dialog open={showPlayDialog} onOpenChange={setShowPlayDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {doubleClickedPlay?.name}
              {doubleClickedPlay?.isPublic && (
                <span className="flex items-center gap-1 bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  <Globe className="w-3 h-3" />
                  Template
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {doubleClickedPlay?.isPublic 
                ? "Save this template to your library to customize it."
                : "Choose an action for this play"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            {doubleClickedPlay?.isPublic ? (
              <>
                <Button
                  onClick={() => {
                    if (!user) {
                      toast({
                        title: "Sign in required",
                        description: "Please sign in to save templates to your library.",
                      });
                      setShowPlayDialog(false);
                      navigate("/?signup=true");
                      return;
                    }
                    if (doubleClickedPlay) {
                      clonePlayMutation.mutate(doubleClickedPlay);
                    }
                    setShowPlayDialog(false);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white justify-start"
                  data-testid="button-save-to-library"
                  disabled={clonePlayMutation.isPending}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {user ? (clonePlayMutation.isPending ? "Saving..." : "Save to My Library") : "Sign in to Save"}
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  {user 
                    ? "After saving, you can edit and customize this play in the Play Designer."
                    : "Sign in to save this template and start customizing it."
                  }
                </p>
                {/* Admin-only delete option for public plays */}
                {user?.isAdmin && (
                  <Button
                    onClick={() => {
                      if (doubleClickedPlay) {
                        setPlayToDelete(doubleClickedPlay);
                        setShowDeleteConfirm(true);
                      }
                    }}
                    variant="destructive"
                    className="w-full justify-start mt-2"
                    data-testid="button-admin-delete"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete from Library (Admin)
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  onClick={() => {
                    setShowPlayDialog(false);
                    navigate("/");
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white justify-start"
                  data-testid="button-go-to-designer"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Go to Play Designer
                </Button>
                {doubleClickedPlay && (
                  <div className="w-full">
                    <TagPopover
                      playId={doubleClickedPlay.id}
                      currentConcept={doubleClickedPlay.concept}
                      triggerClassName="w-full flex items-center justify-start gap-2 px-4 py-2 border border-input rounded-md bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Play</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{playToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setPlayToDelete(null);
              }}
              className="flex-1"
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deletePlayMutation.isPending}
              className="flex-1"
              data-testid="button-confirm-delete"
            >
              {deletePlayMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
