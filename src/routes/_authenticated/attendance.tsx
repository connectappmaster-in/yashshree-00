import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, X, Copy, Flame } from "lucide-react";
import { format, startOfMonth, endOfMonth, subDays } from "date-fns";
import { useAcademicYear } from "@/lib/academic-year-context";
import { useAuth } from "@/lib/auth-context";
import { studentsReadFrom } from "@/lib/students-source";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

const CLASSES = ["5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
const BATCHES = ["Morning", "Evening"];

function AttendancePage() {
  const { year } = useAcademicYear();
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold font-display">Attendance</h1>
        <Badge variant="outline" className="text-xs">AY {year}</Badge>
      </div>
      <Tabs defaultValue="mark">
        <TabsList>
          <TabsTrigger value="mark">Mark Today</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="mark" className="mt-4">
          <MarkTab />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MarkTab() {
  const queryClient = useQueryClient();
  const { year } = useAcademicYear();
  const { isAdmin } = useAuth();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterClass, setFilterClass] = useState("all");
  const [filterBatch, setFilterBatch] = useState("all");
  const [attendance, setAttendance] = useState<Record<string, "present" | "absent">>({});

  const { data: students = [] } = useQuery({
    queryKey: ["students-active", year, isAdmin],
    queryFn: async () => {
      const { data } = await studentsReadFrom(isAdmin)
        .select("*")
        .eq("academic_year", year)
        .eq("status", "active")
        .order("name");
      return (data as Tables<"students">[]) || [];
    },
  });

  const { data: existingAttendance = [] } = useQuery({
    queryKey: ["attendance", date, year],
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("date", date).eq("academic_year", year);
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

  const getStatus = (id: string): "present" | "absent" => {
    if (attendance[id]) return attendance[id];
    const existing = existingAttendance.find((a) => a.student_id === id);
    return (existing?.status as "present" | "absent") || "absent";
  };

  const setStatus = (id: string, status: "present" | "absent") => {
    setAttendance((prev) => ({ ...prev, [id]: status }));
  };

  const selectAll = () => {
    const next: Record<string, "present" | "absent"> = {};
    filtered.forEach((s) => { next[s.id] = "present"; });
    setAttendance((prev) => ({ ...prev, ...next }));
  };
  const deselectAll = () => {
    const next: Record<string, "present" | "absent"> = {};
    filtered.forEach((s) => { next[s.id] = "absent"; });
    setAttendance((prev) => ({ ...prev, ...next }));
  };

  // Streak per student (consecutive present days ending today within month)
  const streakMap = useMemo(() => {
    const m = new Map<string, number>();
    const byStudent: Record<string, Record<string, string>> = {};
    monthlyAttendance.forEach((a) => {
      if (!byStudent[a.student_id]) byStudent[a.student_id] = {};
      byStudent[a.student_id][a.date] = a.status;
    });
    filtered.forEach((s) => {
      let streak = 0;
      let cursor = new Date(date);
      const monthStartD = startOfMonth(new Date(date));
      while (cursor >= monthStartD) {
        const k = format(cursor, "yyyy-MM-dd");
        if (byStudent[s.id]?.[k] === "present") {
          streak++;
          cursor = subDays(cursor, 1);
        } else break;
      }
      m.set(s.id, streak);
    });
    return m;
  }, [filtered, monthlyAttendance, date]);

  const copyFromYesterday = useMutation({
    mutationFn: async () => {
      // Look back up to 14 days for the most recent date with attendance records
      // (skips weekends/holidays automatically).
      const lookbackStart = format(subDays(new Date(date), 14), "yyyy-MM-dd");
      const lookbackEnd = format(subDays(new Date(date), 1), "yyyy-MM-dd");
      const { data: recent } = await supabase
        .from("attendance")
        .select("date")
        .eq("academic_year", year)
        .gte("date", lookbackStart)
        .lte("date", lookbackEnd)
        .order("date", { ascending: false })
        .limit(1);
      const sourceDate = recent?.[0]?.date;
      if (!sourceDate) return { count: 0, sourceDate: null as string | null };
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", sourceDate)
        .eq("academic_year", year);
      const yMap: Record<string, "present" | "absent"> = {};
      (data || []).forEach((r) => { yMap[r.student_id] = r.status as "present" | "absent"; });
      const draft: Record<string, "present" | "absent"> = {};
      filtered.forEach((s) => {
        if (yMap[s.id]) draft[s.id] = yMap[s.id];
      });
      setAttendance((prev) => ({ ...prev, ...draft }));
      return { count: Object.keys(draft).length, sourceDate };
    },
    onSuccess: async ({ count, sourceDate }) => {
      if (count === 0 || !sourceDate) {
        toast.info("Nothing to copy from the last 14 days");
        return;
      }
      const label = sourceDate === format(subDays(new Date(date), 1), "yyyy-MM-dd")
        ? "yesterday"
        : format(new Date(sourceDate), "dd MMM");
      toast.success(`Copied ${count} entries from ${label}`);
      await logAudit("attendance_copied", "attendance", null, { date, source_date: sourceDate, count });
    },
    onError: (e) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const changedIds = Object.keys(attendance);
      if (changedIds.length === 0) return 0;
      const records = changedIds
        .filter((id) => filtered.some((s) => s.id === id))
        .map((id) => ({ student_id: id, date, status: attendance[id], academic_year: year }));
      if (records.length === 0) return 0;
      // Single batched upsert — one round trip instead of N.
      const { error } = await supabase.from("attendance").upsert(records, { onConflict: "student_id,date" });
      if (error) throw error;
      await logAudit("attendance_marked", "attendance", null, { date, count: records.length });
      return records.length;
    },
    onSuccess: (count) => {
      if (count === 0) { toast.info("No changes to save"); return; }
      toast.success(`Saved (${count} ${count === 1 ? "student" : "students"})`);
      setAttendance({});
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-monthly"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-all"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const presentCount = filtered.filter((s) => getStatus(s.id) === "present").length;
  const monthlyPresentCount = monthlyAttendance.filter((a) => a.status === "present").length;
  const monthlyTotalRecords = monthlyAttendance.length;
  const monthlyPercentage = monthlyTotalRecords > 0 ? Math.round((monthlyPresentCount / monthlyTotalRecords) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs text-muted-foreground">
          Monthly: <span className="font-semibold text-foreground">{monthlyPercentage}%</span> ({monthlyPresentCount}/{monthlyTotalRecords})
        </p>
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
              <Button variant="outline" size="sm" className="text-xs" onClick={() => copyFromYesterday.mutate()} disabled={copyFromYesterday.isPending}>
                <Copy className="h-3 w-3 mr-1" /> Copy yesterday
              </Button>
            </div>
            <div className="text-sm text-muted-foreground ml-auto flex items-center gap-2">
              {Object.keys(attendance).length > 0 && (
                <Badge variant="outline" className="text-xs border-warning text-warning-foreground bg-warning/10">Unsaved changes</Badge>
              )}
              Present: <Badge variant={presentCount > 0 ? "default" : "secondary"} className="ml-1">{presentCount}/{filtered.length}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Streak</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  {(filterClass !== "all" || filterBatch !== "all")
                    ? <>No active students match your filters. <button type="button" onClick={() => { setFilterClass("all"); setFilterBatch("all"); }} className="underline">Clear filters</button></>
                    : "No active students found"}
                </TableCell></TableRow>
              ) : (
                filtered.map((s) => {
                  const status = getStatus(s.id);
                  const streak = streakMap.get(s.id) || 0;
                  const rowTint = status === "present" ? "bg-success/5 hover:bg-success/10" : "bg-destructive/5 hover:bg-destructive/10";
                  return (
                    <TableRow key={s.id} className={rowTint}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.class}</TableCell>
                      <TableCell>{s.batch}</TableCell>
                      <TableCell>
                        {streak >= 3 && (
                          <Badge variant="outline" className="text-xs border-warning text-warning-foreground gap-1">
                            <Flame className="h-3 w-3" />{streak}d
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex rounded-md border overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setStatus(s.id, "present")}
                            className={`px-3 py-1 text-xs font-semibold flex items-center gap-1 transition-colors ${
                              status === "present" ? "bg-success text-success-foreground" : "bg-background hover:bg-muted"
                            }`}
                          >
                            <Check className="h-3 w-3" /> Present
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(s.id, "absent")}
                            className={`px-3 py-1 text-xs font-semibold flex items-center gap-1 border-l transition-colors ${
                              status === "absent" ? "bg-destructive text-destructive-foreground" : "bg-background hover:bg-muted"
                            }`}
                          >
                            <X className="h-3 w-3" /> Absent
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryTab() {
  const { year } = useAcademicYear();
  const { isAdmin } = useAuth();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [openDate, setOpenDate] = useState<string | null>(null);

  const monthStart = format(startOfMonth(new Date(month + "-01")), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date(month + "-01")), "yyyy-MM-dd");

  const { data: records = [] } = useQuery({
    queryKey: ["attendance-history", month, year],
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

  const { data: students = [] } = useQuery({
    queryKey: ["students-min", year, isAdmin],
    queryFn: async () => {
      const { data } = await studentsReadFrom(isAdmin)
        .select("id, name, class")
        .eq("academic_year", year);
      return (data as Array<{ id: string; name: string; class: string }>) || [];
    },
  });
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const byDate = useMemo(() => {
    const m = new Map<string, { present: number; total: number }>();
    records.forEach((r) => {
      const cur = m.get(r.date) || { present: 0, total: 0 };
      cur.total++;
      if (r.status === "present") cur.present++;
      m.set(r.date, cur);
    });
    return Array.from(m.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [records]);

  const dayRoster = openDate
    ? records.filter((r) => r.date === openDate).sort((a, b) => {
        const sa = studentMap.get(a.student_id)?.name || "";
        const sb = studentMap.get(b.student_id)?.name || "";
        return sa.localeCompare(sb);
      })
    : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Month</p>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[160px]" />
            </div>
            <p className="text-xs text-muted-foreground ml-auto">{byDate.length} days logged</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Present</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byDate.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No attendance for this month</TableCell></TableRow>
              ) : byDate.map((d) => {
                const pct = d.total > 0 ? Math.round((d.present / d.total) * 100) : 0;
                return (
                  <TableRow key={d.date} className="cursor-pointer hover:bg-muted/50" onClick={() => setOpenDate(d.date)}>
                    <TableCell className="font-medium">{format(new Date(d.date), "EEE, dd MMM yyyy")}</TableCell>
                    <TableCell className="text-right text-success font-bold">{d.present}</TableCell>
                    <TableCell className="text-right">{d.total}</TableCell>
                    <TableCell className={`text-right font-bold ${pct >= 75 ? "text-success" : pct >= 50 ? "text-warning-foreground" : "text-destructive"}`}>{pct}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!openDate} onOpenChange={(o) => !o && setOpenDate(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openDate && format(new Date(openDate), "EEE, dd MMM yyyy")} — Roster</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Class</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {dayRoster.map((r) => {
                const st = studentMap.get(r.student_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{st?.name || "—"}</TableCell>
                    <TableCell>{st?.class || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={r.status === "present" ? "default" : "secondary"} className="text-xs">{r.status}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
