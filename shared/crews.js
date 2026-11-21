// Crews: what a soldier wears. Looks only: every crew has the same body, the same hit volumes, the same speed.
// A crew belongs to a side. BLUE's crews are painted in cold colours and RED's in warm ones, so a team reads at a glance;
// in a deathmatch anyone wears any of them.
//   plate, stripe, cloth, suit: what the armour, its markings, the fabric and the under-suit are repainted in
//   visor: the colour of the visor's glass      kit: what is strapped on (built in client/src/crewkit.js)
// The names are invented, like every name in the game.
export const CREWS = {
  watch: { side: 1, name: 'Harbour Watch', blurb: 'Port police. Navy plate, white flashes, a radio pack.', plate: '#2f518a', stripe: '#eef1f4', cloth: '#3c4a5c', suit: '#141920', visor: '#7fc4ff', kit: ['radio'] },
  cutter: { side: 1, name: 'Cutter Crew', blurb: 'Boarding party off the revenue boat. White plate, blue flashes, a life collar.', plate: '#e6e8e4', stripe: '#2065c4', cloth: '#2a5596', suit: '#161d2a', visor: '#a8dcff', kit: ['collar'] },
  divers: { side: 1, name: 'Clearance Divers', blurb: 'Graphite plate, teal flashes, twin air tanks.', plate: '#353c42', stripe: '#20d6c2', cloth: '#1f5252', suit: '#0d1012', visor: '#3df2da', kit: ['tanks'] },
  pilots: { side: 1, name: 'Bar Pilots', blurb: 'Foul-weather lime, silver flashes, a signal mast on the back.', plate: '#a4cc2e', stripe: '#e2e8ec', cloth: '#26405c', suit: '#111820', visor: '#dcff86', kit: ['mast'] },
  wreckers: { side: 2, name: 'Wreckers', blurb: 'Shipbreakers. Rust plate, yellow flashes, a gas bottle and a welder\'s brow.', plate: '#a4552a', stripe: '#f2c422', cloth: '#5e4a32', suit: '#1b1511', visor: '#ffb648', kit: ['bottle', 'brow'] },
  nightshift: { side: 2, name: 'Night Shift', blurb: 'Dock gang. Signal orange, grey flashes, a hard-hat brim and lamp.', plate: '#f0701e', stripe: '#e8e8e2', cloth: '#3c3f44', suit: '#151515', visor: '#ffd590', kit: ['brim'] },
  deadfreight: { side: 2, name: 'Dead Freight', blurb: 'Smugglers. Oxblood plate, bone flashes, a scarf.', plate: '#822327', stripe: '#eae1ca', cloth: '#4c4c4f', suit: '#111113', visor: '#ff5040', kit: ['scarf'] },
  runners: { side: 2, name: 'Low Tide Runners', blurb: 'Beach crews. Sand plate, dark red flashes, a bedroll.', plate: '#ccb07c', stripe: '#8e211d', cloth: '#6e6c44', suit: '#1d1913', visor: '#ffe4a6', kit: ['roll', 'scarf'] },
};
export const CREW_IDS = Object.keys(CREWS);
export const crewsOf = (side) => CREW_IDS.filter((id) => CREWS[id].side === side);
/**
 * The crew a soldier wears on `team` (1 BLUE, 2 RED, 0 none: a deathmatch). want: their own choices { 1: id, 2: id, 0: id }.
 * A choice that does not fit the team is replaced by one of that side's crews at random; bots have no choices.
 */
export function crewFor(team, want, rnd = Math.random) {
  const pick = want?.[team], pool = team ? crewsOf(team) : CREW_IDS;
  return pool.includes(pick) ? pick : pool[(rnd() * pool.length) | 0];
}
/** A player's three choices as sent when joining, "blue,red,deathmatch", to the form crewFor takes. */
export const parseLook = (s) => { const [b, r, d] = String(s || '').split(','); return { 1: b, 2: r, 0: d }; };
