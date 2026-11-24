// Bundles the car agent (src/app/main.ts + the shared React Native modules in src/rn) into www/.
// React Native packages are mapped to this app's shims; the DaVoice packages to the Cordova/Capacitor plugins.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shim = (name) => path.join(ROOT, 'src', 'shims', name);
const WWW = path.join(ROOT, 'www');

// src/local.config.ts holds your own settings (for example a Gemini API key) and is not committed.
// A fresh clone starts from the example.
const LOCAL_CONFIG = path.join(ROOT, 'src', 'local.config.ts');
if (!fs.existsSync(LOCAL_CONFIG)) {
    fs.copyFileSync(path.join(ROOT, 'src', 'local.config.example.ts'), LOCAL_CONFIG);
    console.log('created src/local.config.ts from src/local.config.example.ts');
}

await build({
    entryPoints: [path.join(ROOT, 'src', 'app', 'main.ts')],
    bundle: true,
    format: 'iife',
    target: ['es2019'],
    outfile: path.join(WWW, 'js', 'app.js'),
    sourcemap: process.argv.includes('--sourcemap') ? 'inline' : false,
    alias: {
        'react-native': shim('react-native.ts'),
        'react-native-fs': shim('react-native-fs.ts'),
        'react-native-davoice/speech': shim('react-native-davoice-speech.ts'),
        'react-native-davoice-llm': shim('react-native-davoice-llm.ts'),
        'react-native-wakeword': shim('react-native-wakeword.ts'),
    },
    loader: { '.mp3': 'file', '.png': 'file', '.jpg': 'file', '.json': 'json' },
    assetNames: 'assets/[name]',
    publicPath: 'js',
    logLevel: 'warning',
    define: { __DEV__: 'false' },
});

// Static files: index.html, styles, models and images used by the app.
fs.mkdirSync(WWW, { recursive: true });
for (const name of ['index.html', 'styles.css']) fs.copyFileSync(path.join(ROOT, 'src', 'app', name), path.join(WWW, name));
fs.cpSync(path.join(ROOT, 'src', 'app', 'static'), WWW, { recursive: true });
console.log('built www/');
