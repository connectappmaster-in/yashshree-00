import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { listUsers, createUser, updateUser, deleteUser, type ManagedUser } from "@/utils/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Shield, GraduationCap, UserCog, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { requireAdmin } from "@/lib/route-guards";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/_authenticated/users")({
  beforeLoad: requireAdmin,
  component: UsersPage,
  errorComponent: RouteError,
});

type FormState = {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "teacher";
  teacher_id: string | null;
};

const emptyForm: FormState = { email: "", password: "", full_name: "", role: "teacher", teacher_id: null };

function UsersPage() {
  const { isReady, user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);

  const usersQuery = useQuery({
    queryKey: ["managed-users"],
    queryFn: async () => {
      const res = await listUsers();
      return res.users;
    },
    enabled: isReady,
    retry: 1,
  });

  const teachersQuery = useQuery({
    queryKey: ["teachers-for-users"],
    queryFn: async () => {
      const { data } = await supabase.from("teachers").select("id, name, subject").order("name");
      return data || [];
    },
    enabled: isReady,
  });

  const createMut = useMutation({
    mutationFn: async (input: FormState) =>
      createUser({
        data: {
          email: input.email,
          password: input.password,
          full_name: input.full_name,
          role: input.role,
          teacher_id: input.role === "teacher" ? input.teacher_id : null,
        },
      }),
    onSuccess: () => {
      toast.success("User created");
      queryClient.invalidateQueries({ queryKey: ["managed-users"] });
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async (vars: { userId: string; input: FormState }) =>
      updateUser({
        data: {
          userId: vars.userId,
          email: vars.input.email || undefined,
          password: vars.input.password ? vars.input.password : undefined,
          full_name: vars.input.full_name || undefined,
          role: vars.input.role,
          teacher_id: vars.input.role === "teacher" ? vars.input.teacher_id : null,
        },
      }),
    onSuccess: () => {
      toast.success("User updated");
      queryClient.invalidateQueries({ queryKey: ["managed-users"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (userId: string) => deleteUser({ data: { userId } }),
    onSuccess: () => {
      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["managed-users"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // beforeLoad already enforces admin access; just wait for auth state to settle.
  if (!isReady) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (u: ManagedUser) => {
    setEditing(u);
    setForm({
      email: u.email,
      password: "",
      full_name: u.full_name ?? "",
      role: u.role ?? "teacher",
      teacher_id: u.teacher_id,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return toast.error("Full name required");
    if (!form.email.trim()) return toast.error("Email required");
    if (!editing && form.password.length < 6) return toast.error("Password must be 6+ characters");
    if (form.role === "teacher" && !form.teacher_id) return toast.error("Link a teacher");
    if (editing) {
      updateMut.mutate({ userId: editing.id, input: form });
    } else {
      createMut.mutate(form);
    }
  };

  const users = usersQuery.data ?? [];
  const teachers = teachersQuery.data ?? [];
  const linkedTeacherIds = new Set(
    users.filter((u) => u.role === "teacher" && u.teacher_id).map((u) => u.teacher_id!)
  );
  const availableTeachers = teachers.filter(
    (t) => !linkedTeacherIds.has(t.id) || t.id === editing?.teacher_id
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="h-6 w-6" /> User Management
          </h1>
          <p className="text-sm text-muted-foreground">Create and manage admin & teacher login accounts.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{users.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Admins</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{users.filter((u) => u.role === "admin").length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Teachers</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{users.filter((u) => u.role === "teacher").length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>All Users</CardTitle></CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : usersQuery.error ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-destructive">
                Failed to load users: {(usersQuery.error as Error).message}
              </p>
              <Button variant="outline" size="sm" onClick={() => usersQuery.refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" /> Retry
              </Button>
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Linked Teacher</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {u.email}
                      {u.id === currentUser?.id && (
                        <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.role === "admin" ? (
                        <Badge className="gap-1"><Shield className="h-3 w-3" /> Admin</Badge>
                      ) : u.role === "teacher" ? (
                        <Badge variant="secondary" className="gap-1"><GraduationCap className="h-3 w-3" /> Teacher</Badge>
                      ) : (
                        <Badge variant="outline" className="cursor-pointer" onClick={() => openEdit(u)}>No role · Assign</Badge>
                      )}
                    </TableCell>
                    <TableCell>{u.teacher_name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(u.created_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(u)} aria-label="Edit user">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={u.id === currentUser?.id}
                        onClick={() => setDeleteTarget(u)}
                        aria-label="Delete user"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="e.g. Prakash Panchal"
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{editing ? "New Password (leave blank to keep)" : "Password"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={editing ? "••••••" : "Min. 6 characters"}
                required={!editing}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v: "admin" | "teacher") =>
                  setForm((f) => ({ ...f, role: v, teacher_id: v === "admin" ? null : f.teacher_id }))
                }
                disabled={editing?.id === currentUser?.id}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (full access)</SelectItem>
                  <SelectItem value="teacher">Teacher (limited)</SelectItem>
                </SelectContent>
              </Select>
              {editing?.id === currentUser?.id && (
                <p className="text-xs text-muted-foreground">You can't change your own role.</p>
              )}
            </div>
            {form.role === "teacher" && (
              <div className="space-y-2">
                <Label>Link to Teacher</Label>
                <Select
                  value={form.teacher_id ?? ""}
                  onValueChange={(v) => setForm((f) => ({ ...f, teacher_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    {availableTeachers.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No unlinked teachers. Add one in Teachers page first.
                      </div>
                    ) : (
                      availableTeachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} — {t.subject}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {editing ? "Save Changes" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <b>{deleteTarget?.email}</b> and revokes their access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
