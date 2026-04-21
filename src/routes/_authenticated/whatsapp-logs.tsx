import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, subDays } from "date-fns";
import { AdminGuard } from "@/components/AdminGuard";

export const Route = createFileRoute("/_authenticated/whatsapp-logs")({
  component: () => <AdminGuard><WhatsAppLogsPage /></AdminGuard>,
});

const PAGE_SIZE = 50;

function WhatsAppLogsPage() {
  // Default to last 30 days so the page stays fast as logs grow
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [page, setPage] = useState(0);

  const { data: logs = [] } = useQuery({
    queryKey: ["whatsapp-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_logs").select("*").order("sent_at", { ascending: false });
      return data || [];
    },
  });

  // Separately fetch students and join in-memory (no FK in schema)
  const { data: students = [] } = useQuery({
    queryKey: ["students-all-min"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id, name, mobile");
      return data || [];
    },
  });
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : -Infinity;
    const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : Infinity;
    return logs.filter((log) => {
      const ts = new Date(log.sent_at).getTime();
      return ts >= fromTs && ts <= toTs;
    });
  }, [logs, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const resetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-display">WhatsApp Logs</h1>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <p className="text-xs text-muted-foreground mb-1">From</p>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="w-[160px]" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">To</p>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="w-[160px]" />
            </div>
            <Button variant="outline" size="sm" onClick={resetFilters}>Clear</Button>
            <p className="text-xs text-muted-foreground ml-auto">{filtered.length} log{filtered.length === 1 ? "" : "s"}</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Sent At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                  {(dateFrom || dateTo) ? <>No logs in this date range. <button type="button" onClick={resetFilters} className="underline">Clear filter</button></> : "No logs found"}
                </TableCell></TableRow>
              ) : (
                pageRows.map((log) => {
                  const st = studentMap.get(log.student_id);
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{st?.name || "—"}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">{log.message}</TableCell>
                      <TableCell><Badge variant="secondary">{log.type}</Badge></TableCell>
                      <TableCell className="text-sm">{format(new Date(log.sent_at), "dd MMM yyyy, hh:mm a")}</TableCell>
                    </TableRow>
                  );
                })
              )}
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
