import * as QRCode from 'qrcode';
import { buildDeepLink } from '../utils/url.js';

export interface QRResult {
  /** Base64 PNG data URL */
  dataUrl: string;
  /** The URL that was encoded (deep link to bot) */
  deepLink: string;
}

/**
 * Generate a QR code image as a base64 data URL.
 *
 * @param botUsername  Bot username (without @)
 * @param sessionId    Session identifier embedded in the deep link
 * @returns            QRResult containing the data URL and deep link
 */
export async function generateQR(
  botUsername: string,
  sessionId: string,
): Promise<QRResult> {
  const deepLink = buildDeepLink(botUsername, sessionId);

  const dataUrl = await QRCode.toDataURL(deepLink, {
    width: 400,
    margin: 2,
    color: {
      dark: '#09090b',
      light: '#ffffff',
    },
  });

  return { dataUrl, deepLink };
}
