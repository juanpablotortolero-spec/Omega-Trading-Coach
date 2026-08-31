import { useEffect, useState } from 'react';

export type MissionBadgeTier = 'Bronce' | 'Plata' | 'Oro' | 'Platino' | 'Diamante' | 'Rubí' | 'Esmeralda';

/** Estado interno para "todavía sin medalla" — no es un tier real, solo cómo se pinta cuando `tier` llega en null. */
type EffectiveTier = MissionBadgeTier | 'Vacío';

/** Carpeta pública donde van los PNG/WebP finales — Vite sirve todo lo de `public/` tal cual, sin procesar. */
const ASSET_BASE = '/assets/badges/';

const ASSET_FILE: Record<MissionBadgeTier, string> = {
  Bronce: 'bronze.png',
  Plata: 'silver.png',
  Oro: 'gold.png',
  Platino: 'platinum.png',
  Diamante: 'diamond.png',
  Rubí: 'ruby.png',
  Esmeralda: 'emerald.png',
};

/**
 * Resplandor trasero por tier — pulso animado vía `filter: drop-shadow`, no
 * `box-shadow`: drop-shadow sigue la silueta real con canal alfa (el hueco
 * transparente alrededor del emblema recortado), mientras que box-shadow
 * dibujaría un halo rectangular pegado al borde del contenedor — con arte
 * transparente de verdad (o el ícono de fallback, también transparente),
 * se nota la diferencia.
 */
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

/**
 * Escudo geométrico simple, trazo limpio estilo Lucide — el proyecto no
 * tiene `lucide-react` instalado (se evaluó agregarlo solo por este ícono y
 * no vale la pena la dependencia nueva), así que es un SVG a mano en el
 * mismo espíritu: minimalista, sin relleno sólido, `currentColor` para que
 * el CSS por tier lo tiña sin duplicar el SVG 7 veces.
 */
function ShieldFallbackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mission-badge-fallback-icon"
      aria-hidden="true"
    >
      <path d="M12 2.5 L19.5 5.5 V11.2 C19.5 16.3 16.4 20.1 12 21.5 C7.6 20.1 4.5 16.3 4.5 11.2 V5.5 Z" />
    </svg>
  );
}

/**
 * El "pedestal" del emblema — contenedor puro de imagen, sin geometría
 * dibujada a mano. Renderiza el PNG/WebP real de
 * `public/assets/badges/<tier>.png` con el glow correspondiente. Mientras
 * esos archivos no existan (o si el `<img>` falla por cualquier motivo),
 * cae a un escudo geométrico limpio que hereda el color/brillo del tier —
 * nunca un ícono roto del navegador ni un placeholder gris genérico.
 * `tier` en null (todavía sin ganar esta medalla) usa el mismo escudo, sin
 * glow, bien apagado.
 */
function MissionBadge({ tier, size = 96 }: { tier: MissionBadgeTier | null; size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);

  // Si el tier cambia (la card se reutiliza para otra misión), hay que
  // volver a intentar cargar SU imagen en vez de arrastrar el fallo del
  // tier anterior.
  useEffect(() => {
    setImgFailed(false);
  }, [tier]);

  const effectiveTier: EffectiveTier = tier ?? 'Vacío';
  const showFallback = tier === null || imgFailed;

  return (
    <div className={`mission-badge ${GLOW_CLASS[effectiveTier]}`} style={{ width: size, height: size }}>
      {showFallback ? (
        <div className={`mission-badge-fallback ${tier === null ? 'mission-badge-empty' : ''}`}>
          <ShieldFallbackIcon />
        </div>
      ) : (
        <img
          src={`${ASSET_BASE}${ASSET_FILE[tier]}`}
          alt={`Medalla ${tier}`}
          className="mission-badge-img"
          onError={() => setImgFailed(true)}
        />
      )}
    </div>
  );
}

export default MissionBadge;
