import { useState } from "react";
import { useListStaff, useCreateStaff, useUpdateStaff, useDeleteStaff, getListStaffQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Search, MoreHorizontal, Check, X, Shield, User, Users, Mail, Phone, Building } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";
import { format } from "date-fns";

const staffFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Minimum 6 characters").or(z.literal("")),
  role: z.enum(["admin", "staff"]),
  position: z.string().optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
});

export default function Staff() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editStaffId, setEditStaffId] = useState<number | null>(null);

  const { data: staffList, isLoading } = useListStaff({ search: searchTerm.length > 2 ? searchTerm : undefined });
  
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
    },
  });

  const openCreate = () => {
    form.reset({ name: "", email: "", password: "", role: "staff", position: "", phone: "", department: "" });
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
    });
    setEditStaffId(staff.id);
    setIsCreateOpen(true);
  };

  const onSubmit = async (values: z.infer<typeof staffFormSchema>) => {
    try {
      if (editStaffId) {
        const data = { ...values };
        if (!data.password) delete (data as any).password;
        await updateStaff.mutateAsync({ id: editStaffId, data });
        toast.success("Staff member updated");
      } else {
        if (!values.password) {
          toast.error("Password is required for new staff");
          return;
        }
        await createStaff.mutateAsync({ data: values as any });
        toast.success("Staff member created");
      }
      queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      setIsCreateOpen(false);
    } catch (e) {
      toast.error(editStaffId ? "Failed to update staff" : "Failed to create staff");
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    try {
      await updateStaff.mutateAsync({ 
        id, 
        data: { status: currentStatus === "active" ? "inactive" : "active" } as any 
      });
      queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast.success(`Staff member marked as ${currentStatus === "active" ? "inactive" : "active"}`);
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const filteredStaff = staffList?.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.department && s.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Staff Directory</h2>
          <p className="text-muted-foreground">Manage team members and roles.</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Staff
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
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
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
                            <div className="font-medium">{staff.name}</div>
                            <div className="text-xs text-muted-foreground md:hidden">{staff.email}</div>
                            <div className="text-xs text-muted-foreground hidden sm:block md:hidden">{staff.position}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={staff.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                          {staff.role === 'admin' && <Shield className="mr-1 h-3 w-3" />}
                          {staff.role === 'staff' && <User className="mr-1 h-3 w-3" />}
                          {staff.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-sm">
                          <div className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" /> {staff.email}</div>
                          {staff.phone && <div className="flex items-center gap-1 text-muted-foreground mt-1"><Phone className="h-3 w-3" /> {staff.phone}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="text-sm">
                          <div className="font-medium">{staff.department || '-'}</div>
                          <div className="text-xs text-muted-foreground">{staff.position}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={staff.status === 'active' ? 'outline' : 'destructive'} className={staff.status === 'active' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : ''}>
                          {staff.status}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openEdit(staff)}>Edit Details</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleToggleStatus(staff.id, staff.status)}>
                                {staff.status === 'active' ? 'Deactivate' : 'Activate'} User
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editStaffId ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
            <DialogDescription>
              {editStaffId ? "Update details for this team member." : "Fill out the details to invite a new team member."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name *</FormLabel><FormControl><Input placeholder="Alex Smith" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email Address *</FormLabel><FormControl><Input placeholder="alex@office.app" {...field} disabled={!!editStaffId} /></FormControl><FormMessage /></FormItem>
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
                    <FormLabel>{editStaffId ? "New Password (Optional)" : "Password *"}</FormLabel>
                    <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="department" render={({ field }) => (
                  <FormItem><FormLabel>Department</FormLabel><FormControl><Input placeholder="e.g. Engineering" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="position" render={({ field }) => (
                  <FormItem><FormLabel>Position</FormLabel><FormControl><Input placeholder="e.g. Developer" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="+1 555-0123" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createStaff.isPending || updateStaff.isPending}>
                  {createStaff.isPending || updateStaff.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}