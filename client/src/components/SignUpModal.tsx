import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export const NFL_TEAMS = [
  "Arizona Cardinals",
  "Atlanta Falcons",
  "Baltimore Ravens",
  "Buffalo Bills",
  "Carolina Panthers",
  "Chicago Bears",
  "Cincinnati Bengals",
  "Cleveland Browns",
  "Dallas Cowboys",
  "Denver Broncos",
  "Detroit Lions",
  "Green Bay Packers",
  "Houston Texans",
  "Indianapolis Colts",
  "Jacksonville Jaguars",
  "Kansas City Chiefs",
  "Las Vegas Raiders",
  "Los Angeles Chargers",
  "Los Angeles Rams",
  "Miami Dolphins",
  "Minnesota Vikings",
  "New England Patriots",
  "New Orleans Saints",
  "New York Giants",
  "New York Jets",
  "Philadelphia Eagles",
  "Pittsburgh Steelers",
  "San Francisco 49ers",
  "Seattle Seahawks",
  "Tampa Bay Buccaneers",
  "Tennessee Titans",
  "Washington Commanders",
] as const;

interface SignUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SignUpModal({ open, onOpenChange }: SignUpModalProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [favoriteTeam, setFavoriteTeam] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const passwordsMatch = password === confirmPassword || confirmPassword === "";
  const isFormValid = email && password.length >= 8 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/register", {
        email,
        password,
        firstName: firstName || undefined,
        favoriteTeam: favoriteTeam || undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/me"] });

      toast({
        title: "Welcome to RC Football!",
        description: `Account created successfully${firstName ? `, ${firstName}` : ""}!`,
      });

      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFirstName("");
    setFavoriteTeam("");
    setError("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="bg-slate-900 border-white/10 text-white sm:max-w-md shadow-xl" 
        data-testid="modal-signup"
      >
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl font-bold text-center text-orange-400">
            Join RC Football
          </DialogTitle>
          <p className="text-slate-400 text-sm mt-1">
            Design plays, build your playbook, and dominate.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div 
              className="bg-red-500/20 border border-red-500/50 rounded-md p-3 text-sm text-red-300"
              data-testid="alert-error"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="signup-email" className="text-slate-300">
              Email Address <span className="text-red-400">*</span>
            </Label>
            <Input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@team.com"
              required
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              data-testid="input-signup-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-password" className="text-slate-300">
              Password <span className="text-red-400">*</span>
            </Label>
            <Input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              required
              minLength={8}
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              data-testid="input-signup-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-confirm-password" className="text-slate-300">
              Confirm Password <span className="text-red-400">*</span>
            </Label>
            <Input
              id="signup-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              className={`bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 ${
                !passwordsMatch ? "border-red-500 focus-visible:ring-red-500" : ""
              }`}
              data-testid="input-signup-confirm-password"
            />
            {!passwordsMatch && (
              <p className="text-xs text-red-400" data-testid="text-password-mismatch">
                Passwords do not match
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-firstname" className="text-slate-300">
              First Name <span className="text-slate-500">(optional)</span>
            </Label>
            <Input
              id="signup-firstname"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Coach"
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              data-testid="input-signup-firstname"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-team" className="text-slate-300">
              Favorite NFL Team <span className="text-slate-500">(optional)</span>
            </Label>
            <Select value={favoriteTeam} onValueChange={setFavoriteTeam}>
              <SelectTrigger 
                className="bg-slate-800 border-slate-600 text-white"
                data-testid="select-signup-team"
              >
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {NFL_TEAMS.map((team) => (
                  <SelectItem 
                    key={team} 
                    value={team}
                    className="text-white hover:bg-slate-700 focus:bg-slate-700"
                  >
                    {team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={!isFormValid || isLoading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-submit-signup"
          >
            {isLoading ? "Creating..." : "Create Account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
