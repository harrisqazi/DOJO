import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { session, profile, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !session) {
      setLocation("/auth");
    } else if (!isLoading && session && profile && roles && !roles.includes(profile.role ?? "")) {
      setLocation("/dashboard");
    }
  }, [session, profile, isLoading, setLocation, roles]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;
  if (roles && !roles.includes(profile?.role ?? "")) return null;

  return <>{children}</>;
}
