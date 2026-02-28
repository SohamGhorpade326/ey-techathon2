import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { useT } from "@/hooks/useT";

export function WinCorrelationChart() {
  const { t, lang } = useT();

  const data = [
    { key: "WinCorrelation.timely", label: t("WinCorrelation.timely","Timely Response"), value: 90, color: "bg-success" },
    { key: "WinCorrelation.technical", label: t("WinCorrelation.technical","Technical Alignment"), value: 60, color: "bg-info" },
    { key: "WinCorrelation.price", label: t("WinCorrelation.price","Price Competitiveness"), value: 75, color: "bg-primary" },
  ];

  const localizeNumber = (n: number | string) => {
    if (!n && n !== 0) return "";
    const s = String(n);
    if (lang === "hi" || lang === "mr") {
      const map: Record<string, string> = { '0':'०','1':'१','2':'२','3':'३','4':'४','5':'५','6':'६','7':'७','8':'८','9':'९' };
      return s.replace(/\d/g, d => map[d] || d);
    }
    return s;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="card-elevated p-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">{t("WinCorrelation.title","Win Correlation Factors")}</h3>
      </div>

      <div className="space-y-5">
        {data.map((item, index) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">{item.label}</span>
              <span className="text-sm font-semibold text-foreground">{localizeNumber(item.value)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${item.value}%` }}
                transition={{ duration: 0.6, delay: 0.5 + index * 0.1, ease: "easeOut" }}
                className={`h-full rounded-full ${item.color}`}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          {localizeNumber(
            t(
              "WinCorrelation.note",
              "Based on analysis of 150+ RFP submissions over the past 12 months. Timely responses (within first 50% of deadline) show highest win correlation."
            )
          )}
        </p>
      </div>
    </motion.div>
  );
}
