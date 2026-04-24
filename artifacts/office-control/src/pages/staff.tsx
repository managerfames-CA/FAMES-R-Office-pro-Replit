import { useState } from "react";
import {
  useListStaff,
  useCreateStaff,
  useUpdateStaff,
  useDeleteStaff,
  getListStaffQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserPlus,
  Search,
  MoreHorizontal,
  Shield,
  User,
  Users,
  Mail,
  Phone,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";

type PermKey =
  | "view_reports"
  | "view_invoices"
  | "manage_invoices"
  | "manage_clients"
  | "view_team_attendance"
  | "view_team_work_logs";

const PERMISSIONS: { key: PermKey; label: string; description: string }[] = [
  { key: "view_reports", label: "View Reports", description: "Access analytics dashboards." },
  { key: "view_invoices", label: "View Invoices", description: "See invoice list and details." },
  { key: "manage_invoices", label: "Manage Invoices", description: "Create, edit and delete invoices." },
  { key: "manage_clients", label: "Manage Clients", description: "Add and edit client records." },
  { key: "view_team_attendance", label: "View Team Attendance", description: "See attendance for everyone." },
  { key: "view_team_work_logs", label: "View Team Work Logs", description: "See logs from other staff." },
];

const staffFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Minimum 6 characters").or(z.literal("")),
  role: z.enum(["admin", "staff"]),
  position: z.string().optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  permissions: z.array(z.string()).default([]),
  mustChangePassword: z.boolean().default(true),
});

