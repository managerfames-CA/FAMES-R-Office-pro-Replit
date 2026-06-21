import { useState } from "react";
import { format } from "date-fns";
import { 
  useGetJournalEntries,
  useUpdateJournalEntry,
  useGetDashboardStats
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DirectionBadge } from "@/components/shared/direction-badge";
import { PnlDisplay } from "@/components/shared/pnl-display";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Save, BrainCircuit, Target, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Journal() {
  const { data: entries, refetch } = useGetJournalEntries({ limit: 50 });
  const { data: stats } = useGetDashboardStats();
  const updateJournal = useUpdateJournalEntry();
  const { toast } = useToast();
  
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<{ [id: number]: string }>({});

  const handleSaveNotes = (id: number) => {
    updateJournal.mutate({ 
      id, 
      data: { userNotes: editingNotes[id] } 
    }, {
      onSuccess: () => {
        toast({ title: "Journal Updated", description: "Your notes have been saved." });
        refetch();
      }
    });
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trade Journal</h1>
          <p className="text-muted-foreground mt-1">Review confirmed B Bot trades and add your own notes.</p>
        </div>
      </div>

      {/* Stats Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50">
          <CardContent className="p-4 flex flex-col justify-center h-24">
            <span className="text-sm font-medium text-muted-foreground mb-1">Total P&L</span>
            <PnlDisplay value={stats?.totalPnl} className="text-xl" />
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4 flex flex-col justify-center h-24">
            <span className="text-sm font-medium text-muted-foreground mb-1">Win Rate</span>
            <span className="text-xl font-bold font-mono">
              {stats?.winRate ? `${stats.winRate.toFixed(1)}%` : '-'}
            </span>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4 flex flex-col justify-center h-24">
            <span className="text-sm font-medium text-muted-foreground mb-1">Total Trades</span>
            <span className="text-xl font-bold font-mono">{stats?.totalTrades || 0}</span>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4 flex flex-col justify-center h-24">
            <span className="text-sm font-medium text-muted-foreground mb-1">Current Streak</span>
            <div className="flex items-center space-x-2">
              {(stats?.winStreak || 0) > 0 ? (
                <span className="text-green-500 font-bold flex items-center"><CheckCircle2 className="w-4 h-4 mr-1"/> {stats?.winStreak} W</span>
              ) : (stats?.lossStreak || 0) > 0 ? (
                <span className="text-destructive font-bold flex items-center"><XCircle className="w-4 h-4 mr-1"/> {stats?.lossStreak} L</span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {entries && entries.length > 0 ? (
          entries.map(entry => (
            <Card key={entry.id} className="overflow-hidden border-border/50">
              {/* Header row (clickable) */}
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleExpand(entry.id)}
              >
                <div className="flex items-center space-x-4 flex-1">
                  {expandedId === entry.id ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                  <div className="w-24 font-bold text-lg">{entry.symbol}</div>
                  <DirectionBadge direction={entry.direction} showLabel={false} className="w-6" />
                  <div className="hidden md:block text-sm text-muted-foreground font-mono ml-4">
                    {format(new Date(entry.closedAt || entry.openedAt), 'MMM dd, HH:mm')}
                  </div>
                  <Badge variant="outline" className="hidden sm:flex ml-4">
                    {entry.strategy}
                  </Badge>
                </div>
                <div className="flex items-center space-x-6">
                  <Badge variant="secondary" className={
                    entry.exitReason?.includes('TP') ? 'text-green-500 bg-green-500/10' : 
                    entry.exitReason === 'SL' ? 'text-destructive bg-destructive/10' : ''
                  }>
                    {entry.exitReason || 'Unknown'}
                  </Badge>
                  <div className="w-24 text-right">
                    <PnlDisplay value={entry.pnl} />
                  </div>
                </div>
              </div>

              {/* Expanded content */}
              {expandedId === entry.id && (
                <div className="border-t border-border/50 bg-muted/10 p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Col: Review */}
                  <div className="space-y-6">
                    <div>
                      <h4 className="flex items-center text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        <Target className="w-4 h-4 mr-2" /> Original Setup
                      </h4>
                      <p className="text-sm text-foreground/80 bg-background border border-border/50 rounded-md p-3">
                        {entry.aiReason}
                      </p>
                    </div>
                    
                    {entry.aiReview && (
                      <div>
                        <h4 className="flex items-center text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          <BrainCircuit className="w-4 h-4 mr-2" /> Post-Trade Review
                        </h4>
                        <div className="bg-primary/5 border border-primary/20 rounded-md p-4 space-y-3">
                          <p className="text-sm text-foreground/90 leading-relaxed">
                            {entry.aiReview}
                          </p>
                          {entry.mistakeSummary && (
                            <div className="pt-3 border-t border-primary/10">
                              <span className="text-xs font-semibold text-amber-500 uppercase">Key Takeaway</span>
                              <p className="text-sm text-amber-500/90 mt-1">{entry.mistakeSummary}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Col: User Notes */}
                  <div className="flex flex-col h-full">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Trader Notes
                    </h4>
                    <Textarea 
                      placeholder="Add your reflections on this trade... How was your execution? Emotions?"
                      className="flex-1 min-h-[150px] resize-none bg-background focus-visible:ring-primary/50"
                      value={editingNotes[entry.id] ?? (entry.userNotes || "")}
                      onChange={(e) => setEditingNotes({ ...editingNotes, [entry.id]: e.target.value })}
                    />
                    <div className="mt-3 flex justify-end">
                      <Button 
                        size="sm" 
                        onClick={() => handleSaveNotes(entry.id)}
                        disabled={updateJournal.isPending || editingNotes[entry.id] === undefined || editingNotes[entry.id] === entry.userNotes}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Notes
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="h-64 flex flex-col items-center justify-center text-muted-foreground">
              <p>Journal is empty.</p>
              <p className="text-sm mt-1">Closed trades will automatically appear here for review.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
