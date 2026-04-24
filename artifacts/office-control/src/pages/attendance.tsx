import { useState } from "react";
import { useListAttendance, useCheckIn, useCheckOut, useGetTodayAttendance, useListStaff, getListAttendanceQueryKey, getGetTodayAttendanceQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Square, CalendarDays, Filter, User as UserIcon } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Attendance() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [staffFilter, setStaffFilter] = useState<string>("all");

  const { data: attendance, isLoading } = useListAttendance({
    staffId: isAdmin && staffFilter !== "all" ? Number(staffFilter) : undefined,
  });
  const { data: todayAttendance, isLoading: loadingToday } = useGetTodayAttendance({ query: { queryKey: getGetTodayAttendanceQueryKey() } });
  const { data: staffList } = useListStaff();

  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const handleCheckIn = async () => {
    try {
      await checkIn.mutateAsync({ data: {} });
      queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast.success("Checked in successfully");
    } catch (e) {
      toast.error("Failed to check in");
    }
  };

  const handleCheckOut = async () => {
    try {
      await checkOut.mutateAsync({ data: {} });
      queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast.success("Checked out successfully");
    } catch (e) {
      toast.error("Failed to check out");
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'present': return 'text-emerald-600 bg-emerald-100 border-emerald-200';
      case 'late': return 'text-amber-600 bg-amber-100 border-amber-200';
      case 'absent': return 'text-red-600 bg-red-100 border-red-200';
      case 'on_leave': return 'text-blue-600 bg-blue-100 border-blue-200';
      default: return 'text-slate-600 bg-slate-100 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Attendance</h2>
          <p className="text-muted-foreground">Track daily check-ins and working hours.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Today's Status</CardTitle>
            <CardDescription>{format(new Date(), 'EEEE, MMMM do')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingToday ? (
              <Skeleton className="h-24 w-full" />
            ) : todayAttendance ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-background p-4 rounded-lg border">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium capitalize text-lg flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${todayAttendance.status === 'present' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {todayAttendance.status}
                    </p>
                  </div>
                  {todayAttendance.checkIn && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Checked In</p>
                      <p className="font-medium">{format(new Date(todayAttendance.checkIn), 'h:mm a')}</p>
                    </div>
                  )}
                </div>
                
                {!todayAttendance.checkOut && todayAttendance.checkIn ? (
                  <Button onClick={handleCheckOut} disabled={checkOut.isPending} className="w-full" variant="outline">
                    <Square className="mr-2 h-4 w-4" />
                    Check Out Now
                  </Button>
                ) : !todayAttendance.checkIn ? (
                  <Button onClick={handleCheckIn} disabled={checkIn.isPending} className="w-full">
                    <Play className="mr-2 h-4 w-4" />
                    Check In
                  </Button>
                ) : (
                  <div className="text-center p-3 rounded bg-muted/50 text-sm">
                    You have checked out for the day at {todayAttendance.checkOut ? format(new Date(todayAttendance.checkOut), 'h:mm a') : ''}.
                  </div>
                )}
              </div>
            ) : (
              <Button onClick={handleCheckIn} disabled={checkIn.isPending} className="w-full h-12 text-base">
                <Play className="mr-2 h-5 w-5" />
                Check In for Today
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
            <CardTitle className="text-lg">Recent History</CardTitle>
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
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : attendance && attendance.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      {isAdmin && <TableHead>Staff</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead>Time In</TableHead>
                      <TableHead>Time Out</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {format(new Date(record.date), 'MMM d, yyyy')}
                        </TableCell>
                        {isAdmin && <TableCell>{record.staffName}</TableCell>}
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(record.status)}>
                            {record.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.checkIn ? format(new Date(record.checkIn), 'h:mm a') : '-'}
                        </TableCell>
                        <TableCell>
                          {record.checkOut ? format(new Date(record.checkOut), 'h:mm a') : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.hoursWorked ? `${record.hoursWorked}h` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 border rounded-lg border-dashed">
                <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                <h3 className="text-lg font-medium">No attendance records</h3>
                <p className="text-sm text-muted-foreground">
                  Records will appear here once staff members check in.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}