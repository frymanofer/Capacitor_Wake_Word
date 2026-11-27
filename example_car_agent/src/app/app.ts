// DaVoice: AI Car Voice Agent for Cordova and Capacitor: language -> voice -> voice signature -> wake word -> car agent.
// The car tools, agent, follow-ups, speech composer, conversation modes and language packs are the React Native car
// agent's own modules (src/rn); this file is the app flow and the screens. The DaVoice APIs used:
//   window.DaVoiceSpeech   (cordova-speech / capacitor-speech)        speech to text + text to speech
//   window.DaVoiceWakeWord (cordova-wake-word / capacitor-wake-word)  wake word + speaker verification
//   window.DaVoiceLLM      (cordova-voice2voice / capacitor-voice2voice) the on-device agent (through src/rn/aichat/provider.ts)
import { APP_LANGUAGES, type AppLanguage } from '../rn/appflow';
import { setTTSLanguage, getTTSVoiceConfig } from '../rn/tts';
import { downloadLanguagePack, isLanguagePackReady, languagePackFilePath, languagePackSizeBytes, LANGUAGE_PACKS, markLanguagePackWorking } from '../rn/tts/languagePacks';
import { LocalLLMProvider } from '../rn/aichat/provider';
import type { AIChatHistoryMessage } from '../rn/aichat/index';
import { normalizeTextForSpeech, splitCompletedSentences } from '../rn/aichat/index';
import { DID_NOT_CATCH, isBareDone, isNoiseFragment } from '../rn/aichat/fragments';
import { REMOTE_ANSWERS_ONLINE } from '../rn/aichat/remote';
import { CAR_TOOL_NAMES, carTools, noteCarUserText } from '../rn/car/carTools';
import { beginCarTurn, carAck, carTurnActions, composeCarSpeech, pendingOfferCalls } from '../rn/car/speechComposer';
import { carTurnInput, noteCarReply, noteCarSpoken } from '../rn/car/followUp';
import { basicMessage, normalizeYesNo } from '../rn/car/basicLanguage';
import { getCarState, onCarChange, resetCar } from '../rn/car/CarState';
import { LOCAL_LLM_CAR_TOOLS } from '../rn/local_llm/constants';
import { getSelectedModel } from '../rn/local_llm/ModelRegistry';
import { enrollmentSentences } from '../rn/speaker_verification/enrollmentSentences';
import { noteSpeechResult, setSpeakerGate } from '../rn/speaker_verification/currentSpeaker';
import { ConversationController, type ConversationPhase } from '../rn/conversation/controller';
import {
    END_OF_SPEECH_CHOICES, FOLLOW_UP_CHOICES, IDLE_CHOICES, LISTEN_CHOICES, PRE_FETCH_CHOICES, DEFAULT_CONVERSATION_SETTINGS,
    endOfSpeechMs, routingConfigForConversation, type Choice, type ConversationSettings,
} from '../rn/conversation/settings';
import { loadConversationSettings, saveConversationSettings } from '../rn/conversation/store';
import { conversationHint, conversationTapEnabled } from '../rn/conversation/hint';
import { dropWakePhrase } from '../rn/conversation/wakePhrase';
import { mergeSmartKeepPunct } from '../rn/stt';
import { silenceFor } from '../rn/stt/endOfSpeech';
import { defaultAudioRoutingConfig } from '../rn/wakeword';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import * as Config from './config';
import { renderCar } from './car';
import { showDialog } from './dialog';

const Speech = (window as any).DaVoiceSpeech;
const WakeWord = (window as any).DaVoiceWakeWord;
const LLM = (window as any).DaVoiceLLM;

const SV_SPEAKER_ID = 'user';
const WW_ID = 'car_agent';
const CAR_ACK_AFTER_MS = 1200;
/** Each voice-signature sentence may take this long to arrive before the signature fails. */
const SV_SAMPLE_TIMEOUT_MS = 60000;
const SV_FAILED = "I couldn't hear the samples clearly. Try again in a quiet place, or skip this step.";
/** The app's privacy policy (Google Play asks for it in the store listing and inside the app). */
const PRIVACY_POLICY_URL = 'https://davoice.io/privacy/car-agent';

const state = {
    language: null as AppLanguage | null,
    voice: '' as string,
    speed: 1.0,
    enrollmentJson: null as string | null,
    ttsReady: false,
    speechStarted: false,
    wakeWordReady: false,
    provider: null as LocalLLMProvider | null,
    modelStatus: 'Not loaded',
    modelReady: false,
    history: [] as AIChatHistoryMessage[],
    busy: false,
    inCar: false,
    wakeWordStarted: false,
    /** The conversation mode (the settings gear): take turns or interrupt, wake word or just talk, the timeouts. */
    settings: DEFAULT_CONVERSATION_SETTINGS as ConversationSettings,
};

let root: HTMLElement;
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector(sel) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const sttLocale = () => APP_LANGUAGES.find((l) => l.id === state.language)?.sttLocale ?? 'en-US';
const isPortuguese = () => state.language === 'pt-BR' || state.language === 'pt-PT';
const store = {
    get: (k: string) => { try { return localStorage.getItem(`davoice.${k}`); } catch { return null; } },
    set: (k: string, v: string) => { try { localStorage.setItem(`davoice.${k}`, v); } catch { /* private mode */ } },
};

function screen(html: string, className = '', gear = true) {
    root.innerHTML = `<div class="screen ${className}">${html}</div>${gear ? `<button class="gear floating" aria-label="Settings">${GEAR_SVG}</button>` : ''}`;
    root.querySelectorAll<HTMLButtonElement>('.gear').forEach((b) => (b.onclick = () => openSettings()));
    window.scrollTo(0, 0);
}

