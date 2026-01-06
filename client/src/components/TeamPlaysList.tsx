import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { GripVertical, Trash2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PlayPreview } from "@/components/PlayPreview";
import { CONCEPT_OPTIONS } from "@/components/TagPopover";

// Format concept value to display label (e.g., "play-action" -> "Play-Action")
function formatConceptLabel(concept: string | null | undefined): string | null {
  if (!concept) return null;
  const option = CONCEPT_OPTIONS.find(o => o.value === concept);
  return option?.label || concept;
}

interface PlayItem {
  id: number;
  name: string;
  type: string;
  concept?: string | null;
  formation?: string | null;
  situation?: string | null;
  data?: any;
  displayOrder?: number;
}

interface TeamPlaysListProps {
  teamId: number;
  plays: PlayItem[];
  onPlayClick?: (playId: number) => void;
}

function hasStructuredPlayData(data: any): boolean {
  if (!data) return false;
  return Array.isArray(data.players) && data.players.length > 0;
}

export default function TeamPlaysList({ teamId, plays, onPlayClick }: TeamPlaysListProps) {
  const { toast } = useToast();
  const [localPlays, setLocalPlays] = useState<PlayItem[]>(plays);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectedPlayId, setSelectedPlayId] = useState<number | null>(null);

  useEffect(() => {
    setLocalPlays(plays);
  }, [plays]);

  // Remove play from this team's playbook only (doesn't delete from library)
  const removeFromPlaybookMutation = useMutation({
    mutationFn: async (playId: number) => {
      return apiRequest("DELETE", `/api/teams/${teamId}/plays/${playId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "plays-for-export"] });
      toast({
        title: "Play removed",
        description: "The play has been removed from this team's playbook.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove play from playbook",
        variant: "destructive",
      });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (playOrder: number[]) => {
      return apiRequest("POST", `/api/teams/${teamId}/reorder-plays`, { playOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "plays-for-export"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save play order",
        variant: "destructive",
      });
      setLocalPlays(plays);
    },
  });

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newPlays = [...localPlays];
    const [draggedPlay] = newPlays.splice(draggedIndex, 1);
    newPlays.splice(dropIndex, 0, draggedPlay);
    
    setLocalPlays(newPlays);
    setDraggedIndex(null);
    setDragOverIndex(null);

    const playOrder = newPlays.map(p => p.id);
    reorderMutation.mutate(playOrder);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (localPlays.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        No plays assigned to this team yet.
        <br />
        <span className="text-sm">
          Tag plays from your Play Library to add them here.
        </span>
      </div>
    );
  }

  return (
    <div 
      className="space-y-2"
      data-testid="team-plays-list"
    >
      {localPlays.map((play, index) => {
        const useStructuredPreview = hasStructuredPlayData(play.data);
        const hasRasterPreview = play.data?.previewData;
        
        const isSelected = selectedPlayId === play.id;
        
        return (
          <div
            key={play.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => {
              // Single click opens the play AND selects it
              setSelectedPlayId(play.id);
              onPlayClick?.(play.id);
            }}
            className={`
              group relative flex items-center gap-3 p-2 rounded-lg border bg-white
              transition-all duration-150 cursor-pointer
              ${draggedIndex === index ? "opacity-50 scale-[0.98]" : ""}
              ${dragOverIndex === index && draggedIndex !== index ? "border-orange-400 bg-orange-50" : ""}
              ${isSelected ? "border-2 border-orange-500 bg-orange-50/50" : "border-gray-200"}
              ${draggedIndex === null && !isSelected ? "hover:border-gray-300 hover:shadow-sm" : ""}
            `}
            data-testid={`play-item-${play.id}`}
          >
            {/* Drag handle */}
            <div 
              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              data-testid={`drag-handle-${play.id}`}
            >
              <GripVertical className="w-5 h-5" />
            </div>

            {/* Play thumbnail - larger size for better visibility */}
            <div className="w-32 h-20 flex-shrink-0 rounded-md overflow-hidden border border-gray-200">
              {useStructuredPreview ? (
                <PlayPreview
                  playData={play.data}
                  playType={play.type as "offense" | "defense" | "special"}
                  scale={0.25}
                />
              ) : hasRasterPreview ? (
                <img 
                  src={play.data.previewData} 
                  alt={play.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-b from-green-600 to-green-700 flex items-center justify-center">
                  <div className="text-white/50 text-xs">No preview</div>
                </div>
              )}
            </div>

            {/* Play metadata */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate" data-testid={`play-name-${play.id}`}>
                {play.name}
              </div>
              <div className="text-sm text-gray-500 truncate">
                {[play.formation, formatConceptLabel(play.concept), play.situation].filter(Boolean).join(" • ") || play.type}
              </div>
            </div>

            {/* Play number */}
            <div className="text-sm text-gray-400 flex-shrink-0 font-medium">
              #{index + 1}
            </div>
            
            {/* Delete button - always visible for easy access */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFromPlaybookMutation.mutate(play.id);
              }}
              disabled={removeFromPlaybookMutation.isPending}
              className="flex-shrink-0 w-8 h-8 bg-red-100 hover:bg-red-500 text-red-500 hover:text-white rounded-full flex items-center justify-center transition-colors dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white"
              data-testid={`button-delete-play-${play.id}`}
              aria-label={`Remove ${play.name} from playbook`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
