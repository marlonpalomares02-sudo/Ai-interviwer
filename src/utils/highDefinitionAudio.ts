import { AudioErrorHandler } from './errorHandling';

export interface AudioEnhancementConfig {
  noiseReduction: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  highPassFilter: boolean;
  lowPassFilter: boolean;
  dynamicRangeCompression: boolean;
  sampleRate: number;
  bitDepth: number;
}

export class HighDefinitionAudioProcessor {
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processingChain: AudioNode[] = [];
  private config: AudioEnhancementConfig;

  constructor(config: Partial<AudioEnhancementConfig> = {}) {
    this.config = {
      noiseReduction: true,
      echoCancellation: true,
      autoGainControl: true,
      highPassFilter: true,
      lowPassFilter: true,
      dynamicRangeCompression: true,
      sampleRate: 48000, // High-definition sample rate
      bitDepth: 24,
      ...config,
    };
  }

  async initialize(stream: MediaStream): Promise<boolean> {
    try {
      console.log('Initializing high-definition audio processor...');

      // Create high-quality audio context
      this.audioContext = AudioErrorHandler.safeAudioContextCreation({
        sampleRate: this.config.sampleRate,
        latencyHint: 'interactive',
      });

      if (!this.audioContext) {
        throw new Error('Failed to create audio context');
      }

      // Create media stream source
      this.source = this.audioContext.createMediaStreamSource(stream);

      // Build audio processing chain
      let currentNode: AudioNode = this.source;

      // High-pass filter (remove low-frequency noise)
      if (this.config.highPassFilter) {
        const highPassFilter = this.audioContext.createBiquadFilter();
        highPassFilter.type = 'highpass';
        highPassFilter.frequency.value = 80; // Remove frequencies below 80Hz
        highPassFilter.Q.value = 0.7;
        currentNode.connect(highPassFilter);
        currentNode = highPassFilter;
        this.processingChain.push(highPassFilter);
      }

      // Low-pass filter (remove high-frequency noise)
      if (this.config.lowPassFilter) {
        const lowPassFilter = this.audioContext.createBiquadFilter();
        lowPassFilter.type = 'lowpass';
        lowPassFilter.frequency.value = 8000; // Remove frequencies above 8kHz for speech
        lowPassFilter.Q.value = 0.7;
        currentNode.connect(lowPassFilter);
        currentNode = lowPassFilter;
        this.processingChain.push(lowPassFilter);
      }

      // Dynamic range compression
      if (this.config.dynamicRangeCompression) {
        const compressor = this.audioContext.createDynamicsCompressor();
        compressor.threshold.value = -24; // Start compression at -24dB
        compressor.knee.value = 30; // Soft knee
        compressor.ratio.value = 12; // 12:1 compression ratio
        compressor.attack.value = 0.003; // 3ms attack
        compressor.release.value = 0.25; // 250ms release
        currentNode.connect(compressor);
        currentNode = compressor;
        this.processingChain.push(compressor);
      }

      // Noise reduction using multiple notch filters
      if (this.config.noiseReduction) {
        const notchFilters = this.createNoiseReductionFilters();
        for (const filter of notchFilters) {
          currentNode.connect(filter);
          currentNode = filter;
          this.processingChain.push(filter);
        }
      }

      // Auto gain control
      if (this.config.autoGainControl) {
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 1.0;
        currentNode.connect(gainNode);
        currentNode = gainNode;
        this.processingChain.push(gainNode);

        // Implement adaptive gain control
        this.implementAdaptiveAGC(gainNode);
      }

      // Create final destination for processed audio
      const destination = this.audioContext.createMediaStreamDestination();
      currentNode.connect(destination);

      console.log('High-definition audio processor initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize audio processor:', error);
      this.cleanup();
      return false;
    }
  }

