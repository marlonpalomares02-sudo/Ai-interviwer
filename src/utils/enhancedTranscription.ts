import {
  OptimizedTranscriptionService,
  TranscriptionServiceConfig,
} from './optimizedTranscriptionService';
import { HighDefinitionAudioProcessor, AudioQualityAnalyzer } from './highDefinitionAudio';
import { RealtimeTranscriptionProcessor, TranscriptionConfig } from './realtimeTranscription';
import {
  TranscriptionAccuracyValidator,
  TranscriptionTestConfig,
} from './transcriptionAccuracyValidator';
import {
  createStableAudioStream,
  createScreenShareStream,
  monitorStreamHealth,
} from './audioUtils';
import { AudioErrorHandler } from './errorHandling';

export interface EnhancedTranscriptionOptions {
  enableHD: boolean;
  enableRealtime: boolean;
  enableQualityAnalysis: boolean;
  enableAccuracyValidation: boolean;
  sampleRate: number;
  language: string;
  model: string;
  apiKey: string;
  apiUrl: string;
  // WebSocket configuration
  websocketUrl?: string;
  enableInterimResults?: boolean;
  enableEndpointing?: boolean;
  vadTurnoff?: number;
  punctuate?: boolean;
  profanityFilter?: boolean;
  diarize?: boolean;
}

export interface TranscriptionMetrics {
  accuracy: number;
  latency: number;
  qualityScore: number;
  processingSpeed: number;
  connectionStatus: boolean;
  audioLevel: number;
}

export class EnhancedTranscriptionManager {
  private transcriptionService: OptimizedTranscriptionService | null = null;
  private audioProcessor: RealtimeTranscriptionProcessor | null = null;
  private hdProcessor: HighDefinitionAudioProcessor | null = null;
  private qualityAnalyzer: AudioQualityAnalyzer | null = null;
  private accuracyValidator: TranscriptionAccuracyValidator | null = null;
  private streamMonitor: (() => void) | null = null;
  private mediaStream: MediaStream | null = null;
  private options: EnhancedTranscriptionOptions;
  private isActive = false;
  private metrics: TranscriptionMetrics;
  private onTranscriptionCallback: (
    text: string,
    confidence: number,
    metrics: TranscriptionMetrics
  ) => void;
  private onErrorCallback: (error: string) => void;

  constructor(
    options: Partial<EnhancedTranscriptionOptions>,
    onTranscription: (text: string, confidence: number, metrics: TranscriptionMetrics) => void,
    onError?: (error: string) => void
  ) {
    this.options = {
      enableHD: true,
      enableRealtime: true,
      enableQualityAnalysis: true,
      enableAccuracyValidation: false,
      sampleRate: 16000,
      language: 'en-US',
      model: 'nova-2',
      apiKey: '',
      apiUrl: 'wss://api.deepgram.com/v1/listen',
      ...options,
    };

    this.onTranscriptionCallback = onTranscription;
    this.onErrorCallback = onError || (() => {});

    this.metrics = {
      accuracy: 0,
      latency: 0,
      qualityScore: 0,
      processingSpeed: 0,
      connectionStatus: false,
      audioLevel: 0,
    };
  }

