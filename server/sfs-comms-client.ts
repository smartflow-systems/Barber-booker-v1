/**
 * sfs-comms-client — drop this file into any SFS product's server/ directory.
 *
 * Usage:
 *   import { notify } from './sfs-comms-client'
 *   await notify.email({ to: 'user@example.com', subject: 'Welcome', html: '<p>Hi</p>' })
 *   await notify.sms({ to: '+447911123456', body: 'Your booking is confirmed.' })
 *
 * Env vars required in the consuming product:
 *   SFS_COMMS_URL   — base URL of the comms-hub (e.g. https://sfs-comms-hub.replit.app)
 *   SFS_COMMS_KEY   — shared service key (must match SFS_COMMS_KEY in comms-hub)
 */

const COMMS_URL = process.env.SFS_COMMS_URL || "http://localhost:5101";
const COMMS_KEY = process.env.SFS_COMMS_KEY || "";

async function post(path: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${COMMS_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(COMMS_KEY ? { "x-sfs-comms-key": COMMS_KEY } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`sfs-comms-hub error ${res.status}: ${text}`);
  }
}

export const notify = {
  email(opts: { to: string; subject: string; html: string; from?: string }): Promise<void> {
    return post("/api/notify/email", opts);
  },

  sms(opts: { to: string; body: string }): Promise<void> {
    return post("/api/notify/sms", opts);
  },

  webhook(opts: { event: string; data?: unknown }): Promise<void> {
    return post("/api/notify/webhook", opts as Record<string, unknown>);
  },
};
