// The parts of 'react-native' the shared car-agent modules use, for a Cordova/Capacitor web view.
import { showDialog } from '../app/dialog';

type OS = 'android' | 'ios' | 'web';

export const Platform = {
    get OS(): OS {
        const id = (window as any).cordova?.platformId;
        return id === 'android' || id === 'ios' ? id : 'web';
    },
    select<T>(spec: { android?: T; ios?: T; default?: T; web?: T }): T | undefined {
        return (spec as any)[Platform.OS] ?? spec.default;
    },
    Version: 0,
};

type AlertButton = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

export const Alert = {
    alert(title: string, message?: string, buttons?: AlertButton[], options?: { cancelable?: boolean; onDismiss?: () => void }): void {
        const list = buttons && buttons.length ? buttons : [{ text: 'OK' }];
        void showDialog(title, message ?? '', list.map((b) => b.text ?? 'OK')).then((index) => {
            if (index < 0) { options?.onDismiss?.(); return; }
            list[index]?.onPress?.();
        });
    },
};

export const Linking = {
    openSettings: async () => { /* no portable way from a web view */ },
    openURL: async (url: string) => { window.open(url, '_system'); },
};

const RESULTS = { GRANTED: 'granted', DENIED: 'denied', NEVER_ASK_AGAIN: 'never_ask_again' } as const;
export const PermissionsAndroid = {
    PERMISSIONS: { RECORD_AUDIO: 'android.permission.RECORD_AUDIO' },
    RESULTS,
    async check(_permission: string): Promise<boolean> {
        const r = await (window as any).DaVoiceWakeWord.checkPermissions({});
        return r.microphone === 'granted';
    },
    async request(_permission: string): Promise<string> {
        const r = await (window as any).DaVoiceWakeWord.requestPermissions({});
        return r.microphone === 'granted' ? RESULTS.GRANTED : RESULTS.DENIED;
    },
};

type AppStateListener = (state: 'active' | 'background') => void;
export const AppState = {
    get currentState(): 'active' | 'background' { return document.visibilityState === 'visible' ? 'active' : 'background'; },
    addEventListener(_type: 'change', listener: AppStateListener) {
        const onPause = () => listener('background');
        const onResume = () => listener('active');
        document.addEventListener('pause', onPause);
        document.addEventListener('resume', onResume);
        return { remove: () => { document.removeEventListener('pause', onPause); document.removeEventListener('resume', onResume); } };
    },
};

// Share (src/rn/wakeword shares recordings in the React Native app's debug tools): the web share sheet when there is one.
export const Share = {
    share: async (content: { message?: string; url?: string; title?: string }) => {
        const nav = navigator as any;
        if (typeof nav.share === 'function') await nav.share({ title: content.title, text: content.message, url: content.url });
        return { action: 'sharedAction' };
    },
};

// No app-specific native modules in this app (the React Native example's own recorder/share modules).
export const NativeModules: Record<string, any> = {};

export const DeviceEventEmitter = {
    addListener: () => ({ remove() {} }),
};

// iOS web views have no requestIdleCallback (the modules use it to wait for the UI).
if (typeof (globalThis as any).requestIdleCallback !== 'function') {
    (globalThis as any).requestIdleCallback = (cb: () => void, opts?: { timeout?: number }) =>
        setTimeout(cb, Math.min(opts?.timeout ?? 50, 50));
}

export default { Platform, Alert, Linking, PermissionsAndroid, AppState, NativeModules, DeviceEventEmitter, Share };
