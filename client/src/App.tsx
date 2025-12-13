import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import AdminDashboard from "@/pages/admin";
import ResetPasswordPage from "@/pages/reset-password";
import PlayLibrary from "@/pages/PlayLibrary";
import TeamPlaybooks from "@/pages/TeamPlaybooks";

function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Switch>
          <Route path="/">
            <Home 
              isAdmin={isAdmin} 
              setIsAdmin={setIsAdmin} 
              showSignUp={showSignUp}
              setShowSignUp={setShowSignUp}
            />
          </Route>
          <Route path="/admin">
            <AdminDashboard isAdmin={isAdmin} setIsAdmin={setIsAdmin} />
          </Route>
          <Route path="/reset-password">
            <ResetPasswordPage />
          </Route>
          <Route path="/plays">
            <PlayLibrary />
          </Route>
          <Route path="/playbooks">
            <TeamPlaybooks />
          </Route>
          <Route component={NotFound} />
        </Switch>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
