/**
 * Audio Worklet Manager - Replaces ScriptProcessorNode with AudioWorkletNode
 * Provides zero-latency audio processing for transcription
 */

export class AudioWorkletManager {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private audioCallback: ((samples: Float32Array) => void) | null = null;
  private isProcessing = false;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  /**
   * Initialize Audio Worklet with processor
   */
  async initialize(): Promise<boolean> {
    if (!this.audioContext) {
      console.error('Audio context not available');
      return false;
    }

    try {
      // Check if AudioWorklet is supported
      if (!this.audioContext.audioWorklet) {
        console.error('AudioWorklet not supported in this browser');
        return false;
      }

      // Try multiple approaches to load the worklet module
      let moduleLoaded = false;

      try {
        // Method 1: Try with webpack asset path (for development)
        await this.audioContext.audioWorklet.addModule('/audioWorklets/audioProcessor.worklet.js');
        moduleLoaded = true;
        console.log('Audio Worklet module loaded with webpack asset path');
      } catch (error) {
        console.warn('Failed to load with webpack asset path, trying relative path:', error);

        try {
          // Method 2: Try with relative path (for Electron production)
          await this.audioContext.audioWorklet.addModule('./audioWorklets/audioProcessor.worklet.js');
          moduleLoaded = true;
          console.log('Audio Worklet module loaded with relative path');
        } catch (error2) {
          console.warn('Failed to load with relative path, trying blob fallback:', error2);

          try {
            // Method 3: Try with blob URL as fallback
            const workletCode = `
              class AudioProcessor extends AudioWorkletProcessor {
                constructor() {
                  super();
                  this.bufferSize = 4096;
                  this.sampleBuffer = new Float32Array(this.bufferSize);
                  this.bufferIndex = 0;
                }

                process(inputs, outputs, parameters) {
                  const input = inputs[0];
                  
                  if (input && input.length > 0) {
                    const numSamples = input[0].length;
                    let monoSamples;

                    if (input.length > 1) {
                      // Downmix multi-channel audio to mono by averaging
                      monoSamples = new Float32Array(numSamples);
                      for (let i = 0; i < numSamples; i++) {
                        let sum = 0;
                        for (let j = 0; j < input.length; j++) {
                          sum += input[j][i];
                        }
                        monoSamples[i] = sum / input.length;
                      }
                    } else {
                      // If already mono, just use the first channel directly
                      monoSamples = input[0];
                    }
                    
                    // Robustly accumulate down-mixed samples in the buffer
                    let offset = 0;
                    while (offset < monoSamples.length) {
                      const remainingInBuffer = this.bufferSize - this.bufferIndex;
                      const chunk = monoSamples.subarray(offset, offset + remainingInBuffer);
                      
                      this.sampleBuffer.set(chunk, this.bufferIndex);
                      this.bufferIndex += chunk.length;
                      offset += chunk.length;
                      
                      // When buffer is full, send it to the main thread
                      if (this.bufferIndex >= this.bufferSize) {
                        this.port.postMessage({
                          type: 'audio-data',
                          samples: new Float32Array(this.sampleBuffer)
                        });
                        this.bufferIndex = 0; // Reset buffer
                      }
                    }
                  }
                  
                  // Keep the processor alive
                  return true;
                }
              }

              registerProcessor('audio-processor', AudioProcessor);
            `;

            const blob = new Blob([workletCode], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            await this.audioContext.audioWorklet.addModule(blobUrl);
            URL.revokeObjectURL(blobUrl);
            moduleLoaded = true;
            console.log('Audio Worklet module loaded with blob URL');
          } catch (error3) {
            console.error('All Audio Worklet loading methods failed:', error3);
            return false;
          }
        }
      }

      if (!moduleLoaded) {
        return false;
      }

      // Create the worklet node with error handling
      try {
        this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor', {
          processorOptions: {
            bufferSize: 4096,
            channelCount: 1,
          },
          numberOfInputs: 1,
          numberOfOutputs: 0,
        });
      } catch (error) {
        console.error('Failed to create AudioWorkletNode:', error);
        return false;
      }

      // Set up message handling from worklet
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio-data' && this.audioCallback) {
          this.audioCallback(event.data.samples);
        }
      };

      // Handle processor errors
      this.workletNode.onprocessorerror = (error) => {
        console.error('Audio Worklet processor error:', error);
      };

      console.log('Audio Worklet initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Audio Worklet:', error);
      return false;
    }
  }

  /**
   * Start processing audio from media stream
   */
  async startProcessing(
    stream: MediaStream,
    callback: (samples: Float32Array) => void
  ): Promise<boolean> {
    if (!this.audioContext || !this.workletNode) {
      console.error('Audio Worklet not initialized');
      return false;
    }

    try {
      this.audioCallback = callback;

      // Create media stream source
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);

      // Connect source to worklet node for processing only
      this.sourceNode.connect(this.workletNode);

      // IMPORTANT: Do NOT connect to destination to prevent audio playback and feedback
      // The worklet processes audio silently for transcription only

      this.isProcessing = true;
      console.log('Audio Worklet processing started (silent mode)');
      return true;
    } catch (error) {
      console.error('Failed to start Audio Worklet processing:', error);
      return false;
    }
  }

  /**
   * Stop processing audio
   */
  stopProcessing(): void {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode.port.onmessage = null;
      this.workletNode = null;
    }

    this.audioCallback = null;
    this.isProcessing = false;
    console.log('Audio Worklet processing stopped');
  }

  /**
   * Check if currently processing
   */
  getProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Get the current worklet node (for advanced usage)
   */
  getWorkletNode(): AudioWorkletNode | null {
    return this.workletNode;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopProcessing();
    this.audioContext = null;
  }
}
