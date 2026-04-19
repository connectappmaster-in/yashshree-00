import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminTopNav } from "@/components/AdminTopNav";
import { AcademicYearProvider } from "@/lib/academic-year-context";
import { ThemeProvider } from "@/lib/theme-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  // Auth lives in localStorage (client-only). Skip the check during SSR so the
  // server-rendered HTML matches what the client renders after hydration.
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <ThemeProvider>
      <AcademicYearProvider>
        <div className="min-h-screen flex flex-col">
          <AdminTopNav />
          <main className="flex-1 overflow-auto p-4 md:p-6 animate-fade-in">
            <Outlet />
          </main>
        </div>
      </AcademicYearProvider>
    </ThemeProvider>
  );
}
