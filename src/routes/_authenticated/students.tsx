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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
});

const CLASSES = ["8th", "9th", "10th", "11th", "12th"];
const MEDIUMS = ["Hindi", "English"];
const SUBJECTS_BY_CLASS: Record<string, string[]> = {
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
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterMedium, setFilterMedium] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Tables<"students"> | null>(null);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Student deleted");
    },
  });

  const filtered = students.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.mobile.includes(search);
    const matchClass = filterClass === "all" || s.class === filterClass;
    const matchMedium = filterMedium === "all" || s.medium === filterMedium;
    return matchSearch && matchClass && matchMedium;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold font-display">Students</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditStudent(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />Add Student</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editStudent ? "Edit Student" : "Add New Student"}</DialogTitle>
            </DialogHeader>
            <StudentForm
              student={editStudent}
              onSuccess={() => {
                setDialogOpen(false);
                setEditStudent(null);
                queryClient.invalidateQueries({ queryKey: ["students"] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name or mobile..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterMedium} onValueChange={setFilterMedium}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Medium" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Medium</SelectItem>
                {MEDIUMS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Medium</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Fees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No students found</TableCell></TableRow>
                ) : (
                  filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.mobile}</TableCell>
                      <TableCell>{s.class}</TableCell>
                      <TableCell>{s.medium}</TableCell>
                      <TableCell>{s.batch}</TableCell>
                      <TableCell>₹{(Number(s.total_fees) - Number(s.discount)).toLocaleString("en-IN")}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditStudent(s); setDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {s.name}?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete the student and all related data.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
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
  );
}

function StudentForm({ student, onSuccess }: { student: Tables<"students"> | null; onSuccess: () => void }) {
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
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: TablesInsert<"students"> = {
        name: form.name.trim(),
        mobile: form.mobile.trim(),
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

  const toggleSubject = (sub: string) => {
    setForm((f) => ({
      ...f,
      subjects: f.subjects.includes(sub) ? f.subjects.filter((s) => s !== sub) : [...f.subjects, sub],
    }));
  };

  const toggleDay = (day: string) => {
    setForm((f) => ({
      ...f,
      lecture_days: f.lecture_days.includes(day) ? f.lecture_days.filter((d) => d !== day) : [...f.lecture_days, day],
    }));
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <div className="space-y-1.5">
          <Label>Mobile</Label>
          <Input value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} required maxLength={10} />
        </div>
        <div className="space-y-1.5">
          <Label>Admission Date</Label>
          <Input type="date" value={form.admission_date} onChange={(e) => setForm((f) => ({ ...f, admission_date: e.target.value }))} />
        </div>
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
        <div className="space-y-1.5">
          <Label>Fee Due Day (of month)</Label>
          <Input type="number" min={1} max={28} value={form.fee_due_day} onChange={(e) => setForm((f) => ({ ...f, fee_due_day: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Total Fees (₹)</Label>
          <Input type="number" value={form.total_fees} onChange={(e) => setForm((f) => ({ ...f, total_fees: e.target.value }))} required />
        </div>
        <div className="space-y-1.5">
          <Label>Discount (₹)</Label>
          <Input type="number" value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Subjects</Label>
        <div className="flex flex-wrap gap-2">
          {availableSubjects.map((sub) => (
            <Badge
              key={sub}
              variant={form.subjects.includes(sub) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleSubject(sub)}
            >
              {sub}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Lecture Days</Label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <Badge
              key={day}
              variant={form.lecture_days.includes(day) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleDay(day)}
            >
              {day}
            </Badge>
          ))}
        </div>
      </div>

      <div className="pt-2 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Final Fees: <span className="font-bold text-foreground">₹{Math.max(0, finalFees).toLocaleString("en-IN")}</span>
        </p>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : student ? "Update" : "Add Student"}
        </Button>
      </div>
    </form>
  );
}
