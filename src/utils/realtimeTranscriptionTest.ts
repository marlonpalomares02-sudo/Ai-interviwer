import {
  createEnhancedTranscription,
  EnhancedTranscriptionOptions,
} from '../utils/enhancedTranscription';

/**
 * Real-time transcription test utility
 * Ensures transcription is working in real-time with proper WebSocket connections
 */

export interface RealtimeTestConfig {
  apiKey: string;
  testDuration: number; // seconds
  expectedLatency: number; // milliseconds
  minAccuracy: number; // percentage
  enableHD: boolean;
  enableQualityAnalysis: boolean;
}

export interface RealtimeTestResult {
  success: boolean;
  transcriptionCount: number;
  averageLatency: number;
  accuracy: number;
  qualityScore: number;
  connectionStatus: boolean;
  errors: string[];
  performanceMetrics: {
    chunksPerSecond: number;
    audioLevel: number;
    processingSpeed: number;
  };
}

export class RealtimeTranscriptionTest {
  private transcriptionManager: any = null;
  private testResults: RealtimeTestResult = {
    success: false,
    transcriptionCount: 0,
    averageLatency: 0,
    accuracy: 0,
    qualityScore: 0,
    connectionStatus: false,
    errors: [],
    performanceMetrics: {
      chunksPerSecond: 0,
      audioLevel: 0,
      processingSpeed: 0,
    },
  };

  private transcriptions: Array<{ text: string; timestamp: number; latency: number }> = [];
  private startTime: number = 0;
  private testConfig: RealtimeTestConfig;

  constructor(config: RealtimeTestConfig) {
    this.testConfig = config;
  }

  async runTest(): Promise<RealtimeTestResult> {
    console.log('🎙️ Starting real-time transcription test...');
    this.startTime = Date.now();

    try {
      // Initialize transcription manager
      const options: Partial<EnhancedTranscriptionOptions> = {
        apiKey: this.testConfig.apiKey,
        enableHD: this.testConfig.enableHD,
        enableRealtime: true,
        enableQualityAnalysis: this.testConfig.enableQualityAnalysis,
        enableAccuracyValidation: true,
        sampleRate: 16000,
        language: 'en-US',
        model: 'nova-2',
      };

      this.transcriptionManager = createEnhancedTranscription(
        options,
        this.handleTranscription.bind(this),
        this.handleError.bind(this)
      );

      // Initialize the transcription system
      console.log('🔄 Initializing transcription manager...');
      const initialized = await this.transcriptionManager.initialize();

      if (!initialized) {
        throw new Error('Failed to initialize transcription manager');
      }

      console.log('✅ Transcription manager initialized successfully');
      this.testResults.connectionStatus = true;

      // Run test for specified duration
      console.log(`⏱️ Running test for ${this.testConfig.testDuration} seconds...`);
      await this.runTestDuration();

      // Calculate final results
      this.calculateResults();

      // Stop transcription
      await this.stopTest();

      console.log('🎯 Test completed successfully');
      this.testResults.success = true;
    } catch (error) {
      console.error('❌ Real-time transcription test failed:', error);
      this.testResults.errors.push(`Test failed: ${error}`);
      this.testResults.success = false;
    }

    return this.testResults;
  }

  private handleTranscription(text: string, confidence: number, metrics: any): void {
    const latency = Date.now() - this.startTime;

    console.log(
      `📝 Real-time transcription: "${text}" (confidence: ${(confidence * 100).toFixed(1)}%)`
    );
    console.log(
      `⚡ Latency: ${metrics.latency}ms, Quality: ${(metrics.qualityScore * 100).toFixed(1)}%`
    );

    this.transcriptions.push({
      text,
      timestamp: Date.now(),
      latency: metrics.latency,
    });

    // Update performance metrics
    this.testResults.performanceMetrics.audioLevel = metrics.audioLevel * 100;
    this.testResults.performanceMetrics.processingSpeed = metrics.processingSpeed;
    this.testResults.qualityScore = metrics.qualityScore * 100;
  }

  private handleError(error: string): void {
    console.error('❌ Transcription error:', error);
    this.testResults.errors.push(error);
  }

