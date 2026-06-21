import { useState } from "react";
import { format } from "date-fns";
import { 
  useGetDashboardStats, 
  useGetScannerStatus, 
  useUpdateScannerStatus,
  useGetPerformanceChart,
  useGetLogs,
  useGetOpenTrades,
  useGetSignals
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PnlDisplay } from "@/components/shared/pnl-display";
import { StatusPill } from "@/components/shared/status-pill";
import { DirectionBadge } from "@/components/shared/direction-badge";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, Terminal, Play, Pause, Zap, BarChart3, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({ query: { refetchInterval: 10000 } });
  const { data: scanner, isLoading: scannerLoading } = useGetScannerStatus({ query: { refetchInterval: 10000 } });
  const { data: chartData } = useGetPerformanceChart({ days: 7 });
  const { data: openTrades } = useGetOpenTrades({ query: { refetchInterval: 10000 } });
  const { data: recentSignals } = useGetSignals({ limit: 5 }, { query: { refetchInterval: 10000 } });
  const { data: logs } = useGetLogs({ limit: 50 }, { query: { refetchInterval: 5000 } });
  const updateScanner = useUpdateScannerStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">B Bot Dashboard</h1>
          <p className="text-muted-foreground mt-1">Bybit Demo intraday swing bot status and performance.</p>
        </div>
        
        <Card className="w-full sm:w-auto bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch 
                id="auto-trading" 
                checked={scanner?.running ?? false}
                onCheckedChange={(checked) => updateScanner.mutate({ data: { running: checked } })}
                disabled={scannerLoading || updateScanner.isPending}
              />
              <Label htmlFor="auto-trading" className="font-semibold cursor-pointer">Manual Scanner</Label>
            </div>
            <div className="h-8 w-px bg-border hidden sm:block"></div>
            <div className="flex items-center space-x-2">
              <span className="relative flex h-3 w-3">
                {(scanner?.running ?? false) && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${scanner?.running ? 'bg-green-500' : 'bg-gray-500'}`}></span>
              </span>
              <span className="text-sm font-medium">{scanner?.running ? 'Scanner Active' : 'Scanner Idle'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Bot Trading Capital</p>
                {statsLoading ? <Skeleton className="h-8 w-32" /> : (
                  <div className="text-2xl font-bold font-mono">
                    ${stats?.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/50 flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Today's P&L</span>
              {statsLoading ? <Skeleton className="h-5 w-16" /> : (
                <PnlDisplay value={stats?.todayPnl} percent={stats?.todayPnlPercent} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Session Status</p>
                {statsLoading ? <Skeleton className="h-8 w-24" /> : (
                  <div className="mt-1">
                    <StatusPill status={stats?.sessionStatus} className="text-base px-3 py-1" />
                  </div>
                )}
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Activity className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/50 flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Session P&L</span>
              {statsLoading ? <Skeleton className="h-5 w-16" /> : (
                <PnlDisplay value={stats?.sessionPnl} percent={stats?.sessionPnlPercent} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
                {statsLoading ? <Skeleton className="h-8 w-20" /> : (
                  <div className="text-2xl font-bold font-mono">
                    {stats?.winRate ? `${stats.winRate.toFixed(1)}%` : '-'}
                  </div>
                )}
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Zap className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/50 flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Total Trades</span>
              {statsLoading ? <Skeleton className="h-5 w-10" /> : (
                <span className="font-mono font-medium">{stats?.totalTrades}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Latest Valid Signal</p>
                {statsLoading ? <Skeleton className="h-8 w-24" /> : (
                  <div className="flex items-center space-x-2 mt-1">
                    {stats?.bestSignalSymbol ? (
                      <>
                        <span className="text-xl font-bold">{stats.bestSignalSymbol}</span>
                        <Badge variant="outline" className="border-green-500/40 text-green-400">VALID</Badge>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Scanning...</span>
                    )}
                  </div>
                )}
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/50 flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Open Trades</span>
              {statsLoading ? <Skeleton className="h-5 w-8" /> : (
                <span className="font-mono font-medium">{stats?.openTradesCount || 0} active</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart area */}
        <Card className="col-span-1 lg:col-span-2 flex flex-col">
          <CardHeader className="py-4">
            <CardTitle className="text-base font-semibold">Equity Curve (7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 px-2 pb-4 min-h-[300px]">
            {chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(new Date(val), 'MMM dd')}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    domain={['auto', 'auto']}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `$${val}`}
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    labelFormatter={(val) => format(new Date(val), 'MMM dd, yyyy')}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Balance']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorBalance)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                No performance data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Logs */}
        <Card className="col-span-1 flex flex-col max-h-[400px]">
          <CardHeader className="py-4 border-b border-border/50">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">System Logs</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-[340px] w-full bg-card/50">
              <div className="p-4 space-y-3 font-mono text-xs">
                {logs && logs.length > 0 ? (
                  logs.map((log) => {
                    let color = "text-muted-foreground";
                    if (log.level === "error") color = "text-red-500";
                    if (log.level === "warn") color = "text-amber-500";
                    if (log.level === "signal") color = "text-teal-400";
                    if (log.level === "trade") color = "text-green-400";
                    if (log.level === "info") color = "text-gray-400";

                    return (
                      <div key={log.id} className="flex gap-2 leading-tight">
                        <span className="text-muted-foreground/50 shrink-0">
                          {format(new Date(log.createdAt), 'HH:mm:ss')}
                        </span>
                        <div className="flex-1 break-words">
                          {log.symbol && <span className="font-bold mr-2 text-foreground">{log.symbol}</span>}
                          <span className={color}>{log.message}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-muted-foreground/50 text-center py-4">Waiting for logs...</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open Trades */}
        <Card className="col-span-1">
          <CardHeader className="py-4 border-b border-border/50">
            <CardTitle className="text-base font-semibold">Open Trades</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {openTrades && openTrades.length > 0 ? (
              <div className="divide-y divide-border/50">
                {openTrades.map(trade => (
                  <div key={trade.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold">{trade.symbol}</span>
                        <DirectionBadge direction={trade.direction} />
                        <Badge variant="outline" className="text-[10px] py-0">{trade.strategy}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        Entry: ${trade.entryPrice} • Qty: {trade.quantity}
                      </div>
                    </div>
                    <div className="text-right">
                      <PnlDisplay value={trade.pnl} percent={trade.pnlPercent} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No open trades at the moment
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Signals */}
        <Card className="col-span-1">
          <CardHeader className="py-4 border-b border-border/50">
            <CardTitle className="text-base font-semibold">Recent Signals</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentSignals && recentSignals.length > 0 ? (
              <div className="divide-y divide-border/50">
                {recentSignals.map(signal => (
                  <div key={signal.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold">{signal.symbol}</span>
                        <DirectionBadge direction={signal.direction} showLabel={false} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {signal.strategy} • Closed 1H + 15M confirmation
                      </div>
                    </div>
                    <div className="text-right text-xs font-mono">
                      <div className="text-muted-foreground">EP: ${signal.entryPrice}</div>
                      <div className="text-muted-foreground">SL: ${signal.stopLoss}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Waiting for scanner signals...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
