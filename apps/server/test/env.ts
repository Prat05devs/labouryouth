import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Imported first by helpers.ts: test uploads go to a throwaway private folder, never the developer's own.
process.env.PRIVATE_STORAGE_PATH = mkdtempSync(join(tmpdir(), 'ly-uploads-'));
process.env.STORAGE_DRIVER = 'local';
