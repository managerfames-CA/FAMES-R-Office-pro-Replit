import { useGetDashboardSummary, useGetRecentActivity, useGetUpcomingTasks, useGetTodayAttendance, useCheckIn, useCheckOut, getGetDashboardSummaryQueryKey, getGetRecentActivityQueryKey, getGetTodayAttendanceQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Building2, CheckSquare, Clock, CalendarDays, FileText, BarChart3, Bell, ArrowRight, UserSquare2, Play, Square, Activity } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity({ query: { queryKey: getGetRecentActivityQueryKey() } });
  const { data: upcomingTasks, isLoading: loadingTasks } = useGetUpcomingTasks({ query: { queryKey: ["/api/tasks/upcoming"] } });
  const { data: attendance, isLoading: loadingAttendance } = useGetTodayAttendance({ query: { queryKey: getGetTodayAttendanceQueryKey() } });

  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const handleCheckIn = async () => {
    try {
      await checkIn.mutateAsync({ data: {} });
      queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
      toast.success("Checked in successfully");
    } catch (e) {
      toast.error("Failed to check in");
    }
  };

  const handleCheckOut = async () => {
    try {
      await checkOut.mutateAsync({ data: {} });
      queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
      toast.success("Checked out successfully");
    } catch (e) {
      toast.error("Failed to check out");
    }
  };

  const stats = [
    { title: "Active Staff", value: summary?.activeStaff || 0, icon: Users, link: "/staff", color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Total Clients", value: summary?.totalClients || 0, icon: Building2, link: "/clients", color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { title: "Open Tasks", value: summary?.openTasks || 0, icon: CheckSquare, link: "/tasks", color: "text-amber-500", bg: "bg-amber-500/10" },
    { title: "Overdue Tasks", value: summary?.overdueTasks || 0, icon: Clock, link: "/tasks?status=overdue", color: "text-red-500", bg: "bg-red-500/10" },
    { title: "Tasks Due Today", value: summary?.tasksDueToday || 0, icon: CalendarDays, link: "/tasks?due=today", color: "text-orange-500", bg: "bg-orange-500/10" },
    { title: "Pending Invoices", value: summary?.pendingInvoices || 0, icon: FileText, link: "/invoices?status=draft,sent", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Revenue (Month)", value: summary ? `$${summary.revenueThisMonth.toLocaleString()}` : "$0", icon: BarChart3, link: "/reports", color: "text-teal-500", bg: "bg-teal-500/10" },
    { title: "Present Today", value: summary?.presentToday || 0, icon: UserSquare2, link: "/attendance", color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { title: "Unread Notifications", value: summary?.unreadNotifications || 0, icon: Bell, link: "/notifications", color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome back, {user?.name?.split(' ')[0]} 👋</h2>
          <p className="text-muted-foreground">Here's what's happening in your office today.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/tasks">
              <CheckSquare className="mr-2 h-4 w-4" />
              New Task
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {loadingSummary ? (
          Array.from({ length: 9 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-8 w-1/3" />
              </CardContent>
            </Card>
          ))
        ) : (
          stats.map((stat, i) => (
            <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link href={stat.link}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-muted">
                  <CardContent className="p-5 flex flex-col justify-center">
                    <div className="flex items-center justify-between space-y-0 pb-2">
                      <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                      <div className={`p-2 rounded-md ${stat.bg}`}>
                        <stat.icon className={`h-4 w-4 ${stat.color}`} />
                      </div>
                    </div>
                    <div className="text-2xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Upcoming Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Upcoming Tasks
                </CardTitle>
                <CardDescription>Tasks due soon</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/tasks" className="text-xs">
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loadingTasks ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : upcomingTasks && upcomingTasks.length > 0 ? (
                <div className="space-y-3">
                  {upcomingTasks.map((task) => (
                    <Link key={task.id} href={`/tasks?id=${task.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${task.priority === 'high' || task.priority === 'urgent' ? 'bg-red-500' : 'bg-blue-500'}`} />
                          <div>
                            <p className="font-medium text-sm group-hover:text-primary transition-colors">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.clientName && `${task.clientName} • `}
                              {task.dueDate ? `Due ${format(new Date(task.dueDate), 'MMM d')}` : 'No due date'}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize">{task.status.replace('_', ' ')}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                  <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No upcoming tasks</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingActivity ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : activity && activity.length > 0 ? (
                <div className="space-y-4">
                  {activity.map((item, i) => (
                    <div key={item.id} className="flex gap-4 relative">
                      {i !== activity.length - 1 && (
                        <div className="absolute left-4 top-8 bottom-0 w-px bg-border -ml-px" />
                      )}
                      <div className="relative z-10 flex-none h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.message}</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">{format(new Date(item.createdAt), 'MMM d, h:mm a')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Today's Attendance */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Today's Status
              </CardTitle>
              <CardDescription>{format(new Date(), 'EEEE, MMMM do')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {loadingAttendance ? (
                <Skeleton className="h-24 w-full" />
              ) : attendance ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-background p-4 rounded-lg border">
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="font-medium capitalize text-lg flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${attendance.status === 'present' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {attendance.status}
                      </p>
                    </div>
                    {attendance.checkIn && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Checked In</p>
                        <p className="font-medium">{format(new Date(attendance.checkIn), 'h:mm a')}</p>
                      </div>
                    )}
                  </div>
                  
                  {!attendance.checkOut && attendance.checkIn ? (
                    <Button onClick={handleCheckOut} disabled={checkOut.isPending} className="w-full" variant="outline">
                      <Square className="mr-2 h-4 w-4" />
                      Check Out Now
                    </Button>
                  ) : !attendance.checkIn ? (
                    <Button onClick={handleCheckIn} disabled={checkIn.isPending} className="w-full">
                      <Play className="mr-2 h-4 w-4" />
                      Check In
                    </Button>
                  ) : (
                    <div className="text-center p-3 rounded bg-muted/50 text-sm">
                      You have checked out for the day at {attendance.checkOut ? format(new Date(attendance.checkOut), 'h:mm a') : ''}.
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
        </div>
      </div>
    </div>
  );
}