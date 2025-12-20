import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Save, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import TopNav from "@/components/TopNav";

// Current NFL Head Coaches (2024-2025 Season)
const NFL_HEAD_COACHES = [
  "Andy Reid (Kansas City Chiefs)",
  "Ben Johnson (Chicago Bears)",
  "Brian Schottenheimer (Dallas Cowboys)",
  "Dan Campbell (Detroit Lions)",
  "Dan Quinn (Washington Commanders)",
  "Dave Canales (Carolina Panthers)",
  "DeMeco Ryans (Houston Texans)",
  "Jim Harbaugh (Los Angeles Chargers)",
  "John Harbaugh (Baltimore Ravens)",
  "Jonathan Gannon (Arizona Cardinals)",
  "Kellen Moore (New Orleans Saints)",
  "Kevin O'Connell (Minnesota Vikings)",
  "Kevin Stefanski (Cleveland Browns)",
  "Kyle Shanahan (San Francisco 49ers)",
  "Liam Coen (Jacksonville Jaguars)",
  "Matt LaFleur (Green Bay Packers)",
  "Mike Macdonald (Seattle Seahawks)",
  "Mike McDaniel (Miami Dolphins)",
  "Mike Tomlin (Pittsburgh Steelers)",
  "Mike Vrabel (New England Patriots)",
  "Nick Sirianni (Philadelphia Eagles)",
  "Pete Carroll (Las Vegas Raiders)",
  "Raheem Morris (Atlanta Falcons)",
  "Sean McDermott (Buffalo Bills)",
  "Sean McVay (Los Angeles Rams)",
  "Sean Payton (Denver Broncos)",
  "Shane Steichen (Indianapolis Colts)",
  "Todd Bowles (Tampa Bay Buccaneers)",
  "Aaron Glenn (New York Jets)",
  "Zac Taylor (Cincinnati Bengals)",
];

const OFFENSIVE_SCHEMES = [
  "Run First / Ground Control",
  "Balanced Offense",
  "Pass First / Space and Timing",
  "Athlete-Centric",
  "Simple - Low Install",
  "Misdirection & Deception",
  "Shot Plays / Big Plays",
];

const DEFENSIVE_SCHEMES = [
  "Contain / No Big Plays",
  "Simple Zone / Area Defense",
  "Man Coverage / Match Up",
  "Pressure / Aggressive",
  "Read & React (Assignment Rules)",
  "Athlete-Centric",
  "Bend Don't Break",
];

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  isAdmin: boolean;
  favoriteNFLTeam: string | null;
  favoriteNFLCoach: string | null;
  offensiveSchemePreference: string | null;
  defensiveSchemePreference: string | null;
  avatarUrl: string | null;
}

