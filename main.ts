// TELUK CAHAYA — main.ts (make.fun gta6-01)
// Copies game/ and screenshots/ into the output directory and writes
// /output/dossier.json with the kit's buildDossier. Node 22 standard
// library only; no timestamps, no randomness, so two runs are byte-identical.
import { buildDossier } from './vendor/makefun-game.ts';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname);
const OUT = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? join(ROOT, 'out'));

function copyTree(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  const entries = readdirSync(src).sort();
  for (const name of entries) {
    const from = join(src, name);
    const to = join(dst, name);
    const st = statSync(from);
    if (st.isDirectory()) {
      copyTree(from, to);
    } else if (st.isFile()) {
      copyFileSync(from, to);
    }
  }
}

mkdirSync(OUT, { recursive: true });

const gameDir = join(ROOT, 'game');
const shotsDir = join(ROOT, 'screenshots');
if (!existsSync(gameDir)) throw new Error('main.ts: game/ is missing');
if (!existsSync(shotsDir)) throw new Error('main.ts: screenshots/ is missing');
copyTree(gameDir, join(OUT, 'game'));
copyTree(shotsDir, join(OUT, 'screenshots'));

writeFileSync(
  join(OUT, 'dossier.json'),
  buildDossier(OUT, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  }),
);

console.log(`TELUK CAHAYA: dossier written to ${join(OUT, 'dossier.json')}`);
