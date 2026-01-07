import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GripVertical, Trash2, FileText, Users, BarChart3, StickyNote } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PlayThumbnail } from "@/components/PlayThumbnail";
import { CONCEPT_OPTIONS } from "@/components/TagPopover";
import type { TeamBlankPage } from "@shared/schema";

// Get icon and color for page type
function getPageTypeDisplay(pageType: string | undefined | null) {
  switch (pageType) {
    case 'roster':
      return { Icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-50', label: 'Roster' };
    case 'splits':
      return { Icon: BarChart3, color: 'text-green-500', bgColor: 'bg-green-50', label: 'Splits' };
    default:
      return { Icon: FileText, color: 'text-gray-400', bgColor: 'bg-white', label: 'Blank' };
  }
}

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
  notes?: string | null;
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

// Count the number of notes attached to a play
function getNotesCount(data: any): number {
  if (!data || !Array.isArray(data.notes)) return 0;
  return data.notes.length;
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
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "plays-for-export"] });
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
    mutationFn: async (itemOrder: { type: 'play' | 'blankPage'; id: number }[]) => {
      return apiRequest("POST", `/api/teams/${teamId}/reorder-items`, { itemOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "plays-for-export"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "blank-pages"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save item order",
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

    const newItems = [...localItems];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);
    
    setLocalItems(newItems);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Send both plays and blank pages in order for unified reordering
    const itemOrder = newItems.map(item => ({
      type: item.itemType,
      id: item.id,
    }));
    reorderMutation.mutate(itemOrder);
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

              {/* Page type icon placeholder */}
              {(() => {
                const { Icon, color, bgColor } = getPageTypeDisplay((item.blankPage as any).pageType);
                return (
                  <div className={`w-32 h-20 flex-shrink-0 rounded-md border-2 border-dashed border-gray-300 flex items-center justify-center ${bgColor}`}>
                    <Icon className={`w-8 h-8 ${color}`} />
                  </div>
                );
              })()}

              {/* Page metadata */}
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
                  {(item.blankPage as any).pageType === 'roster' ? 'Double-click to preview' :
                   (item.blankPage as any).pageType === 'splits' ? 'Double-click to edit splits' :
                   'Double-click to edit'}
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

            {/* Play thumbnail with smart centering */}
            <div className="w-32 h-20 flex-shrink-0 rounded-md overflow-hidden border border-gray-200">
              {useStructuredPreview ? (
                <PlayThumbnail
                  playData={play.data}
                  playType={play.type as "offense" | "defense" | "special"}
                  notes={play.notes}
                  width={128}
                  height={80}
                  showNoteIndicator={true}
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
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="font-medium text-gray-900 truncate min-w-0 flex-1" data-testid={`play-name-${play.id}`}>
                  {play.name}
                </div>
                {/* Sticky note icons for each note attached to this play */}
                {(() => {
                  const notesCount = getNotesCount(play.data);
                  if (notesCount === 0) return null;
                  return (
                    <div className="flex items-center gap-0.5 flex-shrink-0" data-testid={`notes-indicator-${play.id}`}>
                      {Array.from({ length: Math.min(notesCount, 5) }).map((_, i) => (
                        <StickyNote 
                          key={i} 
                          className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" 
                          style={{ marginLeft: i > 0 ? '-2px' : '0' }}
                        />
                      ))}
                      {notesCount > 5 && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium ml-0.5">
                          +{notesCount - 5}
                        </span>
                      )}
                    </div>
                  );
                })()}
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
