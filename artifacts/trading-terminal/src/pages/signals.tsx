import { format } from "date-fns";
import { useGetSignals } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { DirectionBadge } from "@/components/shared/direction-badge";
import { StatusPill } from "@/components/shared/status-pill";
import { Badge } from "@/components/ui/badge";

export default function Signals() {
  const { data: signals, isLoading } = useGetSignals({ limit: 100 }, { query: { refetchInterval: 10000 } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Signals Feed</h1>
        <p className="text-muted-foreground mt-1">Deterministic B Bot strategy matches from closed candles.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-32" /></Card>
          ))
        ) : signals && signals.length > 0 ? (
          signals.map(signal => (
            <Card key={signal.id} className="overflow-hidden border-border/50 hover:border-primary/30 transition-colors">
              <div className="flex flex-col md:flex-row">
                <div className="p-6 md:w-1/4 border-b md:border-b-0 md:border-r border-border/50 bg-muted/10 flex flex-col justify-center">
                  <div className="flex items-center justify-between md:justify-start md:space-x-3 mb-2">
                    <span className="text-2xl font-bold tracking-tight">{signal.symbol}</span>
                    <Badge variant="outline" className="border-green-500/40 text-green-400">VALID</Badge>
                  </div>
                  <div className="flex items-center space-x-3">
                    <DirectionBadge direction={signal.direction} className="text-sm" />
                    <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded bg-background">{signal.strategy}</span>
                  </div>
                </div>

                <div className="p-6 md:w-1/4 border-b md:border-b-0 md:border-r border-border/50 flex flex-col justify-center font-mono text-sm space-y-3">
                  <div className="flex justify-between"><span className="text-muted-foreground">Entry</span><span className="font-bold">${signal.entryPrice}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Stop Loss</span><span className="text-destructive">${signal.stopLoss}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">TP1 (2R)</span><span className="text-green-500">${signal.tp1}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">TP2 (3R)</span><span className="text-green-500">${signal.tp2}</span></div>
                </div>

                <div className="p-6 md:flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Strategy Evidence</h4>
                    <StatusPill status={signal.status} />
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed flex-1 border-l-2 border-primary/30 pl-3">{signal.aiReason}</p>
                  <div className="mt-4 text-xs text-muted-foreground">Found {format(new Date(signal.createdAt), 'MMM dd, HH:mm')}</div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card><CardContent className="h-64 flex flex-col items-center justify-center text-muted-foreground">
            <p className="mb-2">No signals yet.</p>
            <p className="text-sm">Start the scanner manually; valid setups will appear here.</p>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
