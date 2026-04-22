import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays, startOfMonth } from "date-fns";
import { AdminGuard } from "@/components/AdminGuard";
import { Send, Repeat, ChevronDown, ChevronRight, MessageCircle } from "lucide-react";
import { buildWhatsappUrl } from "@/lib/format";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/whatsapp-logs")({
  component: () => <AdminGuard><WhatsAppLogsPage /></AdminGuard>,
});

const PAGE_SIZE = 50;
const TYPES = ["reminder", "attendance", "test", "broadcast", "other"];
const CLASSES = ["5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
const BOARDS = ["CBSE", "SSC"];

function WhatsAppLogsPage() {
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: logs = [] } = useQuery({
    queryKey: ["whatsapp-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_logs").select("*").order("sent_at", { ascending: false });
      return data || [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-all-min"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id, name, mobile, class, board, status, academic_year");
      return data || [];
    },
  });
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : -Infinity;
    const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : Infinity;
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      const ts = new Date(log.sent_at).getTime();
      if (ts < fromTs || ts > toTs) return false;
      if (type !== "all" && log.type !== type) return false;
      if (q) {
        const s = studentMap.get(log.student_id);
        const name = s?.name?.toLowerCase() || "";
        return name.includes(q) || log.message.toLowerCase().includes(q);
      }
      return true;
    });
  }, [logs, dateFrom, dateTo, type, search, studentMap]);

  const monthStart = startOfMonth(new Date()).getTime();
  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    let thisMonth = 0;
    logs.forEach((l) => {
      byType[l.type] = (byType[l.type] || 0) + 1;
      if (new Date(l.sent_at).getTime() >= monthStart) thisMonth++;
    });
    return { total: logs.length, thisMonth, byType };
  }, [logs, monthStart]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const resend = async (log: typeof logs[0]) => {
    // Re-validate that the student still exists & is active before opening the deep link
    const { data: fresh } = await supabase
      .from("students")
      .select("id, name, mobile, status")
      .eq("id", log.student_id)
      .maybeSingle();
    if (!fresh) { toast.error("Student no longer exists"); return; }
    if (fresh.status !== "active") { toast.error(`${fresh.name} is inactive`); return; }
    const url = buildWhatsappUrl(fresh.mobile, log.message);
    if (!url) { toast.error(`Invalid mobile for ${fresh.name}`); return; }
    window.open(url, "_blank");
    await supabase.from("whatsapp_logs").insert({ student_id: log.student_id, message: log.message, type: log.type });
    await logAudit("whatsapp_sent", "whatsapp", log.student_id, { type: log.type, resend: true });
    toast.success("Resent");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold font-display">WhatsApp</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Total" value={stats.total} />
        <StatCard title="This Month" value={stats.thisMonth} />
        <StatCard title="Reminders" value={stats.byType.reminder || 0} />
        <StatCard title="Broadcasts" value={stats.byType.broadcast || 0} />
      </div>

      {/* Broadcast composer */}
      <Broadcast students={students} onSent={() => {/* refetch via key invalidation could be added */}} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <p className="text-xs text-muted-foreground mb-1">From</p>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="w-[150px]" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">To</p>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="w-[150px]" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Type</p>
              <Select value={type} onValueChange={(v) => { setType(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-xs text-muted-foreground mb-1">Search student / message</p>
              <Input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
            </div>
            <p className="text-xs text-muted-foreground ml-auto">{filtered.length} log{filtered.length === 1 ? "" : "s"}</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Sent At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No logs</TableCell></TableRow>
              ) : pageRows.map((log) => {
                const st = studentMap.get(log.student_id);
                const expanded = expandedId === log.id;
                return (
                  <>
                    <TableRow key={log.id} className="hover:bg-muted/50">
                      <TableCell className="p-2">
                        <button onClick={() => setExpandedId(expanded ? null : log.id)} className="text-muted-foreground">
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">{st?.name || "—"}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">{log.message}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{log.type}</Badge></TableCell>
                      <TableCell className="text-sm">{format(new Date(log.sent_at), "dd MMM, hh:mm a")}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => resend(log)} title="Resend">
                          <Repeat className="h-4 w-4 text-success" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow key={log.id + "-msg"} className="bg-muted/20">
                        <TableCell colSpan={6} className="text-sm whitespace-pre-wrap py-3">{log.message}</TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30 text-sm">
              <span className="text-muted-foreground">Page {safePage + 1} of {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
                <Button variant="outline" size="sm" disabled={safePage >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold font-display mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function Broadcast({ students, onSent }: { students: { id: string; name: string; mobile: string; class: string; board: string; status: string }[]; onSent: () => void }) {
  const [classes, setClasses] = useState<Set<string>>(new Set());
  const [boards, setBoards] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const targets = students.filter((s) => {
    if (s.status !== "active") return false;
    if (classes.size > 0 && !classes.has(s.class)) return false;
    if (boards.size > 0 && !boards.has(s.board)) return false;
    return true;
  });

  const toggle = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    setter(next);
  };

  const send = async () => {
    if (!message.trim()) { toast.error("Compose a message first"); return; }
    if (targets.length === 0) { toast.error("No matching students"); return; }
    if (!confirm(`Open ${targets.length} WhatsApp tabs and log each? Allow popups for this site.`)) return;
    setSending(true);
    let i = 0;
    for (const s of targets) {
      const url = buildWhatsappUrl(s.mobile, message);
      if (!url) continue;
      setTimeout(() => window.open(url, "_blank"), i * 600);
      await supabase.from("whatsapp_logs").insert({ student_id: s.id, message, type: "broadcast" });
      i++;
    }
    await logAudit("whatsapp_broadcast", "whatsapp", null, { count: i, type: "broadcast" });
    setSending(false);
    toast.success(`${i} broadcast messages queued`);
    setMessage("");
    onSent();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Broadcast Composer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Classes (none = all)</p>
          <div className="flex flex-wrap gap-1.5">
            {CLASSES.map((c) => (
              <Badge key={c} variant={classes.has(c) ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => toggle(classes, c, setClasses)}>{c}</Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Boards (none = all)</p>
          <div className="flex flex-wrap gap-1.5">
            {BOARDS.map((b) => (
              <Badge key={b} variant={boards.has(b) ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => toggle(boards, b, setBoards)}>{b}</Badge>
            ))}
          </div>
        </div>
        <Textarea rows={3} placeholder="Type your broadcast message..." value={message} onChange={(e) => setMessage(e.target.value)} />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{targets.length} student{targets.length === 1 ? "" : "s"} match</p>
          <Button onClick={send} disabled={sending || targets.length === 0 || !message.trim()} className="bg-success text-success-foreground hover:bg-success/90 font-semibold">
            <Send className="h-4 w-4 mr-1" /> {sending ? "Sending..." : `Send to ${targets.length}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
