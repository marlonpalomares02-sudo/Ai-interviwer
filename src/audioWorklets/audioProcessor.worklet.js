/**
 * Audio Worklet Processor for real-time audio processing
 * Replaces deprecated ScriptProcessorNode with AudioWorkletNode
 */
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
      
      // Optional: Pass-through the down-mixed audio to the first output channel for monitoring
      const output = outputs[0];
      if (output && output.length > 0) {
        output[0].set(monoSamples);
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