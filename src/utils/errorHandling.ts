export class AudioErrorHandler {
  static safeAudioOperation = async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      console.error(`Audio operation failed (${operationName}):`, error);
      return null;
    }
  };

  static validateAudioStream = async (stream: MediaStream): Promise<boolean> => {
    try {
      if (!stream) {
        console.warn('Audio stream is null or undefined');
        return false;
      }

      const audioTracks = stream.getAudioTracks();
      console.log(`Validating audio stream with ${audioTracks.length} tracks`);

      if (audioTracks.length === 0) {
        console.warn('Audio stream has no audio tracks');
        return false;
      }

      // Check all tracks, not just the first one
      const validTracks = audioTracks.filter((track) => {
        console.log(
          `Audio track state: readyState=${track.readyState}, enabled=${track.enabled}, muted=${track.muted}`
        );

        // More lenient validation - consider track valid if it's live OR enabled and not muted
        const isValid = track.readyState === 'live' || (track.enabled && !track.muted);

        if (!isValid) {
          console.warn(
            `Track ${track.id} is not valid - readyState: ${track.readyState}, enabled: ${track.enabled}, muted: ${track.muted}`
          );
        }

        return isValid;
      });

      if (validTracks.length === 0) {
        console.warn('No valid audio tracks found');
        return false;
      }

      console.log(`Audio stream validation passed with ${validTracks.length} valid tracks`);
      return true;
    } catch (error) {
      console.error('Audio stream validation failed:', error);
      return false;
    }
  };

  static safeAudioContextCreation = (options?: AudioContextOptions): AudioContext | null => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.error('AudioContext is not supported in this browser');
        return null;
      }

      return new AudioContextClass(options);
    } catch (error) {
      console.error('Failed to create AudioContext:', error);
      return null;
    }
  };

  static cleanupAudioResources = (
    stream: MediaStream | null,
    audioContext: AudioContext | null,
    processor: ScriptProcessorNode | null
  ): void => {
    try {
      // Clean up stream
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
          stream.removeTrack(track);
        });
      }

      // Clean up audio context
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch((error) => {
          console.warn('Error closing audio context:', error);
        });
      }

      // Clean up processor
      if (processor) {
        processor.disconnect();
      }
    } catch (error) {
      console.error('Error during audio resource cleanup:', error);
    }
  };
}
