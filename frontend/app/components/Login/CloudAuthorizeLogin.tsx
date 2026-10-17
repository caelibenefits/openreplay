import { Button } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ENV from 'ENV';

/**
 * Caeli: sign in through OpenReplay Cloud's own app-authorization flow, the
 * one its MCP app uses (mcp_app/lib/tools.ts login_browser + pollForAuth):
 *  1. open app.openreplay.com/mcp/authorize?state&client_id&app_name, where
 *     the user approves while signed in to OpenReplay (its captcha is bound
 *     to its own domains, so a password login on ours cannot pass it);
 *  2. poll {API}/v1/mcp/auth-status?state&client_id until it returns a JWT.
 * No password or captcha ever touches this domain.
 *
 * One pending request survives reloads (sessionStorage) for PENDING_MS, so
 * signing in to OpenReplay first and coming back is "reopen, approve", not a
 * new attempt; returning to this tab checks at once.
 */
const APP_URL = 'https://app.openreplay.com';
const CLIENT_ID_KEY = 'caeli_or_client_id';
const PENDING_KEY = 'caeli_or_pending_auth';
const POLL_MS = 2000;
const PENDING_MS = 15 * 60 * 1000;

function clientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

type Pending = { state: string; until: number };

function readPending(): Pending | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null') as Pending | null;
    return p && p.until > Date.now() ? p : null;
  } catch {
    return null;
  }
}

const authorizeUrl = (state: string) =>
  `${APP_URL}/mcp/authorize?state=${state}&client_id=${clientId()}&app_name=${encodeURIComponent('Caeli Replay')}`;

export default function CloudAuthorizeLogin({ onJwt }: { onJwt: (jwt: string) => void }) {
  const [pending, setPending] = useState<Pending | null>(readPending);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  const check = useCallback(async () => {
    const p = readPending();
    if (!p || done.current) return;
    const api = (ENV.API_EDP || '').replace(/\/+$/, '');
    try {
      const res = await fetch(`${api}/v1/mcp/auth-status?state=${p.state}&client_id=${clientId()}`);
      if (!res.ok) return;
      const body = await res.json().catch(() => null);
      const jwt = body?.jwt ?? body?.data?.jwt;
      if (typeof jwt === 'string' && jwt && !done.current) {
        done.current = true;
        sessionStorage.removeItem(PENDING_KEY);
        setPending(null);
        onJwt(jwt);
      }
    } catch {
      /* keep waiting */
    }
  }, [onJwt]);

  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => {
      if (!readPending()) {
        setPending(null);
        setError('The approval request expired. Start again.');
        return;
      }
      void check();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    void check();
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [pending, check]);

  const start = () => {
    setError(null);
    const p: Pending = readPending() ?? { state: crypto.randomUUID(), until: Date.now() + PENDING_MS };
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
    setPending(p);
    window.open(authorizeUrl(p.state), '_blank', 'noopener');
  };

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <Button type="primary" className="w-full" loading={!!pending} onClick={start}>
        {pending ? 'Waiting for approval…' : 'Sign in with OpenReplay'}
      </Button>
      {pending && (
        <div className="text-sm text-center color-gray-medium">
          Approve “Caeli Replay” on app.openreplay.com, then come back here.{' '}
          <a className="link" href={authorizeUrl(pending.state)} target="_blank" rel="noopener">
            Reopen approval page
          </a>{' '}
          (after signing in to OpenReplay, if it took you elsewhere).
        </div>
      )}
      {error && <div className="text-red text-sm">{error}</div>}
    </div>
  );
}
