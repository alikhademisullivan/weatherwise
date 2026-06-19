import { Router, Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { dbEnabled, query } from '../db/pool';

const router = Router();

const TOKEN_FILE = path.join(process.cwd(), 'data', 'netatmo_tokens.json');

function getRedirectUri(): string {
  return process.env.NETATMO_REDIRECT_URI ?? 'http://localhost:3001/api/netatmo/callback';
}

// GET /api/netatmo/status — is Netatmo configured and have we authenticated?
router.get('/status', (_req: Request, res: Response) => {
  const configured = !!(process.env.NETATMO_CLIENT_ID && process.env.NETATMO_CLIENT_SECRET);
  const hasToken = fs.existsSync(TOKEN_FILE);
  res.json({ configured, authenticated: configured && hasToken });
});

// GET /api/netatmo/connect — start OAuth flow; opens Netatmo login in the browser
router.get('/connect', (_req: Request, res: Response) => {
  if (!process.env.NETATMO_CLIENT_ID || !process.env.NETATMO_CLIENT_SECRET) {
    return res.status(400).send('Set NETATMO_CLIENT_ID and NETATMO_CLIENT_SECRET in .env first.');
  }

  const params = new URLSearchParams({
    client_id: process.env.NETATMO_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    scope: 'read_station',
    state: 'weatherwise',
  });

  return res.redirect(`https://api.netatmo.com/oauth2/authorize?${params}`);
});

// GET /api/netatmo/callback — Netatmo sends the user back here after login
router.get('/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.status(400).send(
      `<h2>Netatmo authorization failed</h2><p>${error ?? 'No code returned'}</p>`,
    );
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.NETATMO_CLIENT_ID ?? '',
    client_secret: process.env.NETATMO_CLIENT_SECRET ?? '',
    code: code as string,
    redirect_uri: getRedirectUri(),
    scope: 'read_station',
  });

  try {
    const { data } = await axios.post('https://api.netatmo.com/oauth2/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const expiresAt = Date.now() + data.expires_in * 1000;

    if (dbEnabled()) {
      await query(
        `INSERT INTO netatmo_tokens (id, access_token, refresh_token, expires_at, updated_at)
         VALUES (1, $1, $2, $3, NOW())
         ON CONFLICT (id) DO UPDATE
           SET access_token  = EXCLUDED.access_token,
               refresh_token = EXCLUDED.refresh_token,
               expires_at    = EXCLUDED.expires_at,
               updated_at    = NOW()`,
        [data.access_token, data.refresh_token, expiresAt],
      );
    } else {
      fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
      }, null, 2));
    }

    return res.send(`
      <html><body style="font-family:sans-serif;padding:40px;max-width:500px">
        <h2>✅ Netatmo connected!</h2>
        <p>Tokens saved. Close this tab and return to WeatherWise — local sensor data will appear within seconds.</p>
      </body></html>
    `);
  } catch (err: any) {
    const detail = err.response?.data?.error_description ?? err.response?.data?.error ?? err.message;
    return res.status(500).send(
      `<h2>Token exchange failed</h2><p>${detail}</p>`,
    );
  }
});

export default router;
