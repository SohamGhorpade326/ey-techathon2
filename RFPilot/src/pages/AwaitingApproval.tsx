import React, { useState } from 'react';
import { useUser, useAuth, useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

export default function AwaitingApproval() {
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const clerk = useClerk();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | null>(null);

  async function requestAccess() {
    setStatus('sending');
    try {
      let token = null;
      try {
        // Use default token retrieval; explicit `jwt` template may not exist in your Clerk project
        token = await getToken();
      } catch (e) {
        console.warn('getToken() failed', e);
        token = null;
      }
      const payload = { clerk_user_id: user?.id, email: user?.primaryEmailAddress?.email || (user?.emailAddresses && user?.emailAddresses[0]?.email) || user?.email };
      const apiBase = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || 'http://localhost:5000';
      console.debug('[RequestAccess] apiBase=', apiBase, 'fullUrl=', apiBase + '/request-access');
      const res = await fetch(apiBase + '/request-access', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }, body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus('requested');
    } catch (e) {
      console.error('requestAccess failed', e);
      // If Clerk token fetch failed due to client session issues, try a second attempt without Authorization (development fallback)
      try {
        const apiBase = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || 'http://localhost:5000';
        console.debug('[RequestAccess] retrying without Authorization to', apiBase + '/request-access');
        const payload = { clerk_user_id: user?.id, email: user?.primaryEmailAddress?.email || (user?.emailAddresses && user?.emailAddresses[0]?.email) || user?.email };
        const res2 = await fetch(apiBase + '/request-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res2.ok) { setStatus('requested'); return; }
      } catch (e2) {
        console.error('requestAccess fallback also failed', e2);
      }
      setStatus('error');
    }
  }

  async function signOut() {
    try {
      await clerk.signOut();
    } catch (e) {
      console.warn('signOut failed', e);
    }
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-xl p-8 bg-card rounded shadow">
        <h1 className="text-2xl font-bold mb-4">Account Pending Approval</h1>
        <p className="text-muted-foreground mb-4">
          Your account is pending approval by an administrator. You will be notified once access is granted.
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          If you believe this is a mistake, please contact your administrator or request access below.
        </p>

        {isSignedIn && (
          <div className="flex items-center gap-3">
            <button onClick={requestAccess} className="btn btn-primary" disabled={status === 'sending' || status === 'requested'}>
              {status === 'sending' ? 'Sending…' : status === 'requested' ? 'Requested' : 'Request Access'}
            </button>
            <button onClick={signOut} className="btn">Sign out / Switch account</button>
          </div>
        )}

        {status === 'error' && <p className="text-sm text-destructive mt-3">Failed to send request. Check the backend or try again.</p>}
      </div>
    </div>
  );
}
