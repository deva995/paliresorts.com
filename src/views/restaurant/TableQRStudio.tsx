import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../api/client';
import { createSecureOrderingQrUrl } from '../../utils/guestQrContext';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  Search,
  Filter,
  Sparkles,
  ExternalLink,
  Layers,
  Settings2,
  FileText,
  UtensilsCrossed,
  Store,
  CheckCircle2,
  Info,
  RefreshCw,
  Eye
} from 'lucide-react';
import { RestaurantTable } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  generateTableQRDataUrl,
  downloadFile,
  loadPaliLogo,
  drawQRCenterLogo,
  renderQRMatrixToCanvas
} from '../../utils/qrCodeGenerator';
import { GenerateQRCodeModal } from './GenerateQRCodeModal';

/**
 * Dedicated preview canvas component for table cards.
 * Ensures the QR container has guaranteed non-zero dimensions and renders
 * scannable table QR code immediately without blank states.
 */
const TableQRPreviewCanvas: React.FC<{
  table: RestaurantTable;
  restaurantId: string;
  orderingUrl?: string;
  onRendered?: (dataUrl: string) => void;
}> = ({ table, restaurantId, orderingUrl, onRendered }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let active = true;
    if (!orderingUrl) {
      canvas.width = 144;
      canvas.height = 144;
      canvas.getContext('2d')?.clearRect(0, 0, 144, 144);
      return;
    }
    const url = orderingUrl;

    // 1. Explicitly initialize canvas container with guaranteed non-zero dimensions
    const width = 144;
    canvas.width = width;
    canvas.height = width;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 2. Synchronously paint QR matrix onto canvas - immediate, zero latency
    renderQRMatrixToCanvas(ctx, url, 0, 0, width, {
      darkColor: '#163024',
      lightColor: '#ffffff',
      margin: 1,
      errorCorrectionLevel: 'H'
    });

    // 3. Overlay Pali Resort branding monogram badge in center
    loadPaliLogo('/palilogoQR.png').then((logoImg) => {
      if (!active) return;
      if (canvas.width > 0 && canvas.height > 0) {
        drawQRCenterLogo(ctx, width / 2, width / 2, width, logoImg, '#163024', 'P');
        if (onRendered) {
          try {
            const dataUrl = canvas.toDataURL('image/png');
            onRendered(dataUrl);
          } catch {
            // ignore
          }
        }
      }
    }).catch(err => {
      console.warn('Center logo overlay failed for table', table.number, err);
    });

    return () => {
      active = false;
    };
  }, [table.number, restaurantId, orderingUrl]);

  return (
    <div
      className="w-36 h-36 flex items-center justify-center bg-white rounded-lg shadow-xs overflow-hidden select-none border border-stone-100"
      style={{ width: '144px', height: '144px', minWidth: '144px', minHeight: '144px' }}
    >
      <canvas
        ref={canvasRef}
        width={144}
        height={144}
        style={{ width: '144px', height: '144px', display: 'block', imageRendering: 'pixelated' }}
        className="block object-contain"
        aria-label={`Table ${table.number} QR Code`}
      />
    </div>
  );
};

