import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, BookOpen, Award, Star } from "lucide-react";

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: loginSearchSchema,
  component: LoginPage,
});

function LoginPage() {
  const { login, isAuthenticated, isReady, role, isAdmin, isTeacher } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const greeted = useRef(false);

  // Sanitize redirect: must be a relative path starting with `/` and not `//`
  const safeRedirect = (() => {
    const r = search.redirect;
    if (typeof r !== "string" || !r.startsWith("/") || r.startsWith("//")) return "/dashboard";
    return r;
  })();

  useEffect(() => {
    if (isReady && isAuthenticated) {
      if (!greeted.current && role) {
        greeted.current = true;
        toast.success(isAdmin ? "Welcome admin" : isTeacher ? "Welcome teacher" : "Welcome");
        logAudit("login", "auth", null, { role });
      }
      navigate({ to: safeRedirect });
    }
  }, [isReady, isAuthenticated, role, isAdmin, isTeacher, navigate, safeRedirect]);

  // Render a blank shell until we know auth state, or if user is already logged in (preventing flash)
  if (!isReady || isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center bg-primary" />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || "Invalid credentials");
        // Best-effort: log failed attempt (no session yet, attach attempted email)
        await logAudit("login_failed", "auth", null, { email }, { id: null, email });
      }
      // On success, the auth-state effect above will navigate — no double-navigate here
    } catch {
      setError("Something went wrong. Try again.");
      await logAudit("login_failed", "auth", null, { email, error: "exception" }, { id: null, email });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-secondary blur-3xl" />
        <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-accent blur-3xl" />
      </div>
      {/* Floating icons */}
      <div className="absolute top-[15%] left-[10%] opacity-10 animate-bounce" style={{ animationDelay: "0.5s" }}>
        <BookOpen className="h-12 w-12 text-secondary" />
      </div>
      <div className="absolute top-[30%] right-[12%] opacity-10 animate-bounce" style={{ animationDelay: "1s" }}>
        <Award className="h-10 w-10 text-secondary" />
      </div>
      <div className="absolute bottom-[25%] left-[15%] opacity-10 animate-bounce" style={{ animationDelay: "1.5s" }}>
        <Star className="h-8 w-8 text-secondary" />
      </div>

      <Card className="w-full max-w-sm shadow-2xl border-0 bg-card animate-slide-up relative z-10">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-secondary shadow-lg">
            <GraduationCap className="h-8 w-8" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold font-display">Yashshree Classes</CardTitle>
            <p className="text-xs text-secondary font-semibold mt-1">Coaching Classes • Since 2015</p>
          </div>
          <CardDescription>Admin Panel — Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@yashshree.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
