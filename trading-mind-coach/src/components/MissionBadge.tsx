export type MissionBadgeTier = 'Bronce' | 'Plata' | 'Oro' | 'Platino' | 'Diamante' | 'Rubí' | 'Esmeralda';

/** Estado interno para "todavía sin medalla" — no es un tier real, solo cómo se pinta cuando `tier` llega en null. */
type EffectiveTier = MissionBadgeTier | 'Vacío';

const GLOW_CLASS: Record<EffectiveTier, string> = {
  Vacío: '',
  Bronce: 'mission-badge-glow-bronce',
  Plata: 'mission-badge-glow-plata',
  Oro: 'mission-badge-glow-oro',
  Platino: 'mission-badge-glow-platino',
  Diamante: 'mission-badge-glow-diamante',
  Rubí: 'mission-badge-glow-rubi',
  Esmeralda: 'mission-badge-glow-esmeralda',
};

/** Reborde "acuñado" — marcas radiales entre dos radios, como el canto estriado de una moneda. Calculado una sola vez (no depende de props). */
const REEDED_TICKS = Array.from({ length: 36 }, (_, i) => {
  const angle = (i * 10 * Math.PI) / 180;
  return {
    x1: 50 + 41.5 * Math.cos(angle),
    y1: 50 + 41.5 * Math.sin(angle),
    x2: 50 + 45.5 * Math.cos(angle),
    y2: 50 + 45.5 * Math.sin(angle),
  };
});

function ReededEdge({ color }: { color: string }) {
  return (
    <g stroke={color} strokeWidth="1" opacity="0.55">
      {REEDED_TICKS.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
      ))}
    </g>
  );
}

/** Cinta de sujeción detrás del disco — misma en las 7 medallas, unifica la silueta de "medalla". Apagada (gris) cuando todavía no hay medalla. */
function Ribbon({ dim }: { dim?: boolean }) {
  if (dim) {
    return (
      <g opacity="0.6">
        <path d="M43 3 L50 9 L50 32 L45 27 L40 32 Z" fill="#333947" stroke="#20242E" strokeWidth="0.6" />
        <path d="M57 3 L50 9 L50 32 L55 27 L60 32 Z" fill="#3F4657" stroke="#20242E" strokeWidth="0.6" />
      </g>
    );
  }
  return (
    <g>
      <path d="M43 3 L50 9 L50 32 L45 27 L40 32 Z" fill="#4A2338" stroke="#2E1522" strokeWidth="0.6" />
      <path d="M57 3 L50 9 L50 32 L55 27 L60 32 Z" fill="#5C2C43" stroke="#2E1522" strokeWidth="0.6" />
      <line x1="46" y1="10" x2="46" y2="24" stroke="#7A3D57" strokeWidth="0.8" opacity="0.6" />
    </g>
  );
}

/** Corona de laurel — parcial (dos ramas cortas) o completa (cierra casi arriba), color de acento fijo para que siempre se lea contra el metal de fondo. */
function LaurelWreath({ color, full }: { color: string; full: boolean }) {
  if (!full) {
    return (
      <g stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round">
        <path d="M22 63 Q15 57 17 48" />
        <path d="M22 63 Q17 58 20 52" />
        <path d="M78 63 Q85 57 83 48" />
        <path d="M78 63 Q83 58 80 52" />
      </g>
    );
  }
  return (
    <g stroke={color} strokeWidth="1.9" fill="none" strokeLinecap="round">
      <path d="M22 66 Q10 54 14 40 Q17 28 26 21" />
      <path d="M22 66 Q15 58 17 49" />
      <path d="M22 66 Q19 60 22 54" />
      <path d="M15 51 Q20 49 23 52" />
      <path d="M17 41 Q22 40 25 44" />
      <path d="M21 30 Q26 29 29 33" />
      <path d="M78 66 Q90 54 86 40 Q83 28 74 21" />
      <path d="M78 66 Q85 58 83 49" />
      <path d="M78 66 Q81 60 78 54" />
      <path d="M85 51 Q80 49 77 52" />
      <path d="M83 41 Q78 40 75 44" />
      <path d="M79 30 Q74 29 71 33" />
      <circle cx="50" cy="18" r="2.4" fill={color} stroke="none" />
    </g>
  );
}

/** Estrella de 5 puntas — insignia central de Bronce/Plata/Oro. */
function StarEmblem({ fillId, strokeColor, filled }: { fillId: string; strokeColor: string; filled: boolean }) {
  const pts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
    const r = i % 2 === 0 ? 13 : 5.5;
    const angle = (i * 36 - 90) * (Math.PI / 180);
    return `${50 + r * Math.cos(angle)},${50 + r * Math.sin(angle)}`;
  });
  return <polygon points={pts.join(' ')} fill={filled ? `url(#${fillId})` : 'none'} stroke={strokeColor} strokeWidth="1.4" strokeLinejoin="round" />;
}

