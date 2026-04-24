import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPendingWorkLogs,
  useApproveWorkLog,
  useRejectWorkLog,
  getListPendingWorkLogsQueryKey,
  getListWorkLogsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Inbox, Clock, User as UserIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Redirect } from "wouter";

export default function PendingApprovals() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [reviewing, setReviewing] = useState<{ id: number; mode: "approve" | "reject"; staffName: string } | null>(null);
  const [notes, setNotes] = useState("");

  const { data: pending, isLoading } = useListPendingWorkLogs({
    query: { queryKey: getListPendingWorkLogsQueryKey(), enabled: isAdmin },
  });

  const approve = useApproveWorkLog();
  const reject = useRejectWorkLog();

  if (!isAdmin) return <Redirect to="/" />;

  const closeDialog = () => {
    setReviewing(null);
    setNotes("");
  };

  const submit = async () => {
    if (!reviewing) return;
    try {
      if (reviewing.mode === "approve") {
        await approve.mutateAsync({ id: reviewing.id, data: { notes: notes || null } });
        toast.success("Work log approved");
      } else {
        await reject.mutateAsync({ id: reviewing.id, data: { notes: notes || null } });
        toast.success("Work log sent back to staff");
      }
      queryClient.invalidateQueries({ queryKey: getListPendingWorkLogsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListWorkLogsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      closeDialog();
    } catch {
      toast.error("Action failed. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pending Approvals</h2>
        <p className="text-muted-foreground">
          Review staff work submissions and approve or send them back with notes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Inbox className="h-5 w-5 text-primary" /> Awaiting your review
          </CardTitle>
          <CardDescription>
            {pending?.length
              ? `${pending.length} submission${pending.length === 1 ? "" : "s"} from your team`
              : "Nothing waiting on you right now."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : pending && pending.length > 0 ? (
            <div className="space-y-4">
              {pending.map((log) => (
                <div key={log.id} className="rounded-lg border p-4 hover:bg-accent/40 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-start gap-4 justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <Clock className="h-3 w-3 mr-1" /> Submitted
                        </Badge>
                        <span className="flex items-center gap-1">
                          <UserIcon className="h-3 w-3" />
                          <span className="font-medium text-foreground">{log.staffName}</span>
                        </span>
                        <span>•</span>
                        <span>{format(new Date(log.date), "EEE, MMM d, yyyy")}</span>
                        {log.hours != null && (
                          <>
                            <span>•</span>
                            <span>{log.hours}h</span>
                          </>
                        )}
                        {log.taskTitle && (
                          <>
                            <span>•</span>
                            <span className="text-primary">{log.taskTitle}</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-line">{log.summary}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReviewing({ id: log.id, mode: "reject", staffName: log.staffName });
                          setNotes("");
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-1.5 text-destructive" /> Send back
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setReviewing({ id: log.id, mode: "approve", staffName: log.staffName });
                          setNotes("");
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border rounded-lg border-dashed">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500/60 mb-3" />
              <h3 className="text-lg font-medium">All caught up</h3>
              <p className="text-sm text-muted-foreground">
                No staff submissions are waiting on your review.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewing?.mode === "approve" ? "Approve work log" : "Send back to staff"}
            </DialogTitle>
            <DialogDescription>
              {reviewing?.mode === "approve"
                ? `Approve ${reviewing?.staffName}'s submission. You can attach an optional note.`
                : `Ask ${reviewing?.staffName} to revise this submission. A note helps them know what to fix.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Review notes (optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                reviewing?.mode === "approve"
                  ? "Nice work! Approved."
                  : "Please add the client name and how long it took."
              }
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              variant={reviewing?.mode === "reject" ? "destructive" : "default"}
              disabled={approve.isPending || reject.isPending}
            >
              {reviewing?.mode === "approve" ? "Confirm approval" : "Send back"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
