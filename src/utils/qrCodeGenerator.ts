import QRCode from 'qrcode';
import { RestaurantTable } from '../types';
import { PALI_LOGO_QR_DATA_URI, PALI_LOGO_DATA_URI } from './paliLogoData';

export interface QRThemeOptions {
  themeName: 'forest' | 'amber' | 'obsidian' | 'monochrome';
  darkColor: string;
  lightColor: string;
  accentColor: string;
  includeLogo: boolean;
  resolution: 512 | 1024 | 2048;
  showWifiInfo?: boolean;
  wifiSsid?: string;
  wifiPass?: string;
  customCta: string;
  includeTableInfo: boolean;
}

export const QR_THEME_PRESETS: Record<string, {
  name: string;
  darkColor: string;
  lightColor: string;
  accentColor: string;
  label: string;
  badgeClass: string;
}> = {
  forest: {
    name: 'Pali Forest & Gold',
    darkColor: '#163024',
    lightColor: '#ffffff',
    accentColor: '#C5A86A',
    label: 'Resort Signature',
    badgeClass: 'bg-[#163024] text-[#C5A86A]'
  },
  amber: {
    name: 'Royal Heritage Amber',
    darkColor: '#78350f',
    lightColor: '#fffbeb',
    accentColor: '#d97706',
    label: 'Warm Heritage',
    badgeClass: 'bg-amber-900 text-amber-200'
  },
  obsidian: {
    name: 'Midnight Slate',
    darkColor: '#0f172a',
    lightColor: '#ffffff',
    accentColor: '#3b82f6',
    label: 'Modern Sleek',
    badgeClass: 'bg-slate-900 text-blue-400'
  },
  monochrome: {
    name: 'Classic Monochrome',
    darkColor: '#000000',
    lightColor: '#ffffff',
    accentColor: '#52525b',
    label: 'High Contrast',
    badgeClass: 'bg-black text-white'
  }
};

/**
 * Universal canvas rounded rectangle path generator compatible with all browsers
 * (iOS Safari, Android WebViews, Samsung Internet, and modern browsers)
 */
export const drawRoundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | number[] = 0
): void => {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    try {
      ctx.roundRect(x, y, width, height, radius);
      return;
    } catch {
      // Fallback if parameter format causes an error in certain versions
    }
  }

  let r = typeof radius === 'number' ? radius : (radius[0] || 0);
  if (width < 2 * r) r = width / 2;
  if (height < 2 * r) r = height / 2;

  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

import { createSecureOrderingQrUrl } from './guestQrContext';

/**
 * Constructs the canonical dining ordering URL for a specific table using secure credentials
 */
export const getTableOrderingUrl = (
  credentialsOrTable?: { qrPublicCode: string; qrSecretToken: string } | string,
  _restaurantId?: string
): string => {
  const origin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://paliclub.netlify.app';

  if (
    credentialsOrTable &&
    typeof credentialsOrTable === 'object' &&
    'qrPublicCode' in credentialsOrTable &&
    'qrSecretToken' in credentialsOrTable
  ) {
    return createSecureOrderingQrUrl(origin, credentialsOrTable);
  }

  // Without secure credentials, point to safe customer route requiring physical QR scan
  return `${origin}/#/customer/qr-ordering`;
};

/**
 * Cached company logo image element for fast, synchronous rendering onto canvas
 */
let cachedPaliLogo: HTMLImageElement | null = null;

export const loadPaliLogo = (logoUrl: string = '/palilogoQR.png'): Promise<HTMLImageElement | null> => {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (cachedPaliLogo && cachedPaliLogo.complete && cachedPaliLogo.naturalWidth > 0) {
    return Promise.resolve(cachedPaliLogo);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      cachedPaliLogo = img;
      resolve(img);
    };
    img.onerror = () => {
      resolve(null);
    };
    // Always use the embedded base64 data URI first for 100% reliable, instant rendering without CORS or network latency
    img.src = PALI_LOGO_QR_DATA_URI || logoUrl;
    if (img.complete && img.naturalWidth > 0) {
      cachedPaliLogo = img;
      resolve(img);
    }
  });
};

/**
 * Cached top header logo image element for fast, synchronous rendering onto canvas
 */
let cachedHeaderLogo: HTMLImageElement | null = null;

