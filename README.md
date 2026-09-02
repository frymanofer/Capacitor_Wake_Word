# Capacitor Wake Word Example

A minimal Android and iOS example for [`capacitor-wake-word`](https://www.npmjs.com/package/capacitor-wake-word), an on-device wake word, hotword, and keyword detection package for Capacitor on Android and iOS.

The example loads `hey_lookdeep.dm`, creates a native detector with a `0.99` threshold and buffer count of `2`, and then destroys it. The same `.dm` model is used on Android and iOS.

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

It does not use a local dependency or contain a copy of the native libraries or model files.

## How it works

Capacitor discovers `capacitor-wake-word` through its Cordova compatibility layer during `npx cap sync`. The app waits for `deviceready`, accesses `window.DaVoiceWakeWord`, and verifies that the native detector can be created and destroyed.

## Custom wake words

Contact [DaVoice.io](https://davoice.io/) at `info@davoice.io` for custom wake word models and licensing.
