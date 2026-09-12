import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ExternalLink, Loader2, CheckCircle, Key, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type SharekhanStatus = "checking" | "connected" | "disconnected" | "error";
type SimulatorMode = "SIGNAL_ONLY" | "SIMULATOR" | "AUTO";

export default function Settings() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SharekhanStatus>("checking");
  const [connecting, setConnecting] = useState(false);
  const [simulatorMode, setSimulatorMode] = useState<SimulatorMode>("SIGNAL_ONLY");
  const [loadingMode, setLoadingMode] = useState(true);
  const [savingMode, setSavingMode] = useState(false);

  // Backend health check (source of truth)
  useEffect(() => {
    if (!user) return;

    const checkHealth = async () => {
      setStatus("checking");

      const { data, error } = await supabase.functions.invoke(
        "sharekhan-auth",
        { body: { action: "health" } }
      );

      if (error) {
        console.error(error);
        setStatus("error");
        return;
      }

      setStatus(data?.status === "AUTH_OK" ? "connected" : "disconnected");
    };

    checkHealth();
  }, [user]);

  // Load current simulator mode from user_settings
  useEffect(() => {
    if (!user) return;

    const loadSettings = async () => {
      setLoadingMode(true);
      const { data, error } = await supabase
        .from("user_settings")
        .select("simulator_mode")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
        toast.error("Failed to load trading mode");
      } else if (data?.simulator_mode) {
        setSimulatorMode(data.simulator_mode as SimulatorMode);
      }
      setLoadingMode(false);
    };

    loadSettings();
  }, [user]);

  const handleModeChange = async (mode: SimulatorMode) => {
    if (!user) return;
    setSavingMode(true);

    const { error } = await supabase
      .from("user_settings")
      .upsert(
        { user_id: user.id, simulator_mode: mode, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error(error);
      toast.error("Failed to update trading mode");
    } else {
      setSimulatorMode(mode);
      toast.success(`Trading mode set to ${mode.replace("_", " ")}`);
    }
    setSavingMode(false);
  };

  // Start Sharekhan OAuth (hard redirect only)
  const connectSharekhan = async () => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }

    setConnecting(true);

    const { data, error } = await supabase.functions.invoke(
      "sharekhan-auth",
      { method: "POST" }
    );

    if (error || !data?.fullUrl) {
      console.error(error);
      toast.error("Failed to start Sharekhan login");
      setConnecting(false);
      return;
    }

    window.location.href = data.fullUrl;
  };

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      <Tabs defaultValue="api" className="space-y-6">
        <TabsList className="bg-secondary/50 p-1">
          <TabsTrigger
            value="api"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Key className="h-4 w-4 mr-2" />
            API Keys
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-foreground">
              Sharekhan Integration
            </h3>

            <div className="p-4 rounded-lg bg-secondary/30 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {status === "checking" && (
                    <>
                      <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                      <span className="text-muted-foreground">
                        Checking connection…
                      </span>
                    </>
                  )}

                  {status === "connected" && (
                    <>
                      <CheckCircle className="h-5 w-5 text-bullish" />
                      <span className="text-bullish font-medium">
                        Connected
                      </span>
                    </>
                  )}

                  {status === "disconnected" && (
                    <span className="text-muted-foreground">Not connected</span>
                  )}

                  {status === "error" && (
                    <span className="text-bearish">Connection error</span>
                  )}
                </div>

                {status !== "connected" && (
                  <Button
                    onClick={connectSharekhan}
                    disabled={connecting || status === "checking"}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Connecting…
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Connect Sharekhan
                      </>
                    )}
                  </Button>
                )}
              </div>

              {status === "connected" && (
                <p className="text-xs text-muted-foreground mt-3">
                  Sharekhan account is connected. Live broker data will be used.
                </p>
              )}
            </div>

            <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-foreground">Trading Mode</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Controls what happens when a signal fires: only display it, or create a paper
                (simulated) trade.
              </p>
              <div className="max-w-xs space-y-2">
                <Label className="text-xs text-muted-foreground">Mode</Label>
                <Select
                  value={simulatorMode}
                  onValueChange={(v: SimulatorMode) => handleModeChange(v)}
                  disabled={loadingMode || savingMode}
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIGNAL_ONLY">Signal Only</SelectItem>
                    <SelectItem value="SIMULATOR">Simulator (Paper Trading)</SelectItem>
                    <SelectItem value="AUTO" disabled>
                      Auto Trading (not yet implemented)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Auto Trading is disabled here because the backend doesn't act on it yet —
                see the note on the Auto Trading page for what's actually wired up.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
