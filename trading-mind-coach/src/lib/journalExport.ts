import {
  postMarketQuizQuestions,
  type ExecutionWindow,
  type JournalEntryFull,
  type JournalTemplateSections,
  type OperationItem,
} from './api';
import type { DisciplineScoreResult } from './disciplineScore';

const sessionLabels: Record<ExecutionWindow, string> = {
  london_open: 'London Open',
  ny_am: 'NY AM Session',
  ny_pm: 'NY PM Session',
  outside_window: 'Fuera de Ventana',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textBlock(label: string, value: string | null | undefined): string {
  const safe = value && value.trim() ? escapeHtml(value).replace(/\n/g, '<br/>') : '<span class="muted">—</span>';
  return `<div class="field"><span class="field-label">${escapeHtml(label)}</span><div class="field-value">${safe}</div></div>`;
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function downloadJournalEntry(
  entry: JournalEntryFull,
  operations: OperationItem[],
  template: JournalTemplateSections,
  discipline: DisciplineScoreResult,
): Promise<void> {
  const screenshotImages = await Promise.all(
    entry.screenshots.map(async (shot) => ({ shot, dataUrl: await toDataUrl(shot.url) })),
  );

  const dateLabel = new Date(`${entry.entry_date}T00:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const topDownHtf = template.htf
    .map((field) => textBlock(field, entry.top_down.htf[field]))
    .join('');
  const topDownLtf = template.ltf
    .map((field) => textBlock(field, entry.top_down.ltf[field]))
    .join('');

  const operationsHtml =
    operations.length === 0
      ? '<p class="muted">No se registraron operaciones este día.</p>'
      : operations
          .map(
            (op, index) => `
        <div class="op-card">
          <h4>Operación ${index + 1} — ${escapeHtml(op.symbol || 'Sin símbolo')}</h4>
          <table class="op-table">
            <tr><td>Dirección</td><td>${escapeHtml(op.direction ? op.direction.toUpperCase() : '—')}</td></tr>
            <tr><td>Modelo / setup</td><td>${escapeHtml(op.model || '—')}</td></tr>
            <tr><td>Calidad</td><td>${escapeHtml(op.quality || '—')}</td></tr>
            <tr><td>Sesión</td><td>${op.session ? escapeHtml(sessionLabels[op.session]) : '—'}</td></tr>
            <tr><td>Entry / SL / TP</td><td>${escapeHtml(op.entryPrice || '—')} / ${escapeHtml(op.stopLoss || '—')} / ${escapeHtml(op.takeProfit || '—')}</td></tr>
            <tr><td>Riesgo/beneficio</td><td>${escapeHtml(op.riskReward || '—')}</td></tr>
            <tr><td>P&amp;L</td><td>${escapeHtml(op.pnl || '—')}</td></tr>
            <tr><td>Resultado</td><td>${escapeHtml(op.outcome || '—')}</td></tr>
            <tr><td>Incumplió el plan</td><td>${op.brokePlan ? 'Sí' : 'No'}</td></tr>
          </table>
          ${op.lesson ? `<p class="op-lesson"><strong>Lección:</strong> ${escapeHtml(op.lesson).replace(/\n/g, '<br/>')}</p>` : ''}
        </div>`,
          )
          .join('');

  const quizHtml = postMarketQuizQuestions
    .map((question) => {
      const answer = entry.custom_fields.quiz[question.key];
      if (!answer || (answer.answer === null && !answer.note)) return '';
      return `<div class="field">
        <span class="field-label">${escapeHtml(question.label)}</span>
        <div class="field-value">${escapeHtml(answer.answer ?? '—')}${answer.note ? `<br/><em>${escapeHtml(answer.note)}</em>` : ''}</div>
      </div>`;
    })
    .join('');

  const emotionsHtml =
    entry.custom_fields.psychology_emotions.length > 0
      ? entry.custom_fields.psychology_emotions.map((emotion) => `<span class="chip">${escapeHtml(emotion)}</span>`).join('')
      : '<span class="muted">—</span>';

  const screenshotsHtml =
    screenshotImages.length === 0
      ? ''
      : `<section class="section">
          <h3>Capturas de pantalla</h3>
          <div class="shot-grid">
            ${screenshotImages
              .filter((item) => item.dataUrl)
              .map((item) => `<img src="${item.dataUrl}" alt="Captura del journal" />`)
              .join('')}
          </div>
        </section>`;

  const disciplineHtml =
    discipline.score === null
      ? '<p class="muted">No hubo suficiente información este día para calcular tu Ataraxia.</p>'
      : `
        <p class="ataraxia-score">${discipline.score}%</p>
        ${
          discipline.positives.length > 0
            ? `<div class="field"><span class="field-label">Lo que sumó</span><ul>${discipline.positives.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul></div>`
            : ''
        }
        ${
          discipline.negatives.length > 0
            ? `<div class="field"><span class="field-label">Lo que restó</span><ul>${discipline.negatives.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>`
            : ''
        }`;

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Journal ${escapeHtml(entry.entry_date)}</title>
<style>
  body { background:#0B0E14; color:#F5F2EB; font-family: Georgia, 'Times New Roman', serif; margin:0; padding:32px; }
  h1 { font-size: 1.6rem; margin-bottom: 4px; }
  h2 { color:#C9A66B; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.95rem; margin: 32px 0 12px; border-bottom: 1px solid #202632; padding-bottom: 6px; }
  h3 { font-size: 1.05rem; margin: 0 0 10px; }
  h4 { font-size: 0.95rem; margin: 0 0 8px; color: #C9A66B; }
  .subtitle { color: #9CA3AF; margin-bottom: 24px; text-transform: capitalize; }
  .section { margin-bottom: 8px; }
  .field { margin-bottom: 14px; }
  .field-label { display:block; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #9CA3AF; margin-bottom: 4px; }
  .field-value { font-size: 0.95rem; line-height: 1.5; }
  .muted { color: #9CA3AF; }
  .op-card { background: rgba(255,255,255,0.04); border: 1px solid #202632; border-radius: 10px; padding: 16px; margin-bottom: 14px; }
  .op-table { border-collapse: collapse; width: 100%; font-size: 0.88rem; }
  .op-table td { padding: 3px 8px 3px 0; vertical-align: top; }
  .op-table td:first-child { color: #9CA3AF; width: 40%; }
  .op-lesson { font-size: 0.9rem; margin-top: 10px; }
  .shot-grid { display: flex; flex-wrap: wrap; gap: 12px; }
  .shot-grid img { max-width: 260px; border-radius: 8px; border: 1px solid #202632; }
  .chip { display: inline-block; background: rgba(201,166,107,0.12); border: 1px solid rgba(201,166,107,0.3); color: #C9A66B; border-radius: 999px; padding: 3px 10px; font-size: 0.78rem; margin: 0 6px 6px 0; }
  .ataraxia-score { font-size: 2rem; color: #4A6B82; margin: 0 0 12px; }
  ul { margin: 4px 0 0; padding-left: 18px; font-size: 0.9rem; }
</style>
</head>
<body>
  <h1>Journal — ${escapeHtml(entry.entry_date)}</h1>
  <p class="subtitle">${escapeHtml(dateLabel)}</p>

  <h2>Fase 1 · Pre-sesión</h2>
  ${textBlock('Estado emocional', entry.emotional_state)}
  ${textBlock('Directriz operativa', entry.directriz)}
  <div class="section">
    <h3>Top Down (HTF)</h3>
    ${topDownHtf}
  </div>
  <div class="section">
    <h3>Top Down (LTF)</h3>
    ${topDownLtf}
  </div>
  <div class="section">
    <h3>Draw on Liquidity (DOL)</h3>
    ${textBlock('Contexto', entry.market_context)}
    ${textBlock('DOL (target)', entry.custom_fields.dol_target)}
    ${textBlock('Punto de invalidación', entry.custom_fields.dol_invalidation)}
  </div>
  ${screenshotsHtml}

  <h2>Fase 2 · Ejecución</h2>
  ${operationsHtml}

  <h2>Fase 3 · Post-mercado</h2>
  ${textBlock('Análisis técnico post-mercado', entry.post_market_analysis)}
  ${quizHtml}
  <div class="field">
    <span class="field-label">Emoción predominante/s</span>
    <div class="field-value">${emotionsHtml}</div>
  </div>
  ${textBlock('Notas adicionales', entry.custom_fields.quiz_extra_notes)}

  <h2>Estado Ataraxia</h2>
  ${disciplineHtml}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `journal-${entry.entry_date}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
