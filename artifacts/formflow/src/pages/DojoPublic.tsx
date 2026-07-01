import { useParams, useLocation } from "wouter";
import { useGetDojoBySlug, useListForms, getGetDojoBySlugQueryKey, getListFormsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, BarChart2 } from "lucide-react";

export default function DojoPublic() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();

  const { data: dojo, isLoading } = useGetDojoBySlug(slug!, {
    query: { enabled: !!slug, queryKey: getGetDojoBySlugQueryKey(slug!) },
  });

  const { data: forms } = useListForms({}, { query: { queryKey: getListFormsQueryKey(), enabled: !!dojo } });
  const publicForms = (forms ?? []).filter(f => f.is_free);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-12 w-64 mb-4" />
        <Skeleton className="h-6 w-96" />
      </div>
    );
  }

  if (!dojo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Dojo not found.
      </div>
    );
  }

  const accent = dojo.accent_color ?? "#6366f1";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <div
        className="py-20 px-6 text-center relative overflow-hidden"
        style={{ borderBottom: `1px solid ${accent}33` }}
      >
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: `radial-gradient(circle at 50% 50%, ${accent}, transparent 70%)` }}
        />
        <div className="relative z-10 max-w-2xl mx-auto space-y-4">
          {dojo.logo_url && (
            <img src={dojo.logo_url} alt={dojo.name} className="w-20 h-20 rounded-2xl mx-auto object-cover" />
          )}
          <h1 className="text-4xl font-bold">{dojo.name}</h1>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span>{dojo.student_count ?? 0} students</span>
            <span>{dojo.form_count ?? 0} forms</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button
              style={{ backgroundColor: accent, borderColor: accent }}
              className="h-12 px-8 text-white font-semibold"
              onClick={() => setLocation(`/auth?invite_code=`)}
              data-testid="button-join-dojo"
            >
              Join This Dojo
            </Button>
            <Button
              variant="outline"
              className="h-12 px-8"
              onClick={() => setLocation("/auth")}
              data-testid="button-sign-in"
            >
              Sign In
            </Button>
          </div>
        </div>
      </div>

      {/* Free forms preview */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <h2 className="text-xl font-bold">Free Forms</h2>
        {publicForms.length === 0 && (
          <p className="text-muted-foreground text-sm">No free forms available yet.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {publicForms.map(f => (
            <Card key={f.id} className="bg-card border-border" data-testid={`form-card-${f.id}`}>
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="font-semibold">{f.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{f.difficulty}</div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{f.estimated_minutes ?? "—"} min</span>
                  <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3" />{f.posture_count} postures</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setLocation("/auth")}
                  data-testid={`button-try-form-${f.id}`}
                >
                  Try Free
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
