import { NavLink } from "@/components/NavLink";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Activity, 
  BookOpen, 
  Settings, 
  Zap,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: TrendingUp, label: "Signals", path: "/signals" },
  { icon: Zap, label: "Auto Trading", path: "/auto-trading" },
  { icon: BookOpen, label: "Manual Trades", path: "/manual-trades" },
  { icon: BarChart3, label: "Watchlist", path: "/watchlist" },
  { icon: Activity, label: "Performance", path: "/performance" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 glow-effect">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">TRD App</h1>
            <p className="text-xs text-muted-foreground">Intraday Trading</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              activeClassName="bg-primary/10 text-primary glow-effect"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Market Status */}
        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-lg bg-secondary/50 p-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-bullish animate-pulse" />
              <span className="text-xs font-medium text-foreground">Market Open</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">09:15 AM - 03:30 PM IST</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
