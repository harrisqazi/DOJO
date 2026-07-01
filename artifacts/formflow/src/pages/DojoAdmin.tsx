import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetDojo, useGetDojoStats, useGetDojoStudents, useUpdateDojo,
  useRegenerateInviteCode, useRemoveStudentFromDojo, useListForms,
  getGetDojoQueryKey, getGetDojoStatsQueryKey, getGetDojoStudentsQueryKey,
  getListFormsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Users, BookOpen, Settings, Copy, RefreshCw, UserMinus, Plus } from "lucide-react";

type DojoTab = "forms" | "students" | "settings";

export default function DojoAdmin() {
  const { profile, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<DojoTab>("forms");
  const qc = useQueryClient();
  const { toast } = useToast();

  const dojoId = profile?.dojo_id ?? "";

  const { data: dojo } = useGetDojo(dojoId, {
    query: { enabled: !!dojoId, queryKey: getGetDojoQueryKey(dojoId) },
  });
  const { data: stats } = useGetDojoStats(dojoId, {
    query: { enabled: !!dojoId, queryKey: getGetDojoStatsQueryKey(dojoId) },
  });
  const { data: students } = useGetDojoStudents(dojoId, {
    query: { enabled: !!dojoId, queryKey: getGetDojoStudentsQueryKey(dojoId) },
  });
  const { data: forms } = useListForms({}, { query: { queryKey: getListFormsQueryKey() } });

  const updateDojo = useUpdateDojo();
  const regenInvite = useRegenerateInviteCode();
  const removeStudent = useRemoveStudentFromDojo();

  const [dojoName, setDojoName] = useState("");
  const [accentColor, setAccentColor] = useState("");

  const TABS: { id: DojoTab; label: string; icon: any }[] = [
    { id: "forms", label: "My Forms", icon: BookOpen },
    { id: "students", label: "Students", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const handleCopyInvite = () => {
    const code = dojo?.invite_code;
    if (!code) return;
    const url = `${window.location.origin}/auth?invite_code=${code}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Invite link copied" });
  };

  const handleRegenInvite = () => {
    if (!dojoId) return;
    regenInvite.mutate({ dojoId }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetDojoQueryKey(dojoId) });
        toast({ title: "Invite code regenerated" });
      },
    });
  };

  const handleRemoveStudent = (userId: string) => {
    removeStudent.mutate({ dojoId, userId }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetDojoStudentsQueryKey(dojoId) }),
    });
  };

  const handleSaveSettings = () => {
    if (!dojoId) return;
    const data: Record<string, string> = {};
    if (dojoName) data.name = dojoName;
    if (accentColor) data.accent_color = accentColor;
    updateDojo.mutate({ dojoId, data }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetDojoQueryKey(dojoId) });
        toast({ title: "Settings saved" });
      },
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="text-primary font-bold text-lg">{dojo?.name ?? "Dojo"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Dojo Admin</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`tab-${t.id}`}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="text-xs text-muted-foreground mb-2">{profile?.email}</div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => signOut()}>Sign Out</Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-8">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Students", value: stats?.student_count ?? 0 },
            { label: "Sessions", value: stats?.session_count ?? 0 },
            { label: "Avg Score", value: stats?.avg_score != null ? Math.round(Number(stats.avg_score)) : "—" },
          ].map(s => (
            <Card key={s.label} className="bg-card">
              <CardContent className="pt-5 pb-4">
                <div className="text-3xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* My Forms */}
        {tab === "forms" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">My Forms</h2>
              <Button onClick={() => setLocation("/record")} data-testid="button-record-form">
                <Plus className="w-4 h-4 mr-2" />Record New Form
              </Button>
            </div>
            <div className="space-y-3">
              {(forms ?? []).map(f => (
                <div
                  key={f.id}
                  className="flex items-center justify-between bg-card rounded-xl p-4 border border-border"
                  data-testid={`form-row-${f.id}`}
                >
                  <div>
                    <div className="font-medium">{f.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.difficulty} · {f.posture_count} postures · {f.recording_count} recordings
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/training/${f.id}`)}
                    data-testid={`button-train-${f.id}`}
                  >
                    Train
                  </Button>
                </div>
              ))}
              {!forms?.length && (
                <div className="text-center text-muted-foreground py-12">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No forms yet. Record one to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Students */}
        {tab === "students" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Students</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyInvite} data-testid="button-copy-invite">
                  <Copy className="w-4 h-4 mr-1" />Copy Invite Link
                </Button>
                <Button variant="outline" size="sm" onClick={handleRegenInvite} data-testid="button-regen-invite">
                  <RefreshCw className="w-4 h-4 mr-1" />New Code
                </Button>
              </div>
            </div>

            {dojo?.invite_code && (
              <div className="bg-card rounded-xl p-4 border border-border">
                <div className="text-xs text-muted-foreground mb-1">Invite Code</div>
                <div className="font-mono text-primary text-lg tracking-wider">{dojo.invite_code}</div>
              </div>
            )}

            <div className="space-y-2">
              {(students ?? []).map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between bg-card rounded-xl p-4 border border-border"
                  data-testid={`student-row-${s.id}`}
                >
                  <div>
                    <div className="font-medium">{s.name || s.email}</div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveStudent(s.id)}
                    data-testid={`remove-student-${s.id}`}
                  >
                    <UserMinus className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {!students?.length && (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  No students yet. Share your invite link to get started.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings */}
        {tab === "settings" && (
          <div className="space-y-6 max-w-md">
            <h2 className="text-xl font-bold">Dojo Settings</h2>
            <Card className="bg-card">
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-2">
                  <Label>Dojo Name</Label>
                  <Input
                    value={dojoName || dojo?.name || ""}
                    onChange={e => setDojoName(e.target.value)}
                    placeholder={dojo?.name}
                    data-testid="input-dojo-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Accent Color</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      value={accentColor || dojo?.accent_color || "#6366f1"}
                      onChange={e => setAccentColor(e.target.value)}
                      className="w-16 h-10 p-1 cursor-pointer"
                      data-testid="input-accent-color"
                    />
                    <span className="text-sm text-muted-foreground">{accentColor || dojo?.accent_color || "#6366f1"}</span>
                  </div>
                </div>
                <Button onClick={handleSaveSettings} disabled={updateDojo.isPending} data-testid="button-save-settings">
                  {updateDojo.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
