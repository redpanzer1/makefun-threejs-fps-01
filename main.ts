// Dustline Depot — a three.js tactical FPS, entered in make.fun threejs-fps-01.
// main.ts is the program that hands the entry in. It copies this repository's
// game/ and screenshots/ into /output (or MAKEFUN_OUTPUT_DIR when run outside
// the grader) and writes /output/dossier.json, the summary the judge reads,
// using the kit's vendored library. Node 22, standard library only.
//
// Play it locally first: `node serve.ts`, then open http://localhost:8080.
// Build the dossier locally: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputRoot = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputRoot, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputRoot, 'game'), { recursive: true });
mkdirSync(join(outputRoot, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputRoot, 'screenshots'), { recursive: true });
}

// The caps mirror the gate: at most 4 screenshots of 256 KiB each, at most
// 993 files and 48 MiB under game/, and the judge reads at most 160 KiB of
// source text from the dossier.
writeFileSync(
  join(outputRoot, 'dossier.json'),
  buildDossier(outputRoot, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  }),
);
