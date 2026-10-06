'use strict';
(() => {
    const installButton = document.getElementById('pwa-install');
    const updateButton = document.getElementById('pwa-update');
    const status = document.getElementById('pwa-status');
    const help = document.getElementById('pwa-help');
    let installPrompt = null;
    let registration = null;
    let offlineReady = false;
    let updating = false;
    let reloading = false;
    const standalone = window.matchMedia('(display-mode: standalone)');
    const isInstalled = () => standalone.matches || window.navigator.standalone === true;

    function showStatus() {
        help.hidden = isInstalled();
        if (isInstalled()) installButton.hidden = true;
        if (!navigator.onLine) {
            status.textContent = offlineReady ? 'オフラインで あそべます。'
                : 'オフラインです。初回はインターネットに接続して開いてください。';
        } else if (offlineReady) {
            status.textContent = 'オフラインでも あそべる準備ができました。';
        } else {
            status.textContent = 'オフラインの準備をしています…';
        }
    }
    window.addEventListener('online', showStatus);
    window.addEventListener('offline', showStatus);
    if (standalone.addEventListener) standalone.addEventListener('change', showStatus);
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        installPrompt = event;
        installButton.hidden = isInstalled();
    });
    installButton.addEventListener('click', async () => {
        if (!installPrompt) return;
        const prompt = installPrompt;
        installButton.disabled = true;
        try {
            await prompt.prompt();
            await prompt.userChoice;
        } catch (error) {
            console.warn('インストールを開始できませんでした。', error);
        } finally {
            installPrompt = null;
            installButton.hidden = true;
            installButton.disabled = false;
        }
    });
    window.addEventListener('appinstalled', () => {
        installPrompt = null;
        installButton.hidden = true;
        help.hidden = true;
    });
    function showUpdate() {
        if (!registration || !registration.waiting) return;
        updateButton.hidden = false;
        updateButton.disabled = false;
        updateButton.textContent = '最新版に更新';
    }
    updateButton.addEventListener('click', () => {
        if (!registration || !registration.waiting) return;
        updating = true;
        updateButton.disabled = true;
        updateButton.textContent = '更新しています…';
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
    showStatus();
    if (!('serviceWorker' in navigator) || !window.isSecureContext || location.protocol === 'file:') {
        status.textContent = 'ホーム画面への追加・オフライン対応には、HTTPSのURLで開いてください（動作確認はlocalhostでも可能です）。';
        return;
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Another tab may accept the update. Existing controlled tabs reload once.
        if ((updating || offlineReady) && !reloading) {
            reloading = true;
            window.location.reload();
        }
    });
    (async () => {
        try {
            registration = await navigator.serviceWorker.register('./sw.js', {
                scope: './', updateViaCache: 'none'
            });
            showUpdate();
            registration.addEventListener('updatefound', () => {
                const worker = registration.installing;
                if (!worker) return;
                worker.addEventListener('statechange', () => {
                    if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
                    if (worker.state === 'redundant' && !offlineReady) {
                        status.textContent = 'オフラインの準備ができませんでした。通信を確認して開き直してください。';
                    }
                });
            });
            await navigator.serviceWorker.ready;
            offlineReady = true;
            showStatus();
            // Recheck on returning to the app, as well as on each new load.
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && navigator.onLine) {
                    registration.update().catch(() => {});
                }
            });
        } catch (error) {
            console.warn('オフラインの準備ができませんでした。', error);
            status.textContent = 'オフラインの準備ができませんでした。通信を確認して開き直してください。';
        }
    })();
})();
