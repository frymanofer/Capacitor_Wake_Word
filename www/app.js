'use strict';

document.addEventListener('deviceready', onDeviceReady, false);

async function onDeviceReady() {
    const status = document.getElementById('status');

    try {
        const result = await window.DaVoiceWakeWord.ping({});
        await window.DaVoiceWakeWord.create({
            instanceId: 'capacitor-example',
            modelName: 'hey_lookdeep.dm',
            threshold: 0.99,
            bufferCount: 2
        });
        await window.DaVoiceWakeWord.destroy({ instanceId: 'capacitor-example' });

        status.textContent = `Native detector ready: ${result.status} (${result.platform})`;
        status.classList.add('success');
    } catch (error) {
        status.textContent = `Native wake word bridge failed: ${error.message || error}`;
        status.classList.add('error');
        console.error('Wake word example failed', error);
    }
}
