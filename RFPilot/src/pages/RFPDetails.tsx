import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "react-router-dom";
import Groq from "groq-sdk";
import {
  Calendar,
  Building2,
  AlertTriangle,
  ExternalLink,
  Package,
  FileText,
  DollarSign,
  Play,
  Cpu,
  Loader2,
  Sparkles,
  Download,
} from "lucide-react";

import { MainLayout } from "@/components/layout/MainLayout";
import { useT } from "@/hooks/useT";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";

// Initialize Groq with your provided key
const groq = new Groq({ 
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true 
});

export default function RFPDetails() {
  const { t } = useT();
  const [rfp, setRfp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [rfpItems, setRfpItems] = useState<any>(null);
  const [isFetchingItems, setIsFetchingItems] = useState(false);
  const [showItems, setShowItems] = useState(false);

  const { rfpId } = useParams();
  const decodedId = decodeURIComponent(rfpId || "");
  const { theme } = useTheme();
  const isLight = theme === "light";

  // In RFPDetails.tsx
useEffect(() => {
  if (!rfpId) return;
  setLoading(true);
  
  // Use raw rfpId from useParams directly
  const fetchUrl = `http://127.0.0.1:8000/rfps/${rfpId}`;

  fetch(fetchUrl)
    .then(async (res) => {
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRfp(data);
      setError(null);
    })
    .catch((err) => {
      setError(err.message);
      setRfp(null);
    })
    .finally(() => setLoading(false));
}, [rfpId]);


  const handleAnalyzeRFP = async () => {
    if (!rfp || !rfpId) return;
    setIsAnalyzing(true);
    setSummary(null);

    try {
      // Fetch RFP items first
      let itemsText = "Items information not available.";
      try {
        const itemsResponse = await fetch(`http://127.0.0.1:8000/rfps/${rfpId}/items`);
        const itemsData = await itemsResponse.json();
        
        if (itemsData.items && itemsData.items.length > 0) {
          itemsText = `Total Items: ${itemsData.total_items}\n\nItem List:\n` + 
            itemsData.items.map((item: any, idx: number) => 
              `${idx + 1}. ${item.item_name} (Quantity: ${item.quantity})`
            ).join('\n');
        }
      } catch (itemsErr) {
        console.error("Failed to fetch items:", itemsErr);
      }

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a senior sales analyst. Provide detailed, professional RFP summaries without using markdown formatting (no **, ###, or other symbols). Use plain text with proper indentation and line breaks for readability.",
          },
          {
            role: "user",
            content: `Analyze this RFP in detail and provide a comprehensive professional summary. Format it as plain text without markdown symbols. Include:

1. EXECUTIVE SUMMARY: 
   - Provide a detailed overview of the tender (3-4 sentences)
   - Highlight the scope and purpose
   - Mention the issuing organization

2. KEY DELIVERABLES AND ITEMS REQUIRED:
   - List each item with detailed description
   - Include technical specifications if mentioned
   - Group similar items together

3. QUANTITIES AND SCOPE:
   - Provide detailed quantity information for each item
   - Mention any special requirements or conditions
   - Note any testing or quality requirements

4. DEADLINE AND URGENCY:
   - Analyze the deadline and time available
   - Assess urgency level with justification
   - Mention submission requirements

5. COMMERCIAL DETAILS:
   - Estimated project value and budget considerations
   - Any payment terms or conditions mentioned

RFP Data:
Title: ${rfp.rfp_title}
Buyer: ${rfp.buyer}
Deadline: ${rfp.submission_deadline}
Value: ${rfp.estimated_project_value}
Priority: ${rfp.priority}

${itemsText}

Provide detailed analysis without using markdown formatting symbols. Use plain text with clear section headers and bullet points using dashes (-) or numbers.`,
          
          },
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
        max_tokens: 1500,
      });

      const text = chatCompletion.choices[0]?.message?.content;
      if (!text) throw new Error("Empty response from Groq");
      setSummary(text);
    } catch (err: any) {
      console.error("Groq API Error:", err);
      setSummary(`Analysis Failed: ${err.message || "Check API key or Rate Limits"}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFetchRfpItems = async () => {
    if (!rfpId) return;
    
    setIsFetchingItems(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/rfps/${rfpId}/items`);
      const data = await response.json();
      
      if (data.error) {
        setRfpItems({ error: data.error });
      } else {
        setRfpItems(data);
        setShowItems(true);
      }
    } catch (err: any) {
      console.error("Error fetching RFP items:", err);
      setRfpItems({ error: "Failed to fetch RFP items" });
    } finally {
      setIsFetchingItems(false);
    }
  };

  const handleDownloadSummary = () => {
    const printableWindow = window.open('', '_blank');
    if (!printableWindow) return;

    printableWindow.document.write(`
      <html>
        <head>
          <title>${t("Masteragent.reportTitle","RFP Intelligence Report")} - ${rfp.rfp_id}</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.6; }
            .header { border-bottom: 3px solid #10b981; padding-bottom: 10px; margin-bottom: 20px; }
            h1 { color: #10b981; margin: 0; }
            .meta { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 30px; font-size: 14px; }
            .content { white-space: pre-wrap; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="header"><h1>${t("Masteragent.reportTitle","RFP Intelligence Report")}</h1></div>
          <div class="meta">
            <strong>ID:</strong> ${rfp.rfp_id}<br/>
            <strong>Title:</strong> ${rfp.rfp_title}<br/>
            <strong>Buyer:</strong> ${rfp.buyer}<br/>
            <strong>Generated:</strong> ${new Date().toLocaleDateString()}
          </div>
          <div class="content">${summary}</div>
        </body>
      </html>
    `);
    printableWindow.document.close();
    printableWindow.print();
  };

  if (loading) return (
    <MainLayout title="Loading RFP...">
      <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    </MainLayout>
  );

  if (!rfp || rfp.error) return (
    <MainLayout title="RFP Not Found">
      <div className="text-center py-20">
        <p className="text-muted-foreground mb-4">{error || "RFP data not available"}</p>
        <Button onClick={() => window.location.reload()}>Retry Connection</Button>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout title={rfp.rfp_title}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div className="lg:col-span-2 card-elevated p-6">
          <div className="flex justify-between">
            <div>
                <p className={`text-sm font-mono ${isLight ? 'text-slate-600' : 'text-muted-foreground'}`}>{decodedId}</p>
                <h1 className={`text-2xl font-bold mt-1 ${isLight ? 'text-slate-900' : ''}`}>{rfp.rfp_title}</h1>
            </div>
            <Button size="icon" variant="ghost" asChild>
              <a href={rfp.tender_source} target="_blank" rel="noreferrer"><ExternalLink className="h-5 w-5" /></a>
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-6 pt-6 border-t">
            <Info label="Buyer" icon={<Building2 />} value={rfp.buyer} />
            <Info label="Scope Items" icon={<Package />} value={`${rfp.scope_items}`} />
            <Info label="Est. Value" icon={<DollarSign />} value={rfp.estimated_project_value} />
            <Info label="Status" icon={<FileText />} value={rfp.status} />
            <Info label="Days Remaining" icon={<Calendar />} value={`${rfp.days_remaining} days`} />
          </div>
        </motion.div>

        <motion.div className={`card-elevated p-6 border-2 ${isLight ? 'border-red-100 bg-red-50' : 'border-red-500 bg-red-500/5'}`}>
          <div className={`flex items-center gap-2 mb-4 ${isLight ? 'text-red-700' : 'text-red-500'}`}>
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-semibold">Submission Deadline</h3>
          </div>
          <div className="text-center">
            <p className={`text-3xl font-bold ${isLight ? 'text-red-700' : 'text-red-500'}`}>{rfp.submission_deadline}</p>
            <div className="mt-4 flex justify-center">
              <span className={`px-4 py-1 rounded-full text-sm font-semibold ${rfp.priority === "High" ? (isLight ? 'bg-red-600 text-white' : 'bg-red-600 text-white') : (isLight ? 'bg-yellow-200 text-yellow-800' : 'bg-yellow-400 text-black')}`}>
                Priority: {rfp.priority}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {summary && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className={`mt-6 rounded-xl overflow-hidden border-2 ${isLight ? 'border-green-100 bg-green-50' : 'border-green-500 bg-green-500/10'}`}>
            <div className={`flex items-center justify-between p-4 border-b ${isLight ? 'bg-green-50 border-green-100' : 'bg-green-500/20 border-green-500'}`}>
              <div className={`flex items-center gap-2 font-bold ${isLight ? 'text-green-700' : 'text-green-500'}`}>
                <Sparkles className="h-5 w-5" />
                <h3>AI Strategic Summary (Groq)</h3>
              </div>
              {!summary.includes("Failed") && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownloadSummary}
                  className={`${isLight ? 'bg-green-700 hover:bg-green-800 text-white border-none h-8' : 'bg-green-600 hover:bg-green-700 text-white border-none h-8'}`}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Report
                </Button>
              )}
            </div>
            <div className={`p-6 text-sm leading-relaxed whitespace-pre-wrap ${isLight ? 'text-slate-800' : 'text-green-50'}`}>
              {summary}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showItems && rfpItems && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 border-2 border-blue-500 bg-blue-500/10 rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between bg-blue-500/20 p-4 border-b border-blue-500">
              <div className="flex items-center gap-2 text-blue-400 font-bold">
                <Package className="h-5 w-5" />
                <h3>RFP Items & Quantities</h3>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowItems(false)}
                className="text-blue-400 hover:text-blue-300"
              >
                Close
              </Button>
            </div>
            <div className="p-6">
              {rfpItems.error ? (
                <div className={`text-sm ${isLight ? 'text-red-700' : 'text-red-400'}`}>
                  {rfpItems.error}
                </div>
              ) : rfpItems.message ? (
                <div className={`text-sm ${isLight ? 'text-yellow-700' : 'text-yellow-400'}`}>
                  {rfpItems.message}
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center gap-4 text-sm">
                    <span className={`${isLight ? 'text-slate-800' : 'text-blue-300'}`}>Total Items: <strong className={`${isLight ? 'text-slate-900' : ''}`}>{rfpItems.total_items || 0}</strong></span>
                    <span className="text-muted-foreground text-xs">Extracted by Sales Agent from RFP document</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-blue-500/30">
                          <th className={`text-left py-3 px-4 font-semibold ${isLight ? 'text-slate-700' : 'text-blue-300'}`}>#</th>
                          <th className={`text-left py-3 px-4 font-semibold ${isLight ? 'text-slate-700' : 'text-blue-300'}`}>Item Name</th>
                          <th className={`text-center py-3 px-4 font-semibold ${isLight ? 'text-slate-700' : 'text-blue-300'}`}>Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rfpItems.items?.map((item: any, idx: number) => (
                          <tr key={idx} className={`border-b transition-colors ${isLight ? 'border-gray-100 hover:bg-gray-50' : 'border-blue-500/10 hover:bg-blue-500/5'}`}>
                            <td className={`py-3 px-4 font-medium ${isLight ? 'text-slate-800' : 'text-blue-200'}`}>{idx + 1}</td>
                            <td className={`py-3 px-4 ${isLight ? 'text-slate-800' : 'text-blue-100'}`}>{item.item_name || 'N/A'}</td>
                            <td className={`py-3 px-4 text-center font-medium ${isLight ? 'text-slate-800' : 'text-blue-100'}`}>{item.quantity || '1'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="card-elevated p-4 mt-6 flex gap-4">
        <Button
          size="lg"
          onClick={handleAnalyzeRFP}
          disabled={isAnalyzing}
          className={summary && !summary.includes("Failed") ? "bg-green-600 hover:bg-green-700 text-white" : ""}
        >
          {isAnalyzing ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating Insights...</>
          ) : (
            <><Play className="h-4 w-4 mr-2" /> {summary ? "Refresh Analysis" : "Analyze Full RFP (AI)"}</>
          )}
        </Button>
        <Button 
          variant="outline" 
          onClick={handleFetchRfpItems}
          disabled={isFetchingItems}
          className={showItems ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600" : ""}
        >
          {isFetchingItems ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...</>
          ) : (
            <><Package className="h-4 w-4 mr-2" /> View Items</>
          )}
        </Button>
        <Button variant="outline"><DollarSign className="h-4 w-4 mr-2" /> Pricing Intel</Button>
      </div>
      
    </MainLayout>
  );
}

function Info({ label, value, icon }: any) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <div className="text-primary h-4 w-4">{icon}</div>
        <span className="font-medium text-sm">{value}</span>
      </div>
    </div>
  );
}