/** Rayos cortos radiando desde el centro — solo Oro, detrás de la estrella. */
function Sunburst({ color }: { color: string }) {
  const lines = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * 45 * Math.PI) / 180;
    return {
      x1: 50 + 15 * Math.cos(angle),
      y1: 50 + 15 * Math.sin(angle),
      x2: 50 + 21 * Math.cos(angle),
      y2: 50 + 21 * Math.sin(angle),
    };
  });
  return (
    <g stroke={color} strokeWidth="1.2" opacity="0.7">
      {lines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
      ))}
    </g>
  );
}

/** Emblema facetado angular (cometa alargada) — Platino/Diamante. */
function FacetedKite({ fillId, ringColor, deep }: { fillId: string; ringColor: string; deep: boolean }) {
  return (
    <>
      <polygon points="50,26 62,46 50,74 38,46" fill={`url(#${fillId})`} stroke={ringColor} strokeWidth="1.3" strokeLinejoin="round" />
      <line x1="50" y1="26" x2="50" y2="74" stroke={ringColor} strokeWidth="0.7" opacity="0.65" />
      {deep && (
        <>
          <line x1="38" y1="46" x2="62" y2="46" stroke={ringColor} strokeWidth="0.7" opacity="0.65" />
          <line x1="44" y1="36" x2="56" y2="56" stroke={ringColor} strokeWidth="0.6" opacity="0.5" />
          <line x1="56" y1="36" x2="44" y2="56" stroke={ringColor} strokeWidth="0.6" opacity="0.5" />
        </>
      )}
    </>
  );
}

/** Gema engastada (rubí en rombo / esmeralda en octágono truncado) con garras doradas — el pináculo de la medalla. */
function SetGem({ fillId, cut, prongColor }: { fillId: string; cut: 'rubi' | 'esmeralda'; prongColor: string }) {
  const gemPoints = cut === 'rubi' ? '50,27 64,46 50,73 36,46' : '41,32 59,32 68,46 68,54 59,68 41,68 32,54 32,46';
  const facetLines =
    cut === 'rubi' ? (
      <>
        <line x1="50" y1="27" x2="50" y2="73" />
        <line x1="36" y1="46" x2="64" y2="46" />
        <line x1="42" y1="38" x2="58" y2="54" />
        <line x1="58" y1="38" x2="42" y2="54" />
      </>
    ) : (
      <>
        <line x1="50" y1="32" x2="50" y2="68" />
        <line x1="32" y1="50" x2="68" y2="50" />
        <line x1="41" y1="32" x2="59" y2="68" />
        <line x1="59" y1="32" x2="41" y2="68" />
      </>
    );
  const prongs = [
    [50, 27],
    [50, 73],
    [32, 50],
    [68, 50],
  ] as const;

  return (
    <>
      <polygon points={gemPoints} fill={`url(#${fillId})`} stroke="#2E1522" strokeWidth="1" strokeLinejoin="round" />
      <g stroke="#2E1522" strokeWidth="0.6" opacity="0.45">
        {facetLines}
      </g>
      <g fill={prongColor} stroke="none">
        {prongs.map(([x, y], i) => (
          <path
            key={i}
            d={`M${x - 2.4} ${y - 2.4} L${x} ${y + 2.8} L${x + 2.4} ${y - 2.4} Z`}
            transform={`rotate(${Math.atan2(50 - y, 50 - x) * (180 / Math.PI) + 90} ${x} ${y})`}
          />
        ))}
      </g>
    </>
  );
}

