import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

const CLASSES = ["8th", "9th", "10th", "11th", "12th"];
const MEDIUMS = ["Hindi", "English", "Marathi"];

function ReportsPage() {
  const [filterClass, setFilterClass] = useState("all");
  const [filterMedium, setFilterMedium] = useState("all");
  const [reportMonth, setReportMonth] = useState(format(new Date(), "yyyy-MM"));

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("*").order("name");
      return data || [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*");
      return data || [];
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data } = await supabase.from("teachers").select("*").order("name");
      return data || [];
    },
  });

  const monthStart = format(startOfMonth(new Date(reportMonth + "-01")), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date(reportMonth + "-01")), "yyyy-MM-dd");

  const { data: lectures = [] } = useQuery({
    queryKey: ["lectures", reportMonth],
    queryFn: async () => {
      const { data } = await supabase.from("lectures").select("*").gte("date", monthStart).lte("date", monthEnd);
      return data || [];
    },
  });

  const filteredStudents = students.filter((s) => {
    const matchClass = filterClass === "all" || s.class === filterClass;
    const matchMedium = filterMedium === "all" || s.medium === filterMedium;
    return matchClass && matchMedium;
  });

  const exportCSV = (headers: string[], rows: string[][], filename: string) => {
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Pending fees data
  const pendingData = students.filter((s) => s.status === "active").map((s) => {
    const paid = payments.filter((p) => p.student_id === s.id).reduce((sum, p) => sum + Number(p.amount), 0);
    const total = Number(s.total_fees) - Number(s.discount);
    return { ...s, paid, total, remaining: total - paid };
  }).filter((s) => s.remaining > 0).sort((a, b) => b.remaining - a.remaining);

  const totalPendingAmount = pendingData.reduce((sum, s) => sum + s.remaining, 0);

  // Monthly collection
  const monthPayments = payments.filter((p) => p.payment_date >= monthStart && p.payment_date <= monthEnd);
  const monthTotal = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  // Teacher salary
  const teacherSalaryData = teachers.map((t) => {
    const count = lectures.filter((l) => l.teacher_id === t.id).length;
    const salary = count * Number(t.per_lecture_fee);
    return { ...t, count, salary };
  });
  const totalSalary = teacherSalaryData.reduce((sum, t) => sum + t.salary, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold font-display">Reports</h1>

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Student List</TabsTrigger>
          <TabsTrigger value="pending">Pending Fees</TabsTrigger>
          <TabsTrigger value="collection">Monthly Collection</TabsTrigger>
          <TabsTrigger value="salary">Teacher Salary</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterMedium} onValueChange={setFilterMedium}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Medium</SelectItem>
                {MEDIUMS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => exportCSV(
              ["Name", "Mobile", "Class", "Medium", "Batch", "Fees", "Status"],
              filteredStudents.map((s) => [s.name, s.mobile, s.class, s.medium, s.batch, String(Number(s.total_fees) - Number(s.discount)), s.status]),
              "students.csv"
            )}>
              <Download className="h-4 w-4 mr-1" />Export CSV
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead><TableHead>Mobile</TableHead><TableHead>Class</TableHead><TableHead>Medium</TableHead><TableHead>Batch</TableHead><TableHead>Fees</TableHead><TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((s) => (
                    <TableRow key={s.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.mobile}</TableCell>
                      <TableCell>{s.class}</TableCell>
                      <TableCell>{s.medium}</TableCell>
                      <TableCell>{s.batch}</TableCell>
                      <TableCell>₹{(Number(s.total_fees) - Number(s.discount)).toLocaleString("en-IN")}</TableCell>
                      <TableCell>{s.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportCSV(
              ["Name", "Class", "Total Fees", "Paid", "Remaining"],
              pendingData.map((s) => [s.name, s.class, String(s.total), String(s.paid), String(s.remaining)]),
              "pending_fees.csv"
            )}>
              <Download className="h-4 w-4 mr-1" />Export CSV
            </Button>
          </div>
          <Card>
            <CardHeader><CardTitle className="font-display">Pending Fees</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead><TableHead>Class</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingData.map((s) => (
                    <TableRow key={s.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.class}</TableCell>
                      <TableCell className="text-right">₹{s.total.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{s.paid.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">₹{s.remaining.toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30 font-bold text-sm">
                <span>Total ({pendingData.length} students)</span>
                <span className="text-destructive">₹{totalPendingAmount.toLocaleString("en-IN")}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collection" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="border rounded-md px-3 py-2 text-sm bg-background" />
            <Button variant="outline" size="sm" onClick={() => exportCSV(
              ["Date", "Student", "Mode", "Amount"],
              monthPayments.map((p) => {
                const student = students.find((s) => s.id === p.student_id);
                return [format(new Date(p.payment_date), "dd MMM yyyy"), student?.name || "—", p.payment_mode, String(Number(p.amount))];
              }),
              `collection_${reportMonth}.csv`
            )}>
              <Download className="h-4 w-4 mr-1" />Export CSV
            </Button>
          </div>
          <Card>
            <CardHeader><CardTitle className="font-display">Collection — {format(new Date(reportMonth + "-01"), "MMMM yyyy")}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthPayments.map((p) => {
                    const student = students.find((s) => s.id === p.student_id);
                    return (
                      <TableRow key={p.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell>{format(new Date(p.payment_date), "dd MMM")}</TableCell>
                        <TableCell className="font-medium">{student?.name || "—"}</TableCell>
                        <TableCell>{p.payment_mode}</TableCell>
                        <TableCell className="text-right">₹{Number(p.amount).toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30 font-bold text-sm">
                <span>Total ({monthPayments.length} payments)</span>
                <span>₹{monthTotal.toLocaleString("en-IN")}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="border rounded-md px-3 py-2 text-sm bg-background" />
            <Button variant="outline" size="sm" onClick={() => exportCSV(
              ["Teacher", "Subject", "Per Lecture", "Lectures", "Salary"],
              teacherSalaryData.map((t) => [t.name, t.subject, String(Number(t.per_lecture_fee)), String(t.count), String(t.salary)]),
              `teacher_salary_${reportMonth}.csv`
            )}>
              <Download className="h-4 w-4 mr-1" />Export CSV
            </Button>
          </div>
          <Card>
            <CardHeader><CardTitle className="font-display">Teacher Salary — {format(new Date(reportMonth + "-01"), "MMMM yyyy")}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead><TableHead>Subject</TableHead><TableHead className="text-right">Per Lecture</TableHead><TableHead className="text-right">Lectures</TableHead><TableHead className="text-right">Salary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacherSalaryData.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.subject}</TableCell>
                      <TableCell className="text-right">₹{Number(t.per_lecture_fee).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">{t.count}</TableCell>
                      <TableCell className="text-right font-bold">₹{t.salary.toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30 font-bold text-sm">
                <span>Total ({teacherSalaryData.length} teachers)</span>
                <span>₹{totalSalary.toLocaleString("en-IN")}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
