// Copies the React Native car agent's logic (ReactNative_DaVoice/example_car_agent) into src/rn so the
// Cordova/Capacitor app runs the same car tools, agent, conversation, language packs, wake word and
// speaker-verification code. Only plain TypeScript modules are copied (no React screens); the React
// Native packages they import are mapped to this app's shims by scripts/build.mjs.
// Usage: node scripts/sync_from_rn.mjs [path/to/ReactNative_DaVoice/example_car_agent]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RN = path.resolve(process.argv[2] || path.join(ROOT, '..', '..', 'ReactNative_DaVoice', 'example_car_agent'));
if (!fs.existsSync(path.join(RN, 'App.tsx'))) throw new Error(`Not the React Native car agent: ${RN}`);

const SRC = path.join(ROOT, 'src');
const DEST = path.join(SRC, 'rn');
const SKIP_DIRS = new Set(['redesign', '__tests__']);

function copyTree(from, to, filter) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        const a = path.join(from, entry.name), b = path.join(to, entry.name);
        if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) copyTree(a, b, filter); continue; }
        if (filter(entry.name)) fs.copyFileSync(a, b);
    }
}

fs.rmSync(DEST, { recursive: true, force: true });
// .ts and .json logic modules only: .tsx files are React Native screens (this app has its own UI).
copyTree(path.join(RN, 'src'), DEST, name => (name.endsWith('.ts') && !name.endsWith('.test.ts')) || name.endsWith('.json'));
// Files the modules import from the app root ('../../x' from src/rn/<dir>/ resolves to src/x).
for (const name of ['local.config.example.ts', 'general_questions.config.ts', 'language_packs.json']) {
    if (fs.existsSync(path.join(RN, name))) fs.copyFileSync(path.join(RN, name), path.join(SRC, name));
}
if (!fs.existsSync(path.join(SRC, 'local.config.ts'))) fs.copyFileSync(path.join(SRC, 'local.config.example.ts'), path.join(SRC, 'local.config.ts'));
fs.rmSync(path.join(SRC, 'agent_automotive'), { recursive: true, force: true });
copyTree(path.join(RN, 'agent_automotive'), path.join(SRC, 'agent_automotive'), () => true);
fs.mkdirSync(path.join(SRC, 'assets'), { recursive: true });
for (const name of ['cashRegisterSound.mp3', 'bellServiceDeskPressXThree.mp3']) {
    fs.copyFileSync(path.join(RN, 'assets', name), path.join(SRC, 'assets', name));
}
// Speech recognition's word lists (iOS reads them from the app bundle; see README "Native settings").
copyTree(path.join(RN, 'assets', 'stt_bias_conf'), path.join(SRC, 'stt_bias_conf'), name => name.endsWith('.txt'));
const count = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(dir, e.name)) : 1), 0);
console.log(`synced ${count(DEST)} files from ${RN} into src/rn`);
