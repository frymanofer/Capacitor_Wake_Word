# DaVoice: AI Car Voice Agent (Capacitor)

An on-device voice assistant for a car, built with Capacitor. The whole voice pipeline runs on the phone:

- wake word detection ("Hey DaVoice"): [`capacitor-wake-word`](https://www.npmjs.com/package/capacitor-wake-word)
- speaker verification (optional voice signature): `capacitor-wake-word`
- real-time speech to text and on-device text to speech: `capacitor-speech`
- the DaVoice Automotive Agent, a small on-device language model that turns what was said into car actions: `capacitor-voice2voice`

The car is **simulated** (the card on the screen). This example does not control a real vehicle.

It is the Capacitor twin of the React Native car agent (`ReactNative_DaVoice/example_car_agent`): the car tools, the
agent setup, the follow-up questions, the spoken confirmations and the language packs are the same TypeScript modules
(`src/rn`), and only the screens are new (plain HTML and TypeScript, no framework).

## Flow

1. **Language**: pick the language for speech recognition, the voices and the replies. Each language is downloaded on
   first use (about 170 MB).
2. **Voice**: pick the voice that speaks the replies. Tap a voice to hear it.
3. **Voice signature** (optional): say five sentences. With a signature, the wake word and the agent respond only to
   you, and only you can unlock or open the doors. The signature is saved on the phone (`sv_enrollment.json` in the
   app's documents folder).
4. **Wake word**: say "Hey DaVoice", or tap **Open the car without the wake word**.
5. **Car**: speak a command: "open the windows", "set the temperature to 21", "turn on the seat heating", "I'm cold".
   The first start downloads the agent model (382 MB) and a pre-warmed state for your language (about 430 MB) in
   the background, so the first reply is fast.

**Back** returns to the wake word screen.

**Settings** (the gear, on every screen): how you and the agent take turns, the same choices as the React Native car
agent. Nothing changes until **Save**, and the choice is kept (`conversation_settings.json`).

- **Take turns** (default): listening pauses while the agent answers. **Interrupt**: talk over the agent to stop it
  (echo cancellation; experimental on Android).
- **Just talk** (default): after the first wake word, every request is heard without it. **Wake word**: say
  "Hey DaVoice" before each request; when the agent asks a question, answer without it.
- Each mode's timeouts: the silence that ends a request, how long to listen after the wake word, the follow-up
  window after a question, pre-fetch (keeps "Hey DaVoice, open the window" said in one breath), and the wake word as a
  stop word while the agent talks (off by default).
- **About → Privacy policy** opens https://davoice.io/privacy/car-agent.

The line under the chat shows what the agent does now ("Say “Hey DaVoice” before each request", "Listening… just
talk", "Answering… tap to stop"). Tap it to wake the conversation or to stop the agent.

## Requirements

- Node.js 22 or newer
- Android: Android Studio with the Android SDK and JDK 21 (Android Studio's bundled JDK works). The app needs
  Android 8.0 (API 26) or newer.
- iOS: macOS with Xcode 16 or newer and CocoaPods. The app needs iOS 15.1 or newer.
- A real phone is best: the demo listens through the microphone the whole time. Without one, see
  [Testing without a microphone](#testing-without-a-microphone).
- About 1 GB of free space on the phone for one language pack, the agent model and its state.

## Run it

```bash
npm install
npm run add:android      # once: creates android/
npm run android          # builds the web app and runs it on a connected phone
```

iOS:

```bash
npm run add:ios          # once: creates ios/ with CocoaPods
npm run ios              # or: npx cap open ios, then run from Xcode
```

After you change anything in `src/`, `npm run android` / `npm run ios` builds it again (`npm run sync` only builds
and syncs).

Use **CocoaPods** for iOS (`add:ios` passes `--packagemanager CocoaPods`). The plugins reach Capacitor through its
Cordova compatibility layer, and their iOS dependencies are CocoaPods pods.

### Native settings

The plugins need a few settings in the generated native projects. [scripts/capacitor_setup.mjs](scripts/capacitor_setup.mjs)
applies them, and Capacitor runs it before every native update (`capacitor:update:before` in `package.json`), so
`cap add`, `cap sync` and `cap run` keep them in place:

- Android: `android:largeHeap="true"` in `AndroidManifest.xml` (the voice models are large) and `minSdkVersion = 26`
  in `variables.gradle` (the on-device agent).
- iOS: `platform :ios, '15.1'` in the `Podfile` and an iOS 15.1 deployment target for the app (ONNX Runtime), and
  `NSMicrophoneUsageDescription` / `NSSpeechRecognitionUsageDescription` in `Info.plist`. Capacitor does not copy
  these texts from the plugins, and iOS ends an app that opens the microphone without them.

Copy the script and the `capacitor:update:before` line when you add the plugins to your own app, or make these
changes by hand.

Speech recognition's word lists (car words and "Hey DaVoice", for better recognition of the commands) are in
`src/stt_bias_conf` (synced from the React Native car agent). iOS reads them from the app bundle: `scripts/capacitor_setup.mjs` copies them into `ios/App/App` and adds them to the App target's resources. Android does not use them.

## Where to look

| What | Where | Plugin API |
| --- | --- | --- |
| App flow and screens | [src/app/app.ts](src/app/app.ts) | |
| License key, wake word model, thresholds | [src/app/config.ts](src/app/config.ts) | |
| Language pack download | `chooseLanguage()` and [src/rn/tts/languagePacks.ts](src/rn/tts/languagePacks.ts) | `DaVoiceSpeech.files.downloadFile` |
| Voices | `initVoices()`, `showVoiceScreen()` | `DaVoiceSpeech.initTTS`, `getAllVoices`, `changeVoice`, `speak` |
| Voice signature | `createSignature()` | `DaVoiceWakeWord.createSpeakerVerificationMicController` |
| Wake word | `ensureWakeWord()`, `showWakeWordScreen()` | `DaVoiceWakeWord.create`, `start`, `startWithSpeakers`, `keywordDetected` |
| Speech to text with speaker verification | `showCarScreen()`, `onHeard()` | `DaVoiceSpeech.initAll({ speakers })`, `onSpeechPartialResults`, `onSpeechResults` |
| Conversation modes (take turns / interrupt, wake word / just talk) | `conversation` in app.ts, [src/rn/conversation](src/rn/conversation) | `pauseSpeechRecognition`, `unPauseSpeechRecognition(-1, preFetchMs)`, `DaVoiceWakeWord.pause` / `resume` |
| Settings sheet | `openSettings()` | |
| The agent and the car tools | `warmUpModel()`, `runTurn()`, [src/rn/aichat/provider.ts](src/rn/aichat/provider.ts), [src/rn/car](src/rn/car) | `DaVoiceLLM` |
| The simulated car | [src/app/car.ts](src/app/car.ts), [src/rn/car/CarState.ts](src/rn/car/CarState.ts) | |

The plugins are Cordova plugins that Capacitor loads through its compatibility layer: the app uses them through the
`window.DaVoiceSpeech`, `window.DaVoiceWakeWord` and `window.DaVoiceLLM` globals after `deviceready`, as in a Cordova
app.

Pauses are gentle: speech recognition and the wake word pause and unpause (`pauseSpeechRecognition` /
`unPauseSpeechRecognition`, `DaVoiceWakeWord.pause({ stopMicrophone: false })` / `resume`) and the microphone keeps
running. While the agent speaks, recognition is paused so it does not hear itself (in the interrupt mode it stays on,
with echo cancellation, and only words the agent isn't saying stop it).

## Project layout

- `src/app/`: this app: screens, styles, `index.html` and the bundled models (`static/models`).
- `src/rn/`: the React Native car agent's logic, copied by `npm run sync:rn`. Do not edit these files here; change
  them in the React Native example and sync again.
- `src/shims/`: small adapters that give the shared modules the React Native APIs they import (`react-native`,
  `react-native-fs`, the DaVoice React Native packages) on top of the plugins.
- `src/local.config.ts`: your own settings, such as `GEMINI_API_KEY` for the `'gemini'` mode in
  `src/general_questions.config.ts`. `npm run build` creates it from `src/local.config.example.ts`, and git ignores it.
- `scripts/build.mjs`: bundles everything into `www/js/app.js` with esbuild.
- `scripts/capacitor_setup.mjs`: the native settings above.
- `scripts/sync_from_rn.mjs`: copies the React Native modules into `src/rn`. Usage:
  `npm run sync:rn -- path/to/ReactNative_DaVoice/example_car_agent`.

## Testing without a microphone

- **Self test**: set `window.DV_SELFTEST = true` before `js/app.js` loads (for example in `www/index.html` after
  `npm run build`, then `npx cap sync`). The app then downloads English, loads the voices and the agent, runs three
  commands and logs `CARTEST` lines to the console.
- **From a debugger**: with the app on the car screen, open `chrome://inspect` (Android) or Safari's Develop menu
  (iOS) and run `await __carAgent.runTurn('open the windows')`.

## License

The example's source code is MIT-licensed ([LICENSE](../LICENSE)). The wake word model, the speaker verification
model, the language packs, the voices and the agent model are covered by the
[Model and Voice Asset Notice](../MODEL_NOTICES.md). The demo license key in `src/app/config.ts` is for evaluation;
contact [DaVoice.io](https://davoice.io/) at `info@davoice.io` for a production key and custom wake words.
