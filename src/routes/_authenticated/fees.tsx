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
import { safeNum, buildWhatsappUrl, nextDueLabel } from "@/lib/format";
import { AdminGuard } from "@/components/AdminGuard";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/fees")({
  component: () => <AdminGuard><FeesPage /></AdminGuard>,
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

  // All payments (across years) so a student who paid earlier still shows correct remaining
  const { data: payments = [] } = useQuery({
    queryKey: ["payments-all"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*");
      return data || [];
    },
  });

  // AY-only payments for the "Collected this year" total card
  const { data: ayPayments = [] } = useQuery({
    queryKey: ["payments", year],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*").eq("academic_year", year);
      return data || [];
    },
  });

  const studentFees = students.map((s) => {
    const sp = payments.filter((p) => p.student_id === s.id);
    const paid = sp.reduce((sum, p) => sum + safeNum(p.amount), 0);
    const total = safeNum(s.total_fees) - safeNum(s.discount);
    return { ...s, paid, total, remaining: total - paid };
  });

  const filtered = studentFees.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.mobile.includes(search);
    const matchClass = filterClass === "all" || s.class === filterClass;
    const matchPending = !pendingOnly || s.remaining > 0;
    return matchSearch && matchClass && matchPending;
  }).sort((a, b) => b.remaining - a.remaining);

  const totalPending = filtered.reduce((sum, s) => sum + Math.max(0, s.remaining), 0);
  const totalCollected = ayPayments.reduce((sum, p) => sum + safeNum(p.amount), 0);

  const sendReminder = async (s: typeof studentFees[0]) => {
    const msg = `Hello ${s.name}, your pending fees for Yashshree Classes is ₹${s.remaining.toLocaleString("en-IN")}. Please pay before ${nextDueLabel(s.fee_due_day)}. Thank you.`;
    const url = buildWhatsappUrl(s.mobile, msg);
    if (!url) { toast.error(`Invalid mobile for ${s.name}`); return; }
    window.open(url, "_blank");
    await supabase.from("whatsapp_logs").insert({ student_id: s.id, message: msg, type: "reminder" });
    await logAudit("whatsapp_sent", "whatsapp", s.id, { type: "reminder", remaining: s.remaining });
    toast.success(`Reminder sent to ${s.name}`);
  };

  // Bulk: log every reminder, open one tab at a time with a 600ms delay so the browser doesn't block popups.
  const sendBulk = async () => {
    const pending = filtered.filter((s) => s.remaining > 0 && buildWhatsappUrl(s.mobile, "x"));
    if (pending.length === 0) { toast.info("No pending fees with valid mobiles"); return; }
    const confirmed = window.confirm(
      `This will log ${pending.length} WhatsApp reminders and open ${pending.length} tabs (one per student). Your browser may block tabs after the first — allow popups for this site. Continue?`
    );
    if (!confirmed) return;
    let idx = 0;
    for (const s of pending) {
      const msg = `Hello ${s.name}, your pending fees for Yashshree Classes is ₹${s.remaining.toLocaleString("en-IN")}. Please pay before ${nextDueLabel(s.fee_due_day)}. Thank you.`;
      const url = buildWhatsappUrl(s.mobile, msg)!;
      // Stagger opens so popup blocker is friendlier
      setTimeout(() => window.open(url, "_blank"), idx * 600);
      await supabase.from("whatsapp_logs").insert({ student_id: s.id, message: msg, type: "reminder" });
      idx++;
    }
    await logAudit("whatsapp_broadcast", "whatsapp", null, { count: pending.length, type: "fee_reminder" });
    toast.success(`${pending.length} reminders queued.`);
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
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                  {(search || filterClass !== "all" || pendingOnly)
                    ? <>No students match your filters. <button type="button" onClick={() => { setSearch(""); setFilterClass("all"); setPendingOnly(false); }} className="underline">Clear filters</button></>
                    : "No students"}
                </TableCell></TableRow>
              ) : filtered.map((s) => (
                <TableRow key={s.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-xs">{s.class} • {(s as any).board} {s.medium}</TableCell>
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
              studentName={studentFees.find((s) => s.id === paymentStudentId)?.name || ""}
              remaining={studentFees.find((s) => s.id === paymentStudentId)?.remaining || 0}
              defaultYear={year}
              onSuccess={() => {
                setPaymentDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ["payments"] });
                queryClient.invalidateQueries({ queryKey: ["payments-all"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentForm({ studentId, studentName, remaining, defaultYear, onSuccess }: { studentId: string; studentName: string; remaining: number; defaultYear: string; onSuccess: () => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [mode, setMode] = useState("cash");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const amt = safeNum(amount);
      if (amt <= 0) throw new Error("Amount must be greater than 0");
      if (remaining > 0 && amt > remaining) {
        const ok = window.confirm(`Amount ₹${amt.toLocaleString("en-IN")} exceeds remaining ₹${remaining.toLocaleString("en-IN")}. Record anyway?`);
        if (!ok) throw new Error("Cancelled");
      }
      const ay = deriveAcademicYear(date) || defaultYear;
      const { data: ins, error } = await supabase.from("payments").insert({
        student_id: studentId,
        amount: amt,
        payment_date: date,
        payment_mode: mode,
        notes: notes || null,
        academic_year: ay,
      }).select("id").single();
      if (error) throw error;
      await logAudit("payment_recorded", "payment", ins?.id ?? null, { student_id: studentId, student_name: studentName, amount: amt, mode, date });
      return { amt, date, mode, notes };
    },
    onSuccess: () => { toast.success("Payment recorded"); onSuccess(); },
    onError: (e) => { if (e.message !== "Cancelled") toast.error(e.message); },
  });

  const printReceipt = () => {
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    const amt = safeNum(amount);
    win.document.write(`
      <html><head><title>Receipt - ${studentName}</title>
      <style>body{font-family:system-ui;padding:24px;max-width:340px;margin:auto;color:#222}h1{margin:0 0 4px;font-size:18px}h2{font-size:14px;margin:0 0 16px;color:#666;font-weight:normal}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:6px 0;border-bottom:1px dashed #ccc}.lbl{color:#666}.amt{font-size:22px;font-weight:bold;text-align:center;padding:16px;border:2px dashed #888;border-radius:8px;margin:12px 0}.foot{text-align:center;font-size:11px;color:#888;margin-top:24px}</style>
      </head><body>
      <h1>Yashshree Coaching Classes</h1>
      <h2>Payment Receipt</h2>
      <div class="amt">Rs. ${amt.toLocaleString("en-IN")}</div>
      <table>
        <tr><td class="lbl">Student</td><td style="text-align:right;font-weight:600">${studentName}</td></tr>
        <tr><td class="lbl">Date</td><td style="text-align:right">${date}</td></tr>
        <tr><td class="lbl">Mode</td><td style="text-align:right;text-transform:capitalize">${mode}</td></tr>
        ${notes ? `<tr><td class="lbl">Notes</td><td style="text-align:right">${notes}</td></tr>` : ""}
        <tr><td class="lbl">Receipt #</td><td style="text-align:right">${Date.now().toString().slice(-8)}</td></tr>
      </table>
      <p class="foot">Thank you. This is a computer-generated receipt.</p>
      <script>window.onload=()=>setTimeout(()=>window.print(),200)</script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-3">
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground">Remaining: <span className="font-semibold text-destructive">₹{remaining.toLocaleString("en-IN")}</span></p>
      )}
      <div className="space-y-1.5"><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min={1} step="0.01" /></div>
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
      <div className="flex gap-2">
        <Button type="submit" className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Record Payment"}
        </Button>
        <Button type="button" variant="outline" onClick={printReceipt} disabled={!amount}>Print</Button>
      </div>
    </form>
  );
}