export async function startApp(element: HTMLElement) {
    root = element;
    screen(`<p class="eyebrow">DaVoice.io</p><h1>AI Car Voice Agent</h1><p class="status">Starting…</p>`, '', false);
    // One license key for every DaVoice library.
    await Speech.setLicense(Config.DAVOICE_LICENSE_KEY);
    await LLM.setLicense(Config.DAVOICE_LICENSE_KEY);
    if ((window as any).DV_SELFTEST) { await selfTest((window as any).DV_SELFTEST); return; }
    // The saved conversation settings; echo cancellation follows them (only when the user can interrupt).
    state.settings = await loadConversationSettings();
    conversation.update(state.settings);
    if (state.settings.interrupt) void applyConversationAudio(state.settings);
    const perms = await Speech.requestPermissions();
    if (perms.microphone !== 'granted') {
        screen(`<h1>Microphone needed</h1><p>The car agent listens for your voice. Allow the microphone in Settings and restart the app.</p>`, '', false);
        return;
    }
    showLanguageScreen();
}

// ---------------------------------------------------------------- language

async function showLanguageScreen() {
    const available = APP_LANGUAGES.filter((l) => !l.hidden && LANGUAGE_PACKS[l.id]);
    const featured = Config.FEATURED_LANGUAGES as string[];
    available.sort((a, b) => (featured.includes(b.id) ? 1 : 0) - (featured.includes(a.id) ? 1 : 0));
    const ready = await Promise.all(available.map((l) => isLanguagePackReady(l.id)));
    screen(`
      <p class="eyebrow">Step 1 of 4</p><h1>Language</h1>
      <p>Speech recognition, the voices and the agent's replies use this language. Each language is downloaded once
      (about ${Math.round((languagePackSizeBytes('en') || 170e6) / 1e6)} MB).</p>
      <div class="list">${available.map((l, i) => `
        <button class="item" data-lang="${l.id}">
          <span>${esc(l.label)}</span>
          <span class="badge ${ready[i] ? 'ok' : ''}">${ready[i] ? 'Ready' : `${Math.round(languagePackSizeBytes(l.id) / 1e6)} MB`}</span>
        </button>`).join('')}</div>
      <div id="progress" class="progress hidden"><div class="bar"></div><p class="status"></p></div>`);
    root.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => {
        b.onclick = () => chooseLanguage(b.dataset.lang as AppLanguage);
    });
}

async function chooseLanguage(language: AppLanguage) {
    root.querySelectorAll('button').forEach((b) => (b.disabled = true));
    const progress = $('#progress'); progress.classList.remove('hidden');
    const bar = progress.querySelector('.bar') as HTMLElement;
    const status = progress.querySelector('.status') as HTMLElement;
    try {
        if (!(await isLanguagePackReady(language))) {
            await downloadLanguagePack(language, (p) => {
                const pct = p.bytesTotal ? Math.round((100 * p.bytesDone) / p.bytesTotal) : 0;
                bar.style.width = `${pct}%`;
                status.textContent = p.stage === 'verify' ? 'Checking the download…' : `Downloading ${pct}%`;
            });
        }
        state.language = language;
        setTTSLanguage(language);
        store.set('language', language);
        status.textContent = 'Loading the voices…';
        await initVoices();
        await markLanguagePackWorking(language);
        showVoiceScreen();
    } catch (error) {
        status.textContent = `Failed: ${String((error as Error)?.message ?? error)}`;
        root.querySelectorAll('button').forEach((b) => (b.disabled = false));
    }
}

// ---------------------------------------------------------------- voice

function modelPath(): string {
    return languagePackFilePath(state.language!, 'model') ?? '';
}

async function initVoices() {
    if (state.speechStarted) { await Speech.destroyAll(); state.speechStarted = false; }
    await Speech.initTTS({ model: modelPath() });
    state.ttsReady = true;
}

async function showVoiceScreen() {
    const voices: string[] = await Speech.getAllVoices();
    const saved = store.get(`voice.${state.language}`);
    const preferred = saved && voices.includes(saved) ? saved : voices.includes('Rich') ? 'Rich' : voices[0];
    screen(`
      <p class="eyebrow">Step 2 of 4</p><h1>Voice</h1>
      <p>The agent answers in this voice. Tap one to hear it.</p>
      <div class="list">${voices.map((v) => `<button class="item ${v === preferred ? 'selected' : ''}" data-voice="${esc(v)}"><span>${esc(v)}</span></button>`).join('')}</div>
      <button id="next" class="primary wide">Continue</button>`);
    let selected = preferred;
    root.querySelectorAll<HTMLButtonElement>('[data-voice]').forEach((b) => {
        b.onclick = async () => {
            selected = b.dataset.voice!;
            root.querySelectorAll('[data-voice]').forEach((x) => x.classList.toggle('selected', x === b));
            await selectVoice(selected);
            await Speech.stopSpeaking();
            const hello = isPortuguese() ? `Olá, eu sou ${selected}. Vamos dirigir?` : `Hi, I'm ${selected}. Ready to drive?`;
            void Speech.speak(hello, 0, state.speed);
        };
    });
    $('#next').onclick = async () => { await Speech.stopSpeaking(); await selectVoice(selected); showSignatureScreen(); };
    await selectVoice(selected);
}

async function selectVoice(voice: string) {
    state.voice = voice;
    state.speed = getTTSVoiceConfig(voice, true).speed;
    store.set(`voice.${state.language}`, voice);
    await Speech.changeVoice(voice);
}

// ---------------------------------------------------------------- voice signature (speaker verification)

const enrollmentFile = () => `${RNFS.DocumentDirectoryPath}/sv_enrollment.json`;

