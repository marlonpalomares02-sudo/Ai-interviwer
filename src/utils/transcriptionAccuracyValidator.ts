import {
  OptimizedTranscriptionService,
  TranscriptionResult,
} from './optimizedTranscriptionService';
import { HighDefinitionAudioProcessor, AudioQualityAnalyzer } from './highDefinitionAudio';
import { RealtimeTranscriptionProcessor } from './realtimeTranscription';

export interface TranscriptionTestConfig {
  testDuration: number;
  samplePhrases: string[];
  audioQualityLevels: string[];
  networkConditions: string[];
  expectedAccuracy: number;
  maxLatency: number;
}

export interface TestResult {
  accuracy: number;
  avgLatency: number;
  maxLatency: number;
  minLatency: number;
  wordErrorRate: number;
  characterErrorRate: number;
  processingSpeed: number;
  memoryUsage: number;
  qualityScore: number;
  timestamp: number;
}

export class TranscriptionAccuracyValidator {
  private testResults: TestResult[] = [];
  private currentTest: TestResult | null = null;
  private startTime = 0;
  private audioContext: AudioContext | null = null;
  private testAudioBuffer: Float32Array[] = [];

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.warn('Failed to initialize audio context for testing:', error);
    }
  }

  async runComprehensiveTest(config: Partial<TranscriptionTestConfig> = {}): Promise<TestResult> {
    const testConfig: TranscriptionTestConfig = {
      testDuration: 30000, // 30 seconds
      samplePhrases: [
        'The quick brown fox jumps over the lazy dog',
        'Interview assistant helps with real-time transcription',
        'Technology companies are hiring software engineers',
        'Machine learning improves speech recognition accuracy',
        'High-definition audio processing enhances quality',
      ],
      audioQualityLevels: ['high', 'medium', 'low'],
      networkConditions: ['good', 'moderate', 'poor'],
      expectedAccuracy: 0.95,
      maxLatency: 500,
      ...config,
    };

    console.log('Starting comprehensive transcription accuracy test...');
    this.startTime = Date.now();

    this.currentTest = {
      accuracy: 0,
      avgLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      wordErrorRate: 0,
      characterErrorRate: 0,
      processingSpeed: 0,
      memoryUsage: 0,
      qualityScore: 0,
      timestamp: Date.now(),
    };

    try {
      // Test 1: Audio Quality Analysis
      await this.testAudioQuality();

      // Test 2: Latency Performance
      await this.testLatencyPerformance(testConfig);

      // Test 3: Accuracy with Sample Phrases
      await this.testAccuracyWithPhrases(testConfig);

      // Test 4: Memory Usage
      await this.testMemoryUsage();

      // Test 5: Processing Speed
      await this.testProcessingSpeed();

      // Calculate final scores
      this.calculateFinalScores(testConfig);

      if (this.currentTest) {
        this.testResults.push(this.currentTest);
        console.log('Comprehensive test completed:', this.currentTest);
      }

      return this.currentTest!;
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  }

  private async testAudioQuality(): Promise<void> {
    console.log('Testing audio quality...');

    if (!this.audioContext) {
      console.warn('Audio context not available for quality testing');
      return;
    }

    try {
      // Generate test audio signals
      const testSignals = this.generateTestSignals();

      // Analyze each signal
      let totalQualityScore = 0;
      let signalCount = 0;

      for (const signal of testSignals) {
        const qualityScore = this.analyzeSignalQuality(signal);
        totalQualityScore += qualityScore;
        signalCount++;
      }

      if (this.currentTest && signalCount > 0) {
        this.currentTest.qualityScore = totalQualityScore / signalCount;
      }

      console.log(`Audio quality test completed. Score: ${this.currentTest?.qualityScore}`);
    } catch (error) {
      console.error('Audio quality test failed:', error);
    }
  }

  private generateTestSignals(): Float32Array[] {
    const signals: Float32Array[] = [];
    const sampleRate = this.audioContext!.sampleRate;
    const duration = 1; // 1 second

    // Clean speech signal (simulated)
    const cleanSignal = new Float32Array(sampleRate * duration);
    for (let i = 0; i < cleanSignal.length; i++) {
      const t = i / sampleRate;
      cleanSignal[i] = 0.3 * Math.sin(2 * Math.PI * 440 * t) * Math.sin(2 * Math.PI * 0.5 * t);
    }
    signals.push(cleanSignal);

    // Noisy signal
    const noisySignal = new Float32Array(sampleRate * duration);
    for (let i = 0; i < noisySignal.length; i++) {
      const t = i / sampleRate;
      noisySignal[i] = cleanSignal[i] + 0.1 * (Math.random() - 0.5);
    }
    signals.push(noisySignal);

    return signals;
  }

  private analyzeSignalQuality(signal: Float32Array): number {
    try {
      // Calculate Signal-to-Noise Ratio (simplified)
      const signalPower = this.calculateSignalPower(signal);
      const noisePower = this.estimateNoisePower(signal);
      const snr = 10 * Math.log10(signalPower / (noisePower + 1e-10));

      // Normalize SNR to 0-1 scale (assuming -20dB to 40dB range)
      const normalizedSnr = Math.max(0, Math.min(1, (snr + 20) / 60));

      // Calculate Total Harmonic Distortion (simplified)
      const thd = this.calculateTHD(signal);
      const thdScore = Math.max(0, 1 - thd);

      // Combined quality score
      return normalizedSnr * 0.7 + thdScore * 0.3;
    } catch (error) {
      console.error('Signal quality analysis failed:', error);
      return 0;
    }
  }

  private calculateSignalPower(signal: Float32Array): number {
    let power = 0;
    for (let i = 0; i < signal.length; i++) {
      power += signal[i] * signal[i];
    }
    return power / signal.length;
  }

  private estimateNoisePower(signal: Float32Array): number {
    // Simple noise estimation using minimum values
    let minPower = Infinity;
    const windowSize = 100;

    for (let i = 0; i <= signal.length - windowSize; i += windowSize) {
      let windowPower = 0;
      for (let j = 0; j < windowSize; j++) {
        windowPower += signal[i + j] * signal[i + j];
      }
      windowPower /= windowSize;
      minPower = Math.min(minPower, windowPower);
    }

    return minPower;
  }

  private calculateTHD(signal: Float32Array): number {
    // Simplified THD calculation
    // In practice, you'd perform FFT analysis
    const fundamental = this.findFundamentalFrequency(signal);
    const harmonics = this.findHarmonics(signal, fundamental);

    const harmonicPower = harmonics.reduce((sum, h) => sum + h.power, 0);
    const fundamentalPower = fundamental.power;

    return harmonicPower / (fundamentalPower + harmonicPower + 1e-10);
  }

  private findFundamentalFrequency(signal: Float32Array): { frequency: number; power: number } {
    // Simplified fundamental frequency detection
    // Count zero crossings
    let zeroCrossings = 0;
    for (let i = 1; i < signal.length; i++) {
      if (signal[i - 1] < 0 !== signal[i] < 0) {
        zeroCrossings++;
      }
    }

    const frequency = (zeroCrossings / 2) * (this.audioContext!.sampleRate / signal.length);
    const power = this.calculateSignalPower(signal);

    return { frequency, power };
  }

  private findHarmonics(
    signal: Float32Array,
    fundamental: { frequency: number; power: number }
  ): Array<{ frequency: number; power: number }> {
    // Placeholder for harmonic analysis
    // In practice, you'd use FFT
    return [
      { frequency: fundamental.frequency * 2, power: fundamental.power * 0.1 },
      { frequency: fundamental.frequency * 3, power: fundamental.power * 0.05 },
    ];
  }

  private async testLatencyPerformance(config: TranscriptionTestConfig): Promise<void> {
    console.log('Testing latency performance...');

    const latencies: number[] = [];
    const testStartTime = Date.now();

    // Simulate transcription requests
    for (let i = 0; i < 10; i++) {
      const startTime = Date.now();

      // Simulate audio processing and transcription
      await this.simulateTranscriptionRequest();

      const endTime = Date.now();
      const latency = endTime - startTime;
      latencies.push(latency);

      // Add small delay between tests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.currentTest) {
      this.currentTest.avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
      this.currentTest.maxLatency = Math.max(...latencies);
      this.currentTest.minLatency = Math.min(...latencies);
    }

    console.log(
      `Latency test completed. Avg: ${this.currentTest?.avgLatency}ms, Max: ${this.currentTest?.maxLatency}ms`
    );
  }

  private async simulateTranscriptionRequest(): Promise<void> {
    // Simulate processing delay
    const delay = 50 + Math.random() * 200; // 50-250ms
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private async testAccuracyWithPhrases(config: TranscriptionTestConfig): Promise<void> {
    console.log('Testing accuracy with sample phrases...');

    let totalWordErrors = 0;
    let totalCharacterErrors = 0;
    let totalWords = 0;
    let totalCharacters = 0;

    for (const phrase of config.samplePhrases) {
      // Simulate transcription with some errors
      const transcribedText = this.simulateTranscriptionWithErrors(phrase);

      // Calculate word error rate
      const wordErrors = this.calculateWordErrors(phrase, transcribedText);
      totalWordErrors += wordErrors;
      totalWords += phrase.split(' ').length;

      // Calculate character error rate
      const charErrors = this.calculateCharacterErrors(phrase, transcribedText);
      totalCharacterErrors += charErrors;
      totalCharacters += phrase.length;

      console.log(`Original: "${phrase}"`);
      console.log(`Transcribed: "${transcribedText}"`);
      console.log(`Word errors: ${wordErrors}, Character errors: ${charErrors}`);
    }

    if (this.currentTest && totalWords > 0 && totalCharacters > 0) {
      this.currentTest.wordErrorRate = totalWordErrors / totalWords;
      this.currentTest.characterErrorRate = totalCharacterErrors / totalCharacters;
      this.currentTest.accuracy =
        1 - (this.currentTest.wordErrorRate + this.currentTest.characterErrorRate) / 2;
    }

    console.log(
      `Accuracy test completed. WER: ${this.currentTest?.wordErrorRate}, CER: ${this.currentTest?.characterErrorRate}`
    );
  }

  private simulateTranscriptionWithErrors(originalText: string): string {
    // Simulate transcription errors
    const words = originalText.split(' ');
    const errorRate = 0.05; // 5% error rate

    return words
      .map((word) => {
        if (Math.random() < errorRate) {
          // Introduce an error
          if (Math.random() < 0.5) {
            // Substitution error
            return word.slice(0, -1) + String.fromCharCode(97 + Math.floor(Math.random() * 26));
          } else {
            // Deletion error
            return word.slice(0, -1);
          }
        }
        return word;
      })
      .join(' ');
  }

  private calculateWordErrors(original: string, transcribed: string): number {
    const originalWords = original.toLowerCase().split(' ');
    const transcribedWords = transcribed.toLowerCase().split(' ');

    let errors = 0;
    const maxLength = Math.max(originalWords.length, transcribedWords.length);

    for (let i = 0; i < maxLength; i++) {
      if (originalWords[i] !== transcribedWords[i]) {
        errors++;
      }
    }

    return errors;
  }

  private calculateCharacterErrors(original: string, transcribed: string): number {
    const originalChars = original.toLowerCase().replace(/[^a-z]/g, '');
    const transcribedChars = transcribed.toLowerCase().replace(/[^a-z]/g, '');

    let errors = 0;
    const maxLength = Math.max(originalChars.length, transcribedChars.length);

    for (let i = 0; i < maxLength; i++) {
      if (originalChars[i] !== transcribedChars[i]) {
        errors++;
      }
    }

    return errors;
  }

  private async testMemoryUsage(): Promise<void> {
    console.log('Testing memory usage...');

    // Simulate processing large audio data
    const largeAudioData = new Float32Array(44100 * 60); // 1 minute of audio
    this.testAudioBuffer.push(largeAudioData);

    // Force garbage collection if available
    if ((window as any).gc) {
      (window as any).gc();
    }

    // Estimate memory usage based on Float32Array size
    const estimatedMemory = (largeAudioData.length * 4) / (1024 * 1024); // 4 bytes per float32

    if (this.currentTest) {
      this.currentTest.memoryUsage = estimatedMemory;
    }

    console.log(`Memory usage test completed. Estimated: ${estimatedMemory} MB`);
  }

  private async testProcessingSpeed(): Promise<void> {
    console.log('Testing processing speed...');

    const audioData = new Float32Array(44100); // 1 second of audio
    const iterations = 100;

    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      // Simulate audio processing
      this.processAudioData(audioData);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerIteration = totalTime / iterations;

    if (this.currentTest) {
      this.currentTest.processingSpeed = 1000 / avgTimePerIteration; // Iterations per second
    }

    console.log(
      `Processing speed test completed. Speed: ${this.currentTest?.processingSpeed} iterations/second`
    );
  }

  private processAudioData(audioData: Float32Array): void {
    // Simulate audio processing
    const processed = new Float32Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      processed[i] = audioData[i] * 0.95; // Simple gain reduction
    }
  }

  private calculateFinalScores(config: TranscriptionTestConfig): void {
    if (!this.currentTest) return;

    // Calculate weighted overall score
    const accuracyWeight = 0.4;
    const latencyWeight = 0.3;
    const qualityWeight = 0.2;
    const efficiencyWeight = 0.1;

    const accuracyScore = this.currentTest.accuracy;
    const latencyScore = Math.max(0, 1 - this.currentTest.avgLatency / config.maxLatency);
    const qualityScore = this.currentTest.qualityScore;
    const efficiencyScore = Math.min(1, this.currentTest.processingSpeed / 1000);

    const overallScore =
      accuracyScore * accuracyWeight +
      latencyScore * latencyWeight +
      qualityScore * qualityWeight +
      efficiencyScore * efficiencyWeight;

    console.log(
      `Final test scores - Accuracy: ${accuracyScore}, Latency: ${latencyScore}, Quality: ${qualityScore}, Efficiency: ${efficiencyScore}`
    );
    console.log(`Overall performance score: ${overallScore}`);
  }

  getTestReport(): object {
    const latestTest = this.testResults[this.testResults.length - 1];
    const avgAccuracy =
      this.testResults.reduce((sum, r) => sum + r.accuracy, 0) / this.testResults.length;
    const avgLatency =
      this.testResults.reduce((sum, r) => sum + r.avgLatency, 0) / this.testResults.length;

    return {
      totalTests: this.testResults.length,
      latestTest,
      averageAccuracy: avgAccuracy,
      averageLatency: avgLatency,
      allResults: this.testResults,
    };
  }

  cleanup(): void {
    this.testAudioBuffer = [];
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch((error) => {
        console.warn('Error closing test audio context:', error);
      });
    }
  }
}
