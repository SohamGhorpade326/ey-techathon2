import { useState, useEffect } from "react";
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
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
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
      const response = await fetch("http://localhost:5000/api/past-bids", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setPastBids(data.data || []);
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
      const response = await fetch("http://localhost:5000/api/past-bids", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
    <MainLayout title="Strategic Insights">
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
                <CardTitle>Win Probability Predictor</CardTitle>
              </div>
              <CardDescription>
                AI-powered prediction based on current RFP and historical performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : winProbability?.success ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Gauge */}
                  <div className="flex flex-col items-center justify-center">
                    <WinProbabilityGauge score={winProbability.win_score} />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={fetchWinProbability}
                    >
                      Refresh Analysis
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
                      <h4 className="font-semibold mb-2">Score Breakdown</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Buyer Match</span>
                          <Badge variant="secondary">+{winProbability.breakdown.buyer_match.toFixed(1)}%</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Domain Expertise</span>
                          <Badge variant="secondary">+{winProbability.breakdown.domain_expertise.toFixed(1)}%</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Value Alignment</span>
                          <Badge variant="secondary">+{winProbability.breakdown.value_alignment.toFixed(1)}%</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Risk Penalty</span>
                          <Badge variant="destructive">-{winProbability.breakdown.risk_penalty.toFixed(1)}%</Badge>
                        </div>
                      </div>
                    </div>

                    <Alert>
                      <Award className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Strategy:</strong> {winProbability.strategy_recommendation}
                      </AlertDescription>
                    </Alert>

                    {winProbability.current_rfp && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>Current RFP:</strong> {winProbability.current_rfp.buyer} ({winProbability.current_rfp.buyer_type})</p>
                        <p><strong>Domain:</strong> {winProbability.current_rfp.domain}</p>
                        <p><strong>Value:</strong> ₹{winProbability.current_rfp.estimated_value} Cr</p>
                      </div>
                    )}
                    
                    {winProbability.historical_context && (
                      <div className="text-xs text-muted-foreground pt-2 border-t">
                        <p><strong>Historical Performance:</strong> {winProbability.historical_context.won_bids} wins / {winProbability.historical_context.total_bids} bids ({winProbability.historical_context.overall_win_rate}% win rate)</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  Bid Value by Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={getBidValueByStatus()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis label={{ value: 'Value (Cr)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value) => `₹${value} Cr`} />
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
                  Win Rate by Domain
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={getWinRateByDomain()}
                      dataKey="won"
                      nameKey="domain"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry) => `${entry.domain} (${entry.winRate}%)`}
                    >
                      {getWinRateByDomain().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Historical Explorer and Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  Historical Bid Explorer
                </CardTitle>
                <CardDescription>
                  Browse all past bids with outcomes and insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bid ID</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Domain</TableHead>
                        <TableHead>Value (Cr)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Days</TableHead>
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
                            <TableCell>{bid.buyer}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{bid.buyer_type}</Badge>
                            </TableCell>
                            <TableCell>{bid.domain}</TableCell>
                            <TableCell>₹{bid.bid_value_cr}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={bid.status === "Won" ? "default" : "destructive"}
                                className={bid.status === "Won" ? "bg-green-600" : ""}
                              >
                                {bid.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{bid.delivery_duration_days || "-"}</TableCell>
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
                  Add Won Bid
                </CardTitle>
                <CardDescription>
                  Capture successful bids to improve predictions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitBid} className="space-y-4">
                  <div>
                    <Label htmlFor="bid_id">Bid ID *</Label>
                    <Input
                      id="bid_id"
                      value={formData.bid_id}
                      onChange={(e) => setFormData({ ...formData, bid_id: e.target.value })}
                      placeholder="BID-001"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="buyer">Buyer *</Label>
                    <Input
                      id="buyer"
                      value={formData.buyer}
                      onChange={(e) => setFormData({ ...formData, buyer: e.target.value })}
                      placeholder="HPCL"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="buyer_type">Buyer Type *</Label>
                    <Select 
                      value={formData.buyer_type}
                      onValueChange={(value) => setFormData({ ...formData, buyer_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PSU">PSU</SelectItem>
                        <SelectItem value="Private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="domain">Domain *</Label>
                    <Input
                      id="domain"
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                      placeholder="Cables"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="bid_value_cr">Value (Cr) *</Label>
                    <Input
                      id="bid_value_cr"
                      type="number"
                      step="0.01"
                      value={formData.bid_value_cr}
                      onChange={(e) => setFormData({ ...formData, bid_value_cr: e.target.value })}
                      placeholder="12.5"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="status">Status *</Label>
                    <Select 
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Won">Won</SelectItem>
                        <SelectItem value="Lost">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="pricing_strategy">Pricing Strategy</Label>
                    <Input
                      id="pricing_strategy"
                      value={formData.pricing_strategy}
                      onChange={(e) => setFormData({ ...formData, pricing_strategy: e.target.value })}
                      placeholder="Premium"
                    />
                  </div>

                  <div>
                    <Label htmlFor="delivery_duration_days">Delivery Days</Label>
                    <Input
                      id="delivery_duration_days"
                      type="number"
                      value={formData.delivery_duration_days}
                      onChange={(e) => setFormData({ ...formData, delivery_duration_days: e.target.value })}
                      placeholder="120"
                    />
                  </div>

                  <div>
                    <Label htmlFor="remarks">Remarks</Label>
                    <Textarea
                      id="remarks"
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      placeholder="Additional notes..."
                      rows={3}
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Bid
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
