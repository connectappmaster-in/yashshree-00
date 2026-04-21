import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useAcademicYear, deriveAcademicYear } from "@/lib/academic-year-context";
import { AdminGuard } from "@/components/AdminGuard";

export const Route = createFileRoute("/_authenticated/teachers")({
  component: () => <AdminGuard><TeachersPage /></AdminGuard>,
});

const BATCHES = ["Morning", "Evening"];

function TeachersPage() {
  const queryClient = useQueryClient();
  const { year } = useAcademicYear();
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [editTeacher, setEditTeacher] = useState<Tables<"teachers"> | null>(null);
  const [lectureDialogOpen, setLectureDialogOpen] = useState(false);
  const [lectureTeacherId, setLectureTeacherId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data } = await supabase.from("teachers").select("*").order("name");
      return data || [];
    },
  });

  const monthStart = format(startOfMonth(new Date(selectedMonth + "-01")), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date(selectedMonth + "-01")), "yyyy-MM-dd");

  const { data: lectures = [] } = useQuery({
    queryKey: ["lectures", selectedMonth, year],
    queryFn: async () => {
      const { data } = await supabase.from("lectures").select("*").eq("academic_year", year).gte("date", monthStart).lte("date", monthEnd).order("date", { ascending: false });
      return data || [];
    },
  });

  const { data: teacherAtt = [] } = useQuery({
    queryKey: ["teacher-attendance", selectedMonth, year],
    queryFn: async () => {
      const { data } = await supabase.from("teacher_attendance").select("*").eq("academic_year", year).gte("date", monthStart).lte("date", monthEnd);
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teachers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["lectures"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-attendance"] });
      toast.success("Teacher and all records deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const workingDays = new Set(teacherAtt.map((a) => a.date)).size;
  const teacherStats = teachers.map((t) => {
    const tl = lectures.filter((l) => l.teacher_id === t.id);
    const presentDays = teacherAtt.filter((a) => a.teacher_id === t.id && a.status === "present").length;
    // Fixed teachers always get full monthly salary; per-lecture is count × fee
    const salary = t.payment_type === "fixed"
      ? Number(t.fixed_salary)
      : tl.length * Number(t.per_lecture_fee);
    return { ...t, lectureCount: tl.length, presentDays, salary };
  });

  const totalSalary = teacherStats.reduce((sum, t) => sum + t.salary, 0);
  const totalLectures = teacherStats.reduce((sum, t) => sum + t.lectureCount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold font-display">Teachers</h1>
        <div className="flex gap-2">
          <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-[160px]" />
          <Dialog open={teacherDialogOpen} onOpenChange={(o) => { setTeacherDialogOpen(o); if (!o) setEditTeacher(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold"><Plus className="h-4 w-4 mr-1" />Add Teacher</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>{editTeacher ? "Edit Teacher" : "Add Teacher"}</DialogTitle></DialogHeader>
              <TeacherForm teacher={editTeacher} onSuccess={() => {
                setTeacherDialogOpen(false);
                setEditTeacher(null);
                queryClient.invalidateQueries({ queryKey: ["teachers"] });
              }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="salary">
        <TabsList>
          <TabsTrigger value="salary">Salary & Lectures</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="salary" className="mt-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Monthly Summary — {format(new Date(selectedMonth + "-01"), "MMMM yyyy")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Lectures</TableHead>
                    <TableHead className="text-right">Salary</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacherStats.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.subject}</TableCell>
                      <TableCell className="text-xs">
                        {t.payment_type === "fixed" ? `Fixed ₹${Number(t.fixed_salary).toLocaleString("en-IN")}` : `₹${Number(t.per_lecture_fee).toLocaleString("en-IN")}/lec`}
                      </TableCell>
                      <TableCell className="text-right">{t.lectureCount}</TableCell>
                      <TableCell className="text-right font-bold">
                        ₹{t.salary.toLocaleString("en-IN")}
                        {t.payment_type === "fixed" && (
                          workingDays > 0
                            ? <span className="block text-[10px] font-normal text-muted-foreground">{t.presentDays}/{workingDays} days</span>
                            : <span className="block text-[10px] font-normal italic text-muted-foreground">No attendance logged</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setLectureTeacherId(t.id); setLectureDialogOpen(true); }} title="Log Lecture">
                            <BookOpen className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditTeacher(t); setTeacherDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {t.name}?</AlertDialogTitle>
                                <AlertDialogDescription>This will also delete all their lecture records.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(t.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30 font-bold text-sm">
                <span>Total ({teacherStats.length} teachers)</span>
                <div className="flex gap-8">
                  <span>{totalLectures} lectures</span>
                  <span>₹{totalSalary.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="mt-3">
          <TeacherAttendanceView teachers={teachers} attRecords={teacherAtt} year={year} />
        </TabsContent>
      </Tabs>

      <Dialog open={lectureDialogOpen} onOpenChange={setLectureDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Log Lecture</DialogTitle></DialogHeader>
          {lectureTeacherId && (
            <LectureForm teacherId={lectureTeacherId} teachers={teachers} defaultYear={year} onSuccess={() => {
              setLectureDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["lectures"] });
            }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeacherAttendanceView({ teachers, attRecords, year }: { teachers: Tables<"teachers">[]; attRecords: (Tables<"teacher_attendance"> & { academic_year?: string })[]; year: string }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [pending, setPending] = useState<Record<string, "present" | "absent">>({});

  const dayRecords = attRecords.filter((a) => a.date === date);

  const getStatus = (id: string): "present" | "absent" => {
    if (pending[id]) return pending[id];
    const r = dayRecords.find((x) => x.teacher_id === id);
    return (r?.status as "present" | "absent") || "absent";
  };

  const toggle = (id: string) => {
    setPending((p) => ({ ...p, [id]: getStatus(id) === "present" ? "absent" : "present" }));
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      // Only persist toggled rows — never overwrite untouched teachers
      const changedIds = Object.keys(pending);
      if (changedIds.length === 0) return 0;
      const recs = changedIds.map((id) => ({ teacher_id: id, date, status: pending[id], academic_year: year }));
      for (const r of recs) {
        const { error } = await supabase.from("teacher_attendance").upsert(r, { onConflict: "teacher_id,date" });
        if (error) throw error;
      }
      return recs.length;
    },
    onSuccess: (count) => {
      if (count === 0) { toast.info("No changes to save"); return; }
      toast.success(`Saved (${count} ${count === 1 ? "teacher" : "teachers"})`);
      setPending({});
      queryClient.invalidateQueries({ queryKey: ["teacher-attendance"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setPending({}); }} className="w-[160px]" />
          </div>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold ml-auto">
            {saveMut.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Present</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Subject</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachers.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No teachers</TableCell></TableRow>
            ) : teachers.map((t) => (
              <TableRow key={t.id} className="hover:bg-muted/50">
                <TableCell><Checkbox checked={getStatus(t.id) === "present"} onCheckedChange={() => toggle(t.id)} /></TableCell>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{t.subject}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TeacherForm({ teacher, onSuccess }: { teacher: Tables<"teachers"> | null; onSuccess: () => void }) {
  const [name, setName] = useState(teacher?.name || "");
  const [subject, setSubject] = useState(teacher?.subject || "");
  const [paymentType, setPaymentType] = useState<"per_lecture" | "fixed">((teacher?.payment_type as "per_lecture" | "fixed") || "per_lecture");
  const [fee, setFee] = useState(teacher?.per_lecture_fee?.toString() || "");
  const [fixedSalary, setFixedSalary] = useState(teacher?.fixed_salary?.toString() || "");

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: TablesInsert<"teachers"> = {
        name: name.trim(),
        subject: subject.trim(),
        per_lecture_fee: Number(fee) || 0,
        payment_type: paymentType,
        fixed_salary: Number(fixedSalary) || 0,
      };
      if (teacher) {
        const { error } = await supabase.from("teachers").update(payload).eq("id", teacher.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("teachers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(teacher ? "Updated" : "Added"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-3">
      <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
      <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} required /></div>
      <div className="space-y-1.5">
        <Label>Payment Type</Label>
        <RadioGroup value={paymentType} onValueChange={(v) => setPaymentType(v as "per_lecture" | "fixed")} className="flex gap-4">
          <div className="flex items-center gap-2"><RadioGroupItem value="per_lecture" id="pt-pl" /><Label htmlFor="pt-pl" className="font-normal cursor-pointer">Per Lecture</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem value="fixed" id="pt-fx" /><Label htmlFor="pt-fx" className="font-normal cursor-pointer">Fixed</Label></div>
        </RadioGroup>
      </div>
      {paymentType === "per_lecture" ? (
        <div className="space-y-1.5"><Label>Per Lecture Fee (₹)</Label><Input type="number" value={fee} onChange={(e) => setFee(e.target.value)} required /></div>
      ) : (
        <div className="space-y-1.5"><Label>Fixed Monthly Salary (₹)</Label><Input type="number" value={fixedSalary} onChange={(e) => setFixedSalary(e.target.value)} required /></div>
      )}
      <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving..." : teacher ? "Update" : "Add"}
      </Button>
    </form>
  );
}

function LectureForm({ teacherId, teachers, defaultYear, onSuccess }: { teacherId: string; teachers: Tables<"teachers">[]; defaultYear: string; onSuccess: () => void }) {
  const teacher = teachers.find((t) => t.id === teacherId);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [subject, setSubject] = useState(teacher?.subject || "");
  const [batch, setBatch] = useState("Morning");

  const mutation = useMutation({
    mutationFn: async () => {
      const subj = subject.trim();
      if (!subj) throw new Error("Subject is required");
      const ay = deriveAcademicYear(date) || defaultYear;
      // Warn (don't block) on duplicates: same teacher + date + subject + batch
      const { data: dupes } = await supabase
        .from("lectures")
        .select("id")
        .eq("teacher_id", teacherId)
        .eq("date", date)
        .eq("subject", subj)
        .eq("batch", batch);
      if (dupes && dupes.length > 0) {
        if (!window.confirm("A lecture with same teacher, date, subject and batch already exists. Log another?")) {
          throw new Error("Cancelled");
        }
      }
      const { error } = await supabase.from("lectures").insert({
        teacher_id: teacherId,
        date,
        subject: subj,
        batch,
        academic_year: ay,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lecture logged"); onSuccess(); },
    onError: (e) => { if (e.message !== "Cancelled") toast.error(e.message); },
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-3">
      <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} required /></div>
      <div className="space-y-1.5">
        <Label>Batch</Label>
        <Select value={batch} onValueChange={setBatch}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{BATCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving..." : "Log"}
      </Button>
    </form>
  );
}
