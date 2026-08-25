import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ensureJournalEntryForDate, insertSyncedOperations, type SyncedTradeInput } from '../lib/api';
import { localIsoDate } from '../lib/calendar';
import { parseCsvFile, parsePastedTable, type SyncPlatform } from '../lib/csvSync';
import { hasTradovateConnection, syncTradovateTrades } from '../lib/tradovateApi';
import TradovateConnectModal from '../components/TradovateConnectModal';

const platformTags: { id: SyncPlatform; label: string }[] = [
  { id: 'tradovate', label: 'Tradovate' },
  { id: 'ninjatrader', label: 'NinjaTrader' },
  { id: 'tradingview', label: 'TradingView' },
  { id: 'lucid', label: 'Lucid Trading' },
];

type DaySummary = { date: string; imported: number };

type ImportSummary = {
  sourceLabel: string;
  accountLabel: string | null;
  totalParsed: number;
  totalImported: number;
  totalDuplicate: number;
  totalSkippedNoDate: number;
  totalSkippedByParser: number;
  days: DaySummary[];
};

function groupTradesByDate(trades: SyncedTradeInput[]): { byDate: Map<string, SyncedTradeInput[]>; skippedNoDate: number } {
  const byDate = new Map<string, SyncedTradeInput[]>();
  let skippedNoDate = 0;

  for (const trade of trades) {
    const reference = trade.entryTime ?? trade.exitTime;
    if (!reference) {
      skippedNoDate += 1;
      continue;
    }
    const date = localIsoDate(new Date(reference));
    const list = byDate.get(date) ?? [];
    list.push(trade);
    byDate.set(date, list);
  }

  return { byDate, skippedNoDate };
}

