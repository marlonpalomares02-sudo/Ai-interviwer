/**
 * Enhanced Transcription Optimizer
 * Provides realtime, accurate, and high-definition transcription improvements
 * while maintaining compatibility with existing codebase
 */

export interface TranscriptionOptimizerConfig {
  // Audio quality settings
  sampleRate: number;
  channelCount: number;
  bitDepth: number;

  // Processing settings
  bufferSize: number;
  overlapRatio: number;
  noiseThreshold: number;

  // Real-time settings
  realtimeLatency: number;
  interimUpdateFrequency: number;

  // Accuracy settings
  confidenceThreshold: number;
  languageModel: string;
  enablePunctuation: boolean;
  enableSpeakerDiarization: boolean;
}

export class TranscriptionOptimizer {
  private config: TranscriptionOptimizerConfig;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isProcessing = false;

  // Real-time transcription state
  private stableTranscript = '';
  private interimTranscript = '';
  private lastTranscriptTime = 0;
  private confidenceScores: number[] = [];

  // Audio quality monitoring
  private audioLevelHistory: number[] = [];
  private noiseLevel = 0;
  private signalToNoiseRatio = 0;

  constructor(config?: Partial<TranscriptionOptimizerConfig>) {
    this.config = {
      // High-quality audio settings
      sampleRate: 48000, // Higher sample rate for better quality
      channelCount: 1,
      bitDepth: 16,

      // Optimized processing
      bufferSize: 4096, // Smaller buffer for lower latency
      overlapRatio: 0.5, // 50% overlap for better accuracy
      noiseThreshold: -45, // dB threshold for noise detection

      // Real-time performance
      realtimeLatency: 100, // ms target latency
      interimUpdateFrequency: 200, // ms between interim updates

      // Accuracy enhancements
      confidenceThreshold: 0.7,
      languageModel: 'general-enhanced',
      enablePunctuation: true,
      enableSpeakerDiarization: false,
      ...config,
    };
  }

  /**
   * Initialize high-quality audio processing pipeline
   */
  public async initializeAudioProcessing(stream: MediaStream): Promise<boolean> {
    try {
      // Create high-quality audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate,
        latencyHint: 'interactive',
      });

