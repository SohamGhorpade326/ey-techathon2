import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Discovery from "./pages/Discovery";
import RFPDetails from "./pages/RFPDetails";
import Analysis from "./pages/Analysis";
import Pricing from "./pages/Pricing";
import Proposal from "./pages/Proposal";
import Notifications from "./pages/Notifications";
import AwaitingApproval from "./pages/AwaitingApproval";
import Repository from "./pages/Repository";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Masteragent from "./pages/Masteragent";
import SkuGapAnalytics from "./pages/SkuGapAnalytics";
import StrategicInsights from "./pages/StrategicInsights";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ChatbotOverlay } from "@/components/chatbot/ChatbotOverlay";

const AppRoutes = () => (
  <BrowserRouter>
    <ChatbotOverlay />
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login/*" element={<Login />} />
      <Route path="/awaiting-approval" element={<AwaitingApproval />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/discovery" element={<Discovery />} />
      <Route path="/rfp/:rfpId*" element={<RFPDetails />} />
      <Route path="/analysis" element={<Analysis />} />
      <Route path="/sku-gap-analytics" element={<SkuGapAnalytics />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/proposal" element={<Proposal />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/repository" element={<Repository />} />
      <Route path="/settings" element={<ProtectedRoute allowedRoles={["super_admin"]}><Settings /></ProtectedRoute>} />
      <Route path="/master-agent" element={<Masteragent />} />
      <Route path="/strategic-insights" element={<StrategicInsights />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default AppRoutes;
