import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Groq from "groq-sdk";
import jsPDF from "jspdf";
import { 
  Cpu, 
  DollarSign, 
  ShieldCheck, 
  ClipboardList, 
  Settings, 
  Download, 
  Sparkles, 
  Loader2,
  ArrowLeft,
  GanttChart,
  CheckCircle2,
  ListTodo,
  Boxes,
  SkipForward
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const groq = new Groq({ 
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true 
});

export default function Masteragent() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const navigate = useNavigate();

  // Helper function to clean text for display and PDF
  const cleanTextForDisplay = (text: string): string => {
    return text
      .replace(/₹/g, 'INR ')
      .replace(/\u20b9/g, 'INR ')
      .replace(/[^\x00-\x7F\n\r]/g, ' ')  // Keep newlines
      .replace(/[^\S\r\n]+/g, ' ')  // Normalize spaces but keep newlines
      .replace(/(\d)\s+(?=\d)/g, '$1')
      .trim();
  };

  // Helper to clean single values (no newlines)
  const cleanValue = (text: string): string => {
    return text
      .replace(/₹/g, 'INR ')
      .replace(/\u20b9/g, 'INR ')
      .replace(/[^\x00-\x7F]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/(\d)\s+(?=\d)/g, '$1')
      .trim();
  };

  useEffect(() => {
    fetch("http://127.0.0.1:8000/master/output")
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const generateAISummary = async () => {
    if (!data) return;
    setIsAnalyzing(true);
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { 
            role: "system", 
            content: "You are a senior RFP strategist with deep expertise in technical and commercial analysis. Provide comprehensive, detailed strategic analysis in flowing PARAGRAPH format WITHOUT using any markdown formatting (no **, ###, bullets, or numbered lists). Write in clear, professional language as cohesive paragraphs with natural transitions. IMPORTANT: Use 'INR' or 'Rupees' instead of currency symbols. Avoid special Unicode characters. Use only standard ASCII characters for better compatibility." 
          },
          { 
            role: "user", 
            content: `Generate a comprehensive strategic analysis report for this Master Agent payload in flowing paragraph format. Write as a professional narrative report with well-structured paragraphs covering the following areas:

EXECUTIVE SUMMARY: Write a comprehensive opening paragraph that provides a complete overview of the RFP including the RFP ID, issuing organization, and full project title. Seamlessly integrate details about the project scope including all material types and categories involved. Discuss the project value range with commercial significance analysis, and explain the submission deadline along with an urgency assessment and preparation timeline. Conclude this section with high-level technical focus areas, domain complexity evaluation, and a clear strategic recommendation on whether to bid or not bid with detailed rationale.

TECHNICAL REQUIREMENTS ANALYSIS: Write several detailed paragraphs analyzing the technical aspects. Start with a comprehensive breakdown of all technical specifications and a detailed analysis of scope items and quantities. Continue with a technical complexity assessment for each requirement, discussing the required testing standards and quality protocols. Flow into compliance requirements and regulatory considerations, material specifications, and acceptance criteria. Conclude with technical risks identification including severity ratings, proposed mitigation strategies for each risk, and resource requirements covering personnel, equipment, and facilities.

PRICING AND COMMERCIAL ANALYSIS: Develop multiple paragraphs covering the financial aspects. Begin with a detailed pricing methodology breakdown and risk buffer analysis (noting the ${data.pricing_summary?.pricing_rules?.risk_threshold_percent}% threshold). Discuss material sourcing strategy and cost implications, followed by testing and quality assurance cost considerations. Address currency and payment terms analysis, budget alignment with technical requirements, and competitive positioning recommendations. End with profit margin projections, sensitivity analysis, and cost optimization opportunities.

CAPABILITY ASSESSMENT: Write paragraphs evaluating organizational readiness. Discuss internal capability mapping against requirements and provide a thorough gap analysis for missing capabilities. Address partner or subcontractor needs identification, resource availability and allocation requirements. Cover timeline feasibility analysis and capacity constraints or bottlenecks that may impact delivery.

STRATEGIC RECOMMENDATIONS: Compose detailed paragraphs providing actionable guidance. Present detailed bid strategy recommendations and competitive differentiation opportunities. Discuss value engineering suggestions and a comprehensive risk mitigation action plan. Outline key success factors for winning, implementation timeline with milestones, and decision checkpoints with contingency plans.

RISK ASSESSMENT: Write flowing paragraphs analyzing all risk dimensions. Discuss technical risks with probability and impact ratings, followed by commercial risks and mitigation approaches. Address schedule risks and contingency buffers, compliance and regulatory risks, culminating in an overall risk profile assessment (Low, Medium, or High).

NEXT STEPS AND ACTION ITEMS: Conclude with paragraphs outlining the path forward. Detail immediate actions required within 48 hours, short-term tasks for the next 1-2 weeks, and long-term preparation items. Discuss the stakeholder engagement plan and document preparation checklist needed for bid submission.

Write each section as flowing, connected paragraphs with smooth transitions. Provide extremely detailed professional insights with specific data points and actionable recommendations throughout. Make the report read like a professional consulting document with natural narrative flow.

FORMATTING RULES:
- Separate each major section with a blank line (use double line breaks between sections)
- Within each section, separate distinct paragraphs with a blank line
- Write in paragraph format with proper spacing between paragraphs
- Write currency amounts as: INR 15,00,000 to INR 22,00,000 (no currency symbols)
- Write numbers normally without extra spaces: 15,00,000 NOT 1 5, 0 0, 0 0 0
- Use only standard English characters (A-Z, a-z, 0-9, and basic punctuation)
- Avoid special Unicode characters and symbols
- No bullet points or numbered lists - only flowing paragraphs
- Each major topic (Executive Summary, Technical Requirements, etc.) should be its own paragraph group separated by blank lines

Master Agent Data: ${JSON.stringify(data, null, 2)}` 
          }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 4096,
      });
      setAiSummary(completion.choices[0]?.message?.content || "");
    } catch (err) {
      setAiSummary("Failed to generate strategic overview.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadReport = () => {
    if (!aiSummary) return;

    const cleanedSummary = cleanTextForDisplay(aiSummary);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const maxWidth = pageWidth - (margin * 2);
    let yPosition = margin;

    // Header
    pdf.setFillColor(99, 102, 241); // Indigo background
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text('RFP STRATEGIC ANALYSIS REPORT', pageWidth / 2, 20, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Generated by Master Agent AI', pageWidth / 2, 30, { align: 'center' });
    
    yPosition = 50;

    // RFP Metadata Box
    pdf.setDrawColor(99, 102, 241);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, yPosition, maxWidth, 45, 'S');
    
    yPosition += 7;
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(99, 102, 241);
    pdf.text('RFP INFORMATION', margin + 5, yPosition);
    
    yPosition += 7;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    
    const metadata = [
      `RFP ID: ${cleanValue(data.technical_summary?.rfp_context?.rfp_id || 'N/A')}`,
      `Title: ${cleanValue(data.technical_summary?.rfp_context?.title || 'N/A')}`,
      `Buyer: ${cleanValue(data.technical_summary?.rfp_context?.buyer || 'N/A')}`,
      `Domain: ${cleanValue(data.technical_summary?.rfp_context?.domain || 'N/A')}`,
      `Deadline: ${cleanValue(data.technical_summary?.rfp_context?.deadline || 'N/A')}`,
      `Estimated Value: ${cleanValue(data.technical_summary?.rfp_context?.estimated_value || 'N/A')}`,
      `Priority: ${cleanValue(data.technical_summary?.rfp_context?.priority || 'N/A')}`
    ];
    
    metadata.forEach(item => {
      if (yPosition > pageHeight - margin - 10) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(item, margin + 5, yPosition);
      yPosition += 4.5;
    });
    
    yPosition += 10;
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Generation Date: ${new Date().toLocaleString()}`, margin, yPosition);
    
    yPosition += 10;

    // AI-Generated Content
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(147, 51, 234); // Purple
    pdf.text('AI-GENERATED STRATEGIC ANALYSIS', margin, yPosition);
    yPosition += 8;

    // Add the AI summary content with proper paragraph spacing
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    
    // Split by double newlines for paragraphs, or single newlines
    const paragraphs = cleanedSummary.split(/\n\n+/).filter(p => p.trim());
    
    paragraphs.forEach((paragraph, index) => {
      if (paragraph.trim()) {
        const lines = pdf.splitTextToSize(paragraph.trim(), maxWidth);
        lines.forEach((line: string) => {
          if (yPosition > pageHeight - margin - 10) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.text(line, margin, yPosition);
          yPosition += 5;
        });
        // Add extra space between paragraphs (but not after the last one)
        if (index < paragraphs.length - 1) {
          yPosition += 4;
        }
      }
    });

    // Footer section
    yPosition += 10;
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(99, 102, 241);
    pdf.text('REPORT METADATA', margin, yPosition);
    yPosition += 6;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    const metadataInfo = [
      '• Generated by: Master Agent AI (Groq LLM)',
      '• Model: llama-3.3-70b-versatile',
      '• Analysis Type: Comprehensive Strategic Assessment',
      '• Report Version: 1.0'
    ];
    metadataInfo.forEach(info => {
      pdf.text(info, margin + 5, yPosition);
      yPosition += 5;
    });

    yPosition += 8;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(220, 38, 38); // Red
    pdf.text('DISCLAIMER', margin, yPosition);
    yPosition += 6;

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    const disclaimer = 'This report is generated by AI and should be reviewed by qualified professionals before making final bid decisions. All recommendations are based on available data and should be validated against current market conditions and organizational capabilities.';
    const disclaimerLines = pdf.splitTextToSize(disclaimer, maxWidth);
    disclaimerLines.forEach((line: string) => {
      if (yPosition > pageHeight - margin - 5) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(line, margin, yPosition);
      yPosition += 4;
    });

    // Add page numbers
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pageHeight - 10);
    }

    // Save the PDF
    pdf.save(`RFP_Strategic_Analysis_${data.technical_summary?.rfp_context?.rfp_id || 'Report'}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleStrategicSkip = async () => {
    if (!data?.technical_summary?.rfp_context?.rfp_id) {
      alert("No RFP ID found to skip");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to skip RFP ${data.technical_summary.rfp_context.rfp_id}? The system will process the next best RFP.`
    );

    if (!confirmed) return;

    setIsSkipping(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/pipeline/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (result.status === "success") {
        // Show success message
        alert(`RFP skipped successfully. Processing next best RFP...`);
        
        // Poll for the new task to complete
        const taskId = result.task_id;
        const pollInterval = setInterval(async () => {
          const statusRes = await fetch(`http://127.0.0.1:8000/run/status/${taskId}`);
          const statusData = await statusRes.json();
          
          if (statusData.status === "completed") {
            clearInterval(pollInterval);
            // Check if there are any RFPs left
            const masterRes = await fetch("http://127.0.0.1:8000/master/output");
            const masterData = await masterRes.json();
            
            if (masterData.error && masterData.error.includes("No RFPs available")) {
              setIsSkipping(false);
              alert("All available RFPs have been skipped. Please run the Sales Agent again to discover new opportunities.");
              window.location.href = "/dashboard";
            } else {
              // Reload the page to show the new RFP
              window.location.reload();
            }
          } else if (statusData.status === "failed") {
            clearInterval(pollInterval);
            // Check if it failed due to no RFPs
            const masterRes = await fetch("http://127.0.0.1:8000/master/output");
            const masterData = await masterRes.json();
            
            if (masterData.error && masterData.error.includes("No RFPs available")) {
              setIsSkipping(false);
              alert("All available RFPs have been skipped. Please run the Sales Agent again to discover new opportunities.");
              window.location.href = "/dashboard";
            } else {
              setIsSkipping(false);
              alert("Failed to process next RFP. Please check the pipeline status.");
            }
          }
        }, 2000);
        
        // Timeout after 2 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          if (isSkipping) {
            setIsSkipping(false);
            alert("Pipeline is taking longer than expected. Please check the dashboard.");
          }
        }, 120000);
      } else {
        setIsSkipping(false);
        alert(`Failed to skip RFP: ${result.message}`);
      }
    } catch (error) {
      setIsSkipping(false);
      console.error("Error skipping RFP:", error);
      alert("Failed to skip RFP. Please try again.");
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!data) return <div className="p-20 text-center">Master Agent data not found. Please execute Sales Agent first.</div>;

  const { technical_summary: tech, pricing_summary: price } = data;

  return (
    <MainLayout title="Master Agent Coordination">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
        <div className="flex gap-3">
          {/* PURPLE GRADIENT BUTTON */}
          <Button 
            size="sm" 
            onClick={generateAISummary} 
            disabled={isAnalyzing}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-none shadow-lg shadow-purple-500/20"
          >
            {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate Strategic AI Overview
          </Button>
          {aiSummary && (
            <Button variant="outline" size="sm" onClick={downloadReport}>
              <Download className="mr-2 h-4 w-4" /> Download AI Report
            </Button>
          )}
          {/* STRATEGIC SKIP BUTTON */}
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleStrategicSkip}
            disabled={isSkipping}
            className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white border-none shadow-lg shadow-orange-500/20"
          >
            {isSkipping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SkipForward className="mr-2 h-4 w-4" />}
            Strategic Skip & Cycle
          </Button>
        </div>
      </div>

      <div className="space-y-8 pb-10">
        
        {/* 1. TECHNICAL COORDINATION LAYER */}
        <section className="card-elevated border-t-4 border-blue-600 bg-slate-900/40 overflow-hidden">
          <div className="p-6 bg-blue-600/5 flex items-center gap-3 border-b border-white/5">
            <Cpu className="text-blue-400 h-6 w-6" />
            <h2 className="text-xl font-bold tracking-tight text-white">Technical Coordination Layer</h2>
          </div>
          
          <div className="p-6">
            {/* Row 1: Overview & Context */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Project Overview */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Project Overview</h3>
                <div className="p-5 rounded-lg bg-white/5 border border-white/5">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <DataBlock label="RFP ID" value={tech.rfp_context.rfp_id} />
                    <DataBlock label="Priority" value={tech.rfp_context.priority} />
                    <DataBlock label="Buyer" value={tech.rfp_context.buyer} />
                    <DataBlock label="Domain" value={tech.rfp_context.domain} />
                    <DataBlock label="Deadline" value={tech.rfp_context.deadline} />
                    <DataBlock label="Estimated Value" value={tech.rfp_context.estimated_value} highlight />
                  </div>
                  <Separator className="bg-white/10 my-4" />
                  <div className="grid grid-cols-1 gap-3">
                    <DataBlock label="Title" value={tech.rfp_context.title} />
                    <DataBlock label="Source" value={tech.rfp_context.source} />
                  </div>
                </div>
              </div>

              {/* Scope Context */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                  <Boxes className="h-3 w-3" /> Scope Context
                </h3>
                <div className="p-5 rounded-lg bg-white/5 border border-white/5">
                  <div className="space-y-4">
                    <DataBlock label="Material Type" value={tech.scope_context.material_type} highlight />
                    <DataBlock label="Scope Size" value={tech.scope_context.scope_size} />
                    <Separator className="bg-white/10" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase mb-3 font-medium">Expected Categories</p>
                      <div className="flex flex-wrap gap-2">
                        {tech.scope_context.expected_item_categories.map((cat: string) => (
                          <Badge key={cat} variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-300 border-none py-1 px-3">{cat}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Instructions & Matching */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Technical Instructions */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                  <ListTodo className="h-3 w-3" /> Agent Instructions
                </h3>
                <div className="p-5 rounded-lg bg-white/5 border border-white/5">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <BoolCheck label="Extract Items" checked={tech.technical_instructions.extract_items} />
                      <BoolCheck label="Extract Specs" checked={tech.technical_instructions.extract_required_specs} />
                    </div>
                    <Separator className="bg-white/10" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase mb-3 font-medium">Specification Priority</p>
                      <div className="flex flex-wrap gap-2">
                        {tech.technical_instructions.spec_priority.map((spec: string) => (
                          <Badge key={spec} variant="outline" className="text-[9px] border-blue-500/30 text-blue-400 font-mono uppercase py-1 px-2">{spec}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SKU Matching Rules */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                  <GanttChart className="h-3 w-3" /> SKU Matching Rules
                </h3>
                <div className="p-5 rounded-lg bg-white/5 border border-white/5">
                  <div className="grid grid-cols-2 gap-4">
                    <MetricCard label="Min Threshold" value={`${tech.sku_matching_rules.min_match_threshold}%`} />
                    <MetricCard label="Match Limit" value={`Top ${tech.sku_matching_rules.top_n}`} />
                    <MetricCard label="Warning Band" value={`≥${tech.sku_matching_rules.warning_threshold}%`} warning />
                    <MetricCard label="Green Band" value={`≥${tech.sku_matching_rules.green_threshold}%`} success />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. FINANCIAL & TESTING LAYER */}
        <section className="card-elevated border-t-4 border-emerald-600 bg-slate-900/40 overflow-hidden">
          <div className="p-6 bg-emerald-600/5 flex items-center gap-3 border-b border-white/5">
            <DollarSign className="text-emerald-400 h-6 w-6" />
            <h2 className="text-xl font-bold tracking-tight text-white">Financial & Testing Layer</h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Material Scope */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Material Scope</h3>
                <div className="p-5 rounded-lg bg-white/5 border border-white/5">
                  <div className="space-y-4">
                    <DataBlock label="Material Type" value={price.material_scope.material_type} />
                    <Separator className="bg-white/10" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase mb-3 font-medium">Expected Categories</p>
                      <div className="flex flex-wrap gap-2">
                        {price.material_scope.expected_categories.map((cat: string) => (
                          <Badge key={cat} variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-300 border-none py-1 px-3">{cat}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compliance Protocols */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Compliance Protocols</h3>
                <div className="p-5 rounded-lg bg-white/5 border border-white/5">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase mb-3 font-medium">Testing Requirements</p>
                      <div className="grid grid-cols-1 gap-2">
                        <BoolCheck label="Routine Tests" checked={price.testing_requirements.include_routine_tests} />
                        <BoolCheck label="Type Tests" checked={price.testing_requirements.include_type_tests} />
                        <BoolCheck label="Acceptance Tests" checked={price.testing_requirements.include_acceptance_tests} />
                      </div>
                    </div>
                    <Separator className="bg-white/10" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase mb-3 font-medium">Standards</p>
                      <div className="flex flex-wrap gap-2">
                        {price.testing_requirements.standards.map((std: string) => (
                          <Badge key={std} variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 font-mono py-1 px-3">{std}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing Algorithms */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Pricing Rules</h3>
                <div className="p-5 rounded-lg bg-white/5 border border-white/5">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <DataBlock label="Currency" value={price.pricing_rules.currency} />
                      <DataBlock label="Risk Buffer" value={`${price.pricing_rules.risk_threshold_percent}%`} />
                      <div className="col-span-2">
                        <DataBlock label="Material Source" value={price.pricing_rules.material_price_source} />
                      </div>
                      <div className="col-span-2">
                        <DataBlock label="Testing Source" value={price.pricing_rules.testing_price_source} />
                      </div>
                    </div>
                    <Separator className="bg-white/10" />
                    <div className="flex flex-col items-center p-4 bg-emerald-500/10 rounded-lg">
                      <p className="text-[10px] text-emerald-400 uppercase mb-2 font-bold tracking-wider">Agent Status</p>
                      <p className="text-sm font-bold text-white uppercase tracking-wide">{price.status}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PDF PATH INFO */}
        

        {/* AI STRATEGY OVERVIEW */}
        <AnimatePresence>
          {aiSummary && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-elevated p-8 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/30"
            >
              <div className="flex items-center gap-2 mb-4 text-purple-400 font-bold">
                <Sparkles className="h-5 w-5" />
                <h3>Strategic Executive Overview</h3>
              </div>
              <div className="text-sm leading-relaxed text-slate-200 prose prose-invert max-w-none whitespace-pre-wrap">
                {aiSummary ? cleanTextForDisplay(aiSummary) : aiSummary}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MainLayout>
  );
}

// UI HELPER COMPONENTS
function DataBlock({ label, value, highlight = false }: any) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-semibold leading-tight ${highlight ? "text-primary" : "text-white"}`}>{value || "N/A"}</p>
    </div>
  );
}

function Row({ label, value }: any) {
  return (
    <tr className="hover:bg-white/5 transition-colors">
      <td className="py-2 px-1 text-muted-foreground font-medium">{label}</td>
      <td className="py-2 px-1 text-right text-white font-mono">{value}</td>
    </tr>
  );
}

function MetricCard({ label, value, success, warning }: any) {
  return (
    <div className={`p-3 rounded-lg border bg-slate-900/40 ${success ? "border-emerald-500/50" : warning ? "border-yellow-500/50" : "border-white/10"}`}>
      <p className="text-[9px] uppercase text-muted-foreground mb-1 font-bold tracking-tighter">{label}</p>
      <p className={`text-base font-bold ${success ? "text-emerald-400" : warning ? "text-yellow-400" : "text-white"}`}>{value}</p>
    </div>
  );
}

function BoolCheck({ label, checked }: any) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5 border border-white/5">
      <CheckCircle2 className={`h-3 w-3 ${checked ? "text-emerald-400" : "text-slate-600"}`} />
      <span className={`text-[10px] font-medium ${checked ? "text-slate-200" : "text-slate-500"}`}>{label}</span>
    </div>
  );
}