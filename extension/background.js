/* ============================================
   Monster MQT52 Chrome Extension - Background Service Worker
   ============================================ */

// Listen for extension install
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Monster MQT52] Extension installed');
    
    // Set default settings
    chrome.storage.local.get('monsterEQ', (result) => {
        if (!result.monsterEQ) {
            chrome.storage.local.set({
                monsterEQ: {
                    enabled: true,
                    volume: 100,
                    bassBoost: 0,
                    preset: 'flat',
                    eq: {
                        32: 0, 64: 0, 125: 0, 250: 0, 500: 0,
                        1000: 0, 2000: 0, 4000: 0, 8000: 0, 16000: 0
                    }
                }
            });
        }
    });
});

// Listen for tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.includes('youtube.com')) {
        // Content script is already injected via manifest
        console.log('[Monster MQT52] YouTube tab detected');
    }
});