  async initialize(audioSource?: MediaStream): Promise<boolean> {
    try {
      console.log('Initializing enhanced transcription manager...');

      // Get audio stream if not provided
      if (!audioSource) {
        audioSource = await this.getAudioStream();
        if (!audioSource) {
          throw new Error('Failed to obtain audio stream');
        }
      }

      this.mediaStream = audioSource;

      // Initialize accuracy validator if enabled
      if (this.options.enableAccuracyValidation) {
        this.accuracyValidator = new TranscriptionAccuracyValidator();
      }

      // Initialize quality analyzer if enabled
      if (this.options.enableQualityAnalysis) {
        this.qualityAnalyzer = new AudioQualityAnalyzer();
        const initialized = this.qualityAnalyzer.initialize(audioSource);
        if (!initialized) {
          console.warn('Failed to initialize quality analyzer');
        }
      }

      // Initialize optimized transcription service
      this.transcriptionService = new OptimizedTranscriptionService(
        {
          apiKey: this.options.apiKey,
          apiUrl: this.options.apiUrl,
          language: this.options.language,
          model: this.options.model,
          enableHD: this.options.enableHD,
          enableRealtime: this.options.enableRealtime,
          sampleRate: this.options.sampleRate,
        },
        this.handleTranscriptionResult.bind(this),
        this.handleConnectionStateChange.bind(this)
      );

      // Start transcription service
      const serviceStarted = await this.transcriptionService.start(audioSource);
      if (!serviceStarted) {
        throw new Error('Failed to start transcription service');
      }

      // Monitor stream health
      this.streamMonitor = monitorStreamHealth(audioSource, () => {
        console.warn('Audio stream disconnected, attempting to reconnect...');
        this.handleStreamDisconnection();
      });

      this.isActive = true;
      this.startMetricsCollection();

      console.log('Enhanced transcription manager initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize transcription manager:', error);
      this.cleanup();
      return false;
    }
  }

