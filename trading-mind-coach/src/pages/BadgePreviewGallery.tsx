import MissionBadge, { type MissionBadgeTier } from '../components/MissionBadge';

const TIERS_IN_ORDER: { tier: MissionBadgeTier; rankTitle: string }[] = [
  { tier: 'Bronce', rankTitle: 'El Iniciado' },
  { tier: 'Plata', rankTitle: 'El Disciplinado' },
  { tier: 'Oro', rankTitle: 'El Ejemplar' },
  { tier: 'Platino', rankTitle: 'El Inquebrantable' },
  { tier: 'Diamante', rankTitle: 'El Purificado' },
  { tier: 'Rubí', rankTitle: 'El Guerrero' },
  { tier: 'Esmeralda', rankTitle: 'El Sabio' },
];

/**
 * Página de preview temporal, sin navegación desde el resto de la app — se
 * llega escribiendo /preview-medallas directo en la URL. Puramente visual:
 * no lee ni escribe nada de Supabase.
 */
function BadgePreviewGallery() {
  return (
    <div className="badge-gallery-page">
      <h1 className="badge-gallery-title">Tesorería del Ágora: Evolución de la Disciplina</h1>
      <p className="badge-gallery-subtitle">Las 7 medallas, de Bronce a Esmeralda — vista previa de diseño.</p>

      <div className="badge-gallery-grid">
        {TIERS_IN_ORDER.map(({ tier, rankTitle }) => (
          <div key={tier} className="panel badge-gallery-card">
            <MissionBadge tier={tier} size={128} />
            <span className="badge-gallery-card-name">
              {tier} - {rankTitle}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BadgePreviewGallery;
