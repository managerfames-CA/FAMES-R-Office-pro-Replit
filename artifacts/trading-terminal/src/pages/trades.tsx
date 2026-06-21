import { useState } from "react";
import { format } from "date-fns";
import { 
  useGetOpenTrades,
  useGetTrades,
  useCloseTrade,
  GetTradesStatus
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DirectionBadge } from "@/components/shared/direction-badge";
import { StatusPill } from "@/components/shared/status-pill";
import { PnlDisplay } from "@/components/shared/pnl-display";
import { Button } from "@/components/ui/button";
import { XCircle, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Trades() {
  const { data: openTrades, refetch: refetchOpen } = useGetOpenTrades({ query: { refetchInterval: 5000 } });
  const { data: historyTrades, refetch: refetchHistory } = useGetTrades({ status: "closed", limit: 50 });
  const closeTrade = useCloseTrade();
  const { toast } = useToast();

  const handleCloseTrade = (id: number, symbol: string) => {
    closeTrade.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Trade Closed", description: `${symbol} position closed manually.` });
        refetchOpen();
        refetchHistory();
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "Failed to close trade." });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trade Management</h1>
        <p className="text-muted-foreground mt-1">Monitor active positions and review trade history.</p>
      </div>

      <Tabs defaultValue="open" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-6">
          <TabsTrigger value="open">Active Positions ({openTrades?.length || 0})</TabsTrigger>
          <TabsTrigger value="history">Trade History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="open" className="space-y-4">
          {openTrades && openTrades.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {openTrades.map(trade => (
                <Card key={trade.id} className="border-border/50 relative overflow-hidden">
                  {/* Background PnL indicator line */}
                  <div 
                    className={`absolute top-0 left-0 h-1 w-full ${
                      (trade.pnlPercent || 0) > 0 ? 'bg-green-500' : 
                      (trade.pnlPercent || 0) < 0 ? 'bg-destructive' : 'bg-muted'
                    }`} 
                  />
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center space-x-3 mb-1">
                          <span className="text-2xl font-bold">{trade.symbol}</span>
                          <DirectionBadge direction={trade.direction} />
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-[10px] font-normal">{trade.strategy}</Badge>
                          <span>•</span>
                          <span>Opened: {format(new Date(trade.openedAt), 'HH:mm:ss')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-muted-foreground mb-1 block">Live P&L</span>
                        <PnlDisplay value={trade.pnl} percent={trade.pnlPercent} className="text-xl" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-lg font-mono text-sm mb-6 border border-border/50">
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Entry Price</div>
                        <div>${trade.entryPrice}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Current Price</div>
                        <div className="font-bold">${trade.currentPrice || '-'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Stop Loss</div>
                        <div className="text-destructive">${trade.currentSl}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Targets</div>
                        <div className="flex flex-col text-xs">
                          <span className={trade.tp1Hit ? 'text-green-500 line-through' : 'text-green-500/80'}>TP1: ${trade.tp1}</span>
                          <span className={trade.tp2Hit ? 'text-green-500 line-through' : 'text-green-500/80'}>TP2: ${trade.tp2}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        Risk: <span className="font-mono text-foreground">${trade.riskAmount}</span> • 
                        Qty: <span className="font-mono text-foreground">{trade.quantity}</span>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleCloseTrade(trade.id, trade.symbol)}
                        disabled={closeTrade.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Close Position
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <p>No active positions.</p>
                <p className="text-sm mt-1">Start the scanner manually to look for eligible Bybit Demo setups.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="history">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Symbol / Dir</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Open / Close Time</TableHead>
                    <TableHead className="text-right">Entry → Exit</TableHead>
                    <TableHead>Exit Reason</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyTrades && historyTrades.length > 0 ? (
                    historyTrades.map((trade) => (
                      <TableRow key={trade.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="font-bold flex items-center space-x-2">
                            <span>{trade.symbol}</span>
                          </div>
                          <DirectionBadge direction={trade.direction} />
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{trade.strategy}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          <div>{format(new Date(trade.openedAt), 'MMM dd HH:mm')}</div>
                          <div>{trade.closedAt ? format(new Date(trade.closedAt), 'MMM dd HH:mm') : '-'}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          <div className="text-muted-foreground">${trade.entryPrice}</div>
                          <div>${trade.exitPrice || '-'}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            trade.exitReason?.includes('TP') ? 'text-green-500 border-green-500/30' : 
                            trade.exitReason === 'SL' ? 'text-destructive border-destructive/30' : 'text-muted-foreground'
                          }>
                            {trade.exitReason || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <PnlDisplay value={trade.pnl} percent={trade.pnlPercent} />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        No trade history available yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