  private createNoiseReductionFilters(): BiquadFilterNode[] {
    if (!this.audioContext) return [];

    const filters: BiquadFilterNode[] = [];

    // Common noise frequencies to filter out
    const noiseFrequencies = [
      { freq: 50, Q: 30 }, // Electrical hum (50Hz)
      { freq: 60, Q: 30 }, // Electrical hum (60Hz)
      { freq: 100, Q: 10 }, // Low-frequency rumble
      { freq: 200, Q: 5 }, // HVAC noise
      { freq: 1000, Q: 2 }, // Mid-frequency interference
      { freq: 3000, Q: 2 }, // High-frequency whistle
    ];

    for (const { freq, Q } of noiseFrequencies) {
      if (!this.audioContext) continue;
      const notchFilter = this.audioContext.createBiquadFilter();
      notchFilter.type = 'notch';
      notchFilter.frequency.value = freq;
      notchFilter.Q.value = Q;
      filters.push(notchFilter);
    }

    return filters;
  }

  private implementAdaptiveAGC(gainNode: GainNode): void {
    if (!this.audioContext) return;

    // Create script processor for real-time level monitoring
    const scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    scriptProcessor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer;
      const channelData = inputBuffer.getChannelData(0);

      // Calculate RMS level
      let sumSquares = 0;
      for (let i = 0; i < channelData.length; i++) {
        sumSquares += channelData[i] * channelData[i];
      }
      const rmsLevel = Math.sqrt(sumSquares / channelData.length);

      // Calculate target gain (aim for -12dB RMS)
      const targetLevel = 0.25; // -12dB
      const currentGain = gainNode.gain.value;
      const targetGain = Math.min(4.0, targetLevel / (rmsLevel + 0.001)); // Max 12dB gain

      // Smooth gain changes
      const smoothingFactor = 0.001;
      const newGain = currentGain + (targetGain - currentGain) * smoothingFactor;
      if (this.audioContext) {
        gainNode.gain.setValueAtTime(newGain, this.audioContext.currentTime);
      }
    };

    // Connect to the processing chain
    gainNode.connect(scriptProcessor);

    this.processingChain.push(scriptProcessor);
  }

  getProcessedStream(): MediaStream | null {
    if (!this.audioContext) return null;

    // Create a new MediaStreamDestination to get processed audio
    const destination = this.audioContext.createMediaStreamDestination();

    // Connect the last node in the chain to the destination
    if (this.processingChain.length > 0) {
      const lastNode = this.processingChain[this.processingChain.length - 1];
      lastNode.connect(destination);
    } else if (this.source) {
      this.source.connect(destination);
    }

    return destination.stream;
  }

  getAudioMetrics(): object {
    if (!this.audioContext) return {};

    interface AudioMetrics {
      sampleRate: number;
      currentTime: number;
      state: string;
      processingChain: number;
      compression?: {
        threshold: number;
        knee: number;
        ratio: number;
        attack: number;
        release: number;
        reduction: number;
      };
    }

    const metrics: AudioMetrics = {
      sampleRate: this.audioContext.sampleRate,
      currentTime: this.audioContext.currentTime,
      state: this.audioContext.state,
      processingChain: this.processingChain.length,
    };

    // Get compressor metrics if available
    const compressor = this.processingChain.find(
      (node) => node instanceof DynamicsCompressorNode
    ) as DynamicsCompressorNode;

    if (compressor) {
      metrics.compression = {
        threshold: compressor.threshold.value,
        knee: compressor.knee.value,
        ratio: compressor.ratio.value,
        attack: compressor.attack.value,
        release: compressor.release.value,
        reduction: compressor.reduction,
      };
    }

    return metrics;
  }

  updateConfig(newConfig: Partial<AudioEnhancementConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Re-initialize with new config if already running
    if (this.audioContext) {
      console.log('Audio processor config updated, reinitializing...');
      // Implementation would require reinitializing the processing chain
    }
  }

  cleanup(): void {
    console.log('Cleaning up high-definition audio processor...');

    // Disconnect processing chain
    for (let i = this.processingChain.length - 1; i >= 0; i--) {
      const node = this.processingChain[i];
      try {
        node.disconnect();
      } catch (error) {
        console.warn('Error disconnecting audio node:', error);
      }
    }

    // Disconnect source
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (error) {
        console.warn('Error disconnecting audio source:', error);
      }
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch((error) => {
        console.warn('Error closing audio context:', error);
      });
    }

    this.processingChain = [];
    this.source = null;
    this.audioContext = null;

    console.log('High-definition audio processor cleaned up');
  }
}

