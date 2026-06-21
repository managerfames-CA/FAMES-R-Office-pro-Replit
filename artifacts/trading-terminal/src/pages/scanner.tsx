import { useState } from "react";
import { format } from "date-fns";
import { 
  useGetScannedPairs,
  useGetScannerStatus
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, Radar, RefreshCw } from "lucide-react";

export default function Scanner() {
  const { data: status } = useGetScannerStatus({ query: { refetchInterval: 10000 } });
  const { data: pairs, isLoading } = useGetScannedPairs({ query: { refetchInterval: 10000 } });
  const [search, setSearch] = useState("");

  const filteredPairs = pairs?.filter(p => p.symbol.toLowerCase().includes(search.toLowerCase())) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Scanner</h1>
          <p className="text-muted-foreground mt-1">Manual Top-50 Bybit Demo scanner using closed 1H and 15M candles.</p>
        </div>
        
        <div className="flex items-center space-x-4 text-sm bg-card/50 px-4 py-2 rounded-lg border border-border/50">
          <div className="flex items-center space-x-2">
            <Radar className={`w-4 h-4 ${status?.running ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
            <span className="font-mono text-muted-foreground">Scanned Today:</span>
            <span className="font-bold">{status?.pairsScanned || 0}</span>
          </div>
          <div className="h-4 w-px bg-border"></div>
          <div className="flex items-center space-x-2 text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="font-mono">{status?.lastScanAt ? format(new Date(status.lastScanAt), 'HH:mm:ss') : 'Waiting...'}</span>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="py-4 border-b border-border/50 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Active Market Scan</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search symbol..."
              className="pl-9 h-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[150px]">Symbol</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">24h Change</TableHead>
                <TableHead className="text-right">24h Volume</TableHead>
                <TableHead className="text-right">Last Scan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse"></div></TableCell>
                    <TableCell><div className="h-4 w-8 bg-muted rounded animate-pulse"></div></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted rounded animate-pulse"></div></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse ml-auto"></div></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse ml-auto"></div></TableCell>
                    <TableCell><div className="h-4 w-20 bg-muted rounded animate-pulse ml-auto"></div></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse ml-auto"></div></TableCell>
                  </TableRow>
                ))
              ) : filteredPairs.length > 0 ? (
                filteredPairs.map((pair) => (
                  <TableRow key={pair.symbol} className="hover:bg-muted/30">
                    <TableCell className="font-bold">{pair.symbol}</TableCell>
                    <TableCell><Badge variant="outline" className={pair.strategy ? "border-green-500/40 text-green-400" : "text-muted-foreground"}>{pair.strategy ? "VALID" : "WAITING"}</Badge></TableCell>
                    <TableCell>
                      {pair.strategy ? (
                        <span className="text-xs text-muted-foreground">{pair.strategy}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {pair.lastPrice < 1 ? pair.lastPrice.toFixed(5) : pair.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm ${pair.priceChangePercent > 0 ? 'text-green-500' : pair.priceChangePercent < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {pair.priceChangePercent > 0 ? '+' : ''}{pair.priceChangePercent.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      ${(pair.volume24h / 1000000).toFixed(1)}M
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {format(new Date(pair.scannedAt), 'HH:mm:ss')}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No pairs found matching your criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
