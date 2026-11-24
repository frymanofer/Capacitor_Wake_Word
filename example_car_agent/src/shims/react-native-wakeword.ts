// 'react-native-wakeword' -> cordova-wake-word / capacitor-wake-word. The React Native API (positional
// arguments, KeyWordRNBridgeInstance, speaker-verification helpers) on top of the plugin's
// options-object API, so the shared car-agent modules run unchanged. docs/api.md in the plugin maps both.
const W = () => (window as any).DaVoiceWakeWord;

export type AudioRoutingConfig = any;

export class KeyWordRNBridgeInstance {
    instanceId: string;
    isSticky: boolean;
    listeners: Array<{ remove: () => void }> = [];

    constructor(instanceId: string, isSticky: boolean) {
        this.instanceId = instanceId;
        this.isSticky = isSticky;
    }

    async createInstance(modelName: string, threshold: number, bufferCnt: number) {
        await W().create({ instanceId: this.instanceId, modelName, threshold, bufferCount: bufferCnt });
        return `Instance created with ID: ${this.instanceId}`;
    }
    async createInstanceMulti(modelNames: string[], thresholds: number[], bufferCnts: number[], msBetweenCallbacks: number[]) {
        await W().createMulti({ instanceId: this.instanceId, modelNames, thresholds, bufferCounts: bufferCnts, millisecondsBetweenCallbacks: msBetweenCallbacks });
        return `Multi-model instance created with ID: ${this.instanceId}`;
    }
    async setKeywordDetectionLicense(license: string) { return (await W().setLicense({ instanceId: this.instanceId, license })).licensed; }
    async setKeywordLicense(license: string) { return this.setKeywordDetectionLicense(license); }
    async replaceKeywordDetectionModel(modelName: string, threshold: number, bufferCnt: number) {
        return W().replaceModel({ instanceId: this.instanceId, modelName, threshold, bufferCount: bufferCnt });
    }
    /** (threshold, enrollmentJsonOrPath | setActive?, setActive?, duckOthers?, mixWithOthers?, defaultToSpeaker?) */
    async startKeywordDetection(threshold: number, enrollmentOrSetActive?: string | boolean, setActive?: boolean,
        duckOthers?: boolean, mixWithOthers?: boolean, defaultToSpeaker?: boolean) {
        const enrollment = typeof enrollmentOrSetActive === 'string' && enrollmentOrSetActive ? enrollmentOrSetActive : null;
        const active = typeof enrollmentOrSetActive === 'boolean' ? enrollmentOrSetActive : setActive;
        return W().start({
            instanceId: this.instanceId, threshold, speakerVerificationEnrollmentJsonOrPath: enrollment,
            ...(active !== undefined ? { noExternalActivation: active } : {}),
            ...(duckOthers !== undefined ? { duckOthers } : {}),
            ...(mixWithOthers !== undefined ? { mixWithOthers } : {}),
            ...(defaultToSpeaker !== undefined ? { defaultToSpeaker } : {}),
        });
    }
    async startKeywordDetectionWithSpeakerId(threshold: number, enrollment: string, speakerId = 'default') {
        return W().startWithSpeakerId({ instanceId: this.instanceId, threshold, speakerVerificationEnrollmentJsonOrPath: enrollment, speakerId });
    }
    async startKeywordDetectionWithSpeakers(threshold: number, speakers: { id: string; json: string }[]) {
        return W().startWithSpeakers({ instanceId: this.instanceId, threshold, speakers });
    }
    async addSpeaker(speakerId: string, jsonOrPath: string): Promise<string[]> {
        return (await W().addSpeaker({ instanceId: this.instanceId, speakerId, jsonOrPath })).speakerIds;
    }
    async setSpeakers(speakers: { id: string; json: string }[]): Promise<string[]> {
        return (await W().setSpeakers({ instanceId: this.instanceId, speakers })).speakerIds;
    }
    async removeSpeaker(speakerId: string): Promise<boolean> { return (await W().removeSpeaker({ instanceId: this.instanceId, speakerId })).removed; }
    async getSpeakerIds(): Promise<string[]> { return (await W().getSpeakerIds({ instanceId: this.instanceId })).speakerIds; }
    async setDetectionAudioRecording(enabled: boolean) { return (await W().setDetectionAudioRecording({ instanceId: this.instanceId, enabled })).enabled; }
    async isDetectionAudioRecordingEnabled() { return (await W().isDetectionAudioRecordingEnabled({ instanceId: this.instanceId })).enabled; }
    async getRecordingWav() { return (await W().getRecordingWav({ instanceId: this.instanceId })).path ?? ''; }
    async getRecordingWavArray() { return (await W().getRecordingWavArray({ instanceId: this.instanceId })).paths ?? []; }
    async stopKeywordDetection() { return W().stop({ instanceId: this.instanceId }); }
    async pauseDetection(stopMic = false) { return W().pause({ instanceId: this.instanceId, stopMicrophone: stopMic }); }
    async unPauseDetection() { return W().resume({ instanceId: this.instanceId }); }
    async setTTSActive(active: boolean) { return W().setTtsActive({ instanceId: this.instanceId, active }); }
    async getVoiceProps() { return W().getVoiceProps({ instanceId: this.instanceId }); }
    async setVADParams(threshold: number, msWindow: number) { return W().setVadParameters({ instanceId: this.instanceId, threshold, millisecondsWindow: msWindow }); }
    async getVADParams() { return W().getVadParameters({ instanceId: this.instanceId }); }
    async startVADDetection() { return W().startVad({ instanceId: this.instanceId }); }
    async stopVADDetection() { return W().stopVad({ instanceId: this.instanceId }); }
    async startSilentVADDetection() { return W().startSilentVad({ instanceId: this.instanceId }); }
    async stopSilentVADDetection() { return W().stopSilentVad({ instanceId: this.instanceId }); }
    async destroyInstance() { this.removeListeners(); return W().destroy({ instanceId: this.instanceId }); }

