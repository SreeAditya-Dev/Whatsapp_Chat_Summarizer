import { Router, Request, Response } from 'express';
import { IChatProvider } from '../../core/interfaces/chat.interface';

export function createQrPageRouter(chatProvider: IChatProvider): Router {
  const router = Router();

  router.get('/qr', (_req: Request, res: Response) => {
    const status = chatProvider.getStatus();

    if (status.state === 'READY') {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>WhatsApp Summarizer - Connected</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
            .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 420px; }
            .badge { display: inline-block; background: #22c55e; color: #fff; padding: 0.35rem 0.8rem; border-radius: 9999px; font-weight: 600; font-size: 0.875rem; margin-bottom: 1rem; }
            h1 { margin: 0.5rem 0 1rem; font-size: 1.5rem; }
            p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">Connected</span>
            <h1>WhatsApp is Ready!</h1>
            <p>Authenticated as: <strong>${status.pushname || 'User'}</strong> (${status.phoneNumber ? '+' + status.phoneNumber : ''})</p>
            <p>You can now interact via your Telegram Bot or REST API.</p>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (status.qrCodeDataUrl) {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="refresh" content="15">
          <title>WhatsApp Summarizer - Link Device</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
            .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 420px; }
            .qr-box { background: white; padding: 1rem; border-radius: 0.75rem; display: inline-block; margin: 1.5rem 0; }
            img { display: block; width: 250px; height: 250px; }
            h1 { margin: 0.5rem 0; font-size: 1.5rem; }
            ol { text-align: left; color: #94a3b8; font-size: 0.9rem; line-height: 1.6; padding-left: 1.2rem; }
            .note { font-size: 0.8rem; color: #64748b; margin-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Link WhatsApp</h1>
            <div class="qr-box">
              <img src="${status.qrCodeDataUrl}" alt="WhatsApp QR Code" />
            </div>
            <ol>
              <li>Open WhatsApp on your mobile phone</li>
              <li>Tap <strong>Settings</strong> or <strong>⋮</strong> &gt; <strong>Linked Devices</strong></li>
              <li>Tap <strong>Link a Device</strong> and scan this code</li>
            </ol>
            <div class="note">This page auto-refreshes every 15 seconds.</div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="refresh" content="4">
        <title>WhatsApp Summarizer - Initializing</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
          .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; text-align: center; max-width: 420px; }
          .spinner { width: 40px; height: 40px; border: 4px solid #334155; border-top-color: #38bdf8; border-radius: 50%; animation: spin 1s linear infinite; margin: 1rem auto; }
          @keyframes spin { to { transform: rotate(360deg); } }
          h1 { font-size: 1.3rem; }
          p { color: #94a3b8; font-size: 0.9rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <h1>Initializing WhatsApp Client</h1>
          <p>Current Status: <strong>${status.state}</strong></p>
          <p>Generating QR code, please wait...</p>
        </div>
      </body>
      </html>
    `);
  });

  return router;
}
