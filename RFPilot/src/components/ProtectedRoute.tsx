import { Navigate } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from '@clerk/clerk-react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const token = localStorage.getItem("token");
  const userStr = localStorage.getItem("user");

  // Small debounce to allow Clerk SDK to finish initializing and set isSignedIn
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 450);
    return () => clearTimeout(t);
  }, []);

  const [syncing, setSyncing] = useState(false);

  // Check if user is logged in
  const { isSignedIn, user: clerkUser } = useUser();

  // When Clerk is signed in but we don't have an app JWT, call backend /api/auth/sync
  // to upsert the user and get the local JWT (stored in localStorage as 'token').
  // This hook must always run (or be declared) to preserve hook order.
  useEffect(() => {
    let cancelled = false;
    async function sync() {
      setSyncing(true);
      try {
        if (isSignedIn && clerkUser && !localStorage.getItem('token')) {
          const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          const payload = { clerk_user_id: (clerkUser as any).id, email: (clerkUser as any).primaryEmailAddress?.email || (clerkUser as any).email };
          const res = await fetch(`${apiBase}/api/auth/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (res.ok) {
            const data = await res.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
          } else {
            console.warn('Auth sync failed', await res.text());
          }
        }
      } catch (e) {
        console.error('Auth sync error', e);
      }
      setSyncing(false);
    }
    sync();
    return () => { cancelled = true; };
  }, [isSignedIn, clerkUser]);

  // If Clerk is signed-in and we're syncing with the backend for an app JWT, wait
  if (isSignedIn && !localStorage.getItem('token') && syncing) return null;
  // If Clerk is active, prefer its sign-in state; otherwise fall back to localStorage
  if (!isSignedIn && (!token || !userStr)) {
    // Wait briefly for Clerk to initialize before redirecting (avoids flicker/toggle)
    if (!ready) return null;
    return <Navigate to="/login" replace />;
  }

  // If no roles specified, allow all authenticated users
  // Determine role: prefer Clerk public metadata when signed in, else fall back to stored user
  let role: string | undefined = undefined;
  if (isSignedIn && clerkUser) {
    const meta = (clerkUser as any).publicMetadata || (clerkUser as any).public_metadata || {};
    role = meta.role || meta.roles;
  } else if (userStr) {
    try {
      const parsed = JSON.parse(userStr);
      role = parsed.role;
    } catch {
      role = undefined;
    }
  }

  // If user is signed in but has no role or role is 'pending', redirect to awaiting approval page
  if (isSignedIn && (!role || role === "pending")) {
    return <Navigate to="/awaiting-approval" replace />;
  }

  // If no roles specified, allow all authenticated users
  if (!allowedRoles || allowedRoles.length === 0) {
    return <>{children}</>;
  }

  if (!role || !allowedRoles.includes(role)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-destructive">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-muted-foreground">
            Your role: <span className="font-semibold">"{role || 'unknown'}"</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Required roles: <span className="font-semibold">{allowedRoles.join(", ")}</span>
          </p>
          <Button onClick={() => window.location.href = "/dashboard"} className="mt-4">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
