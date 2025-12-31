import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { GripVertical } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PlayPreview } from "@/components/PlayPreview";

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

  useEffect(() => {
    setLocalPlays(plays);
  }, [plays]);

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
        
        return (
          <div
            key={play.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => onPlayClick?.(play.id)}
            className={`
              flex items-center gap-3 p-2 rounded-lg border bg-white
              transition-all duration-150 cursor-pointer
              ${draggedIndex === index ? "opacity-50 scale-[0.98]" : ""}
              ${dragOverIndex === index && draggedIndex !== index ? "border-orange-400 bg-orange-50" : "border-gray-200"}
              ${draggedIndex === null ? "hover:border-gray-300 hover:shadow-sm" : ""}
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
                {[play.formation, play.concept, play.situation].filter(Boolean).join(" • ") || play.type}
              </div>
            </div>

            {/* Play number */}
            <div className="text-sm text-gray-400 flex-shrink-0 font-medium">
              #{index + 1}
            </div>
          </div>
        );
      })}
    </div>
  );
}
