import { useLocation } from "react-router-dom";
import ChatbotWidget from "./ChatbotWidget";

export function ChatbotOverlay() {
  const { pathname } = useLocation();

  // Explicit requirement: show everywhere (including landing page), but not on login page.
  if (pathname.startsWith("/login")) return null;

  return <ChatbotWidget />;
}
