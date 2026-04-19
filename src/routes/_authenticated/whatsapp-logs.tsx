import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/whatsapp-logs")({
  component: WhatsAppLogsPage,
});

function WhatsAppLogsPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const filtered = logs.filter((log) => {
    if (dateFrom && log.sent_at < dateFrom) return false;
    if (dateTo && log.sent_at > dateTo + "T23:59:59") return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-display">WhatsApp Logs</h1>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">From</p>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">To</p>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
            </div>
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
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No logs found</TableCell></TableRow>
              ) : (
                filtered.map((log) => {
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
        </CardContent>
      </Card>
    </div>
  );
}
