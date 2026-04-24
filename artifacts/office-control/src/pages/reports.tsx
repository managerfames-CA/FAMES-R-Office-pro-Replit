import { useGetTaskStatusReport, useGetRevenueReport, useGetStaffPerformance, useGetAttendanceSummary, getGetTaskStatusReportQueryKey, getGetRevenueReportQueryKey, getGetStaffPerformanceQueryKey, getGetAttendanceSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { BarChart3, PieChart as PieChartIcon, Users, CalendarDays } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Reports() {
  const { data: revenueData, isLoading: loadingRevenue } = useGetRevenueReport({ query: { queryKey: getGetRevenueReportQueryKey() } });
  const { data: taskData, isLoading: loadingTasks } = useGetTaskStatusReport({ query: { queryKey: getGetTaskStatusReportQueryKey() } });
  const { data: staffData, isLoading: loadingStaff } = useGetStaffPerformance({ query: { queryKey: getGetStaffPerformanceQueryKey() } });
  const { data: attendanceData, isLoading: loadingAttendance } = useGetAttendanceSummary({ query: { queryKey: getGetAttendanceSummaryQueryKey() } });

  // Format task data for pie chart
  const formattedTaskData = taskData?.map(d => ({
    name: d.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: d.count
  })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reports & Analytics</h2>
        <p className="text-muted-foreground">Insights into your business performance.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-primary" />
              Revenue & Invoiced (Last 6 Months)
            </CardTitle>
            <CardDescription>Monthly comparison of generated invoices vs collected revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRevenue ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                      axisLine={false} 
                      tickLine={false}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
                    />
                    <Legend />
                    <Bar dataKey="invoiced" name="Invoiced" fill="hsl(var(--primary)/0.3)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="revenue" name="Revenue Collected" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Task Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChartIcon className="h-5 w-5 text-primary" />
              Task Distribution
            </CardTitle>
            <CardDescription>Current status of all active tasks</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTasks ? (
              <Skeleton className="h-[300px] w-full" />
            ) : formattedTaskData.length > 0 ? (
              <div className="h-[300px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={formattedTaskData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {formattedTaskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No task data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              7-Day Attendance
            </CardTitle>
            <CardDescription>Daily staff presence</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAttendance ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return `${d.getMonth()+1}/${d.getDate()}`;
                      }}
                      axisLine={false} 
                      tickLine={false} 
                    />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString()}
                    />
                    <Legend />
                    <Bar dataKey="present" stackId="a" name="Present" fill="#10b981" />
                    <Bar dataKey="late" stackId="a" name="Late" fill="#f59e0b" />
                    <Bar dataKey="absent" stackId="a" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Staff Performance */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Staff Performance
            </CardTitle>
            <CardDescription>Task completion and hours logged by team members</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStaff ? (
              <Skeleton className="h-[200px] w-full" />
            ) : staffData && staffData.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead className="text-right">Tasks Completed</TableHead>
                      <TableHead className="text-right">Tasks In Progress</TableHead>
                      <TableHead className="text-right">Hours Logged</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffData.map((staff) => (
                      <TableRow key={staff.staffId}>
                        <TableCell className="font-medium">{staff.staffName}</TableCell>
                        <TableCell className="text-right">{staff.tasksCompleted}</TableCell>
                        <TableCell className="text-right">{staff.tasksInProgress}</TableCell>
                        <TableCell className="text-right">{staff.hoursLogged}h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No staff performance data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}