async function showSignatureScreen() {
    const saved = (await RNFS.exists(enrollmentFile())) ? await RNFS.readFile(enrollmentFile()) : null;
    screen(`
      <p class="eyebrow">Step 3 of 4</p><h1>Voice signature</h1>
      <p>Optional. With a voice signature the wake word and the agent respond only to you, and only you can
      unlock the doors.</p>
      <div class="list">
        ${saved ? '<button class="item" id="use"><span>Use my saved signature</span></button>' : ''}
        <button class="item" id="create"><span>Create a new signature</span><span class="badge">${Config.SV_SAMPLE_COUNT} sentences</span></button>
        <button class="item" id="skip"><span>Skip</span></button>
      </div>`);
    if (saved) $('#use').onclick = () => { state.enrollmentJson = saved; showWakeWordScreen(); };
    $('#create').onclick = () => createSignature();
    $('#skip').onclick = () => { state.enrollmentJson = null; showWakeWordScreen(); };
}

async function createSignature() {
    const sentences = enrollmentSentences(state.language, Config.WAKE_WORD_LABEL);
    screen(`<p class="eyebrow">Voice signature</p><h1>Say each sentence</h1>
      <p class="prompt" id="sentence"></p><div class="progress"><div class="bar" id="bar"></div></div>
      <p class="status" id="status">Preparing…</p><button id="cancel" class="secondary wide">Cancel</button>`);
    let cancelled = false;
    $('#cancel').onclick = () => { cancelled = true; };
    const modelPathAbs = await Speech.resolveAsset(Config.SV_MODEL);
    const subs: Array<{ remove: () => Promise<void> }> = [];
    let enrollment: string | null = null;
    let collected = 0;
    let mic: any = null;
    try {
        const micOptions = {
            controllerId: 'enroll',
            config: { modelPath: modelPathAbs, sampleRate: 16000, frameSize: 1280, options: { decisionThreshold: 0.34 } },
        };
        mic = await WakeWord.createSpeakerVerificationMicController(micOptions).catch(async (e: any) => {
            // A controller left over from an interrupted enrollment: replace it.
            if (e?.code !== 'CONTROLLER_EXISTS') throw e;
            await new WakeWord.SpeakerVerificationMicController('enroll').destroy();
            return WakeWord.createSpeakerVerificationMicController(micOptions);
        });
        const done = new Promise<string>((resolve, reject) => {
            void WakeWord.addListener('speakerVerificationOnboardingDone', (e: any) => resolve(e.enrollmentJson ?? e.enrollment ?? e.json)).then((h: any) => subs.push(h));
            void WakeWord.addListener('speakerVerificationError', (e: any) => reject(new Error(e.error ?? e.message ?? 'speaker verification error'))).then((h: any) => subs.push(h));
        });
        void WakeWord.addListener('speakerVerificationOnboardingProgress', (e: any) => {
            collected = Number(e.collected ?? collected);
            ($('#bar') as HTMLElement).style.width = `${Math.round((100 * collected) / Config.SV_SAMPLE_COUNT)}%`;
        }).then((h: any) => subs.push(h));
        await mic.beginOnboarding(SV_SPEAKER_ID, Config.SV_SAMPLE_COUNT, true);
        for (let i = 0; i < Config.SV_SAMPLE_COUNT && !cancelled; i++) {
            $('#sentence').textContent = `“${sentences[i % sentences.length]}”`;
            $('#status').textContent = `Sentence ${i + 1} of ${Config.SV_SAMPLE_COUNT}: speak now`;
            const before = collected;
            await mic.getNextEmbeddingFromMic();
            const t0 = Date.now();
            while (collected <= before && Date.now() - t0 < SV_SAMPLE_TIMEOUT_MS && !cancelled) await sleep(100);
            if (collected <= before && !cancelled) throw new Error(`sample ${i + 1} did not arrive in ${SV_SAMPLE_TIMEOUT_MS / 1000} s`);
        }
        if (!cancelled) {
            $('#status').textContent = 'Creating your signature…';
            enrollment = await Promise.race([done, sleep(30000).then(() => { throw new Error('No signature (timed out)'); })]);
        }
    } catch (error) {
        console.log('[CarAgent] voice signature failed:', String((error as Error)?.message ?? error));
        await showDialog('Voice signature', SV_FAILED, ['OK']);
    } finally {
        // the recorder is always released, also after a failure
        try { await mic?.destroy(); } catch { /* already gone */ }
        for (const s of subs) await s.remove();
    }
    if (enrollment && enrollment.length > 10) {
        await RNFS.writeFile(enrollmentFile(), enrollment);
        state.enrollmentJson = enrollment;
        showWakeWordScreen();
    } else {
        showSignatureScreen();
    }
}

// ---------------------------------------------------------------- wake word

async function ensureWakeWord() {
    if (state.wakeWordReady) return;
    const model = await Speech.resolveAsset(Config.WAKE_WORD_MODEL);
    await WakeWord.create({ instanceId: WW_ID, modelName: model, threshold: Config.WAKE_WORD_THRESHOLD, bufferCount: Config.WAKE_WORD_BUFFER_COUNT });
    await WakeWord.setLicense({ instanceId: WW_ID, license: Config.DAVOICE_LICENSE_KEY });
    await WakeWord.addListener('keywordDetected', (e: any) => {
        if (e.instanceId !== WW_ID) return;
        // In the car the conversation decides: wake it from sleep, or stop the agent (the stop word).
        if (state.inCar && conversation.active) conversation.wakeWord();
        else void onWakeWord();
    });
    state.wakeWordReady = true;
}

