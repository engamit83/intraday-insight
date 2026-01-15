import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";
import Dashboard from "./pages/Dashboard";
import Signals from "./pages/Signals";
import AutoTrading from "./pages/AutoTrading";
import ManualTrades from "./pages/ManualTrades";
import Watchlist from "./pages/Watchlist";
import Performance from "./pages/Performance";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { useSharekhanCallback } from "./hooks/useSharekhanCallback";

const queryClient = new QueryClient();

const AppContent = () => {
  useSharekhanCallback();
  
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
      <Route path="/signals" element={<AuthGuard><Signals /></AuthGuard>} />
      <Route path="/auto-trading" element={<AuthGuard><AutoTrading /></AuthGuard>} />
      <Route path="/manual-trades" element={<AuthGuard><ManualTrades /></AuthGuard>} />
      <Route path="/watchlist" element={<AuthGuard><Watchlist /></AuthGuard>} />
      <Route path="/performance" element={<AuthGuard><Performance /></AuthGuard>} />
      <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />
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
