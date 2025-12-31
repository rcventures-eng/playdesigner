import { useState, useRef, useEffect } from "react";
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
  const listRef = useRef<HTMLDivElement>(null);

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
      ref={listRef}
      className="relative overflow-y-auto pr-2 scrollbar-hover"
      style={{ maxHeight: "calc(100vh - 350px)", minHeight: "300px" }}
      data-testid="team-plays-list"
    >
      <style>{`
        .scrollbar-hover::-webkit-scrollbar {
          width: 8px;
        }
        .scrollbar-hover::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-hover::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .scrollbar-hover:hover::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
        }
        .scrollbar-hover:hover::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.35);
        }
      `}</style>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                relative rounded-lg border bg-white overflow-hidden
                transition-all duration-150 cursor-pointer
                ${draggedIndex === index ? "opacity-50 scale-[0.98]" : ""}
                ${dragOverIndex === index && draggedIndex !== index ? "border-orange-400 ring-2 ring-orange-200" : "border-gray-200"}
                ${draggedIndex === null ? "hover:border-gray-300 hover:shadow-md" : ""}
              `}
              data-testid={`play-item-${play.id}`}
            >
              {/* Drag handle - positioned outside the preview area for reliable grabbing */}
              <div 
                className="absolute top-2 left-2 z-20 cursor-grab active:cursor-grabbing bg-black/40 hover:bg-black/60 text-white rounded p-1.5 pointer-events-auto"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                data-testid={`drag-handle-${play.id}`}
              >
                <GripVertical className="w-4 h-4" />
              </div>
              
              {/* Play number badge */}
              <div className="absolute top-2 right-2 z-20 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded pointer-events-none">
                #{index + 1}
              </div>

              {/* Large Play Preview - use structured data if available, otherwise raster image */}
              <div className="w-full" style={{ aspectRatio: "400/300" }}>
                {useStructuredPreview ? (
                  <PlayPreview
                    playData={play.data}
                    playType={play.type as "offense" | "defense" | "special"}
                    playName={play.name}
                    formation={play.formation || undefined}
                    scale={0.7}
                  />
                ) : hasRasterPreview ? (
                  <img 
                    src={play.data.previewData} 
                    alt={play.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-b from-green-600 to-green-700 flex items-center justify-center">
                    <div className="text-white/50 text-sm">No preview</div>
                  </div>
                )}
              </div>

              {/* Play metadata footer */}
              <div className="p-3 bg-gray-50 border-t border-gray-100">
                <div className="font-semibold text-gray-900 truncate text-sm" data-testid={`play-name-${play.id}`}>
                  {play.name}
                </div>
                <div className="text-xs text-gray-500 truncate mt-0.5">
                  {[play.formation, play.concept, play.situation].filter(Boolean).join(" • ") || play.type}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
