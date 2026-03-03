import { useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Search,
  Brain,
  DollarSign,
  FileText,
  Bell,
  Database,
  Settings,
  LogOut,
  Sparkles,
  Zap,
  Package,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";

const navigation = [
  { key: "Nav.Dashboard", name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "Nav.Discovery", name: "RFP Discovery", href: "/discovery", icon: Search },
  { key: "Nav.MasterAgent", name: "Strategic Orchestrator", href: "/master-agent", icon: Zap },
  { key: "Nav.Analysis", name: "AI Analysis Workspace", href: "/analysis", icon: Brain },

  { key: "Nav.Pricing", name: "Pricing & Summary", href: "/pricing", icon: DollarSign },
  { key: "Nav.Proposal", name: "Proposal Builder", href: "/proposal", icon: FileText },
  { key: "Nav.SkuGap", name: "SKU Gap Intelligence", href: "/sku-gap-analytics", icon: Package },
  { key: "Nav.StrategicInsights", name: "Strategic Insights", href: "/strategic-insights", icon: Target },
  { key: "Nav.Notifications", name: "Notifications", href: "/notifications", icon: Bell, badge: 3 },
  { key: "Nav.Repository", name: "Product Repository", href: "/repository", icon: Database },
  { key: "Nav.Settings", name: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed left-0 top-0 z-40 h-screen w-[280px] bg-sidebar border-r border-sidebar-border"
      style={{ background: "var(--gradient-sidebar)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary">
          <Sparkles className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-sidebar-foreground">{useT().t("Sidebar.brand","Agentic RFP")}</h1>
          <p className="text-xs text-sidebar-muted">{useT().t("Sidebar.tagline","Response Platform")}</p>
        </div>
      </div>

      <style>{`
        @keyframes glitterMove { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .glitter-shimmer {
          background-image: linear-gradient(90deg, #06b6d4 0%, #3b82f6 50%, #ec4899 100%), linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.9) 70%);
          background-size: 100% 100%, 300% 100%;
          background-position: 0 0, 200% 0;
          animation: glitterMove 2.6s linear infinite;
          border-radius: 9999px;
          box-shadow: 0 10px 30px rgba(59,130,246,0.10), 0 4px 12px rgba(236,72,153,0.06);
        }
      `}</style>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <div key={item.name}>
              {item.href === '/discovery' && (
                <div className="w-full my-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted mb-1">Neural Layer — Core Agents</div>
                  <div className="h-[4px] w-full glitter-shimmer" style={{ opacity: 0.9 }} />
                </div>
              )}

              <Link
                to={item.href}
                className={cn(
                  "sidebar-link group relative",
                  isActive && "active"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-sidebar-primary rounded-lg"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-3">
                  <item.icon className="h-5 w-5" />
                  <span>{useT().t(item.key || item.name, item.name)}</span>
                  {item.badge && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground">
                      {item.badge}
                    </span>
                  )}
                </span>
              </Link>

              {item.href === '/proposal' && (
                <div className="w-full my-2">
                  <div className="h-[4px] w-full glitter-shimmer" style={{ opacity: 0.9 }} />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Agent Status */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="rounded-lg bg-sidebar-accent p-4">
          <p className="text-xs font-medium text-sidebar-muted mb-3 uppercase tracking-wider">
            {useT().t("Sidebar.agentStatus","Agent Status")}
          </p>
          <div className="space-y-2">
            <AgentStatus nameKey="Agent.sales" nameFallback="Sales Agent" status="active" color="bg-agent-sales" />
            <AgentStatus nameKey="Agent.technical" nameFallback="Technical Agent" status="idle" color="bg-agent-technical" />
            <AgentStatus nameKey="Agent.pricing" nameFallback="Pricing Agent" status="idle" color="bg-agent-pricing" />
            <AgentStatus nameKey="Agent.master" nameFallback="Master Agent" status="ready" color="bg-agent-master" />
          </div>
        </div>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <button className="sidebar-link w-full text-sidebar-muted hover:text-sidebar-foreground">
          <LogOut className="h-5 w-5" />
          <span>{useT().t("Sidebar.signOut","Sign Out")}</span>
        </button>
      </div>
    </motion.aside>
  );
}

function AgentStatus({
  nameKey,
  nameFallback,
  status,
  color,
}: {
  nameKey?: string;
  nameFallback?: string;
  status: "active" | "idle" | "ready";
  color: string;
}) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={cn("h-2 w-2 rounded-full", color)} />
        {status === "active" && (
          <div className={cn("absolute inset-0 h-2 w-2 rounded-full animate-ping", color, "opacity-50")} />
        )}
      </div>
      <span className="text-xs text-sidebar-foreground/70">{t(nameKey || nameFallback || "", nameFallback)}</span>
      <span
        className={cn(
          "ml-auto text-xs",
          status === "active" && "text-agent-sales",
          status === "idle" && "text-sidebar-muted",
          status === "ready" && "text-agent-master"
        )}
      >
        {t(`Agent.status.${status}`, status)}
      </span>
    </div>
  );
}
