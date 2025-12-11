import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Key,
  Save,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const [settings, setSettings] = useState({
    riskAppetite: "MEDIUM",
    maxPositionSize: 50000,
    defaultStoploss: 2,
    autoTradingEnabled: true,
    notificationsEnabled: true,
    emailAlerts: true,
    pushNotifications: false,
    signalAlerts: true,
    tradeAlerts: true,
    priceAlerts: true,
  });

  const handleSave = () => {
    toast.success("Settings saved successfully!");
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Configure your trading preferences</p>
        </div>
        <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="trading" className="space-y-6">
        <TabsList className="bg-secondary/50 p-1">
          <TabsTrigger value="trading" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <SettingsIcon className="h-4 w-4 mr-2" />
            Trading
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="risk" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Shield className="h-4 w-4 mr-2" />
            Risk Management
          </TabsTrigger>
          <TabsTrigger value="api" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Key className="h-4 w-4 mr-2" />
            API Keys
          </TabsTrigger>
        </TabsList>

        {/* Trading Settings */}
        <TabsContent value="trading">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-foreground">Trading Preferences</h3>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Auto Trading Mode</Label>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                    <div>
                      <p className="font-medium text-foreground">Enable Auto Trading</p>
                      <p className="text-sm text-muted-foreground">Automatically execute virtual trades based on AI signals</p>
                    </div>
                    <Switch 
                      checked={settings.autoTradingEnabled}
                      onCheckedChange={(checked) => setSettings({ ...settings, autoTradingEnabled: checked })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Preferred Sectors</Label>
                  <div className="flex flex-wrap gap-2">
                    {['Banking', 'IT', 'Auto', 'Pharma', 'Energy', 'FMCG'].map((sector) => (
                      <Badge 
                        key={sector} 
                        variant="outline" 
                        className="cursor-pointer hover:bg-primary/10"
                      >
                        {sector}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Signal Confidence Threshold</Label>
                  <p className="text-sm text-muted-foreground mb-2">Minimum confidence score for signals</p>
                  <Slider defaultValue={[70]} max={100} step={5} className="py-4" />
                  <p className="text-sm text-primary font-medium">70%</p>
                </div>

                <div className="space-y-2">
                  <Label>Signal Types</Label>
                  <Select defaultValue="all">
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder="Select signal types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Signals</SelectItem>
                      <SelectItem value="buy">Buy Only</SelectItem>
                      <SelectItem value="sell">Sell Only</SelectItem>
                      <SelectItem value="strong">Strong Signals Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-foreground">Notification Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-medium text-foreground">Email Alerts</p>
                  <p className="text-sm text-muted-foreground">Receive trading alerts via email</p>
                </div>
                <Switch 
                  checked={settings.emailAlerts}
                  onCheckedChange={(checked) => setSettings({ ...settings, emailAlerts: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-medium text-foreground">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">Get instant push notifications</p>
                </div>
                <Switch 
                  checked={settings.pushNotifications}
                  onCheckedChange={(checked) => setSettings({ ...settings, pushNotifications: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-medium text-foreground">Signal Alerts</p>
                  <p className="text-sm text-muted-foreground">Alert when new signals are generated</p>
                </div>
                <Switch 
                  checked={settings.signalAlerts}
                  onCheckedChange={(checked) => setSettings({ ...settings, signalAlerts: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-medium text-foreground">Trade Alerts</p>
                  <p className="text-sm text-muted-foreground">Alert on trade execution and completion</p>
                </div>
                <Switch 
                  checked={settings.tradeAlerts}
                  onCheckedChange={(checked) => setSettings({ ...settings, tradeAlerts: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-medium text-foreground">Price Alerts</p>
                  <p className="text-sm text-muted-foreground">Alert when watchlist stocks hit price targets</p>
                </div>
                <Switch 
                  checked={settings.priceAlerts}
                  onCheckedChange={(checked) => setSettings({ ...settings, priceAlerts: checked })}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Risk Management */}
        <TabsContent value="risk">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-foreground">Risk Management</h3>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Risk Appetite</Label>
                  <Select 
                    value={settings.riskAppetite}
                    onValueChange={(value) => setSettings({ ...settings, riskAppetite: value })}
                  >
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low Risk</SelectItem>
                      <SelectItem value="MEDIUM">Medium Risk</SelectItem>
                      <SelectItem value="HIGH">High Risk</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {settings.riskAppetite === "LOW" && "Conservative approach with lower returns and lower risk"}
                    {settings.riskAppetite === "MEDIUM" && "Balanced approach with moderate risk and returns"}
                    {settings.riskAppetite === "HIGH" && "Aggressive approach with higher potential returns and risk"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Maximum Position Size (₹)</Label>
                  <Input 
                    type="number"
                    value={settings.maxPositionSize}
                    onChange={(e) => setSettings({ ...settings, maxPositionSize: parseInt(e.target.value) || 0 })}
                    className="bg-secondary/50"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Stoploss (%)</Label>
                  <p className="text-sm text-muted-foreground mb-2">Auto-set stoploss percentage for trades</p>
                  <Slider 
                    value={[settings.defaultStoploss]} 
                    onValueChange={(v) => setSettings({ ...settings, defaultStoploss: v[0] })}
                    max={10} 
                    step={0.5} 
                    className="py-4" 
                  />
                  <p className="text-sm text-primary font-medium">{settings.defaultStoploss}%</p>
                </div>

                <div className="space-y-2">
                  <Label>Maximum Daily Loss (₹)</Label>
                  <Input 
                    type="number"
                    defaultValue={5000}
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground">Stop auto-trading when daily loss exceeds this amount</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-foreground">API Configuration</h3>
            <p className="text-sm text-muted-foreground">Connect to market data providers for real-time stock data.</p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Alpha Vantage API Key</Label>
                <div className="flex gap-2">
                  <Input 
                    type="password"
                    placeholder="Enter your API key"
                    className="bg-secondary/50"
                  />
                  <Button variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your free API key at{" "}
                  <a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    alphavantage.co
                  </a>
                </p>
              </div>

              <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
                <p className="text-sm text-foreground">
                  <strong>Note:</strong> Currently using simulated data. Connect your API key for live market data.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
