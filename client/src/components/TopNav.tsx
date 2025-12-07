import { useState } from "react";
import { useLocation } from "wouter";
import rcFootballLogo from "@assets/RC_Football_1765082048330.png";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TopNavProps {
  isAdmin?: boolean;
  setIsAdmin?: (value: boolean) => void;
}

export default function TopNav({ isAdmin, setIsAdmin }: TopNavProps) {
  const [, setLocation] = useLocation();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("Regular login coming soon!");
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === "touchdown") {
      setIsAdmin?.(true);
      setShowLoginModal(false);
      setShowAdminLogin(false);
      setAdminPassword("");
      setError("");
      setLocation("/admin");
    } else {
      setError("Invalid admin password");
    }
  };

  const resetModal = () => {
    setShowLoginModal(false);
    setShowAdminLogin(false);
    setEmail("");
    setPassword("");
    setAdminPassword("");
    setError("");
  };

  return (
    <>
      <nav className="h-12 bg-orange-500 flex items-center justify-between px-6 shadow-md" data-testid="top-nav">
        {/* Left Side - Logo/Brand */}
        <div className="flex items-center gap-2">
          <img
            src={rcFootballLogo}
            alt="RC Football"
            className="h-9 w-auto object-contain"
            data-testid="brand-logo"
          />
          <span className="font-bold text-white tracking-tight text-lg" data-testid="brand-name">
            RC Football
          </span>
        </div>

        {/* Right Side - Auth Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowLoginModal(true)}
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

      {/* Login Modal */}
      <Dialog open={showLoginModal} onOpenChange={(open) => !open && resetModal()}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-md" data-testid="modal-login">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center text-orange-400">
              {showAdminLogin ? "Admin Login" : "Welcome Back"}
            </DialogTitle>
          </DialogHeader>
          
          {!showAdminLogin ? (
            <form onSubmit={handleLogin} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="coach@team.com"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                  data-testid="input-password"
                />
              </div>
              
              {error && (
                <p className="text-sm text-red-400 text-center" data-testid="text-error">{error}</p>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold"
                data-testid="button-submit-login"
              >
                Log In
              </Button>
              
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminLogin(true);
                    setError("");
                  }}
                  className="text-xs text-slate-400 hover:text-orange-400 underline transition-colors"
                  data-testid="button-admin-login"
                >
                  Login as Admin
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-slate-300">Admin Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                  autoFocus
                  data-testid="input-admin-password"
                />
              </div>
              
              {error && (
                <p className="text-sm text-red-400 text-center" data-testid="text-admin-error">{error}</p>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold"
                data-testid="button-submit-admin"
              >
                Access Admin Dashboard
              </Button>
              
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminLogin(false);
                    setAdminPassword("");
                    setError("");
                  }}
                  className="text-xs text-slate-400 hover:text-orange-400 underline transition-colors"
                  data-testid="button-back-to-login"
                >
                  Back to regular login
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
