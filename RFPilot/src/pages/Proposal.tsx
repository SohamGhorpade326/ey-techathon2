import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  History,
  Save,
  Send,
  Sparkles,
  Loader2,
  Edit3,
  RotateCcw,
  X,
  Paperclip,
} from "lucide-react";
import { useT } from "@/hooks/useT";
import jsPDF from "jspdf";
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  AlignmentType, 
  HeadingLevel,
  BorderStyle,
  PageNumber,
  Header,
  Footer,
  PageBreak
} from "docx";

const API = "http://127.0.0.1:8000";

const versions = [
  { id: 1, version: "v1.0", date: "2024-01-15 10:30", author: "System", status: "Draft" },
  { id: 2, version: "v1.1", date: "2024-01-15 14:45", author: "Sales Lead", status: "Draft" },
  { id: 3, version: "v1.2", date: "2024-01-16 09:15", author: "Sales Lead", status: "Review" },
];

export default function Proposal() {
  const { t, registerText, lang } = useT();
  const [coverContent, setCoverContent] = useState("");
  const [originalBidContent, setOriginalBidContent] = useState(""); // Store original bid content separately
  const [editableBidContent, setEditableBidContent] = useState("");
  const [complianceItems, setComplianceItems] = useState<any[]>([]);
  const [pricingTotals, setPricingTotals] = useState<any>(null);
  const [pricingItems, setPricingItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [discount, setDiscount] = useState(2);
  const [discountApplied, setDiscountApplied] = useState(false);
  const [savingBid, setSavingBid] = useState(false);
  const [generatingCoverLetter, setGeneratingCoverLetter] = useState(false);
  const [coverLetterMode, setCoverLetterMode] = useState<"initial" | "ai" | "manual">("initial");
  const [isExportingPPT, setIsExportingPPT] = useState(false);
  
  // Gmail modal states
  const [showGmailModal, setShowGmailModal] = useState(false);
  const [emailData, setEmailData] = useState({
    to: "",
    subject: "",
    body: ""
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    // Listen for cross-tab/local changes to pricing margins or discount so
    // the proposal preview updates when Pricing page changes are made.
    const storageHandler = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === 'pricing_margins' || e.key === 'pricing_discount' || e.key === 'pricing_discount_applied') {
        // Re-fetch pricing output and totals to recompute selling prices
        Promise.all([
          fetch(`${API}/pricing/totals`).then(res => res.json()),
          fetch(`${API}/pricing/output`).then(res => res.json())
        ]).then(([totalsData, pricingData]) => {
          setPricingTotals(totalsData);

          const savedMarginsRaw = localStorage.getItem('pricing_margins');
          let margins: Record<number, number> = {};
          if (savedMarginsRaw) {
            try { margins = JSON.parse(savedMarginsRaw); } catch (_) { margins = {}; }
          }

          const itemsToSet = (pricingData.items || []).map((item: any, idx: number) => {
            const marginPercent = margins[idx] !== undefined ? margins[idx] : (item.margin_percent || 10);
            const baseCost = (item.material_total || 0) + (item.testing_cost || 0);
            const sellingPrice = baseCost / (1 - (marginPercent / 100));
            const grossMargin = sellingPrice - baseCost;
            return { ...item, margin_percent: marginPercent, selling_price: sellingPrice, gross_margin: grossMargin };
          });

          setPricingItems(itemsToSet);
        }).catch(err => {
          // ignore fetch errors here
          console.error('Error refreshing pricing after storage change', err);
        });
      }
    };
    window.addEventListener('storage', storageHandler);
    return () => window.removeEventListener('storage', storageHandler);
  }, []);
  useEffect(() => {
    Promise.all([
      fetch(`${API}/proposal`).then(res => res.json()),
      fetch(`${API}/compliance`).then(res => res.json()),
      fetch(`${API}/pricing/totals`).then(res => res.json()),
      fetch(`${API}/pricing/output`).then(res => res.json())
    ])
      .then(([proposalData, complianceData, totalsData, pricingData]) => {
        // Format proposal content professionally
        const rawProposal = proposalData.proposal || "";
        const formattedProposal = formatProposalText(rawProposal);
        setOriginalBidContent(formattedProposal); // Store original bid content
        setCoverContent(formattedProposal); // Initially show bid as cover too
        setEditableBidContent(formattedProposal); // Initialize editable content
        registerText && registerText("Proposal.bid.original", formattedProposal);
        setComplianceItems(complianceData);
        setPricingTotals(totalsData);
        
        // Load saved margins from localStorage and apply them
        const savedMargins = localStorage.getItem('pricing_margins');
        let margins: Record<string, number> = {};
        
        if (savedMargins) {
          try {
            margins = JSON.parse(savedMargins);
          } catch (e) {
            console.error('Error loading saved margins:', e);
          }
        }
        
        // Always map items to ensure margin_percent is explicitly set for each row by index
        const itemsToSet = (pricingData.items || []).map((item: any, idx: number) => {
          // Use saved margin for this specific index, or backend value, or default to 10
          const marginPercent = margins[idx] !== undefined 
            ? margins[idx] 
            : (item.margin_percent || 10);
          const baseCost = item.material_total + item.testing_cost;
          const sellingPrice = baseCost / (1 - (marginPercent / 100));
          const grossMargin = sellingPrice - baseCost;
          return {
            ...item,
            margin_percent: marginPercent,
            selling_price: sellingPrice,
            gross_margin: grossMargin
          };
        });
        
        setPricingItems(itemsToSet);
        
        // Load saved discount from localStorage
        const savedDiscount = localStorage.getItem('pricing_discount');
        const savedDiscountApplied = localStorage.getItem('pricing_discount_applied');
        
        if (savedDiscount) {
          setDiscount(parseFloat(savedDiscount));
        }
        if (savedDiscountApplied === 'true') {
          setDiscountApplied(true);
        }
        
        setLoading(false);
        try {
          registerText && registerText("Proposal.title","Proposal Builder");
          registerText && registerText("Proposal.tab.cover","Cover Letter");
          registerText && registerText("Proposal.tab.compliance","Product Compliance");
          registerText && registerText("Proposal.tab.pricing","Pricing Summary");
          registerText && registerText("Proposal.tab.preview","Full Preview");
          registerText && registerText("Proposal.cover.aiNote","AI-powered or manually written");
          registerText && registerText("Proposal.cover.choose","Choose how you'd like to create your cover letter");
          registerText && registerText("Proposal.cover.generate","Generate with AI");
          registerText && registerText("Proposal.cover.enterManual","Enter Manually");
          registerText && registerText("Proposal.cover.reset","Reset");
          registerText && registerText("Proposal.cover.save","Save Cover Letter");

          registerText && registerText("Proposal.compliance.title","Product Compliance Table");
          registerText && registerText("Proposal.compliance.subtitle","Auto-generated from Technical Agent analysis");
          registerText && registerText("Proposal.compliance.col.rfpItem","RFP Item");
          registerText && registerText("Proposal.compliance.col.unitPrice","Unit Price");
          registerText && registerText("Proposal.compliance.col.compliance","Compliance");
          registerText && registerText("Proposal.compliance.col.specMatch","Spec-Match");

          registerText && registerText("Proposal.pricing.title","Consolidated Pricing");
          registerText && registerText("Proposal.pricing.subtitle","From Pricing Agent calculation");
          registerText && registerText("Proposal.pricing.material","Material Cost");
          registerText && registerText("Proposal.pricing.testing","Testing & Services");
          registerText && registerText("Proposal.pricing.subtotal","Subtotal");
          registerText && registerText("Proposal.pricing.discountLabel","Discount Percentage");
          registerText && registerText("Proposal.pricing.discountApplied","Discount Applied");
          registerText && registerText("Proposal.pricing.applyDiscount","Apply Discount");
          registerText && registerText("Proposal.pricing.removeDiscount","Remove Discount");
          registerText && registerText("Proposal.pricing.grandTotal","Grand Total");

          registerText && registerText("Proposal.preview.title","Editable Proposal Preview");
          registerText && registerText("Proposal.preview.save","Save Changes");
          registerText && registerText("Proposal.preview.placeholder","Edit your proposal content here...");
          registerText && registerText("Proposal.version.title","Version History");
          registerText && registerText("Proposal.version.by","by {author}");
          registerText && registerText("Proposal.version.status.Draft","Draft");
          registerText && registerText("Proposal.version.status.Review","Review");

          registerText && registerText("Proposal.actions.saveDraft","Save Draft");
          registerText && registerText("Proposal.actions.exportPDF","Export PDF");
          registerText && registerText("Proposal.actions.exportWord","Export Word");
          registerText && registerText("Proposal.actions.downloadPPT","Download PPT");
          registerText && registerText("Proposal.actions.exporting","Exporting...");
          registerText && registerText("Proposal.actions.markReady","Mark Ready to Submit");

          registerText && registerText("Proposal.email.newMessage","New Message");
          registerText && registerText("Proposal.email.to","To:");

          // register per-item texts
          (complianceData || []).forEach((it: any, idx: number) => {
            registerText && registerText(`Proposal.compliance.item.${idx}.rfp_item`, it.rfp_item || "");
            registerText && registerText(`Proposal.compliance.item.${idx}.compliance`, it.compliance || "");
          });
          (pricingData.items || []).forEach((it: any, idx: number) => {
            registerText && registerText(`Proposal.pricing.item.${idx}.sku_code`, it.sku_code || "");
            registerText && registerText(`Proposal.pricing.item.${idx}.item_name`, it.item_name || "");
          });
        } catch (e) {
          // ignore
        }
      })
      .catch(err => {
        console.error("Error fetching proposal data:", err);
        setLoading(false);
      });
  }, []);

  // Update bid content with dynamic discount information
  useEffect(() => {
    if (!originalBidContent || !pricingItems || pricingItems.length === 0) return;
    
    // Calculate subtotal
    const subtotal = pricingItems.reduce((sum, item) => sum + (item.selling_price || item.line_total || 0), 0);
    
    // Calculate discount amount and final total
    const discountAmount = discountApplied ? (subtotal * discount) / 100 : 0;
    const finalTotal = discountApplied ? subtotal - discountAmount : subtotal;
    
    // Find and replace the total bid value line in the bid content
    const totalBidRegex = /(?:Subtotal \(Based on Technical Configuration & Margin Analysis\): ₹[\d,]+\.?\d*\n\nDiscount Applied: [\d.]+% discount has been applied to the subtotal, resulting in a discount of ₹[\d,]+\.?\d*\.\n\n)?The (?:final )?(?:total )?bid value amounts to ₹[\d,]+\.?\d*/;
    
    let updatedContent = originalBidContent;
    
    if (discountApplied && discount > 0) {
      // Replace with discount breakdown
      const discountText = `Subtotal (Based on Technical Configuration & Margin Analysis): ₹${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nDiscount Applied: ${discount}% discount has been applied to the subtotal, resulting in a discount of ₹${discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.\n\nThe final bid value amounts to ₹${finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
      
      updatedContent = originalBidContent.replace(
        totalBidRegex,
        discountText
      );
      // If the regex didn't match (proposal template differs), append the discount block at the end
      if (updatedContent === originalBidContent) {
        updatedContent = `${originalBidContent}\n\n${discountText}`;
      }
    } else {
      // No discount - just update the subtotal value
      updatedContent = originalBidContent.replace(
        totalBidRegex,
        `The total bid value amounts to ₹${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
      );
      // If regex didn't match, ensure the total is present
      if (updatedContent === originalBidContent) {
        updatedContent = `${originalBidContent}\n\nThe total bid value amounts to ₹${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
      }
    }
    
    setEditableBidContent(updatedContent);
  }, [discountApplied, discount, originalBidContent, pricingItems]);

  const formatProposalText = (text: string): string => {
    // Split into paragraphs and format professionally
    return text
      .split('\n\n')
      .map(para => para.trim())
      .filter(para => para.length > 0)
      .join('\n\n');
  };

  const handleApplyDiscount = () => {
    setDiscountApplied(true);
    // Save discount to localStorage
    localStorage.setItem('pricing_discount', discount.toString());
    localStorage.setItem('pricing_discount_applied', 'true');
  };

  const handleRemoveDiscount = () => {
    setDiscountApplied(false);
    // Remove discount from localStorage
    localStorage.removeItem('pricing_discount');
    localStorage.removeItem('pricing_discount_applied');
  };

  const handleSaveBidChanges = async () => {
    setSavingBid(true);
    try {
      const response = await fetch(`${API}/proposal/edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          updated_bid: editableBidContent
        })
      });

      const result = await response.json();

      if (result.status === "success") {
        toast({
          title: t("Proposal.changesSavedTitle","Changes Saved"),
          description: t("Proposal.changesSavedDesc","Your proposal edits have been saved successfully."),
          duration: 3000,
        });
      } else {
        throw new Error(result.message || "Failed to save changes");
      }
    } catch (error: any) {
      toast({
        title: t("Proposal.errorTitle","Error"),
        description: error.message || t("Proposal.errorDesc","Failed to save changes. Please try again."),
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setSavingBid(false);
    }
  };

  const handleGenerateAICoverLetter = async () => {
    setGeneratingCoverLetter(true);
    try {
      const response = await fetch(`${API}/proposal/generate-cover-letter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          buyer: "State Electricity Board",
          rfp_title: "Power Cable Supply",
          rfp_id: "RFP/SEB/2024/1023"
        })
      });

      const result = await response.json();

      if (result.status === "success") {
        setCoverContent(result.cover_letter);
        setCoverLetterMode("ai");
        toast({
          title: t ? t("Proposal.cover.generatedTitle","Cover Letter Generated") : "Cover Letter Generated",
          description: t ? t("Proposal.cover.generatedDesc","AI-powered cover letter has been created. You can edit it before saving.") : "AI-powered cover letter has been created. You can edit it before saving.",
          duration: 3000,
        });
      } else {
        throw new Error(result.message || (t ? t("Proposal.cover.genFail","Failed to generate cover letter") : "Failed to generate cover letter"));
      }
    } catch (error: any) {
      toast({
        title: t ? t("Proposal.cover.genErrorTitle","Error") : "Error",
        description: error.message || (t ? t("Proposal.cover.genErrorDesc","Failed to generate cover letter. Please try again.") : "Failed to generate cover letter. Please try again."),
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setGeneratingCoverLetter(false);
    }
  };

  const handleManualCoverLetter = () => {
    setCoverContent("");
    setCoverLetterMode("manual");
  };

  const handleResetCoverLetter = () => {
    setCoverContent(originalBidContent); // Reset to original bid content
    setCoverLetterMode("initial");
  };

  const handleMarkReadyToSubmit = () => {
    // Determine recipient based on RFP
    const rfpTitle = "Painting and repair work of National Housing Bank's flats located at Mumbai";
    let recipient = "";
    
    if (rfpTitle.toLowerCase().includes("nhb") || rfpTitle.toLowerCase().includes("housing bank")) {
      recipient = "romum@nhb.org.in";
    } else if (rfpTitle.toLowerCase().includes("sac") || rfpTitle.toLowerCase().includes("isro")) {
      recipient = "stores_receipt@sac.isro.gov.in";
    }
    
    // Pre-fill email data with ONLY the cover letter (not full bid)
    const emailBody = coverContent || (t ? t("Proposal.email.noCover","Please generate a cover letter first.") : "Please generate a cover letter first.");
    setEmailData({
      to: recipient,
      subject: `Proposal Submission - ${rfpTitle}`,
      body: emailBody
    });
    setShowGmailModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...files]);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendEmail = async () => {
    if (!emailData.to || !emailData.subject) {
      toast({
        title: "Missing Information",
        description: "Please fill in recipient and subject fields.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setSendingEmail(true);
    try {
      const formData = new FormData();
      formData.append("to_email", emailData.to);
      formData.append("subject", emailData.subject);
      formData.append("html_content", emailData.body);
      
      // Append all attachments
      attachments.forEach((file) => {
        formData.append("attachments", file);
      });

      const response = await fetch(`${API}/proposal/send-email`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (result.status === "success") {
        toast({
          title: t ? t("Proposal.email.sentTitle","Email Sent Successfully") : "Email Sent Successfully",
          description: t ? t("Proposal.email.sentDesc","Bid submitted to {email} via SendGrid.").replace('{email}', emailData.to) : `Bid submitted to ${emailData.to} via SendGrid.`,
          duration: 3000,
        });
        setShowGmailModal(false);
        setAttachments([]);
      } else {
        throw new Error(result.message || (t ? t("Proposal.email.fail","Failed to send email") : "Failed to send email"));
      }
    } catch (error: any) {
      toast({
        title: t ? t("Proposal.email.errorTitle","Error") : "Error",
        description: error.message || (t ? t("Proposal.email.errorDesc","Failed to send email. Please try again.") : "Failed to send email. Please try again."),
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setSendingEmail(false);
    }
  };

  // Calculate dynamic subtotal from selling prices (includes margins)
  const getDynamicSubtotal = () => {
    if (!pricingItems || pricingItems.length === 0) {
      return pricingTotals?.grand_total || 0;
    }
    return pricingItems.reduce((sum, item) => sum + (item.selling_price || item.line_total || 0), 0);
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

  const calculateDiscountedTotal = () => {
    const subtotal = getDynamicSubtotal();
    if (!discountApplied) return subtotal;
    const discountAmount = (subtotal * discount) / 100;
    return subtotal - discountAmount;
  };

  const getDiscountAmount = () => {
    if (!discountApplied) return 0;
    const subtotal = getDynamicSubtotal();
    return (subtotal * discount) / 100;
  };

  const handleExportPDF = () => {
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Use the current editable content instead of coverContent
      const contentToExport = editableBidContent || coverContent;
      
      // Text sanitization helper
      const cleanText = (t: string) =>
        t
          .replace(/₹/g, "Rs.")
          .replace(/['']/g, "'")
          .replace(/[""]/g, '"')
          .replace(/[–—]/g, "-")
          .replace(/[\u0080-\uFFFF]/g, (char) => {
            const code = char.charCodeAt(0);
            if (code > 127) return "";
            return char;
          })
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "");
      
      // ============== COVER PAGE ==============
      // Header bar with company color
      pdf.setFillColor(41, 98, 255); // Professional blue
      pdf.rect(0, 0, pageWidth, 60, 'F');
      
      // Company name/logo area
      pdf.setFontSize(28);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("RFP BID PROPOSAL", pageWidth / 2, 30, { align: "center" });
      
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text("Technical & Commercial Submission", pageWidth / 2, 45, { align: "center" });
      
      // Central info box
      pdf.setFillColor(245, 247, 250);
      pdf.rect(25, 80, pageWidth - 50, 80, 'F');
      pdf.setDrawColor(41, 98, 255);
      pdf.setLineWidth(0.5);
      pdf.rect(25, 80, pageWidth - 50, 80, 'S');
      
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(0, 0, 0);
      pdf.text("RFP REFERENCE", pageWidth / 2, 95, { align: "center" });
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text("RFP/SEB/2024/1023", pageWidth / 2, 105, { align: "center" });
      
      pdf.setFontSize(10);
      pdf.text("State Electricity Board", pageWidth / 2, 115, { align: "center" });
      pdf.text("Power Cable Supply", pageWidth / 2, 122, { align: "center" });
      
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Submitted on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, pageWidth / 2, 140, { align: "center" });
      pdf.text(`Document Version: 1.0`, pageWidth / 2, 148, { align: "center" });
      
      // Confidentiality notice
      pdf.setFillColor(255, 243, 224);
      pdf.rect(25, 180, pageWidth - 50, 30, 'F');
      pdf.setDrawColor(255, 179, 71);
      pdf.rect(25, 180, pageWidth - 50, 30, 'S');
      
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(204, 85, 0);
      pdf.text("CONFIDENTIAL DOCUMENT", pageWidth / 2, 190, { align: "center" });
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.text("This document contains proprietary information and is intended solely for the addressee.", pageWidth / 2, 197, { align: "center" });
      pdf.text("Unauthorized distribution or copying is strictly prohibited.", pageWidth / 2, 203, { align: "center" });
      
      // Footer on cover page
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text("Prepared by: Master Agent AI System", pageWidth / 2, pageHeight - 15, { align: "center" });
      
      // ============== CONTENT PAGES ==============
      pdf.addPage();
      
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);
      let yPosition = margin + 10;
      const lineHeight = 6;
      
      const paragraphs = contentToExport.split('\n\n');
      
      paragraphs.forEach((paragraph, index) => {
        const cleanedParagraph = cleanText(paragraph);
        const lines = pdf.splitTextToSize(cleanedParagraph, maxWidth);
        
        // Check if we need a new page
        if (yPosition + (lines.length * lineHeight) > pageHeight - 30) {
          pdf.addPage();
          yPosition = margin + 10;
        }
        
        // Set font for content
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        
        lines.forEach((line: string) => {
          pdf.text(line, margin, yPosition);
          yPosition += lineHeight;
        });
        
        yPosition += 5; // Extra spacing between paragraphs
      });
      
      // ============== ADD HEADERS & FOOTERS TO ALL PAGES ==============
      const pageCount = pdf.getNumberOfPages();
      
      for (let i = 2; i <= pageCount; i++) {
        pdf.setPage(i);
        
        // Header
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.line(margin, 15, pageWidth - margin, 15);
        
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 100, 100);
        pdf.text("RFP Bid Proposal - RFP/SEB/2024/1023", margin, 12);
        pdf.text("CONFIDENTIAL", pageWidth - margin, 12, { align: "right" });
        
        // Footer
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Page ${i - 1} of ${pageCount - 1}`, pageWidth / 2, pageHeight - 10, { align: "center" });
        pdf.text(new Date().toLocaleDateString('en-IN'), margin, pageHeight - 10);
        pdf.text("Master Agent AI", pageWidth - margin, pageHeight - 10, { align: "right" });
      }
      
      pdf.save(`RFP_Bid_Proposal_${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: "PDF Exported",
        description: "Your professional bid proposal has been downloaded.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleExportWord = async () => {
    try {
      // Use the current editable content instead of coverContent
      const contentToExport = editableBidContent || coverContent;
      const paragraphs = contentToExport.split('\n\n').filter(p => p.trim().length > 0);
      
      const currentDate = new Date().toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      });
      
      const doc = new Document({
        sections: [
          // ============== COVER PAGE ==============
          {
            properties: {
              page: {
                margin: {
                  top: 1440,
                  right: 1440,
                  bottom: 1440,
                  left: 1440,
                },
              },
            },
            children: [
              // Header block with blue background (simulated with border)
              new Paragraph({
                children: [
                  new TextRun({
                    text: "RFP BID PROPOSAL",
                    bold: true,
                    size: 48,
                    color: "2962FF",
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 1000, after: 200 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Technical & Commercial Submission",
                    size: 24,
                    color: "2962FF",
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 600 },
              }),
              
              // RFP Information Box
              new Paragraph({
                children: [
                  new TextRun({
                    text: "RFP REFERENCE",
                    bold: true,
                    size: 28,
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 400, after: 200 },
                border: {
                  top: { style: BorderStyle.SINGLE, size: 20, color: "2962FF" },
                  bottom: { style: BorderStyle.SINGLE, size: 20, color: "2962FF" },
                  left: { style: BorderStyle.SINGLE, size: 20, color: "2962FF" },
                  right: { style: BorderStyle.SINGLE, size: 20, color: "2962FF" },
                },
                shading: {
                  fill: "F5F7FA",
                },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "RFP/SEB/2024/1023",
                    size: 24,
                    bold: true,
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
                shading: {
                  fill: "F5F7FA",
                },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "State Electricity Board",
                    size: 22,
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 50 },
                shading: {
                  fill: "F5F7FA",
                },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Power Cable Supply",
                    size: 22,
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
                shading: {
                  fill: "F5F7FA",
                },
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 20, color: "2962FF" },
                  left: { style: BorderStyle.SINGLE, size: 20, color: "2962FF" },
                  right: { style: BorderStyle.SINGLE, size: 20, color: "2962FF" },
                },
              }),
              
              // Document metadata
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Submitted on: ${currentDate}`,
                    size: 20,
                    color: "666666",
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 400, after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Document Version: 1.0",
                    size: 20,
                    color: "666666",
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 600 },
              }),
              
              // Confidentiality notice
              new Paragraph({
                children: [
                  new TextRun({
                    text: "CONFIDENTIAL DOCUMENT",
                    bold: true,
                    size: 20,
                    color: "CC5500",
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 400, after: 100 },
                border: {
                  top: { style: BorderStyle.SINGLE, size: 15, color: "FFB347" },
                  bottom: { style: BorderStyle.SINGLE, size: 15, color: "FFB347" },
                  left: { style: BorderStyle.SINGLE, size: 15, color: "FFB347" },
                  right: { style: BorderStyle.SINGLE, size: 15, color: "FFB347" },
                },
                shading: {
                  fill: "FFF3E0",
                },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "This document contains proprietary information and is intended solely for the addressee.",
                    size: 16,
                    color: "CC5500",
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 50 },
                shading: {
                  fill: "FFF3E0",
                },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Unauthorized distribution or copying is strictly prohibited.",
                    size: 16,
                    color: "CC5500",
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
                shading: {
                  fill: "FFF3E0",
                },
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 15, color: "FFB347" },
                  left: { style: BorderStyle.SINGLE, size: 15, color: "FFB347" },
                  right: { style: BorderStyle.SINGLE, size: 15, color: "FFB347" },
                },
              }),
              
              // Footer text
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Prepared by: Master Agent AI System",
                    size: 18,
                    color: "999999",
                    italics: true,
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 1200 },
              }),
              
              // Page break to content
              new Paragraph({
                children: [new PageBreak()],
              }),
            ],
          },
          
          // ============== CONTENT PAGES ==============
          {
            properties: {
              page: {
                margin: {
                  top: 1440,
                  right: 1440,
                  bottom: 1440,
                  left: 1440,
                },
              },
            },
            headers: {
              default: new Header({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "RFP Bid Proposal - RFP/SEB/2024/1023",
                        size: 18,
                        color: "666666",
                      }),
                      new TextRun({
                        text: "                                    CONFIDENTIAL",
                        size: 18,
                        color: "666666",
                        bold: true,
                      }),
                    ],
                    border: {
                      bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" },
                    },
                    spacing: { after: 200 },
                  }),
                ],
              }),
            },
            footers: {
              default: new Footer({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: currentDate,
                        size: 18,
                        color: "666666",
                      }),
                      new TextRun({
                        text: "                    Page ",
                        size: 18,
                        color: "666666",
                      }),
                      new TextRun({
                        children: [PageNumber.CURRENT],
                        size: 18,
                        color: "666666",
                      }),
                      new TextRun({
                        text: " of ",
                        size: 18,
                        color: "666666",
                      }),
                      new TextRun({
                        children: [PageNumber.TOTAL_PAGES],
                        size: 18,
                        color: "666666",
                      }),
                      new TextRun({
                        text: "                    Master Agent AI",
                        size: 18,
                        color: "666666",
                      }),
                    ],
                    border: {
                      top: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" },
                    },
                    spacing: { before: 200 },
                  }),
                ],
              }),
            },
            children: [
              // Content paragraphs with professional formatting
              ...paragraphs.map((para, index) => 
                new Paragraph({
                  children: [
                    new TextRun({
                      text: para,
                      size: 22,
                      font: "Calibri",
                    }),
                  ],
                  spacing: { 
                    after: 280,
                    line: 360,
                  },
                  alignment: AlignmentType.JUSTIFIED,
                })
              ),
            ],
          },
        ],
      });
      
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `RFP_Bid_Proposal_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Word Document Exported",
        description: "Your professional bid proposal has been downloaded.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error generating Word document:", error);
      toast({
        title: "Error",
        description: "Failed to generate Word document. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleDownloadPPT = async () => {
    if (!editableBidContent && !coverContent) {
      toast({
        title: "No Content",
        description: "Please generate proposal content before exporting to PowerPoint.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setIsExportingPPT(true);
    
    try {
      const rfpId = "RFP_SEB_2024_1023"; // You can make this dynamic based on actual RFP ID
      const response = await fetch(`${API}/api/proposal/export-ppt/${rfpId}`);
      
      if (!response.ok) {
        throw new Error("Failed to generate PowerPoint presentation");
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Bid_Presentation.pptx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "PowerPoint presentation exported successfully.",
        duration: 3000,
      });
    } catch (error: any) {
      console.error("Error exporting PowerPoint:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to export PowerPoint presentation.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsExportingPPT(false);
    }
  };

  if (loading) {
    return (
      <MainLayout title="Proposal Builder">
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!pricingTotals || !complianceItems.length) {
    return (
      <MainLayout title="Proposal Builder">
        <div className="text-center py-20">
          <p className="text-muted-foreground">No proposal data available. Please run the complete pipeline first.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Proposal Builder"
      breadcrumbs={[
        { name: "Dashboard", href: "/dashboard" },
        { name: "Proposal Builder" },
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
              RFP #1023 - State Electricity Board - Power Cable Supply
            </p>
            <div className="flex items-center gap-4 mt-2">
              <Badge variant="outline" className="bg-agent-master/10 text-agent-master border-agent-master/30">
                <Sparkles className="h-3 w-3 mr-1" />
                {t ? t("Proposal.masterBadge","Master Agent Consolidated") : "Master Agent Consolidated"}
              </Badge>
            </div>
          </div>
          <div className="flex gap-3">
            <Select defaultValue="v1.2">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.version}>
                    {v.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline">
              <History className="h-4 w-4 mr-2" />
              {t ? t("Proposal.version.title","Version History") : "History"}
            </Button>
          </div>
        </motion.div>

        {/* Status Line */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-6 p-4 bg-card rounded-xl border border-border"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <span className="text-sm">{t ? t("Proposal.status.technical","Technical aligned") : "Technical aligned"}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <span className="text-sm">{t ? t("Proposal.status.pricing","Pricing aligned") : "Pricing aligned"}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            <span className="text-sm">{t ? t("Proposal.status.submission","Submission pending") : "Submission pending"}</span>
          </div>
          <div className="ml-auto">
            <Badge className="bg-warning/10 text-warning border border-warning/30">
              {t ? t("Proposal.dueIn","Due in 8 days") : "Due in 8 days"}
            </Badge>
          </div>
        </motion.div>

        {/* Proposal Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs defaultValue="cover" className="space-y-4">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="cover">{t ? t("Proposal.tab.cover","Cover Letter") : "Cover Letter"}</TabsTrigger>
              <TabsTrigger value="compliance">{t ? t("Proposal.tab.compliance","Product Compliance") : "Product Compliance"}</TabsTrigger>
              <TabsTrigger value="pricing">{t ? t("Proposal.tab.pricing","Pricing Summary") : "Pricing Summary"}</TabsTrigger>
              <TabsTrigger value="preview">{t ? t("Proposal.tab.preview","Full Preview") : "Full Preview"}</TabsTrigger>
            </TabsList>

            <TabsContent value="cover" className="space-y-4">
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{t ? t("Proposal.tab.cover","Cover Letter") : "Cover Letter"}</h3>
                  <span className="text-xs text-muted-foreground">
                    {t ? t("Proposal.cover.aiNote","AI-powered or manually written") : "AI-powered or manually written"}
                  </span>
                </div>
                
                {coverLetterMode === "initial" && (
                  <div className="flex flex-col items-center justify-center py-16 space-y-4">
                    <p className="text-muted-foreground text-center mb-4">
                      {t ? t("Proposal.cover.choose","Choose how you'd like to create your cover letter") : "Choose how you'd like to create your cover letter"}
                    </p>
                    <div className="flex gap-4">
                      <Button 
                        onClick={handleGenerateAICoverLetter}
                        disabled={generatingCoverLetter}
                        className="gap-2"
                      >
                        {generatingCoverLetter ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t ? t("Proposal.cover.generating","Generating...") : "Generating..."}
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            {t ? t("Proposal.cover.generate","Generate with AI") : "Generate with AI"}
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={handleManualCoverLetter}
                        className="gap-2"
                      >
                            <Edit3 className="h-4 w-4" />
                            {t ? t("Proposal.cover.enterManual","Enter Manually") : "Enter Manually"}
                      </Button>
                    </div>
                  </div>
                )}

                {(coverLetterMode === "ai" || coverLetterMode === "manual") && (
                  <div className="space-y-4">
                    <Textarea
                      value={coverContent}
                      onChange={(e) => setCoverContent(e.target.value)}
                      className="min-h-[400px] font-mono text-sm"
                      placeholder={coverLetterMode === "manual" ? "Enter your cover letter here..." : ""}
                    />
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        onClick={handleResetCoverLetter}
                        className="gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset
                      </Button>
                      <Button
                        onClick={() => {
                          toast({
                            title: t ? t("Proposal.cover.savedTitle","Cover Letter Saved") : "Cover Letter Saved",
                            description: t ? t("Proposal.cover.savedDesc","Your cover letter has been saved successfully.") : "Your cover letter has been saved successfully.",
                            duration: 3000,
                          });
                        }}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Save Cover Letter
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="compliance" className="space-y-4">
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold">{t ? t("Proposal.compliance.title","Product Compliance Table") : "Product Compliance Table"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t ? t("Proposal.compliance.subtitle","Auto-generated from Technical Agent analysis") : "Auto-generated from Technical Agent analysis"}
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>{t ? t("Proposal.compliance.col.rfpItem","RFP Item") : "RFP Item"}</TableHead>
                      <TableHead>{t ? t("Proposal.compliance.col.unitPrice","Unit Price") : "Unit Price"}</TableHead>
                      <TableHead className="text-center">{t ? t("Proposal.compliance.col.compliance","Compliance") : "Compliance"}</TableHead>
                      <TableHead className="text-center">{t ? t("Proposal.compliance.col.specMatch","Spec-Match") : "Spec-Match"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complianceItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{t ? t(`Proposal.compliance.item.${index}.rfp_item`, item.rfp_item) : item.rfp_item}</TableCell>
                        <TableCell className="font-mono text-sm">₹{localizeDigits(item.unit_price?.toLocaleString())}/{t ? t("Proposal.compliance.unit","unit") : "unit"}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={
                              item.compliance === "Full"
                                ? "bg-success/10 text-success border border-success/30"
                                : "bg-warning/10 text-warning border border-warning/30"
                            }
                          >
                            {t ? t(`Proposal.compliance.item.${index}.compliance`, item.compliance) : item.compliance}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={
                              item.spec_match_percent >= 90
                                ? "bg-success/10 text-success border border-success/30"
                                : item.spec_match_percent >= 70
                                ? "bg-warning/10 text-warning border border-warning/30"
                                : "bg-destructive/10 text-destructive border border-destructive/30"
                            }
                          >
                            {localizeDigits(item.spec_match_percent?.toFixed(1))}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4">
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="mb-4">
                  <h3 className="font-semibold">{t ? t("Proposal.pricing.title","Consolidated Pricing") : "Consolidated Pricing"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t ? t("Proposal.pricing.subtitle","From Pricing Agent calculation") : "From Pricing Agent calculation"}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-6 mb-6">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">{t ? t("Proposal.pricing.material","Material Cost") : "Material Cost"}</p>
                    <p className="text-2xl font-bold font-mono mt-1">₹{localizeDigits(pricingTotals.material_total?.toLocaleString())}</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">{t ? t("Proposal.pricing.testing","Testing & Services") : "Testing & Services"}</p>
                    <p className="text-2xl font-bold font-mono mt-1">₹{localizeDigits(pricingTotals.testing_total?.toLocaleString())}</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground">{t ? t("Proposal.pricing.subtotal","Subtotal") : "Subtotal"}</p>
                    <p className="text-2xl font-bold font-mono mt-1">₹{localizeDigits(getDynamicSubtotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</p>
                  </div>
                </div>

                {/* Discount Section */}
                <div className="border-t border-border pt-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium mb-2 block">{t ? t("Proposal.pricing.discountLabel","Discount Percentage") : "Discount Percentage"}</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={discount}
                          onChange={(e) => {
                            const newDiscount = parseFloat(e.target.value) || 0;
                            setDiscount(newDiscount);
                            // Save to localStorage if discount is already applied
                            if (discountApplied) {
                              localStorage.setItem('pricing_discount', newDiscount.toString());
                            }
                          }}
                          className="w-32 px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <span className="text-muted-foreground">{t ? t("Proposal.percent","%") : "%"}</span>
                        <Button 
                          onClick={handleApplyDiscount}
                          className="ml-2"
                          disabled={discountApplied}
                        >
                          {discountApplied ? (t ? t("Proposal.pricing.discountApplied","Discount Applied") : 'Discount Applied') : (t ? t("Proposal.pricing.applyDiscount","Apply Discount") : 'Apply Discount')}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {discountApplied && (
                    <div className="space-y-3 pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">{t ? t("Proposal.pricing.discount","Discount ({p}%)",) : `Discount (${discount}%)`}</span>
                          <span className="font-mono text-destructive">-₹{localizeDigits(getDiscountAmount().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</span>
                        </div>
                        <Button 
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveDiscount}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Remove Discount
                        </Button>
                      </div>
                      <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-primary font-medium">{t ? t("Proposal.pricing.grandTotalAfter","Grand Total (After Discount)") : "Grand Total (After Discount)"}</p>
                          <p className="text-2xl font-bold font-mono text-primary">₹{localizeDigits(calculateDiscountedTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!discountApplied && (
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-primary font-medium">{t ? t("Proposal.pricing.grandTotal","Grand Total") : "Grand Total"}</p>
                        <p className="text-2xl font-bold font-mono text-primary">₹{localizeDigits(getDynamicSubtotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</p>
                      </div>
                    </div>
                  )}

                  {/* Pricing Note */}
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                      Subtotal reflects margin adjustments from Pricing Agent. All values update dynamically based on your margin settings.
                    </p>
                    {discountApplied && (
                      <p className="text-xs text-success mt-2 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Discount persists across pages and is reflected in the Full Preview bid proposal.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              <div className="bg-card rounded-xl border border-border p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{t ? t("Proposal.preview.title","Editable Proposal Preview") : "Editable Proposal Preview"}</h3>
                  <Button 
                    onClick={handleSaveBidChanges}
                    disabled={savingBid}
                    className="gap-2"
                  >
                    {savingBid ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t ? t("Proposal.preview.saving","Saving...") : "Saving..."}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        {t ? t("Proposal.preview.save","Save Changes") : "Save Changes"}
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  value={editableBidContent}
                  onChange={(e) => {
                    registerText && registerText("Proposal.bid.original", e.target.value);
                    setEditableBidContent(e.target.value);
                  }}
                  className="min-h-[600px] font-mono text-sm leading-relaxed"
                  placeholder={t ? t("Proposal.preview.placeholder","Edit your proposal content here...") : "Edit your proposal content here..."}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {t ? t("Proposal.preview.instructions","Make any necessary edits to your proposal. Click 'Save Changes' to update. PDF/Word downloads will use the latest saved version.") : "Make any necessary edits to your proposal. Click 'Save Changes' to update. PDF/Word downloads will use the latest saved version."}
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Version History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-xl border border-border p-4"
        >
          <h3 className="font-semibold mb-4">{t ? t("Proposal.version.title","Version History") : "Version History"}</h3>
          <div className="space-y-2">
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <Badge variant="outline">{v.version}</Badge>
                  <span className="text-sm">{v.date}</span>
                  <span className="text-sm text-muted-foreground">{t ? t("Proposal.version.by","by {author}").replace('{author}', v.author) : `by ${v.author}`}</span>
                </div>
                <Badge
                  className={
                    v.status === "Review"
                      ? "bg-info/10 text-info border border-info/30"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {t ? t(`Proposal.version.status.${v.status}`, v.status) : v.status}
                </Badge>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-between pt-4"
        >
          <Button variant="outline">
            <Save className="h-4 w-4 mr-2" />
            {t ? t("Proposal.actions.saveDraft","Save Draft") : "Save Draft"}
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-2" />
              {t ? t("Proposal.actions.exportPDF","Export PDF") : "Export PDF"}
            </Button>
            <Button variant="outline" onClick={handleExportWord}>
              <FileText className="h-4 w-4 mr-2" />
              {t ? t("Proposal.actions.exportWord","Export Word") : "Export Word"}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDownloadPPT}
              disabled={isExportingPPT || (!editableBidContent && !coverContent)}
            >
              {isExportingPPT ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t ? t("Proposal.actions.exporting","Exporting...") : "Exporting..."}
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  {t ? t("Proposal.actions.downloadPPT","Download PPT") : "Download PPT"}
                </>
              )}
            </Button>
            <Button onClick={handleMarkReadyToSubmit}>
              <Send className="h-4 w-4 mr-2" />
              {t ? t("Proposal.actions.markReady","Mark Ready to Submit") : "Mark Ready to Submit"}
            </Button>
          </div>
        </motion.div>

        {/* Gmail-style Email Modal */}
        <Dialog open={showGmailModal} onOpenChange={setShowGmailModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
            {/* Gmail Header */}
            <div className="bg-[#404040] text-white px-4 py-3 flex items-center justify-between">
              <DialogTitle className="text-base font-medium">{t ? t("Proposal.email.newMessage","New Message") : "New Message"}</DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-white/20 text-white"
                onClick={() => setShowGmailModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Gmail Body */}
            <div className="flex-1 overflow-y-auto bg-background">
              <div className="p-4 space-y-3">
                {/* To Field */}
                <div className="flex items-center gap-2 border-b pb-2">
                  <span className="text-sm text-muted-foreground w-16">{t ? t("Proposal.email.to","To:") : "To:"}</span>
                  <Input
                    type="email"
                    value={emailData.to}
                    onChange={(e) => setEmailData(prev => ({ ...prev, to: e.target.value }))}
                    className="border-0 focus-visible:ring-0 px-0"
                    placeholder="recipient@example.com"
                  />
                </div>

                {/* Subject Field */}
                <div className="flex items-center gap-2 border-b pb-2">
                  <span className="text-sm text-muted-foreground w-16">Subject:</span>
                  <Input
                    value={emailData.subject}
                    onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                    className="border-0 focus-visible:ring-0 px-0"
                    placeholder="Email subject"
                  />
                </div>

                {/* Rich Text Editor */}
                <div className="min-h-[300px]">
                  <ReactQuill
                    theme="snow"
                    value={emailData.body}
                    onChange={(value) => setEmailData(prev => ({ ...prev, body: value }))}
                    modules={{
                      toolbar: [
                        ['bold', 'italic', 'underline'],
                        [{ 'color': [] }],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['clean']
                      ],
                    }}
                    className="bg-white"
                  />
                </div>

                {/* Attachments */}
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Attachments:</p>
                    <div className="space-y-1">
                      {attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-muted px-3 py-2 rounded-md"
                        >
                          <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAttachment(index)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Gmail Footer */}
            <div className="border-t px-4 py-3 flex items-center justify-between bg-background">
              <div className="flex gap-2">
                <Button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Attach Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
