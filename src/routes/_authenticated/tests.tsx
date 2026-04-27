import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { useAcademicYear } from "@/lib/academic-year-context";
import { useAuth } from "@/lib/auth-context";
import { studentsReadFrom } from "@/lib/students-source";
import { logAudit } from "@/lib/audit";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/_authenticated/tests")({
  component: TestsPage,
  errorComponent: RouteError,
});

const CLASSES = ["5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

function TestsPage() {
  const queryClient = useQueryClient();
  const { year } = useAcademicYear();
  const { isAdmin } = useAuth();
  const [filterStandard, setFilterStandard] = useState("all");
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [editTest, setEditTest] = useState<Tables<"tests"> | null>(null);

  const { data: tests = [] } = useQuery({
    queryKey: ["tests", year],
    queryFn: async () => {
      const { data } = await supabase.from("tests").select("*").eq("academic_year", year).order("test_date", { ascending: false });
      return data || [];
    },
  });

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

  const { data: results = [] } = useQuery({
    queryKey: ["test-results", "by-test", selectedTestId],
    queryFn: async () => {
      if (!selectedTestId) return [];
      const { data } = await supabase.from("test_results").select("*").eq("test_id", selectedTestId);
      return data || [];
    },
    enabled: !!selectedTestId,
  });

  const deleteTestMut = useMutation({
    mutationFn: async (id: string) => {
      const target = tests.find((t) => t.id === id);
      // test_results cascade-delete via FK; just remove the test
      const { error } = await supabase.from("tests").delete().eq("id", id);
      if (error) throw error;
      await logAudit("delete", "test", id, { name: target?.name, standard: target?.standard, subject: target?.subject });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tests"] });
      queryClient.invalidateQueries({ queryKey: ["test-results", "by-test"] });
      if (selectedTestId) setSelectedTestId(null);
      toast.success("Test deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredTests = tests.filter((t) => filterStandard === "all" || t.standard === filterStandard);
  const selectedTest = tests.find((t) => t.id === selectedTestId);
  const standardStudents = selectedTest ? students.filter((s) => s.class === selectedTest.standard) : [];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold font-display">Test Reports</h1>
          <Badge variant="outline" className="text-xs">AY {year}</Badge>
        </div>
        <Dialog open={testDialogOpen} onOpenChange={(o) => { setTestDialogOpen(o); if (!o) setEditTest(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
              <Plus className="h-4 w-4 mr-1" />Add Test
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editTest ? "Edit" : "New"} Test</DialogTitle></DialogHeader>
            <TestForm test={editTest} defaultYear={year} onSuccess={() => {
              setTestDialogOpen(false);
              setEditTest(null);
              queryClient.invalidateQueries({ queryKey: ["tests"] });
            }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="w-full lg:w-[35%] space-y-3">
          <Card><CardContent className="p-3">
            <Select value={filterStandard} onValueChange={setFilterStandard}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Standards</SelectItem>
                {CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent></Card>

          <Card><CardContent className="p-0">
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              {filteredTests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {filterStandard !== "all"
                    ? <>No tests for {filterStandard}. <button type="button" onClick={() => setFilterStandard("all")} className="underline">Clear filter</button></>
                    : "No tests yet"}
                </p>
              ) : filteredTests.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTestId(t.id)}
                  className={`px-3 py-2 border-b cursor-pointer hover:bg-muted/50 transition-colors text-sm ${selectedTestId === t.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.standard} • {t.subject} • {format(new Date(t.test_date), "dd MMM")}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">/{Number(t.max_marks)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </div>

        <div className="w-full lg:w-[65%]">
          {!selectedTest ? (
            <Card className="h-full flex items-center justify-center min-h-[300px]">
              <p className="text-muted-foreground text-sm">Select a test to enter marks</p>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold font-display">{selectedTest.name}</h2>
                    <p className="text-sm text-muted-foreground">{selectedTest.standard} • {selectedTest.subject} • {format(new Date(selectedTest.test_date), "dd MMM yyyy")} • Max {Number(selectedTest.max_marks)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditTest(selectedTest); setTestDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete test?</AlertDialogTitle>
                          <AlertDialogDescription>This will delete all results too.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteTestMut.mutate(selectedTest.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <MarksEntryTable
                  test={selectedTest}
                  students={standardStudents}
                  results={results}
                  onSaved={() => {
                    queryClient.invalidateQueries({ queryKey: ["test-results", "by-test", selectedTestId] });
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function MarksEntryTable({ test, students, results, onSaved }: { test: Tables<"tests">; students: Tables<"students">[]; results: Tables<"test_results">[]; onSaved: () => void }) {
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [overConfirmOpen, setOverConfirmOpen] = useState(false);

  // Reset draft marks whenever the selected test changes — prevents cross-test contamination
  useEffect(() => { setMarks({}); }, [test.id]);

  // Pass mark threshold from app_settings (default 35).
  const { data: passMark = 35 } = useQuery({
    queryKey: ["app_settings", "pass_mark"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "pass_mark").maybeSingle();
      const v = data?.value as { percent?: number } | number | null;
      if (typeof v === "number") return v;
      if (v && typeof v === "object" && typeof v.percent === "number") return v.percent;
      return 35;
    },
  });

  const initialMarks = (sid: string) => {
    if (marks[sid] !== undefined) return marks[sid];
    const r = results.find((x) => x.student_id === sid);
    return r ? String(Number(r.marks_obtained)) : "";
  };

  // Compute "over cap" entries (used for the AlertDialog confirm).
  const overEntries = useMemo(() => {
    const max = Number(test.max_marks);
    return students.filter((s: Tables<"students">) => {
      const v = initialMarks(s.id);
      return v !== "" && Number(v) > max;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks, results, students, test.max_marks]);

  const performSave = async () => {
    const max = Number(test.max_marks);
    // Records to upsert (entered marks)
    const toUpsert = students
      .filter((s) => initialMarks(s.id) !== "")
      .map((s) => ({
        test_id: test.id,
        student_id: s.id,
        marks_obtained: Math.min(max, Number(initialMarks(s.id)) || 0),
      }));
    // Records to delete: previously had marks but user cleared them
    const toDelete = students
      .filter((s) => initialMarks(s.id) === "" && results.some((r) => r.student_id === s.id))
      .map((s) => s.id);
    if (toUpsert.length > 0) {
      // Single batched upsert — one round trip instead of N.
      const { error } = await supabase.from("test_results").upsert(toUpsert, { onConflict: "test_id,student_id" });
      if (error) throw error;
    }
    if (toDelete.length > 0) {
      const { error } = await supabase.from("test_results").delete().eq("test_id", test.id).in("student_id", toDelete);
      if (error) throw error;
    }
    await logAudit("test_marks_saved", "test_result", test.id, {
      test_name: test.name,
      saved: toUpsert.length,
      cleared: toDelete.length,
    });
  };

  const saveMut = useMutation({
    mutationFn: performSave,
    onSuccess: () => { toast.success("Marks saved"); setMarks({}); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const handleSaveClick = () => {
    if (overEntries.length > 0) {
      setOverConfirmOpen(true);
      return;
    }
    saveMut.mutate();
  };

  if (students.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No active students for {test.standard}</p>;
  }

  return (
    <>
      <div className="max-h-[calc(100vh-360px)] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead className="w-32">Marks</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => {
              const val = initialMarks(s.id);
              const num = Number(val);
              const pct = val !== "" && !isNaN(num) ? Math.round((num / Number(test.max_marks)) * 100) : null;
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-sm">{s.name}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={Number(test.max_marks)}
                      value={val}
                      onChange={(e) => setMarks((m) => ({ ...m, [s.id]: e.target.value }))}
                      className="h-8 text-sm w-24"
                    />
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {pct !== null ? <span className={pct >= passMark ? "text-success font-bold" : "text-destructive font-bold"}>{pct}%</span> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Button onClick={handleSaveClick} disabled={saveMut.isPending} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold">
        {saveMut.isPending ? "Saving..." : "Save Marks"}
      </Button>

      <AlertDialog open={overConfirmOpen} onOpenChange={setOverConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Some marks exceed the maximum</AlertDialogTitle>
            <AlertDialogDescription>
              {overEntries.length} student{overEntries.length === 1 ? "" : "s"} have marks above {test.max_marks}: {overEntries.map((s) => s.name).join(", ")}. They will be capped at {test.max_marks}. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setOverConfirmOpen(false); saveMut.mutate(); }}>
              Yes, save (capped)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TestForm({ test, defaultYear, onSuccess }: { test: Tables<"tests"> | null; defaultYear: string; onSuccess: () => void }) {
  const [name, setName] = useState(test?.name || "");
  const [standard, setStandard] = useState(test?.standard || "10th");
  const [subject, setSubject] = useState(test?.subject || "");
  const [testDate, setTestDate] = useState(test?.test_date || new Date().toISOString().split("T")[0]);
  const [maxMarks, setMaxMarks] = useState(test?.max_marks?.toString() || "100");

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        standard,
        subject: subject.trim(),
        test_date: testDate,
        max_marks: Number(maxMarks) || 100,
        academic_year: defaultYear,
      };
      if (test) {
        const { error } = await supabase.from("tests").update(payload).eq("id", test.id);
        if (error) throw error;
        await logAudit("update", "test", test.id, payload);
      } else {
        const { data: ins, error } = await supabase.from("tests").insert(payload).select("id").single();
        if (error) throw error;
        await logAudit("create", "test", ins?.id ?? null, payload);
      }
    },
    onSuccess: () => { toast.success(test ? "Updated" : "Created"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
      <div className="space-y-1.5"><Label>Test Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Weekly Test 1" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Standard</Label>
          <Select value={standard} onValueChange={setStandard}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} required /></div>
        <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Max Marks</Label><Input type="number" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} required /></div>
      </div>
      <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={mut.isPending}>
        {mut.isPending ? "Saving..." : test ? "Update" : "Create Test"}
      </Button>
    </form>
  );
}
