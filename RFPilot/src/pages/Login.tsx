import { motion } from "framer-motion";
import { SignIn, useUser, useAuth } from '@clerk/clerk-react';
import { Sparkles } from "lucide-react";
import { useState } from 'react';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.REACT_APP_CLERK_PUBLISHABLE_KEY || "";

export default function Login() {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 bg-sidebar p-12 flex-col justify-between relative overflow-hidden shadow-2xl"
        style={{ background: "var(--gradient-sidebar)" }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-sidebar-primary rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-sidebar-primary rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sidebar-primary shadow-lg shadow-sidebar-primary/50">
              <Sparkles className="h-6 w-6 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-sidebar-foreground tracking-tight">Agentic RFP</h1>
              <p className="text-sm text-sidebar-muted font-medium">Response Platform</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-4xl font-bold text-sidebar-foreground leading-tight tracking-tight"
            >
              Automatically discover RFPs.
              <br />
              <span className="bg-gradient-to-r from-sidebar-primary to-blue-400 bg-clip-text text-transparent">Respond faster.</span>
              <br />
              Win more.
            </motion.h2>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs text-sidebar-muted font-medium">
            Enterprise-grade security • SOC 2 Compliant • 99.9% Uptime
          </p>
        </div>
      </motion.div>

      {/* Right Panel - Clerk SignIn or helpful message when key missing */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {clerkPublishableKey ? (
            <>
              <SignIn path="/login" routing="path" redirectUrl="/dashboard" />
              <RequestAccessCTA />
            </>
          ) : (
            <div className="p-8 bg-card rounded-md shadow">
              <h2 className="text-xl font-semibold mb-2">Clerk not configured</h2>
              <p className="text-sm text-muted-foreground mb-4">The Clerk publishable key is not set, so the sign-in widget cannot render.</p>
              <p className="text-sm">To fix:
                <ul className="list-disc ml-5 mt-2">
                  <li>Add <code>VITE_CLERK_PUBLISHABLE_KEY</code> to your project root <code>.env</code> (or Vite env file) with your Clerk publishable key.</li>
                  <li>Ensure the app origin (e.g. <code>http://localhost:8080</code>) is added to your Clerk dashboard's Allowed Origins and Redirect URLs.</li>
                  <li>Restart the dev server after updating the env file.</li>
                </ul>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RequestAccessCTA() {
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const [status, setStatus] = useState<string | null>(null);

  const role = (user as any)?.publicMetadata?.role || (user as any)?.public_metadata?.role;

  async function requestAccess() {
    setStatus("sending");
    try {
      let token = null;
      try {
        token = await getToken({ template: "jwt" });
      } catch (e) {
        try { token = await getToken(); } catch(e2) { token = null; }
      }

      const payload = {
        clerk_user_id: user?.id,
        email: user?.primaryEmailAddress?.email || (user?.emailAddresses && user?.emailAddresses[0]?.email) || (user?.email) || null
      };

      const apiBase = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || "http://127.0.0.1:5000";
      console.debug('[RequestAccessCTA] apiBase=', apiBase, 'fullUrl=', apiBase + '/request-access');
      const res = await fetch(apiBase + "/request-access", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(await res.text());
      setStatus("requested");
    } catch (e: any) {
      console.error("Request access failed", e);
      setStatus("error");
    }
  }

  if (!isSignedIn || role) return null;

  return (
    <div className="mt-4 p-4 bg-muted rounded">
      <p className="text-sm mb-2">Your account requires approval before you can access the app.</p>
      <div className="flex items-center gap-3">
        <button onClick={requestAccess} className="btn btn-primary" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : status === 'requested' ? 'Requested' : 'Request Access'}
        </button>
        {status === 'error' && <span className="text-sm text-destructive">Failed to send request</span>}
      </div>
    </div>
  );
}
