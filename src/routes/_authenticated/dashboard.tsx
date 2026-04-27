import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  IndianRupee,
  AlertTriangle,
  CalendarCheck,
  MessageCircle,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  ClipboardList,
  GraduationCap,
  UserPlus,
  BookOpen,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  subDays,
  addDays,
  isAfter,
  isBefore,
} from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { studentsReadFrom } from "@/lib/students-source";
import { useAcademicYear } from "@/lib/academic-year-context";
import { safeNum, buildWhatsappUrl, nextDueLabel } from "@/lib/format";
import { CardsSkeleton } from "@/components/ui/loading-skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  errorComponent: RouteError,
});

function DashboardPage() {
  const { isReady, isTeacher } = useAuth();
  if (!isReady) return null;
  return isTeacher ? <TeacherDashboard /> : <AdminDashboard />;
}

/* ───────────────────────────── Admin ───────────────────────────── */

function AdminDashboard() {
  const { user } = useAuth();
  const { year } = useAcademicYear();
  const [showCollected, setShowCollected] = useState(false);

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["students", year],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("*")
        .eq("academic_year", year)
        .eq("status", "active");
      return data || [];
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["payments-all"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*");
      return data || [];
    },
  });

  const { data: ayPayments } = useQuery({
    queryKey: ["payments", year],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("academic_year", year);
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

  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const { data: monthAttendance } = useQuery({
    queryKey: ["attendance-month", year, monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("academic_year", year)
        .gte("date", monthStart)
        .lte("date", monthEnd);
      return data || [];
    },
  });

  const { data: upcomingTests } = useQuery({
    queryKey: ["tests-upcoming", year],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const in7 = format(addDays(new Date(), 7), "yyyy-MM-dd");
      const { data } = await supabase
        .from("tests")
        .select("*")
        .eq("academic_year", year)
        .gte("test_date", today)
        .lte("test_date", in7)
        .order("test_date");
      return data || [];
    },
  });

  const totalStudents = students?.length || 0;
  const totalCollected = ayPayments?.reduce((s, p) => s + safeNum(p.amount), 0) || 0;
  const totalFees =
    students?.reduce((s, st) => s + safeNum(st.total_fees) - safeNum(st.discount), 0) || 0;
  const studentIds = new Set((students || []).map((s) => s.id));
  const collectedAgainstAY = (payments || [])
    .filter((p) => studentIds.has(p.student_id))
    .reduce((s, p) => s + safeNum(p.amount), 0);
  const pendingFees = totalFees - collectedAgainstAY;
  const todayPresent = todayAttendance?.length || 0;

  // MoM delta
  const thisMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const thisMonthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const lastMonthStart = format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");
  const lastMonthEnd = format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");
  const thisMonthCol = (ayPayments || [])
    .filter((p) => p.payment_date >= thisMonthStart && p.payment_date <= thisMonthEnd)
    .reduce((s, p) => s + safeNum(p.amount), 0);
  const lastMonthCol = (ayPayments || [])
    .filter((p) => p.payment_date >= lastMonthStart && p.payment_date <= lastMonthEnd)
    .reduce((s, p) => s + safeNum(p.amount), 0);
  const momPct =
    lastMonthCol > 0 ? Math.round(((thisMonthCol - lastMonthCol) / lastMonthCol) * 100) : null;
  const momUp = (momPct ?? 0) >= 0;

  // Class distribution
  const classCounts: Record<string, number> = {};
  (students || []).forEach((s) => {
    classCounts[s.class] = (classCounts[s.class] || 0) + 1;
  });
  const CLASS_RANK = ["5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
  const classData = CLASS_RANK.filter((c) => classCounts[c]).map((c) => ({
    name: c,
    value: classCounts[c],
  }));
  const PIE_COLORS = [
    "var(--primary)",
    "var(--accent)",
    "var(--success)",
    "var(--secondary)",
    "var(--destructive)",
    "var(--muted-foreground)",
    "var(--warning)",
    "var(--info, #6366f1)",
  ];

  // Attendance % this month
  const monthPresent = (monthAttendance || []).filter((a) => a.status === "present").length;
  const monthTotal = (monthAttendance || []).length;
  const monthAttPct = monthTotal > 0 ? Math.round((monthPresent / monthTotal) * 100) : 0;

  // Newest admissions (7d)
  const sevenAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");
  const newestAdmissions = (students || [])
    .filter((s) => s.admission_date >= sevenAgo)
    .sort((a, b) => b.admission_date.localeCompare(a.admission_date))
    .slice(0, 5);

  const studentPending = (students || [])
    .map((s) => {
      const paid = (payments || [])
        .filter((p) => p.student_id === s.id)
        .reduce((sum, p) => sum + safeNum(p.amount), 0);
      const total = safeNum(s.total_fees) - safeNum(s.discount);
      return { ...s, paid, total, remaining: total - paid };
    })
    .filter((s) => s.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, 10);

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i);
    const start = format(startOfMonth(date), "yyyy-MM-dd");
    const end = format(endOfMonth(date), "yyyy-MM-dd");
    const monthPayments =
      ayPayments?.filter((p) => p.payment_date >= start && p.payment_date <= end) || [];
    return {
      month: format(date, "MMM"),
      revenue: monthPayments.reduce((sum, p) => sum + safeNum(p.amount), 0),
    };
  });

  const sendReminder = async (student: typeof studentPending[0]) => {
    const msg = `Hello ${student.name}, your pending fees for Yashshree Classes is ₹${student.remaining.toLocaleString("en-IN")}. Please pay before ${nextDueLabel(student.fee_due_day)}. Thank you.`;
    const url = buildWhatsappUrl(student.mobile, msg);
    if (!url) {
      toast.error(`Invalid mobile for ${student.name}`);
      return;
    }
    window.open(url, "_blank");
    await supabase
      .from("whatsapp_logs")
      .insert({ student_id: student.id, message: msg, type: "reminder" });
    toast.success(`Reminder opened for ${student.name}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold font-display">Welcome back 👋</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd MMMM yyyy")} • {user?.email}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          Academic Year {year}
        </Badge>
      </div>

      {/* Stat cards — clickable */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {studentsLoading ? (
          <CardsSkeleton count={4} />
        ) : (
          <>
            <StatCard
              to="/students"
              title="Total Students"
              value={totalStudents}
              icon={Users}
              gradient="from-primary/10 to-primary/5"
              iconBg="bg-primary/15"
              iconColor="text-primary"
            />
            <StatCard
              to="/fees"
              title="Fees Collected"
              value={
                showCollected ? `₹${totalCollected.toLocaleString("en-IN")}` : "₹ • • • • •"
              }
              icon={IndianRupee}
              gradient="from-success/10 to-success/5"
              iconBg="bg-success/15"
              iconColor="text-success"
              action={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowCollected((v) => !v);
                  }}
                  title={showCollected ? "Hide amount" : "Show amount"}
                >
                  {showCollected ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
              }
            />
            <StatCard
              to="/fees"
              title="Pending Fees"
              value={`₹${Math.max(0, pendingFees).toLocaleString("en-IN")}`}
              icon={AlertTriangle}
              gradient="from-destructive/10 to-destructive/5"
              iconBg="bg-destructive/15"
              iconColor="text-destructive"
            />
            <StatCard
              to="/attendance"
              title="Present Today"
              value={todayPresent}
              icon={CalendarCheck}
              gradient="from-accent/10 to-accent/5"
              iconBg="bg-accent/15"
              iconColor="text-accent"
            />
          </>
        )}
      </div>

      {/* Widget row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* MoM */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Month-over-Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold font-display">
                ₹{thisMonthCol.toLocaleString("en-IN")}
              </p>
              {momPct !== null && (
                <Badge
                  variant="outline"
                  className={`text-xs gap-1 ${
                    momUp
                      ? "border-success text-success"
                      : "border-destructive text-destructive"
                  }`}
                >
                  {momUp ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {momUp ? "+" : ""}
                  {momPct}%
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              vs ₹{lastMonthCol.toLocaleString("en-IN")} last month
            </p>
          </CardContent>
        </Card>

        {/* Attendance % */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Attendance — This Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <p className="text-2xl font-bold font-display">{monthAttPct}%</p>
            <p className="text-xs text-muted-foreground">
              {monthPresent}/{monthTotal} records •{" "}
              {new Set((monthAttendance || []).map((a) => a.date)).size} days
            </p>
          </CardContent>
        </Card>

        {/* Class distribution */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Class Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-36">
              {classData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No students</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={classData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={28}
                      outerRadius={55}
                      paddingAngle={2}
                    >
                      {classData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue + Top Pending */}
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
                  <YAxis
                    className="text-xs fill-muted-foreground"
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      `₹${value.toLocaleString("en-IN")}`,
                      "Revenue",
                    ]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "13px",
                    }}
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
                <Button variant="ghost" size="sm" className="text-xs">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-56 overflow-y-auto">
              {studentPending.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No pending fees 🎉
                </p>
              ) : (
                studentPending.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.class} • {s.medium}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-destructive">
                        ₹{s.remaining.toLocaleString("en-IN")}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => sendReminder(s)}
                        title="Send Reminder"
                      >
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

      {/* Upcoming tests + new admissions */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Upcoming Tests (7 days)
              </CardTitle>
              <Link to="/tests">
                <Button variant="ghost" size="sm" className="text-xs">
                  Manage
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-56 overflow-y-auto">
              {(upcomingTests || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No tests scheduled this week
                </p>
              ) : (
                upcomingTests!.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.standard} • {t.subject}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(t.test_date), "dd MMM")}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> New Admissions (7 days)
              </CardTitle>
              <Link to="/students">
                <Button variant="ghost" size="sm" className="text-xs">
                  All Students
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-56 overflow-y-auto">
              {newestAdmissions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No new admissions this week
                </p>
              ) : (
                newestAdmissions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.class} • {s.medium}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(s.admission_date), "dd MMM")}
                    </Badge>
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

function StatCard({
  to,
  title,
  value,
  icon: Icon,
  gradient,
  iconBg,
  iconColor,
  action,
}: {
  to?: string;
  title: string;
  value: string | number;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
  iconColor: string;
  action?: React.ReactNode;
}) {
  const inner = (
    <Card
      className={`bg-gradient-to-br ${gradient} hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 ${to ? "cursor-pointer" : ""}`}
    >
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
              {action}
            </div>
            <p className="text-2xl font-bold font-display mt-1">{value}</p>
          </div>
          <div
            className={`h-11 w-11 rounded-xl ${iconBg} flex items-center justify-center ${iconColor} shrink-0`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

/* ───────────────────────────── Teacher ───────────────────────────── */

function TeacherDashboard() {
  const { user, teacherId } = useAuth();
  const { year } = useAcademicYear();
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const { data: profile } = useQuery({
    queryKey: ["teacher-self", teacherId],
    queryFn: async () => {
      if (!teacherId) return null;
      const { data } = await supabase.from("teachers").select("*").eq("id", teacherId).maybeSingle();
      return data;
    },
    enabled: !!teacherId,
  });

  const { data: lectures = [] } = useQuery({
    queryKey: ["my-lectures", teacherId, monthStart],
    queryFn: async () => {
      if (!teacherId) return [];
      const { data } = await supabase
        .from("lectures")
        .select("*")
        .eq("teacher_id", teacherId)
        .gte("date", monthStart)
        .lte("date", monthEnd);
      return data || [];
    },
    enabled: !!teacherId,
  });

  const { data: myAtt = [] } = useQuery({
    queryKey: ["my-teacher-attendance", teacherId, monthStart],
    queryFn: async () => {
      if (!teacherId) return [];
      const { data } = await supabase
        .from("teacher_attendance")
        .select("*")
        .eq("teacher_id", teacherId)
        .gte("date", monthStart)
        .lte("date", monthEnd);
      return data || [];
    },
    enabled: !!teacherId,
  });

  const { data: subjectTests = [] } = useQuery({
    queryKey: ["my-subject-tests", year, profile?.subject],
    queryFn: async () => {
      const { data } = await supabase
        .from("tests")
        .select("*")
        .eq("academic_year", year)
        .order("test_date", { ascending: false });
      return data || [];
    },
  });

  const { data: allResults = [] } = useQuery({
    queryKey: ["my-test-results"],
    queryFn: async () => {
      const { data } = await supabase.from("test_results").select("*");
      return data || [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-active-min", year],
    queryFn: async () => {
      // Teacher dashboard reads via students_safe (mobile excluded server-side).
      const { data } = await studentsReadFrom(false)
        .select("id, class, status, academic_year")
        .eq("academic_year", year)
        .eq("status", "active");
      return (data as Array<{ id: string; class: string; status: string; academic_year: string }>) || [];
    },
  });

  const presentDays = myAtt.filter((a) => a.status === "present").length;
  const totalAttDays = myAtt.length;
  const attPct = totalAttDays > 0 ? Math.round((presentDays / totalAttDays) * 100) : 0;

  const mySubject = (profile?.subject || "").toLowerCase();
  const myTests = subjectTests.filter((t) => t.subject.toLowerCase() === mySubject);
  const pendingMarks = myTests
    .map((t) => {
      const enrolled = students.filter((s) => s.class === t.standard).length;
      const entered = allResults.filter((r) => r.test_id === t.id).length;
      return { ...t, enrolled, entered };
    })
    .filter((t) => t.enrolled > 0 && t.entered < t.enrolled);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold font-display">Welcome, {profile?.name || "Teacher"} 👋</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd MMMM yyyy")} • {user?.email}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          AY {year}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">My Subject</p>
                <p className="text-lg font-bold font-display mt-1 truncate">
                  {profile?.subject || "—"}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <StatTile title="Lectures (this month)" value={lectures.length} icon={GraduationCap} />
        <StatTile title="My Attendance %" value={`${attPct}%`} icon={CalendarCheck} sub={`${presentDays}/${totalAttDays} days`} />
        <StatTile
          title="Pending marks entry"
          value={pendingMarks.length}
          icon={ClipboardList}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">My Pending Marks Entry</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-72 overflow-y-auto">
              {pendingMarks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">All caught up 🎉</p>
              ) : (
                pendingMarks.map((t) => (
                  <Link
                    to="/tests"
                    key={t.id}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.standard} • {format(new Date(t.test_date), "dd MMM")}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {t.entered}/{t.enrolled} entered
                    </Badge>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">My Lectures (this month)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-72 overflow-y-auto">
              {lectures.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No lectures logged this month
                </p>
              ) : (
                lectures
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((l) => (
                    <div key={l.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{l.subject}</p>
                        <p className="text-xs text-muted-foreground">{l.batch}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {format(new Date(l.date), "dd MMM")}
                      </Badge>
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

function StatTile({
  title,
  value,
  icon: Icon,
  sub,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <Card className="bg-gradient-to-br from-accent/10 to-accent/5">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold font-display mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="h-11 w-11 rounded-xl bg-accent/15 flex items-center justify-center text-accent shrink-0">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
