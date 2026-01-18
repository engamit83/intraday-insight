// src/hooks/useSharekhanCallback.ts
// FINAL – Passive Sharekhan OAuth callback handler
// IMPORTANT: This hook must NEVER exchange tokens or write to DB

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const useSharekhanCallback = () => {
  const handledRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (handledRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const connected = params.get("sharekhan_connected");
    const error = params.get("sharekhan_error");

    // Nothing to do → exit quietly
    if (!connected && !error) return;

    handledRef.current = true;

    // Clean URL immediately (no retrigger on refresh)
    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.search = "";
      window.history.replaceState({}, document.title, url.pathname);
    };

    if (connected === "true") {
      toast.success("Sharekhan connected successfully");
      cleanUrl();
      navigate("/settings", { replace: true });
      return;
    }

    if (error) {
      toast.error(`Sharekhan connection failed: ${error}`);
      cleanUrl();
      navigate("/settings", { replace: true });
      return;
    }
  }, [navigate]);
};
