'use strict';
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest, setAuthToken, setUserInfo } from '@/lib/api';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;

    // 1. Check if we received a direct token redirect from the backend
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const name = searchParams.get('name');
    const hasRefreshToken = searchParams.get('has_refresh_token') === 'true';
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setStatus('error');
      setErrorMsg(decodeURIComponent(errorParam));
      return;
    }

    if (token) {
      setAuthToken(token);
      setUserInfo({
        email: email ? decodeURIComponent(email) : '',
        name: name ? decodeURIComponent(name) : null,
        has_refresh_token: hasRefreshToken,
      });
      setStatus('success');
      setTimeout(() => {
        if (isMounted) {
          router.push('/my-meetings');
        }
      }, 1500);
      return;
    }

    // 2. Otherwise, check if we received an auth code to exchange
    const code = searchParams.get('code');
    if (!code) {
      setStatus('error');
      setErrorMsg('No authorization code or session token found in URL.');
      return;
    }

    async function exchangeCode() {
      try {
        const data = await apiRequest('/api/auth/callback', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });

        if (isMounted) {
          setAuthToken(data.token);
          setUserInfo({
            email: data.email,
            name: data.name,
            has_refresh_token: data.has_refresh_token,
          });
          setStatus('success');
          setTimeout(() => {
            router.push('/my-meetings');
          }, 1500);
        }
      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          setErrorMsg(err.message || 'Authentication failed. Please try again.');
        }
      }
    }

    exchangeCode();

    return () => {
      isMounted = false;
    };
  }, [searchParams, router]);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-zinc-950 min-h-screen text-white">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20"></div>
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-purple-500 rounded-full blur-3xl opacity-20"></div>

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <h2 className="text-xl font-bold tracking-tight mt-2">Authenticating</h2>
            <p className="text-sm text-zinc-400">Connecting your Google Calendar and securing your session...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 border-2 border-emerald-500 rounded-full flex items-center justify-center text-emerald-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-emerald-400 mt-2">Success!</h2>
            <p className="text-sm text-zinc-400">Your Google Calendar is successfully connected. Redirecting to your dashboard...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-rose-500/10 border-2 border-rose-500 rounded-full flex items-center justify-center text-rose-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-rose-400 mt-2">Authentication Failed</h2>
            <p className="text-sm text-zinc-400 mb-2">{errorMsg}</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl text-sm transition-all shadow"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center p-8 text-center bg-zinc-950 min-h-screen text-white">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
