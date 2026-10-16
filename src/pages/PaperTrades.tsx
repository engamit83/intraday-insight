import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FlaskConical, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Automatic paper trades (no real money) made by the paper-trader job with rule set v4.
// Read-only screen: newest day first, one table per day with the day's net result after costs.

type PaperRow = {
  id: string;
  symbol: string;
  direction: string | null;
  entry_price: number;
  exit_price: number | null;
  stoploss: number | null;
  target: number | null;
  status: string | null;
  exit_reason: string | null;
  pnl: number | null;
  net_pct: number | null;
  entry_time: string | null;
  exit_time: string | null;
};

const IST_MS = 5.5 * 60 * 60 * 1000;
const istDay = (iso: string | null) => (iso ? new Date(Date.parse(iso) + IST_MS).toISOString().slice(0, 10) : "?");
const istTime = (iso: string | null) => (iso ? new Date(Date.parse(iso) + IST_MS).toISOString().slice(11, 16) : "—");
const rs = (n: number) => `${n < 0 ? "−" : "+"}₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;
const px = (n: number | null) => (n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

const REASON: Record<string, string> = {
  stop: "Stop loss hit",
  breakeven: "Stop at cost hit",
  lockedstop: "Raised stop hit",
  target: "Target hit",
  squareoff: "Closed at 15:15",
};

export default function PaperTrades() {
  const [rows, setRows] = useState<PaperRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("simulated_trades")
      .select("id, symbol, direction, entry_price, exit_price, stoploss, target, status, exit_reason, pnl, net_pct, entry_time, exit_time")
      .eq("rules", "v4")
      .gte("entry_time", since)
      .order("entry_time", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Failed to load paper trades");
      setRows([]);
    } else {
      setRows((data ?? []) as PaperRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // refresh every minute while the page is open
    return () => clearInterval(t);
  }, []);

  const days = [...new Set(rows.map((r) => istDay(r.entry_time)))];
  const closedAll = rows.filter((r) => r.status === "CLOSED");
  const netAll = closedAll.reduce((a, r) => a + Number(r.pnl ?? 0), 0);
  const winsAll = closedAll.filter((r) => Number(r.pnl) > 0).length;

  return (
    <MainLayout>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paper Trades</h1>
          <p className="text-muted-foreground">Automatic practice trades with no real money. Results are after all costs.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-6">
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Trades (30 days)</p>
          <p className="text-2xl font-bold">{closedAll.length}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Wins</p>
          <p className="text-2xl font-bold">{winsAll}{closedAll.length ? ` (${Math.round((winsAll / closedAll.length) * 100)}%)` : ""}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Net result</p>
          <p className={`text-2xl font-bold ${netAll >= 0 ? "text-bullish" : "text-bearish"}`}>{closedAll.length ? rs(netAll) : "—"}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Open now</p>
          <p className="text-2xl font-bold">{rows.filter((r) => r.status === "OPEN").length}</p>
        </div>
      </div>

      {!loading && rows.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <FlaskConical className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No paper trades yet</h3>
          <p className="text-muted-foreground">A paper trade opens automatically for every new signal between 10:00 and 14:00.</p>
        </div>
      )}

      {days.map((day) => {
        const list = rows.filter((r) => istDay(r.entry_time) === day);
        const closed = list.filter((r) => r.status === "CLOSED");
        const net = closed.reduce((a, r) => a + Number(r.pnl ?? 0), 0);
        const wins = closed.filter((r) => Number(r.pnl) > 0).length;
        return (
          <div key={day} className="glass-card rounded-xl p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-semibold">{day}</h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{closed.length} closed, {wins} wins</span>
                {closed.length > 0 && (
                  <Badge className={net >= 0 ? "bg-bullish/20 text-bullish" : "bg-bearish/20 text-bearish"}>{rs(net)}</Badge>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stock</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead className="text-right">Entry</TableHead>
                    <TableHead className="text-right">Stop / Target</TableHead>
                    <TableHead>Out</TableHead>
                    <TableHead className="text-right">Exit</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((r) => {
                    const p = Number(r.pnl ?? 0);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.symbol}</TableCell>
                        <TableCell className={r.direction === "BUY" ? "text-bullish" : "text-bearish"}>{r.direction}</TableCell>
                        <TableCell>{istTime(r.entry_time)}</TableCell>
                        <TableCell className="text-right">{px(r.entry_price)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{px(r.stoploss)} / {px(r.target)}</TableCell>
                        <TableCell>{r.status === "OPEN" ? "—" : istTime(r.exit_time)}</TableCell>
                        <TableCell className="text-right">{px(r.exit_price)}</TableCell>
                        <TableCell>{r.status === "OPEN" ? <Badge variant="outline">Open</Badge> : REASON[r.exit_reason ?? ""] ?? r.exit_reason}</TableCell>
                        <TableCell className={`text-right font-medium ${r.status === "OPEN" ? "" : p >= 0 ? "text-bullish" : "text-bearish"}`}>
                          {r.status === "OPEN" ? "—" : `${rs(p)} (${Number(r.net_pct ?? 0).toFixed(2)}%)`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })}
    </MainLayout>
  );
}
