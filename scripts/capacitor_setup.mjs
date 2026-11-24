// Raises the generated iOS project to iOS 15.1, which the plugin's ONNX Runtime pod (DaVoiceOnnxRuntime 1.31.0) needs.
// Capacitor runs it before every native update (package.json "capacitor:update:before": cap add, cap sync, cap update,
// cap run), so the setting is in place before `pod install`. It only raises values and is safe to run again.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const edit = (file, change) => {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) return;
    const before = fs.readFileSync(p, 'utf8');
    const after = change(before);
    if (after !== before) { fs.writeFileSync(p, after); console.log(`capacitor_setup: updated ${file}`); }
};

edit('ios/App/Podfile', (podfile) => podfile.replace(/platform :ios, '(\d+(?:\.\d+)?)'/, (m, v) => (parseFloat(v) < 15.1 ? "platform :ios, '15.1'" : m)));
edit('ios/App/App.xcodeproj/project.pbxproj', (pbx) =>
    pbx.replace(/IPHONEOS_DEPLOYMENT_TARGET = (\d+(?:\.\d+)?);/g, (m, v) => (parseFloat(v) < 15.1 ? 'IPHONEOS_DEPLOYMENT_TARGET = 15.1;' : m)));
