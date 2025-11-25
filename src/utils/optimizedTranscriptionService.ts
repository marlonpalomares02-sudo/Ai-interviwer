import { AudioErrorHandler } from './errorHandling';
import { RealtimeTranscriptionProcessor, TranscriptionConfig } from './realtimeTranscription';
import { HighDefinitionAudioProcessor, AudioEnhancementConfig } from './highDefinitionAudio';

export interface TranscriptionServiceConfig {
  apiKey: string;
  apiUrl: string;
  language: string;
  model: string;
  enableHD: boolean;
  enableRealtime: boolean;
  sampleRate: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
  duration: number;
  language: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export class OptimizedTranscriptionService {
  private websocket: WebSocket | null = null;
  private audioProcessor: RealtimeTranscriptionProcessor | null = null;
  private hdProcessor: HighDefinitionAudioProcessor | null = null;
  private config: TranscriptionServiceConfig;
  private isConnected = false;
  private reconnectAttempts = 0;
  private mediaStream: MediaStream | null = null;
  private onTranscriptionCallback: (result: TranscriptionResult) => void;
  private onConnectionStateChange: (connected: boolean) => void;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private lastHeartbeatTime = 0;

  constructor(
    config: Partial<TranscriptionServiceConfig>,
    onTranscription: (result: TranscriptionResult) => void,
    onConnectionStateChange?: (connected: boolean) => void
  ) {
    this.config = {
      apiKey: '',
      apiUrl: 'wss://api.deepgram.com/v1/listen',
      language: 'en-US',
      model: 'nova-2',
      enableHD: true,
      enableRealtime: true,
      sampleRate: 16000,
      maxReconnectAttempts: 5,
      reconnectDelay: 3000,
      ...config,
    };

    this.onTranscriptionCallback = onTranscription;
    this.onConnectionStateChange = onConnectionStateChange || (() => {});
  }

  async start(stream: MediaStream): Promise<boolean> {
    try {
      console.log('Starting optimized transcription service...');

      // Validate input stream
      const isValid = await AudioErrorHandler.validateAudioStream(stream);
      if (!isValid) {
        throw new Error('Invalid audio stream provided');
      }

      this.mediaStream = stream;

      // Apply high-definition audio processing if enabled
      let processedStream = stream;
      if (this.config.enableHD) {
        processedStream = await this.applyHDProcessing(stream);
        if (!processedStream) {
          console.warn('HD processing failed, falling back to original stream');
          processedStream = stream;
        }
      }

      // Initialize WebSocket connection
      const connected = await this.connectWebSocket();
      if (!connected) {
        throw new Error('Failed to establish WebSocket connection');
      }

      // Initialize real-time transcription processor
      if (this.config.enableRealtime) {
        const processorStarted = await this.initializeProcessor(processedStream);
        if (!processorStarted) {
          throw new Error('Failed to start transcription processor');
        }
      }

      // Start connection monitoring
      this.startConnectionMonitoring();

      console.log('Optimized transcription service started successfully');
      return true;
    } catch (error) {
      console.error('Failed to start transcription service:', error);
      this.stop();
      return false;
    }
  }

  private async applyHDProcessing(stream: MediaStream): Promise<MediaStream> {
    try {
      console.log('Applying high-definition audio processing...');

      this.hdProcessor = new HighDefinitionAudioProcessor({
        noiseReduction: true,
        echoCancellation: true,
        autoGainControl: true,
        highPassFilter: true,
        lowPassFilter: true,
        dynamicRangeCompression: true,
        sampleRate: this.config.sampleRate,
        bitDepth: 24,
      });

      const initialized = await this.hdProcessor.initialize(stream);
      if (!initialized) {
        throw new Error('Failed to initialize HD processor');
      }

      const processedStream = this.hdProcessor.getProcessedStream();
      if (!processedStream) {
        throw new Error('Failed to get processed stream');
      }

      console.log('High-definition audio processing applied successfully');
      return processedStream;
    } catch (error) {
      console.error('HD processing error:', error);
      return stream;
    }
  }

  private async connectWebSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const params = new URLSearchParams({
          model: this.config.model,
          language: this.config.language,
          encoding: 'linear16',
          sample_rate: this.config.sampleRate.toString(),
          channels: '1',
          interim_results: 'true',
          punctuate: 'true',
          profanity_filter: 'false',
          smart_format: 'true',
          diarize: 'true',
          filler_words: 'false',
          keywords: this.getKeywords().join(','),
        });

        const wsUrl = `${this.config.apiUrl}?${params.toString()}`;
        console.log('Connecting to WebSocket:', wsUrl);

        this.websocket = new WebSocket(wsUrl, ['token', this.config.apiKey]);

        this.websocket.onopen = () => {
          console.log('WebSocket connection established');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.lastHeartbeatTime = Date.now();
          this.onConnectionStateChange(true);
          resolve(true);
        };

        this.websocket.onmessage = (event) => {
          this.handleWebSocketMessage(event);
        };

        this.websocket.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        this.websocket.onclose = () => {
          console.log('WebSocket connection closed');
          this.isConnected = false;
          this.onConnectionStateChange(false);
          this.attemptReconnection();
        };

        // Set connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            console.error('WebSocket connection timeout');
            resolve(false);
          }
        }, 10000);
      } catch (error) {
        console.error('WebSocket connection error:', error);
        resolve(false);
      }
    });
  }

  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'Results') {
        this.handleTranscriptionResults(data);
      } else if (data.type === 'Metadata') {
        console.log('Transcription metadata:', data);
      } else if (data.type === 'UtteranceEnd') {
        console.log('Utterance ended');
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private handleTranscriptionResults(data: any): void {
    try {
      const channel = data.channel;
      const alternatives = channel.alternatives;

      if (alternatives && alternatives.length > 0) {
        const result = alternatives[0];
        const transcriptionResult: TranscriptionResult = {
          text: result.transcript,
          confidence: result.confidence || 0.85,
          isFinal: !data.is_final,
          timestamp: Date.now(),
          duration: data.duration || 0,
          language: data.language || this.config.language,
          words: result.words?.map((word: any) => ({
            word: word.word,
            start: word.start,
            end: word.end,
            confidence: word.confidence,
          })),
        };

        this.onTranscriptionCallback(transcriptionResult);
      }
    } catch (error) {
      console.error('Error handling transcription results:', error);
    }
  }

  private async initializeProcessor(stream: MediaStream): Promise<boolean> {
    try {
      const transcriptionConfig: TranscriptionConfig = {
        sampleRate: this.config.sampleRate,
        channelCount: 1,
        bitDepth: 16,
        chunkDuration: 500, // 500ms chunks for faster response
        overlapDuration: 100, // 100ms overlap
        silenceThreshold: 0.005,
        minSpeechDuration: 200,
        maxChunkSize: 24000,
      };

      this.audioProcessor = new RealtimeTranscriptionProcessor(
        transcriptionConfig,
        (text: string, confidence: number) => {
          this.onTranscriptionCallback({
            text,
            confidence,
            isFinal: true,
            timestamp: Date.now(),
            duration: 0,
            language: this.config.language,
          });
        }
      );

      return await this.audioProcessor.start(stream);
    } catch (error) {
      console.error('Failed to initialize transcription processor:', error);
      return false;
    }
  }

  private startConnectionMonitoring(): void {
    this.connectionCheckInterval = setInterval(() => {
      if (this.isConnected) {
        // Send heartbeat
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.send(JSON.stringify({ type: 'KeepAlive' }));
        }

        // Check for connection timeout
        const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeatTime;
        if (timeSinceLastHeartbeat > 30000) {
          // 30 seconds
          console.warn('Connection heartbeat timeout, reconnecting...');
          this.reconnect();
        }
      }
    }, 10000); // Check every 10 seconds
  }

  private attemptReconnection(): void {
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Attempting reconnection ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`
      );

      setTimeout(() => {
        this.reconnect();
      }, this.config.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
      this.stop();
    }
  }

  private async reconnect(): Promise<void> {
    console.log('Reconnecting transcription service...');

    // Stop current connections
    this.disconnectWebSocket();

    // Reconnect WebSocket
    await this.connectWebSocket();

    // Restart processor if needed
    if (this.mediaStream && this.audioProcessor) {
      await this.audioProcessor.start(this.mediaStream);
    }
  }

  private disconnectWebSocket(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  sendAudioData(audioData: ArrayBuffer): void {
    if (this.isConnected && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      try {
        this.websocket.send(audioData);
      } catch (error) {
        console.error('Error sending audio data:', error);
      }
    }
  }

  private getKeywords(): string[] {
    // Return relevant keywords for better transcription accuracy
    return [
      'interview',
      'candidate',
      'experience',
      'skills',
      'qualifications',
      'position',
      'company',
      'team',
      'project',
      'technology',
    ];
  }

  getConnectionStats(): object {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      lastHeartbeatTime: this.lastHeartbeatTime,
      config: {
        enableHD: this.config.enableHD,
        enableRealtime: this.config.enableRealtime,
        model: this.config.model,
        language: this.config.language,
      },
    };
  }

  stop(): void {
    console.log('Stopping optimized transcription service...');

    // Stop connection monitoring
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }

    // Stop audio processors
    if (this.audioProcessor) {
      this.audioProcessor.stop();
      this.audioProcessor = null;
    }

    if (this.hdProcessor) {
      this.hdProcessor.cleanup();
      this.hdProcessor = null;
    }

    // Disconnect WebSocket
    this.disconnectWebSocket();

    this.isConnected = false;
    this.mediaStream = null;

    console.log('Optimized transcription service stopped');
  }
}
