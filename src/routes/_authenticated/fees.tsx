import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Search } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/fees")({
  component: FeesPage,
});

function FeesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentStudentId, setPaymentStudentId] = useState<string | null>(null);

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("*").eq("status", "active").order("name");
      return data || [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*").order("payment_date", { ascending: false });
      return data || [];
    },
  });

  const studentFees = students.map((s) => {
    const studentPayments = payments.filter((p) => p.student_id === s.id);
    const paid = studentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const total = Number(s.total_fees) - Number(s.discount);
    const remaining = total - paid;
    const today = new Date().getDate();
    const isOverdue = remaining > 0 && today > s.fee_due_day;
    return { ...s, paid, total, remaining, isOverdue, payments: studentPayments };
  });

  const filtered = studentFees.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) || s.mobile.includes(search)
  );

  const sendReminder = async (student: typeof studentFees[0]) => {
    const msg = `Hello ${student.name}, your pending fees for Yashshree Classes is ₹${student.remaining.toLocaleString("en-IN")}. Please pay before ${student.fee_due_day}th of this month. Thank you.`;
    const url = `https://wa.me/91${student.mobile}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");

    await supabase.from("whatsapp_logs").insert({
      student_id: student.id,
      message: msg,
      type: "reminder",
    });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-logs"] });
    toast.success(`Reminder sent to ${student.name}`);
  };

  const bulkReminder = () => {
    const pending = filtered.filter((s) => s.remaining > 0);
    if (pending.length === 0) {
      toast.info("No pending fees found");
      return;
    }
    pending.forEach((s, i) => {
      setTimeout(() => sendReminder(s), i * 1000);
    });
  };

  const selectedStudentData = selectedStudent ? studentFees.find((s) => s.id === selectedStudent) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold font-display">Fees Management</h1>
        <Button variant="outline" onClick={bulkReminder}>
          <Send className="h-4 w-4 mr-1" />
          Bulk Reminder
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or mobile..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id} className={s.isOverdue ? "bg-destructive/5" : ""}>
                    <TableCell className="font-medium cursor-pointer hover:text-primary" onClick={() => setSelectedStudent(s.id)}>{s.name}</TableCell>
                    <TableCell>{s.class}</TableCell>
                    <TableCell className="text-right">₹{s.total.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right text-success">₹{s.paid.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right font-medium">{s.remaining > 0 ? `₹${s.remaining.toLocaleString("en-IN")}` : "—"}</TableCell>
                    <TableCell>
                      {s.remaining <= 0 ? (
                        <Badge className="bg-success text-success-foreground">Paid</Badge>
                      ) : s.isOverdue ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setPaymentStudentId(s.id); setPaymentDialogOpen(true); }}>
                          + Pay
                        </Button>
                        {s.remaining > 0 && (
                          <Button variant="ghost" size="icon" onClick={() => sendReminder(s)} title="Send WhatsApp Reminder">
                            <MessageCircle className="h-4 w-4 text-success" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment History Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => { if (!open) setSelectedStudent(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Payment History — {selectedStudentData?.name}</DialogTitle>
          </DialogHeader>
          {selectedStudentData && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center p-2 bg-muted rounded-lg">
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-bold">₹{selectedStudentData.total.toLocaleString("en-IN")}</p>
                </div>
                <div className="text-center p-2 bg-muted rounded-lg">
                  <p className="text-muted-foreground">Paid</p>
                  <p className="font-bold text-success">₹{selectedStudentData.paid.toLocaleString("en-IN")}</p>
                </div>
                <div className="text-center p-2 bg-muted rounded-lg">
                  <p className="text-muted-foreground">Remaining</p>
                  <p className="font-bold">{selectedStudentData.remaining > 0 ? `₹${selectedStudentData.remaining.toLocaleString("en-IN")}` : "—"}</p>
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {selectedStudentData.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No payments yet</p>
                ) : (
                  selectedStudentData.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">₹{Number(p.amount).toLocaleString("en-IN")}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(p.payment_date), "dd MMM yyyy")} • {p.payment_mode}</p>
                      </div>
                      {p.notes && <p className="text-xs text-muted-foreground max-w-[120px] truncate">{p.notes}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Add Payment</DialogTitle>
          </DialogHeader>
          {paymentStudentId && (
            <PaymentForm
              studentId={paymentStudentId}
              onSuccess={() => {
                setPaymentDialogOpen(false);
                setPaymentStudentId(null);
                queryClient.invalidateQueries({ queryKey: ["payments"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentForm({ studentId, onSuccess }: { studentId: string; onSuccess: () => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [mode, setMode] = useState("cash");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payments").insert({
        student_id: studentId,
        amount: Number(amount),
        payment_date: date,
        payment_mode: mode,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Amount (₹)</Label>
        <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min={1} />
      </div>
      <div className="space-y-1.5">
        <Label>Date</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Payment Mode</Label>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
            <SelectItem value="bank">Bank Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Notes (optional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving..." : "Record Payment"}
      </Button>
    </form>
  );
}