async function showWakeWordScreen() {
    state.inCar = false;
    setSpeakerGate(!!state.enrollmentJson, state.enrollmentJson ? SV_SPEAKER_ID : null);
    screen(`
      <p class="eyebrow">Step 4 of 4</p><h1>Say “${esc(Config.WAKE_WORD_LABEL)}”</h1>
      <div class="mic-ring"><div class="mic"></div></div>
      <p class="status" id="status">Starting the wake word…</p>
      <button id="skip" class="secondary wide">Open the car without the wake word</button>
      <button id="back" class="link">Change language</button>`);
    $('#skip').onclick = () => void onWakeWord();
    $('#back').onclick = async () => { await stopListeningEverywhere(); showLanguageScreen(); };
    try {
        if (state.speechStarted) await Speech.pauseSpeechRecognition();
        await ensureWakeWord();
        if (state.wakeWordStarted) {
            // back from the car: the detector is already listening (the conversation unpaused it on leave)
            await WakeWord.resume({ instanceId: WW_ID });
        } else if (state.enrollmentJson) {
            await WakeWord.startWithSpeakers({ instanceId: WW_ID, threshold: Config.WAKE_WORD_THRESHOLD, speakers: [{ id: SV_SPEAKER_ID, json: state.enrollmentJson }] });
        } else {
            await WakeWord.start({ instanceId: WW_ID, threshold: Config.WAKE_WORD_THRESHOLD });
        }
        state.wakeWordStarted = true;
        $('#status').textContent = state.enrollmentJson ? 'Listening for your voice only.' : 'Listening…';
    } catch (error) {
        $('#status').textContent = `Wake word unavailable: ${String((error as Error)?.message ?? error)}`;
    }
    warmUpModel();   // download/load the agent model in the background
}

async function onWakeWord() {
    if (state.inCar) return;
    state.inCar = true;
    // A gentle pause: the detector keeps the microphone; the conversation unpauses it when it waits for the wake word.
    if (state.wakeWordStarted) { try { await WakeWord.pause({ instanceId: WW_ID, stopMicrophone: false }); } catch { /* */ } }
    showCarScreen();
}

async function stopListeningEverywhere() {
    try { await WakeWord.stop({ instanceId: WW_ID }); } catch { /* not started */ }
    state.wakeWordStarted = false;
    if (state.speechStarted) { try { await Speech.pauseSpeechRecognition(); } catch { /* */ } }
}

// ---------------------------------------------------------------- the agent model

function warmUpModel() {
    if (state.provider) return;
    const provider = new LocalLLMProvider('demo_user', Config.DAVOICE_LICENSE_KEY);
    state.provider = provider;
    state.modelStatus = 'Loading…';
    (async () => {
        const selected = await getSelectedModel();
        const wording = selected.toolWording ?? 'v1';
        await provider.setExternalTools(carTools(LOCAL_LLM_CAR_TOOLS, wording), undefined, (tool) => !CAR_TOOL_NAMES.has(tool.name));
        await provider.warmUp(
            [],
            (fraction: number) => updateModelStatus(`Downloading the agent ${Math.round(fraction * 100)}%`),
            () => updateModelStatus('Warming up the agent…'),
        );
        state.modelReady = true;
        updateModelStatus('Ready');
    })().catch((error) => {
        state.provider = null;
        updateModelStatus(`Agent failed to load: ${String(error?.message ?? error)}`);
    });
}

function updateModelStatus(text: string) {
    state.modelStatus = text;
    const el = root.querySelector('#model-status');
    if (el) el.textContent = text;
}

// ---------------------------------------------------------------- conversation (src/rn/conversation)
// Who owns the microphone between requests. Phases: listening (speech recognition open), busy (answering), asleep
// (waiting for the wake word or a tap). Pauses are gentle: speech recognition and the wake word pause and unpause,
// and the microphone keeps running.

let transcript = '';                                   // the request heard so far
let endOfSpeechTimer: ReturnType<typeof setTimeout> | null = null;
let replyEpoch = 0;                                    // bumped when a reply is stopped: its queued sentences are dropped
let spokenThisTurn = '';                               // what the agent has said in this request (the interrupt echo check)

const conversation = new ConversationController(
    {
        openMic: async (preFetchMs, why) => {
            resetTranscript();
            console.log(`[Conversation] openMic (${why}) preFetch ${preFetchMs} ms`);
            await Speech.unPauseSpeechRecognition(-1, preFetchMs);
        },
        closeMic: async (why) => {
            resetTranscript();
            console.log(`[Conversation] closeMic (${why})`);
            await Speech.pauseSpeechRecognition();
        },
        armWakeWord: async () => { if (state.wakeWordStarted) await WakeWord.resume({ instanceId: WW_ID }); },
        disarmWakeWord: async () => { if (state.wakeWordStarted) await WakeWord.pause({ instanceId: WW_ID, stopMicrophone: false }); },
        stopReply: async (why) => {
            console.log(`[Conversation] stop the reply (${why})`);
            replyEpoch++;
            await Speech.stopSpeaking();
        },
        onPhase: () => showConversationHint(),
        log: (message) => console.log(message),
    },
    DEFAULT_CONVERSATION_SETTINGS,
);

function resetTranscript() {
    transcript = '';
    if (endOfSpeechTimer) { clearTimeout(endOfSpeechTimer); endOfSpeechTimer = null; }
    setLive('');
}

/** What was said, without the wake phrase pre-fetched in front of it (the wake-word mode). */
function withoutWakePhrase(text: string): string {
    return state.settings.wakeWord ? dropWakePhrase(text, Config.WAKE_WORD_LABEL) : text.trim();
}

