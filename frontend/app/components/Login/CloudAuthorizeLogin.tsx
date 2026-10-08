import { Button } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import ENV from 'ENV';

/**
 * Caeli: sign in through OpenReplay Cloud's own app-authorization flow, the
 * one its MCP app uses (mcp_app/lib/tools.ts login_browser + pollForAuth):
 *  1. open app.openreplay.com/mcp/authorize?state&client_id&app_name, where
 *     the user approves while signed in to OpenReplay (its captcha is bound
 *     to its own domains, so a password login on ours cannot pass it);
 *  2. poll {API}/v1/mcp/auth-status?state&client_id until it returns a JWT.
 * No password or captcha ever touches this domain.
 */
const APP_URL = 'https://app.openreplay.com';
const CLIENT_ID_KEY = 'caeli_or_client_id';
const POLL_MS = 2000;
const TIMEOUT_MS = 3 * 60 * 1000;

function clientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export default function CloudAuthorizeLogin({
  onJwt,
}: {
  onJwt: (jwt: string) => void;
}) {
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);
  useEffect(() => () => {
    stop.current = true;
  }, []);

  const start = async () => {
    setError(null);
    const state = crypto.randomUUID();
    const cid = clientId();
    const url = `${APP_URL}/mcp/authorize?state=${state}&client_id=${cid}&app_name=${encodeURIComponent('Caeli Replay')}`;
    window.open(url, '_blank', 'noopener');
    setWaiting(true);
    stop.current = false;
    const api = (ENV.API_EDP || '').replace(/\/+$/, '');
    const statusUrl = `${api}/v1/mcp/auth-status?state=${state}&client_id=${cid}`;
    const deadline = Date.now() + TIMEOUT_MS;
    while (!stop.current && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      try {
        const res = await fetch(statusUrl);
        if (res.ok) {
          const body = await res.json().catch(() => null);
          const jwt = body?.jwt ?? body?.data?.jwt;
          if (typeof jwt === 'string' && jwt) {
            setWaiting(false);
            onJwt(jwt);
            return;
          }
        }
      } catch {
        /* keep polling */
      }
    }
    setWaiting(false);
    if (!stop.current) setError('Not approved in time. Try again.');
  };

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <Button type="primary" className="w-full" loading={waiting} onClick={start}>
        {waiting ? 'Waiting for approval on app.openreplay.com…' : 'Sign in with OpenReplay'}
      </Button>
      {error && <div className="text-red text-sm">{error}</div>}
    </div>
  );
}