export const TableQRStudio: React.FC = () => {
  const {
    tables: allTables,
    activeRestaurant,
    pushRoute
  } = useApp();

  // Multi-Tenant Isolation
  const tables = useMemo(
    () => allTables.filter(t => !t.restaurantId || t.restaurantId === activeRestaurant.id),
    [allTables, activeRestaurant.id]
  );

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [copiedTableId, setCopiedTableId] = useState<string | null>(null);

  // Selected table for detailed modal
  const [activeModalTable, setActiveModalTable] = useState<RestaurantTable | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Pre-rendered small QR thumbnails for each table (to avoid recomputing on every render)
  const [qrThumbnails, setQrThumbnails] = useState<Record<string, string>>({});
  const [secureUrls, setSecureUrls] = useState<Record<string, string>>({});
  const [qrFailures, setQrFailures] = useState<Record<string, string>>({});
  const [qrLoading, setQrLoading] = useState(true);
  const [isGeneratingThumbs, setIsGeneratingThumbs] = useState(false);

  // Batch Printing State
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);

  // Extract unique sections
  const sections = useMemo(() => Array.from(new Set(tables.map(t => t.section))).filter(Boolean), [tables]);

  // Filter tables
  const filteredTables = useMemo(() => tables.filter(t => {
    const matchesSection = selectedSection === 'all' || t.section === selectedSection;
    const matchesSearch =
      t.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.section.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSection && matchesSearch;
  }), [tables, selectedSection, searchQuery]);

  // Stable key for tables to prevent infinite thumbnail generation
  const tablesKey = useMemo(() => tables.map(t => `${t.id}:${t.number}`).join(','), [tables]);

  // Fetch existing QR credentials only; never rotate when opening the studio.
  useEffect(() => {
    let cancelled = false;
    setQrLoading(true);
    setSecureUrls({});
    setQrThumbnails({});
    setQrFailures({});

    Promise.all(tables.map(async t => {
      try {
        const credentials = await api.request<{
          qrPublicCode: string;
          qrSecretToken: string;
        }>(`/tables/${encodeURIComponent(t.id)}/ordering-qr`);

        return {
          id: t.id,
          url: createSecureOrderingQrUrl(window.location.origin, credentials),
          error: ''
        };
      } catch {
        return {
          id: t.id,
          url: '',
          error: 'Secure QR unavailable. Existing table may require authorized QR replacement.'
        };
      }
    })).then(rows => {
      if (cancelled) return;

      setSecureUrls(Object.fromEntries(
        rows.filter(r => r.url).map(r => [r.id, r.url])
      ));
      setQrFailures(Object.fromEntries(
        rows.filter(r => r.error).map(r => [r.id, r.error])
      ));
      setQrLoading(false);
    });

    return () => { cancelled = true; };
  }, [tablesKey, activeRestaurant.id]);

  // Generate thumbnails for all tables on load or table change
  useEffect(() => {
    let isSubscribed = true;
    setIsGeneratingThumbs(true);

    const generateAllThumbnails = async () => {
      const restId = activeRestaurant?.id || 'rest-1';
      const thumbs: Record<string, string> = {};
      for (const t of tables) {
        const url = secureUrls[t.id];
        if (!url) continue;
        try {
          const dataUrl = await generateTableQRDataUrl(url, {
            width: 380,
            colorDark: '#163024',
            colorLight: '#ffffff',
            includeLogo: true,
            logoUrl: '/palilogoQR.png',
            centerMonogram: 'P'
          });
          thumbs[t.id] = dataUrl;
          if (isSubscribed) {
            setQrThumbnails(prev => ({ ...prev, [t.id]: dataUrl }));
          }
        } catch (e) {
          console.warn('Fallback to direct QRCode.toDataURL for table', t.number, e);
          try {
            const fallbackUrl = await QRCode.toDataURL(url, {
              width: 380,
              margin: 2,
              color: { dark: '#163024', light: '#ffffff' },
              errorCorrectionLevel: 'H'
            });
            thumbs[t.id] = fallbackUrl;
            if (isSubscribed) {
              setQrThumbnails(prev => ({ ...prev, [t.id]: fallbackUrl }));
            }
          } catch (innerErr) {
            console.error('Failed to generate fallback QR for table', t.number, innerErr);
          }
        }
      }
      if (isSubscribed) {
        setQrThumbnails(thumbs);
        setIsGeneratingThumbs(false);
      }
    };

    generateAllThumbnails();

    return () => {
      isSubscribed = false;
    };
  }, [tablesKey, activeRestaurant.id, secureUrls]);

  const handleCopyTableLink = (table: RestaurantTable) => {
    const url = secureUrls[table.id];
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedTableId(table.id);
    setTimeout(() => setCopiedTableId(null), 2000);
  };

  const handleQuickDownloadPng = async (table: RestaurantTable) => {
    if (!secureUrls[table.id]) return;
    const cached = qrThumbnails[table.id];
    if (cached) {
      downloadFile(cached, `PaliResort_Table_${table.number}_QR.png`);
    } else {
      const url = secureUrls[table.id];
      const dataUrl = await generateTableQRDataUrl(url, {
        width: 1024,
        colorDark: '#163024',
        includeLogo: true
      });
      downloadFile(dataUrl, `PaliResort_Table_${table.number}_QR.png`);
    }
  };

  const handleOpenTableModal = (table: RestaurantTable) => {
    if (!secureUrls[table.id]) return;
    setActiveModalTable(table);
    setIsModalOpen(true);
  };

  // Batch Print All Tables in filtered view
  const handleBatchPrint = () => {
    if (qrLoading || filteredTables.some(t => !secureUrls[t.id] || !qrThumbnails[t.id])) {
      window.alert('Secure QR codes must be available before batch printing.');
      return;
    }
    setIsBatchPrinting(true);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setIsBatchPrinting(false);
      return;
    }

    const cardsHtml = filteredTables.map(t => {
      const qrSrc = qrThumbnails[t.id] || '';
      return `
        <div class="print-card">
          <div class="card-header">
            <h3>PALI RESORT & CLUB</h3>
            <p>Sanctuary Dining • Contactless Service</p>
          </div>
          <div class="table-info">
            <h2>${t.number.toUpperCase()}</h2>
          </div>
          <div class="qr-container">
            <img src="${qrSrc}" alt="QR Table ${t.number}" />
          </div>
          <div class="cta">
            <strong>SCAN WITH PHONE CAMERA TO ORDER</strong>
            <p>Instant Mobile Menu • Seamless Table Service</p>
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Batch Table Standees - ${activeRestaurant.name}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, serif;
              margin: 0;
              padding: 0;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12mm;
            }
            .print-card {
              border: 3px solid #163024;
              border-radius: 12px;
              padding: 18px 14px;
              text-align: center;
              background-color: #faf8f2;
              page-break-inside: avoid;
              box-sizing: border-box;
            }
            .card-header h3 {
              margin: 0;
              font-size: 15px;
              font-weight: 800;
              color: #163024;
              letter-spacing: 1.5px;
            }
            .card-header p {
              margin: 2px 0 10px 0;
              font-size: 10px;
              color: #687067;
              font-style: italic;
            }
            .table-info h2 {
              margin: 8px 0 6px 0;
              font-size: 28px;
              font-weight: 900;
              letter-spacing: 1px;
              color: #163024;
            }
            .qr-container {
              background: #fff;
              border-radius: 12px;
              padding: 10px;
              display: inline-block;
              margin: 8px auto;
              border: 1px solid #ddd;
              box-shadow: 0 4px 12px rgba(0,0,0,0.06);
            }
            .qr-container img {
              width: 175px;
              height: 175px;
              display: block;
            }
            .cta strong {
              display: block;
              font-size: 12px;
              font-weight: 800;
              color: #163024;
              margin-top: 8px;
            }
            .cta p {
              margin: 4px 0 0 0;
              font-size: 9px;
              color: #687067;
            }
          </style>
        </head>
        <body>
          <div class="grid">
            ${cardsHtml}
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
    setIsBatchPrinting(false);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header Banner & Executive Stats */}
      <div className="bg-[#163024] text-[#f7f4ec] p-6 sm:p-7 rounded-3xl shadow-xl border border-[#244737] relative overflow-hidden">
        {/* Subtle decorative background watermarks */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#c5a86a]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c5a86a]/20 border border-[#c5a86a]/40 text-[#dfc78f] text-[11px] font-bold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Contactless Dining Infrastructure</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#f7f4ec]">
              Table QR Code & Standee Studio
            </h2>
            <p className="text-xs sm:text-sm text-[#dfc78f]/90 leading-relaxed font-sans">
              Generate, customize, and print unique table-specific QR codes with high-definition Pali Resort tent card standees for frictionless guest self-ordering and bill settlement.
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleBatchPrint}
              disabled={isBatchPrinting || isGeneratingThumbs}
              className="px-4 py-2.5 rounded-xl bg-[#c5a86a] hover:bg-[#b59858] active:scale-95 text-[#163024] text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-[#163024]" />
              <span>Print All Table Standees</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenTableModal(tables[0])}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-[#f7f4ec] text-xs font-bold border border-white/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Settings2 className="w-4 h-4 text-[#dfc78f]" />
              <span>Custom Standee Designer</span>
            </button>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-white/10">
          <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
            <span className="text-[10px] text-[#dfc78f] uppercase font-bold tracking-wider block">Total Tables</span>
            <span className="font-serif text-xl font-bold text-white mt-0.5 block">{tables.length} Active Tables</span>
          </div>
          <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
            <span className="text-[10px] text-[#dfc78f] uppercase font-bold tracking-wider block">Dining Zones</span>
            <span className="font-serif text-xl font-bold text-white mt-0.5 block">{sections.length} Sections</span>
          </div>
          <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
            <span className="text-[10px] text-[#dfc78f] uppercase font-bold tracking-wider block">QR Scan Mode</span>
            <span className="font-serif text-xl font-bold text-emerald-400 mt-0.5 block">Direct Mobile KOT</span>
          </div>
          <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
            <span className="text-[10px] text-[#dfc78f] uppercase font-bold tracking-wider block">Bill Settlement Gate</span>
            <span className="font-serif text-xl font-bold text-[#c5a86a] mt-0.5 block">Final Settlement</span>
          </div>
        </div>
      </div>

      {/* 2. Search, Filters & Zone Tabs */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DDD8C9] space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#687067] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search table by number or zone (e.g. 5, VIP, Terrace)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs font-semibold text-[#163024] placeholder:text-[#687067] focus:outline-none focus:ring-2 focus:ring-[#163024]"
            />
          </div>

          {/* Guest Experience Link Button */}
          <button
            type="button"
            onClick={() => pushRoute('/customer/qr-ordering')}
            className="px-4 py-2 bg-[#163024] hover:bg-[#204333] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-all shrink-0"
          >
            <Eye className="w-4 h-4 text-[#C5A86A]" />
            <span>Open Guest Mobile Menu View</span>
          </button>
        </div>

        {/* Zone Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedSection('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedSection === 'all'
                ? 'bg-[#163024] text-[#C5A86A]'
                : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200'
            }`}
          >
            All Dining Zones ({tables.length})
          </button>
          {sections.map(sec => {
            const count = tables.filter(t => t.section === sec).length;
            const active = selectedSection === sec;
            return (
              <button
                key={sec}
                type="button"
                onClick={() => setSelectedSection(sec)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-[#163024] text-[#C5A86A]'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200'
                }`}
              >
                {sec} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Interactive Table Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredTables.map(table => {
          const qrDataUrl = qrThumbnails[table.id];
          const isCopied = copiedTableId === table.id;
          const tableUrl = secureUrls[table.id] || '';

          return (
            <div
              key={table.id}
              className="bg-white rounded-2xl border border-[#DDD8C9] p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              {/* Card Top: Table Info */}
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-serif font-bold text-xl text-[#163024] block">
                      Table {table.number}
                    </span>
                    <span className="text-[11px] text-[#687067] font-medium">
                      {table.section}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      table.status === 'occupied'
                        ? 'bg-[#163024] text-[#C5A86A]'
                        : table.status === 'billed'
                        ? 'bg-rose-100 text-rose-800'
                        : table.status === 'reserved'
                        ? 'bg-[#C5A86A]/20 text-[#163024]'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {table.status}
                  </span>
                </div>

                {/* QR Code Container with High-Res Preview */}
                <div className="p-3 bg-[#FAF8F2] rounded-xl border border-[#e8e1cf] flex flex-col items-center justify-center relative min-h-[160px]">
                  <TableQRPreviewCanvas
                    table={table}
                    restaurantId={activeRestaurant?.id || 'rest-1'}
                    orderingUrl={secureUrls[table.id]}
                    onRendered={(url) => {
                      setQrThumbnails(prev => prev[table.id] === url ? prev : ({ ...prev, [table.id]: url }));
                    }}
                  />

                  <span className="text-[10px] font-mono text-[#687067] mt-2 block">
                    Capacity: {table.capacity} Guests
                  </span>
                </div>

                {/* URL preview with copy */}
                <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-stone-50 border border-stone-200 text-[10px] font-mono text-stone-600">
                  <span className="truncate flex-1 select-all">{tableUrl || qrFailures[table.id] || "Loading secure QR..."}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyTableLink(table)}
                    disabled={!tableUrl}
                    className="p-1 rounded hover:bg-stone-200 text-stone-700 transition-colors shrink-0 cursor-pointer"
                    title="Copy QR Order Link"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Card Bottom: Action Buttons */}
              <div className="pt-4 mt-4 border-t border-[#DDD8C9] space-y-2">
                <button
                  type="button"
                  onClick={() => handleOpenTableModal(table)}
                  disabled={!tableUrl}
                  className="w-full py-2 px-3 rounded-xl bg-[#163024] hover:bg-[#204333] text-[#dfc78f] text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-[#c5a86a]" />
                  <span>Customize & Print Standee</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickDownloadPng(table)}
                    disabled={!tableUrl}
                    className="py-1.5 px-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-stone-600" />
                    <span>Download PNG</span>
                  </button>

                  <a
                    href={tableUrl || undefined}
                    onClick={e => { if (!tableUrl) e.preventDefault(); }}
                    target="_blank"
                    rel="noreferrer"
                    className="py-1.5 px-2 rounded-lg bg-[#F7F4EC] hover:bg-[#ece7db] border border-[#DDD8C9] text-[#163024] text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
                  >
                    <ExternalLink className="w-3 h-3 text-[#526B4A]" />
                    <span>Preview Table QR</span>
                  </a>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {filteredTables.length === 0 && (
        <div className="bg-white p-12 rounded-3xl border border-[#DDD8C9] text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
            <QrCode className="w-6 h-6" />
          </div>
          <h4 className="font-serif text-lg font-bold text-stone-800">No Dining Tables Found</h4>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            No tables matched your search filter &ldquo;{searchQuery}&rdquo;. Try clearing filters to view all dining tables.
          </p>
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setSelectedSection('all'); }}
            className="px-4 py-2 bg-[#163024] text-[#dfc78f] rounded-xl text-xs font-bold"
          >
            Clear Search Filters
          </button>
        </div>
      )}

      {/* Dedicated Table QR Customizer & Standee Designer Modal */}
      <GenerateQRCodeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        table={activeModalTable}
        allTables={tables}
        onSelectTable={t => setActiveModalTable(t)}
        restaurantId={activeRestaurant.id}
        restaurantName={activeRestaurant.name}
        secureUrls={secureUrls}
        secureOrderingUrl={activeModalTable ? secureUrls[activeModalTable.id] : undefined}
      />

    </div>
  );
};
