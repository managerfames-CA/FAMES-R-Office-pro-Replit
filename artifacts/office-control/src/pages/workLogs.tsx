import { useState } from "react";
import { useListWorkLogs, useCreateWorkLog, useUpdateWorkLog, useDeleteWorkLog, useListStaff, useListTasks, getListWorkLogsQueryKey, getGetDashboardSummaryQueryKey, getGetRecentActivityQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreHorizontal, Clock, Filter, User as UserIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";
import { format } from "date-fns";

const workLogFormSchema = z.object({
  taskId: z.coerce.number().optional().or(z.literal("")),
  date: z.string().min(1, "Date is required"),
  summary: z.string().min(1, "Summary is required"),
  hours: z.coerce.number().min(0.1, "Must be > 0").optional().or(z.literal("")),
  status: z.enum(["in_progress", "blocked", "completed"]),
});

export default function WorkLogs() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editLogId, setEditLogId] = useState<number | null>(null);

  const { data: workLogs, isLoading } = useListWorkLogs({
    staffId: isAdmin && staffFilter !== "all" ? Number(staffFilter) : (!isAdmin ? user?.id : undefined),
  });
  const { data: staffList } = useListStaff();
  const { data: tasksList } = useListTasks();
  
  const createWorkLog = useCreateWorkLog();
  const updateWorkLog = useUpdateWorkLog();
  const deleteWorkLog = useDeleteWorkLog();

  const form = useForm<z.infer<typeof workLogFormSchema>>({
    resolver: zodResolver(workLogFormSchema),
    defaultValues: {
      taskId: undefined,
      date: new Date().toISOString().split('T')[0],
      summary: "",
      hours: undefined,
      status: "in_progress",
    },
  });

  const openCreate = () => {
    form.reset({ 
      taskId: undefined, 
      date: new Date().toISOString().split('T')[0], 
      summary: "", 
      hours: undefined, 
      status: "in_progress" 
    });
    setEditLogId(null);
    setIsCreateOpen(true);
  };

  const openEdit = (log: any) => {
    form.reset({
      taskId: log.taskId || undefined,
      date: log.date.split('T')[0],
      summary: log.summary,
      hours: log.hours || undefined,
      status: log.status,
    });
    setEditLogId(log.id);
    setIsCreateOpen(true);
  };

  const onSubmit = async (values: z.infer<typeof workLogFormSchema>) => {
    try {
      const dataToSubmit = {
        ...values,
        taskId: values.taskId ? Number(values.taskId) : null,
        hours: values.hours ? Number(values.hours) : null,
      };

      if (editLogId) {
        await updateWorkLog.mutateAsync({ id: editLogId, data: dataToSubmit as any });
        toast.success("Work log updated");
      } else {
        await createWorkLog.mutateAsync({ data: dataToSubmit as any });
        toast.success("Work log created");
      }
      queryClient.invalidateQueries({ queryKey: getListWorkLogsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
      setIsCreateOpen(false);
    } catch (e) {
      toast.error(editLogId ? "Failed to update work log" : "Failed to create work log");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this log?")) return;
    try {
      await deleteWorkLog.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListWorkLogsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast.success("Work log deleted");
    } catch (e) {
      toast.error("Failed to delete work log");
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return 'text-emerald-600 border-emerald-200 bg-emerald-50';
      case 'blocked': return 'text-red-600 border-red-200 bg-red-50';
      case 'in_progress': return 'text-blue-600 border-blue-200 bg-blue-50';
      default: return 'text-slate-600 border-slate-200 bg-slate-50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Work Logs</h2>
          <p className="text-muted-foreground">Log your daily progress and updates.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Log Work
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
          <CardTitle className="text-lg">Activity Feed</CardTitle>
          {isAdmin && (
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="h-9 w-[200px]">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All Staff" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {staffList?.map(staff => (
                  <SelectItem key={staff.id} value={staff.id.toString()}>{staff.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : workLogs && workLogs.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    {isAdmin && <TableHead>Staff</TableHead>}
                    <TableHead className="w-1/2">Summary</TableHead>
                    <TableHead>Related Task</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {format(new Date(log.date), 'MMM d, yyyy')}
                      </TableCell>
                      {isAdmin && <TableCell className="whitespace-nowrap">{log.staffName}</TableCell>}
                      <TableCell className="max-w-md">
                        <div className="truncate" title={log.summary}>{log.summary}</div>
                      </TableCell>
                      <TableCell>
                        {log.taskTitle ? (
                          <span className="text-sm text-primary hover:underline cursor-pointer truncate max-w-[150px] inline-block" title={log.taskTitle}>
                            {log.taskTitle}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.hours ? `${log.hours}h` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(log.status || "in_progress")}>
                          {(log.status || "in_progress").replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openEdit(log)}>Edit Log</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleDelete(log.id)}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 border rounded-lg border-dashed">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-medium">No work logs found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isAdmin && staffFilter !== 'all' ? "This staff member hasn't logged any work." : "You haven't logged any work yet."}
              </p>
              {(!isAdmin || staffFilter === 'all') && (
                <Button onClick={openCreate} variant="outline">Log First Work</Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editLogId ? "Edit Work Log" : "Log Work"}</DialogTitle>
            <DialogDescription>
              {editLogId ? "Update your work entry." : "Record your progress for the day."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="hours" render={({ field }) => (
                  <FormItem><FormLabel>Hours Spent</FormLabel><FormControl><Input type="number" step="0.1" min="0" placeholder="e.g. 2.5" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="taskId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Related Task</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value?.toString()}>
                    <FormControl><SelectTrigger><SelectValue placeholder="General work (no task)" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">General work (no task)</SelectItem>
                      {tasksList?.map(task => (
                        <SelectItem key={task.id} value={task.id.toString()}>{task.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Progress Status *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="summary" render={({ field }) => (
                <FormItem>
                  <FormLabel>What did you do? *</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe the work completed..." className="resize-none h-24" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createWorkLog.isPending || updateWorkLog.isPending}>
                  {createWorkLog.isPending || updateWorkLog.isPending ? "Saving..." : "Save Log"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}