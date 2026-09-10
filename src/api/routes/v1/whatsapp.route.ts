import { Router, Request, Response } from 'express';
import { IChatProvider } from '../../../core/interfaces/chat.interface';
import { ApiResponseHelper } from '../../../utils/api-response';

export function createWhatsAppRouter(chatProvider: IChatProvider): Router {
  const router = Router();

  router.get('/status', (_req: Request, res: Response) => {
    const status = chatProvider.getStatus();
    res.json(ApiResponseHelper.success(status));
  });

  router.get('/qr', (_req: Request, res: Response) => {
    const status = chatProvider.getStatus();

    if (status.state === 'READY') {
      res.json(
        ApiResponseHelper.success({
          ready: true,
          message: 'WhatsApp is already authenticated and connected.',
        })
      );
      return;
    }

    if (!status.qrCodeRaw && !status.qrCodeDataUrl) {
      res.status(202).json(
        ApiResponseHelper.success({
          ready: false,
          state: status.state,
          message: 'QR code is generating, please retry in a few moments.',
        })
      );
      return;
    }

    res.json(
      ApiResponseHelper.success({
        ready: false,
        state: status.state,
        qrCodeRaw: status.qrCodeRaw,
        qrCodeDataUrl: status.qrCodeDataUrl,
      })
    );
  });

  return router;
}