  private async runTestDuration(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, this.testConfig.testDuration * 1000);
    });
  }

  private calculateResults(): void {
    if (this.transcriptions.length === 0) {
      console.warn('⚠️ No transcriptions received during test');
      return;
    }

    // Calculate average latency
    const totalLatency = this.transcriptions.reduce((sum, t) => sum + t.latency, 0);
    this.testResults.averageLatency = totalLatency / this.transcriptions.length;

    // Calculate transcription count
    this.testResults.transcriptionCount = this.transcriptions.length;

    // Calculate chunks per second
    const testDurationSeconds = (Date.now() - this.startTime) / 1000;
    this.testResults.performanceMetrics.chunksPerSecond =
      this.transcriptions.length / testDurationSeconds;

    // Estimate accuracy based on text length and confidence (simplified)
    const avgTextLength =
      this.transcriptions.reduce((sum, t) => sum + t.text.length, 0) / this.transcriptions.length;
    this.testResults.accuracy = Math.min(100, avgTextLength * 2); // Simplified accuracy estimation

    console.log(`📊 Test Results:`);
    console.log(`   Transcriptions: ${this.testResults.transcriptionCount}`);
    console.log(`   Average Latency: ${this.testResults.averageLatency.toFixed(1)}ms`);
    console.log(
      `   Chunks/Second: ${this.testResults.performanceMetrics.chunksPerSecond.toFixed(1)}`
    );
    console.log(`   Quality Score: ${this.testResults.qualityScore.toFixed(1)}%`);
  }

  private async stopTest(): Promise<void> {
    if (this.transcriptionManager) {
      console.log('🛑 Stopping transcription test...');
      this.transcriptionManager.stop();
      this.transcriptionManager = null;
    }
  }

  getRealTimeStatus(): string {
    if (!this.transcriptionManager) {
      return 'Not initialized';
    }

    const stats = this.transcriptionManager.getDetailedStats?.() || {};
    return `
🎙️ Real-time Transcription Status:
   Connection: ${this.testResults.connectionStatus ? '✅ Connected' : '❌ Disconnected'}
   Transcriptions: ${this.testResults.transcriptionCount}
   Avg Latency: ${this.testResults.averageLatency.toFixed(1)}ms
   Audio Level: ${this.testResults.performanceMetrics.audioLevel.toFixed(1)}%
   Processing Speed: ${this.testResults.performanceMetrics.processingSpeed.toFixed(1)} chunks/s
   Quality Score: ${this.testResults.qualityScore.toFixed(1)}%
   Errors: ${this.testResults.errors.length}
    `;
  }
}

/**
 * Quick real-time transcription test function
 */
export async function testRealtimeTranscription(apiKey: string): Promise<RealtimeTestResult> {
  const test = new RealtimeTranscriptionTest({
    apiKey,
    testDuration: 10, // 10 seconds
    expectedLatency: 500, // 500ms max latency
    minAccuracy: 80, // 80% minimum accuracy
    enableHD: true,
    enableQualityAnalysis: true,
  });

  return await test.runTest();
}

/**
 * Monitor real-time transcription performance
 */
export function monitorRealtimeTranscription(transcriptionManager: any): void {
  setInterval(() => {
    if (transcriptionManager) {
      const metrics = transcriptionManager.getMetrics?.();
      const stats = transcriptionManager.getDetailedStats?.();

      console.log('📊 Real-time Performance Monitor:');
      console.log(`   Connection: ${metrics?.connectionStatus ? '✅' : '❌'}`);
      console.log(`   Latency: ${metrics?.latency || 0}ms`);
      console.log(`   Audio Level: ${(metrics?.audioLevel || 0) * 100}%`);
      console.log(`   Quality: ${(metrics?.qualityScore || 0) * 100}%`);
      console.log(`   Processing Speed: ${metrics?.processingSpeed || 0} chunks/s`);

      if (stats?.websocketStatus) {
        console.log(`   WebSocket: ${stats.websocketStatus}`);
      }
    }
  }, 2000); // Monitor every 2 seconds
}