function Conexiones() {
  const { user } = useAuth();

  const [accountLabel, setAccountLabel] = useState('');

  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pastedTable, setPastedTable] = useState('');
  const [pasting, setPasting] = useState(false);

  const [tradovateModalOpen, setTradovateModalOpen] = useState(false);
  const [tradovateConnected, setTradovateConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    hasTradovateConnection()
      .then(setTradovateConnected)
      .catch(() => setTradovateConnected(false));
  }, []);

  const importTrades = async (
    trades: SyncedTradeInput[],
    sourceLabel: string,
    skippedByParser: number,
  ): Promise<void> => {
    if (!user) return;

    const trimmedAccountLabel = accountLabel.trim() || null;
    const { byDate, skippedNoDate } = groupTradesByDate(trades);
    const days: DaySummary[] = [];
    let totalImported = 0;
    let totalDuplicate = 0;

    for (const [date, dayTrades] of byDate) {
      const journalEntryId = await ensureJournalEntryForDate(user.id, date);
      const imported = await insertSyncedOperations(
        user.id,
        journalEntryId,
        date,
        dayTrades,
        sourceLabel,
        trimmedAccountLabel,
      );
      totalImported += imported;
      totalDuplicate += dayTrades.length - imported;
      days.push({ date, imported });
    }

    days.sort((a, b) => (a.date < b.date ? -1 : 1));

    setSummary({
      sourceLabel,
      accountLabel: trimmedAccountLabel,
      totalParsed: trades.length,
      totalImported,
      totalDuplicate,
      totalSkippedNoDate: skippedNoDate,
      totalSkippedByParser: skippedByParser,
      days,
    });
  };

  const handleFile = async (file: File) => {
    if (!user) return;
    setProcessing(true);
    setError(null);
    setSummary(null);

    try {
      const result = await parseCsvFile(file);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await importTrades(result.trades, result.platformLabel, result.skipped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar el archivo.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
    event.target.value = '';
  };

  const handlePasteImport = async () => {
    if (!user) return;
    setPasting(true);
    setError(null);
    setSummary(null);

    try {
      const result = parsePastedTable(pastedTable);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await importTrades(result.trades, result.platformLabel, result.skipped);
      setPastedTable('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar la tabla pegada.');
    } finally {
      setPasting(false);
    }
  };

  const handleSyncTradovate = async () => {
    setSyncing(true);
    setError(null);
    setSummary(null);
    try {
      const result = await syncTradovateTrades();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await importTrades(result.trades, 'Tradovate API', 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo sincronizar con Tradovate.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <header className="topbar panel">
        <div>
          <p className="eyebrow">Fase 2 · Trade Sync</p>
          <h2>Conexiones institucionales</h2>
          <p className="page-description">
            Sube el reporte CSV de tu bróker o plataforma, pega una tabla, o conecta tu cuenta para que tus
            operaciones se registren automáticamente en el journal del día correspondiente.
          </p>
        </div>
        <button type="button" className="ghost-btn sync-master-btn" onClick={handleSyncTradovate} disabled={syncing}>
          {syncing ? 'Sincronizando…' : '⟳ Sincronizar datos'}
        </button>
      </header>

      <section className="panel plan-section">
        <label className="auth-field account-label-field">
          <span className="eyebrow">Cuenta (opcional)</span>
          <input
            type="text"
            value={accountLabel}
            onChange={(event) => setAccountLabel(event.target.value)}
            placeholder="Ej. Lucid 50K #1"
          />
          <span className="hint-text">
            Etiqueta cada importación con la cuenta de origen — así conservas tu historial separado por cuenta
            aunque una se queme y abras otra.
          </span>
        </label>

        <div
          className={`csv-dropzone ${dragActive ? 'drag-active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <span className="csv-dropzone-icon">⇩</span>
          <p className="csv-dropzone-title">
            {processing ? 'Procesando…' : 'Arrastra tu reporte CSV aquí'}
          </p>
          <label className="ghost-btn btn-sm csv-dropzone-label">
            o selecciona un archivo
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileInput} disabled={processing} hidden />
          </label>
        </div>

        <div className="platform-tag-row">
          {platformTags.map((platform) =>
            platform.id === 'tradovate' ? (
              <button
                key={platform.id}
                type="button"
                className={`platform-tag interactive ${tradovateConnected ? 'connected' : ''}`}
                onClick={() => setTradovateModalOpen(true)}
              >
                {tradovateConnected && <span className="platform-tag-dot" />}
                {platform.label}
                {tradovateConnected ? ' · Conectado' : ' · Conectar'}
              </button>
            ) : (
              <span key={platform.id} className="platform-tag">
                {platform.label}
              </span>
            ),
          )}
        </div>

        <div className="paste-table-section">
          <div className="section-header">
            <span className="eyebrow">¿Sin botón de exportar? Pega la tabla</span>
          </div>
          <p className="hint-text">
            Para plataformas como Lucid Trading que no ofrecen descarga de CSV: selecciona y copia (Ctrl+C) las
            filas de la tabla de operaciones directo del navegador, y pégalas aquí.
          </p>
          <textarea
            className="paste-table-textarea"
            value={pastedTable}
            onChange={(event) => setPastedTable(event.target.value)}
            placeholder="Pega aquí el contenido copiado de la tabla…"
            rows={4}
          />
          <button
            type="button"
            className="ghost-btn btn-sm"
            onClick={handlePasteImport}
            disabled={pasting || !pastedTable.trim()}
          >
            {pasting ? 'Procesando…' : 'Importar tabla pegada'}
          </button>
        </div>

        {error && <p className="hint-text">{error}</p>}

        {summary && (
          <div className="sync-summary">
            <div className="repeatable-card-header">
              <span>
                Fuente: <strong>{summary.sourceLabel}</strong>
                {summary.accountLabel && <> · Cuenta: <strong>{summary.accountLabel}</strong></>}
              </span>
              <span className="sync-badge">{summary.totalImported} operaciones importadas</span>
            </div>
            <p className="hint-text">
              {summary.totalParsed} operaciones leídas
              {summary.totalDuplicate > 0 ? ` · ${summary.totalDuplicate} ya estaban importadas` : ''}
              {summary.totalSkippedNoDate > 0 ? ` · ${summary.totalSkippedNoDate} sin fecha reconocible` : ''}
              {summary.totalSkippedByParser > 0 ? ` · ${summary.totalSkippedByParser} filas ilegibles` : ''}
            </p>

            {summary.days.length > 0 && (
              <div className="sync-summary-list">
                {summary.days.map((day) => (
                  <Link key={day.date} to={`/journal/nuevo?date=${day.date}`} className="shared-entry-row">
                    <span>
                      {day.date} — {day.imported} {day.imported === 1 ? 'operación' : 'operaciones'}
                    </span>
                    <span>→</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <TradovateConnectModal
        open={tradovateModalOpen}
        onClose={() => setTradovateModalOpen(false)}
        onConnected={() => setTradovateConnected(true)}
      />
    </>
  );
}

export default Conexiones;
