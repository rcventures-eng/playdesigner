import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GripVertical, Trash2, FileText } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PlayPreview } from "@/components/PlayPreview";
import { CONCEPT_OPTIONS } from "@/components/TagPopover";
import type { TeamBlankPage } from "@shared/schema";

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

// Combined list item for sorting
interface ListItem {
  itemType: 'play' | 'blankPage';
  id: number;
  displayOrder: number;
  play?: PlayItem;
  blankPage?: TeamBlankPage;
}

interface TeamPlaysListProps {
  teamId: number;
  plays: PlayItem[];
  onPlayClick?: (playId: number) => void;
  onPlayDoubleClick?: (playId: number) => void;
  onBlankPageDoubleClick?: (blankPage: TeamBlankPage) => void;
}

function hasStructuredPlayData(data: any): boolean {
  if (!data) return false;
  return Array.isArray(data.players) && data.players.length > 0;
}

const DOUBLE_CLICK_THRESHOLD = 300; // ms

export default function TeamPlaysList({ teamId, plays, onPlayClick, onPlayDoubleClick, onBlankPageDoubleClick }: TeamPlaysListProps) {
  const { toast } = useToast();
  const [localItems, setLocalItems] = useState<ListItem[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [lastClickTime, setLastClickTime] = useState<number>(0);
  const [lastClickedKey, setLastClickedKey] = useState<string | null>(null);

  // Fetch blank pages for the team
  const { data: blankPages = [] } = useQuery<TeamBlankPage[]>({
    queryKey: ["/api/teams", teamId, "blank-pages"],
  });

  // Combine and sort plays and blank pages by displayOrder
  useEffect(() => {
    const playItems: ListItem[] = plays.map(p => ({
      itemType: 'play' as const,
      id: p.id,
      displayOrder: p.displayOrder || 0,
      play: p,
    }));
    
    const blankPageItems: ListItem[] = blankPages.map(bp => ({
      itemType: 'blankPage' as const,
      id: bp.id,
      displayOrder: bp.displayOrder,
      blankPage: bp,
    }));
    
    const combined = [...playItems, ...blankPageItems].sort((a, b) => a.displayOrder - b.displayOrder);
    setLocalItems(combined);
  }, [plays, blankPages]);

  const handleItemInteraction = (item: ListItem) => {
    const now = Date.now();
    const key = `${item.itemType}-${item.id}`;
    
    // Check for double-click
    if (lastClickedKey === key && (now - lastClickTime) < DOUBLE_CLICK_THRESHOLD) {
      // Double-click detected
      if (item.itemType === 'play' && onPlayDoubleClick && item.play) {
        onPlayDoubleClick(item.play.id);
      } else if (item.itemType === 'blankPage' && onBlankPageDoubleClick && item.blankPage) {
        onBlankPageDoubleClick(item.blankPage);
      }
      setLastClickTime(0);
      setLastClickedKey(null);
      return;
    }
    
    // Single-click - select and highlight
    setSelectedItemKey(key);
    setLastClickTime(now);
    setLastClickedKey(key);
  };

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

  // Remove blank page from playbook
  const removeBlankPageMutation = useMutation({
    mutationFn: async (pageId: number) => {
      return apiRequest("DELETE", `/api/teams/${teamId}/blank-pages/${pageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "blank-pages"] });
      toast({
        title: "Blank page removed",
        description: "The blank page has been removed from the playbook.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove blank page",
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

    // For now, only reorder plays (blank pages not included in reorder API yet)
    const newItems = [...localItems];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);
    
    setLocalItems(newItems);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Only send play IDs for reordering (plays only for now)
    const playOrder = newItems.filter(item => item.itemType === 'play').map(item => item.id);
    reorderMutation.mutate(playOrder);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (localItems.length === 0) {
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
      {localItems.map((item, index) => {
        const key = `${item.itemType}-${item.id}`;
        const isSelected = selectedItemKey === key;
        
        // Render blank page
        if (item.itemType === 'blankPage' && item.blankPage) {
          return (
            <div
              key={key}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => handleItemInteraction(item)}
              className={`
                group relative flex items-center gap-3 p-2 rounded-lg border-2 border-dashed bg-gray-50
                transition-all duration-150 cursor-pointer
                ${draggedIndex === index ? "opacity-50 scale-[0.98]" : ""}
                ${dragOverIndex === index && draggedIndex !== index ? "border-orange-400 bg-orange-50" : ""}
                ${isSelected ? "border-orange-500 bg-orange-50/50" : "border-gray-300"}
                ${draggedIndex === null && !isSelected ? "hover:border-gray-400 hover:shadow-sm" : ""}
              `}
              data-testid={`blank-page-item-${item.id}`}
            >
              {/* Drag handle */}
              <div 
                className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-5 h-5" />
              </div>

              {/* Blank page icon placeholder */}
              <div className="w-32 h-20 flex-shrink-0 rounded-md border-2 border-dashed border-gray-300 flex items-center justify-center bg-white">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>

              {/* Blank page metadata */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-700 truncate" data-testid={`blank-page-title-${item.id}`}>
                  {item.blankPage.title}
                </div>
                {item.blankPage.customContent && (
                  <div className="text-sm text-gray-500 truncate">
                    {item.blankPage.customContent}
                  </div>
                )}
                <div className="text-xs text-gray-400 italic">
                  Double-click to edit
                </div>
              </div>

              {/* Item number */}
              <div className="text-sm text-gray-400 flex-shrink-0 font-medium">
                #{index + 1}
              </div>
              
              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeBlankPageMutation.mutate(item.id);
                }}
                disabled={removeBlankPageMutation.isPending}
                className="flex-shrink-0 w-8 h-8 bg-red-100 hover:bg-red-500 text-red-500 hover:text-white rounded-full flex items-center justify-center transition-colors"
                data-testid={`button-delete-blank-page-${item.id}`}
                aria-label={`Remove ${item.blankPage.title} from playbook`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        }
        
        // Render play
        const play = item.play!;
        const useStructuredPreview = hasStructuredPlayData(play.data);
        const hasRasterPreview = play.data?.previewData;
        
        return (
          <div
            key={key}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => handleItemInteraction(item)}
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
