// src/hooks/useSharekhanCallback.ts
// FINAL – Passive Sharekhan OAuth callback hook
// Frontend must NEVER exchange tokens or write to DB

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const useSharekhanCallback = () => {
  const hasHandled = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (hasHandled.current) return;

    const params = new URLSearchParams(window.location.search);
    const connected = params.get("sharekhan_connected");
    const error = params.get("sharekhan_error");

    // Nothing to do → exit silently
    if (!connected && !error) return;

    hasHandled.current = true;

    // Clean URL immediately
    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("sharekhan_connected");
      url.searchParams.delete("sharekhan_error");
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
