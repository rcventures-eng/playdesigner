import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { 
  Plus, 
  Trash2, 
  Pencil, 
  Upload, 
  FileSpreadsheet,
  Image as ImageIcon,
  X,
  Check,
  Users,
  UserCog
} from "lucide-react";
import { 
  COACH_ROLES, 
  OFFENSIVE_POSITIONS_BY_FORMAT, 
  DEFENSIVE_POSITIONS_BY_FORMAT,
  type TeamCoach, 
  type TeamPlayer,
  type GameFormat 
} from "@shared/schema";

interface TeamRosterCardProps {
  teamId: number;
  gameFormat?: GameFormat;
}

// Helper to determine if a color is dark and needs white text
function isColorDark(color: string): boolean {
  if (!color) return false;
  
  // Handle color names
  const darkColorNames = ['black', 'navy', 'darkblue', 'darkgreen', 'darkred', 'maroon', 'purple', 'indigo'];
  if (darkColorNames.includes(color.toLowerCase())) return true;
  
  // Handle hex colors
  let hex = color.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return false;
  
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate luminance - if less than 128, it's a dark color
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
  return luminance < 128;
}

// Helper to parse multiple colors from comma-separated string (max 4)
function parseColors(colorString: string | null | undefined): string[] {
  if (!colorString) return [];
  
  // Split by comma, trim whitespace, filter empty, limit to 4
  const colors = colorString
    .split(',')
    .map(c => c.trim())
    .filter(c => c.length > 0)
    .slice(0, 4);
  
  return colors;
}

