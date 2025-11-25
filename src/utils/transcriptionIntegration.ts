/**
 * Transcription Integration Module
 * Provides seamless integration between existing code and new optimization features
 * without modifying or eliminating any existing code or design elements
 */

import {
  transcriptionOptimizer,
  TranscriptionOptimizer,
  createHighQualityAudioStream,
  processAudioWithEnhancement,
} from './transcriptionOptimizer';
import { createStableAudioStream, processAudioForDeepgram } from './audioUtils';

/**
 * Enhanced transcription integration that works alongside existing code
 */
export class TranscriptionIntegration {
  private optimizer: TranscriptionOptimizer;
  private isOptimizedMode = false;
  private originalAudioProcessing: ((inputData: Float32Array) => Int16Array) | null = null;

  constructor() {
    this.optimizer = new TranscriptionOptimizer();
  }

  /**
   * Enable optimized transcription mode
   * This works alongside existing code without replacing it
   */
  public enableOptimizedMode(): void {
    this.isOptimizedMode = true;
    console.log('Enhanced transcription optimization enabled');
  }

  /**
   * Disable optimized transcription mode
   * Falls back to original functionality
   */
  public disableOptimizedMode(): void {
    this.isOptimizedMode = false;
    console.log('Enhanced transcription optimization disabled');
  }

  /**
   * Get optimized audio stream that works with existing code
   */
  public async getOptimizedAudioStream(
    constraints?: MediaStreamConstraints
  ): Promise<MediaStream | null> {
    if (this.isOptimizedMode) {
      console.log('Using high-quality optimized audio stream');
      return await createHighQualityAudioStream(constraints);
    } else {
      console.log('Using standard audio stream');
      return await createStableAudioStream(constraints);
    }
  }

  /**
   * Process audio with optimization if enabled
   * Falls back to original processing if disabled
   */
  public processAudio(inputData: Float32Array): Int16Array {
    if (this.isOptimizedMode) {
      return processAudioWithEnhancement(inputData);
    } else {
      return processAudioForDeepgram(inputData);
    }
  }

  /**
   * Enhanced transcript processing with confidence scoring
   * Works alongside existing transcript handling
   */
  public processTranscript(transcriptData: any): {
    transcript: string;
    isFinal: boolean;
    confidence: number;
    shouldUpdate: boolean;
    isOptimized: boolean;
  } {
    if (this.isOptimizedMode) {
      const result = this.optimizer.processTranscript(transcriptData);
      return {
        ...result,
        isOptimized: true,
      };
    } else {
      // Return basic processing for compatibility
      const transcript = transcriptData.transcript?.trim() || '';
      const isFinal = transcriptData.is_final || false;

      return {
        transcript,
        isFinal,
        confidence: 0.8, // Default confidence
        shouldUpdate: true, // Always update in basic mode
        isOptimized: false,
      };
    }
  }

  /**
   * Initialize optimized audio processing for a stream
   */
  public async initializeOptimizedProcessing(stream: MediaStream): Promise<boolean> {
    if (this.isOptimizedMode) {
      return await this.optimizer.initializeAudioProcessing(stream);
    }
    return false; // Use existing processing
  }

  /**
   * Get transcription statistics (only available in optimized mode)
   */
  public getStatistics() {
    if (this.isOptimizedMode) {
      return this.optimizer.getStatistics();
    }
    return null;
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.isOptimizedMode) {
      this.optimizer.cleanup();
    }
  }

  /**
   * Update optimization configuration
   */
  public updateConfig(config: any): void {
    if (this.isOptimizedMode) {
      this.optimizer.updateConfig(config);
    }
  }

  /**
   * Check if optimized mode is enabled
   */
  public isOptimized(): boolean {
    return this.isOptimizedMode;
  }
}

// Export singleton instance for easy access
export const transcriptionIntegration = new TranscriptionIntegration();

/**
 * Integration hooks for existing codebase
 * These functions can be called from existing code to enable optimizations
 */

/**
 * Enable transcription optimizations in existing code
 * Call this function to activate enhanced features
 */
export const enableTranscriptionOptimizations = (): void => {
  transcriptionIntegration.enableOptimizedMode();
  console.log(
    'Transcription optimizations enabled - realtime, accurate, high-definition features activated'
  );
};

/**
 * Disable transcription optimizations
 * Call this function to return to original functionality
 */
export const disableTranscriptionOptimizations = (): void => {
  transcriptionIntegration.disableOptimizedMode();
  console.log('Transcription optimizations disabled - using original functionality');
};

/**
 * Get optimized audio stream for use in existing code
 * This can replace existing getAudioStream calls with enhanced quality
 */
export const getOptimizedAudioStream = async (
  constraints?: MediaStreamConstraints
): Promise<MediaStream | null> => {
  return await transcriptionIntegration.getOptimizedAudioStream(constraints);
};

/**
 * Enhanced audio processing for use in existing code
 * This can replace existing audio processing calls
 */
export const enhancedAudioProcessing = (inputData: Float32Array): Int16Array => {
  return transcriptionIntegration.processAudio(inputData);
};

/**
 * Enhanced transcript processing for use in existing code
 * This can enhance existing transcript handling
 */
export const enhancedTranscriptProcessing = (
  transcriptData: any
): {
  transcript: string;
  isFinal: boolean;
  confidence: number;
  shouldUpdate: boolean;
  isOptimized: boolean;
} => {
  return transcriptionIntegration.processTranscript(transcriptData);
};

/**
 * Integration helper for existing audio processing
 * This wraps existing audio processing with optimizations
 */
export const integrateWithExistingAudioProcessing = (
  originalProcessor: (inputData: Float32Array) => Int16Array
) => {
  return (inputData: Float32Array): Int16Array => {
    if (transcriptionIntegration.isOptimized()) {
      return enhancedAudioProcessing(inputData);
    } else {
      return originalProcessor(inputData);
    }
  };
};

/**
 * Quick status check for optimizations
 */
export const getOptimizationStatus = () => {
  return {
    isOptimized: transcriptionIntegration.isOptimized(),
    statistics: transcriptionIntegration.getStatistics(),
  };
};
