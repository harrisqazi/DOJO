import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp, session, profile, isLoading: authIsLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [inviteCode, setInviteCode] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("invite_code");
    if (code) setInviteCode(code);
  }, []);

  useEffect(() => {
    if (session && !authIsLoading) {
      const role = profile?.role;
      if (role === "platform_admin") setLocation("/admin");
      else if (role === "dojo_admin") setLocation("/dojo-admin");
      else setLocation("/dashboard");
    }
  }, [session, profile, authIsLoading, setLocation]);

  const isBusy = submitting || (!!session && authIsLoading);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (error: any) {
      toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;
    setSubmitting(true);
    try {
      await signUp(email, password, inviteCode || undefined);
      toast({ title: "Account created!", description: "You're being signed in now." });
    } catch (error: any) {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-4">
            <div className="w-6 h-6 bg-primary rounded-sm rotate-45" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Welcome to Dojo</CardTitle>
          <CardDescription>
            {inviteCode ? "You've been invited to join a Dojo." : "Enter your details to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Log In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="bg-background"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isBusy}>
                  {isBusy ? "Signing in…" : "Log In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    minLength={6}
                    className="bg-background"
                  />
                </div>
                {inviteCode && (
                  <div className="space-y-2">
                    <Label>Invite Code</Label>
                    <Input value={inviteCode} disabled className="bg-muted text-muted-foreground opacity-70" />
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={isBusy}>
                  {isBusy ? "Creating account…" : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
