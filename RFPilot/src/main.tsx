import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./providers/ThemeProvider";
import { ClerkProvider } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.REACT_APP_CLERK_PUBLISHABLE_KEY || "";
// debug: surface the publishable key at runtime (stripped for logs if long)
try {
	const k = clerkPublishableKey || '(none)';
	const short = k && k.length > 24 ? k.slice(0, 12) + '...' + k.slice(-8) : k;
	console.debug('[Clerk] publishableKey:', short);
	if (typeof window !== 'undefined' && window.fetch) {
		const _origFetch = window.fetch.bind(window);
		window.fetch = async (input: RequestInfo, init?: RequestInit) => {
			try {
				const url = typeof input === 'string' ? input : (input as Request).url;
				if (url && url.includes('clerk.accounts.dev')) {
					console.debug('[Clerk][fetch] ->', url, init && init.method ? init.method : 'GET');
				}
				const resp = await _origFetch(input, init);
				if (url && url.includes('clerk.accounts.dev')) {
					console.debug('[Clerk][fetch] <-', url, resp.status, resp.statusText);
				}
				return resp;
			} catch (err) {
				console.error('[Clerk][fetch] error', err);
				throw err;
			}
		};
	}
} catch (e) {
	// non-fatal
	// eslint-disable-next-line no-console
	console.warn('Clerk debug init failed', e);
}

createRoot(document.getElementById("root")!).render(
	<ThemeProvider>
		{clerkPublishableKey ? (
			<ClerkProvider publishableKey={clerkPublishableKey} appearance={{ baseTheme: dark }}>
				<App />
			</ClerkProvider>
		) : (
			<App />
		)}
	</ThemeProvider>
);
