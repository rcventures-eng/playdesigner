import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import rcFootballLogo from "@assets/RC_Football_1765082048330.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const token = new URLSearchParams(searchString).get("token") || "";

  const { data: tokenValidation, isLoading: validating } = useQuery<{ valid: boolean }>({
    queryKey: ["/api/validate-reset-token", token],
    queryFn: async () => {
      const response = await fetch(`/api/validate-reset-token?token=${encodeURIComponent(token)}`);
      return response.json();
    },
    enabled: !!token,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/reset-password", { 
        token, 
        password 
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      setIsSuccess(true);
      toast({
        title: "Password Reset!",
        description: "Your password has been updated. You can now log in.",
      });
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 max-w-md w-full text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <img src={rcFootballLogo} alt="RC Football" className="h-10 w-auto" />
            <span className="text-xl font-bold text-orange-400">RC Football</span>
          </div>
          <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Invalid Reset Link</h1>
          <p className="text-slate-400 mb-6">
            This password reset link is invalid. Please request a new one.
          </p>
          <Button 
            onClick={() => setLocation("/")}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold"
            data-testid="button-go-home"
          >
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  if (validating) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 max-w-md w-full text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <img src={rcFootballLogo} alt="RC Football" className="h-10 w-auto" />
            <span className="text-xl font-bold text-orange-400">RC Football</span>
          </div>
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-400">Validating reset link...</p>
        </div>
      </div>
    );
  }

  if (tokenValidation && !tokenValidation.valid) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 max-w-md w-full text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <img src={rcFootballLogo} alt="RC Football" className="h-10 w-auto" />
            <span className="text-xl font-bold text-orange-400">RC Football</span>
          </div>
          <div className="w-16 h-16 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Link Expired</h1>
          <p className="text-slate-400 mb-6">
            This password reset link has expired or has already been used. Please request a new one.
          </p>
          <Button 
            onClick={() => setLocation("/")}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold"
            data-testid="button-go-home-expired"
          >
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 max-w-md w-full text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <img src={rcFootballLogo} alt="RC Football" className="h-10 w-auto" />
            <span className="text-xl font-bold text-orange-400">RC Football</span>
          </div>
          <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Password Reset!</h1>
          <p className="text-slate-400 mb-6">
            Your password has been updated successfully. You can now log in with your new password.
          </p>
          <Button 
            onClick={() => setLocation("/")}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold"
            data-testid="button-go-login"
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 max-w-md w-full">
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src={rcFootballLogo} alt="RC Football" className="h-10 w-auto" />
          <span className="text-xl font-bold text-orange-400">RC Football</span>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-white mb-2">Reset Your Password</h1>
        <p className="text-slate-400 text-center text-sm mb-6">
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">New Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              required
              minLength={8}
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              data-testid="input-new-password"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-slate-300">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              data-testid="input-confirm-password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center" data-testid="text-reset-error">{error}</p>
          )}

          <Button 
            type="submit" 
            disabled={isLoading || !password || !confirmPassword}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold"
            data-testid="button-reset-password"
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
