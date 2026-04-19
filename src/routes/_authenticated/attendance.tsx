import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useAcademicYear } from "@/lib/academic-year-context";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

const CLASSES = ["5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
const BATCHES = ["Morning", "Evening"];

function AttendancePage() {
  const queryClient = useQueryClient();
  const { year } = useAcademicYear();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterClass, setFilterClass] = useState("all");
  const [filterBatch, setFilterBatch] = useState("all");
  const [attendance, setAttendance] = useState<Record<string, "present" | "absent">>({});

  const { data: students = [] } = useQuery({
    queryKey: ["students-active", year],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("*").eq("academic_year", year).eq("status", "active").order("name");
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

  const monthStart = format(startOfMonth(new Date(date)), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date(date)), "yyyy-MM-dd");

  const { data: monthlyAttendance = [] } = useQuery({
    queryKey: ["attendance-monthly", monthStart, year],
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("academic_year", year).gte("date", monthStart).lte("date", monthEnd);
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

  const selectAll = () => {
    const newAtt: Record<string, "present" | "absent"> = {};
    filtered.forEach((s) => { newAtt[s.id] = "present"; });
    setAttendance((prev) => ({ ...prev, ...newAtt }));
  };

  const deselectAll = () => {
    const newAtt: Record<string, "present" | "absent"> = {};
    filtered.forEach((s) => { newAtt[s.id] = "absent"; });
    setAttendance((prev) => ({ ...prev, ...newAtt }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const records = filtered.map((s) => ({
        student_id: s.id,
        date,
        status: getStatus(s.id),
        academic_year: year,
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
      queryClient.invalidateQueries({ queryKey: ["attendance-monthly"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const presentCount = filtered.filter((s) => getStatus(s.id) === "present").length;
  const totalMonthDays = new Set(monthlyAttendance.map((a) => a.date)).size;
  const monthlyPresentCount = monthlyAttendance.filter((a) => a.status === "present").length;
  const monthlyTotalRecords = monthlyAttendance.length;
  const monthlyPercentage = monthlyTotalRecords > 0 ? Math.round((monthlyPresentCount / monthlyTotalRecords) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display">Attendance</h1>
            <Badge variant="outline" className="text-xs">AY {year}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monthly: <span className="font-semibold text-foreground">{monthlyPercentage}%</span> ({monthlyPresentCount}/{monthlyTotalRecords} records across {totalMonthDays} days)
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold">
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
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="text-xs" onClick={selectAll}>All Present</Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={deselectAll}>All Absent</Button>
            </div>
            <div className="text-sm text-muted-foreground ml-auto">
              Present: <Badge variant={presentCount > 0 ? "default" : "secondary"} className="ml-1">{presentCount}/{filtered.length}</Badge>
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
                  <TableRow key={s.id} className="hover:bg-muted/50">
                    <TableCell><Checkbox checked={getStatus(s.id) === "present"} onCheckedChange={() => toggleAttendance(s.id)} /></TableCell>
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