/** A partial or final transcript from speech recognition. The request is sent after the end-of-speech silence. */
function onHeard(text: string) {
    if (!state.inCar || !text.trim()) return;
    const phase = conversation.phase;
    if (phase === 'off' || phase === 'asleep') return;     // asleep: nothing heard counts until the wake word or a tap
    if (state.busy) {
        // the interrupt mode: words the agent isn't saying stop it and start the user's next request; else dropped
        if (!conversation.heardWhileBusy(text, spokenThisTurn)) return;
        transcript = '';
    }
    conversation.userSpeech();
    // iOS sends the whole transcript each time; Android sends segments that are merged
    transcript = Platform.OS === 'android' ? mergeSmartKeepPunct(transcript, text, 2) : text;
    setLive(withoutWakePhrase(transcript));
    if (endOfSpeechTimer) clearTimeout(endOfSpeechTimer);
    // words that cannot end a request ("Set the", "Please") wait longer (src/rn/stt/endOfSpeech.ts)
    const base = endOfSpeechMs(state.settings);
    const wait = silenceFor(withoutWakePhrase(transcript), base, state.language ?? 'en');
    if (wait !== base) console.log(`[AIChat] sounds unfinished, waiting ${wait} ms: "${withoutWakePhrase(transcript)}"`);
    endOfSpeechTimer = setTimeout(sendHeard, wait);
}

function sendHeard() {
    endOfSpeechTimer = null;
    if (state.busy) { endOfSpeechTimer = setTimeout(sendHeard, 300); return; }   // the stopped reply is still ending
    const text = withoutWakePhrase(transcript);
    if (!text) return;   // only the wake phrase so far: the request is still to come
    transcript = '';
    void runTurn(text);
}

function setLive(text: string) { const el = root?.querySelector('#live'); if (el) el.textContent = text; }

function showConversationHint() {
    const el = root?.querySelector<HTMLButtonElement>('#status');
    if (!el || !state.inCar) return;
    const phase = conversation.phase;
    if (phase === 'off') return;
    el.textContent = conversationHint(phase, Config.WAKE_WORD_LABEL, state.settings.wakeWord);
    el.classList.toggle('tappable', conversationTapEnabled(phase));
    if (phase === 'asleep') setLive('');
}

/** New settings: the controller's timeouts and, when interrupting is turned on or off, echo cancellation. */
function applySettings(next: ConversationSettings) {
    const previous = state.settings;
    state.settings = next;
    conversation.update(next);
    console.log('[Conversation] settings', JSON.stringify(next));
    if (previous.interrupt !== next.interrupt) void applyConversationAudio(next);
    void saveConversationSettings(next);
    showConversationHint();
}

/** Echo cancellation for the interrupt mode: the iOS audio routing (speech + wake word) and Android's AEC switch. */
async function applyConversationAudio(settings: ConversationSettings) {
    const routing = routingConfigForConversation(defaultAudioRoutingConfig, settings);
    if (Platform.OS === 'ios') {
        try { await WakeWord.setAudioRoutingConfig({ config: routing }); } catch (e) { console.log('[Conversation] wake word routing failed (ignored):', String(e)); }
        try { await Speech.setAudioRoutingConfig(routing); } catch (e) { console.log('[Conversation] speech routing failed (ignored):', String(e)); }
    } else if (Platform.OS === 'android') {
        try { await Speech.setAECEnabled(settings.interrupt); } catch (e) { console.log('[Conversation] setAECEnabled failed (ignored):', String(e)); }
    }
}

// ---------------------------------------------------------------- car

let unsubscribeCar: (() => void) | null = null;

async function showCarScreen() {
    screen(`
      <div class="car-header"><button id="back" class="link">‹ Back</button><span id="model-status" class="pill">${esc(state.modelStatus)}</span>
        <button class="gear" aria-label="Settings">${GEAR_SVG}</button></div>
      <div id="car" class="car"></div>
      <div class="chat" id="chat"></div>
      <p class="live" id="live"></p>
      <button class="status mic-line" id="status">Opening the microphone…</button>
      <p class="hint">Try: “open the windows”, “set the temperature to 21”, “turn on the seat heating”.</p>`, 'car-screen', false);
    renderCar($('#car'), getCarState());
    unsubscribeCar?.();
    unsubscribeCar = onCarChange(() => { const el = root.querySelector('#car'); if (el) renderCar(el as HTMLElement, getCarState()); });
    $('#back').onclick = () => void leaveCar();
    // the mic line: wakes the conversation when asleep, stops the agent while it answers
    $('#status').onclick = () => { if (conversationTapEnabled(conversation.phase)) conversation.tapToTalk(); };
    // With a voice signature, the results name the verified speakers (speakerIds): the agent lets only the
    // enrolled owner unlock or open the doors (src/rn/speaker_verification/currentSpeaker.ts).
    Speech.onSpeechPartialResults = (e: any) => { noteSpeechResult(e); onHeard(String(e?.value?.[0] ?? '')); };
    Speech.onSpeechResults = (e: any) => { noteSpeechResult(e); onHeard(String(e?.value?.[0] ?? '')); };
    Speech.onSpeechError = (e: any) => console.log('[CarAgent] STT error', JSON.stringify(e));
    const waitForWakeWord = state.settings.wakeWord;
    try {
        if (!state.speechStarted) {
            await Speech.initAll({
                locale: sttLocale(),
                model: modelPath(),
                ...(state.enrollmentJson ? { speakers: [{ id: SV_SPEAKER_ID, json: state.enrollmentJson }] } : {}),
            });
            await Speech.changeVoice(state.voice);
            state.speechStarted = true;
        }
        // Recognition is paused while the app speaks, so it does not hear itself.
        await Speech.pauseSpeechRecognition();
        resetTranscript();
        // Just talk: a greeting the first time, then recognition opens. Wake word before each request: recognition stays
        // paused and the conversation starts asleep (the wake word that opened this screen is not a request).
        if (!waitForWakeWord) {
            if (state.history.length === 0) {
                await say(isPortuguese() ? 'Olá, como posso te ajudar no carro hoje?' : 'Hi! What can I do for you in the car?');
            }
            await Speech.unPauseSpeechRecognition(-1, 0);
        }
        // Android: echo cancellation for the interrupt mode (iOS has it in the routing)
        if (Platform.OS === 'android' && state.settings.interrupt) void applyConversationAudio(state.settings);
        conversation.enter();
        showConversationHint();
    } catch (error) {
        setStatus(`Microphone did not open: ${String((error as Error)?.message ?? error)}`);
    }
}

