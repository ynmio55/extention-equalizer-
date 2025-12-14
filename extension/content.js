/* ============================================
   Monster MQT52 Chrome Extension - Content Script
   Injects audio equalizer into YouTube videos
   ============================================ */

console.log('[Monster MQT52] 🎧 Extension loaded on YouTube!');

class YouTubeEqualizer {
    constructor() {
        this.audioContext = null;
        this.sourceNode = null;
        this.gainNode = null;
        this.filters = {};
        this.bassBoostFilter = null;
        this.isInitialized = false;
        this.isEnabled = true;
        this.videoElement = null;
        
        this.frequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        
        this.init();
    }

    init() {
        console.log('[Monster MQT52] Initializing...');
        
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('[Monster MQT52] Message received:', message.type);
            
            // Initialize on first message if not done
            if (!this.isInitialized) {
                this.tryInit();
            }
            
            this.handleMessage(message);
            sendResponse({ received: true, initialized: this.isInitialized });
            return true;
        });

        // Try to initialize when video is ready
        this.waitForVideo();
        
        // Also try on any click
        document.addEventListener('click', () => {
            if (!this.isInitialized) {
                this.tryInit();
            }
        });
    }

    waitForVideo() {
        const check = () => {
            const video = document.querySelector('video');
            if (video) {
                console.log('[Monster MQT52] Video found!');
                this.videoElement = video;
                this.tryInit();
            } else {
                setTimeout(check, 1000);
            }
        };
        check();
        
        // Re-check on page changes (YouTube SPA)
        const observer = new MutationObserver(() => {
            const video = document.querySelector('video');
            if (video && video !== this.videoElement) {
                console.log('[Monster MQT52] New video detected');
                this.videoElement = video;
                this.isInitialized = false;
                this.tryInit();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    tryInit() {
        if (this.isInitialized || !this.videoElement) return;
        
        try {
            console.log('[Monster MQT52] Setting up audio...');
            
            // Create audio context
            this.audioContext = new AudioContext();
            
            // Resume if suspended
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            // Create source from video
            this.sourceNode = this.audioContext.createMediaElementSource(this.videoElement);
            
            // Create gain node
            this.gainNode = this.audioContext.createGain();
            
            // Create bass boost
            this.bassBoostFilter = this.audioContext.createBiquadFilter();
            this.bassBoostFilter.type = 'lowshelf';
            this.bassBoostFilter.frequency.value = 150;
            this.bassBoostFilter.gain.value = 0;
            
            // Create EQ filters
            let lastNode = this.sourceNode;
            this.frequencies.forEach(freq => {
                const filter = this.audioContext.createBiquadFilter();
                filter.type = 'peaking';
                filter.frequency.value = freq;
                filter.Q.value = 1.0;
                filter.gain.value = 0;
                lastNode.connect(filter);
                lastNode = filter;
                this.filters[freq] = filter;
            });
            
            // Connect chain
            lastNode.connect(this.bassBoostFilter);
            this.bassBoostFilter.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);
            
            this.isInitialized = true;
            console.log('[Monster MQT52] ✅ Audio EQ Ready!');
            
            // Load saved settings
            this.loadSettings();
            
        } catch (e) {
            console.log('[Monster MQT52] ❌ Error:', e.message);
            // Video might already have a source attached
            if (e.message.includes('already been')) {
                console.log('[Monster MQT52] Video already has audio processing. Try refreshing the page.');
            }
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'EQ':
                if (this.filters[message.frequency]) {
                    this.filters[message.frequency].gain.value = message.gain;
                    console.log(`[Monster MQT52] EQ ${message.frequency}Hz = ${message.gain}dB`);
                }
                break;
                
            case 'PRESET':
                Object.entries(message.values).forEach(([freq, gain]) => {
                    if (this.filters[freq]) {
                        this.filters[freq].gain.value = gain;
                    }
                });
                console.log('[Monster MQT52] Preset applied');
                break;
                
            case 'VOLUME':
                if (this.gainNode) {
                    this.gainNode.gain.value = message.value;
                    console.log(`[Monster MQT52] Volume = ${Math.round(message.value * 100)}%`);
                }
                break;
                
            case 'BASS_BOOST':
                if (this.bassBoostFilter) {
                    this.bassBoostFilter.gain.value = message.value;
                    console.log(`[Monster MQT52] Bass = ${message.value}dB`);
                }
                break;
                
            case 'RESET':
                this.reset();
                break;
                
            case 'POWER':
                this.isEnabled = message.enabled;
                if (!message.enabled) this.reset();
                break;
        }
    }

    reset() {
        Object.values(this.filters).forEach(f => f.gain.value = 0);
        if (this.gainNode) this.gainNode.gain.value = 1;
        if (this.bassBoostFilter) this.bassBoostFilter.gain.value = 0;
        console.log('[Monster MQT52] Reset');
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get('monsterEQ');
            const s = result.monsterEQ;
            if (!s) return;
            
            if (s.volume && this.gainNode) {
                this.gainNode.gain.value = s.volume / 100;
            }
            if (s.bassBoost && this.bassBoostFilter) {
                this.bassBoostFilter.gain.value = parseFloat(s.bassBoost);
            }
            if (s.eq) {
                Object.entries(s.eq).forEach(([freq, gain]) => {
                    if (this.filters[freq]) {
                        this.filters[freq].gain.value = parseFloat(gain);
                    }
                });
            }
            console.log('[Monster MQT52] Settings loaded');
        } catch (e) {
            console.log('[Monster MQT52] Load settings error:', e);
        }
    }
}

// Start
window.monsterEQ = new YouTubeEqualizer();
