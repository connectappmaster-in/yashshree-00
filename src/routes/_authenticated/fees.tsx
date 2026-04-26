import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MessageCircle, IndianRupee, Send, Download, History, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useAcademicYear, deriveAcademicYear } from "@/lib/academic-year-context";
import { safeNum, sanitizeMobile, buildWhatsappUrl, nextDueLabel, inr } from "@/lib/format";
import { RouteError } from "@/components/RouteError";
import { logAudit } from "@/lib/audit";
import { exportCSV } from "@/lib/export-utils";
import { requireAdmin } from "@/lib/route-guards";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/fees")({
  beforeLoad: requireAdmin,
  component: FeesPage,
  errorComponent: RouteError,
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
  const [historyStudentId, setHistoryStudentId] = useState<string | null>(null);

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
      const { data } = await supabase
        .from("payments")
        .select("id, student_id, amount, payment_date, payment_mode, academic_year, notes")
        .order("payment_date", { ascending: false });
      return data || [];
    },
  });

  // AY-only payments for the "Collected this year" total card
  const { data: ayPayments = [] } = useQuery({
    queryKey: ["payments", year],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, amount")
        .eq("academic_year", year);
      return data || [];
    },
  });

  const studentFees = useMemo(() => students.map((s) => {
    const sp = payments.filter((p) => p.student_id === s.id);
    const paid = sp.reduce((sum, p) => sum + safeNum(p.amount), 0);
    const total = safeNum(s.total_fees) - safeNum(s.discount);
    return { ...s, paid, total, remaining: total - paid };
  }), [students, payments]);

  const filtered = useMemo(() => studentFees.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.mobile.includes(search);
    const matchClass = filterClass === "all" || s.class === filterClass;
    const matchPending = !pendingOnly || s.remaining > 0;
    return matchSearch && matchClass && matchPending;
  }).sort((a, b) => b.remaining - a.remaining), [studentFees, search, filterClass, pendingOnly]);

  const totalPending = useMemo(() => filtered.reduce((sum, s) => sum + Math.max(0, s.remaining), 0), [filtered]);
  const totalCollected = useMemo(() => ayPayments.reduce((sum, p) => sum + safeNum(p.amount), 0), [ayPayments]);

  const sendReminder = async (s: typeof studentFees[0]) => {
    const msg = `Hello ${s.name}, your pending fees for Yashshree Classes is ${inr(s.remaining)}. Please pay before ${nextDueLabel(s.fee_due_day)}. Thank you.`;
    const url = buildWhatsappUrl(s.mobile, msg);
    if (!url) { toast.error(`Invalid mobile for ${s.name}`); return; }
    window.open(url, "_blank");
    await supabase.from("whatsapp_logs").insert({ student_id: s.id, message: msg, type: "reminder" });
    await logAudit("whatsapp_sent", "whatsapp", s.id, { type: "reminder", remaining: s.remaining });
    toast.success(`Reminder sent to ${s.name}`);
  };

  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  // Cheap mobile-validity check via sanitizeMobile (no URL build/encode round-trip)
  const bulkPending = useMemo(
    () => filtered.filter((s) => s.remaining > 0 && sanitizeMobile(s.mobile) !== null),
    [filtered],
  );

  // Sequential queue: open + log one student, wait 700ms, repeat. No setTimeout that could
  // fire after navigation. Toast progress so the user knows it's running.
  const runBulkSend = async () => {
    setBulkConfirmOpen(false);
    setBulkSending(true);
    let sent = 0;
    const total = bulkPending.length;
    const progressId = toast.loading(`Sending 0 / ${total}…`);
    try {
      for (const s of bulkPending) {
        const msg = `Hello ${s.name}, your pending fees for Yashshree Classes is ${inr(s.remaining)}. Please pay before ${nextDueLabel(s.fee_due_day)}. Thank you.`;
        const url = buildWhatsappUrl(s.mobile, msg);
        if (!url) continue;
        window.open(url, "_blank");
        await supabase.from("whatsapp_logs").insert({ student_id: s.id, message: msg, type: "reminder" });
        sent++;
        toast.loading(`Sending ${sent} / ${total}…`, { id: progressId });
        await new Promise((r) => setTimeout(r, 700));
      }
      await logAudit("whatsapp_broadcast", "whatsapp", null, { count: sent, type: "fee_reminder" });
      toast.success(`Sent ${sent} reminder${sent === 1 ? "" : "s"}.`, { id: progressId });
    } catch (e) {
      toast.error(`Stopped after ${sent}: ${(e as Error).message}`, { id: progressId });
    } finally {
      setBulkSending(false);
    }
  };

  const handleExport = async () => {
    exportCSV(
      ["Name", "Class", "Mobile", "Total", "Paid", "Remaining"],
      filtered.map((s) => [s.name, s.class, s.mobile, s.total, s.paid, s.remaining]),
      `fees_${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
    await logAudit("export", "payment", null, { kind: "fees", rows: filtered.length });
  };

  const openPayment = (id: string) => { setPaymentStudentId(id); setPaymentDialogOpen(true); };
  const openHistory = (id: string) => { setHistoryStudentId(id); };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold font-display">Fees</h1>
          <Badge variant="outline" className="text-xs">AY {year}</Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filtered.length === 0}
            aria-label="Export fees to CSV"
          >
            <Download className="h-4 w-4 mr-1" />Export CSV
          </Button>
          <Button
            variant="outline"
            className="border-success text-success hover:bg-success/10 font-semibold"
            onClick={() => {
              if (bulkPending.length === 0) { toast.info("No pending fees with valid mobiles"); return; }
              setBulkConfirmOpen(true);
            }}
            disabled={bulkSending}
            aria-label="Send WhatsApp reminder to all pending students"
          >
            <Send className="h-4 w-4 mr-1" />{bulkSending ? "Sending…" : `Bulk Remind (${bulkPending.length})`}
          </Button>
        </div>
      </div>

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send {bulkPending.length} WhatsApp reminders?</AlertDialogTitle>
            <AlertDialogDescription>
              This will open a new WhatsApp tab for each student in sequence (one every ~700ms) and log the message in the audit trail. Allow popups for this site.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runBulkSend} className="bg-success text-success-foreground hover:bg-success/90">
              Send {bulkPending.length}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Students</p>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Collected</p>
          <p className="text-2xl font-bold text-success">{inr(totalCollected)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-destructive">{inr(totalPending)}</p>
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
                  <TableCell className="text-xs">{s.class} • {s.board} {s.medium}</TableCell>
                  <TableCell className="text-right">{inr(s.total)}</TableCell>
                  <TableCell className="text-right text-success">{inr(s.paid)}</TableCell>
                  <TableCell className={`text-right font-bold ${s.remaining > 0 ? "text-destructive" : "text-success"}`}>
                    {s.remaining > 0 ? inr(s.remaining) : "Paid ✓"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPayment(s.id)} aria-label={`Add payment for ${s.name}`} title="Add payment">
                        <IndianRupee className="h-4 w-4 text-secondary-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openHistory(s.id)} aria-label={`View payment history for ${s.name}`} title="Payment history">
                        <History className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      {s.remaining > 0 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => sendReminder(s)} aria-label={`Send WhatsApp reminder to ${s.name}`} title="Send reminder">
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

      <Dialog open={!!historyStudentId} onOpenChange={(o) => !o && setHistoryStudentId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Payment History — {studentFees.find((s) => s.id === historyStudentId)?.name || ""}
            </DialogTitle>
          </DialogHeader>
          {historyStudentId && (
            <PaymentHistory
              studentId={historyStudentId}
              studentName={studentFees.find((s) => s.id === historyStudentId)?.name || ""}
              payments={payments.filter((p) => p.student_id === historyStudentId)}
              onChanged={() => {
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

/* ─────────────────────────── Payment History (Edit / Delete) ─────────────────────────── */

type PaymentRow = Pick<Tables<"payments">, "id" | "student_id" | "amount" | "payment_date" | "payment_mode" | "academic_year" | "notes">;

function PaymentHistory({ studentId, studentName, payments, onChanged }: {
  studentId: string;
  studentName: string;
  payments: PaymentRow[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<PaymentRow | null>(null);
  const [deleting, setDeleting] = useState<PaymentRow | null>(null);

  const deleteMut = useMutation({
    mutationFn: async (p: PaymentRow) => {
      const { error } = await supabase.from("payments").delete().eq("id", p.id);
      if (error) throw error;
      await logAudit("delete", "payment", p.id, {
        student_id: p.student_id,
        student_name: studentName,
        amount: Number(p.amount),
        payment_date: p.payment_date,
        payment_mode: p.payment_mode,
      });
    },
    onSuccess: () => { toast.success("Payment deleted"); setDeleting(null); onChanged(); },
    onError: (e) => toast.error(e.message),
  });

  if (payments.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No payments recorded yet.</p>;
  }

  return (
    <>
      <div className="max-h-[60vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id} className="hover:bg-muted/50">
                <TableCell className="text-sm">{format(new Date(p.payment_date), "dd MMM yyyy")}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs capitalize">{p.payment_mode}</Badge></TableCell>
                <TableCell className="text-right font-semibold text-success">{inr(Number(p.amount))}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{p.notes || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(p)} aria-label="Edit payment" title="Edit">
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleting(p)} aria-label="Delete payment" title="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Payment</DialogTitle></DialogHeader>
          {editing && (
            <EditPaymentForm
              payment={editing}
              studentId={studentId}
              studentName={studentName}
              onSuccess={() => { setEditing(null); onChanged(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && <>Permanently remove <strong>{inr(Number(deleting.amount))}</strong> paid by <strong>{studentName}</strong> on {format(new Date(deleting.payment_date), "dd MMM yyyy")}. This cannot be undone, but it will be recorded in the audit log.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMut.mutate(deleting)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EditPaymentForm({ payment, studentId, studentName, onSuccess }: {
  payment: PaymentRow;
  studentId: string;
  studentName: string;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(String(Number(payment.amount)));
  const [date, setDate] = useState(payment.payment_date);
  const [mode, setMode] = useState(payment.payment_mode);
  const [notes, setNotes] = useState(payment.notes || "");

  const updateMut = useMutation({
    mutationFn: async () => {
      const amt = safeNum(amount);
      if (amt <= 0) throw new Error("Amount must be greater than 0");
      const ay = deriveAcademicYear(date) || payment.academic_year;
      const before = {
        amount: Number(payment.amount),
        payment_date: payment.payment_date,
        payment_mode: payment.payment_mode,
        notes: payment.notes,
      };
      const after = { amount: amt, payment_date: date, payment_mode: mode, notes: notes || null, academic_year: ay };
      const { error } = await supabase.from("payments").update(after).eq("id", payment.id);
      if (error) throw error;
      await logAudit("update", "payment", payment.id, {
        student_id: studentId,
        student_name: studentName,
        before,
        after,
      });
    },
    onSuccess: () => { toast.success("Payment updated"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); updateMut.mutate(); }} className="space-y-3">
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
      <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={updateMut.isPending}>
        {updateMut.isPending ? "Saving..." : "Update Payment"}
      </Button>
    </form>
  );
}

/* ─────────────────────────── Add Payment Form ─────────────────────────── */

function PaymentForm({ studentId, studentName, remaining, defaultYear, onSuccess }: { studentId: string; studentName: string; remaining: number; defaultYear: string; onSuccess: () => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [mode, setMode] = useState("cash");
  const [notes, setNotes] = useState("");
  const [overConfirmOpen, setOverConfirmOpen] = useState(false);
  const [savedPaymentId, setSavedPaymentId] = useState<string | null>(null);

  const recordPayment = useMutation({
    mutationFn: async () => {
      const amt = safeNum(amount);
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
      return ins?.id ?? null;
    },
    onSuccess: (id) => {
      toast.success("Payment recorded");
      if (id) setSavedPaymentId(id);
      // Defer closing the dialog so the user can print the receipt with the real id.
      setTimeout(() => onSuccess(), 1500);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = safeNum(amount);
    if (amt <= 0) { toast.error("Amount must be greater than 0"); return; }
    if (remaining > 0 && amt > remaining) {
      setOverConfirmOpen(true);
      return;
    }
    recordPayment.mutate();
  };

  const printReceipt = () => {
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    const amt = safeNum(amount);
    // HTML-escape every interpolated value to prevent XSS in the same-origin popup.
    const esc = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    // Stable receipt # from the actual DB row id when available; falls back to time only before save.
    const receiptNo = savedPaymentId ? savedPaymentId.slice(0, 8).toUpperCase() : `T-${Date.now().toString().slice(-6)}`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt - ${esc(studentName)}</title>
      <style>body{font-family:system-ui;padding:24px;max-width:340px;margin:auto;color:#222}h1{margin:0 0 4px;font-size:18px}h2{font-size:14px;margin:0 0 16px;color:#666;font-weight:normal}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:6px 0;border-bottom:1px dashed #ccc}.lbl{color:#666}.amt{font-size:22px;font-weight:bold;text-align:center;padding:16px;border:2px dashed #888;border-radius:8px;margin:12px 0}.foot{text-align:center;font-size:11px;color:#888;margin-top:24px}</style>
      </head><body>
      <h1>Yashshree Coaching Classes</h1>
      <h2>Payment Receipt</h2>
      <div class="amt">Rs. ${esc(amt.toLocaleString("en-IN"))}</div>
      <table>
        <tr><td class="lbl">Student</td><td style="text-align:right;font-weight:600">${esc(studentName)}</td></tr>
        <tr><td class="lbl">Date</td><td style="text-align:right">${esc(date)}</td></tr>
        <tr><td class="lbl">Mode</td><td style="text-align:right;text-transform:capitalize">${esc(mode)}</td></tr>
        ${notes ? `<tr><td class="lbl">Notes</td><td style="text-align:right">${esc(notes)}</td></tr>` : ""}
        <tr><td class="lbl">Receipt #</td><td style="text-align:right">${esc(receiptNo)}</td></tr>
      </table>
      <p class="foot">Thank you. This is a computer-generated receipt.</p>
      </body></html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
    // Trigger print from the parent window — avoids inline <script> in the popup.
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        /* user may have closed the window */
      }
    }, 250);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-3">
        {remaining > 0 && (
          <p className="text-xs text-muted-foreground">Remaining: <span className="font-semibold text-destructive">{inr(remaining)}</span></p>
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
          <Button type="submit" className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={recordPayment.isPending}>
            {recordPayment.isPending ? "Saving..." : "Record Payment"}
          </Button>
          <Button type="button" variant="outline" onClick={printReceipt} disabled={!savedPaymentId} title={savedPaymentId ? "Print receipt" : "Record the payment first"}>
            Print
          </Button>
        </div>
      </form>

      <AlertDialog open={overConfirmOpen} onOpenChange={setOverConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Amount exceeds remaining</AlertDialogTitle>
            <AlertDialogDescription>
              {inr(safeNum(amount))} is more than the remaining balance of {inr(remaining)}. Record the payment anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setOverConfirmOpen(false); recordPayment.mutate(); }}>
              Yes, record it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