export default function TeamRosterCard({ teamId, gameFormat = "5v5" }: TeamRosterCardProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Get positions based on game format
  const offensivePositions = OFFENSIVE_POSITIONS_BY_FORMAT[gameFormat] || OFFENSIVE_POSITIONS_BY_FORMAT["5v5"];
  const defensivePositions = DEFENSIVE_POSITIONS_BY_FORMAT[gameFormat] || DEFENSIVE_POSITIONS_BY_FORMAT["5v5"];
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<"csv" | "image">("csv");
  const [parsedData, setParsedData] = useState<{ coaches: any[]; players: any[] } | null>(null);
  const [isParsingImage, setIsParsingImage] = useState(false);
  
  const [editingCoach, setEditingCoach] = useState<TeamCoach | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<TeamPlayer | null>(null);
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  
  const [newCoachFirstName, setNewCoachFirstName] = useState("");
  const [newCoachLastName, setNewCoachLastName] = useState("");
  const [newCoachRole, setNewCoachRole] = useState<string>("");
  
  const [newPlayerFirstName, setNewPlayerFirstName] = useState("");
  const [newPlayerLastName, setNewPlayerLastName] = useState("");
  const [newPlayerPosition1, setNewPlayerPosition1] = useState("");
  const [newPlayerPosition2, setNewPlayerPosition2] = useState("");
  const [newPlayerDefPosition1, setNewPlayerDefPosition1] = useState("");
  const [newPlayerMainColor, setNewPlayerMainColor] = useState("");

  const { data: coaches = [], isLoading: coachesLoading } = useQuery<TeamCoach[]>({
    queryKey: ["/api/teams", teamId, "coaches"],
  });

  const { data: players = [], isLoading: playersLoading } = useQuery<TeamPlayer[]>({
    queryKey: ["/api/teams", teamId, "players"],
  });

  const addCoachMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; role: string }) => {
      const response = await apiRequest("POST", `/api/teams/${teamId}/coaches`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "coaches"] });
      setShowAddCoach(false);
      resetCoachForm();
      toast({ title: "Coach added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add coach", description: error.message, variant: "destructive" });
    },
  });

  const updateCoachMutation = useMutation({
    mutationFn: async ({ coachId, data }: { coachId: number; data: Partial<TeamCoach> }) => {
      const response = await apiRequest("PATCH", `/api/teams/${teamId}/coaches/${coachId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "coaches"] });
      setEditingCoach(null);
      toast({ title: "Coach updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update coach", description: error.message, variant: "destructive" });
    },
  });

  const deleteCoachMutation = useMutation({
    mutationFn: async (coachId: number) => {
      await apiRequest("DELETE", `/api/teams/${teamId}/coaches/${coachId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "coaches"] });
      toast({ title: "Coach removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove coach", description: error.message, variant: "destructive" });
    },
  });

  const addPlayerMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; position1?: string; position2?: string; defPosition1?: string; mainColor?: string }) => {
      const response = await apiRequest("POST", `/api/teams/${teamId}/players`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "players"] });
      setShowAddPlayer(false);
      resetPlayerForm();
      toast({ title: "Player added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add player", description: error.message, variant: "destructive" });
    },
  });

  const updatePlayerMutation = useMutation({
    mutationFn: async ({ playerId, data }: { playerId: number; data: Partial<TeamPlayer> }) => {
      const response = await apiRequest("PATCH", `/api/teams/${teamId}/players/${playerId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "players"] });
      setEditingPlayer(null);
      toast({ title: "Player updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update player", description: error.message, variant: "destructive" });
    },
  });

  const deletePlayerMutation = useMutation({
    mutationFn: async (playerId: number) => {
      await apiRequest("DELETE", `/api/teams/${teamId}/players/${playerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "players"] });
      toast({ title: "Player removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove player", description: error.message, variant: "destructive" });
    },
  });

  const importRosterMutation = useMutation({
    mutationFn: async (data: { coaches: any[]; players: any[] }) => {
      const response = await apiRequest("POST", `/api/teams/${teamId}/roster/import`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "coaches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "players"] });
      setShowUploadModal(false);
      setParsedData(null);
      toast({ title: "Roster imported successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to import roster", description: error.message, variant: "destructive" });
    },
  });

  const resetCoachForm = () => {
    setNewCoachFirstName("");
    setNewCoachLastName("");
    setNewCoachRole("");
  };

  const resetPlayerForm = () => {
    setNewPlayerFirstName("");
    setNewPlayerLastName("");
    setNewPlayerPosition1("");
    setNewPlayerPosition2("");
    setNewPlayerDefPosition1("");
    setNewPlayerMainColor("");
  };

  const handleAddCoach = () => {
    if (!newCoachFirstName || !newCoachLastName || !newCoachRole) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    addCoachMutation.mutate({
      firstName: newCoachFirstName,
      lastName: newCoachLastName,
      role: newCoachRole,
    });
  };

  const handleAddPlayer = () => {
    if (!newPlayerFirstName || !newPlayerLastName) {
      toast({ title: "Please fill in first and last name", variant: "destructive" });
      return;
    }
    addPlayerMutation.mutate({
      firstName: newPlayerFirstName,
      lastName: newPlayerLastName,
      position1: newPlayerPosition1 || undefined,
      position2: newPlayerPosition2 || undefined,
      defPosition1: newPlayerDefPosition1 || undefined,
      mainColor: newPlayerMainColor || undefined,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (uploadType === "csv") {
      const text = await file.text();
      const parsed = parseCSV(text);
      setParsedData(parsed);
    } else {
      setIsParsingImage(true);
      try {
        const base64 = await fileToBase64(file);
        const response = await apiRequest("POST", `/api/teams/${teamId}/roster/parse-image`, {
          imageData: base64,
        });
        const data = await response.json();
        setParsedData(data);
      } catch (error: any) {
        toast({ title: "Failed to parse image", description: error.message, variant: "destructive" });
      } finally {
        setIsParsingImage(false);
      }
    }

    e.target.value = "";
  };

  const parseCSV = (text: string): { coaches: any[]; players: any[] } => {
    const lines = text.trim().split("\n");
    const coaches: any[] = [];
    const players: any[] = [];
    
    let currentSection = "";
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      if (trimmedLine.toLowerCase().includes("coach")) {
        currentSection = "coaches";
        continue;
      }
      if (trimmedLine.toLowerCase().includes("player")) {
        currentSection = "players";
        continue;
      }
      
      const parts = trimmedLine.split(",").map(p => p.trim());
      
      if (currentSection === "coaches" && parts.length >= 2) {
        coaches.push({
          firstName: parts[0] || "",
          lastName: parts[1] || "",
          role: parts[2] || "Assistant",
        });
      } else if (currentSection === "players" && parts.length >= 2) {
        players.push({
          firstName: parts[0] || "",
          lastName: parts[1] || "",
          position1: parts[2] || null,
          position2: parts[3] || null,
          mainColor: parts[4] || null,
        });
      } else if (parts.length >= 2) {
        players.push({
          firstName: parts[0] || "",
          lastName: parts[1] || "",
          position1: parts[2] || null,
          position2: parts[3] || null,
          mainColor: parts[4] || null,
        });
      }
    }
    
    return { coaches, players };
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const handleConfirmImport = () => {
    if (parsedData) {
      importRosterMutation.mutate(parsedData);
    }
  };

  return (
    <Card className="mt-6 bg-white border border-gray-200 shadow-sm" data-testid="team-roster-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 bg-white border-b border-gray-100">
        <CardTitle className="text-lg text-primary">Team Roster</CardTitle>
        <Button
          variant="default"
          size="sm"
          onClick={() => setShowUploadModal(true)}
          data-testid="button-upload-roster"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload via CSV or Screenshot
        </Button>
      </CardHeader>

      <CardContent className="space-y-6 pt-6 bg-white text-gray-900">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UserCog className="w-5 h-5 text-primary" />
              <h4 className="font-semibold text-primary">Coaching Staff</h4>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddCoach(true)}
              className="border-primary text-primary hover:bg-primary/10"
              data-testid="button-add-coach"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          {coachesLoading ? (
            <div className="text-muted-foreground text-sm py-2">Loading...</div>
          ) : coaches.length === 0 && !showAddCoach ? (
            <div className="text-muted-foreground text-sm py-2">No coaching staff added yet</div>
          ) : (
            <div className="space-y-2">
              {coaches.map((coach) => (
                <div
                  key={coach.id}
                  className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2"
                  data-testid={`coach-row-${coach.id}`}
                >
                  {editingCoach?.id === coach.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={editingCoach.firstName}
                        onChange={(e) => setEditingCoach({ ...editingCoach, firstName: e.target.value })}
                        className="w-24 h-8 bg-white border-gray-300"
                        placeholder="First"
                      />
                      <Input
                        value={editingCoach.lastName}
                        onChange={(e) => setEditingCoach({ ...editingCoach, lastName: e.target.value })}
                        className="w-24 h-8 bg-white border-gray-300"
                        placeholder="Last"
                      />
                      <Select
                        value={editingCoach.role}
                        onValueChange={(value) => setEditingCoach({ ...editingCoach, role: value })}
                      >
                        <SelectTrigger className="w-40 h-8 bg-white border-gray-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COACH_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => updateCoachMutation.mutate({
                          coachId: editingCoach.id,
                          data: { firstName: editingCoach.firstName, lastName: editingCoach.lastName, role: editingCoach.role }
                        })}
                        data-testid={`button-save-coach-${coach.id}`}
                      >
                        <Check className="w-4 h-4 text-primary" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEditingCoach(null)}
                        data-testid={`button-cancel-edit-coach-${coach.id}`}
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <span className="font-medium">{coach.firstName} {coach.lastName}</span>
                        <span className="text-gray-600 text-sm font-semibold ml-2">• {coach.role}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setEditingCoach(coach)}
                          data-testid={`button-edit-coach-${coach.id}`}
                        >
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => deleteCoachMutation.mutate(coach.id)}
                          data-testid={`button-delete-coach-${coach.id}`}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {showAddCoach && (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                  <Input
                    value={newCoachFirstName}
                    onChange={(e) => setNewCoachFirstName(e.target.value)}
                    className="w-24 h-8 bg-white border-gray-300"
                    placeholder="First Name"
                    data-testid="input-coach-first-name"
                  />
                  <Input
                    value={newCoachLastName}
                    onChange={(e) => setNewCoachLastName(e.target.value)}
                    className="w-24 h-8 bg-white border-gray-300"
                    placeholder="Last Name"
                    data-testid="input-coach-last-name"
                  />
                  <Select value={newCoachRole} onValueChange={setNewCoachRole}>
                    <SelectTrigger className="w-40 h-8 bg-white border-gray-300" data-testid="select-coach-role">
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      {COACH_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={handleAddCoach}
                    disabled={addCoachMutation.isPending}
                    data-testid="button-confirm-add-coach"
                  >
                    <Check className="w-4 h-4 text-primary" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => { setShowAddCoach(false); resetCoachForm(); }}
                    data-testid="button-cancel-add-coach"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h4 className="font-semibold text-primary">Players</h4>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddPlayer(true)}
              className="border-primary text-primary hover:bg-primary/10"
              data-testid="button-add-player"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          {playersLoading ? (
            <div className="text-muted-foreground text-sm py-2">Loading...</div>
          ) : players.length === 0 && !showAddPlayer ? (
            <div className="text-muted-foreground text-sm py-2">No players added yet</div>
          ) : (
            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2"
                  data-testid={`player-row-${player.id}`}
                >
                  {editingPlayer?.id === player.id ? (
                    <div className="flex-1 flex items-center gap-2 flex-wrap">
                      <Input
                        value={editingPlayer.firstName}
                        onChange={(e) => setEditingPlayer({ ...editingPlayer, firstName: e.target.value })}
                        className="w-24 h-8 bg-white border-gray-300"
                        placeholder="First"
                      />
                      <Input
                        value={editingPlayer.lastName}
                        onChange={(e) => setEditingPlayer({ ...editingPlayer, lastName: e.target.value })}
                        className="w-24 h-8 bg-white border-gray-300"
                        placeholder="Last"
                      />
                      <Select
                        value={editingPlayer.position1 || ""}
                        onValueChange={(value) => setEditingPlayer({ ...editingPlayer, position1: value })}
                      >
                        <SelectTrigger className="w-28 h-8 bg-white border-gray-300">
                          <SelectValue placeholder="Off Pos 1" />
                        </SelectTrigger>
                        <SelectContent>
                          {offensivePositions.map((pos) => (
                            <SelectItem key={pos.value} value={pos.value}>{pos.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={editingPlayer.position2 || ""}
                        onValueChange={(value) => setEditingPlayer({ ...editingPlayer, position2: value })}
                      >
                        <SelectTrigger className="w-28 h-8 bg-white border-gray-300">
                          <SelectValue placeholder="Off Pos 2" />
                        </SelectTrigger>
                        <SelectContent>
                          {offensivePositions.map((pos) => (
                            <SelectItem key={pos.value} value={pos.value}>{pos.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={editingPlayer.defPosition1 || ""}
                        onValueChange={(value) => setEditingPlayer({ ...editingPlayer, defPosition1: value })}
                      >
                        <SelectTrigger className="w-28 h-8 bg-white border-gray-300">
                          <SelectValue placeholder="Def Pos" />
                        </SelectTrigger>
                        <SelectContent>
                          {defensivePositions.map((pos) => (
                            <SelectItem key={pos.value} value={pos.value}>{pos.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={editingPlayer.mainColor || ""}
                        onChange={(e) => setEditingPlayer({ ...editingPlayer, mainColor: e.target.value })}
                        className="w-20 h-8 bg-white border-gray-300"
                        placeholder="Color"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => updatePlayerMutation.mutate({
                          playerId: editingPlayer.id,
                          data: {
                            firstName: editingPlayer.firstName,
                            lastName: editingPlayer.lastName,
                            position1: editingPlayer.position1,
                            position2: editingPlayer.position2,
                            defPosition1: editingPlayer.defPosition1,
                            mainColor: editingPlayer.mainColor,
                          }
                        })}
                        data-testid={`button-save-player-${player.id}`}
                      >
                        <Check className="w-4 h-4 text-primary" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEditingPlayer(null)}
                        data-testid={`button-cancel-edit-player-${player.id}`}
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{player.firstName} {player.lastName}</span>
                        {(player.position1 || player.position2) && (
                          <span className="text-gray-600 text-sm font-semibold">
                            • Off: {[player.position1, player.position2].filter(Boolean).join(" / ")}
                          </span>
                        )}
                        {player.defPosition1 && (
                          <span className="text-gray-600 text-sm font-semibold">
                            • Def: {player.defPosition1}
                          </span>
                        )}
                        {parseColors(player.mainColor).map((color, idx) => (
                          <span 
                            key={idx}
                            className="px-2 py-0.5 rounded text-xs font-bold"
                            style={{ 
                              backgroundColor: color,
                              color: isColorDark(color) ? '#FFFFFF' : '#000000'
                            }}
                            data-testid={`player-color-badge-${player.id}-${idx}`}
                          >
                            {color}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setEditingPlayer(player)}
                          data-testid={`button-edit-player-${player.id}`}
                        >
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => deletePlayerMutation.mutate(player.id)}
                          data-testid={`button-delete-player-${player.id}`}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {showAddPlayer && (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 flex-wrap">
                  <Input
                    value={newPlayerFirstName}
                    onChange={(e) => setNewPlayerFirstName(e.target.value)}
                    className="w-24 h-8 bg-white border-gray-300"
                    placeholder="First Name"
                    data-testid="input-player-first-name"
                  />
                  <Input
                    value={newPlayerLastName}
                    onChange={(e) => setNewPlayerLastName(e.target.value)}
                    className="w-24 h-8 bg-white border-gray-300"
                    placeholder="Last Name"
                    data-testid="input-player-last-name"
                  />
                  <Select value={newPlayerPosition1} onValueChange={setNewPlayerPosition1}>
                    <SelectTrigger className="w-28 h-8 bg-white border-gray-300" data-testid="select-player-position-1">
                      <SelectValue placeholder="Off Pos 1" />
                    </SelectTrigger>
                    <SelectContent>
                      {offensivePositions.map((pos) => (
                        <SelectItem key={pos.value} value={pos.value}>{pos.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newPlayerPosition2} onValueChange={setNewPlayerPosition2}>
                    <SelectTrigger className="w-28 h-8 bg-white border-gray-300" data-testid="select-player-position-2">
                      <SelectValue placeholder="Off Pos 2" />
                    </SelectTrigger>
                    <SelectContent>
                      {offensivePositions.map((pos) => (
                        <SelectItem key={pos.value} value={pos.value}>{pos.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newPlayerDefPosition1} onValueChange={setNewPlayerDefPosition1}>
                    <SelectTrigger className="w-28 h-8 bg-white border-gray-300" data-testid="select-player-def-position-1">
                      <SelectValue placeholder="Def Pos" />
                    </SelectTrigger>
                    <SelectContent>
                      {defensivePositions.map((pos) => (
                        <SelectItem key={pos.value} value={pos.value}>{pos.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={newPlayerMainColor}
                    onChange={(e) => setNewPlayerMainColor(e.target.value)}
                    className="w-20 h-8 bg-white border-gray-300"
                    placeholder="Color"
                    data-testid="input-player-color"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={handleAddPlayer}
                    disabled={addPlayerMutation.isPending}
                    data-testid="button-confirm-add-player"
                  >
                    <Check className="w-4 h-4 text-primary" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => { setShowAddPlayer(false); resetPlayerForm(); }}
                    data-testid="button-cancel-add-player"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept={uploadType === "csv" ? ".csv,.txt" : "image/*"}
        className="hidden"
      />

      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Roster</DialogTitle>
            <DialogDescription>
              Import your team roster from a CSV file or screenshot
            </DialogDescription>
          </DialogHeader>

          {!parsedData ? (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setUploadType("csv"); fileInputRef.current?.click(); }}
                  className={`p-6 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors hover:border-primary hover:bg-primary/10 ${
                    uploadType === "csv" ? "border-primary bg-primary/10" : "border-border"
                  }`}
                  data-testid="button-upload-csv"
                >
                  <FileSpreadsheet className="w-8 h-8 text-primary" />
                  <span className="font-medium">CSV File</span>
                  <span className="text-xs text-muted-foreground text-center">Upload a spreadsheet with names</span>
                </button>

                <button
                  onClick={() => { setUploadType("image"); fileInputRef.current?.click(); }}
                  className={`p-6 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors hover:border-primary hover:bg-primary/10 ${
                    uploadType === "image" ? "border-primary bg-primary/10" : "border-border"
                  }`}
                  data-testid="button-upload-image"
                >
                  <ImageIcon className="w-8 h-8 text-primary" />
                  <span className="font-medium">Screenshot</span>
                  <span className="text-xs text-muted-foreground text-center">AI will extract names from image</span>
                </button>
              </div>

              {isParsingImage && (
                <div className="text-center py-4">
                  <div className="text-muted-foreground animate-pulse">Analyzing image with AI...</div>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">CSV Format:</p>
                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`Coaching Staff
FirstName,LastName,Role
John,Smith,Head Coach

Players
FirstName,LastName,Position1,Position2,Color
Mike,Johnson,QB,,
Sarah,Williams,WR,RB,#FF0000`}
                </pre>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3" data-testid="import-success-message">
                <div className="text-primary font-medium">Data parsed successfully!</div>
                <div className="text-muted-foreground text-sm">
                  Found {parsedData.coaches.length} coach{parsedData.coaches.length !== 1 ? "es" : ""} and {parsedData.players.length} player{parsedData.players.length !== 1 ? "s" : ""}
                </div>
              </div>

              {parsedData.coaches.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Coaches to Import</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {parsedData.coaches.map((coach, i) => (
                      <div key={i} className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded" data-testid={`preview-coach-${i}`}>
                        {coach.firstName} {coach.lastName} - {coach.role}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {parsedData.players.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Players to Import</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {parsedData.players.map((player, i) => (
                      <div key={i} className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded" data-testid={`preview-player-${i}`}>
                        {player.firstName} {player.lastName}
                        {player.position1 && ` - ${player.position1}`}
                        {player.position2 && `/${player.position2}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setParsedData(null)}
                  data-testid="button-back-import"
                >
                  Back
                </Button>
                <Button
                  onClick={handleConfirmImport}
                  disabled={importRosterMutation.isPending}
                  data-testid="button-confirm-import"
                >
                  {importRosterMutation.isPending ? "Importing..." : "Confirm Import"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
