import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  TrendingUp,
  AlertTriangle,
  Package,
  DollarSign,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PieChart } from "@mui/x-charts/PieChart";
import { useT } from "@/hooks/useT";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const API_BASE = "http://localhost:5000/api/sku-gap";

interface Summary {
  total_items: number;
  avg_match_percent: number;
  full_count: number;
  partial_count: number;
  incomplete_count: number;
  total_missing_specs: number;
}

interface DomainAnalysis {
  domain: string;
  total_gaps: number;
  avg_match: number;
}

interface SpecFrequency {
  spec_name: string;
  count: number;
}

interface MatchDistribution {
  high: number;
  medium: number;
  low: number;
}

interface Recommendation {
  spec_name: string;
  frequency: number;
  suggestion: string;
  impact_level: string;
}

interface Timeline {
  date: string;
  avg_match: number;
}

interface RiskValue {
  risk_items: number;
  estimated_risk_score: number;
}

interface Insights {
  insights_text: string;
  data_summary: {
    total_items: number;
    avg_match: number;
    total_gaps: number;
  };
}

export default function SkuGapAnalytics() {
  const { t, registerText, lang } = useT();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [domainAnalysis, setDomainAnalysis] = useState<DomainAnalysis[]>([]);
  const [specFrequency, setSpecFrequency] = useState<SpecFrequency[]>([]);
  const [matchDistribution, setMatchDistribution] = useState<MatchDistribution | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [timeline, setTimeline] = useState<Timeline[]>([]);
  const [riskValue, setRiskValue] = useState<RiskValue | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);

  setLoadError(null);

  const token = localStorage.getItem("token");
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const safeJson = async (res: Response) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

      const [
        summaryRes,
        domainRes,
        specRes,
        matchRes,
        recoRes,
        timeRes,
        riskRes,
        insightsRes,
      ] = await Promise.all([
        fetch(`${API_BASE}/summary`, { headers }),
        fetch(`${API_BASE}/domain-analysis`, { headers }),
        fetch(`${API_BASE}/spec-frequency`, { headers }),
        fetch(`${API_BASE}/match-distribution`, { headers }),
        fetch(`${API_BASE}/recommendations`, { headers }),
        fetch(`${API_BASE}/timeline`, { headers }),
        fetch(`${API_BASE}/risk-value`, { headers }),
        fetch(`${API_BASE}/insights`, { headers }),
      ]);

      const summaryData = await safeJson(summaryRes);
      const domainData = await safeJson(domainRes);
      const specData = await safeJson(specRes);
      const matchData = await safeJson(matchRes);
      const recoData = await safeJson(recoRes);
      const timeData = await safeJson(timeRes);
      const riskData = await safeJson(riskRes);
      const insightsData = await safeJson(insightsRes);

      if (summaryData && typeof summaryData === "object") setSummary(summaryData as Summary);
      if (Array.isArray(domainData)) setDomainAnalysis(domainData as DomainAnalysis[]);
      if (Array.isArray(specData)) setSpecFrequency((specData as SpecFrequency[]).slice(0, 10)); // Top 10
      if (matchData && typeof matchData === "object") setMatchDistribution(matchData as MatchDistribution);
      if (Array.isArray(recoData)) setRecommendations(recoData as Recommendation[]);
      if (Array.isArray(timeData)) setTimeline(timeData as Timeline[]);
      if (riskData && typeof riskData === "object") setRiskValue(riskData as RiskValue);

      // Only accept insights if it has the expected shape (prevents blank screen on error payloads)
      if (
        insightsData &&
        typeof insightsData === "object" &&
        typeof (insightsData as any).insights_text === "string"
      ) {
        setInsights(insightsData as Insights);
      } else {
        setInsights(null);
      }

      // If any endpoint failed (non-OK) or didn't parse, show a small warning.
      const anyFailed =
        !summaryRes.ok ||
        !domainRes.ok ||
        !specRes.ok ||
        !matchRes.ok ||
        !recoRes.ok ||
        !timeRes.ok ||
        !riskRes.ok ||
        !insightsRes.ok;
      if (anyFailed) {
        setLoadError("Some analytics widgets failed to load. Refresh to retry.");
      }
      try {
        // Register static UI strings for translation
        registerText && registerText("SkuGap.title","SKU Gap Intelligence");
        registerText && registerText("SkuGap.subtitle","Comprehensive analysis of product specification coverage");
        registerText && registerText("SkuGap.refresh","Refresh Data");

        registerText && registerText("SkuGap.kpi.totalItems","Total SKU Items");
        registerText && registerText("SkuGap.kpi.avgMatch","Avg Match Percentage");
        registerText && registerText("SkuGap.kpi.totalMissing","Total Missing Specs");
        registerText && registerText("SkuGap.kpi.estimatedRisk","Estimated Risk Value");

        registerText && registerText("SkuGap.domain.title","Domain Gap Analysis");
        registerText && registerText("SkuGap.domain.desc","Missing specifications by product domain");

        registerText && registerText("SkuGap.match.title","Match Distribution");
        registerText && registerText("SkuGap.match.desc","SKU coverage quality breakdown");

        registerText && registerText("SkuGap.spec.title","Most Missing Specifications");
        registerText && registerText("SkuGap.spec.desc","Top 10 frequently missing specs");

        registerText && registerText("SkuGap.timeline.title","Coverage Timeline");
        registerText && registerText("SkuGap.timeline.desc","Average match percentage over time");

        registerText && registerText("SkuGap.insights.title","AI-Powered Insights");
        registerText && registerText("SkuGap.insights.desc","Strategic recommendations from advanced analysis");

        registerText && registerText("SkuGap.reco.title","Top Recommendations");
        registerText && registerText("SkuGap.reco.desc","Priority actions based on gap analysis");

        registerText && registerText("SkuGap.table.col.spec","Specification");
        registerText && registerText("SkuGap.table.col.freq","Frequency");
        registerText && registerText("SkuGap.table.col.impact","Impact Level");
        registerText && registerText("SkuGap.table.col.suggestion","Suggestion");

        registerText && registerText("SkuGap.footer.full","Full Coverage");
        registerText && registerText("SkuGap.footer.partial","Partial Coverage");
        registerText && registerText("SkuGap.footer.incomplete","Incomplete Coverage");

        // Register dynamic/response texts
        registerText && registerText("SkuGap.insights.text", insights?.insights_text || "");
        (recommendations || []).forEach((r, idx) => {
          registerText && registerText(`SkuGap.reco.item.${idx}.spec_name`, r.spec_name || "");
          registerText && registerText(`SkuGap.reco.item.${idx}.suggestion`, r.suggestion || "");
          registerText && registerText(`SkuGap.reco.item.${idx}.impact`, r.impact_level || "");
        });
        // Impact labels
        registerText && registerText("SkuGap.impact.High","High");
        registerText && registerText("SkuGap.impact.Medium","Medium");
        registerText && registerText("SkuGap.impact.Low","Low");
        // Pie labels
        registerText && registerText("SkuGap.match.highLabel","High (≥80%)");
        registerText && registerText("SkuGap.match.mediumLabel","Medium (60-79%)");
        registerText && registerText("SkuGap.match.lowLabel","Low (<60%)");
      } catch (e) {
        // ignore registration errors
      }
    } catch (error) {
      console.error("Error fetching SKU gap data:", error);
      setLoadError("Unable to load SKU Gap Intelligence right now.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    const s = `₹${value.toLocaleString("en-IN")}`;
    if (!lang || (lang !== 'hi' && lang !== 'mr')) return s;
    return localizeDigitsInText(s);
  };

  const formatPercent = (value: number) => {
    const s = `${value.toFixed(2)}%`;
    if (!lang || (lang !== 'hi' && lang !== 'mr')) return s;
    return localizeDigitsInText(s);
  };

  const localizeDigits = (v: string | number | undefined | null) => {
    if (v === undefined || v === null) return "";
    const s = String(v);
    if (!lang || (lang !== 'hi' && lang !== 'mr')) return s;
    const map: Record<string,string> = { '0':'०','1':'१','2':'२','3':'३','4':'४','5':'५','6':'६','7':'७','8':'८','9':'९' };
    return s.replace(/[0-9]/g, d => map[d] || d);
  }

  const localizeDigitsInText = (text: string) => {
    if (!text) return text;
    if (!lang || (lang !== 'hi' && lang !== 'mr')) return text;
    return text.replace(/[0-9]/g, d => ({ '0':'०','1':'१','2':'२','3':'३','4':'४','5':'५','6':'६','7':'७','8':'८','9':'९' }[d] || d));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t ? t("SkuGap.loading","Loading SKU Gap Intelligence...") : "Loading SKU Gap Intelligence..."}</p>
        </motion.div>
      </div>
    );
  }

  const pieColors = ["#10b981", "#f59e0b", "#ef4444"]; // High, Medium, Low
  const pieData = matchDistribution
    ? [
        { name: t ? t("SkuGap.match.highLabel","High (≥80%)") : "High (≥80%)", value: matchDistribution.high, color: pieColors[0] },
        { name: t ? t("SkuGap.match.mediumLabel","Medium (60-79%)") : "Medium (60-79%)", value: matchDistribution.medium, color: pieColors[1] },
        { name: t ? t("SkuGap.match.lowLabel","Low (<60%)") : "Low (<60%)", value: matchDistribution.low, color: pieColors[2] },
      ]
    : [];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <MainLayout title={t ? t("SkuGap.title","SKU Gap Intelligence") : "sku gap intelligence"}>
      <div className="min-h-screen bg-background p-6 space-y-6">
      {loadError && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {t ? t("SkuGap.loadError","Some analytics widgets failed to load. Refresh to retry.") : loadError}
        </div>
      )}
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/dashboard")}
            className="p-2 rounded-lg bg-card border border-border hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </motion.button>
          <div>
            <h1 className="text-4xl font-bold text-foreground flex items-center gap-3">
              <Package className="h-10 w-10 text-primary" />
              {t ? t("SkuGap.title","SKU Gap Intelligence") : "SKU Gap Intelligence"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t ? t("SkuGap.subtitle","Comprehensive analysis of product specification coverage") : "Comprehensive analysis of product specification coverage"}
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={fetchAllData}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          {t ? t("SkuGap.refresh","Refresh Data") : "Refresh Data"}
        </motion.button>
      </motion.div>

      {/* Row 1: KPI Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <motion.div variants={item}>
          <KPICard
            title={t ? t("SkuGap.kpi.totalItems","Total SKU Items") : "Total SKU Items"}
            value={localizeDigits(summary?.total_items?.toString() || "0")}
            icon={Package}
            gradient="from-blue-500 to-blue-700"
          />
        </motion.div>
        <motion.div variants={item}>
          <KPICard
            title={t ? t("SkuGap.kpi.avgMatch","Avg Match Percentage") : "Avg Match Percentage"}
            value={formatPercent(summary?.avg_match_percent || 0)}
            icon={TrendingUp}
            gradient="from-green-500 to-green-700"
          />
        </motion.div>
        <motion.div variants={item}>
          <KPICard
            title={t ? t("SkuGap.kpi.totalMissing","Total Missing Specs") : "Total Missing Specs"}
            value={localizeDigits(summary?.total_missing_specs?.toString() || "0")}
            icon={AlertTriangle}
            gradient="from-orange-500 to-orange-700"
          />
        </motion.div>
        <motion.div variants={item}>
          <KPICard
            title={t ? t("SkuGap.kpi.estimatedRisk","Estimated Risk Value") : "Estimated Risk Value"}
            value={formatCurrency(riskValue?.estimated_risk_score || 0)}
            icon={DollarSign}
            gradient="from-red-500 to-red-700"
          />
        </motion.div>
      </motion.div>

      {/* Row 2: Domain Analysis & Match Distribution */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <motion.div variants={item}>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">{t ? t("SkuGap.domain.title","Domain Gap Analysis") : "Domain Gap Analysis"}</CardTitle>
                <CardDescription>{t ? t("SkuGap.domain.desc","Missing specifications by product domain") : "Missing specifications by product domain"}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={domainAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="domain" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
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
                  <Bar dataKey="total_gaps" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">{t ? t("SkuGap.match.title","Match Distribution") : "Match Distribution"}</CardTitle>
              <CardDescription>{t ? t("SkuGap.match.desc","SKU coverage quality breakdown") : "SKU coverage quality breakdown"}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                  <PieChart
                    series={[
                      {
                        data: pieData.map((entry, index) => ({
                          id: index,
                          value: entry.value,
                          label: entry.name,
                          color: entry.color,
                        })),
                        innerRadius: 34,
                        outerRadius: 110,
                        paddingAngle: 2,
                        cornerRadius: 4,
                        highlightScope: { fade: "global", highlight: "item" },
                        faded: {
                          innerRadius: 36,
                          additionalRadius: -16,
                          color: "hsl(var(--muted))",
                        },
                      },
                    ]}
                    height={300}
                    slotProps={{ legend: { sx: { display: "none" } } }}
                    sx={{
                      ".MuiChartsTooltip-paper": {
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      },
                    }}
                  />
                </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Row 3: Spec Frequency & Timeline */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <motion.div variants={item}>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">{t ? t("SkuGap.spec.title","Most Missing Specifications") : "Most Missing Specifications"}</CardTitle>
              <CardDescription>{t ? t("SkuGap.spec.desc","Top 10 frequently missing specs") : "Top 10 frequently missing specs"}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={specFrequency} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="spec_name" type="category" width={150} stroke="hsl(var(--muted-foreground))" />
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
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">{t ? t("SkuGap.timeline.title","Coverage Timeline") : "Coverage Timeline"}</CardTitle>
              <CardDescription>{t ? t("SkuGap.timeline.desc","Average match percentage over time") : "Average match percentage over time"}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
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
                  <Line type="monotone" dataKey="avg_match" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Row 4: AI Insights */}
      {typeof insights?.insights_text === "string" && insights.insights_text.trim() && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                {t ? t("SkuGap.insights.title","AI-Powered Insights") : "AI-Powered Insights"}
              </CardTitle>
              <CardDescription>{t ? t("SkuGap.insights.desc","Strategic recommendations from advanced analysis") : "Strategic recommendations from advanced analysis"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-foreground/90 font-sans leading-relaxed">
                  {t ? t("SkuGap.insights.text", insights?.insights_text || "").replace(/\*\*/g, '') : (insights?.insights_text || "").replace(/\*\*/g, '')}
                </pre>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Row 5: Recommendations Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">{t ? t("SkuGap.reco.title","Top Recommendations") : "Top Recommendations"}</CardTitle>
            <CardDescription>{t ? t("SkuGap.reco.desc","Priority actions based on gap analysis") : "Priority actions based on gap analysis"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t ? t("SkuGap.table.col.spec","Specification") : "Specification"}</TableHead>
                  <TableHead>{t ? t("SkuGap.table.col.freq","Frequency") : "Frequency"}</TableHead>
                  <TableHead>{t ? t("SkuGap.table.col.impact","Impact Level") : "Impact Level"}</TableHead>
                  <TableHead>{t ? t("SkuGap.table.col.suggestion","Suggestion") : "Suggestion"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recommendations.map((rec, index) => (
                  <motion.tr
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="border-b border-border"
                  >
                    <TableCell className="font-medium">{t ? t(`SkuGap.reco.item.${index}.spec_name`, rec.spec_name) : rec.spec_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{localizeDigits(rec.frequency)}</Badge>
                    </TableCell>
                    <TableCell>
                      <ImpactBadge level={t ? t(`SkuGap.impact.${rec.impact_level}`, rec.impact_level) : rec.impact_level} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t ? t(`SkuGap.reco.item.${index}.suggestion`, rec.suggestion) : rec.suggestion}</TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      {/* Footer Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <StatCard
          label={t ? t("SkuGap.footer.full","Full Coverage") : "Full Coverage"}
          value={summary?.full_count || 0}
          icon={CheckCircle2}
          color="text-green-500"
        />
        <StatCard
          label={t ? t("SkuGap.footer.partial","Partial Coverage") : "Partial Coverage"}
          value={summary?.partial_count || 0}
          icon={AlertCircle}
          color="text-yellow-500"
        />
        <StatCard
          label={t ? t("SkuGap.footer.incomplete","Incomplete Coverage") : "Incomplete Coverage"}
          value={summary?.incomplete_count || 0}
          icon={XCircle}
          color="text-red-500"
        />
      </motion.div>
      </div>
    </MainLayout>
  );
}

function KPICard({
  title,
  value,
  icon: Icon,
  gradient,
}: {
  title: string;
  value: string;
  icon: any;
  gradient: string;
}) {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className={`h-2 bg-gradient-to-r ${gradient}`} />
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-3xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function ImpactBadge({ level }: { level: string }) {
  const { t } = useT();
  const variants: Record<string, { className: string; icon: any }> = {
    High: { className: "bg-red-500/20 text-red-400 border-red-500/50", icon: AlertTriangle },
    Medium: { className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50", icon: AlertCircle },
    Low: { className: "bg-blue-500/20 text-blue-400 border-blue-500/50", icon: CheckCircle2 },
  };

  const variant = variants[level] || variants.Low;
  const Icon = variant.icon;

  return (
    <Badge className={`${variant.className} border`}>
      <Icon className="h-3 w-3 mr-1" />
      {t ? t(`SkuGap.impact.${level}`, level) : level}
    </Badge>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
}) {
  const { lang } = useT();
  const localizeDigits = (v: string | number | undefined | null) => {
    if (v === undefined || v === null) return "";
    const s = String(v);
    if (!lang || (lang !== 'hi' && lang !== 'mr')) return s;
    const map: Record<string,string> = { '0':'०','1':'१','2':'२','3':'३','4':'४','5':'५','6':'६','7':'७','8':'८','9':'९' };
    return s.replace(/[0-9]/g, d => map[d] || d);
  }
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-3 rounded-lg bg-muted ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{localizeDigits(value)}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