    /** The React Native event: { instanceId, phrase, modelName, speakerId? } for this instance. */
    onKeywordDetectionEvent(callback: (event: any) => void) {
        let handle: { remove: () => Promise<void> } | null = null;
        let removed = false;
        void W().addListener('keywordDetected', (e: any) => { if (e.instanceId === this.instanceId) callback(e); })
            .then((h: any) => { handle = h; if (removed) void h.remove(); });
        const sub = { remove: () => { removed = true; if (handle) void handle.remove(); } };
        this.listeners.push(sub);
        return sub;
    }
    onVADDetectionEvent(_callback: (event: any) => void) { return { remove() {} }; }
    removeListeners() { this.listeners.forEach((l) => l.remove()); this.listeners = []; }
}

export async function createKeyWordRNBridgeInstance(instanceId: string, isSticky: boolean) {
    return new KeyWordRNBridgeInstance(instanceId, isSticky);
}
export async function removeAllRNBridgeListeners() { await W().removeAllListeners(); }
export async function pauseDetection(instanceId: string, stopMic = false) { return W().pause({ instanceId, stopMicrophone: stopMic }); }
export async function unPauseDetection(instanceId: string) { return W().resume({ instanceId }); }
export async function setWakewordAudioRoutingConfig(config: AudioRoutingConfig) { return W().setAudioRoutingConfig({ config }); }
export async function enableDucking() { await W().enableDucking(); }
export async function disableDucking() { await W().disableDucking(); }
export async function restartListeningAfterDucking() { await W().restartListeningAfterDucking(); }
export async function initAudioSessAndDuckManage() { await W().initAudioSessionAndDuckManager(); }
export async function disableDuckingAndCleanup() { await W().disableDuckingAndCleanup(); }
export async function hasIOSMicPermissions() { return (await W().checkPermissions({})).microphone === 'granted'; }
export async function requestIOSMicPermissions(_waitTimeout?: number) { return (await W().requestPermissions({})).microphone === 'granted'; }
export async function hasIOSSpeechRecognitionPermissions() { return (window as any).DaVoiceSpeech.hasIOSSpeechRecognitionPermissions(); }
export async function requestIOSSpeechRecognitionPermissions(waitTimeout = 30000) {
    return (window as any).DaVoiceSpeech.requestIOSSpeechRecognitionPermissions(waitTimeout);
}