function genTempPassword() {
  const words = ["Sun", "Sky", "Wave", "Pine", "Echo", "Star", "Moon", "Vine"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}${n}!`;
}

export default function Staff() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editStaffId, setEditStaffId] = useState<number | null>(null);

  const { data: staffList, isLoading } = useListStaff({
    search: searchTerm.length > 2 ? searchTerm : undefined,
  });

  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();

  const form = useForm<z.infer<typeof staffFormSchema>>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "staff",
      position: "",
      phone: "",
      department: "",
      permissions: [],
      mustChangePassword: true,
    },
  });

  const watchedRole = form.watch("role");
  const watchedPerms = form.watch("permissions");

  const openCreate = () => {
    form.reset({
      name: "",
      email: "",
      password: genTempPassword(),
      role: "staff",
      position: "",
      phone: "",
      department: "",
      permissions: [],
      mustChangePassword: true,
    });
    setEditStaffId(null);
    setIsCreateOpen(true);
  };

  const openEdit = (staff: any) => {
    form.reset({
      name: staff.name,
      email: staff.email,
      password: "",
      role: staff.role as "admin" | "staff",
      position: staff.position || "",
      phone: staff.phone || "",
      department: staff.department || "",
      permissions: staff.permissions ?? [],
      mustChangePassword: !!staff.mustChangePassword,
    });
    setEditStaffId(staff.id);
    setIsCreateOpen(true);
  };

  const togglePerm = (key: PermKey) => {
    const cur = new Set(form.getValues("permissions") ?? []);
    if (cur.has(key)) cur.delete(key);
    else cur.add(key);
    form.setValue("permissions", Array.from(cur), { shouldDirty: true });
  };

  const onSubmit = async (values: z.infer<typeof staffFormSchema>) => {
    try {
      const payload: any = {
        ...values,
        permissions: values.permissions ?? [],
      };
      if (editStaffId) {
        if (!payload.password) delete payload.password;
        await updateStaff.mutateAsync({ id: editStaffId, data: payload });
        toast.success("Staff member updated");
      } else {
        if (!payload.password) {
          toast.error("Temporary password is required");
          return;
        }
        await createStaff.mutateAsync({ data: payload });
        toast.success(`Account created — share temporary password: ${payload.password}`);
      }
      queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      setIsCreateOpen(false);
    } catch {
      toast.error(editStaffId ? "Failed to update staff" : "Failed to create staff");
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    try {
      await updateStaff.mutateAsync({
        id,
        data: { status: currentStatus === "active" ? "inactive" : "active" } as any,
      });
      queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
      toast.success(`Marked ${currentStatus === "active" ? "inactive" : "active"}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleResetPassword = async (id: number) => {
    const temp = genTempPassword();
    if (!confirm(`Reset password to "${temp}"?\n\nUser will be required to change it on next login.`)) return;
    try {
      await updateStaff.mutateAsync({
        id,
        data: { password: temp, mustChangePassword: true } as any,
      });
      queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
      toast.success(`Password reset. Share with user: ${temp}`);
    } catch {
      toast.error("Failed to reset password");
    }
  };

  const filteredStaff = staffList?.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.department && s.department.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Staff Directory</h2>
          <p className="text-muted-foreground">
            Add team members, set roles and tune individual permissions.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <UserPlus className="mr-2 h-4 w-4" /> Add Staff
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-16 w-full" /></div>
          ) : filteredStaff && filteredStaff.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                    <TableHead className="hidden lg:table-cell">Department</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead className="w-[80px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map((staff) => (
                    <TableRow key={staff.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                            {staff.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {staff.name}
                              {staff.mustChangePassword && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] uppercase">
                                  <KeyRound className="h-2.5 w-2.5 mr-1" /> First login
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground md:hidden">{staff.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={staff.role === "admin" ? "default" : "secondary"} className="capitalize">
                          {staff.role === "admin" ? <Shield className="mr-1 h-3 w-3" /> : <User className="mr-1 h-3 w-3" />}
                          {staff.role}
                        </Badge>
                        {staff.role === "staff" && staff.permissions && staff.permissions.length > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            +{staff.permissions.length} permission{staff.permissions.length === 1 ? "" : "s"}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-sm">
                          <div className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" /> {staff.email}</div>
                          {staff.phone && (
                            <div className="flex items-center gap-1 text-muted-foreground mt-1">
                              <Phone className="h-3 w-3" /> {staff.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="text-sm">
                          <div className="font-medium">{staff.department || "-"}</div>
                          <div className="text-xs text-muted-foreground">{staff.position}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={staff.status === "active" ? "outline" : "destructive"}
                          className={staff.status === "active" ? "text-emerald-600 border-emerald-200 bg-emerald-50" : ""}
                        >
                          {staff.status}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openEdit(staff)}>Edit Details</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleResetPassword(staff.id)}>
                                <KeyRound className="h-3.5 w-3.5 mr-2" /> Reset password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleToggleStatus(staff.id, staff.status)}>
                                {staff.status === "active" ? "Deactivate" : "Activate"} User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 border rounded-lg border-dashed">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-medium">No staff found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm ? "No results match your search." : "Your directory is empty."}
              </p>
              {isAdmin && !searchTerm && (
                <Button onClick={openCreate} variant="outline">Add First Staff Member</Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editStaffId ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
            <DialogDescription>
              {editStaffId
                ? "Update details, role and permissions."
                : "Create the account, set a temporary password, and tune permissions."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name *</FormLabel><FormControl><Input placeholder="Alex Smith" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email Address *</FormLabel><FormControl><Input placeholder="alex@yourfirm.com" {...field} disabled={!!editStaffId} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{editStaffId ? "Reset Password (optional)" : "Temporary Password *"}</FormLabel>
                    <div className="flex gap-2">
                      <FormControl><Input type="text" placeholder="••••••••" {...field} /></FormControl>
                      <Button type="button" variant="outline" size="sm" onClick={() => form.setValue("password", genTempPassword())}>
                        Generate
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="department" render={({ field }) => (
                  <FormItem><FormLabel>Department</FormLabel><FormControl><Input placeholder="e.g. Operations" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="position" render={({ field }) => (
                  <FormItem><FormLabel>Position</FormLabel><FormControl><Input placeholder="e.g. Coordinator" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="+1 555-0123" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              {watchedRole === "admin" ? (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertTitle>Administrator</AlertTitle>
                  <AlertDescription>
                    Admins automatically have access to every feature, including approvals, reports and staff management. No extra permissions needed.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Extra permissions</div>
                      <p className="text-xs text-muted-foreground">
                        By default, staff only see their own work. Grant access to extra areas below.
                      </p>
                    </div>
                    <Badge variant="secondary">{(watchedPerms ?? []).length} selected</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PERMISSIONS.map((p) => {
                      const checked = (watchedPerms ?? []).includes(p.key);
                      return (
                        <label
                          key={p.key}
                          className={`flex items-start gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent ${checked ? "border-primary/40 bg-primary/5" : ""}`}
                        >
                          <Checkbox checked={checked} onCheckedChange={() => togglePerm(p.key)} className="mt-0.5" />
                          <div className="text-xs">
                            <div className="font-medium">{p.label}</div>
                            <div className="text-muted-foreground">{p.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <FormField control={form.control} name="mustChangePassword" render={({ field }) => (
                <FormItem className="flex items-start gap-3 rounded-md border p-3">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      Require password change on next login
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Recommended for new accounts and after any password reset.
                    </p>
                  </div>
                </FormItem>
              )} />

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createStaff.isPending || updateStaff.isPending}>
                  {createStaff.isPending || updateStaff.isPending ? "Saving..." : editStaffId ? "Save changes" : "Create account"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
