import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

const CLASSES = ["8th", "9th", "10th", "11th", "12th"];
const BATCHES = ["Morning", "Evening"];

function AttendancePage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterClass, setFilterClass] = useState("all");
  const [filterBatch, setFilterBatch] = useState("all");
  const [attendance, setAttendance] = useState<Record<string, "present" | "absent">>({});

  const { data: students = [] } = useQuery({
    queryKey: ["students-active"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("*").eq("status", "active").order("name");
      return data || [];
    },
  });

  const { data: existingAttendance = [] } = useQuery({
    queryKey: ["attendance", date],
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("date", date);
      return data || [];
    },
  });

  const filtered = students.filter((s) => {
    const matchClass = filterClass === "all" || s.class === filterClass;
    const matchBatch = filterBatch === "all" || s.batch === filterBatch;
    return matchClass && matchBatch;
  });

  const getStatus = (studentId: string): "present" | "absent" => {
    if (attendance[studentId]) return attendance[studentId];
    const existing = existingAttendance.find((a) => a.student_id === studentId);
    return (existing?.status as "present" | "absent") || "absent";
  };

  const toggleAttendance = (studentId: string) => {
    const current = getStatus(studentId);
    setAttendance((prev) => ({ ...prev, [studentId]: current === "present" ? "absent" : "present" }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const records = filtered.map((s) => ({
        student_id: s.id,
        date,
        status: getStatus(s.id),
      }));
      
      for (const record of records) {
        const { error } = await supabase.from("attendance").upsert(record, { onConflict: "student_id,date" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Attendance saved");
      setAttendance({});
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const presentCount = filtered.filter((s) => getStatus(s.id) === "present").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold font-display">Attendance</h1>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save Attendance"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Date</p>
              <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setAttendance({}); }} className="w-[160px]" />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterBatch} onValueChange={setFilterBatch}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Batch" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {BATCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">
              Present: <span className="font-bold text-foreground">{presentCount}/{filtered.length}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Present</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Batch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No students found</TableCell></TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Checkbox
                        checked={getStatus(s.id) === "present"}
                        onCheckedChange={() => toggleAttendance(s.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.class}</TableCell>
                    <TableCell>{s.batch}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
