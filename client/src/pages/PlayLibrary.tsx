import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Folder,
  LayoutGrid,
  LogIn,
  UserPlus
} from "lucide-react";

type PlayType = "offense" | "defense" | "special";
type Category = "all" | "run" | "pass" | "play-action" | "rpo" | "trick";
type SortBy = "name" | "createdAt" | "formation" | "personnel";

const categoryLabels: Record<Category, string> = {
  all: "All Plays",
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
  
  const { data: user, isLoading: userLoading } = useQuery<{ id: string; email: string; firstName: string } | null>({
    queryKey: ["/api/me"],
  });
  
  const { data: plays = [], isLoading: playsLoading } = useQuery<Play[]>({
    queryKey: ["/api/plays"],
    enabled: !!user,
  });
  
  const playsForType = plays.filter((play) => play.type === playType);
  
  const filteredPlays = playsForType.filter((play) => category === "all" || play.category === category);
  
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
  
  const categoryCounts = {
    all: playsForType.length,
    run: playsForType.filter((p) => p.category === "run").length,
    pass: playsForType.filter((p) => p.category === "pass").length,
    "play-action": playsForType.filter((p) => p.category === "play-action").length,
    rpo: playsForType.filter((p) => p.category === "rpo").length,
    trick: playsForType.filter((p) => p.category === "trick").length,
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
            <LayoutGrid className="w-16 h-16 text-orange-500 mx-auto" />
            <h1 className="text-3xl font-bold text-gray-900">Play Library</h1>
            <p className="text-gray-600">
              Sign in to access your saved plays and manage your playbook.
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
        
        <nav className="flex-1 p-2 space-y-1">
          {(Object.entries(categoryLabels) as [Category, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                category === key 
                  ? 'bg-orange-100 text-orange-700' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              data-testid={`filter-${key}`}
            >
              <Folder className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1">{label}</span>
                  <span className="text-sm text-gray-500">({categoryCounts[key]})</span>
                </>
              )}
            </button>
          ))}
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
        <div className="flex-1 p-6 overflow-auto">
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
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              data-testid="plays-grid"
            >
              {sortedPlays.map((play) => (
                <div
                  key={play.id}
                  onClick={() => togglePlaySelection(play.id)}
                  className={`bg-white rounded-lg border ${
                    selectedPlays.has(play.id) 
                      ? 'border-orange-500 ring-2 ring-orange-200' 
                      : 'border-gray-200 hover:border-gray-300'
                  } shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden`}
                  data-testid={`play-card-${play.id}`}
                >
                  {/* Play Preview */}
                  <div className="aspect-video bg-gray-100 flex items-center justify-center">
                    <PlayPreview
                      playData={play.data as any}
                      playType={play.type as PlayType}
                      playName={play.name}
                      formation={play.formation || undefined}
                      scale={0.35}
                    />
                  </div>
                  
                  {/* Play Info */}
                  <div className="p-3 border-t border-gray-100">
                    <h3 className="font-medium text-gray-900 truncate" data-testid={`text-play-name-${play.id}`}>
                      {play.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      {play.formation && (
                        <span className="bg-gray-100 px-2 py-0.5 rounded">{play.formation}</span>
                      )}
                      {play.personnel && (
                        <span className="bg-gray-100 px-2 py-0.5 rounded">{play.personnel}</span>
                      )}
                      {play.category && (
                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded capitalize">
                          {play.category}
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
    </div>
  );
}
