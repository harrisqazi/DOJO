import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  useGetAdminStats, useGetRecentActivity, useListDojos, useCreateDojo, useDeleteDojo,
  useListDisciplines, useCreateDiscipline, useDeleteDiscipline,
  useListForms, useDeleteForm, useListUsers, useUpdateUser,
  getGetAdminStatsQueryKey, getGetRecentActivityQueryKey, getListDojosQueryKey,
  getListDisciplinesQueryKey, getListFormsQueryKey, getListUsersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, BookOpen, BarChart3, Settings, Activity, Plus, Trash2, Video, CheckCircle } from "lucide-react";
import InstructorRecorder from "@/components/InstructorRecorder";
import type { DisciplineType, RecordingViewAngle } from "@/lib/motion/types";

type AdminTab = "overview" | "dojos" | "disciplines" | "forms" | "users" | "settings" | "recordings";

export default function Admin() {
  const { profile, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<AdminTab>("overview");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: stats } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });
  const { data: activity } = useGetRecentActivity({ query: { queryKey: getGetRecentActivityQueryKey() } });
  const { data: dojos } = useListDojos({ query: { queryKey: getListDojosQueryKey() } });
  const { data: disciplines } = useListDisciplines({}, { query: { queryKey: getListDisciplinesQueryKey() } });
  const { data: forms } = useListForms({}, { query: { queryKey: getListFormsQueryKey() } });
  const { data: users } = useListUsers({}, { query: { queryKey: getListUsersQueryKey() } });

  const createDojo = useCreateDojo();
  const deleteDojo = useDeleteDojo();
  const createDiscipline = useCreateDiscipline();
  const deleteDiscipline = useDeleteDiscipline();
  const deleteForm = useDeleteForm();
  const updateUser = useUpdateUser();

  const [newDojoName, setNewDojoName] = useState("");
  const [newDojoSlug, setNewDojoSlug] = useState("");
  const [newDiscName, setNewDiscName] = useState("");
  const [newDiscSlug, setNewDiscSlug] = useState("");

  const [recDiscipline, setRecDiscipline] = useState<DisciplineType>("yang_24");
  const [recViewAngle, setRecViewAngle] = useState<RecordingViewAngle>("front");
  const [savedRecordings, setSavedRecordings] = useState<Array<{ title: string; discipline: string; viewAngle: string; frameCount: number; savedAt: string }>>([]);

  const handleSaveRecording = useCallback(async (payload: object) => {
    const res = await fetch("/api/training-recordings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    const saved = await res.json();
    setSavedRecordings(prev => [...prev, {
      title: (payload as any).title ?? "Recording",
      discipline: (payload as any).discipline,
      viewAngle: (payload as any).view_angle,
      frameCount: (payload as any).frame_count,
      savedAt: new Date().toLocaleTimeString(),
    }]);
    toast({ title: "Recording saved" });
  }, [toast]);

  const TABS: { id: AdminTab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "dojos", label: "Dojos", icon: Building2 },
    { id: "disciplines", label: "Disciplines", icon: BookOpen },
    { id: "forms", label: "Forms", icon: BookOpen },
    { id: "users", label: "Users", icon: Users },
    { id: "recordings", label: "Recordings", icon: Video },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const handleCreateDojo = () => {
    if (!newDojoName || !newDojoSlug) return;
    createDojo.mutate({ data: { name: newDojoName, slug: newDojoSlug } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDojosQueryKey() });
        qc.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        setNewDojoName(""); setNewDojoSlug("");
        toast({ title: "Dojo created" });
      },
      onError: () => toast({ title: "Failed to create dojo", variant: "destructive" }),
    });
  };

  const handleDeleteDojo = (id: string) => {
    deleteDojo.mutate({ dojoId: id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDojosQueryKey() });
        toast({ title: "Dojo deleted" });
      },
    });
  };

  const handleCreateDiscipline = () => {
    if (!newDiscName || !newDiscSlug) return;
    createDiscipline.mutate({ data: { name: newDiscName, slug: newDiscSlug, is_public: true } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDisciplinesQueryKey() });
        setNewDiscName(""); setNewDiscSlug("");
        toast({ title: "Discipline created" });
      },
    });
  };

  const handleUpdateUserRole = (userId: string, role: string) => {
    updateUser.mutate({ userId, data: { role } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListUsersQueryKey() }),
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="text-primary font-bold text-lg">⚡ Dojo</div>
          <div className="text-xs text-muted-foreground mt-0.5">Platform Admin</div>
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

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-8">
        {/* Overview */}
        {tab === "overview" && (
          <div className="space-y-8">
            <h1 className="text-2xl font-bold">Overview</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Dojos", value: stats?.total_dojos ?? 0 },
                { label: "Active", value: stats?.dojos_active ?? 0 },
                { label: "Students", value: stats?.total_students ?? 0 },
                { label: "Sessions Today", value: stats?.total_sessions_today ?? 0 },
              ].map(s => (
                <Card key={s.label} className="bg-card">
                  <CardContent className="pt-6 pb-4">
                    <div className="text-3xl font-bold">{s.value}</div>
                    <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="bg-card">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" />Recent Activity</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(activity ?? []).slice(0, 10).map((a, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0" data-testid={`activity-row-${i}`}>
                      <div>
                        <div className="text-sm font-medium">{a.user_email}</div>
                        <div className="text-xs text-muted-foreground">{a.form_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{ color: (a.score ?? 0) >= 75 ? "#22c55e" : (a.score ?? 0) >= 50 ? "#eab308" : "#6b7280" }}>
                          {a.score != null ? Math.round(a.score) : "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(a.started_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!activity?.length && <div className="text-muted-foreground text-sm">No recent activity</div>}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Dojos */}
        {tab === "dojos" && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Dojos</h1>
            <Card className="bg-card">
              <CardHeader><CardTitle className="text-sm">Create Dojo</CardTitle></CardHeader>
              <CardContent className="flex gap-3">
                <Input placeholder="Name" value={newDojoName} onChange={e => setNewDojoName(e.target.value)} data-testid="input-dojo-name" />
                <Input placeholder="Slug (url-safe)" value={newDojoSlug} onChange={e => setNewDojoSlug(e.target.value)} data-testid="input-dojo-slug" />
                <Button onClick={handleCreateDojo} disabled={createDojo.isPending} data-testid="button-create-dojo">
                  <Plus className="w-4 h-4 mr-1" />Add
                </Button>
              </CardContent>
            </Card>
            <div className="space-y-2">
              {(dojos ?? []).map(d => (
                <div key={d.id} className="flex items-center justify-between bg-card rounded-xl p-4 border border-border" data-testid={`dojo-row-${d.id}`}>
                  <div>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.slug}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={d.subscription_status === "active" ? "default" : "secondary"}>
                      {d.subscription_status}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteDojo(d.id)} data-testid={`delete-dojo-${d.id}`}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disciplines */}
        {tab === "disciplines" && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Disciplines</h1>
            <Card className="bg-card">
              <CardHeader><CardTitle className="text-sm">Create Discipline</CardTitle></CardHeader>
              <CardContent className="flex gap-3">
                <Input placeholder="Name" value={newDiscName} onChange={e => setNewDiscName(e.target.value)} data-testid="input-discipline-name" />
                <Input placeholder="Slug" value={newDiscSlug} onChange={e => setNewDiscSlug(e.target.value)} data-testid="input-discipline-slug" />
                <Button onClick={handleCreateDiscipline} disabled={createDiscipline.isPending} data-testid="button-create-discipline">
                  <Plus className="w-4 h-4 mr-1" />Add
                </Button>
              </CardContent>
            </Card>
            <div className="space-y-2">
              {(disciplines ?? []).map(d => (
                <div key={d.id} className="flex items-center justify-between bg-card rounded-xl p-4 border border-border" data-testid={`discipline-row-${d.id}`}>
                  <div>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.slug}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => {
                    deleteDiscipline.mutate({ disciplineId: d.id }, {
                      onSuccess: () => qc.invalidateQueries({ queryKey: getListDisciplinesQueryKey() }),
                    });
                  }} data-testid={`delete-discipline-${d.id}`}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Forms */}
        {tab === "forms" && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Forms</h1>
            <div className="space-y-2">
              {(forms ?? []).map(f => (
                <div key={f.id} className="flex items-center justify-between bg-card rounded-xl p-4 border border-border" data-testid={`form-row-${f.id}`}>
                  <div>
                    <div className="font-medium">{f.name}</div>
                    <div className="text-xs text-muted-foreground">{f.difficulty} · {f.posture_count} postures</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {f.is_free && <Badge variant="secondary">Free</Badge>}
                    <Button variant="ghost" size="icon" onClick={() => {
                      deleteForm.mutate({ formId: f.id }, {
                        onSuccess: () => qc.invalidateQueries({ queryKey: getListFormsQueryKey() }),
                      });
                    }} data-testid={`delete-form-${f.id}`}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {!forms?.length && <div className="text-muted-foreground text-sm">No forms yet</div>}
            </div>
          </div>
        )}

        {/* Users */}
        {tab === "users" && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Users</h1>
            <div className="space-y-2">
              {(users ?? []).map(u => (
                <div key={u.id} className="flex items-center justify-between bg-card rounded-xl p-4 border border-border" data-testid={`user-row-${u.id}`}>
                  <div>
                    <div className="font-medium">{u.name || u.email}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <Select value={u.role ?? "student"} onValueChange={role => handleUpdateUserRole(u.id, role)}>
                    <SelectTrigger className="w-36 h-9" data-testid={`select-role-${u.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="dojo_admin">Dojo Admin</SelectItem>
                      <SelectItem value="platform_admin">Platform Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {!users?.length && <div className="text-muted-foreground text-sm">No users yet</div>}
            </div>
          </div>
        )}

        {/* Recordings */}
        {tab === "recordings" && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Instructor Recordings</h1>
            <div className="flex gap-3 items-center flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Discipline:</label>
                <Select value={recDiscipline} onValueChange={v => setRecDiscipline(v as DisciplineType)}>
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yang_24">Yang 24</SelectItem>
                    <SelectItem value="tai_chi">Tai Chi</SelectItem>
                    <SelectItem value="wing_chun">Wing Chun</SelectItem>
                    <SelectItem value="karate">Karate</SelectItem>
                    <SelectItem value="wushu">Wushu</SelectItem>
                    <SelectItem value="general_martial_arts">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">View:</label>
                <Select value={recViewAngle} onValueChange={v => setRecViewAngle(v as RecordingViewAngle)}>
                  <SelectTrigger className="w-28 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="front">Front</SelectItem>
                    <SelectItem value="side">Side</SelectItem>
                    <SelectItem value="45_degree">45°</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <InstructorRecorder
              discipline={recDiscipline}
              viewAngle={recViewAngle}
              onSave={handleSaveRecording}
            />

            {savedRecordings.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-base font-semibold">Saved this session</h2>
                {savedRecordings.map((r, i) => (
                  <div key={i} className="flex items-center justify-between bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <div>
                        <div className="font-medium text-sm">{r.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.discipline.replace(/_/g, " ")} · {r.viewAngle} · {r.frameCount} frames · saved {r.savedAt}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings */}
        {tab === "settings" && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Settings</h1>
            <Card className="bg-card">
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-sm">Platform-level settings will appear here.</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
