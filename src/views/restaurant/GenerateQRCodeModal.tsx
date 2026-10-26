import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Download,
  Printer,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  QrCode,
  Layers,
  Palette,
  Settings2,
  FileImage,
  FileCode,
  Eye,
  RefreshCw,
  Share2
} from 'lucide-react';
import { RestaurantTable } from '../../types';
import {
  generateTableQRDataUrl,
  generateTableQRSvg,
  generateTentCardImage,
  downloadFile,
  QR_THEME_PRESETS,
  QRThemeOptions
} from '../../utils/qrCodeGenerator';

interface GenerateQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: RestaurantTable | null;
  allTables: RestaurantTable[];
  onSelectTable?: (table: RestaurantTable) => void;
  restaurantId?: string;
  restaurantName?: string;
  secureUrls?: Record<string, string>;
  secureOrderingUrl?: string;
}

export const GenerateQRCodeModal: React.FC<GenerateQRCodeModalProps> = ({
  isOpen,
  onClose,
  table: initialTable,
  allTables,
  onSelectTable,
  restaurantId = 'rest-1',
  restaurantName = 'Pali Resort & Club',
  secureUrls,
  secureOrderingUrl
}) => {
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(initialTable);
  const [previewMode, setPreviewMode] = useState<'qr' | 'standee'>('standee');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Theme & Customization State
  const [themeName, setThemeName] = useState<'forest' | 'amber' | 'obsidian' | 'monochrome'>('forest');
  const [resolution, setResolution] = useState<512 | 1024 | 2048>(1024);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [customCta, setCustomCta] = useState('SCAN WITH PHONE CAMERA TO ORDER');

  // Generated Assets
  const [qrPngDataUrl, setQrPngDataUrl] = useState<string>('');
  const [tentCardDataUrl, setTentCardDataUrl] = useState<string>('');
  const [qrSvgString, setQrSvgString] = useState<string>('');

  // Keep selected table in sync when initialTable prop changes
  useEffect(() => {
    if (!isOpen) return;
    if (initialTable) {
      setSelectedTable(initialTable);
    } else if (allTables.length > 0 && !selectedTable) {
      setSelectedTable(allTables[0]);
    }
  }, [isOpen, initialTable?.id]);

  const activeTheme = QR_THEME_PRESETS[themeName];
  const fallbackTable: RestaurantTable = {
    id: 'table-default',
    number: 'T-01',
    section: 'Main Dining',
    capacity: 4,
    status: 'available',
    restaurantId: restaurantId || 'rest-1'
  };
  const table = selectedTable || initialTable || (allTables && allTables.length > 0 ? allTables[0] : fallbackTable);
  const orderingUrl = (secureUrls && table ? secureUrls[table.id] : undefined) || secureOrderingUrl || '';

  // Generate QR Code and Tent Card whenever parameters change
  useEffect(() => {
    if (!isOpen) return;
    if (!orderingUrl) {
      setQrPngDataUrl('');
      setTentCardDataUrl('');
      setQrSvgString('');
      return;
    }

    let isSubscribed = true;
    setIsGenerating(true);

    const generateAssets = async () => {
      try {
        const themeConfig: QRThemeOptions = {
          themeName,
          darkColor: activeTheme.darkColor,
          lightColor: activeTheme.lightColor,
          accentColor: activeTheme.accentColor,
          includeLogo,
          resolution,
          customCta,
          includeTableInfo: true
        };

        // 1. Generate QR Data URL immediately
        const qrUrl = await generateTableQRDataUrl(orderingUrl, {
          colorDark: activeTheme.darkColor,
          colorLight: activeTheme.lightColor,
          width: resolution,
          includeLogo,
          logoUrl: '/palilogoQR.png',
          centerMonogram: 'P'
        });

        if (isSubscribed) {
          setQrPngDataUrl(qrUrl);
        }

        // 2. Generate SVG String
        const svgStr = await generateTableQRSvg(orderingUrl, {
          colorDark: activeTheme.darkColor,
          colorLight: activeTheme.lightColor,
        });

        if (isSubscribed) {
          setQrSvgString(svgStr);
        }

        // 3. Generate Tent Card Standee Image with direct QR canvas integration
        const standeeUrl = await generateTentCardImage(table, restaurantName, qrUrl, themeConfig, restaurantId, orderingUrl);

        if (isSubscribed) {
          setTentCardDataUrl(standeeUrl);
          setIsGenerating(false);
        }
      } catch (err) {
        console.warn('Custom QR asset generation failed, falling back to direct QRCode:', err);
        try {
          const directQrUrl = await QRCode.toDataURL(orderingUrl, {
            width: resolution,
            margin: 2,
            color: { dark: activeTheme.darkColor, light: activeTheme.lightColor },
            errorCorrectionLevel: 'H'
          });
          const directSvg = await QRCode.toString(orderingUrl, {
            type: 'svg',
            margin: 2,
            color: { dark: activeTheme.darkColor, light: activeTheme.lightColor },
            errorCorrectionLevel: 'H'
          });
          if (isSubscribed) {
            setQrPngDataUrl(directQrUrl);
            setQrSvgString(directSvg);
            setIsGenerating(false);
          }
        } catch (innerErr) {
          console.error('All QR generation attempts failed:', innerErr);
          if (isSubscribed) setIsGenerating(false);
        }
      }
    };

    generateAssets();

    return () => {
      isSubscribed = false;
    };
  }, [
    isOpen,
    table?.id,
    table?.number,
    orderingUrl,
    themeName,
    resolution,
    includeLogo,
    customCta,
    restaurantName,
    restaurantId
  ]);

  if (!isOpen || !table) return null;

  const handleCopyLink = () => {
    if (!orderingUrl) return;
    navigator.clipboard.writeText(orderingUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadQrPng = () => {
    if (!orderingUrl || !qrPngDataUrl) return;
    downloadFile(qrPngDataUrl, `PaliResort_Table_${table.number}_QR_${resolution}px.png`);
  };

  const handleDownloadQrSvg = () => {
    if (!orderingUrl || !qrSvgString) return;
    const blob = new Blob([qrSvgString], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    downloadFile(blobUrl, `PaliResort_Table_${table.number}_QR_Vector.svg`);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  const handleDownloadStandeePng = () => {
    if (!orderingUrl || !tentCardDataUrl) return;
    downloadFile(tentCardDataUrl, `PaliResort_Table_${table.number}_Standee_TentCard.png`);
  };

  const handlePrintStandee = () => {
    if (!orderingUrl || !tentCardDataUrl) return;
    // Open a tailored print window with the standee card
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Standee - Table ${table.number} - Pali Resort & Club</title>
          <style>
            @page {
              size: A5 portrait;
              margin: 0;
            }
            *, *::before, *::after {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100%;
              height: 100%;
              max-width: 148mm;
              max-height: 210mm;
              overflow: hidden !important;
              background-color: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, serif;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .standee-page {
              width: 148mm;
              height: 210mm;
              max-width: 148mm;
              max-height: 210mm;
              margin: 0 auto;
              padding: 4mm 6mm 3mm 6mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              overflow: hidden !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-before: avoid !important;
              page-break-after: avoid !important;
            }
            .standee-img {
              max-width: 100%;
              max-height: 194mm;
              width: auto;
              height: auto;
              object-fit: contain;
              display: block;
              border-radius: 4px;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .fold-guideline {
              flex-shrink: 0;
              margin-top: 3px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              font-size: 8px;
              color: #78716c;
              text-align: center;
              border-top: 1px dashed #d6d3d1;
              padding-top: 2px;
              width: 100%;
              max-width: 120mm;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            @media print {
              @page {
                size: A5 portrait;
                margin: 0 !important;
              }
              html, body {
                width: 148mm !important;
                height: 210mm !important;
                max-width: 148mm !important;
                max-height: 210mm !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .standee-page {
                width: 148mm !important;
                height: 210mm !important;
                max-width: 148mm !important;
                max-height: 210mm !important;
                padding: 4mm 6mm 2mm 6mm !important;
                overflow: hidden !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-before: avoid !important;
                page-break-after: avoid !important;
              }
              .standee-img {
                max-height: 195mm !important;
                max-width: 100% !important;
                width: auto !important;
                height: auto !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .fold-guideline {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="standee-page">
            <img class="standee-img" src="${tentCardDataUrl}" alt="Table ${table.number} Standee" />
            <div class="fold-guideline">✂ Fold along dotted line for acrylic table tent holder or wooden stand</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#163024]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#fcfbf7] max-w-4xl w-full rounded-3xl shadow-2xl border border-[#e8e1cf] overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#163024] text-[#f7f4ec] px-6 py-4 flex items-center justify-between border-b border-[#244737] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#c5a86a]/20 border border-[#c5a86a]/40 flex items-center justify-center text-[#dfc78f] shadow-inner">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg font-bold tracking-wide text-[#f7f4ec]">
                  Generate Table QR Code
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#c5a86a]/25 text-[#dfc78f] border border-[#c5a86a]/40">
                  Table {table.number}
                </span>
              </div>
              <p className="text-xs text-[#dfc78f]/80">
                Pali Resort & Club • High-Resolution Customer Ordering Standee & Digital Assets
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-[#dfc78f] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Two Columns (Preview & Customization Controls) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
          
          {/* LEFT COLUMN: LIVE ASSET PREVIEW (lg:col-span-6) */}
          <div className="lg:col-span-6 flex flex-col items-center space-y-4">
            
            {/* Preview View Mode Switcher */}
            <div className="w-full flex items-center justify-between bg-stone-100 p-1.5 rounded-2xl border border-stone-200 text-xs">
              <button
                type="button"
                onClick={() => setPreviewMode('standee')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  previewMode === 'standee'
                    ? 'bg-[#163024] text-[#dfc78f] shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Table Standee Card</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('qr')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  previewMode === 'qr'
                    ? 'bg-[#163024] text-[#dfc78f] shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Raw QR Code Only</span>
              </button>
            </div>

            {/* Display Canvas Box */}
            <div className="w-full bg-[#f4f1ea] border-2 border-dashed border-[#DDD8C9] rounded-2xl p-4 flex items-center justify-center min-h-[380px] relative shadow-inner">
              {isGenerating && !tentCardDataUrl && !qrPngDataUrl ? (
                <div className="flex flex-col items-center gap-3 text-stone-500">
                  <RefreshCw className="w-8 h-8 animate-spin text-[#163024]" />
                  <span className="text-xs font-semibold">Generating high-definition assets...</span>
                </div>
              ) : previewMode === 'standee' ? (
                tentCardDataUrl ? (
                  <div className="max-w-[280px] sm:max-w-[320px] rounded-xl overflow-hidden shadow-2xl border border-stone-300 transform transition-transform hover:scale-[1.02]">
                    <img
                      src={tentCardDataUrl}
                      alt={`Table ${table.number} Standee Tent Card`}
                      className="w-full h-auto object-contain"
                    />
                  </div>
                ) : qrPngDataUrl ? (
                  <div className="bg-white p-6 rounded-2xl shadow-xl border border-stone-200 text-center space-y-3">
                    <img
                      src={qrPngDataUrl}
                      alt={`Table ${table.number} QR Code`}
                      className="w-56 h-56 sm:w-64 sm:h-64 object-contain mx-auto"
                    />
                    <div className="pt-2 border-t border-stone-100">
                      <span className="text-xs font-bold text-[#163024] font-serif block">
                        {table.number} • {table.section}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {resolution} x {resolution} PX • PNG
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-stone-500 py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-[#163024]" />
                    <span className="text-xs font-semibold">Preparing Table {table.number} Standee...</span>
                  </div>
                )
              ) : (
                qrPngDataUrl ? (
                  <div className="bg-white p-6 rounded-2xl shadow-xl border border-stone-200 text-center space-y-3">
                    <img
                      src={qrPngDataUrl}
                      alt={`Table ${table.number} QR Code`}
                      className="w-56 h-56 sm:w-64 sm:h-64 object-contain mx-auto"
                    />
                    <div className="pt-2 border-t border-stone-100">
                      <span className="text-xs font-bold text-[#163024] font-serif block">
                        {table.number} • {table.section}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {resolution} x {resolution} PX • PNG
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-stone-500 py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-[#163024]" />
                    <span className="text-xs font-semibold">Generating Table {table.number} QR...</span>
                  </div>
                )
              )}
            </div>

            {/* Ordering Target URL Bar with Copy Button */}
            <div className="w-full bg-white p-3 rounded-2xl border border-[#DDD8C9] space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 uppercase">
                <span>Guest Destination URL</span>
                <span className="text-emerald-700 font-mono">Active Table Link</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={orderingUrl}
                  className="flex-1 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200 text-[11px] font-mono text-stone-700 truncate select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#163024] hover:bg-[#224736] text-[#dfc78f]'
                  }`}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: CUSTOMIZATION CONTROLS & DOWNLOADS (lg:col-span-6) */}
          <div className="lg:col-span-6 space-y-5">
            
            {/* Table Selection Dropdown */}
            <div className="bg-white p-4 rounded-2xl border border-[#DDD8C9] space-y-2">
              <label className="block text-xs font-bold uppercase text-[#163024]">
                Target Dining Table
              </label>
              <select
                value={table.id}
                onChange={(e) => {
                  const found = allTables.find(t => t.id === e.target.value);
                  if (found) {
                    setSelectedTable(found);
                    if (onSelectTable) onSelectTable(found);
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-[#fcfbf7] border border-[#DDD8C9] rounded-xl text-xs font-bold text-[#163024] focus:outline-none focus:ring-2 focus:ring-[#163024]"
              >
                {allTables.map(t => (
                  <option key={t.id} value={t.id}>
                    Table {t.number} — {t.section} ({t.capacity} Guests • Status: {t.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Theme Presets */}
            <div className="bg-white p-4 rounded-2xl border border-[#DDD8C9] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-[#163024] flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#526B4A]" />
                  <span>Branding Theme</span>
                </label>
                <span className="text-[11px] font-bold text-stone-500">{activeTheme.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {Object.entries(QR_THEME_PRESETS).map(([key, preset]) => {
                  const active = themeName === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setThemeName(key as any)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                        active
                          ? 'border-[#163024] bg-[#163024]/5 shadow-xs'
                          : 'border-stone-200 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-full border border-black/10 shrink-0 shadow-inner flex items-center justify-center"
                        style={{ backgroundColor: preset.darkColor }}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: preset.accentColor }}
                        />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-stone-800 truncate">{preset.name}</div>
                        <div className="text-[10px] text-stone-500">{preset.label}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Layout & Content Settings */}
            <div className="bg-white p-4 rounded-2xl border border-[#DDD8C9] space-y-3">
              <label className="text-xs font-bold uppercase text-[#163024] flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-[#526B4A]" />
                <span>Card & QR Properties</span>
              </label>

              {/* Logo Toggle */}
              <div className="flex items-center justify-between py-1 border-b border-stone-100 text-xs">
                <div>
                  <span className="font-semibold text-stone-800">Embed Pali Resort Logo</span>
                  <p className="text-[10px] text-stone-500">Places resort emblem in center of QR</p>
                </div>
                <input
                  type="checkbox"
                  checked={includeLogo}
                  onChange={e => setIncludeLogo(e.target.checked)}
                  className="w-4 h-4 accent-[#163024] rounded cursor-pointer"
                />
              </div>

              {/* Resolution Picker */}
              <div className="flex items-center justify-between py-1 border-b border-stone-100 text-xs">
                <div>
                  <span className="font-semibold text-stone-800">QR Export Resolution</span>
                  <p className="text-[10px] text-stone-500">Dimensions for PNG downloads</p>
                </div>
                <select
                  value={resolution}
                  onChange={e => setResolution(Number(e.target.value) as any)}
                  className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold text-stone-700"
                >
                  <option value={512}>512 x 512 (Web)</option>
                  <option value={1024}>1024 x 1024 (HD Print)</option>
                  <option value={2048}>2048 x 2048 (Ultra HD)</option>
                </select>
              </div>

              {/* Call to Action Text */}
              <div className="space-y-1 pt-1">
                <label className="block text-[11px] font-bold text-stone-700">
                  Call-to-Action Headline
                </label>
                <input
                  type="text"
                  value={customCta}
                  onChange={e => setCustomCta(e.target.value)}
                  placeholder="e.g. SCAN WITH PHONE CAMERA TO ORDER"
                  className="w-full px-3 py-1.5 bg-[#fcfbf7] border border-[#DDD8C9] rounded-xl text-xs text-[#163024]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs">
                {orderingUrl
                  ? 'Secure ordering QR ready. Guests must verify their mobile number.'
                  : 'Secure QR unavailable. Contact an authorized manager for QR replacement.'}
              </p>
            </div>
            {/* DOWNLOAD & PRINT ACTION BUTTONS */}
            <div className="space-y-2.5 pt-2">
              <div className="text-xs font-bold uppercase text-[#163024] flex items-center justify-between">
                <span>Export & Print Formats</span>
                <span className="text-[10px] text-stone-400 font-normal">Ready for Tabletop Framing</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* 1. Print Standee */}
                <button
                  type="button"
                  onClick={handlePrintStandee}
                  className="py-3 px-3 rounded-xl bg-[#163024] hover:bg-[#204333] text-[#dfc78f] text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-[0.98]"
                >
                  <Printer className="w-4 h-4 text-[#c5a86a]" />
                  <span>Print Standee Card</span>
                </button>

                {/* 2. Download Standee PNG */}
                <button
                  type="button"
                  onClick={handleDownloadStandeePng}
                  className="py-3 px-3 rounded-xl bg-[#c5a86a] hover:bg-[#b59858] text-[#163024] text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-[0.98]"
                >
                  <FileImage className="w-4 h-4 text-[#163024]" />
                  <span>Download Standee PNG</span>
                </button>

                {/* 3. Download QR PNG Only */}
                <button
                  type="button"
                  onClick={handleDownloadQrPng}
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-stone-600" />
                  <span>QR Code (PNG)</span>
                </button>

                {/* 4. Download QR Vector SVG */}
                <button
                  type="button"
                  onClick={handleDownloadQrSvg}
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <FileCode className="w-3.5 h-3.5 text-stone-600" />
                  <span>QR Vector (SVG)</span>
                </button>
              </div>

              {/* Open in guest ordering view */}
              <a
                href={orderingUrl || undefined}
                onClick={e => { if (!orderingUrl) e.preventDefault(); }}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-[#f7f4ec] hover:bg-[#ece7db] border border-[#DDD8C9] text-xs font-bold text-[#163024] flex items-center justify-center gap-2 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#526B4A]" />
                <span>Open Guest Menu for Table {table.number}</span>
              </a>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