export const loadHeaderLogo = (logoUrl: string = '/palilogo.png'): Promise<HTMLImageElement | null> => {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (cachedHeaderLogo && cachedHeaderLogo.complete && cachedHeaderLogo.naturalWidth > 0) {
    return Promise.resolve(cachedHeaderLogo);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      cachedHeaderLogo = img;
      resolve(img);
    };
    img.onerror = () => {
      if (img.src !== logoUrl) {
        img.src = logoUrl;
      } else {
        resolve(null);
      }
    };
    img.src = PALI_LOGO_DATA_URI || logoUrl;
    if (img.complete && img.naturalWidth > 0) {
      cachedHeaderLogo = img;
      resolve(img);
    }
  });
};

/**
 * Renders the centered Pali Resort logo inside a QR code with safety padding & champagne gold border
 */
export const drawQRCenterLogo = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  qrBoxSize: number,
  logoImg: HTMLImageElement | null,
  darkColor: string,
  monogramFallback: string = 'P'
): void => {
  const badgeSize = Math.round(qrBoxSize * 0.22);
  const badgeX = centerX - badgeSize / 2;
  const badgeY = centerY - badgeSize / 2;
  const cornerR = Math.max(4, Math.round(badgeSize * 0.18));

  ctx.save();
  ctx.beginPath();
  // Clean white safety badge container
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
  ctx.shadowBlur = Math.round(badgeSize * 0.12);
  ctx.shadowOffsetY = Math.round(badgeSize * 0.04);
  drawRoundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, cornerR);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Subtle luxury champagne gold border
  ctx.strokeStyle = '#c5a86a';
  ctx.lineWidth = Math.max(1.5, Math.round(badgeSize * 0.035));
  ctx.stroke();
  ctx.beginPath();

  if (logoImg && logoImg.naturalWidth > 0 && logoImg.naturalHeight > 0) {
    const pad = Math.round(badgeSize * 0.10);
    const maxW = badgeSize - pad * 2;
    const maxH = badgeSize - pad * 2;
    const aspect = logoImg.naturalWidth / logoImg.naturalHeight;

    let drawW = maxW;
    let drawH = maxH;
    if (aspect > 1) {
      drawH = drawW / aspect;
    } else {
      drawW = drawH * aspect;
    }

    const drawX = centerX - drawW / 2;
    const drawY = centerY - drawH / 2;
    ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
  } else {
    ctx.fillStyle = darkColor;
    ctx.font = `bold ${Math.round(badgeSize * 0.55)}px "Times New Roman", Times, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(monogramFallback, centerX, centerY);
  }
  ctx.restore();
};

/**
 * Synchronously renders QR code modules directly onto any 2D canvas context.
 * Guaranteed 100% reliable - no asynchronous DOM image decoding or off-screen canvas detachment.
 */
export const renderQRMatrixToCanvas = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  options?: {
    darkColor?: string;
    lightColor?: string;
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  }
): void => {
  const darkColor = options?.darkColor || '#163024';
  const lightColor = options?.lightColor || '#ffffff';
  const margin = options?.margin !== undefined ? options.margin : 2;
  const qrData = QRCode.create(text, {
    errorCorrectionLevel: options?.errorCorrectionLevel || 'H'
  });

  const numModules = qrData.modules.size + margin * 2;
  const cellSize = size / numModules;

  // Background quiet zone
  ctx.fillStyle = lightColor;
  ctx.fillRect(x, y, size, size);

  // Paint dark modules with subpixel fill to prevent antialiasing gaps
  ctx.fillStyle = darkColor;
  for (let r = 0; r < qrData.modules.size; r++) {
    for (let c = 0; c < qrData.modules.size; c++) {
      if (qrData.modules.get(r, c)) {
        ctx.fillRect(
          Math.floor(x + (c + margin) * cellSize),
          Math.floor(y + (r + margin) * cellSize),
          Math.ceil(cellSize),
          Math.ceil(cellSize)
        );
      }
    }
  }
};

/**
 * Generates high-resolution PNG data URL for a table QR code with centered Pali Resort company logo
 */
export const generateTableQRDataUrl = async (
  url: string,
  options?: {
    colorDark?: string;
    colorLight?: string;
    width?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    includeLogo?: boolean;
    logoUrl?: string;
    centerMonogram?: string;
  }
): Promise<string> => {
  const validUrl = (url && typeof url === 'string' && url.trim().length > 0)
    ? url.trim()
    : getTableOrderingUrl();
  const width = Math.max(Number(options?.width) || 1024, 128);
  const colorDark = options?.colorDark || '#163024';
  const colorLight = options?.colorLight || '#ffffff';
  const errorCorrectionLevel = options?.errorCorrectionLevel || 'H';

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return await QRCode.toDataURL(validUrl, {
      width,
      margin: 2,
      color: { dark: colorDark, light: colorLight },
      errorCorrectionLevel
    });
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = width;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return await QRCode.toDataURL(validUrl, {
        width,
        margin: 2,
        color: { dark: colorDark, light: colorLight },
        errorCorrectionLevel
      });
    }

    // Direct synchronous matrix render onto canvas - perfectly crisp, 100% reliable
    renderQRMatrixToCanvas(ctx, validUrl, 0, 0, width, {
      darkColor: colorDark,
      lightColor: colorLight,
      margin: 2,
      errorCorrectionLevel
    });

    if (options?.includeLogo) {
      const logoImg = await loadPaliLogo(options?.logoUrl || '/palilogoQR.png');
      drawQRCenterLogo(
        ctx,
        width / 2,
        width / 2,
        width,
        logoImg,
        colorDark,
        options?.centerMonogram || 'P'
      );
    }

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Canvas direct matrix render failed, falling back to QRCode.toDataURL:', err);
    return await QRCode.toDataURL(validUrl, {
      width,
      margin: 2,
      color: { dark: colorDark, light: colorLight },
      errorCorrectionLevel
    });
  }
};

/**
 * Generates vector SVG string for large scale printing
 */
export const generateTableQRSvg = async (
  url: string,
  options?: {
    colorDark?: string;
    colorLight?: string;
  }
): Promise<string> => {
  return await QRCode.toString(url, {
    type: 'svg',
    margin: 2,
    color: {
      dark: options?.colorDark || '#163024',
      light: options?.colorLight || '#ffffff',
    },
    errorCorrectionLevel: 'H',
  });
};

/**
 * Triggers a direct browser file download for a PNG/SVG data URL or Blob
 */
export const downloadFile = (dataUrl: string, filename: string): void => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Generates a full high-resolution Table Standee / Tent Card Image (1200 x 1800 px)
 * Ready to print or frame on table stands
 */
export const generateTentCardImage = async (
  table: RestaurantTable,
  restaurantName: string,
  qrDataUrl: string,
  theme: QRThemeOptions,
  restaurantId: string = 'rest-1',
  secureOrderingUrl?: string
): Promise<string> => {
  try {
    const canvas = document.createElement('canvas');
    const W = 1200;
    const H = 1800;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return qrDataUrl;
    }

    // 1. Background Fill with subtle textured parchment
    ctx.fillStyle = '#FAF8F2';
    ctx.fillRect(0, 0, W, H);

    // 2. Luxury Outer & Inner Borders
    ctx.strokeStyle = theme.darkColor;
    ctx.lineWidth = 14;
    ctx.strokeRect(36, 36, W - 72, H - 72);

    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(52, 52, W - 104, H - 104);

    // Corner decorative accents
    const drawCorner = (x: number, y: number, angle: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.strokeStyle = theme.accentColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 30);
      ctx.lineTo(30, 30);
      ctx.lineTo(30, 0);
      ctx.stroke();
      ctx.restore();
    };
    drawCorner(56, 56, 0);
    drawCorner(W - 56, 56, Math.PI / 2);
    drawCorner(W - 56, H - 56, Math.PI);
    drawCorner(56, H - 56, -Math.PI / 2);

    // 3. Top Header Location - palilogo.png (properly cropped & proportioned)
    const headerLogo = await loadHeaderLogo('/palilogo.png');
    if (headerLogo && headerLogo.naturalWidth > 0 && headerLogo.naturalHeight > 0) {
      // Content bounding box in palilogo.png (natural: 1524 x 656)
      // Actual logo graphic content: x: 323..1201 (w: 878), y: 6..648 (h: 642)
      const scaleX = headerLogo.naturalWidth / 1524;
      const scaleY = headerLogo.naturalHeight / 656;
      const sx = Math.round(323 * scaleX);
      const sy = Math.round(6 * scaleY);
      const sw = Math.round(878 * scaleX);
      const sh = Math.round(642 * scaleY);

      const logoH = 168;
      const contentAspect = sw / sh;
      const logoW = Math.round(logoH * contentAspect);
      const logoX = Math.round((W - logoW) / 2);
      const logoY = 62;

      ctx.drawImage(headerLogo, sx, sy, sw, sh, logoX, logoY, logoW, logoH);
    } else {
      ctx.fillStyle = theme.darkColor;
      drawRoundRect(ctx, W / 2 - 320, 90, 640, 90, 12);
      ctx.fill();

      ctx.fillStyle = theme.accentColor;
      ctx.font = 'bold 36px "Times New Roman", Times, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PALI RESORT & CLUB', W / 2, 135);
    }

    // 4. Table Number Presentation & Hierarchy (prominent, bold, highly readable)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // TABLE T-01: Bold, massive, highly readable table identifier
    ctx.fillStyle = theme.darkColor;
    ctx.font = '900 88px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Georgia, serif';
    if ('letterSpacing' in ctx) {
      (ctx as any).letterSpacing = '3px';
    }
    ctx.fillText(table.number.toUpperCase(), W / 2, 280);

    // Reset typography letter spacing
    if ('letterSpacing' in ctx) {
      (ctx as any).letterSpacing = '0px';
    }
    ctx.restore();

    // 5. QR Code Card Container (Enlarged and centered using available space)
    const qrBoxSize = 820;
    const qrBoxX = (W - qrBoxSize) / 2;
    const qrBoxY = 360;

    ctx.fillStyle = '#ffffff';
    drawRoundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 32);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.14)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 12;
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.strokeStyle = '#e7e5e4';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();

    // Render Scannable Table-Specific QR Code visibly inside the container
    const qrPadding = 40;
    const qrInnerSize = qrBoxSize - qrPadding * 2;
    const qrStartX = qrBoxX + qrPadding;
    const qrStartY = qrBoxY + qrPadding;

    if (!secureOrderingUrl) {
      throw new Error('Secure ordering QR URL is required for standee generation');
    }
    const targetUrl = secureOrderingUrl;

    try {
      // 1. Synchronously render crisp QR matrix modules directly onto the main tent card canvas
      renderQRMatrixToCanvas(ctx, targetUrl, qrStartX, qrStartY, qrInnerSize, {
        darkColor: theme.darkColor,
        lightColor: '#ffffff',
        margin: 1,
        errorCorrectionLevel: 'H'
      });

      // 2. Overlay Pali Resort branding badge in center if enabled
      if (theme.includeLogo) {
        const logoImg = await loadPaliLogo('/palilogoQR.png');
        drawQRCenterLogo(
          ctx,
          qrStartX + qrInnerSize / 2,
          qrStartY + qrInnerSize / 2,
          qrInnerSize,
          logoImg,
          theme.darkColor,
          'P'
        );
      }
    } catch (err) {
      console.warn('Direct matrix render on tent card failed, falling back to data URL draw:', err);
      try {
        const fallbackQrUrl = qrDataUrl || (await QRCode.toDataURL(targetUrl, {
          width: qrInnerSize,
          margin: 1,
          color: { dark: theme.darkColor, light: '#ffffff' },
          errorCorrectionLevel: 'H'
        }));
        const qrImg = new Image();
        await new Promise<void>((resolve) => {
          qrImg.onload = () => resolve();
          qrImg.onerror = () => resolve();
          qrImg.src = fallbackQrUrl;
          if (qrImg.complete && qrImg.naturalWidth > 0) resolve();
        });
        if (qrImg.naturalWidth > 0) {
          ctx.drawImage(qrImg, qrStartX, qrStartY, qrInnerSize, qrInnerSize);
        }
      } catch (fallbackErr) {
        console.error('All QR drawing in standee failed:', fallbackErr);
      }
    }

    // 6. Call to Action below QR (Clean, high contrast, uncluttered)
    ctx.fillStyle = theme.darkColor;
    ctx.font = 'bold 42px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.fillText(theme.customCta || 'SCAN WITH PHONE CAMERA TO ORDER', W / 2, 1250);

    ctx.fillStyle = '#686256';
    ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Direct Mobile Menu  •  Instant Order  •  Table Service', W / 2, 1315);

    // 7. Minimal Resort Branding Footer (Clean, balanced, without Wi-Fi or filler clutter)
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 120, 1640);
    ctx.lineTo(W / 2 + 120, 1640);
    ctx.stroke();

    ctx.fillStyle = '#8c8577';
    ctx.font = '600 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PALI RESORT & CLUB  •  CONTACTLESS DINING', W / 2, 1685);

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Tent card standee canvas generation error:', err);
    return qrDataUrl;
  }
};
