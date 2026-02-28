import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Eye,
  MessageSquare,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";

const API = "http://127.0.0.1:8000";

export default function Analysis() {
  const { t, registerText, lang } = useT();
  const [expandedRows, setExpandedRows] = useState<number[]>([]);
  const [technicalData, setTechnicalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSKUs, setSelectedSKUs] = useState<Record<number, string>>({});
  const [showComparison, setShowComparison] = useState(false);
  const [selectedItemForComparison, setSelectedItemForComparison] = useState<any>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideComment, setOverrideComment] = useState("");
  const [showJustification, setShowJustification] = useState(false);
  const [selectedItemForJustification, setSelectedItemForJustification] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/technical/output`)
      .then((res) => res.json())
      .then((data) => {
        setTechnicalData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching technical data:", err);
        setLoading(false);
      });
  }, []);

  // register dynamic texts for translation once data arrives
  useEffect(() => {
    if (!technicalData) return;
    try {
      registerText && registerText("Analysis.title", "Technical Spec-Matching Workspace");
      registerText && registerText("Analysis.aiWorkspace", "AI Analysis Workspace");
      registerText && registerText("Analysis.noData", "No technical analysis data available. Please run the Sales Agent first.");
      registerText && registerText("Analysis.automationInsight", "Automation Insight: Technical SKU matching is the most time-consuming manual task — now automated. Review and confirm matches below.");

      // header and badges
      registerText && registerText("Analysis.badge.technicalAgent", "Technical Agent");

      const items = technicalData.items || [];
      items.forEach((item: any, idx: number) => {
        const base = `Technical.${technicalData.rfp_id}.item.${idx}`;
        registerText && registerText(`${base}.item_name`, item.item_name || "");
        registerText && registerText(`${base}.required_specs_text`, item.required_specs_text || "");
        registerText && registerText(`${base}.best_match_sku`, item.best_match_sku || "");
        registerText && registerText(`${base}.match_justification`, item.match_justification || "");

        item.top_3_alternatives?.forEach((alt: any, aidx: number) => {
          registerText && registerText(`${base}.alt.${aidx}.sku_description`, alt.sku_description || "");
          registerText && registerText(`${base}.alt.${aidx}.price_per_unit`, String(alt.price_per_unit || ""));
        });
      });
    } catch (e) {
      // ignore registration errors
    }
  }, [technicalData, registerText]);

  const localizeDigits = (v: string | number | undefined | null) => {
    if (v === undefined || v === null) return '';
    const s = String(v);
    if (!lang || (lang !== 'hi' && lang !== 'mr')) return s;
    const map: Record<string,string> = { '0':'०','1':'१','2':'२','3':'३','4':'४','5':'५','6':'६','7':'७','8':'८','9':'९' };
    return s.replace(/[0-9]/g, d => map[d] || d);
  }

  if (loading) {
    return (
      <MainLayout title={t ? t("Analysis.title","Technical Spec-Matching Workspace") : "Technical Spec-Matching Workspace"}>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!technicalData || !technicalData.items || technicalData.items.length === 0) {
    return (
      <MainLayout title={t ? t("Analysis.title","Technical Spec-Matching Workspace") : "Technical Spec-Matching Workspace"}>
        <div className="text-center py-20">
          <p className="text-muted-foreground">{t ? t("Analysis.noData","No technical analysis data available. Please run the Sales Agent first.") : "No technical analysis data available. Please run the Sales Agent first."}</p>
        </div>
      </MainLayout>
    );
  }

  const items = technicalData.items || [];
  const avgMatch = items.length > 0 
    ? (items.reduce((sum: number, item: any) => sum + (item.spec_match_percent || 0), 0) / items.length).toFixed(0)
    : 0;

  const toggleRow = (id: number) => {
    setExpandedRows((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const selectSKU = (itemId: number, sku: string) => {
    setSelectedSKUs((prev) => ({ ...prev, [itemId]: sku }));
  };

  const showComparisonMatrix = (item: any) => {
    setSelectedItemForComparison(item);
    setShowComparison(true);
  };

  const showJustificationDialog = (item: any) => {
    setSelectedItemForJustification(item);
    setShowJustification(true);
  };

  const getMatchColor = (match: number) => {
    if (match >= 90) return "bg-success/10 text-success border-success/30";
    if (match >= 70) return "bg-warning/10 text-warning border-warning/30";
    return "bg-destructive/10 text-destructive border-destructive/30";
  };

  const getMatchBg = (match: number) => {
    if (match >= 90) return "bg-success";
    if (match >= 70) return "bg-warning";
    return "bg-destructive";
  };

  const getStatusIcon = (status: string) => {
    if (status === "Matched" || status === "Warning") {
      return <CheckCircle2 className="h-5 w-5 text-success mx-auto" />;
    }
    return <AlertTriangle className="h-5 w-5 text-warning mx-auto" />;
  };

  return (
    <MainLayout
      title={t ? t("Analysis.title","Technical Spec-Matching Workspace") : "Technical Spec-Matching Workspace"}
      breadcrumbs={[
        { name: t ? t("Nav.dashboard","Dashboard") : "Dashboard", href: "/dashboard" },
        { name: t ? t("Analysis.aiWorkspace","AI Analysis Workspace") : "AI Analysis Workspace" },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <p className="text-muted-foreground">
              RFP {localizeDigits(technicalData.rfp_id)} - {t ? t(`Domain.${technicalData.domain}`, technicalData.domain) : technicalData.domain}
            </p>
            <div className="flex items-center gap-4 mt-2">
              <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                <Sparkles className="h-3 w-3 mr-1" />
                {t ? t("Analysis.badge.technicalAgent","Technical Agent") : "Technical Agent"} {t ? t(`Analysis.status.${technicalData.status}`, technicalData.status) : technicalData.status}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {localizeDigits(items.length)} {t ? t("Analysis.itemsMatched","items matched") : "items matched"} • {t ? t("Analysis.avgSpecMatch","Avg Spec-Match:") : "Avg Spec-Match:"} {localizeDigits(avgMatch)}%
              </span>
            </div>
          </div>
        </motion.div>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-info/10 border border-info/30 rounded-lg p-4"
        >
          <p className="text-sm text-info">
            <strong>{t ? t("Analysis.automationInsightStrong","Automation Insight:") : "Automation Insight:"}</strong> {t ? t("Analysis.automationInsight","Technical SKU matching is the most time-consuming manual task — now automated. Review and confirm matches below.") : "Technical SKU matching is the most time-consuming manual task — now automated. Review and confirm matches below."}
          </p>
        </motion.div>

        {/* Spec Matching Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border border-border overflow-hidden"
        >
          <Table>
            <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-8"></TableHead>
                  <TableHead>{t ? t("Analysis.col.itemName","Item Name") : "Item Name"}</TableHead>
                  <TableHead>{t ? t("Analysis.col.requiredSpecs","Required Technical Specs") : "Required Technical Specs"}</TableHead>
                  <TableHead>{t ? t("Analysis.col.bestMatch","Best Match SKU") : "Best Match SKU"}</TableHead>
                  <TableHead className="text-center">{t ? t("Analysis.col.specMatch","Spec-Match %") : "Spec-Match %"}</TableHead>
                  <TableHead className="text-center">{t ? t("Analysis.col.status","Status") : "Status"}</TableHead>
                  <TableHead className="text-right">{t ? t("Analysis.col.actions","Actions") : "Actions"}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any, index: number) => (
                <>
                  <TableRow
                    key={index}
                    className={cn(
                      "cursor-pointer transition-colors",
                      expandedRows.includes(index) && "bg-muted/30"
                    )}
                    onClick={() => toggleRow(index)}
                  >
                    <TableCell>
                      <motion.div
                        animate={{ rotate: expandedRows.includes(index) ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </motion.div>
                    </TableCell>
                    <TableCell className="font-medium">{t ? t(`Technical.${technicalData.rfp_id}.item.${index}.item_name`, item.item_name) : item.item_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {t ? t(`Technical.${technicalData.rfp_id}.item.${index}.required_specs_text`, item.required_specs_text) : item.required_specs_text}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {(() => {
                        const chosen = selectedSKUs[index] || item.best_match_sku;
                        const altIdx = item.top_3_alternatives?.findIndex((a: any) => a.sku_code === chosen) ?? -1;
                        if (altIdx >= 0) {
                          const alt = item.top_3_alternatives[altIdx];
                          const descKey = `Technical.${technicalData.rfp_id}.item.${index}.alt.${altIdx}.sku_description`;
                          const desc = t ? t(descKey, alt.sku_description) : alt.sku_description;
                          return (
                            <div className="flex flex-col">
                              <span className="font-mono text-sm">{chosen}</span>
                              <span className="text-xs text-muted-foreground">{desc}</span>
                            </div>
                          );
                        }

                        // fallback to registered best_match_sku or raw code
                        const bmKey = `Technical.${technicalData.rfp_id}.item.${index}.best_match_sku`;
                        const bm = t ? t(bmKey, item.best_match_sku) : item.best_match_sku;
                        return <span className="font-mono text-sm">{bm}</span>;
                      })()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn("border", getMatchColor(item.spec_match_percent))}>
                        {localizeDigits(item.spec_match_percent?.toFixed(0))}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusIcon(item.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            showJustificationDialog(item);
                          }}
                          title={t ? t("Analysis.title.viewJustification","View AI Justification") : "View AI Justification"}
                        >
                          <Sparkles className="h-4 w-4 text-primary" />
                        </Button>
                        {item.comparison_matrix && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              showComparisonMatrix(item);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            {t ? t("Analysis.action.compare","Compare") : "Compare"}
                          </Button>
                        )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowOverride(true);
                            }}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <AnimatePresence>
                    {expandedRows.includes(index) && (
                      <TableRow>
                        <TableCell colSpan={7} className="p-0">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 bg-muted/20 space-y-3">
                              <p className="text-sm font-medium">Alternative SKU Matches:</p>
                              <div className="grid grid-cols-3 gap-3">
                                  {item.top_3_alternatives?.map((match: any, idx: number) => (
                                  <motion.div
                                    key={match.sku_code}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selectSKU(index, match.sku_code);
                                    }}
                                    className={cn(
                                      "p-3 rounded-lg border cursor-pointer transition-all",
                                      selectedSKUs[index] === match.sku_code || (!selectedSKUs[index] && idx === 0)
                                        ? "border-primary bg-primary/5"
                                        : "border-border bg-card hover:border-primary/50"
                                    )}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-mono text-sm">{match.sku_code}</span>
                                      <Badge className={cn("text-xs border", getMatchColor(match.spec_match_percent))}>
                                        {localizeDigits(match.spec_match_percent?.toFixed(0))}%
                                      </Badge>
                                    </div>
                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className={cn("h-full rounded-full", getMatchBg(match.spec_match_percent))}
                                        style={{ width: `${match.spec_match_percent}%` }}
                                      />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2 mb-1">
                                      {t ? t("Analysis.pricePerUnit","₹{price}/unit").replace('{price}', localizeDigits(match.price_per_unit?.toLocaleString())) : `₹${localizeDigits(match.price_per_unit?.toLocaleString())}/unit`}
                                    </p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {t ? t(`Technical.${technicalData.rfp_id}.item.${index}.alt.${idx}.sku_description`, match.sku_description) : match.sku_description}
                                    </p>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        </TableCell>
                      </TableRow>
                    )}
                  </AnimatePresence>
                </>
              ))}
            </TableBody>
          </Table>
        </motion.div>

        {/* Actions */}
          <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between"
        >
          <p className="text-sm text-muted-foreground">
            {localizeDigits(Object.keys(selectedSKUs).length)} {t ? t("Analysis.of","of") : "of"} {localizeDigits(items.length)} {t ? t("Analysis.itemsConfirmed","items confirmed") : "items confirmed"}
          </p>
          <div className="flex gap-3">
            <Button variant="outline">{t ? t("Analysis.saveDraft","Save Draft") : "Save Draft"}</Button>
            <Button>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t ? t("Analysis.confirmSelected","Confirm Selected SKUs") : "Confirm Selected SKUs"}
            </Button>
          </div>
        </motion.div>
      </div>
      
      {/* XAI Justification Dialog */}
      <Dialog open={showJustification} onOpenChange={setShowJustification}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t ? t("Analysis.justification.title","Explainable AI: Match Justification") : "Explainable AI: Match Justification"}
            </DialogTitle>
          </DialogHeader>
          {selectedItemForJustification && (
            <div className="space-y-6">
              {/* Primary Match Justification */}
              <div className="bg-success/5 border border-success/30 rounded-lg p-4">
                <h3 className="font-semibold text-success mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {t ? t("Analysis.primaryMatch","Primary Match:") : "Primary Match:"} {selectedItemForJustification.best_match_sku}
                </h3>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line space-y-2">
                  {(() => {
                    const itemsArr = technicalData?.items || [];
                    const idx = itemsArr.findIndex((it: any) => it.best_match_sku === selectedItemForJustification.best_match_sku && it.item_name === selectedItemForJustification.item_name);
                    const key = idx >= 0 ? `Technical.${technicalData.rfp_id}.item.${idx}.match_justification` : undefined;
                    const text = key && t ? t(key, selectedItemForJustification.match_justification || '') : (selectedItemForJustification.match_justification || '');
                    return text.split('**').map((part: string, i: number) => i % 2 === 1 ? <strong key={i} className="text-foreground">{part}</strong> : <span key={i}>{part}</span>);
                  })()}
                </div>
              </div>

              {/* Alternative Matches with Delta Explanations */}
              {selectedItemForJustification.top_3_skus && selectedItemForJustification.top_3_skus.length > 1 && (
                <div>
                  <h3 className="font-semibold text-foreground mb-3">{t ? t("Analysis.alternativeMatches","Alternative Matches") : "Alternative Matches"}</h3>
                  <div className="space-y-3">
                    {selectedItemForJustification.top_3_skus.slice(1).map((alt: any, idx: number) => (
                      <div key={alt.sku_code} className="bg-muted/30 border border-border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">{alt.sku_code}</span>
                            <Badge className={cn("text-xs border", getMatchColor(alt.spec_match_percent))}>
                              {alt.spec_match_percent?.toFixed(0)}%
                            </Badge>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {t ? t("Analysis.alternativeLabel","Alternative #{n}").replace('{n}', String(idx + 2)) : `Alternative #${idx + 2}`}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                          {(() => {
                            const itemsArr = technicalData?.items || [];
                            const idxItem = itemsArr.findIndex((it: any) => it.best_match_sku === selectedItemForJustification.best_match_sku && it.item_name === selectedItemForJustification.item_name);
                            const key = (idxItem >= 0) ? `Technical.${technicalData.rfp_id}.item.${idxItem}.alt.${idx}.delta_explanation` : undefined;
                            const text = key && t ? t(key, alt.delta_explanation || '') : (alt.delta_explanation || 'Alternative SKU with lower match score.');
                            return text.split('**').map((part: string, i: number) => i % 2 === 1 ? <strong key={i} className="text-foreground">{part}</strong> : <span key={i}>{part}</span>);
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Technical Details */}
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  <strong>{t ? t("Analysis.note","Note:") : "Note:"}</strong> {t ? t("Analysis.noteText","These justifications are generated by the Technical Agent's Parameter Rule Engine and SBERT semantic matching system. Vector similarity scores confirm the alignment between RFP requirements and catalog specifications.") : "These justifications are generated by the Technical Agent's Parameter Rule Engine and SBERT semantic matching system. Vector similarity scores confirm the alignment between RFP requirements and catalog specifications."}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Comparison Dialog */}
      <Dialog open={showComparison} onOpenChange={setShowComparison}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t ? t("Analysis.comparisonTitle","Detailed Spec Comparison - {name}").replace('{name}', selectedItemForComparison?.item_name || '') : `Detailed Spec Comparison - ${selectedItemForComparison?.item_name}`}</DialogTitle>
          </DialogHeader>
          {selectedItemForComparison?.comparison_matrix && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t ? t("Analysis.compare.specParam","Spec Parameter") : "Spec Parameter"}</TableHead>
                  <TableHead>{t ? t("Analysis.compare.rfpReq","RFP Requirement") : "RFP Requirement"}</TableHead>
                  {selectedItemForComparison.comparison_matrix.comparison_rows[0]?.sku_1 && (
                    <TableHead>
                      {t ? t("Analysis.compare.skuHeader","SKU #1 ({pct}%)").replace('{pct}', localizeDigits(selectedItemForComparison.top_3_alternatives?.[0]?.spec_match_percent?.toFixed(0))) : `SKU #1 (${localizeDigits(selectedItemForComparison.top_3_alternatives?.[0]?.spec_match_percent?.toFixed(0))}%)`}
                    </TableHead>
                  )}
                  {selectedItemForComparison.comparison_matrix.comparison_rows[0]?.sku_2 && (
                    <TableHead>
                      {t ? t("Analysis.compare.skuHeader2","SKU #2 ({pct}%)").replace('{pct}', localizeDigits(selectedItemForComparison.top_3_alternatives?.[1]?.spec_match_percent?.toFixed(0))) : `SKU #2 (${localizeDigits(selectedItemForComparison.top_3_alternatives?.[1]?.spec_match_percent?.toFixed(0))}%)`}
                    </TableHead>
                  )}
                  {selectedItemForComparison.comparison_matrix.comparison_rows[0]?.sku_3 && (
                    <TableHead>
                      {t ? t("Analysis.compare.skuHeader3","SKU #3 ({pct}%)").replace('{pct}', localizeDigits(selectedItemForComparison.top_3_alternatives?.[2]?.spec_match_percent?.toFixed(0))) : `SKU #3 (${localizeDigits(selectedItemForComparison.top_3_alternatives?.[2]?.spec_match_percent?.toFixed(0))}%)`}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedItemForComparison.comparison_matrix.comparison_rows.map((row: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{(() => {
                      const itemsArr = technicalData?.items || [];
                      const idxItem = itemsArr.findIndex((it: any) => it.best_match_sku === selectedItemForComparison.best_match_sku && it.item_name === selectedItemForComparison.item_name);
                      const key = (idxItem >= 0) ? `Technical.${technicalData.rfp_id}.item.${idxItem}.comparison.${idx}.parameter` : undefined;
                      return key && t ? t(key, row.parameter) : row.parameter;
                    })()}</TableCell>
                    <TableCell className="bg-primary/5">{(() => {
                      const itemsArr = technicalData?.items || [];
                      const idxItem = itemsArr.findIndex((it: any) => it.best_match_sku === selectedItemForComparison.best_match_sku && it.item_name === selectedItemForComparison.item_name);
                      const key = (idxItem >= 0) ? `Technical.${technicalData.rfp_id}.item.${idxItem}.comparison.${idx}.rfp_requirement` : undefined;
                      return key && t ? t(key, row.rfp_requirement) : row.rfp_requirement;
                    })()}</TableCell>
                    {row.sku_1 && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{row.sku_1.sku_code}</span>
                          {row.sku_1.match ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-warning" />
                          )}
                        </div>
                      </TableCell>
                    )}
                    {row.sku_2 && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{row.sku_2.sku_code}</span>
                          {row.sku_2.match ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-warning" />
                          )}
                        </div>
                      </TableCell>
                    )}
                    {row.sku_3 && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{row.sku_3.sku_code}</span>
                          {row.sku_3.match ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-warning" />
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Override Dialog */}
      <Dialog open={showOverride} onOpenChange={setShowOverride}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Override Comment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Provide a reason for overriding the suggested SKU match (e.g., "New MTO SKU needed").
            </p>
            <Textarea
              value={overrideComment}
              onChange={(e) => setOverrideComment(e.target.value)}
              placeholder="Enter your comment..."
              rows={4}
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowOverride(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowOverride(false)}>
                Save Override
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
