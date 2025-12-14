/* ============================================
   Monster MQT52 Chrome Extension - Popup Script
   ============================================ */

class PopupController {
    constructor() {
        this.frequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        this.presets = {
            flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            bass: [8, 6, 4, 2, 0, 0, 0, 0, 0, 0],
            treble: [0, 0, 0, 0, 0, 2, 4, 6, 8, 10],
            vocal: [-2, -2, 0, 4, 6, 6, 4, 2, 0, -2],
            gaming: [6, 4, 0, -2, 0, 2, 4, 6, 4, 2],
            movie: [6, 8, 4, 0, -2, 0, 2, 4, 6, 8],
            pop: [2, 4, 6, 4, 0, -2, -2, 0, 2, 4],
            rock: [6, 4, 2, 0, -2, 0, 2, 4, 6, 6]
        };
        this.isEnabled = true;
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.checkYouTube();
    }

    setupEventListeners() {
        // Power toggle
        document.getElementById('togglePower').addEventListener('change', (e) => {
            this.isEnabled = e.target.checked;
            this.updatePowerState();
            this.sendToContent({ type: 'POWER', enabled: this.isEnabled });
            this.saveSettings();
        });

        // Presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.applyPreset(btn.dataset.preset);
            });
        });

        // EQ sliders
        document.querySelectorAll('.eq-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const freq = parseInt(e.target.dataset.freq);
                const value = parseInt(e.target.value);
                this.updateEQDisplay(slider, value);
                this.sendToContent({ type: 'EQ', frequency: freq, gain: value });
                
                // Deselect presets
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                this.saveSettings();
            });
        });

        // Volume slider
        document.getElementById('volumeSlider').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('volumeValue').textContent = `${value}%`;
            this.sendToContent({ type: 'VOLUME', value: value / 100 });
            this.saveSettings();
        });

        // Bass boost slider
        document.getElementById('bassBoostSlider').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('bassBoostValue').textContent = `${value}dB`;
            this.sendToContent({ type: 'BASS_BOOST', value: value });
            this.saveSettings();
        });

        // Reset button
        document.getElementById('btnReset').addEventListener('click', () => {
            this.resetAll();
        });
    }

    updatePowerState() {
        const container = document.querySelector('.popup-container');
        const statusBar = document.getElementById('statusBar');
        const statusText = document.getElementById('statusText');

        if (this.isEnabled) {
            container.classList.remove('disabled');
            statusBar.classList.remove('inactive');
            statusText.textContent = 'พร้อมใช้งาน';
        } else {
            container.classList.add('disabled');
            statusBar.classList.add('inactive');
            statusText.textContent = 'ปิดใช้งาน';
        }
    }

    updateEQDisplay(slider, value) {
        const band = slider.closest('.eq-band');
        const valueLabel = band.querySelector('.eq-value');
        valueLabel.textContent = value > 0 ? `+${value}` : value;
    }

    applyPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset) return;

        const sliders = document.querySelectorAll('.eq-slider');
        sliders.forEach((slider, index) => {
            slider.value = preset[index];
            this.updateEQDisplay(slider, preset[index]);
        });

        // Send all EQ values to content script
        this.sendToContent({ 
            type: 'PRESET', 
            values: this.frequencies.reduce((acc, freq, i) => {
                acc[freq] = preset[i];
                return acc;
            }, {})
        });
        
        this.saveSettings();
    }

    resetAll() {
        // Reset EQ
        document.querySelectorAll('.eq-slider').forEach(slider => {
            slider.value = 0;
            this.updateEQDisplay(slider, 0);
        });

        // Reset volume
        const volumeSlider = document.getElementById('volumeSlider');
        volumeSlider.value = 100;
        document.getElementById('volumeValue').textContent = '100%';

        // Reset bass boost
        const bassSlider = document.getElementById('bassBoostSlider');
        bassSlider.value = 0;
        document.getElementById('bassBoostValue').textContent = '0dB';

        // Reset preset
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-preset="flat"]').classList.add('active');

        // Send reset to content
        this.sendToContent({ type: 'RESET' });
        this.saveSettings();
    }

    async sendToContent(message) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url?.includes('youtube.com')) {
                chrome.tabs.sendMessage(tab.id, message);
            }
        } catch (error) {
            console.log('Could not send message to content script');
        }
    }

    async checkYouTube() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const statusText = document.getElementById('statusText');
            const statusBar = document.getElementById('statusBar');

            if (tab && tab.url?.includes('youtube.com')) {
                statusText.textContent = 'เชื่อมต่อ YouTube แล้ว';
            } else {
                statusText.textContent = 'กรุณาเปิด YouTube';
                statusBar.classList.add('inactive');
            }
        } catch (error) {
            console.log('Could not check tab');
        }
    }

    async saveSettings() {
        const settings = {
            enabled: this.isEnabled,
            volume: document.getElementById('volumeSlider').value,
            bassBoost: document.getElementById('bassBoostSlider').value,
            eq: {}
        };

        document.querySelectorAll('.eq-slider').forEach(slider => {
            settings.eq[slider.dataset.freq] = slider.value;
        });

        // Get active preset
        const activePreset = document.querySelector('.preset-btn.active');
        if (activePreset) {
            settings.preset = activePreset.dataset.preset;
        }

        await chrome.storage.local.set({ monsterEQ: settings });
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get('monsterEQ');
            const settings = result.monsterEQ;

            if (!settings) return;

            // Power
            this.isEnabled = settings.enabled !== false;
            document.getElementById('togglePower').checked = this.isEnabled;
            this.updatePowerState();

            // Volume
            if (settings.volume) {
                document.getElementById('volumeSlider').value = settings.volume;
                document.getElementById('volumeValue').textContent = `${settings.volume}%`;
            }

            // Bass boost
            if (settings.bassBoost) {
                document.getElementById('bassBoostSlider').value = settings.bassBoost;
                document.getElementById('bassBoostValue').textContent = `${settings.bassBoost}dB`;
            }

            // EQ
            if (settings.eq) {
                Object.entries(settings.eq).forEach(([freq, value]) => {
                    const slider = document.querySelector(`.eq-slider[data-freq="${freq}"]`);
                    if (slider) {
                        slider.value = value;
                        this.updateEQDisplay(slider, parseInt(value));
                    }
                });
            }

            // Preset
            if (settings.preset) {
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                const presetBtn = document.querySelector(`[data-preset="${settings.preset}"]`);
                if (presetBtn) presetBtn.classList.add('active');
            }
        } catch (error) {
            console.log('Could not load settings');
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});
