import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SUBS_FILE = path.join(DATA_DIR, 'digest_subscriptions.json');

interface Subscriber {
  email: string;
  city: string;
  subscribedAt: string;
}

async function readSubscribers(): Promise<Subscriber[]> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(SUBS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeSubscribers(subs: Subscriber[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf-8');
}

export async function addSubscriber(email: string, city: string): Promise<void> {
  const subs = await readSubscribers();
  const existing = subs.findIndex(s => s.email === email);
  if (existing >= 0) {
    subs[existing].city = city;
  } else {
    subs.push({ email, city, subscribedAt: new Date().toISOString() });
  }
  await writeSubscribers(subs);
}

export async function removeSubscriber(email: string): Promise<void> {
  const subs = await readSubscribers();
  await writeSubscribers(subs.filter(s => s.email !== email));
}

export async function getSubscribers(): Promise<Subscriber[]> {
  return readSubscribers();
}

export async function sendDailyDigest(subscriber: Subscriber, weatherSummary: string): Promise<void> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM ?? user;

  if (!host || !user || !pass) {
    console.log(`[Digest] SMTP not configured — would send to ${subscriber.email}:\n${weatherSummary}`);
    return;
  }

  // Dynamic import so missing nodemailer doesn't crash the whole server
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `WeatherWise <${from}>`,
      to: subscriber.email,
      subject: `Your morning weather digest — ${subscriber.city}`,
      text: weatherSummary,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#3b82f6">🌤 WeatherWise Daily Digest</h2>
        <pre style="font-family:inherit;white-space:pre-wrap;color:#1e293b">${weatherSummary}</pre>
        <hr/>
        <p style="font-size:12px;color:#94a3b8">
          <a href="${process.env.APP_URL ?? 'http://localhost:5173'}">Open WeatherWise</a> ·
          Reply with "unsubscribe" to stop receiving these emails.
        </p>
      </div>`,
    });
    console.log(`[Digest] Sent to ${subscriber.email}`);
  } catch (err: any) {
    console.error(`[Digest] Failed to send to ${subscriber.email}:`, err.message);
  }
}
