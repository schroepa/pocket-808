import { HIPHOP } from './hiphop.ts';
import { HOUSE } from './house.ts';
import { LOFI } from './lofi.ts';
import { TECHNO } from './techno.ts';
import { TRAP } from './trap.ts';
import type { Genre, Template } from './types.ts';

export { applyKit, applyTemplate, kitByName, kitParams, soundPatch } from './apply.ts';
export { KITS } from './kits.ts';
export { parseTemplatePattern, TemplateError } from './parse.ts';
export { SYNTH_SOUNDS } from './sounds.ts';
export { GENRES, TEMPLATE_SCOPES } from './types.ts';
export type { Genre, KitParams, Template, TemplatePattern, TemplateScope } from './types.ts';

/** alle Vorlagen, nach Stil geordnet */
export const TEMPLATES: readonly Template[] = [...LOFI, ...HIPHOP, ...TRAP, ...HOUSE, ...TECHNO];

export const templatesOf = (genre: Genre): readonly Template[] =>
  TEMPLATES.filter((t) => t.genre === genre);
