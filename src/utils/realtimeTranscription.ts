import { AudioErrorHandler } from './errorHandling';
import { AudioWorkletManager } from './audioWorkletManager';

export interface TranscriptionConfig {
  sampleRate: number;
  channelCount: number;
  bitDepth: number;
  chunkDuration: number;
  overlapDuration: number;
  silenceThreshold: number;
  minSpeechDuration: number;
  maxChunkSize: number;
}

export interface AudioChunk {
  id: string;
  timestamp: number;
  data: Int16Array;
  duration: number;
  isSpeech: boolean;
  confidence: number;
}

export class RealtimeTranscriptionProcessor {
  private audioContext: AudioContext | null = null;
  private workletManager: AudioWorkletManager | null = null;
  private mediaStream: MediaStream | null = null;
  private isProcessing = false;
  private audioBuffer: Float32Array[] = [];
  private chunkQueue: AudioChunk[] = [];
  private lastProcessTime = 0;
  private silenceStartTime = 0;
  private isSpeaking = false;
  private config: TranscriptionConfig;
  private onTranscriptionCallback: (text: string, confidence: number) => void;
  private vad: VoiceActivityDetector;

  constructor(
    config: Partial<TranscriptionConfig> = {},
    onTranscription: (text: string, confidence: number) => void
  ) {
    this.config = {
      sampleRate: 16000,
      channelCount: 1,
      bitDepth: 16,
      chunkDuration: 1000, // 1 second chunks
      overlapDuration: 200, // 200ms overlap
      silenceThreshold: 0.01, // -40dB threshold
      minSpeechDuration: 300, // 300ms minimum speech
      maxChunkSize: 48000, // Maximum samples per chunk
      ...config,
    };
    this.onTranscriptionCallback = onTranscription;
    this.vad = new VoiceActivityDetector(this.config);
  }

  async start(stream: MediaStream): Promise<boolean> {
    try {
      console.log('Starting real-time transcription processor...');

      // Validate input stream
      const isValid = await AudioErrorHandler.validateAudioStream(stream);
      if (!isValid) {
        throw new Error('Invalid audio stream provided');
      }

      this.mediaStream = stream;

      // Create high-quality audio context
      this.audioContext = AudioErrorHandler.safeAudioContextCreation({
        sampleRate: this.config.sampleRate,
        latencyHint: 'interactive',
        // Note: channelCount is not a valid AudioContextOptions property
        // We'll set channel count when creating the media stream source instead
      });

      if (!this.audioContext) {
        throw new Error('Failed to create audio context');
      }

      // Create AudioWorkletManager to replace deprecated ScriptProcessorNode
      this.workletManager = new AudioWorkletManager(this.audioContext);

      // Initialize Audio Worklet - NO FALLBACK to prevent echoing
      let workletInitialized = false;
      try {
        workletInitialized = await this.workletManager.initialize();
        if (!workletInitialized) {
          throw new Error('Audio Worklet initialization failed');
        }
      } catch (error) {
        console.error('Audio Worklet initialization failed completely:', error);
        // DO NOT use ScriptProcessorNode fallback to prevent echoing
        throw new Error('Audio Worklet is required for echo-free transcription. Please use a modern browser.');
      }

      // Start processing with Audio Worklet only (no fallback)
      const processingStarted = await this.workletManager.startProcessing(
        stream,
        (samples: Float32Array) => {
          this.processAudioFrame(samples);
        }
      );

      if (!processingStarted) {
        throw new Error('Failed to start Audio Worklet processing');
      }

      this.isProcessing = true;
      this.lastProcessTime = Date.now();

      console.log('Real-time transcription processor started successfully');
      return true;
    } catch (error) {
      console.error('Failed to start transcription processor:', error);
      this.cleanup();
      return false;
    }
  }

  private processAudioFrame(audioData: Float32Array): void {
    if (!this.isProcessing) return;

    try {
      // Copy audio data to prevent buffer reuse issues
      const audioDataCopy = new Float32Array(audioData);
      this.audioBuffer.push(audioDataCopy);

      // Process audio in chunks for better performance
      const currentTime = Date.now();
      const timeSinceLastProcess = currentTime - this.lastProcessTime;

      if (timeSinceLastProcess >= this.config.chunkDuration) {
        this.processAudioChunk();
        this.lastProcessTime = currentTime;
      }
    } catch (error) {
      console.error('Error processing audio frame:', error);
    }
  }

