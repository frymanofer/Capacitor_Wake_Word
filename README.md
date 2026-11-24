# Capacitor Wake Word Example

[License](LICENSE) · [Model and Voice Asset Notice](MODEL_NOTICES.md)

A minimal Android and iOS example for [`capacitor-wake-word`](https://www.npmjs.com/package/capacitor-wake-word), an on-device wake word, hotword, and keyword detection package for Capacitor on Android and iOS.

The example loads `hey_lookdeep.dm`, creates a native detector with a `0.99` threshold and buffer count of `2`, and then destroys it. The same `.dm` model is used on Android and iOS.

## More examples

- [example_car_agent](example_car_agent): an on-device voice assistant for a simulated car. It combines the wake word, speaker verification, speech to text, text to speech (`capacitor-speech`) and an on-device agent (`capacitor-voice2voice`).

## Requirements

- Node.js and npm
- Android Studio and an Android SDK for Android builds
- macOS, Xcode, and CocoaPods for iOS builds

## Install

Install all dependencies from npm:

```bash
npm install
```

Add and sync Android:

```bash
npx cap add android
npx cap sync android
npx cap open android
```

Add and sync iOS using CocoaPods:

```bash
npx cap add ios --packagemanager CocoaPods
npx cap sync ios
npx cap open ios
```

The CocoaPods option is required because the Cordova plugin currently declares its ONNX Runtime iOS dependency through CocoaPods. Do not create this example's iOS project with Capacitor's default Swift Package Manager mode.

## Package installation

This repository consumes the published npm package:

```json
"capacitor-wake-word": "^0.1.2"
```

It does not use a local dependency or contain a copy of the native libraries or model files. ([example_car_agent](example_car_agent) bundles its own wake word and speaker verification models in `src/app/static/models`.)

## How it works

Capacitor discovers `capacitor-wake-word` through its Cordova compatibility layer during `npx cap sync`. The app waits for `deviceready`, accesses `window.DaVoiceWakeWord`, and verifies that the native detector can be created and destroyed.

## Custom wake words

Contact [DaVoice.io](https://davoice.io/) at `info@davoice.io` for custom wake word models and licensing.

## Learn more on davoice.io

- [What is a wake word? DaVoice on-device wake word detection](https://davoice.io/wake-word)
- [Wake word benchmark](https://davoice.io/wake-word-benchmark): two independent customer studies, DaVoice vs. commercial engines and openWakeWord
- [Complete guide to on-device wake word detection](https://davoice.io/wake-word-guide)
- [Wake word integration guides for every platform](https://davoice.io/integration-guides-wake-word)
- [On-device voice-to-voice AI agent SDK](https://davoice.io/voice-agent-sdk): wake word, speech to text, a local LLM with tool calling and text to speech, with no per-token API fees
- [On-device speech to text SDK](https://davoice.io/speech-to-text): real-time and offline, no per-minute fees
- [On-device text to speech SDK and TTS API](https://davoice.io/text-to-speech): natural voices and voice cloning, no per-character fees
- [Free online text to speech](https://davoice.io/free-text-to-speech): free and unlimited, with no sign-up, no login and no subscription. Natural AI voices in 11 languages, voice cloning, MP3 and WAV download, generated in your browser
- [Pricing](https://davoice.io/pricing): free license for proof-of-concept, academic and non-commercial projects