// ---------- speaker verification ----------

export class SpeakerVerificationRNBridgeInstance {
    engineId: string;
    private verifier: any = null;
    constructor(engineId: string) { this.engineId = engineId; }
    async create(modelPathOrName: string, enrollmentJsonPathOrName: string, options: Record<string, unknown> = {}) {
        const isJson = typeof enrollmentJsonPathOrName === 'string' && enrollmentJsonPathOrName.trim().startsWith('{');
        this.verifier = await W().createSpeakerVerifier({
            engineId: this.engineId, modelPath: modelPathOrName,
            ...(isJson ? { enrollmentJson: enrollmentJsonPathOrName } : { enrollmentJsonPath: enrollmentJsonPathOrName }),
            options,
        });
        return { ok: true, engineId: this.engineId };
    }
    async verifyWavStreaming(wavPathOrName: string, resetState = true) { return this.verifier.verifyWav(wavPathOrName, resetState); }
    async destroy() { return this.verifier?.destroy(); }
}
export async function createSpeakerVerificationInstance(engineId: string) { return new SpeakerVerificationRNBridgeInstance(engineId); }

export class SpeakerVerificationMicController {
    controllerId: string;
    private ctrl: any = null;
    constructor(controllerId: string) { this.controllerId = controllerId; }
    async create(configJson: string) {
        // A previous screen may have left a controller with this id: replace it.
        try { await W().createSpeakerVerificationMicController({ controllerId: this.controllerId, config: configJson }); }
        catch (e: any) {
            if (e?.code !== 'CONTROLLER_EXISTS') throw e;
            await new (W().SpeakerVerificationMicController)(this.controllerId).destroy().catch(() => {});
            await W().createSpeakerVerificationMicController({ controllerId: this.controllerId, config: configJson });
        }
        this.ctrl = new (W().SpeakerVerificationMicController)(this.controllerId);
        return { ok: true, controllerId: this.controllerId };
    }
    beginOnboarding(enrollmentId: string, targetEmbeddingCount: number, reset = true) { return this.ctrl.beginOnboarding(enrollmentId, targetEmbeddingCount, reset); }
    getNextEmbeddingFromMic() { return this.ctrl.getNextEmbeddingFromMic(); }
    finalizeOnboardingNow() { return this.ctrl.finalizeOnboardingNow(); }
    setEnrollmentJson(json: string) { return this.ctrl.setEnrollmentJson(json); }
    startVerifyFromMic(resetState = true) { return this.ctrl.startVerifyFromMic(resetState); }
    startEndlessVerifyFromMic(hopSeconds = 2.0, stopOnMatch = false, resetState = true) { return this.ctrl.startEndlessVerifyFromMic(hopSeconds, stopOnMatch, resetState); }
    stop() { return this.ctrl.stop(); }
    destroy() { return this.ctrl.destroy(); }
}
export async function createSpeakerVerificationMicController(controllerId: string) { return new SpeakerVerificationMicController(controllerId); }

function on(eventName: string, cb: (e: any) => void): () => void {
    let handle: any = null; let removed = false;
    void W().addListener(eventName, cb).then((h: any) => { handle = h; if (removed) void h.remove(); });
    return () => { removed = true; if (handle) void handle.remove(); };
}
export const onSpeakerVerificationOnboardingProgress = (cb: (e: any) => void) => on('speakerVerificationOnboardingProgress', cb);
export const onSpeakerVerificationOnboardingDone = (cb: (e: any) => void) => on('speakerVerificationOnboardingDone', cb);
export const onSpeakerVerificationVerifyResult = (cb: (e: any) => void) => on('speakerVerificationVerifyResult', cb);
export const onSpeakerVerificationError = (cb: (e: any) => void) => on('speakerVerificationError', cb);
