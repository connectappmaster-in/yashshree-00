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
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/teachers")({
  component: TeachersPage,
});

const BATCHES = ["Morning", "Evening"];

function TeachersPage() {
  const queryClient = useQueryClient();
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
    queryKey: ["lectures", selectedMonth],
    queryFn: async () => {
      const { data } = await supabase.from("lectures").select("*").gte("date", monthStart).lte("date", monthEnd).order("date", { ascending: false });
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
      toast.success("Teacher deleted");
    },
  });

  const teacherStats = teachers.map((t) => {
    const teacherLectures = lectures.filter((l) => l.teacher_id === t.id);
    const salary = teacherLectures.length * Number(t.per_lecture_fee);
    return { ...t, lectureCount: teacherLectures.length, salary };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold font-display">Teachers</h1>
        <div className="flex gap-2">
          <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-[160px]" />
          <Dialog open={teacherDialogOpen} onOpenChange={(open) => { setTeacherDialogOpen(open); if (!open) setEditTeacher(null); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />Add Teacher</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="font-display">{editTeacher ? "Edit Teacher" : "Add Teacher"}</DialogTitle>
              </DialogHeader>
              <TeacherForm
                teacher={editTeacher}
                onSuccess={() => {
                  setTeacherDialogOpen(false);
                  setEditTeacher(null);
                  queryClient.invalidateQueries({ queryKey: ["teachers"] });
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">
            Monthly Summary — {format(new Date(selectedMonth + "-01"), "MMMM yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right">Per Lecture</TableHead>
                <TableHead className="text-right">Lectures</TableHead>
                <TableHead className="text-right">Salary</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teacherStats.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.subject}</TableCell>
                  <TableCell className="text-right">₹{Number(t.per_lecture_fee).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">{t.lectureCount}</TableCell>
                  <TableCell className="text-right font-bold">₹{t.salary.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setLectureTeacherId(t.id); setLectureDialogOpen(true); }} title="Log Lecture">
                        <BookOpen className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditTeacher(t); setTeacherDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
        </CardContent>
      </Card>

      {/* Log Lecture Dialog */}
      <Dialog open={lectureDialogOpen} onOpenChange={setLectureDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Log Lecture</DialogTitle>
          </DialogHeader>
          {lectureTeacherId && (
            <LectureForm
              teacherId={lectureTeacherId}
              teachers={teachers}
              onSuccess={() => {
                setLectureDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ["lectures"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeacherForm({ teacher, onSuccess }: { teacher: Tables<"teachers"> | null; onSuccess: () => void }) {
  const [name, setName] = useState(teacher?.name || "");
  const [subject, setSubject] = useState(teacher?.subject || "");
  const [fee, setFee] = useState(teacher?.per_lecture_fee?.toString() || "");

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: TablesInsert<"teachers"> = { name: name.trim(), subject: subject.trim(), per_lecture_fee: Number(fee) || 0 };
      if (teacher) {
        const { error } = await supabase.from("teachers").update(payload).eq("id", teacher.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("teachers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(teacher ? "Teacher updated" : "Teacher added");
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-3">
      <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
      <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} required /></div>
      <div className="space-y-1.5"><Label>Per Lecture Fee (₹)</Label><Input type="number" value={fee} onChange={(e) => setFee(e.target.value)} required /></div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : teacher ? "Update" : "Add Teacher"}</Button>
    </form>
  );
}

function LectureForm({ teacherId, teachers, onSuccess }: { teacherId: string; teachers: Tables<"teachers">[]; onSuccess: () => void }) {
  const teacher = teachers.find((t) => t.id === teacherId);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [subject, setSubject] = useState(teacher?.subject || "");
  const [batch, setBatch] = useState("Morning");

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lectures").insert({
        teacher_id: teacherId,
        date,
        subject: subject.trim(),
        batch,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lecture logged");
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
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
      <Button type="submit" className="w-full" disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : "Log Lecture"}</Button>
    </form>
  );
}
