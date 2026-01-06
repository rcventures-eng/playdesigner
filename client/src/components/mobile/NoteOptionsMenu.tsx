import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Trash2, Maximize2 } from "lucide-react";

interface NoteOptionsMenuProps {
  isVisible: boolean;
  noteId: string;
  onClose: () => void;
  onDelete: (noteId: string) => void;
  onResize: (noteId: string) => void;
}

export function NoteOptionsMenu({
  isVisible,
  noteId,
  onClose,
  onDelete,
  onResize,
}: NoteOptionsMenuProps) {
  const handleDelete = useCallback(() => {
    onDelete(noteId);
    onClose();
  }, [noteId, onDelete, onClose]);

  const handleResize = useCallback(() => {
    onResize(noteId);
    onClose();
  }, [noteId, onResize, onClose]);

  const handleOverlayClick = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center p-4"
      onClick={handleOverlayClick}
      data-testid="note-options-menu-overlay"
    >
      <Card 
        className="w-full max-w-md p-4 bg-card animate-in slide-in-from-bottom-4"
        onClick={(e) => e.stopPropagation()}
        data-testid="note-options-menu"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Note Options</h3>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={onClose}
            data-testid="button-close-note-menu"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="flex flex-col h-20 gap-2 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
            onClick={handleDelete}
            data-testid="button-delete-note"
          >
            <Trash2 className="w-6 h-6" />
            <span className="text-sm font-medium">Delete</span>
          </Button>

          <Button
            variant="outline"
            className="flex flex-col h-20 gap-2 hover:bg-accent"
            onClick={handleResize}
            data-testid="button-resize-note"
          >
            <Maximize2 className="w-6 h-6" />
            <span className="text-sm font-medium">Resize</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