export default function CoachProfile() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [favoriteNFLTeam, setFavoriteNFLTeam] = useState("");
  const [favoriteNFLCoach, setFavoriteNFLCoach] = useState("");
  const [offensiveScheme, setOffensiveScheme] = useState("");
  const [defensiveScheme, setDefensiveScheme] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [showAvatarInput, setShowAvatarInput] = useState(false);
  
  const { data: user, isLoading: userLoading } = useQuery<UserData | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn<UserData | null>({ on401: "returnNull" }),
    retry: false,
  });
  
  useEffect(() => {
    if (user) {
      setFavoriteNFLTeam(user.favoriteNFLTeam || "");
      setFavoriteNFLCoach(user.favoriteNFLCoach || "");
      setOffensiveScheme(user.offensiveSchemePreference || "");
      setDefensiveScheme(user.defensiveSchemePreference || "");
      setAvatarUrl(user.avatarUrl || "");
    }
  }, [user]);
  
  useEffect(() => {
    if (!userLoading && !user) {
      navigate("/");
    }
  }, [user, userLoading, navigate]);
  
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { 
      favoriteNFLTeam?: string; 
      favoriteNFLCoach?: string;
      offensiveSchemePreference?: string;
      defensiveSchemePreference?: string;
      avatarUrl?: string;
    }) => {
      return apiRequest("PATCH", "/api/user/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const handleSave = () => {
    updateProfileMutation.mutate({
      favoriteNFLTeam,
      favoriteNFLCoach: favoriteNFLCoach || undefined,
      offensiveSchemePreference: offensiveScheme || undefined,
      defensiveSchemePreference: defensiveScheme || undefined,
      avatarUrl: avatarUrl || undefined,
    });
  };
  
  const getUserInitials = () => {
    if (user?.firstName) {
      return user.firstName.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "C";
  };
  
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }
  
  if (!user) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      
      <main className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Play Designer
        </button>
        
        <Card className="shadow-lg bg-slate-800 border-slate-700">
          <CardHeader className="text-center border-b border-slate-700">
            <CardTitle className="text-2xl font-bold text-orange-400">
              Coach Profile
            </CardTitle>
          </CardHeader>
          
          <CardContent className="pt-8">
            <div className="flex flex-col items-center mb-8">
              <div className="relative group">
                <Avatar className="h-[120px] w-[120px] border-4 border-orange-300 shadow-lg">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt="Profile picture" />
                  ) : null}
                  <AvatarFallback className="bg-orange-500 text-white text-4xl font-bold">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => setShowAvatarInput(!showAvatarInput)}
                  className="absolute bottom-0 right-0 bg-orange-500 text-white p-2 rounded-full shadow-lg hover:bg-orange-600 transition-colors"
                  data-testid="button-edit-avatar"
                >
                  <Camera className="h-5 w-5" />
                </button>
              </div>
              
              {showAvatarInput && (
                <div className="mt-4 w-full max-w-sm">
                  <Label htmlFor="avatarUrl" className="text-sm font-medium text-orange-300">
                    Profile Picture URL
                  </Label>
                  <Input
                    id="avatarUrl"
                    type="url"
                    placeholder="https://example.com/photo.jpg"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="mt-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    data-testid="input-avatar-url"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Enter a URL to your profile picture
                  </p>
                </div>
              )}
            </div>
            
            <div className="space-y-6">
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-orange-300">
                  Name
                </Label>
                <Input
                  id="name"
                  value={user.firstName || "Coach"}
                  disabled
                  className="mt-1 bg-slate-700/50 border-slate-600 text-slate-300 cursor-not-allowed"
                  data-testid="input-name"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Contact support to change your name
                </p>
              </div>
              
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-orange-300">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={user.email}
                  disabled
                  className="mt-1 bg-slate-700/50 border-slate-600 text-slate-300 cursor-not-allowed"
                  data-testid="input-email"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Contact support to change your email
                </p>
              </div>
              
              <div>
                <Label htmlFor="favoriteTeam" className="text-sm font-medium text-orange-300">
                  Favorite NFL Team
                </Label>
                <Input
                  id="favoriteTeam"
                  placeholder="e.g. Kansas City Chiefs"
                  value={favoriteNFLTeam}
                  onChange={(e) => setFavoriteNFLTeam(e.target.value)}
                  className="mt-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                  data-testid="input-favorite-team"
                />
              </div>
              
              <div>
                <Label htmlFor="favoriteCoach" className="text-sm font-medium text-orange-300">
                  Favorite NFL Coach
                </Label>
                <Select value={favoriteNFLCoach} onValueChange={setFavoriteNFLCoach}>
                  <SelectTrigger 
                    id="favoriteCoach"
                    className="mt-1 bg-slate-700 border-slate-600 text-white"
                    data-testid="select-favorite-coach"
                  >
                    <SelectValue placeholder="Select a coach..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                    {NFL_HEAD_COACHES.map((coach) => (
                      <SelectItem 
                        key={coach} 
                        value={coach}
                        className="text-white hover:bg-slate-600 focus:bg-slate-600"
                      >
                        {coach}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="offensiveScheme" className="text-sm font-medium text-orange-300">
                  Offensive Scheme Preference
                </Label>
                <Select value={offensiveScheme} onValueChange={setOffensiveScheme}>
                  <SelectTrigger 
                    id="offensiveScheme"
                    className="mt-1 bg-slate-700 border-slate-600 text-white"
                    data-testid="select-offensive-scheme"
                  >
                    <SelectValue placeholder="Select a scheme..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {OFFENSIVE_SCHEMES.map((scheme) => (
                      <SelectItem 
                        key={scheme} 
                        value={scheme}
                        className="text-white hover:bg-slate-600 focus:bg-slate-600"
                      >
                        {scheme}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400 mt-1">
                  For play recommendations in the future
                </p>
              </div>
              
              <div>
                <Label htmlFor="defensiveScheme" className="text-sm font-medium text-orange-300">
                  Defensive Scheme Preference
                </Label>
                <Select value={defensiveScheme} onValueChange={setDefensiveScheme}>
                  <SelectTrigger 
                    id="defensiveScheme"
                    className="mt-1 bg-slate-700 border-slate-600 text-white"
                    data-testid="select-defensive-scheme"
                  >
                    <SelectValue placeholder="Select a scheme..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {DEFENSIVE_SCHEMES.map((scheme) => (
                      <SelectItem 
                        key={scheme} 
                        value={scheme}
                        className="text-white hover:bg-slate-600 focus:bg-slate-600"
                      >
                        {scheme}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400 mt-1">
                  For play recommendations in the future
                </p>
              </div>
              
              <Button
                onClick={handleSave}
                disabled={updateProfileMutation.isPending}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3"
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Profile
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
