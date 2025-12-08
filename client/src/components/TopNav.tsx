import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import rcFootballLogo from "@assets/RC_Football_1765082048330.png";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, User, ChevronDown } from "lucide-react";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SignUpModal from "./SignUpModal";

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  isAdmin: boolean;
}

interface TopNavProps {
  isAdmin?: boolean;
  setIsAdmin?: (value: boolean) => void;
  showSignUp?: boolean;
  setShowSignUp?: (value: boolean) => void;
}

export default function TopNav({ isAdmin, setIsAdmin, showSignUp, setShowSignUp }: TopNavProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [localShowSignUp, setLocalShowSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  
  const isSignUpOpen = showSignUp ?? localShowSignUp;
  const handleSignUpChange = setShowSignUp ?? setLocalShowSignUp;

  // Fetch current user data - return null on 401 (not logged in)
  const { data: user, isLoading: userLoading } = useQuery<UserData | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn<UserData | null>({ on401: "returnNull" }),
    retry: false,
  });

  const isLoggedIn = !!user;

  // Sync admin state when user data changes (including logout)
  useEffect(() => {
    if (setIsAdmin) {
      setIsAdmin(user?.isAdmin ?? false);
    }
  }, [user, setIsAdmin]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({
        title: "Logged out",
        description: "You've been logged out successfully.",
      });
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (user?.firstName) {
      return user.firstName.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  // Get display name
  const getDisplayName = () => {
    if (user?.firstName) {
      return user.firstName;
    }
    if (user?.email) {
      return user.email.split("@")[0];
    }
    return "Coach";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({
        title: "Welcome back!",
        description: "You've been logged in successfully.",
      });
      resetModal();
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/forgot-password", { email: forgotEmail });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send reset email");
      }

      setForgotPasswordSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === "fuzzy2622") {
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
    setShowForgotPassword(false);
    setForgotPasswordSent(false);
    setEmail("");
    setPassword("");
    setAdminPassword("");
    setForgotEmail("");
    setError("");
    setIsLoading(false);
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
          {userLoading ? (
            <div className="w-8 h-8 rounded-full bg-white/20 animate-pulse" />
          ) : isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="flex items-center gap-2 hover:bg-orange-600/50 rounded-full pl-3 pr-2 py-1 transition-colors"
                  data-testid="button-user-menu"
                >
                  <span className="text-white text-sm font-medium" data-testid="text-greeting">
                    Hey Coach {getDisplayName()}
                  </span>
                  <Avatar className="h-8 w-8 border-2 border-white/30">
                    <AvatarFallback className="bg-white text-orange-600 font-bold text-sm">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-4 w-4 text-white/80" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="cursor-pointer"
                  data-testid="button-logout"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <button
                onClick={() => setShowLoginModal(true)}
                className="text-white/90 hover:text-white text-sm font-medium transition-colors"
                data-testid="button-login"
              >
                Log In
              </button>
              <button
                onClick={() => handleSignUpChange(true)}
                className="bg-white text-orange-600 rounded-full px-4 py-1 text-xs font-bold hover:bg-gray-100 transition-colors"
                data-testid="button-signup"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Login Modal */}
      <Dialog open={showLoginModal} onOpenChange={(open) => !open && resetModal()}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-md" data-testid="modal-login">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center text-orange-400">
              {showForgotPassword 
                ? "Reset Password" 
                : showAdminLogin 
                  ? "Admin Login" 
                  : "Welcome Back"}
            </DialogTitle>
          </DialogHeader>
          
          {showForgotPassword ? (
            forgotPasswordSent ? (
              <div className="space-y-4 pt-4 text-center">
                <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Check Your Email</h3>
                <p className="text-slate-400 text-sm">
                  If an account exists with that email, we've sent you a password reset link. 
                  Check your inbox and spam folder.
                </p>
                <Button 
                  onClick={resetModal}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold"
                  data-testid="button-close-forgot"
                >
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4 pt-4">
                <p className="text-slate-400 text-sm text-center">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="forgot-email" className="text-slate-300">Email Address</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="coach@team.com"
                    className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                    required
                    data-testid="input-forgot-email"
                  />
                </div>
                
                {error && (
                  <p className="text-sm text-red-400 text-center" data-testid="text-forgot-error">{error}</p>
                )}
                
                <Button 
                  type="submit" 
                  disabled={isLoading || !forgotEmail}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold"
                  data-testid="button-submit-forgot"
                >
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
                
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotEmail("");
                      setError("");
                    }}
                    className="text-xs text-slate-400 hover:text-orange-400 underline transition-colors"
                    data-testid="button-back-to-login-from-forgot"
                  >
                    Back to login
                  </button>
                </div>
              </form>
            )
          ) : !showAdminLogin ? (
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
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-slate-300">Password</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setForgotEmail(email);
                      setError("");
                    }}
                    className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                    data-testid="button-forgot-password"
                  >
                    Forgot password?
                  </button>
                </div>
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
                disabled={isLoading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold"
                data-testid="button-submit-login"
              >
                {isLoading ? "Logging in..." : "Log In"}
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

      {/* Sign Up Modal */}
      <SignUpModal open={isSignUpOpen} onOpenChange={handleSignUpChange} />
    </>
  );
}
