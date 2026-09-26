// src/pages/SharekhanCallback.tsx
//
// Two real bugs fixed here, both confirmed via live testing:
//
// 1. Sharekhan's OAuth callback only ever returns `request_token` — it never
//    echoes back a `state` parameter. So identity can't come from the URL;
//    it comes from this page running inside the user's own logged-in
//    session, which calls the backend with their real Supabase auth token.
//
// 2. request_token values contain literal, non-percent-encoded '+'
//    characters. Reading them via useSearchParams/URLSearchParams silently
//    converts '+' to a space (per the application/x-www-form-urlencoded
//    spec those APIs follow), corrupting the token before it's ever used.
//    Extracted manually here instead, matching how Sharekhan's own
//    reference SDK (Python's urllib.parse.unquote) leaves '+' untouched.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type Status = "processing" | "success" | "error";

export default function SharekhanCallback() {
  const navigate = useNavigate();
  const hasRun = useRef(false);
  const [status, setStatus] = useState<Status>("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const rawMatch = window.location.search.match(/[?&]request_token=([^&]+)/);
    const requestToken = rawMatch ? decodeURIComponent(rawMatch[1]) : null;

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
  }, [navigate]);

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
            <p className="text-sm text-muted-foreground break-words">{errorMessage}</p>
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
