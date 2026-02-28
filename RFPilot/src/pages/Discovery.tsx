import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Eye, Trash2, Globe } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { useT } from "@/hooks/useT";

// Import logo images
import logo1 from "@/photos/a8cf81e1-f47b-415d-91b8-04ceca7b4f5d.png";
import logo2 from "@/photos/80b92cb8-9f64-40c5-9cb3-5e18a041387a.png";
import logo3 from "@/photos/79ba1206-38ed-45c9-89da-3264180612c1.png";
import logo4 from "@/photos/7005cd1b-91e7-4ee5-b710-3e1fe063d46f.png";
import logo5 from "@/photos/45e821bd-b2dc-4f17-bdf4-11ebe8d23c5d.png";

const API = "http://127.0.0.1:8000"; // must match backend port

// Logo data for the marquee - using actual images from photos folder
const TRUSTED_SOURCES = [
  { name: "Government Portal 1", src: logo1 },
  { name: "Government Portal 2", src: logo2 },
  { name: "Government Portal 3", src: logo3 },
  { name: "Government Portal 4", src: logo4 },
  { name: "Government Portal 5", src: logo5 },
];

export default function Discovery() {
  const [rfps, setRfps] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const { t, registerText, lang } = useT();

  useEffect(() => {
    registerText("Discovery.title", "RFP Discovery");
    registerText("Discovery.searchPlaceholder", "🔍 Search by title or buyer...");
    registerText("Discovery.clearAll", "Clear All");
    registerText("Discovery.scrape", "Scrape Official Portals");
    registerText("Discovery.runAgent", "Run Sales Agent");
    registerText("Discovery.discovering", "Discovering...");
    registerText("Discovery.discoveringDetail", "Please wait while we scan for new opportunities");
    registerText("Discovery.noRfps", "No RFPs discovered yet");
    registerText("Discovery.noRfpsHint", "Click \"Run Sales Agent\" to start discovering RFPs");
    registerText("Discovery.totalRfps", "Total RFPs");
    registerText("Discovery.critical", "Critical");
    registerText("Discovery.highPriority", "High Priority");
    registerText("Discovery.extracted", "Extracted");
    registerText("Discovery.confirmDelete", "Delete all discovered RFPs?");

    // table headers
    registerText("Discovery.table.id", "ID");
    registerText("Discovery.table.title", "Title");
    registerText("Discovery.table.deadline", "Deadline");
    registerText("Discovery.table.estimated", "Est. Value");
    registerText("Discovery.table.domain", "Domain");
    registerText("Discovery.table.priority", "Priority");
    registerText("Discovery.table.status", "Status");
    registerText("Discovery.table.action", "Action");
    registerText("Discovery.notSpecified","Not specified in the provided text");
    registerText("Discovery.approx","Approx.");
  }, [registerText]);

  const localizeNumber = (v: number | string) => {
    const s = String(v);
    if (lang === "hi" || lang === "mr") {
      const map: Record<string, string> = { '0':'०','1':'१','2':'२','3':'३','4':'४','5':'५','6':'६','7':'७','8':'८','9':'९' };
      return s.replace(/\d/g, d => map[d] || d);
    }
    return s;
  };

  const localizeMonetaryString = (val: string | undefined | null) => {
    if (!val) return t("Discovery.notSpecified","Not specified in the provided text");
    let out = String(val);
    out = out.replace(/Approx\.?/i, t("Discovery.approx","Approx."));
    if (lang === "hi" || lang === "mr") {
      const map: Record<string, string> = { '0':'०','1':'१','2':'२','3':'३','4':'४','5':'५','6':'६','7':'७','8':'८','9':'९' };
      out = out.replace(/\d/g, d => map[d] || d);
    }
    return out;
  };

  // -----------------------------
  // Fetch RFPS
  // -----------------------------
  const fetchRFPs = async () => {
    try {
      const res = await fetch(`${API}/rfps`);
      const data = await res.json();
      
      // Ensure data is an array
      if (Array.isArray(data)) {
        setRfps(data);
        return data.length;
      } else {
        setRfps([]);
        return 0;
      }
    } catch (error) {
      console.error("Error fetching RFPs:", error);
      setRfps([]);
      return 0;
    }
  };

  // -----------------------------
  // Run Sales Agent + Poll
  // -----------------------------
  const runSalesAgent = async () => {
    setIsRunning(true);

    // 1. Start the agent and get the task_id
    const response = await fetch(`${API}/run`, { method: "POST" });
    const { task_id } = await response.json();

    // 2. Start polling
    const poll = setInterval(async () => {
      // Refresh the table with whatever is currently in the store
      await fetchRFPs();

      // 3. Check the actual background task status
      try {
        const statusRes = await fetch(`${API}/run/status/${task_id}`);
        const { status } = await statusRes.json();

        // Only stop polling when the backend is finished or failed
        if (status === "completed" || status === "failed") {
          clearInterval(poll);
          setIsRunning(false);
          // Final fetch to ensure all data is caught
          await fetchRFPs(); 
        }
      } catch (err) {
        console.error("Status check failed", err);
      }
    }, 12000);
  };

  // -----------------------------
  // Clear RFPS
  // -----------------------------
  const deleteAllRFPs = async () => {
    if (!confirm(t("Discovery.confirmDelete","Delete all discovered RFPs?"))) return;
    await fetch(`${API}/rfps`, { method: "DELETE" });
    setRfps([]);
  };

  useEffect(() => {
    fetchRFPs();
  }, []);

  // -----------------------------
  // Filter
  // -----------------------------
  const filtered = rfps.filter(
    (r) =>
      r.rfp_title?.toLowerCase().includes(search.toLowerCase()) ||
      r.buyer?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MainLayout title={t("Discovery.title","RFP Discovery")}>
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6">
        {/* TRUSTED SOURCES LOGO MARQUEE */}
        <div className={`relative w-full overflow-hidden py-3 mb-6 ${isLight ? 'border-y border-gray-200 bg-white' : 'border-y border-white/10 bg-slate-800/10'}`}>
          <style>
            {`
              @keyframes scroll-left {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              .logo-marquee {
                display: flex;
                width: max-content;
                animation: scroll-left 30s linear infinite;
              }
              .logo-marquee:hover {
                animation-play-state: paused;
              }
              .marquee-logo {
                filter: brightness(1.2) contrast(1.1) saturate(1.2);
                transition: all 0.3s ease;
              }
              .marquee-logo:hover {
                filter: brightness(1.3) contrast(1.15) saturate(1.3);
                transform: scale(1.05);
              }
            `}
          </style>
          
          <div className="logo-marquee">
            {/* First set of logos */}
            {TRUSTED_SOURCES.map((source, idx) => (
              <div
                key={`first-${idx}`}
                className="flex items-center justify-center mx-6"
              >
                <img
                  src={source.src}
                  alt={source.name}
                  className="h-14 object-contain marquee-logo"
                  title={source.name}
                />
              </div>
            ))}
            {/* Duplicate set for seamless loop */}
            {TRUSTED_SOURCES.map((source, idx) => (
              <div
                key={`second-${idx}`}
                className="flex items-center justify-center mx-6"
              >
                <img
                  src={source.src}
                  alt={source.name}
                  className="h-14 object-contain marquee-logo"
                  title={source.name}
                />
              </div>
            ))}
          </div>
        </div>

        {/* TAGLINE CAROUSEL */}
        <div className={`relative w-full overflow-hidden mb-6 py-2 ${isLight ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50' : 'border-y border-white/10 py-2 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10'}`}>
          <style>
            {`
              @keyframes text-scroll {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              .text-marquee {
                display: flex;
                width: max-content;
                animation: text-scroll 25s linear infinite;
                white-space: nowrap;
              }
              .text-marquee:hover {
                animation-play-state: paused;
              }
              .gradient-text {
                background: linear-gradient(90deg, #60A5FA, #A78BFA, #F472B6, #60A5FA);
                background-size: 200% auto;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                animation: gradient-shift 3s ease infinite;
              }
              @keyframes gradient-shift {
                0%, 100% { background-position: 0% center; }
                50% { background-position: 100% center; }
              }
            `}
          </style>
          
          <div className="text-marquee">
            <div className="flex items-center">
              <h2 className="text-sm font-semibold gradient-text mx-6">
                {t("Discovery.tagline.intel","AI-Powered RFP Intelligence from Trusted Government Sources")}
              </h2>
              <span className="text-blue-400/50 text-xs mx-4">✦</span>
              <h2 className="text-sm font-semibold gradient-text mx-6">
                {t("Discovery.tagline.discover","Discover Government Tenders Before Your Competition Does")}
              </h2>
              <span className="text-purple-400/50 text-xs mx-4">✦</span>
              <h2 className="text-sm font-semibold gradient-text mx-6">
                {t("Discovery.tagline.nevermiss","Never Miss a Tender Opportunity - AI Working 24/7 for You")}
              </h2>
              <span className="text-pink-400/50 text-xs mx-4">✦</span>
            </div>
            {/* Duplicate for seamless loop */}
            <div className="flex items-center">
              <h2 className="text-sm font-semibold gradient-text mx-6">
                {t("Discovery.tagline.intel","AI-Powered RFP Intelligence from Trusted Government Sources")}
              </h2>
              <span className="text-blue-400/50 text-xs mx-4">✦</span>
              <h2 className="text-sm font-semibold gradient-text mx-6">
                {t("Discovery.tagline.discover","Discover Government Tenders Before Your Competition Does")}
              </h2>
              <span className="text-purple-400/50 text-xs mx-4">✦</span>
              <h2 className="text-sm font-semibold gradient-text mx-6">
                {t("Discovery.tagline.nevermiss","Never Miss a Tender Opportunity - AI Working 24/7 for You")}
              </h2>
              <span className="text-pink-400/50 text-xs mx-4">✦</span>
            </div>
          </div>
        </div>

        {/* HEADER */}
        <div className={`flex items-center mb-6 gap-4 p-4 rounded-lg ${isLight ? 'bg-white border border-gray-200' : 'bg-slate-900/40 border border-white/10'}`}>
          <Input
            placeholder={t("Discovery.searchPlaceholder","🔍 Search by title or buyer...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-1/3 ${isLight ? 'bg-white border-gray-200 text-slate-900' : 'bg-slate-800/50 border-white/10 text-white'} focus:border-blue-500/50`}
          />

          <div className="flex gap-3">
            <Button 
              variant="destructive" 
              onClick={deleteAllRFPs}
              className="bg-red-600 hover:bg-red-700 border-none shadow-lg shadow-red-500/20"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("Discovery.clearAll","Clear All")}
            </Button>

            <Button 
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-none shadow-lg shadow-emerald-500/20"
            >
              <Globe className="h-4 w-4 mr-2" />
              {t("Discovery.scrape","Scrape Official Portals")}
            </Button>

            <Button 
              onClick={runSalesAgent} 
              disabled={isRunning}
              className={`${isLight ? 'bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white border-none shadow-xl shadow-blue-600/30' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-none shadow-lg shadow-blue-500/20'}`}
            >
              {isRunning ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  {t("Discovery.discovering","Discovering...")}
                </>
              ) : (
                t("Discovery.runAgent","Run Sales Agent")
              )}
            </Button>
          </div>
        </div>

        {/* STATS SUMMARY */}
        {rfps.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className={`p-4 rounded-lg bg-gradient-to-br from-blue-600/10 to-blue-500/5 border border-blue-500/20 ${isLight ? 'text-slate-900' : ''}`}>
              <p className="text-xs text-blue-400 uppercase tracking-wider mb-1">{t("Discovery.totalRfps","Total RFPs")}</p>
              <p className={`text-2xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{localizeNumber(rfps.length)}</p>
            </div>
              <div className={`p-4 rounded-lg bg-gradient-to-br from-red-600/10 to-red-500/5 border border-red-500/20 ${isLight ? 'bg-red-50 border-red-100' : ''}`}>
                <p className="text-xs text-red-400 uppercase tracking-wider mb-1">{t("Discovery.critical","Critical")}</p>
                <p className={`text-2xl font-bold ${isLight ? 'text-red-700' : 'text-white'}`}>
                  {localizeNumber(rfps.filter(r => r.priority === "Critical").length)}
                </p>
              </div>
              <div className={`p-4 rounded-lg bg-gradient-to-br from-orange-600/10 to-orange-500/5 border border-orange-500/20 ${isLight ? 'bg-orange-50 border-orange-100' : ''}`}>
                <p className="text-xs text-orange-400 uppercase tracking-wider mb-1">{t("Discovery.highPriority","High Priority")}</p>
                <p className={`text-2xl font-bold ${isLight ? 'text-orange-700' : 'text-white'}`}>
                  {localizeNumber(rfps.filter(r => r.priority === "High").length)}
                </p>
              </div>
              <div className={`p-4 rounded-lg bg-gradient-to-br from-emerald-600/10 to-emerald-500/5 border border-emerald-500/20 ${isLight ? 'bg-emerald-50 border-emerald-100' : ''}`}>
                <p className="text-xs text-emerald-400 uppercase tracking-wider mb-1">{t("Discovery.extracted","Extracted")}</p>
                <p className={`text-2xl font-bold ${isLight ? 'text-emerald-700' : 'text-white'}`}>
                  {localizeNumber(rfps.filter(r => r.status === "Extracted").length)}
                </p>
              </div>
          </div>
        )}

        {/* TABLE */}
          <div className={`w-full overflow-x-auto rounded-xl shadow-2xl ${isLight ? 'bg-white border border-gray-200' : 'border border-white/10 bg-slate-900/40'}`}>
          <Table className="w-full">
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 border-b border-white/10 hover:bg-gradient-to-r hover:from-blue-600/30 hover:via-indigo-600/30 hover:to-purple-600/30">
                  <TableHead className="text-blue-300 font-bold text-xs uppercase tracking-wider">{t("Discovery.table.id","ID")}</TableHead>
                  <TableHead className="text-blue-300 font-bold text-xs uppercase tracking-wider">{t("Discovery.table.title","Title")}</TableHead>
                  <TableHead className="text-blue-300 font-bold text-xs uppercase tracking-wider">{t("Discovery.table.deadline","Deadline")}</TableHead>
                  <TableHead className="text-blue-300 font-bold text-xs uppercase tracking-wider">{t("Discovery.table.estimated","Est. Value")}</TableHead>
                  <TableHead className="text-blue-300 font-bold text-xs uppercase tracking-wider">{t("Discovery.table.domain","Domain")}</TableHead>
                  <TableHead className="text-blue-300 font-bold text-xs uppercase tracking-wider">{t("Discovery.table.priority","Priority")}</TableHead>
                  <TableHead className="text-blue-300 font-bold text-xs uppercase tracking-wider">{t("Discovery.table.status","Status")}</TableHead>
                  <TableHead className="text-center text-blue-300 font-bold text-xs uppercase tracking-wider">{t("Discovery.table.action","Action")}</TableHead>
                </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.map((rfp, index) => (
                <TableRow 
                  key={rfp.rfp_id}
                  className={`transition-colors ${isLight ? (index % 2 === 0 ? 'bg-white' : 'bg-gray-50') : 'border-b border-white/5 hover:bg-white/5 ' + (index % 2 === 0 ? 'bg-slate-800/20' : 'bg-slate-800/10')}`}
                >
                  <TableCell className="font-mono text-xs py-3">
                    <div className={`${isLight ? 'px-2 py-1 bg-gray-100 text-slate-800 border border-gray-200' : 'px-2 py-1 bg-slate-700/30 rounded border border-white/10 text-xs'}`}>
                      {localizeNumber(rfp.rfp_id.length > 15 ? rfp.rfp_id.substring(0, 15) + '...' : rfp.rfp_id)}
                    </div>
                  </TableCell>

                  <TableCell className={`font-medium text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      <div className="line-clamp-2">{t(`RFP.${rfp.rfp_id}.title`, rfp.rfp_title)}</div>
                  </TableCell>
                 
                  <TableCell className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'} whitespace-nowrap`}>
                      <span className="text-xs px-2 py-1 bg-orange-500/10 text-orange-300 rounded border border-orange-500/20">
                      {localizeNumber(rfp.submission_deadline)}
                    </span>
                  </TableCell>

                  <TableCell className={`text-sm font-semibold ${isLight ? 'text-emerald-600' : 'text-emerald-400'} whitespace-nowrap`}>
                    {localizeMonetaryString(rfp.estimated_project_value)}
                  </TableCell>
                 
                  <TableCell className="whitespace-nowrap">
                    <Badge 
                      variant="outline" 
                      className={`${isLight ? 'text-xs font-medium border border-cyan-100 bg-cyan-50 text-cyan-700' : 'text-xs border-cyan-500/30 text-cyan-300 bg-cyan-500/10 font-medium'}`}
                    >
                      {t(`RFP.${rfp.rfp_id}.domain`, rfp.domain)}
                    </Badge>
                  </TableCell>

                  {/* PRIORITY */}
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant="outline"
                      className={`text-xs font-bold ${
                        rfp.priority === "Critical"
                          ? "border-red-500 text-red-400 bg-red-500/10"
                          : rfp.priority === "High"
                          ? "border-orange-500 text-orange-400 bg-orange-500/10"
                          : "border-yellow-500 text-yellow-400 bg-yellow-500/10"
                      }`}
                    >
                      {t(`Discovery.priority.${rfp.priority}`, rfp.priority)}
                    </Badge>
                  </TableCell>

                  {/* STATUS */}
                  <TableCell className="whitespace-nowrap">
                    <Badge 
                      variant="secondary" 
                      className={`text-xs font-medium ${isLight ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'}`}
                    >
                      {t(`Discovery.status.${rfp.status}`, rfp.status)}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="hover:bg-blue-500/20 hover:text-blue-400 h-8 w-8"
                      onClick={() => navigate(`/rfp/${encodeURIComponent(rfp.rfp_id)}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!isRunning && rfps.length === 0 && (
            <div className="text-center py-16 bg-slate-800/20">
              <p className="text-muted-foreground text-lg mb-2">{t("Discovery.noRfps","No RFPs discovered yet")}</p>
              <p className="text-sm text-slate-500">{t("Discovery.noRfpsHint","Click \"Run Sales Agent\" to start discovering RFPs")}</p>
            </div>
          )}
          
          {isRunning && rfps.length === 0 && (
            <div className="text-center py-16 bg-slate-800/20">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-blue-400 text-lg font-medium">{t("Discovery.discovering","Discovering...")}</p>
              <p className="text-sm text-slate-500 mt-2">{t("Discovery.discoveringDetail","Please wait while we scan for new opportunities")}</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