  private async getAudioStream(): Promise<MediaStream | null> {
    try {
      // Try to get system audio stream first (for interview scenarios)
      const systemStream = await createScreenShareStream('system-audio');
      if (systemStream) {
        console.log('Using system audio stream');
        return systemStream;
      }

      // Fallback to microphone
      const micStream = await createStableAudioStream({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (micStream) {
        console.log('Using microphone audio stream');
        return micStream;
      }

      throw new Error('Failed to obtain any audio stream');
    } catch (error) {
      console.error('Failed to get audio stream:', error);
      return null;
    }
  }

  private handleTranscriptionResult(result: any): void {
    try {
      // Update metrics
      this.updateMetrics(result);

      // Validate accuracy if enabled
      if (this.accuracyValidator) {
        // Run validation in background
        this.validateAccuracy(result);
      }

      // Call user callback
      this.onTranscriptionCallback(result.text, result.confidence, { ...this.metrics });
    } catch (error) {
      console.error('Error handling transcription result:', error);
      this.onErrorCallback('Error processing transcription result');
    }
  }

  private handleConnectionStateChange(connected: boolean): void {
    this.metrics.connectionStatus = connected;
    console.log(`Transcription connection ${connected ? 'established' : 'lost'}`);
  }

  private handleStreamDisconnection(): void {
    this.onErrorCallback('Audio stream disconnected');
    // Attempt to reconnect
    setTimeout(() => {
      this.reconnect();
    }, 2000);
  }

  private async reconnect(): Promise<void> {
    try {
      console.log('Attempting to reconnect transcription service...');

      // Stop current service
      if (this.transcriptionService) {
        this.transcriptionService.stop();
      }

      // Get new audio stream
      const newStream = await this.getAudioStream();
      if (!newStream) {
        throw new Error('Failed to obtain new audio stream');
      }

      this.mediaStream = newStream;

      // Restart service with new stream
      const reconnected = await this.transcriptionService!.start(newStream);
      if (!reconnected) {
        throw new Error('Failed to restart transcription service');
      }

      console.log('Reconnection successful');
    } catch (error) {
      console.error('Reconnection failed:', error);
      this.onErrorCallback('Failed to reconnect transcription service');
    }
  }

  private updateMetrics(result: any): void {
    try {
      // Update accuracy
      if (result.confidence) {
        this.metrics.accuracy = result.confidence;
      }

      // Update latency (if timestamp available)
      if (result.timestamp) {
        this.metrics.latency = Date.now() - result.timestamp;
      }

      // Update quality score from analyzer
      if (this.qualityAnalyzer) {
        const qualityData = this.qualityAnalyzer.analyzeQuality();
        this.metrics.qualityScore = (qualityData as any).qualityScore || 0;
        this.metrics.audioLevel = (qualityData as any).signalLevel || 0;
      }

      // Update connection status
      if (this.transcriptionService) {
        const stats = this.transcriptionService.getConnectionStats() as any;
        this.metrics.connectionStatus = stats.isConnected;
      }
    } catch (error) {
      console.error('Error updating metrics:', error);
    }
  }

  private async validateAccuracy(result: any): Promise<void> {
    try {
      // Run accuracy validation in background
      const testConfig: Partial<TranscriptionTestConfig> = {
        testDuration: 5000,
        expectedAccuracy: 0.9,
      };

      await this.accuracyValidator!.runComprehensiveTest(testConfig);
    } catch (error) {
      console.error('Accuracy validation failed:', error);
    }
  }

  private startMetricsCollection(): void {
    // Collect metrics every second
    setInterval(() => {
      this.collectMetrics();
    }, 1000);
  }

  private collectMetrics(): void {
    try {
      if (this.qualityAnalyzer) {
        const qualityData = this.qualityAnalyzer.analyzeQuality();
        this.metrics.qualityScore = (qualityData as any).qualityScore || this.metrics.qualityScore;
      }

      if (this.transcriptionService) {
        const stats = this.transcriptionService.getConnectionStats() as any;
        this.metrics.connectionStatus = stats.isConnected;

        // Update processing speed based on recent transcriptions
        if (stats.recentTranscriptions) {
          this.metrics.processingSpeed = stats.recentTranscriptions.length;
        }
      }
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  getMetrics(): TranscriptionMetrics {
    return { ...this.metrics };
  }

  getDetailedStats(): object {
    const stats: any = {
      isActive: this.isActive,
      options: this.options,
      metrics: this.metrics,
    };

    if (this.transcriptionService) {
      stats.connectionStats = this.transcriptionService.getConnectionStats();
    }

    if (this.accuracyValidator) {
      stats.validationReport = this.accuracyValidator.getTestReport();
    }

    return stats;
  }

  async runAccuracyTest(): Promise<object> {
    if (!this.accuracyValidator) {
      throw new Error('Accuracy validation not enabled');
    }

    const testConfig: Partial<TranscriptionTestConfig> = {
      testDuration: 10000,
      expectedAccuracy: 0.95,
    };

    return await this.accuracyValidator.runComprehensiveTest(testConfig);
  }

  updateOptions(newOptions: Partial<EnhancedTranscriptionOptions>): void {
    this.options = { ...this.options, ...newOptions };

    // Restart service with new options if active
    if (this.isActive && this.mediaStream) {
      this.stop();
      setTimeout(() => {
        this.initialize(this.mediaStream!);
      }, 100);
    }
  }

  stop(): void {
    console.log('Stopping enhanced transcription manager...');

    this.isActive = false;

    // Stop stream monitoring
    if (this.streamMonitor) {
      this.streamMonitor();
      this.streamMonitor = null;
    }

    // Stop transcription service
    if (this.transcriptionService) {
      this.transcriptionService.stop();
      this.transcriptionService = null;
    }

    // Stop audio processor
    if (this.audioProcessor) {
      this.audioProcessor.stop();
      this.audioProcessor = null;
    }

    // Stop HD processor
    if (this.hdProcessor) {
      this.hdProcessor.cleanup();
      this.hdProcessor = null;
    }

    // Stop quality analyzer
    if (this.qualityAnalyzer) {
      this.qualityAnalyzer.cleanup();
      this.qualityAnalyzer = null;
    }

    // Stop accuracy validator
    if (this.accuracyValidator) {
      this.accuracyValidator.cleanup();
      this.accuracyValidator = null;
    }

    // Clean up media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    console.log('Enhanced transcription manager stopped');
  }

  cleanup(): void {
    this.stop();
  }
}

// Factory function for easy instantiation
export function createEnhancedTranscription(
  options: Partial<EnhancedTranscriptionOptions>,
  onTranscription: (text: string, confidence: number, metrics: TranscriptionMetrics) => void,
  onError?: (error: string) => void
): EnhancedTranscriptionManager {
  return new EnhancedTranscriptionManager(options, onTranscription, onError);
}
