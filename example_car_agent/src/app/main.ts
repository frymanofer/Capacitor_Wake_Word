// Boot: wait for Cordova / Capacitor, read the app's directories (the shared modules read
// RNFS.DocumentDirectoryPath when they load), then load and start the app.
declare const require: (id: string) => any;   // esbuild bundles it

document.addEventListener('deviceready', async () => {
    const root = document.getElementById('app')!;
    try {
        const paths = await (window as any).DaVoiceSpeech.files.paths();
        (globalThis as any).__DV_DOCS__ = paths.documentDirectory;
        (globalThis as any).__DV_CACHES__ = paths.cachesDirectory;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { startApp } = require('./app');
        await startApp(root);
    } catch (error) {
        root.innerHTML = `<div class="screen"><h1>Could not start</h1><p class="error">${String((error as Error)?.message ?? error)}</p></div>`;
        console.error('[CarAgent] boot failed', error);
    }
}, false);
