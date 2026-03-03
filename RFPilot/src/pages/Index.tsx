import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Zap,
  Target,
  Clock,
  Brain,
  BarChart3,
  FileText,
  CheckCircle2,
  ChevronRight,
  Menu,
  X,
  TrendingUp,
  Search,
  DollarSign,
  Users,
  Star,
} from "lucide-react";

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ onLogin }: { onLogin: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const links = ["Platform", "Solutions", "Pricing", "Resources"];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "glass-effect-dark border-b border-border/40 shadow-lg" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-foreground tracking-tight">RFPilot</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <button
              key={l}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-all"
            >
              {l}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={onLogin}
            className="px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            Log in
          </button>
          <button
            onClick={onLogin}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-white hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/25 active:scale-95"
          >
            Request demo
          </button>
        </div>

        <button
          className="md:hidden p-2 rounded-lg text-foreground"
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background border-b border-border px-6 pb-4 space-y-1"
          >
            {links.map((l) => (
              <button
                key={l}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg"
              >
                {l}
              </button>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={onLogin}
                className="w-full py-2.5 text-sm font-medium border border-border rounded-xl"
              >
                Log in
              </button>
              <button
                onClick={onLogin}
                className="w-full py-2.5 text-sm font-semibold rounded-xl bg-primary text-white"
              >
                Request demo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ onLogin }: { onLogin: () => void }) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-primary/8 blur-[100px]" />
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="max-w-5xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-8"
        >
          <Zap className="h-3.5 w-3.5" />
          AI-Powered RFP Response Platform
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6"
        >
          Intelligent,{" "}
          <span className="gradient-text">automated</span>
          <br />
          responses that{" "}
          <span className="gradient-text">win</span> RFPs.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          RFPilot's agentic AI discovers opportunities, matches your product catalog,
          builds winning proposals, and prices with precision — all in minutes.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16"
        >
          <button
            onClick={onLogin}
            className="group flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-primary text-white font-semibold text-base hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 transition-all active:scale-95"
          >
            Get started free
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={onLogin}
            className="px-7 py-3.5 rounded-2xl border border-border bg-card/50 text-foreground font-semibold text-base hover:border-primary/40 hover:bg-card transition-all"
          >
            See the platform
          </button>
        </motion.div>

        {/* Dashboard preview mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45 }}
          className="relative mx-auto max-w-4xl"
        >
          <div className="card-elevated overflow-hidden rounded-2xl border border-border/50 shadow-2xl">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
              <span className="w-3 h-3 rounded-full bg-red-400/70" />
              <span className="w-3 h-3 rounded-full bg-yellow-400/70" />
              <span className="w-3 h-3 rounded-full bg-green-400/70" />
              <div className="flex-1 mx-4">
                <div className="h-5 w-48 mx-auto rounded-md bg-border/60 flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">rfpilot.app/dashboard</span>
                </div>
              </div>
            </div>

            <div className="p-6 grid grid-cols-4 gap-4">
              {[
                { label: "Active RFPs", value: "12", color: "text-primary", icon: FileText },
                { label: "Win Rate", value: "73%", color: "text-green-400", icon: TrendingUp },
                { label: "Proposals Sent", value: "38", color: "text-yellow-400", icon: CheckCircle2 },
                { label: "Avg. Response", value: "2.4h", color: "text-purple-400", icon: Clock },
              ].map((kpi) => (
                <div key={kpi.label} className="kpi-card p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{kpi.label}</span>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                  <span className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</span>
                </div>
              ))}
              <div className="col-span-4 rounded-xl border border-border/50 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      {['RFP Title', 'Buyer', 'Deadline', 'Status', 'Match'].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 font-semibold text-muted-foreground tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { title: "Network Infra Upgrade", buyer: "BSNL", deadline: "Mar 15", status: "Analyzed", pct: "92%" },
                      { title: "Security Equipment RFP", buyer: "Indian Railways", deadline: "Mar 22", status: "Extracted", pct: "88%" },
                      { title: "Data Centre Hardware", buyer: "ONGC", deadline: "Apr 2", status: "New", pct: "—" },
                    ].map((row) => (
                      <tr key={row.title} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{row.title}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.buyer}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.deadline}</td>
                        <td className="px-4 py-3">
                          <span className={`badge-status ${row.status === "Analyzed" ? "badge-analyzed" : row.status === "Extracted" ? "badge-extracted" : "badge-new"}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-primary">{row.pct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-primary/20 blur-3xl rounded-full -z-10" />
        </motion.div>
      </div>
    </section>
  );
}

// ─── Logo bar (infinite marquee carousel) ────────────────────────────────────
const LOGOS = [
  { name: "Asian Paints", src: "https://upload.wikimedia.org/wikipedia/commons/e/e3/Asian_Paints_Logo.svg" },
  { name: "ONGC", src: "https://upload.wikimedia.org/wikipedia/commons/6/6a/ONGC_Logo.png" },
  { name: "NTPC", src: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/NTPC_logo.svg/240px-NTPC_logo.svg.png" },
  { name: "HAL", src: "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/HAL-Logo.svg/200px-HAL-Logo.svg.png" },
  { name: "BHEL", src: "https://upload.wikimedia.org/wikipedia/commons/b/b8/BHEL_logo.svg" },
  { name: "ISRO", src: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Indian_Space_Research_Organisation_Logo.svg/160px-Indian_Space_Research_Organisation_Logo.svg.png" },
  { name: "Tata Group", src: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Tata_logo.svg/240px-Tata_logo.svg.png" },
  { name: "L&T", src: "https://upload.wikimedia.org/wikipedia/commons/b/b5/L_%26_T.png" },
  { name: "Siemens", src: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Siemens-logo.svg/240px-Siemens-logo.svg.png" },
  { name: "Infosys", src: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Infosys_logo.svg/240px-Infosys_logo.svg.png" },
];

function LogoBar() {
  const doubled = [...LOGOS, ...LOGOS];

  return (
    <section className="py-14 border-y border-border/40 overflow-hidden">
      <p className="text-center text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-10">
        Trusted by India's leading PSUs & enterprises
      </p>
      <div
        className="relative"
        style={{
          maskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
        }}
      >
        <div className="flex animate-marquee" style={{ width: "max-content" }}>
          {doubled.map((logo, idx) => (
            <div key={`${logo.name}-${idx}`} className="flex items-center justify-center mx-10 flex-shrink-0" style={{ height: 52, minWidth: 110 }}>
              <img
                src={logo.src}
                alt={logo.name}
                title={logo.name}
                className="max-h-10 max-w-[110px] object-contain opacity-100 hover:opacity-100 transition-opacity duration-300"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = "none";
                  const span = document.createElement("span");
                  span.textContent = logo.name;
                  span.className = "text-sm font-bold text-muted-foreground/40";
                  target.parentNode?.appendChild(span);
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function Stats() {
  const stats = [
    { icon: DollarSign, value: "₹2B+", label: "in total bids managed" },
    { icon: Search, value: "50+", label: "PSU portals monitored" },
    { icon: FileText, value: "10M+", label: "RFP clauses analyzed" },
    { icon: Users, value: "200+", label: "teams worldwide" },
  ];
  return (
    <section className="py-20 bg-sidebar-background">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            The leader in{" "}
            <span className="gradient-text">response intelligence</span>,
            <br />
            trusted across India
          </h2>
        </motion.div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="card-elevated p-6 flex flex-col items-center text-center gap-3 hover:border-primary/30 transition-all group"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 group-hover:bg-primary/25 transition-colors">
                <s.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="text-3xl font-bold text-foreground">{s.value}</div>
              <div className="text-sm text-muted-foreground leading-tight">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
function Features() {
  const [active, setActive] = useState(0);
  const roles = [
    {
      label: "Bid & Proposal Managers",
      icon: FileText,
      headline: "Draft winning proposals in hours, not weeks",
      description:
        "RFPilot AI drafts, scores, and refines your bid responses end-to-end. Coordinate across sales, technical, and pricing teams with live updates and one-click exports.",
      points: [
        "Auto-generate compliant proposal drafts",
        "Real-time collaboration across teams",
        "Smart deadline tracking & alerts",
        "One-click PPTX / PDF export",
      ],
    },
    {
      label: "Sales",
      icon: TrendingUp,
      headline: "Discover & qualify RFPs before your competition",
      description:
        "Continuously monitor 50+ government and PSU portals. Get instant alerts matched to your domain and scored for win probability — before the deadline.",
      points: [
        "50+ PSU portal monitoring",
        "AI win-probability scoring",
        "Email & in-app RFP alerts",
        "Competitor bid intelligence",
      ],
    },
    {
      label: "Technical Teams",
      icon: Target,
      headline: "Instant SKU & spec matching against any RFP",
      description:
        "Upload your product catalog once. RFPilot maps every RFP requirement to your best matching SKU, flags gaps, and suggests spec-compliant alternatives.",
      points: [
        "Semantic SKU matching (SBERT-powered)",
        "Spec gap analysis & warnings",
        "Top-3 alternatives per item",
        "Direct catalog sync via MongoDB",
      ],
    },
    {
      label: "Pricing",
      icon: DollarSign,
      headline: "Data-driven pricing that maximises win rate",
      description:
        "Draw on historical bid data to price competitively. Dynamic margin controls, L1-aware pricing, and automatic BoQ generation let you price to win.",
      points: [
        "Historical win/loss analysis",
        "Margin & L1-aware pricing engine",
        "Auto-generated BoQ tables",
        "Risk-adjusted pricing recommendations",
      ],
    },
  ];
  const role = roles[active];

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            The AI platform for <span className="gradient-text">every team</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Purpose-built agents work together to handle the entire RFP lifecycle.
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {roles.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setActive(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                active === i
                  ? "bg-primary text-white shadow-lg shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent hover:border-border"
              }`}
            >
              <r.icon className="h-4 w-4" />
              {r.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35 }}
            className="grid md:grid-cols-2 gap-8 items-center"
          >
            <div className="space-y-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
                <role.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">{role.headline}</h3>
              <p className="text-muted-foreground leading-relaxed">{role.description}</p>
              <ul className="space-y-3">
                {role.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card-elevated rounded-2xl p-6 space-y-3 border border-border/50 shadow-xl">
              <div className="flex items-center gap-3 pb-3 border-b border-border/40">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20">
                  <role.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{role.label} Agent</div>
                  <div className="text-xs text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                    Active
                  </div>
                </div>
              </div>
              {role.points.map((p, i) => (
                <div key={p} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/20 text-primary text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-sm text-foreground">{p}</span>
                  <CheckCircle2 className="h-4 w-4 text-green-400 ml-auto flex-shrink-0" />
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { icon: Search, step: "01", title: "Discover", description: "AI agents continuously scrape 50+ PSU and government portals, extracting new RFPs and tagging them by domain, value, and urgency." },
    { icon: Brain, step: "02", title: "Analyse", description: "Technical, sales, and pricing agents analyse requirements, match your catalog, score win probability, and flag compliance gaps — in parallel." },
    { icon: FileText, step: "03", title: "Propose", description: "A full proposal is generated with cover letter, BoQ pricing table, and technical justification. Reviewed and refined with one click." },
    { icon: BarChart3, step: "04", title: "Win & Learn", description: "Track bid outcomes, monitor competitor pricing trends, and continuously improve your strategy with AI-driven win/loss insights." },
  ];
  return (
    <section className="py-24 bg-sidebar-background">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            From discovery to <span className="gradient-text">winning bid</span> in hours
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">Four autonomous agents. One seamless workflow.</p>
        </motion.div>
        <div className="grid md:grid-cols-4 gap-6 relative">
          <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.12 }}
              className="card-elevated p-6 flex flex-col items-center text-center gap-4 hover:border-primary/30 transition-all group"
            >
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 group-hover:bg-primary/25 transition-colors">
                <s.icon className="h-8 w-8 text-primary" />
                <span className="absolute -top-2 -right-2 text-xs font-bold text-primary bg-primary/15 border border-primary/30 rounded-full w-6 h-6 flex items-center justify-center">
                  {s.step}
                </span>
              </div>
              <h3 className="text-lg font-bold text-foreground">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
function Testimonials() {
  const testimonials = [
    { quote: "RFPilot cut our response time from 3 weeks to 2 days. Our win rate jumped 35% in the first quarter.", name: "Rajesh Kumar", role: "Head of Bid Management, Tata Projects" },
    { quote: "The SKU matching alone saves our technical team 40 hours per RFP. It's like having an expert analyst on every bid.", name: "Priya Sharma", role: "VP Engineering, L&T Technology Services" },
    { quote: "We monitor 50+ PSU portals without lifting a finger. We never miss a relevant opportunity now.", name: "Ankit Mehta", role: "Sales Director, Siemens India" },
  ];
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Teams that use RFPilot <span className="gradient-text">win more</span>
          </h2>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="card-elevated p-6 flex flex-col gap-4 hover:border-primary/30 transition-all"
            >
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm text-foreground leading-relaxed">"{t.quote}"</p>
              <div className="mt-auto pt-4 border-t border-border/40">
                <div className="font-semibold text-sm text-foreground">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────
function CTA({ onLogin }: { onLogin: () => void }) {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-[100px] rounded-full" />
      </div>
      <div className="max-w-3xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/15 mx-auto">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
            Start winning RFPs <span className="gradient-text">today</span>
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Join the teams that use RFPilot to discover, analyse, and respond to every bid opportunity — faster than the competition.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={onLogin}
              className="group flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-white font-semibold text-base hover:bg-primary/90 hover:shadow-2xl hover:shadow-primary/30 transition-all active:scale-95"
            >
              Get started free
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={onLogin}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl border border-border text-foreground font-semibold text-base hover:border-primary/40 hover:bg-muted/50 transition-all"
            >
              Contact sales <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            Enterprise-grade security · SOC 2 Compliant · 99.9% Uptime SLA
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-border/40 py-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-foreground">RFPilot</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          {['Privacy', 'Terms', 'Security', 'Contact'].map((l) => (
            <button key={l} className="hover:text-foreground transition-colors">{l}</button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} RFPilot. All rights reserved.</p>
      </div>
    </footer>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Index() {
  const navigate = useNavigate();
  const goLogin = () => navigate("/login");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar onLogin={goLogin} />
      <Hero onLogin={goLogin} />
      <LogoBar />
      <Stats />
      <Features />
      <HowItWorks />
      <Testimonials />
      <CTA onLogin={goLogin} />
      <Footer />
    </div>
  );
}
