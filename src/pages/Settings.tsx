import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Loader2, CheckCircle, Key } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type SharekhanStatus = "checking" | "connected" | "disconnected" | "error";

export default function Settings() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SharekhanStatus>("checking");
  const [connecting, setConnecting] = useState(false);

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
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
