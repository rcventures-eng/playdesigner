import { Button } from "@/components/ui/button";

export default function TopNav() {
  return (
    <nav className="h-12 bg-orange-500 flex items-center justify-between px-6 shadow-md" data-testid="top-nav">
      {/* Left Side - Logo/Brand */}
      <div className="flex items-center gap-2">
        <svg className="h-6 w-6" viewBox="0 0 20 40" fill="currentColor">
          <ellipse cx="10" cy="20" rx="9.5" ry="19.5" fill="#8B4513" stroke="#654321" strokeWidth="1" />
          <line x1="10" y1="2" x2="10" y2="38" stroke="#FFFFFF" strokeWidth="1.2" />
        </svg>
        <span className="font-bold text-white tracking-tight text-lg" data-testid="brand-name">
          Gridiron Designer
        </span>
      </div>

      {/* Right Side - Auth Actions */}
      <div className="flex items-center gap-4">
        <button
          className="text-white/90 hover:text-white text-sm font-medium transition-colors"
          data-testid="button-login"
        >
          Log In
        </button>
        <button
          className="bg-white text-orange-600 rounded-full px-4 py-1 text-xs font-bold hover:bg-gray-100 transition-colors"
          data-testid="button-signup"
        >
          Sign Up
        </button>
        <div
          className="w-8 h-8 rounded-full bg-white/20"
          data-testid="profile-placeholder"
          title="Profile"
        />
      </div>
    </nav>
  );
}