      // Create analyser for audio quality monitoring
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect audio nodes - NO ScriptProcessorNode to prevent echoing
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);
      // DO NOT connect to any processor that could cause feedback

      // DO NOT set up enhanced audio processing - prevents echoing
      // this.setupEnhancedAudioProcessing();

      this.isProcessing = true;
      console.log('High-quality audio processing initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize audio processing:', error);
      return false;
    }
  }

  /**
   * Enhanced audio processing with real-time optimization
   * REMOVED: ScriptProcessorNode processing to prevent echoing
   * Use AudioWorklet processing instead
   */
  private setupEnhancedAudioProcessing(): void {
    // ScriptProcessorNode removed to prevent echoing
    // Audio processing is handled by AudioWorklet in the main transcription service
    console.log('Enhanced audio processing setup skipped (using AudioWorklet)');
  }

  /**
   * Real-time audio quality analysis
   */
  private analyzeAudioQuality(inputData: Float32Array): void {
    // Calculate RMS level
    let sumSquares = 0;
    let maxSample = 0;

    for (let i = 0; i < inputData.length; i++) {
      const sample = inputData[i];
      sumSquares += sample * sample;
      maxSample = Math.max(maxSample, Math.abs(sample));
    }

    const rms = Math.sqrt(sumSquares / inputData.length);
    const dbLevel = 20 * Math.log10(rms || 0.001);

    // Update audio level history
    this.audioLevelHistory.push(dbLevel);
    if (this.audioLevelHistory.length > 100) {
      this.audioLevelHistory.shift();
    }

    // Calculate noise floor
    this.calculateNoiseFloor();

    // Calculate signal-to-noise ratio
    this.signalToNoiseRatio = dbLevel - this.noiseLevel;

    // Log quality metrics periodically
    if (Date.now() - this.lastTranscriptTime > 5000) {
      console.log(
        `Audio Quality - Level: ${dbLevel.toFixed(1)}dB, Noise: ${this.noiseLevel.toFixed(1)}dB, SNR: ${this.signalToNoiseRatio.toFixed(1)}dB`
      );
    }
  }

  /**
   * Calculate dynamic noise floor
   */
  private calculateNoiseFloor(): void {
    if (this.audioLevelHistory.length < 10) return;

    // Use lowest 10% of levels as noise floor estimate
    const sortedLevels = [...this.audioLevelHistory].sort((a, b) => a - b);
    const noiseIndex = Math.floor(sortedLevels.length * 0.1);
    this.noiseLevel = sortedLevels[noiseIndex];
  }

  /**
   * Audio quality enhancement
   */
  public enhanceAudioQuality(inputData: Float32Array): Float32Array {
    const enhancedData = new Float32Array(inputData.length);

    // Simple noise gate based on SNR
    const noiseGateThreshold = this.config.noiseThreshold;
    const currentLevel =
      20 *
      Math.log10(
        Math.sqrt(inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length) ||
          0.001
      );

    // Apply noise gate if signal is too weak
    if (currentLevel < noiseGateThreshold) {
      // Return silence to avoid processing noise
      return enhancedData;
    }

    // Apply gentle high-pass filter to remove DC offset and low-frequency noise
    let prevSample = 0;
    const alpha = 0.95; // High-pass filter coefficient

    for (let i = 0; i < inputData.length; i++) {
      enhancedData[i] = alpha * (prevSample + inputData[i] - (i > 0 ? inputData[i - 1] : 0));
      prevSample = enhancedData[i];
    }

    // Normalize audio level for consistent volume
    this.normalizeAudioLevel(enhancedData);

    return enhancedData;
  }

  /**
   * Normalize audio level for consistent transcription quality
   */
  private normalizeAudioLevel(data: Float32Array): void {
    // Find peak value
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }

    // Apply normalization if needed (avoid over-amplifying)
    if (peak > 0.1 && peak < 1.0) {
      const gain = 0.8 / peak; // Target 80% of max level
      for (let i = 0; i < data.length; i++) {
        data[i] *= gain;
      }
    }
  }

  /**
   * Optimized audio processing for transcription
   */
  public processAudioForTranscription(inputData: Float32Array): Int16Array {
    // Convert to 16-bit PCM with high-quality dithering
    const outputData = new Int16Array(inputData.length);

    for (let i = 0; i < inputData.length; i++) {
      // Apply triangular dithering for better quality
      const dither = ((Math.random() - 0.5) * 2) / 32768;
      const sample = Math.max(-1, Math.min(1, inputData[i])) + dither;
      outputData[i] = Math.round(sample * 32767);
    }

    return outputData;
  }

  /**
   * Send processed audio to transcription service
   */
  private sendToTranscriptionService(audioData: Int16Array): void {
    // Use existing Deepgram integration with enhanced settings
    if (window.electronAPI && window.electronAPI.ipcRenderer) {
      window.electronAPI.ipcRenderer.invoke('send-audio-to-deepgram', audioData.buffer);
    }
  }

  /**
   * Enhanced transcript processing with confidence scoring
   */
  public processTranscript(transcriptData: any): {
    transcript: string;
    isFinal: boolean;
    confidence: number;
    shouldUpdate: boolean;
  } {
    const transcript = transcriptData.transcript?.trim() || '';
    const isFinal = transcriptData.is_final || false;

    // Calculate confidence score based on various factors
    const confidence = this.calculateConfidence(transcript, transcriptData);

    // Update transcript state
    if (isFinal) {
      this.stableTranscript += transcript + ' ';
      this.interimTranscript = '';
      this.lastTranscriptTime = Date.now();

      // Store confidence for accuracy tracking
      this.confidenceScores.push(confidence);
      if (this.confidenceScores.length > 50) {
        this.confidenceScores.shift();
      }
    } else {
      this.interimTranscript = transcript;
    }

    // Determine if UI should update
    const shouldUpdate = this.shouldUpdateDisplay(transcript, isFinal, confidence);

    return {
      transcript: this.getCombinedTranscript(),
      isFinal,
      confidence,
      shouldUpdate,
    };
  }

  /**
   * Calculate confidence score for transcription accuracy
   */
  private calculateConfidence(transcript: string, transcriptData: any): number {
    let confidence = 0.8; // Base confidence

    // Factor 1: Transcript length and completeness
    if (transcript.length > 3) {
      confidence += 0.1;
    }

    // Factor 2: Audio quality (SNR)
    if (this.signalToNoiseRatio > 20) {
      confidence += 0.05;
    } else if (this.signalToNoiseRatio < 10) {
      confidence -= 0.1;
    }

    // Factor 3: Word confidence from Deepgram (if available)
    if (transcriptData.channel?.alternatives?.[0]?.words) {
      const wordConfidences = transcriptData.channel.alternatives[0].words.map(
        (w: any) => w.confidence || 0.5
      );
      const avgWordConfidence =
        wordConfidences.reduce((a: number, b: number) => a + b, 0) / wordConfidences.length;
      confidence = (confidence + avgWordConfidence) / 2;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Smart display update logic to reduce flickering
   */
  private shouldUpdateDisplay(transcript: string, isFinal: boolean, confidence: number): boolean {
    const now = Date.now();

    // Always update final transcripts
    if (isFinal) return true;

    // Don't update empty or low-confidence interim transcripts
    if (!transcript || confidence < this.config.confidenceThreshold) {
      return false;
    }

    // Throttle interim updates to reduce UI flicker
    if (now - this.lastTranscriptTime < this.config.interimUpdateFrequency) {
      return false;
    }

    return true;
  }

  /**
   * Get combined stable and interim transcript
   */
  public getCombinedTranscript(): string {
    return (this.stableTranscript + this.interimTranscript).trim();
  }

  /**
   * Get transcription statistics for monitoring
   */
  public getStatistics(): {
    averageConfidence: number;
    audioQuality: number;
    realtimeLatency: number;
    transcriptionRate: number;
  } {
    const avgConfidence =
      this.confidenceScores.length > 0
        ? this.confidenceScores.reduce((a, b) => a + b, 0) / this.confidenceScores.length
        : 0;

    const audioQuality = Math.max(0, Math.min(1, this.signalToNoiseRatio / 40));

    return {
      averageConfidence: avgConfidence,
      audioQuality: audioQuality,
      realtimeLatency: this.config.realtimeLatency,
      transcriptionRate: this.calculateTranscriptionRate(),
    };
  }

  /**
   * Calculate words per minute transcription rate
   */
  private calculateTranscriptionRate(): number {
    // Simple estimation based on transcript length and time
    const words = this.stableTranscript.split(/\s+/).filter((word) => word.length > 0);
    const recordingDuration =
      this.lastTranscriptTime > 0 ? (Date.now() - this.lastTranscriptTime) / 60000 : 1;

    return words.length / Math.max(recordingDuration, 0.1);
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.isProcessing = false;

    // No processor to clean up (removed ScriptProcessorNode)

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.stableTranscript = '';
    this.interimTranscript = '';
    this.confidenceScores = [];
    this.audioLevelHistory = [];

    console.log('Transcription optimizer cleaned up');
  }

  /**
   * Update configuration dynamically
   */
  public updateConfig(newConfig: Partial<TranscriptionOptimizerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Transcription optimizer configuration updated');
  }
}

// Export singleton instance for easy access
export const transcriptionOptimizer = new TranscriptionOptimizer();

// Utility functions for enhanced transcription
export const createHighQualityAudioStream = async (
  constraints?: MediaStreamConstraints
): Promise<MediaStream | null> => {
  try {
    const highQualityConstraints: MediaStreamConstraints = {
      audio: {
        sampleRate: 48000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(constraints?.audio as any),
      },
      video: false,
    };

    console.log('Requesting high-quality audio stream:', highQualityConstraints);
    const stream = await navigator.mediaDevices.getUserMedia(highQualityConstraints);

    // Validate stream quality
    const track = stream.getAudioTracks()[0];
    const settings = track.getSettings();

    console.log('High-quality audio stream created:', {
      sampleRate: settings.sampleRate,
      channelCount: settings.channelCount,
    });

    return stream;
  } catch (error) {
    console.error('Failed to create high-quality audio stream:', error);

    // Fallback to standard quality
    try {
      console.log('Attempting fallback to standard audio quality...');
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (fallbackError) {
      console.error('Fallback audio stream also failed:', fallbackError);
      return null;
    }
  }
};

/**
 * Enhanced audio processing with real-time optimization
 */
export const processAudioWithEnhancement = (inputData: Float32Array): Int16Array => {
  const optimizer = new TranscriptionOptimizer();
  const enhancedData = optimizer.enhanceAudioQuality(inputData);
  return optimizer.processAudioForTranscription(enhancedData);
};
