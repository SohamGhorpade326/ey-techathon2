import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Discovery from "./pages/Discovery";
import RFPDetails from "./pages/RFPDetails";
import Analysis from "./pages/Analysis";
import Pricing from "./pages/Pricing";
import Proposal from "./pages/Proposal";
import Notifications from "./pages/Notifications";
import Repository from "./pages/Repository";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Masteragent from "./pages/Masteragent";
import SkuGapAnalytics from "./pages/SkuGapAnalytics";
import StrategicInsights from "./pages/StrategicInsights";
import { TranslateProvider } from "./providers/TranslateProvider";
import AppRoutes from "./AppRoutes";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <TranslateProvider>
        <AppRoutes />
      </TranslateProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
