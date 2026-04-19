import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MessageCircle, IndianRupee, Send } from "lucide-react";
import { format } from "date-fns";
import { useAcademicYear, deriveAcademicYear } from "@/lib/academic-year-context";

export const Route = createFileRoute("/_authenticated/fees")({
  component: FeesPage,
});

const CLASSES = ["5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

function FeesPage() {
  const queryClient = useQueryClient();
  const { year } = useAcademicYear();
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [pendingOnly, setPendingOnly] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentStudentId, setPaymentStudentId] = useState<string | null>(null);

  const { data: students = [] } = useQuery({
    queryKey: ["students", year],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("*").eq("academic_year", year).eq("status", "active").order("name");
      return data || [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", year],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*").eq("academic_year", year);
      return data || [];
    },
  });

  const studentFees = students.map((s) => {
    const sp = payments.filter((p) => p.student_id === s.id);
    const paid = sp.reduce((sum, p) => sum + Number(p.amount), 0);
    const total = Number(s.total_fees) - Number(s.discount);
    return { ...s, paid, total, remaining: total - paid };
  });

  const filtered = studentFees.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.mobile.includes(search);
    const matchClass = filterClass === "all" || s.class === filterClass;
    const matchPending = !pendingOnly || s.remaining > 0;
    return matchSearch && matchClass && matchPending;
  }).sort((a, b) => b.remaining - a.remaining);

  const totalPending = filtered.reduce((sum, s) => sum + Math.max(0, s.remaining), 0);
  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  const sendReminder = async (s: typeof studentFees[0]) => {
    const msg = `Hello ${s.name}, your pending fees for Yashshree Classes is ₹${s.remaining.toLocaleString("en-IN")}. Please pay before ${s.fee_due_day}th of this month. Thank you.`;
    window.open(`https://wa.me/91${s.mobile}?text=${encodeURIComponent(msg)}`, "_blank");
    await supabase.from("whatsapp_logs").insert({ student_id: s.id, message: msg, type: "reminder" });
    toast.success(`Reminder sent to ${s.name}`);
  };

  const sendBulk = () => {
    const pending = filtered.filter((s) => s.remaining > 0);
    if (pending.length === 0) { toast.info("No pending fees"); return; }
    pending.forEach((s) => {
      const msg = `Hello ${s.name}, pending: ₹${s.remaining.toLocaleString("en-IN")}.`;
      supabase.from("whatsapp_logs").insert({ student_id: s.id, message: msg, type: "reminder" });
    });
    const first = pending[0];
    window.open(`https://wa.me/91${first.mobile}?text=${encodeURIComponent(`Hello ${first.name}, pending: ₹${first.remaining.toLocaleString("en-IN")}.`)}`, "_blank");
    toast.success(`Bulk reminders logged for ${pending.length} students`);
  };

  const openPayment = (id: string) => { setPaymentStudentId(id); setPaymentDialogOpen(true); };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold font-display">Fees</h1>
          <Badge variant="outline" className="text-xs">AY {year}</Badge>
        </div>
        <Button variant="outline" className="border-success text-success hover:bg-success/10 font-semibold" onClick={sendBulk}>
          <Send className="h-4 w-4 mr-1" />Bulk Remind
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Students</p>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Collected</p>
          <p className="text-2xl font-bold text-success">₹{totalCollected.toLocaleString("en-IN")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-destructive">₹{totalPending.toLocaleString("en-IN")}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name / mobile..." className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-[120px] h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Switch checked={pendingOnly} onCheckedChange={setPendingOnly} className="data-[state=checked]:bg-destructive" />
              <span className="text-xs font-medium text-muted-foreground">Pending only</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No students</TableCell></TableRow>
              ) : filtered.map((s) => (
                <TableRow key={s.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-xs">{s.class} {s.medium}</TableCell>
                  <TableCell className="text-right">₹{s.total.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right text-success">₹{s.paid.toLocaleString("en-IN")}</TableCell>
                  <TableCell className={`text-right font-bold ${s.remaining > 0 ? "text-destructive" : "text-success"}`}>
                    {s.remaining > 0 ? `₹${s.remaining.toLocaleString("en-IN")}` : "Paid ✓"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPayment(s.id)} title="Add payment">
                        <IndianRupee className="h-4 w-4 text-secondary-foreground" />
                      </Button>
                      {s.remaining > 0 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => sendReminder(s)} title="Send reminder">
                          <MessageCircle className="h-4 w-4 text-success" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Payment</DialogTitle></DialogHeader>
          {paymentStudentId && (
            <PaymentForm
              studentId={paymentStudentId}
              defaultYear={year}
              onSuccess={() => {
                setPaymentDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ["payments"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
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
        <Label>Mode</Label>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
            <SelectItem value="bank">Bank</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving..." : "Record Payment"}
      </Button>
    </form>
  );
}
