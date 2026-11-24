// Applies the native settings the DaVoice plugins need to the generated Capacitor projects. Capacitor runs it before
// every native update (package.json "capacitor:update:before": cap add, cap sync, cap update, cap run), so the
// settings are in place before `pod install` and Gradle run. It only raises values and is safe to run again:
//   Android: android:largeHeap="true" (voice models are 70-150 MB) and minSdkVersion 26 (the on-device LLM).
//   iOS:     iOS 15.1 (ONNX Runtime 1.31) in the Podfile and the App target, and the microphone and speech
//            recognition usage texts in Info.plist, and speech recognition's word lists in the app bundle.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const edit = (file, change) => {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) return false;
    const before = fs.readFileSync(p, 'utf8');
    const after = change(before);
    if (after !== before) { fs.writeFileSync(p, after); console.log(`capacitor_setup: updated ${file}`); }
    return true;
};

edit('android/app/src/main/AndroidManifest.xml', (xml) =>
    /android:largeHeap=/.test(xml) ? xml : xml.replace(/<application\b/, '<application android:largeHeap="true"'));
edit('android/variables.gradle', (gradle) =>
    gradle.replace(/minSdkVersion\s*=\s*(\d+)/, (m, v) => (Number(v) < 26 ? 'minSdkVersion = 26' : m)));
edit('ios/App/Podfile', (podfile) => podfile.replace(/platform :ios, '(\d+(?:\.\d+)?)'/, (m, v) => (parseFloat(v) < 15.1 ? "platform :ios, '15.1'" : m)));
edit('ios/App/App.xcodeproj/project.pbxproj', (pbx) =>
    pbx.replace(/IPHONEOS_DEPLOYMENT_TARGET = (\d+(?:\.\d+)?);/g, (m, v) => (parseFloat(v) < 15.1 ? 'IPHONEOS_DEPLOYMENT_TARGET = 15.1;' : m)));
// iOS ends the app when it opens the microphone without these texts. Capacitor does not copy them from the plugins
// (it only prints "Configuration required"), so they are added here. Change the wording to fit your app.
const USAGE = {
    NSMicrophoneUsageDescription: 'The car agent listens for the wake word and your voice commands.',
    NSSpeechRecognitionUsageDescription: 'The car agent recognizes your voice commands.',
};
edit('ios/App/App/Info.plist', (plist) => {
    let out = plist;
    for (const [key, text] of Object.entries(USAGE)) {
        if (out.includes(`<key>${key}</key>`)) continue;
        // before the closing tag of the top-level dictionary
        out = out.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${key}</key>\n\t<string>${text}</string>\n</dict>\n</plist>\n`);
    }
    return out;
});

// iOS speech recognition reads its word lists (car words, "Hey DaVoice": better recognition of the commands) from the app
// bundle: words_flattened.txt (English) and words_flattened.<language>.txt (src/stt_bias_conf, synced from the React Native
// car agent). They are copied into ios/App/App and added to the App target's resources. Android does not use them.
const BIAS_DIR = path.join(ROOT, 'src', 'stt_bias_conf');
const IOS_APP = path.join(ROOT, 'ios', 'App', 'App');
if (fs.existsSync(BIAS_DIR) && fs.existsSync(IOS_APP)) {
    const files = fs.readdirSync(BIAS_DIR).filter((f) => /^words_flattened(\..+)?\.txt$/.test(f));
    for (const f of files) fs.copyFileSync(path.join(BIAS_DIR, f), path.join(IOS_APP, f));
    const id = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 24).toUpperCase();
    edit('ios/App/App.xcodeproj/project.pbxproj', (pbx) => {
        let out = pbx;
        for (const f of files) {
            if (out.includes(`/* ${f} */`)) continue;
            const ref = id(`ref:${f}`), build = id(`build:${f}`);
            const add = (anchor, line) => {
                const i = out.indexOf(anchor);
                if (i < 0) throw new Error(`capacitor_setup: ${anchor.trim()} not found in project.pbxproj`);
                const end = out.indexOf('\n', i) + 1;
                out = out.slice(0, end) + line + out.slice(end);
            };
            add('/* public in Resources */ = {isa = PBXBuildFile;', `\t\t${build} /* ${f} in Resources */ = {isa = PBXBuildFile; fileRef = ${ref} /* ${f} */; };\n`);
            add('/* public */ = {isa = PBXFileReference;', `\t\t${ref} /* ${f} */ = {isa = PBXFileReference; lastKnownFileType = text; path = ${f}; sourceTree = "<group>"; };\n`);
            add('/* public */,\n', `\t\t\t\t${ref} /* ${f} */,\n`);
            add('/* public in Resources */,\n', `\t\t\t\t${build} /* ${f} in Resources */,\n`);
        }
        return out;
    });
}
