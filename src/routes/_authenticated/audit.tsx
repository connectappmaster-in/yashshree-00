import { createFileRoute } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Search, Download, ScrollText } from "lucide-react";
import { AdminGuard } from "@/components/AdminGuard";
import { exportCSV } from "@/lib/export-utils";
import { logAudit } from "@/lib/audit";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/audit")({
  component: () => <AdminGuard><AuditPage /></AdminGuard>,
});

interface AuditRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const PAGE_SIZE = 50;

const ACTION_COLORS: Record<string, string> = {
  create: "bg-success/15 text-success",
  update: "bg-primary/15 text-primary",
  delete: "bg-destructive/15 text-destructive",
  login: "bg-muted text-muted-foreground",
  login_failed: "bg-destructive/15 text-destructive",
  logout: "bg-muted text-muted-foreground",
  status_changed: "bg-accent/30 text-accent-foreground",
  attendance_copied: "bg-primary/15 text-primary",
  payment_recorded: "bg-success/15 text-success",
  attendance_marked: "bg-primary/15 text-primary",
  test_marks_saved: "bg-primary/15 text-primary",
  lecture_logged: "bg-primary/15 text-primary",
  whatsapp_sent: "bg-secondary/40 text-secondary-foreground",
  whatsapp_broadcast: "bg-secondary/40 text-secondary-foreground",
  user_created: "bg-success/15 text-success",
  user_updated: "bg-primary/15 text-primary",
  user_deleted: "bg-destructive/15 text-destructive",
  export: "bg-muted text-muted-foreground",
};

const ALL_ACTIONS = Object.keys(ACTION_COLORS);
const ALL_ENTITIES = [
  "student", "payment", "attendance", "test", "test_result",
  "teacher", "lecture", "teacher_attendance", "user", "whatsapp", "auth", "report",
];

function AuditPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Server-side filtered + paginated query
  const { data, isLoading } = useQuery({
    queryKey: ["audit_logs", { search, actionFilter, entityFilter, dateFrom, dateTo, page }],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      if (entityFilter !== "all") q = q.eq("entity", entityFilter);
      if (dateFrom) q = q.gte("created_at", `${dateFrom}T00:00:00`);
      if (dateTo) q = q.lte("created_at", `${dateTo}T23:59:59`);
      if (search.trim()) {
        // Escape PostgREST special chars in `or()` filter strings (commas split filters,
        // parens group, % and _ are LIKE wildcards). Without this, a single `,` or `(` in
        // the search box throws a 400 from the API.
        const s = search.trim().replace(/([,()*])/g, "\\$1").replace(/%/g, "\\%").replace(/_/g, "\\_");
        q = q.or(`user_email.ilike.%${s}%,entity_id.ilike.%${s}%`);
      }
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await q.range(from, to);
      if (error) throw error;
      return {
        rows: (data || []) as unknown as AuditRow[],
        total: count ?? 0,
      };
    },
    placeholderData: keepPreviousData,
  });

  // Lightweight stats query (separate so pagination doesn't reset stats)
  const { data: statsData } = useQuery({
    queryKey: ["audit_logs_stats"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const [{ count: total }, { count: todayCount }] = await Promise.all([
        supabase.from("audit_logs").select("id", { count: "exact", head: true }),
        supabase.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", `${today}T00:00:00`),
      ]);
      return { total: total ?? 0, todayCount: todayCount ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleExport = async () => {
    exportCSV(
      ["When", "User", "Action", "Entity", "Entity ID", "Details"],
      rows.map((l) => [
        format(new Date(l.created_at), "yyyy-MM-dd HH:mm:ss"),
        l.user_email || "—",
        l.action,
        l.entity,
        l.entity_id || "",
        JSON.stringify(l.details),
      ]),
      `audit_logs_${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
    await logAudit("export", "report", null, { kind: "audit_logs", rows: rows.length });
  };

  const resetPage = (cb: () => void) => { cb(); setPage(0); };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold font-display">Audit Log</h1>
          <Badge variant="outline" className="text-xs">{total.toLocaleString()} total</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-1" />Export page
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total events</p>
          <p className="text-2xl font-bold">{(statsData?.total ?? 0).toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Today</p>
          <p className="text-2xl font-bold text-primary">{(statsData?.todayCount ?? 0).toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Showing</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search user / entity id..."
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={(e) => resetPage(() => setSearch(e.target.value))}
            />
          </div>
          <Select value={actionFilter} onValueChange={(v) => resetPage(() => setActionFilter(v))}>
            <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {ALL_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={(v) => resetPage(() => setEntityFilter(v))}>
            <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {ALL_ENTITIES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => resetPage(() => setDateFrom(e.target.value))}
            className="w-[140px] h-9 text-xs"
            title="From date"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => resetPage(() => setDateTo(e.target.value))}
            className="w-[140px] h-9 text-xs"
            title="To date"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base font-display">Activity Timeline</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="p-0">
                  <EmptyState title="No audit events" hint="Try clearing your filters or widening the date range." />
                </TableCell></TableRow>
              ) : rows.map((l) => {
                const isOpen = expandedId === l.id;
                const detailKeys = Object.keys(l.details || {});
                return (
                  <TableRow
                    key={l.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedId(isOpen ? null : l.id)}
                  >
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(l.created_at), "dd MMM HH:mm:ss")}</TableCell>
                    <TableCell className="text-sm">{l.user_email || <span className="text-muted-foreground italic">system</span>}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] uppercase tracking-wide ${ACTION_COLORS[l.action] || "bg-muted text-muted-foreground"}`} variant="outline">
                        {l.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="font-medium">{l.entity}</span>
                      {l.entity_id && <span className="text-muted-foreground"> · {l.entity_id.slice(0, 8)}…</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {!isOpen ? (
                        <span className="text-muted-foreground">{detailKeys.length === 0 ? "—" : `${detailKeys.length} field(s) · click to expand`}</span>
                      ) : (
                        <pre className="text-[11px] bg-muted/40 rounded p-2 max-w-xl overflow-x-auto whitespace-pre-wrap">{JSON.stringify(l.details, null, 2)}</pre>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30 text-sm">
              <span className="text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
