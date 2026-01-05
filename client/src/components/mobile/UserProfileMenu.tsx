import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Construction, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface UserProfileMenuProps {
  user: {
    username?: string;
    email?: string;
    firstName?: string;
  };
  onLogout: () => void;
}

export function UserProfileMenu({ user, onLogout }: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = user.firstName || user.username || "Coach";

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/logout");
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      setIsOpen(false);
      onLogout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border hover:bg-accent/50 transition-colors"
        data-testid="button-user-menu"
      >
        <span className="text-xs whitespace-nowrap">Hey Coach {displayName}</span>
        <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-white text-[10px] font-semibold">
          {displayName[0]?.toUpperCase() || "?"}
        </div>
        <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-1 w-52 bg-card border rounded-md shadow-lg z-50 overflow-hidden animate-in fade-in-0 zoom-in-95"
          data-testid="user-dropdown"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b bg-muted/30">
            <p className="font-semibold text-sm">Hey Coach {displayName}</p>
            {user.email && (
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <a
              href="/mobile"
              className="flex items-center justify-between px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
              data-testid="menu-item-build-plays"
            >
              <span>Build Plays</span>
              <Check className="w-4 h-4 text-green-500" />
            </a>
            <div 
              className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground cursor-default"
              data-testid="menu-item-play-library"
            >
              <span>Play Library</span>
              <span className="text-base">🚧</span>
            </div>
            <div 
              className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground cursor-default"
              data-testid="menu-item-team-playbooks"
            >
              <span>Team Playbooks</span>
              <span className="text-base">🚧</span>
            </div>
            <div 
              className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground cursor-default"
              data-testid="menu-item-coach-profile"
            >
              <span>Coach Profile</span>
              <span className="text-base">🚧</span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Logout */}
          <div className="py-1">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
