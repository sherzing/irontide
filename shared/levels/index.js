// Level registry. To add a level: create a file next to drydock.js (same data shape, the kit in
// kit.js helps), import it here and add it to LEVELS. Client, bots, nav and server pick it up.
import drydock from './drydock.js';

export const LEVELS = { [drydock.id]: drydock };
export const DEFAULT_LEVEL = drydock.id;
