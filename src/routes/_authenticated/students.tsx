import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Search, IndianRupee, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useAcademicYear, deriveAcademicYear } from "@/lib/academic-year-context";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { safeNum } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
});

const CLASSES = ["5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
const MEDIUMS = ["Hindi", "English", "Marathi", "CBSE", "SSC"];
const SUBJECTS_BY_CLASS: Record<string, string[]> = {
  "5th": ["Maths", "Science", "English", "Hindi", "Social Science"],
  "6th": ["Maths", "Science", "English", "Hindi", "Social Science"],
  "7th": ["Maths", "Science", "English", "Hindi", "Social Science"],
  "8th": ["Maths", "Science", "English", "Hindi", "Social Science"],
  "9th": ["Maths", "Science", "English", "Hindi", "Social Science"],
  "10th": ["Maths", "Science", "English", "Hindi", "Social Science"],
  "11th": ["Physics", "Chemistry", "Maths", "Biology", "English", "Accountancy", "Economics", "Business Studies"],
  "12th": ["Physics", "Chemistry", "Maths", "Biology", "English", "Accountancy", "Economics", "Business Studies"],
};
const BATCHES = ["Morning", "Evening"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function StudentsPage() {
  const queryClient = useQueryClient();
  const { year } = useAcademicYear();
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterMedium, setFilterMedium] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Tables<"students"> | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students", year],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("*").eq("academic_year", year).order("name");
      return data || [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments-all"],
    queryFn: async () => {
      // All payments across years — student fees may be paid before AY change
      const { data } = await supabase.from("payments").select("*").order("payment_date", { ascending: false });
      return data || [];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance-all", year],
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("academic_year", year);
      return data || [];
    },
  });

  const { data: tests = [] } = useQuery({
    queryKey: ["tests", year],
    queryFn: async () => {
      const { data } = await supabase.from("tests").select("*").eq("academic_year", year).order("test_date", { ascending: false });
      return data || [];
    },
  });

  const { data: testResults = [] } = useQuery({
    queryKey: ["test-results"],
    queryFn: async () => {
      const { data } = await supabase.from("test_results").select("*");
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-all"] });
      queryClient.invalidateQueries({ queryKey: ["test-results"] });
      if (selectedId) setSelectedId(null);
      toast.success("Student and all related records deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const studentSummary = students.map((s) => {
    const sp = payments.filter((p) => p.student_id === s.id);
    const paid = sp.reduce((sum, p) => sum + safeNum(p.amount), 0);
    const total = safeNum(s.total_fees) - safeNum(s.discount);
    return { ...s, paid, total, remaining: total - paid, studentPayments: sp };
  });

  const filtered = studentSummary.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.mobile.includes(search);
    const matchClass = filterClass === "all" || s.class === filterClass;
    const matchMedium = filterMedium === "all" || s.medium === filterMedium;
    return matchSearch && matchClass && matchMedium;
  });

  const selected = selectedId ? studentSummary.find((s) => s.id === selectedId) : null;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold font-display">Students</h1>
          <Badge variant="secondary" className="text-xs">{filtered.length}</Badge>
          <Badge variant="outline" className="text-xs">AY {year}</Badge>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditStudent(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
              <Plus className="h-4 w-4 mr-1" />Add Student
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editStudent ? "Edit Student" : "Add New Student"}</DialogTitle>
            </DialogHeader>
            <StudentForm
              student={editStudent}
              defaultYear={year}
              onSuccess={() => {
                setDialogOpen(false);
                setEditStudent(null);
                queryClient.invalidateQueries({ queryKey: ["students"] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="w-full lg:w-[35%] space-y-3">
          <Card className="shadow-sm">
            <CardContent className="p-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search name / mobile..." className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <Select value={filterClass} onValueChange={setFilterClass}>
                  <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue placeholder="Class" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterMedium} onValueChange={setFilterMedium}>
                  <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue placeholder="Medium" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {MEDIUMS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="py-2">Name</TableHead>
                      <TableHead className="py-2">Class</TableHead>
                      <TableHead className="py-2 text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-sm text-muted-foreground">Loading...</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-sm text-muted-foreground">No students found</TableCell></TableRow>
                    ) : (
                      filtered.map((s) => (
                        <TableRow
                          key={s.id}
                          className={`cursor-pointer text-sm transition-colors hover:bg-muted/50 ${selectedId === s.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                          onClick={() => setSelectedId(s.id)}
                        >
                          <TableCell className="py-2 font-medium">{s.name}</TableCell>
                          <TableCell className="py-2 text-xs text-muted-foreground">{s.class} {s.medium}</TableCell>
                          <TableCell className={`py-2 text-right text-xs font-bold ${s.remaining > 0 ? "text-destructive" : "text-success"}`}>
                            {s.remaining > 0 ? `₹${s.remaining.toLocaleString("en-IN")}` : "Paid ✓"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full lg:w-[65%]">
          {!selected ? (
            <Card className="shadow-sm h-full flex items-center justify-center min-h-[300px]">
              <p className="text-muted-foreground text-sm">Select a student to view details</p>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold font-display">{selected.name}</h2>
                      <p className="text-sm text-muted-foreground">{selected.mobile} • {selected.class} {selected.medium} • {selected.batch} Batch</p>
                      <p className="text-xs text-muted-foreground mt-1">Due Day: {selected.fee_due_day}th • Admitted: {format(new Date(selected.admission_date), "dd MMM yyyy")}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditStudent(selected); setDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {selected.name}?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete this student and all related data.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(selected.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="info">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="fees">Fees</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                  <TabsTrigger value="tests">Tests</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="mt-3">
                  <Card><CardContent className="p-4 space-y-2 text-sm max-h-[60vh] overflow-y-auto">
                    <p><span className="text-muted-foreground">Subjects:</span> {selected.subjects.join(", ") || "—"}</p>
                    <p><span className="text-muted-foreground">Lecture Days:</span> {selected.lecture_days.join(", ") || "—"}</p>
                    <p className="flex items-center gap-2"><span className="text-muted-foreground">Status:</span> <Badge variant={selected.status === "active" ? "default" : "secondary"}>{selected.status}</Badge>
                      <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={async () => {
                        const next = selected.status === "active" ? "inactive" : "active";
                        const { error } = await supabase.from("students").update({ status: next }).eq("id", selected.id);
                        if (error) toast.error(error.message);
                        else { toast.success(`Marked ${next}`); queryClient.invalidateQueries({ queryKey: ["students"] }); }
                      }}>{selected.status === "active" ? "Mark inactive" : "Mark active"}</Button>
                    </p>
                    <p><span className="text-muted-foreground">Academic Year:</span> {selected.academic_year}</p>
                  </CardContent></Card>
                </TabsContent>

                <TabsContent value="fees" className="mt-3 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="shadow-sm"><CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-lg font-bold mt-0.5">₹{selected.total.toLocaleString("en-IN")}</p>
                    </CardContent></Card>
                    <Card className="shadow-sm"><CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Paid</p>
                      <p className="text-lg font-bold mt-0.5 text-success">₹{selected.paid.toLocaleString("en-IN")}</p>
                    </CardContent></Card>
                    <Card className="shadow-sm border-destructive/30"><CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Remaining</p>
                      <p className={`text-lg font-bold mt-0.5 ${selected.remaining > 0 ? "text-destructive" : "text-success"}`}>
                        ₹{Math.max(0, selected.remaining).toLocaleString("en-IN")}
                      </p>
                    </CardContent></Card>
                  </div>
                  <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold w-full">
                        <IndianRupee className="h-4 w-4 mr-1" />Add Payment
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader><DialogTitle>Add Payment — {selected.name}</DialogTitle></DialogHeader>
                      <PaymentForm
                        studentId={selected.id}
                        defaultYear={year}
                        onSuccess={() => {
                          setPaymentDialogOpen(false);
                          queryClient.invalidateQueries({ queryKey: ["payments"] });
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                  <Card><CardContent className="p-3">
                    <p className="text-sm font-semibold mb-2">Payment History</p>
                    {selected.studentPayments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No payments yet</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {selected.studentPayments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between bg-muted/30 rounded p-2 text-sm">
                            <div>
                              <p className="font-bold">₹{Number(p.amount).toLocaleString("en-IN")}</p>
                              <p className="text-xs text-muted-foreground">{format(new Date(p.payment_date), "dd MMM yyyy")} • {p.payment_mode}</p>
                              {p.notes && <p className="text-xs italic text-muted-foreground">{p.notes}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent></Card>
                </TabsContent>

                <TabsContent value="attendance" className="mt-3">
                  <StudentAttendanceView studentId={selected.id} attendance={attendance} />
                </TabsContent>

                <TabsContent value="tests" className="mt-3">
                  <StudentTestsView
                    studentId={selected.id}
                    standard={selected.class}
                    tests={tests}
                    results={testResults}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentAttendanceView({ studentId, attendance }: { studentId: string; attendance: Tables<"attendance">[] }) {
  const records = useMemo(
    () => attendance.filter((a) => a.student_id === studentId).sort((a, b) => b.date.localeCompare(a.date)),
    [studentId, attendance]
  );
  const present = records.filter((a) => a.status === "present").length;
  const total = records.length;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div><p className="text-xs text-muted-foreground">Days</p><p className="text-lg font-bold">{total}</p></div>
        <div><p className="text-xs text-muted-foreground">Present</p><p className="text-lg font-bold text-success">{present}</p></div>
        <div><p className="text-xs text-muted-foreground">Rate</p><p className="text-lg font-bold">{pct}%</p></div>
      </div>
      <div className="max-h-60 overflow-y-auto space-y-1">
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No attendance records</p>
        ) : records.map((r) => (
          <div key={r.id} className="flex justify-between text-sm bg-muted/30 rounded px-3 py-1.5">
            <span>{format(new Date(r.date), "dd MMM yyyy")}</span>
            <Badge variant={r.status === "present" ? "default" : "secondary"} className="text-xs">{r.status}</Badge>
          </div>
        ))}
      </div>
    </CardContent></Card>
  );
}

function StudentTestsView({ studentId, standard, tests, results }: { studentId: string; standard: string; tests: Tables<"tests">[]; results: Tables<"test_results">[] }) {
  const studentTests = tests.filter((t) => t.standard === standard);
  const rows = studentTests.map((t) => {
    const r = results.find((x) => x.test_id === t.id && x.student_id === studentId);
    const pct = r ? Math.round((Number(r.marks_obtained) / Number(t.max_marks)) * 100) : null;
    return { test: t, marks: r ? Number(r.marks_obtained) : null, pct };
  }).sort((a, b) => a.test.test_date.localeCompare(b.test.test_date));

  const chartData = rows.filter((r) => r.pct !== null).map((r) => ({
    name: r.test.name,
    pct: r.pct,
  }));

  return (
    <Card><CardContent className="p-4 space-y-3">
      {chartData.length > 1 && (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis domain={[0, 100]} className="text-xs" />
              <Tooltip />
              <Line type="monotone" dataKey="pct" stroke="var(--primary)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="max-h-60 overflow-y-auto space-y-1">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No tests for this standard yet</p>
        ) : rows.map(({ test, marks, pct }) => (
          <div key={test.id} className="flex items-center justify-between text-sm bg-muted/30 rounded px-3 py-2">
            <div>
              <p className="font-medium">{test.name}</p>
              <p className="text-xs text-muted-foreground">{test.subject} • {format(new Date(test.test_date), "dd MMM")}</p>
            </div>
            <div className="text-right">
              {marks !== null ? (
                <>
                  <p className="font-bold">{marks}/{Number(test.max_marks)}</p>
                  <p className={`text-xs ${pct! >= 50 ? "text-success" : "text-destructive"}`}>{pct}%</p>
                </>
              ) : <span className="text-xs text-muted-foreground">Not graded</span>}
            </div>
          </div>
        ))}
      </div>
    </CardContent></Card>
  );
}

function StudentForm({ student, defaultYear, onSuccess }: { student: Tables<"students"> | null; defaultYear: string; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: student?.name || "",
    mobile: student?.mobile || "",
    class: student?.class || "10th",
    medium: student?.medium || "Hindi",
    subjects: student?.subjects || [],
    admission_date: student?.admission_date || new Date().toISOString().split("T")[0],
    total_fees: student?.total_fees?.toString() || "",
    discount: student?.discount?.toString() || "0",
    batch: student?.batch || "Morning",
    lecture_days: student?.lecture_days || [],
    fee_due_day: student?.fee_due_day?.toString() || "1",
    status: student?.status || "active",
    academic_year: student?.academic_year || defaultYear,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const mobile = form.mobile.trim();
      if (!/^\d{10}$/.test(mobile)) {
        throw new Error("Mobile number must be exactly 10 digits");
      }
      const ay = form.academic_year || deriveAcademicYear(form.admission_date);
      const payload: TablesInsert<"students"> = {
        name: form.name.trim(),
        mobile,
        class: form.class,
        medium: form.medium,
        subjects: form.subjects,
        admission_date: form.admission_date,
        total_fees: Number(form.total_fees) || 0,
        discount: Number(form.discount) || 0,
        batch: form.batch,
        lecture_days: form.lecture_days,
        fee_due_day: Number(form.fee_due_day) || 1,
        status: form.status,
        academic_year: ay,
      };
      if (student) {
        const { error } = await supabase.from("students").update(payload).eq("id", student.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("students").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(student ? "Student updated" : "Student added");
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const finalFees = (Number(form.total_fees) || 0) - (Number(form.discount) || 0);
  const availableSubjects = SUBJECTS_BY_CLASS[form.class] || [];

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
        <div className="space-y-1.5"><Label>Mobile (10 digits)</Label><Input value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, "") }))} required maxLength={10} pattern="\d{10}" inputMode="numeric" /></div>
        <div className="space-y-1.5"><Label>Admission Date</Label><Input type="date" value={form.admission_date} onChange={(e) => setForm((f) => ({ ...f, admission_date: e.target.value, academic_year: deriveAcademicYear(e.target.value) }))} /></div>
        <div className="space-y-1.5">
          <Label>Class</Label>
          <Select value={form.class} onValueChange={(v) => setForm((f) => ({ ...f, class: v, subjects: [] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Medium</Label>
          <Select value={form.medium} onValueChange={(v) => setForm((f) => ({ ...f, medium: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MEDIUMS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Batch</Label>
          <Select value={form.batch} onValueChange={(v) => setForm((f) => ({ ...f, batch: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{BATCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Fee Due Day</Label><Input type="number" min={1} max={28} value={form.fee_due_day} onChange={(e) => setForm((f) => ({ ...f, fee_due_day: e.target.value }))} /></div>
        <div className="space-y-1.5"><Label>Total Fees (₹)</Label><Input type="number" value={form.total_fees} onChange={(e) => setForm((f) => ({ ...f, total_fees: e.target.value }))} required /></div>
        <div className="space-y-1.5"><Label>Discount (₹)</Label><Input type="number" value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} /></div>
        <div className="space-y-1.5"><Label>Academic Year</Label>
          <Select value={form.academic_year} onValueChange={(v) => setForm((f) => ({ ...f, academic_year: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2024-25">2024-25</SelectItem>
              <SelectItem value="2025-26">2025-26</SelectItem>
              <SelectItem value="2026-27">2026-27</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Subjects</Label>
        <div className="flex flex-wrap gap-1.5">
          {availableSubjects.map((sub) => (
            <Badge key={sub} variant={form.subjects.includes(sub) ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setForm((f) => ({ ...f, subjects: f.subjects.includes(sub) ? f.subjects.filter((s) => s !== sub) : [...f.subjects, sub] }))}>{sub}</Badge>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Lecture Days</Label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((day) => (
            <Badge key={day} variant={form.lecture_days.includes(day) ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setForm((f) => ({ ...f, lecture_days: f.lecture_days.includes(day) ? f.lecture_days.filter((d) => d !== day) : [...f.lecture_days, day] }))}>{day}</Badge>
          ))}
        </div>
      </div>
      <div className="pt-2 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Final: <span className="font-bold text-foreground">₹{Math.max(0, finalFees).toLocaleString("en-IN")}</span></p>
        <Button type="submit" className="bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : student ? "Update" : "Add Student"}
        </Button>
      </div>
    </form>
  );
}

function PaymentForm({ studentId, defaultYear, onSuccess }: { studentId: string; defaultYear: string; onSuccess: () => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [mode, setMode] = useState("cash");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const ay = deriveAcademicYear(date) || defaultYear;
      const { error } = await supabase.from("payments").insert({
        student_id: studentId,
        amount: Number(amount),
        payment_date: date,
        payment_mode: mode,
        notes: notes || null,
        academic_year: ay,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Payment recorded"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-3">
      <div className="space-y-1.5"><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min={1} /></div>
      <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="space-y-1.5">
        <Label>Payment Mode</Label>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
            <SelectItem value="bank">Bank Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5"><Label>Notes (optional)</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving..." : "Record Payment"}
      </Button>
    </form>
  );
}
