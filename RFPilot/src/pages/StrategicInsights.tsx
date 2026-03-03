import { useState, useEffect, useMemo } from "react";
import { useT } from "@/hooks/useT";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { PieChart } from "@mui/x-charts/PieChart";
import { TrendingUp, Database, PlusCircle, Info, Target, Award } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Type definitions
interface PastBid {
  bid_id: string;
  buyer: string;
  buyer_type: "PSU" | "Private";
  domain: string;
  bid_value_cr: number;
  status: "Won" | "Lost";
  pricing_strategy?: string;
  delivery_duration_days?: number;
  remarks?: string;
  createdAt?: string;
}

interface WinProbability {
  success: boolean;
  win_score: number;
  strategy_recommendation: string;
  message?: string;
  breakdown: {
    buyer_match: number;
    domain_expertise: number;
    value_alignment: number;
    risk_penalty: number;
  };
  current_rfp?: {
    buyer: string;
    buyer_type: string;
    domain: string;
    estimated_value: number;
    delivery_days: number;
  };
  historical_context?: {
    total_bids: number;
    won_bids: number;
    lost_bids: number;
    overall_win_rate: number;
  };
}

export default function StrategicInsights() {
  const { t, registerText, lang } = useT();
  const title = t("StrategicInsights.title", "Strategic Insights");
  const [pastBids, setPastBids] = useState<PastBid[]>([]);
  const [winProbability, setWinProbability] = useState<WinProbability | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    bid_id: "",
    buyer: "",
    buyer_type: "PSU",
    domain: "",
    bid_value_cr: "",
    status: "Won",
    pricing_strategy: "",
    delivery_duration_days: "",
    remarks: "",
  });

  // Fetch past bids from Node.js backend
  const fetchPastBids = async () => {
    try {
      const token = localStorage.getItem("token");
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${API_BASE}/api/past-bids`, {
        headers,
      });
      
      if (response.ok) {
        const data = await response.json();
        setPastBids(data.data || []);
        try {
          // register per-bid dynamic strings for translation
          (data.data || []).forEach((b: PastBid) => {
            registerText && registerText(`StrategicInsights.pastbid.${b.bid_id}.buyer`, b.buyer || "");
            registerText && registerText(`StrategicInsights.pastbid.${b.bid_id}.domain`, b.domain || "");
            registerText && registerText(`StrategicInsights.pastbid.${b.bid_id}.buyer_type`, b.buyer_type || "");
            registerText && registerText(`StrategicInsights.pastbid.${b.bid_id}.pricing_strategy`, b.pricing_strategy || "");
          });
        } catch (e) {
          // ignore
        }
      } else {
        console.error("Failed to fetch past bids");
      }
    } catch (error) {
      console.error("Error fetching past bids:", error);
    }
  };

  // Fetch win probability from FastAPI backend
  const fetchWinProbability = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:8000/analytics/win-probability");
      
      if (response.ok) {
        const data = await response.json();
        setWinProbability(data);
      } else {
        console.error("Failed to fetch win probability");
      }
    } catch (error) {
      console.error("Error fetching win probability:", error);
    } finally {
      setLoading(false);
    }
  };

  // Submit new past bid
  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem("token");
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${API_BASE}/api/past-bids`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...formData,
          bid_value_cr: parseFloat(formData.bid_value_cr),
          delivery_duration_days: formData.delivery_duration_days ? parseInt(formData.delivery_duration_days) : undefined,
        }),
      });

      if (response.ok) {
        // Reset form
        setFormData({
          bid_id: "",
          buyer: "",
          buyer_type: "PSU",
          domain: "",
          bid_value_cr: "",
          status: "Won",
          pricing_strategy: "",
          delivery_duration_days: "",
          remarks: "",
        });
        
        // Refresh data
        fetchPastBids();
        fetchWinProbability();
        
        alert("Past bid added successfully!");
      } else {
        const error = await response.json();
        alert(`Failed to add bid: ${error.message}`);
      }
    } catch (error) {
      console.error("Error submitting bid:", error);
      alert("Error submitting bid");
    }
  };

  useEffect(() => {
    fetchPastBids();
    fetchWinProbability();
  }, []);

  useEffect(() => {
    try {
      registerText && registerText("StrategicInsights.title","Strategic Insights");
      registerText && registerText("StrategicInsights.win.title","Win Probability Predictor");
      registerText && registerText("StrategicInsights.win.desc","AI-powered prediction based on current RFP and historical performance");
      registerText && registerText("StrategicInsights.win.refresh","Refresh Analysis");

      registerText && registerText("StrategicInsights.breakdown.title","Score Breakdown");
      registerText && registerText("StrategicInsights.breakdown.buyer","Buyer Match");
      registerText && registerText("StrategicInsights.breakdown.domain","Domain Expertise");
      registerText && registerText("StrategicInsights.breakdown.value","Value Alignment");
      registerText && registerText("StrategicInsights.breakdown.risk","Risk Penalty");
      registerText && registerText("StrategicInsights.strategy","Strategy:");

      registerText && registerText("StrategicInsights.currentRFP.title","Current RFP:");
      registerText && registerText("StrategicInsights.currentRFP.domain","Domain:");
      registerText && registerText("StrategicInsights.currentRFP.value","Value:");
      registerText && registerText("StrategicInsights.historical.title","Historical Performance:");

      registerText && registerText("StrategicInsights.chart.bidValue","Bid Value by Status");
      registerText && registerText("StrategicInsights.chart.winRate","Win Rate by Domain");

      registerText && registerText("StrategicInsights.table.title","Historical Bid Explorer");
      registerText && registerText("StrategicInsights.table.desc","Browse all past bids with outcomes and insights");
      registerText && registerText("StrategicInsights.table.col.bidId","Bid ID");
      registerText && registerText("StrategicInsights.table.col.buyer","Buyer");
      registerText && registerText("StrategicInsights.table.col.type","Type");
      registerText && registerText("StrategicInsights.table.col.domain","Domain");
      registerText && registerText("StrategicInsights.table.col.value","Value (Cr)");
      registerText && registerText("StrategicInsights.table.col.status","Status");
      registerText && registerText("StrategicInsights.table.col.days","Days");
      registerText && registerText("StrategicInsights.table.noData","No past bids found");

      registerText && registerText("StrategicInsights.form.title","Add Won Bid");
      registerText && registerText("StrategicInsights.form.desc","Capture successful bids to improve predictions");
      registerText && registerText("StrategicInsights.form.bidId","Bid ID *");
      registerText && registerText("StrategicInsights.form.buyer","Buyer *");
      registerText && registerText("StrategicInsights.form.buyerType","Buyer Type *");
      registerText && registerText("StrategicInsights.form.domain","Domain *");
      registerText && registerText("StrategicInsights.form.value","Value (Cr) *");
      registerText && registerText("StrategicInsights.form.status","Status *");
      registerText && registerText("StrategicInsights.form.addBtn","Add Bid");

      // dynamic texts
      registerText && registerText("StrategicInsights.win.strategy", winProbability?.strategy_recommendation || "");
    } catch (e) {
      // ignore
    }
  }, [winProbability, pastBids]);

  const localizeDigits = (v: string | number | undefined | null) => {
    if (v === undefined || v === null) return "";
    const s = String(v);
    if (!lang || (lang !== 'hi' && lang !== 'mr')) return s;
    const map: Record<string,string> = { '0':'०','1':'१','2':'२','3':'३','4':'४','5':'५','6':'६','7':'७','8':'८','9':'९' };
    return s.replace(/[0-9]/g, d => map[d] || d);
  }

  const formatPercent = (v: number) => {
    const s = `${v.toFixed(1)}%`;
    if (!lang || (lang !== 'hi' && lang !== 'mr')) return s;
    return localizeDigits(s);
  }

  const formatCurrency = (v: number) => {
    const s = `₹${v.toLocaleString('en-IN')}`;
    if (!lang || (lang !== 'hi' && lang !== 'mr')) return s;
    return localizeDigits(s);
  }

  // Prepare chart data
  const getBidValueByStatus = () => {
    const wonTotal = pastBids
      .filter(b => b.status === "Won")
      .reduce((sum, b) => sum + b.bid_value_cr, 0);
    const lostTotal = pastBids
      .filter(b => b.status === "Lost")
      .reduce((sum, b) => sum + b.bid_value_cr, 0);

    return [
      { status: "Won", value: wonTotal },
      { status: "Lost", value: lostTotal },
    ];
  };

  const getWinRateByDomain = () => {
    const domainMap = new Map<string, { won: number; total: number }>();
    
    pastBids.forEach(bid => {
      const current = domainMap.get(bid.domain) || { won: 0, total: 0 };
      current.total += 1;
      if (bid.status === "Won") current.won += 1;
      domainMap.set(bid.domain, current);
    });

    return Array.from(domainMap.entries()).map(([domain, stats]) => ({
      domain,
      winRate: ((stats.won / stats.total) * 100).toFixed(1),
      won: stats.won,
      lost: stats.total - stats.won,
    }));
  };

  const COLORS = {
    Won: "#10b981",
    Lost: "#ef4444",
  };

  const mutedPieColors = [
    "#4F5DFF",
    "#F4C35A",
    "#F35D6B",
    "#35BDF2",
    "#4ECB92",
    "#9B8CFF",
  ];

  const winRatePieData = useMemo(() => {
    // derive pie data from backend-provided `pastBids` via getWinRateByDomain()
    // Use percentage value so the chart shows per-domain win-rate clearly
    return getWinRateByDomain().map((entry, index) => ({
      id: index,
      value: Number(entry.winRate), // percentage (0-100)
      label: `${entry.domain} (${entry.won}/${entry.won + entry.lost}) ${entry.winRate}%`,
      color: mutedPieColors[index % mutedPieColors.length],
      won: entry.won,
      total: entry.won + entry.lost,
    }));
  }, [pastBids]);

  // Circular gauge for win probability
  const WinProbabilityGauge = ({ score }: { score: number }) => {
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    
    const getColor = (score: number) => {
      if (score >= 70) return "#10b981";
      if (score >= 50) return "#f59e0b";
      return "#ef4444";
    };

    return (
      <div className="relative flex items-center justify-center">
        <svg width="200" height="200" className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="12"
          />
          {/* Progress circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={getColor(score)}
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <div className="text-4xl font-bold" style={{ color: getColor(score) }}>
            {score}%
          </div>
          <div className="text-sm text-muted-foreground">Win Probability</div>
        </div>
      </div>
    );
  };

  return (
     <MainLayout title={title}>
      <div className="space-y-6">
        {/* Win Predictor Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <CardTitle>{t ? t("StrategicInsights.win.title","Win Probability Predictor") : "Win Probability Predictor"}</CardTitle>
              </div>
              <CardDescription>
                {t ? t("StrategicInsights.win.desc","AI-powered prediction based on current RFP and historical performance") : "AI-powered prediction based on current RFP and historical performance"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : winProbability?.success ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {/* Gauge */}
                  <div className="flex flex-col items-center justify-center">
                    <WinProbabilityGauge score={winProbability.win_score} />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={fetchWinProbability}
                    >
                      {t ? t("StrategicInsights.win.refresh","Refresh Analysis") : "Refresh Analysis"}
                    </Button>
                  </div>

                  {/* Breakdown and Recommendation */}
                  <div className="space-y-4">
                    {/* Show warning if score is based on baseline */}
                    {winProbability.win_score > 0 && 
                     winProbability.breakdown.buyer_match === 0 && 
                     winProbability.breakdown.domain_expertise === 0 && 
                     winProbability.breakdown.value_alignment === 0 && (
                      <Alert className="border-yellow-600 bg-yellow-50 dark:bg-yellow-950">
                        <Info className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-sm">
                          <strong>Baseline Score:</strong> This probability is based on your overall historical win rate. 
                          Process an RFP through the <a href="/master-agent" className="underline font-semibold">Master Agent</a> for detailed analysis.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div>
                      <h4 className="font-semibold mb-2">{t ? t("StrategicInsights.breakdown.title","Score Breakdown") : "Score Breakdown"}</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">{t ? t("StrategicInsights.breakdown.buyer","Buyer Match") : "Buyer Match"}</span>
                          <Badge variant="secondary">+{formatPercent(winProbability.breakdown.buyer_match)}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">{t ? t("StrategicInsights.breakdown.domain","Domain Expertise") : "Domain Expertise"}</span>
                          <Badge variant="secondary">+{formatPercent(winProbability.breakdown.domain_expertise)}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">{t ? t("StrategicInsights.breakdown.value","Value Alignment") : "Value Alignment"}</span>
                          <Badge variant="secondary">+{formatPercent(winProbability.breakdown.value_alignment)}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">{t ? t("StrategicInsights.breakdown.risk","Risk Penalty") : "Risk Penalty"}</span>
                          <Badge variant="destructive">-{formatPercent(winProbability.breakdown.risk_penalty)}</Badge>
                        </div>
                      </div>
                    </div>

                    <Alert>
                      <Award className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{t ? t("StrategicInsights.strategy","Strategy:") : "Strategy:"}</strong> {t ? t("StrategicInsights.win.strategy", winProbability.strategy_recommendation) : winProbability.strategy_recommendation}
                      </AlertDescription>
                    </Alert>

                    {winProbability.current_rfp && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>{t ? t("StrategicInsights.currentRFP.title","Current RFP:") : "Current RFP:"}</strong> {winProbability.current_rfp.buyer} ({winProbability.current_rfp.buyer_type})</p>
                        <p><strong>{t ? t("StrategicInsights.currentRFP.domain","Domain:") : "Domain:"}</strong> {winProbability.current_rfp.domain}</p>
                        <p><strong>{t ? t("StrategicInsights.currentRFP.value","Value:") : "Value:"}</strong> {formatCurrency(winProbability.current_rfp.estimated_value)} Cr</p>
                      </div>
                    )}
                    
                    {winProbability.historical_context && (
                      <div className="text-xs text-muted-foreground pt-2 border-t">
                        <p><strong>{t ? t("StrategicInsights.historical.title","Historical Performance:") : "Historical Performance:"}</strong> {localizeDigits(winProbability.historical_context.won_bids)} wins / {localizeDigits(winProbability.historical_context.total_bids)} bids ({formatPercent(winProbability.historical_context.overall_win_rate)} win rate)</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {winProbability?.message || "Process an RFP to see win probability analysis"}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {/* Bar Chart - Bid Value by Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  {t ? t("StrategicInsights.chart.bidValue","Bid Value by Status") : "Bid Value by Status"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={getBidValueByStatus()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis label={{ value: t ? t("StrategicInsights.table.col.value","Value (Cr)") : 'Value (Cr)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.25 }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Pie Chart - Win Rate by Domain */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  {t ? t("StrategicInsights.chart.winRate","Win Rate by Domain") : "Win Rate by Domain"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="p-5 rounded-lg bg-white/5 border border-white/5">
                    <div className="h-[250px] w-full">
                      <PieChart
                        series={[
                          {
                            data: winRatePieData,
                            outerRadius: 100,
                            paddingAngle: 2,
                            highlightScope: { fade: "global", highlight: "item" },
                            faded: {
                              innerRadius: 30,
                              additionalRadius: -12,
                              color: "hsl(var(--muted))",
                            },
                          },
                        ]}
                        height={250}
                        slotProps={{ legend: { sx: { display: "none" } } }}
                        sx={{
                          ".MuiChartsTooltip-paper": {
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--foreground))",
                          },
                        }}
                      />
                    </div>
                  </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Historical Explorer and Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          {/* Historical Explorer - 2/3 width */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  {t ? t("StrategicInsights.table.title","Historical Bid Explorer") : "Historical Bid Explorer"}
                </CardTitle>
                <CardDescription>
                  {t ? t("StrategicInsights.table.desc","Browse all past bids with outcomes and insights") : "Browse all past bids with outcomes and insights"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t ? t("StrategicInsights.table.col.bidId","Bid ID") : "Bid ID"}</TableHead>
                        <TableHead>{t ? t("StrategicInsights.table.col.buyer","Buyer") : "Buyer"}</TableHead>
                        <TableHead>{t ? t("StrategicInsights.table.col.type","Type") : "Type"}</TableHead>
                        <TableHead>{t ? t("StrategicInsights.table.col.domain","Domain") : "Domain"}</TableHead>
                        <TableHead>{t ? t("StrategicInsights.table.col.value","Value (Cr)") : "Value (Cr)"}</TableHead>
                        <TableHead>{t ? t("StrategicInsights.table.col.status","Status") : "Status"}</TableHead>
                        <TableHead>{t ? t("StrategicInsights.table.col.days","Days") : "Days"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pastBids.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No past bids found
                          </TableCell>
                        </TableRow>
                      ) : (
                        pastBids.map((bid) => (
                          <TableRow key={bid.bid_id}>
                            <TableCell className="font-mono text-sm">{bid.bid_id}</TableCell>
                            <TableCell>{t ? t(`StrategicInsights.pastbid.${bid.bid_id}.buyer`, bid.buyer) : bid.buyer}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{t ? t(`StrategicInsights.pastbid.${bid.bid_id}.buyer_type`, bid.buyer_type) : bid.buyer_type}</Badge>
                            </TableCell>
                            <TableCell>{t ? t(`StrategicInsights.pastbid.${bid.bid_id}.domain`, bid.domain) : bid.domain}</TableCell>
                            <TableCell>{formatCurrency(bid.bid_value_cr)}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={bid.status === "Won" ? "default" : "destructive"}
                                className={bid.status === "Won" ? "bg-green-600" : ""}
                              >
                                {t ? t(`StrategicInsights.status.${bid.status}`, bid.status) : bid.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{bid.delivery_duration_days ? localizeDigits(bid.delivery_duration_days) : "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Success Capture Form - 1/3 width */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="lg:col-span-1"
          >
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5" />
                  {t ? t("StrategicInsights.form.title","Add Won Bid") : "Add Won Bid"}
                </CardTitle>
                <CardDescription>
                  {t ? t("StrategicInsights.form.desc","Capture successful bids to improve predictions") : "Capture successful bids to improve predictions"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitBid} className="space-y-4">
                  <div>
                    <Label htmlFor="bid_id">{t ? t("StrategicInsights.form.bidId","Bid ID *") : "Bid ID *"}</Label>
                    <Input
                      id="bid_id"
                      value={formData.bid_id}
                      onChange={(e) => setFormData({ ...formData, bid_id: e.target.value })}
                      placeholder={t ? t("StrategicInsights.form.bidIdPlaceholder","BID-001") : "BID-001"}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="buyer">{t ? t("StrategicInsights.form.buyer","Buyer *") : "Buyer *"}</Label>
                    <Input
                      id="buyer"
                      value={formData.buyer}
                      onChange={(e) => setFormData({ ...formData, buyer: e.target.value })}
                      placeholder={t ? t("StrategicInsights.form.buyerPlaceholder","HPCL") : "HPCL"}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="buyer_type">{t ? t("StrategicInsights.form.buyerType","Buyer Type *") : "Buyer Type *"}</Label>
                    <Select 
                      value={formData.buyer_type}
                      onValueChange={(value) => setFormData({ ...formData, buyer_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PSU">{t ? t("StrategicInsights.buyerType.PSU","PSU") : "PSU"}</SelectItem>
                        <SelectItem value="Private">{t ? t("StrategicInsights.buyerType.Private","Private") : "Private"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="domain">{t ? t("StrategicInsights.form.domain","Domain *") : "Domain *"}</Label>
                    <Input
                      id="domain"
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                      placeholder={t ? t("StrategicInsights.form.domainPlaceholder","Cables") : "Cables"}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="bid_value_cr">{t ? t("StrategicInsights.form.value","Value (Cr) *") : "Value (Cr) *"}</Label>
                    <Input
                      id="bid_value_cr"
                      type="number"
                      step="0.01"
                      value={formData.bid_value_cr}
                      onChange={(e) => setFormData({ ...formData, bid_value_cr: e.target.value })}
                      placeholder={t ? t("StrategicInsights.form.valuePlaceholder","12.5") : "12.5"}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="status">{t ? t("StrategicInsights.form.status","Status *") : "Status *"}</Label>
                    <Select 
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Won">{t ? t("StrategicInsights.status.Won","Won") : "Won"}</SelectItem>
                        <SelectItem value="Lost">{t ? t("StrategicInsights.status.Lost","Lost") : "Lost"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="pricing_strategy">{t ? t("StrategicInsights.form.pricingStrategy","Pricing Strategy") : "Pricing Strategy"}</Label>
                    <Input
                      id="pricing_strategy"
                      value={formData.pricing_strategy}
                      onChange={(e) => setFormData({ ...formData, pricing_strategy: e.target.value })}
                      placeholder={t ? t("StrategicInsights.form.pricingPlaceholder","Premium") : "Premium"}
                    />
                  </div>

                  <div>
                    <Label htmlFor="delivery_duration_days">{t ? t("StrategicInsights.form.deliveryDays","Delivery Days") : "Delivery Days"}</Label>
                    <Input
                      id="delivery_duration_days"
                      type="number"
                      value={formData.delivery_duration_days}
                      onChange={(e) => setFormData({ ...formData, delivery_duration_days: e.target.value })}
                      placeholder={t ? t("StrategicInsights.form.deliveryPlaceholder","120") : "120"}
                    />
                  </div>

                  <div>
                    <Label htmlFor="remarks">{t ? t("StrategicInsights.form.remarks","Remarks") : "Remarks"}</Label>
                    <Textarea
                      id="remarks"
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      placeholder={t ? t("StrategicInsights.form.remarksPlaceholder","Additional notes...") : "Additional notes..."}
                      rows={3}
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    {t ? t("StrategicInsights.form.addBtn","Add Bid") : "Add Bid"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </MainLayout>
  );
}
