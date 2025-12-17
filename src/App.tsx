import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Signals from "./pages/Signals";
import AutoTrading from "./pages/AutoTrading";
import ManualTrades from "./pages/ManualTrades";
import Watchlist from "./pages/Watchlist";
import Performance from "./pages/Performance";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { useSharekhanCallback } from "./hooks/useSharekhanCallback";

const queryClient = new QueryClient();

const AppContent = () => {
  useSharekhanCallback();
  
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/signals" element={<Signals />} />
      <Route path="/auto-trading" element={<AutoTrading />} />
      <Route path="/manual-trades" element={<ManualTrades />} />
      <Route path="/watchlist" element={<Watchlist />} />
      <Route path="/performance" element={<Performance />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