  private processAudioChunk(): void {
    if (this.audioBuffer.length === 0) return;

    try {
      // Combine buffered audio data
      const totalLength = this.audioBuffer.reduce((sum, buffer) => sum + buffer.length, 0);
      const combinedData = new Float32Array(totalLength);

      let offset = 0;
      for (const buffer of this.audioBuffer) {
        combinedData.set(buffer, offset);
        offset += buffer.length;
      }

      // Clear processed buffer
      this.audioBuffer = [];

      // Apply voice activity detection
      const vadResult = this.vad.detectVoiceActivity(combinedData);

      // Convert to 16-bit PCM for transcription
      const pcmData = this.convertToPCM(combinedData);

      // Create audio chunk
      const chunk: AudioChunk = {
        id: `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        data: pcmData,
        duration: (combinedData.length / this.config.sampleRate) * 1000,
        isSpeech: vadResult.isSpeech,
        confidence: vadResult.confidence,
      };

      // Add to processing queue
      this.chunkQueue.push(chunk);

      // Process speech chunks immediately, queue silence chunks
      if (chunk.isSpeech && chunk.confidence > 0.7) {
        this.processTranscriptionChunk(chunk);
      } else if (!this.isSpeaking) {
        // Handle silence periods
        this.handleSilencePeriod();
      }

      // Clean up old chunks
      this.cleanupOldChunks();
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  }

  private convertToPCM(float32Data: Float32Array): Int16Array {
    const pcmData = new Int16Array(float32Data.length);

    for (let i = 0; i < float32Data.length; i++) {
      // Apply high-quality dithering and noise shaping
      const sample = Math.max(-1, Math.min(1, float32Data[i]));
      const ditheredSample = this.applyDithering(sample);
      pcmData[i] = Math.round(ditheredSample * 32767);
    }

    return pcmData;
  }

  private applyDithering(sample: number): number {
    // Apply triangular dithering for better audio quality
    const dither = (Math.random() - 0.5) * 0.001;
    return sample + dither;
  }

  private handleSilencePeriod(): void {
    const currentTime = Date.now();

    if (this.silenceStartTime === 0) {
      this.silenceStartTime = currentTime;
    } else if (currentTime - this.silenceStartTime > 2000) {
      // 2 seconds of silence - process any accumulated speech
      this.processAccumulatedSpeech();
      this.silenceStartTime = 0;
    }
  }

  private processAccumulatedSpeech(): void {
    const speechChunks = this.chunkQueue.filter((chunk) => chunk.isSpeech);

    if (speechChunks.length > 0) {
      // Combine speech chunks for better transcription accuracy
      const combinedData = this.combineChunks(speechChunks);
      this.processTranscriptionChunk({
        ...speechChunks[0],
        data: combinedData,
        duration: speechChunks.reduce((sum, chunk) => sum + chunk.duration, 0),
      });
    }
  }

  private combineChunks(chunks: AudioChunk[]): Int16Array {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
    const combined = new Int16Array(totalLength);

    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk.data, offset);
      offset += chunk.data.length;
    }

    return combined;
  }

  private async processTranscriptionChunk(chunk: AudioChunk): Promise<void> {
    if (!chunk.isSpeech || chunk.confidence < 0.5) return;

    try {
      // Simulate transcription processing (replace with actual API call)
      const transcription = await this.performTranscription(chunk.data);

      if (transcription && transcription.text) {
        this.onTranscriptionCallback(transcription.text, chunk.confidence);
      }
    } catch (error) {
      console.error('Error processing transcription chunk:', error);
    }
  }

  private async performTranscription(
    audioData: Int16Array
  ): Promise<{ text: string; confidence: number }> {
    // This is a placeholder - integrate with your actual transcription service
    // For now, return mock data for testing
    return {
      text: `[Audio chunk: ${audioData.length} samples]`,
      confidence: 0.85,
    };
  }

  private cleanupOldChunks(): void {
    const maxAge = 30000; // Keep chunks for 30 seconds
    const currentTime = Date.now();

    this.chunkQueue = this.chunkQueue.filter((chunk) => currentTime - chunk.timestamp < maxAge);
  }

  stop(): void {
    console.log('Stopping real-time transcription processor...');
    this.isProcessing = false;
    this.cleanup();
    console.log('Real-time transcription processor stopped');
  }

  private cleanup(): void {
    // Clean up Audio Worklet manager
    if (this.workletManager) {
      this.workletManager.stopProcessing();
      this.workletManager.cleanup();
    }

    // ScriptProcessorNode removed to prevent echoing - no cleanup needed

    AudioErrorHandler.cleanupAudioResources(this.mediaStream, this.audioContext, null);

    this.mediaStream = null;
    this.audioContext = null;
    this.workletManager = null;
    this.audioBuffer = [];
    this.chunkQueue = [];
  }

  getStats(): object {
    return {
      isProcessing: this.isProcessing,
      bufferedChunks: this.audioBuffer.length,
      queueSize: this.chunkQueue.length,
      config: this.config,
    };
  }
}

class VoiceActivityDetector {
  private config: TranscriptionConfig;
  private energyHistory: number[] = [];
  private historySize = 10;

  constructor(config: TranscriptionConfig) {
    this.config = config;
  }

  detectVoiceActivity(audioData: Float32Array): { isSpeech: boolean; confidence: number } {
    try {
      // Calculate RMS energy
      const energy = this.calculateEnergy(audioData);
      this.energyHistory.push(energy);

      if (this.energyHistory.length > this.historySize) {
        this.energyHistory.shift();
      }

      // Calculate background noise level
      const backgroundNoise = this.calculateBackgroundNoise();

      // Simple energy-based VAD
      const threshold = backgroundNoise * 2; // Adaptive threshold
      const isSpeech = energy > threshold;

      // Calculate confidence based on energy ratio
      const confidence = Math.min(1.0, energy / (threshold * 3));

      return {
        isSpeech,
        confidence: Math.max(0, confidence),
      };
    } catch (error) {
      console.error('Error in voice activity detection:', error);
      return { isSpeech: false, confidence: 0 };
    }
  }

  private calculateEnergy(audioData: Float32Array): number {
    let sumSquares = 0;
    for (let i = 0; i < audioData.length; i++) {
      sumSquares += audioData[i] * audioData[i];
    }
    return Math.sqrt(sumSquares / audioData.length);
  }

  private calculateBackgroundNoise(): number {
    if (this.energyHistory.length === 0) return 0.001;

    // Use minimum energy as background noise estimate
    return Math.min(...this.energyHistory);
  }
}
