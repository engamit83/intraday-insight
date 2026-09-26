// src/pages/SharekhanCallback.tsx
//
// Why this page exists: Sharekhan's OAuth callback only ever sends back
// `request_token` — it does NOT echo back a `state` parameter, despite the
// original backend code assuming it would (confirmed by testing: the real
// callback URL only ever contains `?request_token=...`, nothing else).
// So the backend has no reliable way to know *which app user* just logged
// in from a plain server-side redirect alone.
//
// The fix: Sharekhan redirects here, into the actual running app, where the
// user is already logged in (their Supabase session lives in this browser).
// We read `request_token` from the URL and hand it to the backend via
// supabase.functions.invoke, which automatically attaches the user's real
// auth token. The backend still does 100% of the actual token exchange and
// encryption — this page never touches Sharekhan's API directly.

import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type Status = "processing" | "success" | "error";

export default function SharekhanCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasRun = useRef(false);
  const [status, setStatus] = useState<Status>("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const requestToken = searchParams.get("request_token");

    if (!requestToken) {
      setStatus("error");
      setErrorMessage("No request_token received from Sharekhan.");
      return;
    }

    const completeLogin = async () => {
      const { data, error } = await supabase.functions.invoke("sharekhan-auth", {
        body: { action: "complete_login", requestToken },
      });

      if (error || data?.error) {
        console.error(error || data?.error);
        setStatus("error");
        setErrorMessage(data?.error || "Failed to complete Sharekhan login.");
        return;
      }

      setStatus("success");
      toast.success("Sharekhan connected successfully");
      setTimeout(() => navigate("/settings", { replace: true }), 1500);
    };

    completeLogin();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="glass-card rounded-xl p-8 max-w-sm w-full text-center space-y-4">
        {status === "processing" && (
          <>
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <p className="text-foreground font-medium">Completing Sharekhan connection...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-10 w-10 mx-auto text-bullish" />
            <p className="text-foreground font-medium">Connected! Redirecting to Settings...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-10 w-10 mx-auto text-bearish" />
            <p className="text-foreground font-medium">Connection failed</p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <button
              className="text-sm text-primary underline"
              onClick={() => navigate("/settings", { replace: true })}
            >
              Back to Settings
            </button>
          </>
        )}
      </div>
    </div>
  );
}
