import {resolve} from 'node:path';

// apps/server, whether running from src/ (node src/index.ts) or the compiled dist/src/.
export const SERVER_ROOT = resolve(import.meta.dirname, import.meta.dirname.split(/[\\/]/).includes('dist') ? '../..' : '..');
