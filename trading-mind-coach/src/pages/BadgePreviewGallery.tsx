import MissionBadge, { type MissionBadgeTier } from '../components/MissionBadge';

const TIERS_IN_ORDER: MissionBadgeTier[] = ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Rubí', 'Esmeralda'];

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
        {TIERS_IN_ORDER.map((tier) => (
          <div key={tier} className="panel badge-gallery-card">
            <MissionBadge tier={tier} size={128} />
            <span className="badge-gallery-card-name">{tier}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BadgePreviewGallery;
