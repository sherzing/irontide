// Level registry. To add a level: create a file next to drydock.js (same data shape, the kit in
// kit.js helps), import it here and add it to LEVELS. Client, bots, nav and server pick it up.
import drydock from './drydock.js';

export const LEVELS = { [drydock.id]: drydock };
export const DEFAULT_LEVEL = drydock.id;

/**
 * The match size a level suits, as { min, max } players (humans + bots). A recommendation only: the hard cap is
 * MAX_PLAYERS in sim.js. Taken from the level's `players`, otherwise estimated from its floor area (~200 m² each).
 */
export function recommendedPlayers(level) {
  if (level.players) return level.players;
  const b = level.bounds, max = Math.max(4, Math.round(((b.maxX - b.minX) * (b.maxZ - b.minZ)) / 400) * 2);
  return { min: Math.max(2, Math.round(max / 3)), max };
}
