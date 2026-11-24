// 'react-native-davoice/speech' -> cordova-speech / capacitor-speech: window.DaVoiceSpeech is the same Speech
// object (same API) as the React Native package's default export.
const Speech = (window as any).DaVoiceSpeech;
export default Speech;
export type VoiceCloneResult = { path: string; voice: string; warnings: string[] };
export type AudioRoutingConfig = any;
export type SpeakerItem = { id: string; json: string };
