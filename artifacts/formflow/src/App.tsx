import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Training from "@/pages/Training";
import MotionPractice from "@/pages/MotionPractice";
import Record from "@/pages/Record";
import Admin from "@/pages/Admin";
import DojoAdmin from "@/pages/DojoAdmin";
import DojoPublic from "@/pages/DojoPublic";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { supabase } from "@/lib/supabase";

setAuthTokenGetter(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={Auth} />
      <Route path="/dojo/:slug" component={DojoPublic} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/training/:formId">
        <ProtectedRoute>
          <Training />
        </ProtectedRoute>
      </Route>
      <Route path="/motion/:groupId">
        <ProtectedRoute>
          <MotionPractice />
        </ProtectedRoute>
      </Route>
      <Route path="/record">
        <ProtectedRoute roles={["dojo_admin", "platform_admin"]}>
          <Record />
        </ProtectedRoute>
      </Route>
      <Route path="/dojo-admin">
        <ProtectedRoute roles={["dojo_admin", "platform_admin"]}>
          <DojoAdmin />
        </ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute roles={["platform_admin"]}>
          <Admin />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
