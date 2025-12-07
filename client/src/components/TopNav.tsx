import rcFootballLogo from "@assets/RC_Football_1765082048330.png";

export default function TopNav() {
  return (
    <nav className="h-12 bg-orange-500 flex items-center justify-between px-6 shadow-md" data-testid="top-nav">
      {/* Left Side - Logo/Brand */}
      <div className="flex items-center">
        <img
          src={rcFootballLogo}
          alt="RC Football"
          className="h-9 w-auto object-contain"
          data-testid="brand-logo"
        />
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
