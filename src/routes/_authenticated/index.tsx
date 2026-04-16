import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, IndianRupee, AlertTriangle, CalendarCheck, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("*").eq("status", "active");
      return data || [];
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*");
      return data || [];
    },
  });

  const { data: todayAttendance } = useQuery({
    queryKey: ["attendance-today"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase.from("attendance").select("*").eq("date", today).eq("status", "present");
      return data || [];
    },
  });

  const totalStudents = students?.length || 0;
  const totalCollected = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  const totalFees = students?.reduce((sum, s) => sum + Number(s.total_fees) - Number(s.discount), 0) || 0;
  const pendingFees = totalFees - totalCollected;
  const todayPresent = todayAttendance?.length || 0;

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i);
    const start = format(startOfMonth(date), "yyyy-MM-dd");
    const end = format(endOfMonth(date), "yyyy-MM-dd");
    const monthPayments = payments?.filter(
      (p) => p.payment_date >= start && p.payment_date <= end
    ) || [];
    return {
      month: format(date, "MMM"),
      revenue: monthPayments.reduce((sum, p) => sum + Number(p.amount), 0),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display">Dashboard</h1>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link to="/students">
              <UserPlus className="h-4 w-4 mr-1" />
              Add Student
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Students" value={totalStudents} icon={Users} color="text-primary" />
        <StatCard title="Fees Collected" value={`₹${totalCollected.toLocaleString("en-IN")}`} icon={IndianRupee} color="text-success" />
        <StatCard title="Pending Fees" value={`₹${Math.max(0, pendingFees).toLocaleString("en-IN")}`} icon={AlertTriangle} color="text-warning" />
        <StatCard title="Present Today" value={todayPresent} icon={CalendarCheck} color="text-chart-1" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">Monthly Revenue (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Revenue"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)" }}
                />
                <Bar dataKey="revenue" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold font-display mt-1">{value}</p>
          </div>
          <div className={`h-12 w-12 rounded-xl bg-muted flex items-center justify-center ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
