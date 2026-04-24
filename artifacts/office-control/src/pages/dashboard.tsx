import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetUpcomingTasks,
  useGetTodayAttendance,
  useCheckIn,
  useCheckOut,
  useListWorkLogs,
  useListPendingWorkLogs,
  getGetDashboardSummaryQueryKey,
  getGetRecentActivityQueryKey,
  getGetTodayAttendanceQueryKey,
  getListPendingWorkLogsQueryKey,
  getListWorkLogsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useFirmBranding } from "@/hooks/use-firm-branding";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Building2,
  CheckSquare,
  Clock,
  CalendarDays,
  FileText,
  BarChart3,
  Bell,
  ArrowRight,
  UserSquare2,
  Play,
  Square,
  Activity,
  Inbox,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  return isAdmin ? <AdminDashboard userName={user?.name ?? ""} /> : <StaffDashboard userName={user?.name ?? ""} />;
}

/* ─────────────────────────  ADMIN  ───────────────────────── */

function AdminDashboard({ userName }: { userName: string }) {
  const queryClient = useQueryClient();
  const { name: firmName } = useFirmBranding();

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });
  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey() },
  });
  const { data: pending, isLoading: loadingPending } = useListPendingWorkLogs({
    query: { queryKey: getListPendingWorkLogsQueryKey() },
  });

  const stats = [
    { title: "Active Staff", value: summary?.activeStaff ?? 0, icon: Users, link: "/staff", color: "text-blue-600", bg: "bg-blue-500/10" },
    { title: "Present Today", value: summary?.presentToday ?? 0, icon: UserSquare2, link: "/attendance", color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { title: "Pending Approvals", value: pending?.length ?? 0, icon: Inbox, link: "/pending-approvals", color: "text-amber-600", bg: "bg-amber-500/10" },
    { title: "Open Tasks", value: summary?.openTasks ?? 0, icon: CheckSquare, link: "/tasks", color: "text-indigo-600", bg: "bg-indigo-500/10" },
    { title: "Overdue Tasks", value: summary?.overdueTasks ?? 0, icon: Clock, link: "/tasks", color: "text-red-600", bg: "bg-red-500/10" },
    { title: "Total Clients", value: summary?.totalClients ?? 0, icon: Building2, link: "/clients", color: "text-cyan-600", bg: "bg-cyan-500/10" },
    { title: "Pending Invoices", value: summary?.pendingInvoices ?? 0, icon: FileText, link: "/invoices", color: "text-violet-600", bg: "bg-violet-500/10" },
    { title: "Revenue (Month)", value: summary ? `$${summary.revenueThisMonth.toLocaleString()}` : "$0", icon: BarChart3, link: "/reports", color: "text-teal-600", bg: "bg-teal-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome back, {userName.split(" ")[0]}
          </h2>
          <p className="text-muted-foreground">
            Control center for {firmName} — monitor your team and approve work.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/staff">
              <UserSquare2 className="mr-2 h-4 w-4" /> Add Staff
            </Link>
          </Button>
          <Button asChild>
            <Link href="/pending-approvals">
              <Inbox className="mr-2 h-4 w-4" />
              Review {pending?.length ?? 0}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {loadingSummary
          ? Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-4 w-1/2 mb-3" /><Skeleton className="h-7 w-1/3" /></CardContent></Card>
            ))
          : stats.map((s, i) => (
              <motion.div key={s.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link href={s.link}>
                  <Card className="hover:bg-accent/40 transition-colors cursor-pointer h-full">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-muted-foreground">{s.title}</p>
                        <div className={`p-2 rounded-md ${s.bg}`}>
                          <s.icon className={`h-4 w-4 ${s.color}`} />
                        </div>
                      </div>
                      <div className="text-2xl font-bold">{s.value}</div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Inbox className="h-5 w-5 text-amber-600" /> Pending approvals
              </CardTitle>
              <CardDescription>Latest staff submissions awaiting your review</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/pending-approvals" className="text-xs">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loadingPending ? (
              <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
            ) : pending && pending.length > 0 ? (
              <div className="space-y-3">
                {pending.slice(0, 4).map((log) => (
                  <Link key={log.id} href="/pending-approvals">
                    <div className="flex items-start justify-between gap-3 p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <span className="font-medium text-foreground">{log.staffName}</span>
                          <span>·</span>
                          <span>{format(new Date(log.date), "MMM d")}</span>
                          {log.hours != null && (<><span>·</span><span>{log.hours}h</span></>)}
                        </div>
                        <p className="text-sm line-clamp-2">{log.summary}</p>
                      </div>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                        Submitted
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground border rounded-lg border-dashed">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/60" />
                <p>You're all caught up.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingActivity ? (
              <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-4">
                {activity.slice(0, 6).map((item, i, arr) => (
                  <div key={item.id} className="flex gap-3 relative">
                    {i !== arr.length - 1 && (
                      <div className="absolute left-4 top-8 bottom-0 w-px bg-border -ml-px" />
                    )}
                    <div className="relative z-10 flex-none h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="flex-1 pb-3">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {format(new Date(item.createdAt), "MMM d, h:mm a")}
                      </p>
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
    </div>
  );
}

/* ─────────────────────────  STAFF  ───────────────────────── */

function StaffDashboard({ userName }: { userName: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: upcomingTasks, isLoading: loadingTasks } = useGetUpcomingTasks({
    query: { queryKey: ["/api/tasks/upcoming"] },
  });
  const { data: attendance, isLoading: loadingAttendance } = useGetTodayAttendance({
    query: { queryKey: getGetTodayAttendanceQueryKey() },
  });
  const { data: myLogs, isLoading: loadingLogs } = useListWorkLogs(
    { staffId: user?.id },
    { query: { queryKey: getListWorkLogsQueryKey({ staffId: user?.id }), enabled: !!user?.id } },
  );

  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const handleCheckIn = async () => {
    try {
      await checkIn.mutateAsync({ data: {} });
      queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
      toast.success("Checked in. Have a great day.");
    } catch {
      toast.error("Could not check in");
    }
  };
  const handleCheckOut = async () => {
    try {
      await checkOut.mutateAsync({ data: {} });
      queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
      toast.success("Checked out. See you tomorrow.");
    } catch {
      toast.error("Could not check out");
    }
  };

  const myOpenTasks = (upcomingTasks ?? []).filter(
    (t) => t.assigneeId === user?.id && t.status !== "done",
  );
  const recentLogs = (myLogs ?? []).slice(0, 5);
  const submittedCount = recentLogs.filter((l) => l.approvalStatus === "submitted").length;
  const rejectedCount = recentLogs.filter((l) => l.approvalStatus === "rejected").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Hi {userName.split(" ")[0]}, ready to work?
          </h2>
          <p className="text-muted-foreground">Your day at a glance — tasks, attendance and logs.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/work-logs"><Clock className="mr-2 h-4 w-4" /> Log work</Link>
          </Button>
          <Button asChild>
            <Link href="/tasks"><CheckSquare className="mr-2 h-4 w-4" /> My Tasks</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-primary/20 bg-gradient-to-br from-primary/5 to-emerald-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Today
            </CardTitle>
            <CardDescription>{format(new Date(), "EEEE, MMMM do")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingAttendance ? (
              <Skeleton className="h-24 w-full" />
            ) : attendance ? (
              <>
                <div className="flex items-center justify-between bg-background p-3 rounded-lg border">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium capitalize flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${attendance.status === "present" ? "bg-emerald-500" : "bg-amber-500"}`} />
                      {attendance.status}
                    </p>
                  </div>
                  {attendance.checkIn && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Checked In</p>
                      <p className="font-medium">{format(new Date(attendance.checkIn), "h:mm a")}</p>
                    </div>
                  )}
                </div>
                {!attendance.checkOut && attendance.checkIn ? (
                  <Button onClick={handleCheckOut} disabled={checkOut.isPending} variant="outline" className="w-full">
                    <Square className="mr-2 h-4 w-4" /> Check out
                  </Button>
                ) : !attendance.checkIn ? (
                  <Button onClick={handleCheckIn} disabled={checkIn.isPending} className="w-full">
                    <Play className="mr-2 h-4 w-4" /> Check in
                  </Button>
                ) : (
                  <div className="text-center text-sm bg-muted/50 rounded p-3">
                    Logged out at {attendance.checkOut ? format(new Date(attendance.checkOut), "h:mm a") : ""}.
                  </div>
                )}
              </>
            ) : (
              <Button onClick={handleCheckIn} disabled={checkIn.isPending} className="w-full h-12">
                <Play className="mr-2 h-5 w-5" /> Check in for today
              </Button>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <MiniStat label="Awaiting review" value={submittedCount} tone="amber" />
              <MiniStat label="Sent back" value={rejectedCount} tone={rejectedCount > 0 ? "red" : "muted"} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-primary" /> My open tasks
              </CardTitle>
              <CardDescription>What needs your attention</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tasks" className="text-xs">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loadingTasks ? (
              <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            ) : myOpenTasks.length > 0 ? (
              <div className="space-y-2">
                {myOpenTasks.slice(0, 6).map((task) => (
                  <Link key={task.id} href="/tasks">
                    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${task.priority === "urgent" || task.priority === "high" ? "bg-red-500" : "bg-blue-500"}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.dueDate ? `Due ${format(new Date(task.dueDate), "MMM d")}` : "No due date"}
                            {task.clientName ? ` · ${task.clientName}` : ""}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize shrink-0">{task.status.replace("_", " ")}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 border rounded-lg border-dashed">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/60" />
                <p className="text-sm text-muted-foreground">All clear — no open tasks assigned to you.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> My recent work logs
            </CardTitle>
            <CardDescription>Submit completed work for your manager to approve.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/work-logs" className="text-xs">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
          ) : recentLogs.length > 0 ? (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span>{format(new Date(log.date), "MMM d, yyyy")}</span>
                      {log.hours != null && (<><span>·</span><span>{log.hours}h</span></>)}
                      {log.taskTitle && (<><span>·</span><span className="text-primary truncate">{log.taskTitle}</span></>)}
                    </div>
                    <p className="text-sm line-clamp-2">{log.summary}</p>
                    {log.reviewNotes && log.approvalStatus === "rejected" && (
                      <p className="text-xs mt-1 text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {log.reviewNotes}
                      </p>
                    )}
                  </div>
                  <ApprovalBadge status={log.approvalStatus} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 border rounded-lg border-dashed">
              <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground mb-3">No work logs yet — record your first one.</p>
              <Button variant="outline" asChild><Link href="/work-logs">Log work</Link></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "amber" | "red" | "muted" }) {
  const colors = {
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-red-50 text-red-800 border-red-200",
    muted: "bg-muted/50 text-muted-foreground border-muted",
  } as const;
  return (
    <div className={`rounded-md border p-2 ${colors[tone]}`}>
      <div className="text-xs">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

export function ApprovalBadge({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
        </Badge>
      );
    case "submitted":
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          <Inbox className="h-3 w-3 mr-1" /> Submitted
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <XCircle className="h-3 w-3 mr-1" /> Sent back
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
          Draft
        </Badge>
      );
  }
}
