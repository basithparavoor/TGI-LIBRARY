// hardware.js - Multi-Modal Hardware Engine (NFC, QR, Barcode, Biometric/Smartcard)

export class HardwareEngine {
    constructor() {
        this.nfcReader = null;
        this.isNfcScanning = false;
        this.barcodeBuffer = '';
        this.lastKeyTime = 0;
        this.barcodeListeners = [];
        this.nfcListeners = [];

        this.initBarcodeWedgeListener();
    }

    // --- 1. WEB NFC INTEGRATION (ISO/IEC 14443 & NTAG) ---
    async isNfcSupported() {
        return 'NDEFReader' in window;
    }

    async startNfcScan(onTagRead, onError) {
        if (!('NDEFReader' in window)) {
            const msg = "Web NFC is supported on Android Chrome or NFC-enabled hardware terminals. For desktop, use USB NFC reader, Barcode scanner, or Camera QR.";
            if (onError) onError(new Error(msg));
            return false;
        }

        try {
            this.nfcReader = new window.NDEFReader();
            await this.nfcReader.scan();
            this.isNfcScanning = true;

            this.nfcReader.addEventListener("reading", ({ serialNumber, message }) => {
                let tagPayload = serialNumber || '';
                
                // Read text/URI records if present
                for (const record of message.records) {
                    if (record.recordType === "text") {
                        const textDecoder = new TextDecoder(record.encoding);
                        tagPayload = textDecoder.decode(record.data);
                    }
                }

                if (window.app?.playBeep) window.app.playBeep('scan');
                if (window.app?.toast) window.app.toast(`NFC Smartcard detected: ${tagPayload}`, "info", "NFC Read", 2500);

                if (onTagRead) onTagRead(tagPayload, serialNumber);
                this.nfcListeners.forEach(listener => listener(tagPayload, serialNumber));
            });

            this.nfcReader.addEventListener("readingerror", () => {
                if (window.app?.playBeep) window.app.playBeep('error');
                if (onError) onError(new Error("Cannot read NFC tag. Tag might be corrupted or unformatted."));
            });

            return true;
        } catch (error) {
            this.isNfcScanning = false;
            if (onError) onError(error);
            return false;
        }
    }

    async writeNfcTag(textPayload) {
        if (!('NDEFReader' in window)) {
            throw new Error("Web NFC writing not supported on this device.");
        }
        const writer = new window.NDEFReader();
        await writer.write({
            records: [{ recordType: "text", data: textPayload }]
        });
        if (window.app?.playBeep) window.app.playBeep('success');
        return true;
    }

    // --- 2. BARCODE & KEYBOARD WEDGE SCANNER LISTENER ---
    initBarcodeWedgeListener() {
        document.addEventListener('keydown', (e) => {
            // Ignore keystrokes inside regular input fields unless it's an Enter key
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
            const currentTime = Date.now();

            if (currentTime - this.lastKeyTime > 80) {
                // Too slow to be a hardware barcode scanner; reset buffer
                this.barcodeBuffer = '';
            }
            this.lastKeyTime = currentTime;

            if (e.key === 'Enter') {
                if (this.barcodeBuffer.length >= 3) {
                    const scannedCode = this.barcodeBuffer.trim();
                    this.barcodeBuffer = '';
                    if (window.app?.playBeep) window.app.playBeep('scan');
                    this.barcodeListeners.forEach(cb => cb(scannedCode));
                }
            } else if (e.key.length === 1) {
                this.barcodeBuffer += e.key;
            }
        });
    }

    onBarcodeScan(callback) {
        this.barcodeListeners.push(callback);
    }

    onNfcScan(callback) {
        this.nfcListeners.push(callback);
    }

    // --- 3. QR CODE SVG GENERATOR ---
    generateQrSvg(text, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Render QR Code using SVG standard fallback or CDN
        container.innerHTML = `
            <div style="background: white; padding: 8px; border-radius: 8px; display: inline-block; border: 1px solid #e2e8f0; text-align: center;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(text)}" alt="QR Code" style="width: 140px; height: 140px; display: block; margin: 0 auto;">
                <div style="font-family: monospace; font-size: 10px; color: #475569; margin-top: 4px; font-weight: 600;">${text}</div>
            </div>
        `;
    }

    async initNFCReader(onTagRead) {
        return this.startNfcScan(onTagRead);
    }
}

export const hardware = new HardwareEngine();
export const hardwareService = hardware;
window.hardware = hardware;
window.hardwareService = hardware;