async function leaveCar() {
    unsubscribeCar?.(); unsubscribeCar = null;
    conversation.leave();            // the wake word listens again on the start screen
    replyEpoch++;
    resetTranscript();
    try { await Speech.stopSpeaking(); } catch { /* */ }
    if (state.speechStarted) { try { await Speech.pauseSpeechRecognition(); } catch { /* */ } }
    await conversation.idle();
    showWakeWordScreen();
}

function setStatus(text: string) { const el = root.querySelector('#status'); if (el) el.textContent = text; }

function addBubble(who: 'user' | 'agent', text: string): HTMLElement {
    const b = document.createElement('div');
    b.className = `bubble ${who}`;
    b.textContent = text;
    $('#chat')?.appendChild(b);
    scrollChat();
    return b;
}

/** Keeps the newest message in view (the chat scrolls; the car and the status stay put). */
function scrollChat() {
    const chat = root.querySelector('#chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
}

/** Speaks one or more sentences. Callers pause speech recognition first so the agent does not hear itself. */
async function say(text: string) {
    if (!text.trim()) return;
    spokenThisTurn += (spokenThisTurn ? ' ' : '') + text;
    await Speech.speak(text, 0, state.speed);
}

async function runTurn(userText: string) {
    if (state.busy || !state.inCar) return;
    state.busy = true;
    conversation.turnStarted();
    const epoch = ++replyEpoch;      // a stopped reply (interrupt, stop word, tap) bumps it: its sentences are dropped
    spokenThisTurn = '';
    const language = state.language ?? 'en';
    resetTranscript();
    addBubble('user', userText);
    const bubble = addBubble('agent', '…');
    try {
        await Speech.pauseSpeechRecognition();
        let aiReply = '';
        let spokenReply = '';
        // Sentences are spoken as soon as they are complete, one after another.
        let speakChain: Promise<void> = Promise.resolve();
        let pending = '';
        // The agent's sentences are checked before they are spoken (as in the React Native app): every real car
        // action is confirmed by the app's own sentence (composeCarSpeech), so a bare "Done." from the model
        // means nothing was done.
        let checkAgentSentences = false;
        let appComposed = new Set<string>();
        const didNotCatch = () => DID_NOT_CATCH[language] ?? basicMessage(language, 'didNotCatch') ?? DID_NOT_CATCH.en;
        const enqueue = (delta: string, flush = false) => {
            pending += delta;
            const { completed, remainder } = splitCompletedSentences(pending);
            const toSay = flush ? [...completed, remainder].filter((s) => s.trim()) : completed;
            pending = flush ? '' : remainder;
            for (const raw of toSay) {
                const sentence = checkAgentSentences && !appComposed.has(raw.trim()) && isBareDone(raw) ? didNotCatch() : raw;
                const text = normalizeTextForSpeech(sentence);   // no markdown read aloud
                if (text) speakChain = speakChain.then(() => (epoch === replyEpoch ? say(text) : undefined)).catch(() => {});
            }
        };
        const musicOn = () => { const s = getCarState(); return (s.media !== null || s.radio !== null) && !s.muted; };
        let carInput: { text: string } | { reply: string } | null = null;
        if (isNoiseFragment(userText) && !normalizeYesNo(userText, language)) {
            // Speech-recognition noise ("The.", "But."): not sent to the agent.
            aiReply = didNotCatch();
            enqueue(aiReply, true);
        } else if ('reply' in (carInput = carTurnInput(userText, language, pendingOfferCalls(), { musicOn: musicOn(), state: getCarState(), lastActed: carTurnActions().length > 0 }))) {
            // The app's own short reply ("never mind" -> "Okay.").
            aiReply = carInput.reply;
            enqueue(aiReply, true);
        } else if (!state.modelReady || !state.provider) {
            const failed = state.modelStatus.startsWith('Agent failed');
            if (!state.provider) warmUpModel();   // not started yet, or the download or load failed: (re)start it
            aiReply = isPortuguese()
                ? (failed ? 'O modelo do carro não carregou; estou tentando de novo. Pergunte de novo em um momento.'
                    : `O modelo do carro ainda está carregando (${state.modelStatus}). Tente de novo em um momento.`)
                : (failed ? "The car's on-device model failed to load, so I am trying again. Please ask me again in a moment."
                    : `The car's on-device model is still loading (${state.modelStatus}). Please ask again in a moment.`);
            enqueue(aiReply, true);
        } else {
            setStatus('Thinking…');
            const agentText = carInput && 'text' in carInput ? carInput.text : userText;
            noteCarUserText(agentText);
            beginCarTurn();
            checkAgentSentences = true;
            let heldSpeech = '';
            let acked = false; let saidFiller = false;
            const ackTimer = setTimeout(() => {
                if (spokenReply.trim() || heldSpeech.trim() || saidFiller) return;
                const ack = carAck(language);
                if (ack) { acked = true; enqueue(ack + ' ', true); }
            }, CAR_ACK_AFTER_MS);
            const turn: any = await state.provider.generateReplyStream(
                state.history, agentText,
                (delta: string, done: boolean) => {
                    if (done || !delta) return;
                    aiReply += delta;
                    bubble.textContent = aiReply;
                    scrollChat();
                    // Once a car action ran, its sentences are held and said together at the end.
                    if (carTurnActions().length > 0) { heldSpeech += delta; return; }
                    spokenReply += delta;
                    enqueue(delta);
                },
                (event: any) => {
                    // "Let me check online…" only when a remote assistant answers (src/rn/aichat/remote.ts);
                    // without one the reply itself says so.
                    if (event?.type !== 'filler' || (event.reason === 'remote' && !REMOTE_ANSWERS_ONLINE)) return;
                    saidFiller = true;
                    enqueue(`${event.text} `, true);
                },
            );
            clearTimeout(ackTimer);
            if (heldSpeech.trim()) {
                const composed = composeCarSpeech(heldSpeech, carTurnActions(), language, { acked, driving: getCarState().driving });
                // Only what the composer added is exempt from the bare "Done." check.
                const held = new Set(splitCompletedSentences(`${heldSpeech.trim()} `).completed);
                appComposed = new Set(splitCompletedSentences(`${composed} `).completed.filter((s) => !held.has(s)));
                spokenReply += (spokenReply.trim() ? ' ' : '') + composed;
                enqueue(composed, true);
            } else {
                enqueue('', true);
            }
            noteCarReply(agentText, aiReply, language);
            if (turn?.scope?.outcome === 'ignore' && !aiReply.trim()) {
                bubble.remove();
            } else {
                state.history = [...state.history,
                    { id: `u-${Date.now()}`, role: 'user', text: agentText } as AIChatHistoryMessage,
                    { id: `m-${Date.now()}`, role: 'model', text: aiReply, ...(turn?.toolMessages ? { toolMessages: turn.toolMessages } : {}) } as AIChatHistoryMessage];
            }
        }
        bubble.textContent = spokenReply.trim() || aiReply || bubble.textContent;
        scrollChat();
        // the reply's voice starts: the interrupt mode listens under it, the stop word can be armed
        conversation.replySpeaking();
        showConversationHint();
        await speakChain;
        noteCarSpoken(spokenReply.trim() || aiReply);
    } catch (error) {
        const message = String((error as Error)?.message ?? error);
        bubble.textContent = message;
        console.log('[CarAgent] turn failed', message);
        if (epoch === replyEpoch) {
            try { await say(isPortuguese() ? 'Desculpe, não deu certo desta vez.' : 'Sorry, something went wrong.'); } catch { /* */ }
        }
    } finally {
        state.busy = false;
        // The conversation mode decides what's next: listen again, or back to the wake word (only a question gets an answer
        // without it). A stopped reply already went back to listening.
        if (state.inCar && epoch === replyEpoch && conversation.active) {
            conversation.replyFinished(spokenThisTurn);
            await conversation.idle();
        }
        showConversationHint();
    }
}

// ---------------------------------------------------------------- settings (the gear)
// The conversation mode, as in the React Native app's settings sheet: nothing changes until Save.

const GEAR_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>`;

function openSettings() {
    if (document.querySelector('.sheet-overlay')) return;
    let draft: ConversationSettings = JSON.parse(JSON.stringify(state.settings));
    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';
    overlay.innerHTML = `
      <div class="sheet" role="dialog" aria-label="Settings">
        <div class="sheet-body">
          <p class="eyebrow">Conversation</p>
          <div id="panel"></div>
          <div class="divider"></div>
          <p class="eyebrow">About</p>
          <div class="setting-row">
            <div><div class="setting-label">Privacy policy</div><div class="caption">davoice.io/privacy/car-agent</div></div>
            <button id="privacy" class="secondary small">Open</button>
          </div>
        </div>
        <div class="sheet-buttons"><button id="cancel" class="secondary">Cancel</button><button id="save" class="primary" disabled>Save</button></div>
      </div>`;
    document.body.appendChild(overlay);
    const q = <T extends HTMLElement>(sel: string) => overlay.querySelector(sel) as T;
    const close = () => overlay.remove();
    const render = () => {
        q('#panel').innerHTML = conversationPanelHtml(draft);
        q<HTMLButtonElement>('#save').disabled = JSON.stringify(draft) === JSON.stringify(state.settings);
        overlay.querySelectorAll<HTMLButtonElement>('[data-set]').forEach((b) => {
            b.onclick = () => { draft = setDraft(draft, b.dataset.set!, b.dataset.value!); render(); };
        });
        overlay.querySelectorAll<HTMLInputElement>('[data-toggle]').forEach((c) => {
            c.onchange = () => { draft = setDraft(draft, c.dataset.toggle!, c.checked ? 'true' : 'false'); render(); };
        });
    };
    render();
    q('#cancel').onclick = close;
    q('#save').onclick = () => { applySettings(draft); close(); };
    // Opens in the browser (Cordova and Capacitor hand pages outside the app to the system).
    q('#privacy').onclick = () => { window.location.href = PRIVACY_POLICY_URL; };
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
}

function setDraft(d: ConversationSettings, key: string, value: string): ConversationSettings {
    const n = JSON.parse(JSON.stringify(d)) as ConversationSettings;
    const num = Number(value);
    switch (key) {
        case 'interrupt': n.interrupt = value === 'true'; break;
        case 'wakeWord': n.wakeWord = value === 'true'; break;
        case 'stopWord': n.wakeWordMode.stopWord = value === 'true'; break;
        case 'wake.endOfSpeechMs': n.wakeWordMode.endOfSpeechMs = num; break;
        case 'wake.listenMs': n.wakeWordMode.listenMs = num; break;
        case 'wake.followUpMs': n.wakeWordMode.followUpMs = num; break;
        case 'wake.preFetchMs': n.wakeWordMode.preFetchMs = num; break;
        case 'free.endOfSpeechMs': n.freeMode.endOfSpeechMs = num; break;
        case 'free.idleMs': n.freeMode.idleMs = num; break;
    }
    return n;
}

function segments(key: string, options: Array<{ value: string; label: string }>, selected: string): string {
    return `<div class="segments" role="radiogroup">${options.map((o) =>
        `<button class="segment ${o.value === selected ? 'on' : ''}" role="radio" aria-checked="${o.value === selected}" data-set="${key}" data-value="${o.value}">${esc(o.label)}</button>`).join('')}</div>`;
}

function choiceRow(key: string, label: string, detail: string, choices: Choice[], value: number): string {
    return `<div class="choice"><div class="setting-label">${esc(label)}</div>
      ${segments(key, choices.map((c) => ({ value: String(c.value), label: c.label })), String(value))}
      <div class="caption">${esc(detail)}</div></div>`;
}

/** The same choices and wording as the React Native ConversationSettingsPanel. */
function conversationPanelHtml(s: ConversationSettings): string {
    const wake = Config.WAKE_WORD_LABEL;
    const w = s.wakeWordMode; const f = s.freeMode;
    const parts = [
        `<div class="setting-label">Turns</div>`,
        segments('interrupt', [{ value: 'false', label: 'Take turns' }, { value: 'true', label: 'Interrupt' }], String(s.interrupt)),
        `<div class="caption">${s.interrupt
            ? `Talk over the agent to stop it. Uses echo cancellation (AEC)${Platform.OS === 'android' ? ', experimental on Android' : ''}.`
            : 'Listening pauses while the agent answers.'}</div>`,
        `<div class="setting-label gap">Start each request with</div>`,
        segments('wakeWord', [{ value: 'true', label: 'Wake word' }, { value: 'false', label: 'Just talk' }], String(s.wakeWord)),
        `<div class="caption">${esc(s.wakeWord
            ? `Say “${wake}” before a request. When the agent asks a question, answer without it.`
            : 'After the first wake word, just talk: no wake word needed.')}</div>`,
    ];
    if (s.wakeWord) {
        parts.push(
            choiceRow('wake.endOfSpeechMs', 'End of speech', 'Silence that ends your request', END_OF_SPEECH_CHOICES, w.endOfSpeechMs),
            choiceRow('wake.listenMs', 'Listen after the wake word', 'Then back to the wake word', LISTEN_CHOICES, w.listenMs),
            choiceRow('wake.followUpMs', 'Follow-up without the wake word',
                w.followUpMs ? 'After a question from the agent, how long it waits for your answer' : 'The wake word before every request, even after a question',
                FOLLOW_UP_CHOICES, w.followUpMs),
            choiceRow('wake.preFetchMs', 'Pre-fetch', w.preFetchMs ? 'Keeps words said right after the wake word' : 'Wait for the recognizer after the wake word',
                PRE_FETCH_CHOICES, w.preFetchMs),
        );
        if (!s.interrupt) {
            parts.push(`<label class="setting-row gap"><div><div class="setting-label">Wake word stops the agent</div>
              <div class="caption">${esc(`“${wake}” while it talks, then your request`)}</div></div>
              <input type="checkbox" class="toggle" data-toggle="stopWord" ${w.stopWord ? 'checked' : ''} aria-label="Wake word stops the agent"></label>`);
        }
    } else {
        parts.push(
            choiceRow('free.endOfSpeechMs', 'End of speech', 'Silence that ends your request', END_OF_SPEECH_CHOICES, f.endOfSpeechMs),
            choiceRow('free.idleMs', 'Stop listening after', f.idleMs ? `Then say “${wake}” or tap the microphone` : 'Listening stays on', IDLE_CHOICES, f.idleMs),
        );
    }
    return parts.join('\n');
}


// ---------------------------------------------------------------- self test (no microphone: simulators, CI)

/** Runs the agent turns without the microphone and logs "CARTEST" lines: language pack, voice, agent model, car tools. */
async function selfTest(commands: string[] | true) {
    const log = (line: string) => { console.log(`CARTEST ${line}`); const p = document.createElement('p'); p.textContent = line; root.appendChild(p); };
    const list = Array.isArray(commands) ? commands : ['open all the windows', 'set the temperature to 23 degrees', 'lock the doors'];
    screen('<h1>Self test</h1>', '', false);
    try {
        state.language = 'en';
        setTTSLanguage('en');
        if (!(await isLanguagePackReady('en'))) {
            let last = -1;
            await downloadLanguagePack('en', (p) => { const pct = Math.round((100 * p.bytesDone) / (p.bytesTotal || 1)); if (pct >= last + 25) { last = pct; log(`language pack ${pct}%`); } });
        }
        await initVoices();
        const voices: string[] = await Speech.getAllVoices();
        await selectVoice(voices.includes('Rich') ? 'Rich' : voices[0]);
        log(`voices ${voices.join(',')}`);
        warmUpModel();
        const t0 = Date.now();
        while (!state.modelReady && Date.now() - t0 < 900000) {
            if (!state.provider) throw new Error(state.modelStatus);
            await sleep(1000);
        }
        log(`model ${state.modelStatus} in ${Math.round((Date.now() - t0) / 1000)} s`);
        state.inCar = true;
        for (const command of list) {
            const t1 = Date.now();
            await runTurn(command);
            const s = getCarState();
            log(`turn "${command}" ${Date.now() - t1} ms -> ${JSON.stringify(state.history.slice(-1)[0]?.text)} | windows=${Object.values(s.windows).join('/')} temp=${s.temperature.driver} locked=${s.locked}`);
        }
        log('CARTEST_DONE ok');
    } catch (error) {
        log(`CARTEST_DONE failed ${String((error as Error)?.message ?? error)}`);
    }
}

// For testing from a debugger (e.g. chrome://inspect): __carAgent.runTurn('open the windows').
(window as any).__carAgent = { state, runTurn, resetCar, getCarState };
