import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, IndianRupee, AlertTriangle, CalendarCheck, MessageCircle, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { useAcademicYear } from "@/lib/academic-year-context";
import { safeNum, buildWhatsappUrl, nextDueLabel } from "@/lib/format";
import { CardsSkeleton } from "@/components/ui/loading-skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const { year } = useAcademicYear();
  const [showCollected, setShowCollected] = useState(false);
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["students", year],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("*").eq("academic_year", year).eq("status", "active");
      return data || [];
    },
  });

  // Pull ALL payments for active students (across years) so pending isn't inflated when AY changes.
  const { data: payments } = useQuery({
    queryKey: ["payments-all"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*");
      return data || [];
    },
  });

  // For chart + collected stat — restrict to current AY
  const { data: ayPayments } = useQuery({
    queryKey: ["payments", year],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*").eq("academic_year", year);
      return data || [];
    },
  });

  const { data: todayAttendance } = useQuery({
    queryKey: ["attendance-today", year],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", today)
        .eq("status", "present")
        .eq("academic_year", year);
      return data || [];
    },
  });

  const totalStudents = students?.length || 0;
  const totalCollected = ayPayments?.reduce((sum, p) => sum + safeNum(p.amount), 0) || 0;
  const totalFees = students?.reduce((sum, s) => sum + safeNum(s.total_fees) - safeNum(s.discount), 0) || 0;
  // Pending = AY total fees − payments made by these AY students (any year)
  const studentIds = new Set((students || []).map((s) => s.id));
  const collectedAgainstAY = (payments || []).filter((p) => studentIds.has(p.student_id)).reduce((sum, p) => sum + safeNum(p.amount), 0);
  const pendingFees = totalFees - collectedAgainstAY;
  const todayPresent = todayAttendance?.length || 0;

  const studentPending = (students || []).map((s) => {
    const paid = (payments || []).filter((p) => p.student_id === s.id).reduce((sum, p) => sum + safeNum(p.amount), 0);
    const total = safeNum(s.total_fees) - safeNum(s.discount);
    return { ...s, paid, total, remaining: total - paid };
  }).filter((s) => s.remaining > 0).sort((a, b) => b.remaining - a.remaining).slice(0, 10);

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i);
    const start = format(startOfMonth(date), "yyyy-MM-dd");
    const end = format(endOfMonth(date), "yyyy-MM-dd");
    const monthPayments = ayPayments?.filter(
      (p) => p.payment_date >= start && p.payment_date <= end
    ) || [];
    return {
      month: format(date, "MMM"),
      revenue: monthPayments.reduce((sum, p) => sum + safeNum(p.amount), 0),
    };
  });

  const sendReminder = async (student: typeof studentPending[0]) => {
    const msg = `Hello ${student.name}, your pending fees for Yashshree Classes is ₹${student.remaining.toLocaleString("en-IN")}. Please pay before ${nextDueLabel(student.fee_due_day)}. Thank you.`;
    const url = buildWhatsappUrl(student.mobile, msg);
    if (!url) { toast.error(`Invalid mobile for ${student.name}`); return; }
    window.open(url, "_blank");
    await supabase.from("whatsapp_logs").insert({ student_id: student.id, message: msg, type: "reminder" });
    toast.success(`Reminder opened for ${student.name}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome greeting */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold font-display">Welcome back 👋</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, dd MMMM yyyy")} • {user?.email}</p>
        </div>
        <Badge variant="outline" className="text-xs">Academic Year {year}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {studentsLoading ? (
          <CardsSkeleton count={4} />
        ) : (
          <>
            <StatCard title="Total Students" value={totalStudents} icon={Users} gradient="from-primary/10 to-primary/5" iconBg="bg-primary/15" iconColor="text-primary" />
            <StatCard title="Fees Collected" value={showCollected ? `₹${totalCollected.toLocaleString("en-IN")}` : "₹ • • • • •"} icon={IndianRupee} gradient="from-success/10 to-success/5" iconBg="bg-success/15" iconColor="text-success" action={
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowCollected((v) => !v)} title={showCollected ? "Hide amount" : "Show amount"}>
                {showCollected ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            } />
            <StatCard title="Pending Fees" value={`₹${Math.max(0, pendingFees).toLocaleString("en-IN")}`} icon={AlertTriangle} gradient="from-destructive/10 to-destructive/5" iconBg="bg-destructive/15" iconColor="text-destructive" />
            <StatCard title="Present Today" value={todayPresent} icon={CalendarCheck} gradient="from-accent/10 to-accent/5" iconBg="bg-accent/15" iconColor="text-accent" />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                  <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Revenue"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px" }}
                  />
                  <Bar dataKey="revenue" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-display">Top Pending Fees</CardTitle>
              <Link to="/fees">
                <Button variant="ghost" size="sm" className="text-xs">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-56 overflow-y-auto">
              {studentPending.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No pending fees 🎉</p>
              ) : (
                studentPending.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.class} • {s.medium}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-destructive">₹{s.remaining.toLocaleString("en-IN")}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => sendReminder(s)} title="Send Reminder">
                        <MessageCircle className="h-3.5 w-3.5 text-success" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, gradient, iconBg, iconColor, action }: { title: string; value: string | number; icon: React.ElementType; gradient: string; iconBg: string; iconColor: string; action?: React.ReactNode }) {
  return (
    <Card className={`bg-gradient-to-br ${gradient} hover:shadow-md transition-all duration-300 hover:-translate-y-0.5`}>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
              {action}
            </div>
            <p className="text-2xl font-bold font-display mt-1">{value}</p>
          </div>
          <div className={`h-11 w-11 rounded-xl ${iconBg} flex items-center justify-center ${iconColor} shrink-0`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
