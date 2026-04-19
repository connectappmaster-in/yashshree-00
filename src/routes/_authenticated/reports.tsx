import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, FileText, Send, MessageCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, subDays, subMonths, subYears } from "date-fns";
import { useAcademicYear } from "@/lib/academic-year-context";
import { exportCSV, exportExcel, exportPDF } from "@/lib/export-utils";
import { safeNum, buildWhatsappUrl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

const CLASSES = ["5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
const MEDIUMS = ["Hindi", "English", "Marathi", "CBSE", "SSC"];
type Frequency = "Weekly" | "Monthly" | "Quarterly" | "Yearly";

function ReportsPage() {
  const { year } = useAcademicYear();
  const [filterClass, setFilterClass] = useState("all");
  const [filterMedium, setFilterMedium] = useState("all");
  const [attClass, setAttClass] = useState("all");
  const [reportMonth, setReportMonth] = useState(format(new Date(), "yyyy-MM"));
  const [waDialogOpen, setWaDialogOpen] = useState(false);
  const [waStudent, setWaStudent] = useState<{ id: string; name: string; mobile: string } | null>(null);
  const [waFreq, setWaFreq] = useState<Frequency>("Monthly");

  const { data: students = [] } = useQuery({
    queryKey: ["students", year],
    queryFn: async () => (await supabase.from("students").select("*").eq("academic_year", year).order("name")).data || [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments", year],
    queryFn: async () => (await supabase.from("payments").select("*").eq("academic_year", year)).data || [],
  });
  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => (await supabase.from("teachers").select("*").order("name")).data || [],
  });

  const monthStart = format(startOfMonth(new Date(reportMonth + "-01")), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date(reportMonth + "-01")), "yyyy-MM-dd");

  const { data: lectures = [] } = useQuery({
    queryKey: ["lectures", reportMonth, year],
    queryFn: async () => (await supabase.from("lectures").select("*").eq("academic_year", year).gte("date", monthStart).lte("date", monthEnd)).data || [],
  });

  const { data: allAttendance = [] } = useQuery({
    queryKey: ["attendance-all", year],
    queryFn: async () => (await supabase.from("attendance").select("*").eq("academic_year", year)).data || [],
  });

  const { data: teacherAtt = [] } = useQuery({
    queryKey: ["teacher-attendance", reportMonth, year],
    queryFn: async () => (await supabase.from("teacher_attendance").select("*").eq("academic_year", year).gte("date", monthStart).lte("date", monthEnd)).data || [],
  });

  const filteredStudents = students.filter((s) => {
    const mc = filterClass === "all" || s.class === filterClass;
    const mm = filterMedium === "all" || s.medium === filterMedium;
    return mc && mm;
  });

  // Pending fees — uses ALL payments to avoid AY-mismatch inflation
  const { data: allPayments = [] } = useQuery({
    queryKey: ["payments-all"],
    queryFn: async () => (await supabase.from("payments").select("*")).data || [],
  });
  // Pending = current-AY active students only (the AY filter on `students` query already restricts to year)
  const pendingData = students.filter((s) => s.status === "active" && s.academic_year === year).map((s) => {
    const paid = allPayments.filter((p) => p.student_id === s.id).reduce((sum, p) => sum + safeNum(p.amount), 0);
    const total = safeNum(s.total_fees) - safeNum(s.discount);
    return { ...s, paid, total, remaining: total - paid };
  }).filter((s) => s.remaining > 0).sort((a, b) => b.remaining - a.remaining);
  const totalPendingAmount = pendingData.reduce((sum, s) => sum + s.remaining, 0);

  // Monthly collection (this month payments only)
  const monthPayments = payments.filter((p) => p.payment_date >= monthStart && p.payment_date <= monthEnd);
  const monthTotal = monthPayments.reduce((sum, p) => sum + safeNum(p.amount), 0);

  // Salary — fixed teachers always get full monthly salary (industry standard); UI shows present/working days for transparency
  const workingDays = new Set(teacherAtt.map((a) => a.date)).size;
  const teacherSalaryData = teachers.map((t) => {
    const count = lectures.filter((l) => l.teacher_id === t.id).length;
    const presentDays = teacherAtt.filter((a) => a.teacher_id === t.id && a.status === "present").length;
    const salary = t.payment_type === "fixed"
      ? safeNum(t.fixed_salary)
      : count * safeNum(t.per_lecture_fee);
    return { ...t, count, presentDays, salary };
  });
  const totalSalary = teacherSalaryData.reduce((sum, t) => sum + t.salary, 0);

  // Attendance per student (this month) — uses its own class filter; AY-scoped via students query
  const attRows = students.filter((s) => s.status === "active" && s.academic_year === year && (attClass === "all" || s.class === attClass)).map((s) => {
    const recs = allAttendance.filter((a) => a.student_id === s.id && a.date >= monthStart && a.date <= monthEnd);
    const present = recs.filter((r) => r.status === "present").length;
    const total = recs.length;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    return { ...s, present, totalDays: total, pct };
  });

  const exportAll = (title: string, headers: string[], rows: (string | number)[][], filename: string) => ({
    csv: () => exportCSV(headers, rows, `${filename}.csv`),
    xlsx: () => exportExcel(headers, rows, `${filename}.xlsx`),
    pdf: () => exportPDF(title, headers, rows, `${filename}.pdf`),
  });

  const ExportButtons = ({ exporters }: { exporters: ReturnType<typeof exportAll> }) => (
    <div className="flex gap-1">
      <Button variant="outline" size="sm" onClick={exporters.csv}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
      <Button variant="outline" size="sm" onClick={exporters.xlsx}><FileSpreadsheet className="h-3.5 w-3.5 mr-1" />Excel</Button>
      <Button variant="outline" size="sm" onClick={exporters.pdf}><FileText className="h-3.5 w-3.5 mr-1" />PDF</Button>
    </div>
  );

  const openWaDialog = (s: { id: string; name: string; mobile: string }) => { setWaStudent(s); setWaDialogOpen(true); };

  const sendWhatsapp = async () => {
    if (!waStudent) return;
    // Match periods to UI labels: Weekly = last 7 days, Monthly = the selected report month, else rolling N months
    const label =
      waFreq === "Weekly" ? "last 7 days" :
      waFreq === "Monthly" ? format(new Date(reportMonth + "-01"), "MMMM yyyy") :
      waFreq === "Quarterly" ? "last 3 months" :
      "last 12 months";
    const fromDate =
      waFreq === "Weekly" ? format(subDays(new Date(), 7), "yyyy-MM-dd") :
      waFreq === "Monthly" ? monthStart :
      waFreq === "Quarterly" ? format(subMonths(new Date(), 3), "yyyy-MM-dd") :
      format(subYears(new Date(), 1), "yyyy-MM-dd");
    const toDate = waFreq === "Monthly" ? monthEnd : format(new Date(), "yyyy-MM-dd");
    const recs = allAttendance.filter((a) => a.student_id === waStudent.id && a.date >= fromDate && a.date <= toDate);
    const present = recs.filter((r) => r.status === "present").length;
    const total = recs.length;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    const msg = `Yashshree Classes — ${waFreq} Attendance Report for ${waStudent.name}: ${present}/${total} days present (${pct}%). Period: ${label}.`;
    const url = buildWhatsappUrl(waStudent.mobile, msg);
    if (!url) { toast.error("Invalid mobile number"); return; }
    window.open(url, "_blank");
    await supabase.from("whatsapp_logs").insert({ student_id: waStudent.id, message: msg, type: "attendance" });
    toast.success("Report sent");
    setWaDialogOpen(false);
  };

  const setMonthPreset = (offset: number) => {
    const d = subMonths(new Date(), offset);
    setReportMonth(format(d, "yyyy-MM"));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold font-display">Reports</h1>
          <Badge variant="outline" className="text-xs">AY {year}</Badge>
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setMonthPreset(0)}>This Month</Button>
          <Button variant="outline" size="sm" onClick={() => setMonthPreset(1)}>Last Month</Button>
          <Button variant="outline" size="sm" onClick={() => setMonthPreset(3)}>3 Months Ago</Button>
        </div>
      </div>

      <Tabs defaultValue="students">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="pending">Pending Fees</TabsTrigger>
          <TabsTrigger value="collection">Collection</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="salary">Salary</TabsTrigger>
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
            <ExportButtons exporters={exportAll(
              "Students List",
              ["Name", "Mobile", "Class", "Medium", "Batch", "Fees", "Status"],
              filteredStudents.map((s) => [s.name, s.mobile, s.class, s.medium, s.batch, Number(s.total_fees) - Number(s.discount), s.status]),
              "students"
            )} />
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Mobile</TableHead><TableHead>Class</TableHead><TableHead>Medium</TableHead><TableHead>Batch</TableHead><TableHead>Fees</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredStudents.map((s) => (
                  <TableRow key={s.id}>
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
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <ExportButtons exporters={exportAll(
              "Pending Fees",
              ["Name", "Class", "Total", "Paid", "Remaining"],
              pendingData.map((s) => [s.name, s.class, s.total, s.paid, s.remaining]),
              "pending_fees"
            )} />
          </div>
          <Card>
            <CardHeader><CardTitle className="font-display">Pending Fees</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Class</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Remaining</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {pendingData.map((s) => (
                    <TableRow key={s.id}>
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
                <span>Total ({pendingData.length})</span>
                <span className="text-destructive">₹{totalPendingAmount.toLocaleString("en-IN")}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collection" className="mt-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="border rounded-md px-3 py-2 text-sm bg-background" />
            <ExportButtons exporters={exportAll(
              `Collection ${reportMonth}`,
              ["Date", "Student", "Mode", "Amount"],
              monthPayments.map((p) => {
                const st = students.find((s) => s.id === p.student_id);
                return [format(new Date(p.payment_date), "dd MMM yyyy"), st?.name || "—", p.payment_mode, Number(p.amount)];
              }),
              `collection_${reportMonth}`
            )} />
          </div>
          <Card>
            <CardHeader><CardTitle className="font-display">Collection — {format(new Date(reportMonth + "-01"), "MMMM yyyy")}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Amount</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {monthPayments.map((p) => {
                    const st = students.find((s) => s.id === p.student_id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{format(new Date(p.payment_date), "dd MMM")}</TableCell>
                        <TableCell className="font-medium">{st?.name || "—"}</TableCell>
                        <TableCell>{p.payment_mode}</TableCell>
                        <TableCell className="text-right">₹{Number(p.amount).toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30 font-bold text-sm">
                <span>Total ({monthPayments.length})</span>
                <span>₹{monthTotal.toLocaleString("en-IN")}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="border rounded-md px-3 py-2 text-sm bg-background" />
            <Select value={attClass} onValueChange={setAttClass}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <ExportButtons exporters={exportAll(
              `Attendance ${reportMonth}`,
              ["Name", "Class", "Present", "Days", "%"],
              attRows.map((r) => [r.name, r.class, r.present, r.totalDays, `${r.pct}%`]),
              `attendance_${reportMonth}`
            )} />
          </div>
          <Card>
            <CardHeader><CardTitle className="font-display">Attendance — {format(new Date(reportMonth + "-01"), "MMMM yyyy")}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Class</TableHead><TableHead className="text-right">Present</TableHead><TableHead className="text-right">Days</TableHead><TableHead className="text-right">%</TableHead><TableHead className="text-right">Send</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {attRows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No active students for this filter</TableCell></TableRow>
                  ) : attRows.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.class}</TableCell>
                      <TableCell className="text-right">{r.present}</TableCell>
                      <TableCell className="text-right">{r.totalDays}</TableCell>
                      <TableCell className={`text-right font-bold ${r.pct >= 75 ? "text-success" : r.pct >= 50 ? "text-warning-foreground" : "text-destructive"}`}>{r.pct}%</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openWaDialog({ id: r.id, name: r.name, mobile: r.mobile })} title="Send via WhatsApp">
                          <MessageCircle className="h-4 w-4 text-success" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary" className="mt-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="border rounded-md px-3 py-2 text-sm bg-background" />
            <ExportButtons exporters={exportAll(
              `Teacher Salary ${reportMonth}`,
              ["Teacher", "Subject", "Type", "Per Lecture", "Lectures", "Salary"],
              teacherSalaryData.map((t) => [t.name, t.subject, t.payment_type, Number(t.per_lecture_fee), t.count, t.salary]),
              `teacher_salary_${reportMonth}`
            )} />
          </div>
          <Card>
            <CardHeader><CardTitle className="font-display">Teacher Salary — {format(new Date(reportMonth + "-01"), "MMMM yyyy")}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Teacher</TableHead><TableHead>Subject</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Lectures</TableHead><TableHead className="text-right">Attendance</TableHead><TableHead className="text-right">Salary</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {teacherSalaryData.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.subject}</TableCell>
                      <TableCell className="text-xs">{t.payment_type === "fixed" ? "Fixed monthly" : "Per lecture"}</TableCell>
                      <TableCell className="text-right">{t.count}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{t.presentDays}/{workingDays} days</TableCell>
                      <TableCell className="text-right font-bold">₹{t.salary.toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30 font-bold text-sm">
                <span>Total ({teacherSalaryData.length})</span>
                <span>₹{totalSalary.toLocaleString("en-IN")}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={waDialogOpen} onOpenChange={setWaDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Send Attendance Report</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">To: <span className="font-medium">{waStudent?.name}</span> ({waStudent?.mobile})</p>
            <div className="space-y-1.5">
              <Label>Period</Label>
              <Select value={waFreq} onValueChange={(v) => setWaFreq(v as Frequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Weekly">Weekly (last 7 days)</SelectItem>
                  <SelectItem value="Monthly">Monthly (last 30 days)</SelectItem>
                  <SelectItem value="Quarterly">Quarterly (last 3 months)</SelectItem>
                  <SelectItem value="Yearly">Yearly (last 12 months)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={sendWhatsapp} className="w-full bg-success text-success-foreground hover:bg-success/90 font-semibold">
              <Send className="h-4 w-4 mr-1" />Open WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
