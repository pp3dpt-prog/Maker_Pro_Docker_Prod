import { ver } from './lib.mjs';
import { CENAS } from './cenas.mjs';
ver(CENAS, process.argv[2] || 'cenas.svg', 1400);