function BadgeGradients({ tier, fillId, ringId }: { tier: EffectiveTier; fillId: string; ringId: string }) {
  const stops: Record<EffectiveTier, [string, string, string]> = {
    Vacío: ['#3A4150', '#2A303B', '#1B1F26'],
    Bronce: ['#DDA25F', '#B0703A', '#6B4423'],
    Plata: ['#FFFFFF', '#C6CCD6', '#7C8494'],
    Oro: ['#FFF3C4', '#D9AE6C', '#8A6B4E'],
    Platino: ['#FFFFFF', '#BFF3FA', '#5FC3D6'],
    Diamante: ['#F1FEFF', '#8FE9F5', '#2AA9C2'],
    Rubí: ['#FF9AA2', '#D8465A', '#6E1620'],
    Esmeralda: ['#B9F3D8', '#4FAE8A', '#186349'],
  };
  const ringStops: Record<EffectiveTier, [string, string]> = {
    Vacío: [stops.Vacío[0], stops.Vacío[2]],
    Bronce: [stops.Bronce[0], stops.Bronce[2]],
    Plata: [stops.Plata[0], stops.Plata[2]],
    Oro: [stops.Oro[0], stops.Oro[2]],
    Platino: [stops.Platino[0], stops.Platino[2]],
    Diamante: [stops.Diamante[0], stops.Diamante[2]],
    Rubí: ['#F2D399', '#8A6B4E'],
    Esmeralda: ['#F2D399', '#8A6B4E'],
  };
  const [a, b, c] = stops[tier];
  const [ra, rb] = ringStops[tier];

  return (
    <defs>
      {/* Cara del disco: degradé radial descentrado para simular relieve acuñado (brillo arriba-izquierda). */}
      <radialGradient id={fillId} cx="38%" cy="32%" r="75%">
        <stop offset="0%" stopColor={a} />
        <stop offset="55%" stopColor={b} />
        <stop offset="100%" stopColor={c} />
      </radialGradient>
      {/* Aro/reborde: degradé lineal para que el metal del canto se vea de una pieza. */}
      <linearGradient id={ringId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={ra} />
        <stop offset="100%" stopColor={rb} />
      </linearGradient>
    </defs>
  );
}

/**
 * Insignia de misión evolutiva, con forma real de MEDALLA (cinta + disco
 * acuñado con canto estriado) en vez de un escudo plano — mismos gradientes
 * de color que la v1, geometría rehecha para que se lea como una insignia de
 * verdad al tamaño grande de la galería. Progresión: Bronce/Plata/Oro
 * comparten el disco redondo con una estrella que se va llenando y
 * enriqueciendo (laurel parcial en Plata, laurel completo + rayos en Oro);
 * Platino/Diamante cambian el emblema central a un corte facetado angular;
 * Rubí/Esmeralda culminan con una gema engastada en garras doradas. Con
 * `tier` en null (todavía sin ganar ninguna medalla de esta misión) se
 * pinta la misma silueta de medalla pero apagada/gris, sin emblema.
 */
function MissionBadge({ tier, size = 96 }: { tier: MissionBadgeTier | null; size?: number }) {
  const effectiveTier: EffectiveTier = tier ?? 'Vacío';
  const fillId = `mb-fill-${effectiveTier}`;
  const ringId = `mb-ring-${effectiveTier}`;
  const isJewel = tier === 'Rubí' || tier === 'Esmeralda';
  const accent = tier === 'Oro' ? '#FFF3D6' : tier === 'Plata' ? '#F4F6F9' : isJewel ? '#F2D399' : '#EAF9FC';

  return (
    <div
      className={`mission-badge ${GLOW_CLASS[effectiveTier]} ${tier === null ? 'mission-badge-empty' : ''}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} fill="none">
        <BadgeGradients tier={effectiveTier} fillId={fillId} ringId={ringId} />
        <Ribbon dim={tier === null} />
        <circle cx="50" cy="50" r="46" fill="none" stroke={`url(#${ringId})`} strokeWidth="3" />
        <ReededEdge color={`url(#${ringId})`} />
        <circle cx="50" cy="50" r="40.5" fill="none" stroke={`url(#${ringId})`} strokeWidth="1" opacity="0.75" />
        <circle cx="50" cy="50" r="37" fill={`url(#${fillId})`} stroke={`url(#${ringId})`} strokeWidth="1" />

        {tier === null && <circle cx="50" cy="50" r="12" fill="none" stroke={`url(#${ringId})`} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.7" />}

        {(tier === 'Bronce' || tier === 'Plata' || tier === 'Oro') && (
          <>
            {tier !== 'Bronce' && <LaurelWreath color={accent} full={tier === 'Oro'} />}
            {tier === 'Oro' && <Sunburst color={accent} />}
            <StarEmblem fillId={fillId} strokeColor={accent} filled={tier !== 'Bronce'} />
          </>
        )}

        {(tier === 'Platino' || tier === 'Diamante') && (
          <FacetedKite fillId={fillId} ringColor={`url(#${ringId})`} deep={tier === 'Diamante'} />
        )}

        {isJewel && (
          <>
            <LaurelWreath color={accent} full />
            <SetGem fillId={fillId} cut={tier === 'Rubí' ? 'rubi' : 'esmeralda'} prongColor={accent} />
          </>
        )}
      </svg>
    </div>
  );
}

export default MissionBadge;
