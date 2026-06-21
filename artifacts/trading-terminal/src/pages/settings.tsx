import { useEffect, useState } from "react";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Save, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STRATEGIES = [
  "EMA Rejection",
  "Price Action",
  "Trend Pullback",
  "Breakout and Retest",
  "Support/Resistance Rejection",
];

export default function Settings() {
  const { data: settings, isLoading, refetch } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();
  const [capital, setCapital] = useState(1000);
  const [controlToken, setControlToken] = useState("");

  useEffect(() => {
    if (settings) setCapital(settings.startingCapital);
    setControlToken(localStorage.getItem("bbot-control-token") || "");
  }, [settings]);

  const handleSave = () => {
    localStorage.setItem("bbot-control-token", controlToken.trim());
    updateSettings.mutate({ data: { startingCapital: capital } }, {
      onSuccess: () => {
        toast({ title: "Settings Saved", description: "B Bot Trading Capital and local control token were updated." });
        refetch();
      },
      onError: (error) => {
        toast({ variant: "destructive", title: "Save Failed", description: error instanceof Error ? error.message : "Check APP_ADMIN_TOKEN." });
      },
    });
  };

  if (isLoading || !settings) return <div className="text-muted-foreground">Loading settings...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">B Bot Configuration</h1>
        <p className="text-muted-foreground mt-1">Bybit Demo V1 locked rules and controlled settings.</p>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending || capital <= 0 || !controlToken.trim()}>
          <Save className="w-4 h-4 mr-2" /> Save Controlled Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Risk Management</CardTitle>
            <CardDescription>Only Bot Trading Capital is editable in Demo V1.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Bot Trading Capital (USDT)</Label>
              <Input type="number" min="1" step="0.01" value={capital} onChange={(event) => setCapital(Number(event.target.value))} />
              <p className="text-xs text-muted-foreground">Risk per trade: {(capital * 0.01).toFixed(2)} USDT (1%).</p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border p-3"><div className="text-muted-foreground">Risk</div><div className="font-bold">1%</div></div>
              <div className="rounded-md border p-3"><div className="text-muted-foreground">Open Trades</div><div className="font-bold">Max 3</div></div>
              <div className="rounded-md border p-3"><div className="text-muted-foreground">Leverage</div><div className="font-bold">1×–5×</div></div>
              <div className="rounded-md border p-3"><div className="text-muted-foreground">Cooldown</div><div className="font-bold">4 hours</div></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><ShieldCheck className="w-5 h-5 mr-2" /> App Control</CardTitle>
            <CardDescription>The token is stored only in this browser and sent as an app-control header.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>APP_ADMIN_TOKEN</Label>
              <Input type="password" autoComplete="off" value={controlToken} onChange={(event) => setControlToken(event.target.value)} placeholder="Same value as Replit Secret" />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm">Environment</span><Badge>BYBIT DEMO</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm">Real Mode</span><Badge variant="outline">DISABLED</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Scanner starts manually and returns to STOPPED after every backend restart.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Locked Strategy Set</CardTitle>
          <CardDescription>OR logic: any one valid strategy plus one aligned 15M confirmation may qualify a trade.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {STRATEGIES.map(strategy => <Badge key={strategy} variant="secondary" className="px-3 py-1">{strategy}</Badge>)}
        </CardContent>
      </Card>
    </div>
  );
}