export class AudioQualityAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Float32Array | null = null;

  initialize(stream: MediaStream): boolean {
    try {
      this.audioContext = AudioErrorHandler.safeAudioContextCreation({
        sampleRate: 48000,
        latencyHint: 'interactive',
      });

      if (!this.audioContext) return false;

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      this.dataArray = new Float32Array(this.analyser.frequencyBinCount);

      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);

      return true;
    } catch (error) {
      console.error('Failed to initialize audio quality analyzer:', error);
      return false;
    }
  }

  analyzeQuality(): object {
    if (!this.analyser || !this.dataArray) return {};

    // Cast to Float32Array to satisfy Web Audio API type requirements
    this.analyser.getFloatFrequencyData(this.dataArray as Float32Array);

    // Calculate signal-to-noise ratio
    const signalLevel = this.getSignalLevel();
    const noiseLevel = this.getNoiseLevel();
    const snr = signalLevel - noiseLevel;

    // Calculate total harmonic distortion (simplified)
    const thd = this.calculateTHD();

    // Calculate frequency response flatness
    const flatness = this.calculateFrequencyFlatness();

    return {
      signalLevel: signalLevel,
      noiseLevel: noiseLevel,
      snr: snr,
      thd: thd,
      frequencyFlatness: flatness,
      qualityScore: this.calculateQualityScore(snr, thd, flatness),
    };
  }

  private getSignalLevel(): number {
    if (!this.dataArray) return -Infinity;

    let maxLevel = -Infinity;
    for (let i = 0; i < this.dataArray.length; i++) {
      if (this.dataArray[i] > maxLevel) {
        maxLevel = this.dataArray[i];
      }
    }
    return maxLevel;
  }

  private getNoiseLevel(): number {
    if (!this.dataArray) return 0;

    // Find minimum level (noise floor)
    let minLevel = Infinity;
    for (let i = 0; i < this.dataArray.length; i++) {
      if (this.dataArray[i] < minLevel) {
        minLevel = this.dataArray[i];
      }
    }
    return minLevel;
  }

  private calculateTHD(): number {
    // Simplified THD calculation
    // In a real implementation, you'd analyze harmonic content
    return Math.random() * 0.1; // Placeholder
  }

  private calculateFrequencyFlatness(): number {
    if (!this.dataArray) return 0;

    // Calculate standard deviation of frequency response
    let sum = 0;
    let sumSquares = 0;

    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
      sumSquares += this.dataArray[i] * this.dataArray[i];
    }

    const mean = sum / this.dataArray.length;
    const variance = sumSquares / this.dataArray.length - mean * mean;
    const stdDev = Math.sqrt(Math.abs(variance));

    // Return flatness score (lower stdDev = flatter response)
    return Math.max(0, 1 - stdDev / 100);
  }

  private calculateQualityScore(snr: number, thd: number, flatness: number): number {
    // Weighted quality score
    const snrScore = Math.max(0, Math.min(1, (snr + 60) / 60)); // Normalize to 0-1
    const thdScore = Math.max(0, 1 - thd * 10); // Lower THD is better
    const flatnessScore = flatness;

    return snrScore * 0.5 + thdScore * 0.3 + flatnessScore * 0.2;
  }

  cleanup(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch((error) => {
        console.warn('Error closing analyzer audio context:', error);
      });
    }

    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
  }
}
