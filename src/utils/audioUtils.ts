export const createStableAudioStream = async (
  constraints?: MediaStreamConstraints
): Promise<MediaStream | null> => {
  try {
    const defaultAudioConstraints = {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    let finalConstraints: MediaStreamConstraints;

    if (constraints?.audio && typeof constraints.audio === 'object') {
      // Merge user constraints with defaults
      finalConstraints = {
        audio: { ...defaultAudioConstraints, ...constraints.audio },
        video: false,
      };
    } else {
      // Use default constraints
      finalConstraints = {
        audio: defaultAudioConstraints,
        video: false,
      };
    }

    console.log(
      'Requesting audio stream with constraints:',
      JSON.stringify(finalConstraints, null, 2)
    );

    const stream = await navigator.mediaDevices.getUserMedia(finalConstraints);

    // Enhanced stream validation
    const tracks = stream.getAudioTracks();
    console.log(`Audio stream created with ${tracks.length} tracks`);

    if (tracks.length === 0) {
      console.error('No audio tracks created in stream');
      return null;
    }

    // Ensure tracks are in the correct state
    tracks.forEach((track, index) => {
      console.log(`Track ${index}:`, {
        kind: track.kind,
        readyState: track.readyState,
        enabled: track.enabled,
        muted: track.muted,
        settings: track.getSettings(),
      });

      // Force enable track if disabled
      if (!track.enabled) {
        console.warn(`Track ${index} was disabled, enabling it`);
        track.enabled = true;
      }
    });

    // Add comprehensive event listeners for track state changes
    tracks.forEach((track) => {
      track.onended = () => console.log('Audio track ended:', track.id);
      track.onmute = () => console.log('Audio track muted:', track.id);
      track.onunmute = () => console.log('Audio track unmuted:', track.id);

      // Add oninactive event for better stream monitoring
      if ('oninactive' in track) {
        (track as any).oninactive = () => console.log('Audio track became inactive:', track.id);
      }
    });

    // Add stream-level event listeners
    stream.onaddtrack = (event) => {
      console.log('Track added to stream:', event.track.id);
    };

    stream.onremovetrack = (event) => {
      console.log('Track removed from stream:', event.track.id);
    };

    // Initial health check
    const healthCheck = () => {
      const currentTracks = stream.getAudioTracks();
      const liveTracks = currentTracks.filter((track) => track.readyState === 'live');
      console.log(`Stream health: ${liveTracks.length}/${currentTracks.length} tracks are live`);
      return liveTracks.length > 0;
    };

    if (!healthCheck()) {
      console.warn('Stream created but no live tracks detected');
    }

    return stream;
  } catch (error) {
    console.error('Failed to create audio stream:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      if (error.name === 'NotAllowedError') {
        console.error('Microphone permission denied by user');
        // Show a more user-friendly message
        alert(
          'Microphone access is required for recording. Please allow microphone access in your browser settings.'
        );
      } else if (error.name === 'NotFoundError') {
        console.error('No microphone device found');
        alert('No microphone device found. Please ensure a microphone is connected.');
      } else if (error.name === 'NotReadableError') {
        console.error('Microphone is already in use by another application');
        alert(
          'Microphone is already in use by another application. Please close other applications using the microphone.'
        );
      } else if (error.name === 'OverconstrainedError') {
        console.error('Audio constraints not supported:', error.message);
        // Try with minimal constraints
        console.log('Attempting fallback with minimal constraints...');
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          console.log('Fallback audio stream created successfully');
          return fallbackStream;
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
        }
      }
    }
    return null;
  }
};

export const createScreenShareStream = async (
  sourceId?: string,
  opts?: { withAudio?: boolean }
): Promise<MediaStream | null> => {
  try {
    // Handle special system audio selection
    if (sourceId === 'system-audio') {
      console.log('Creating dedicated system audio stream for video conferencing apps...');

      // Enhanced constraints for better system audio capture
      const constraints = {
        audio: {
          // Use chromeMediaSource in the main constraint object, not mandatory
          // @ts-ignore - Chrome-specific constraint
          chromeMediaSource: 'desktop',
          sampleRate: 16000,
          channelCount: 2, // Stereo for better quality
          echoCancellation: false, // Disable for system audio
          noiseSuppression: false, // Disable for system audio
          autoGainControl: false, // Disable for system audio
          // Add additional constraints for better capture
          latency: 0, // Low latency for real-time processing
          sampleSize: 16, // 16-bit samples
        } as MediaTrackConstraints,
        video: false, // Audio only for system capture
      };

      console.log('Requesting system audio capture:', JSON.stringify(constraints, null, 2));

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      } catch (error) {
        console.warn('Primary system audio capture failed, trying fallback constraints:', error);
        // Fallback: Try with simpler constraints
        const fallbackConstraints = {
          audio: true, // Just request audio without specific constraints
          video: false,
        };
        stream = await navigator.mediaDevices.getDisplayMedia(fallbackConstraints);
      }

      // Enhanced stream validation for transcription
      const audioTracks = stream.getAudioTracks();
      console.log(`System audio stream created: ${audioTracks.length} audio tracks`);

      if (audioTracks.length > 0) {
        const settings = audioTracks[0].getSettings();
        console.log('System audio track settings:', settings);

        // Validate audio track for transcription
        if (settings.sampleRate !== 16000) {
          console.warn(
            `Audio sample rate ${settings.sampleRate} may not be optimal for transcription (expected 16000)`
          );
        }

        // Add track monitoring for transcription
        audioTracks[0].onmute = () =>
          console.warn('System audio track muted - transcription may be affected');
        audioTracks[0].onunmute = () => console.log('System audio track unmuted');
        
        // Enable the track immediately
        audioTracks[0].enabled = true;
        console.log('System audio track enabled and ready for transcription');
      } else {
        console.warn('No audio tracks found in system audio stream');
        return null;
      }

      return stream;
    }
    if (sourceId === 'system-picker') {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: opts?.withAudio ? true : false,
        video: true,
      });
      return stream;
    }

    // Enhanced constraints for system audio capture from applications
    // Use getDisplayMedia for screen sharing with audio
    const constraints = {
      audio: {
        // @ts-ignore - Chrome-specific constraint
        chromeMediaSource: 'desktop',
        sampleRate: 16000,
        channelCount: 2, // Stereo for better quality
        echoCancellation: false, // Disable for system audio
        noiseSuppression: false, // Disable for system audio
        autoGainControl: false, // Disable for system audio
        // Add additional constraints for better capture
        latency: 0, // Low latency for real-time processing
        sampleSize: 16, // 16-bit samples
      },
      video: {
        // @ts-ignore - Chrome-specific constraint
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId || 'screen:0:0',
      },
    };

    console.log('Requesting screen share with system audio:', JSON.stringify(constraints, null, 2));

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        audio: opts?.withAudio ? (constraints.audio as any) : false,
        video: constraints.video as any,
      });
    } catch (error) {
      console.warn('Primary screen share capture failed, trying fallback:', error);
      // Fallback: Try with simpler constraints
      const fallbackConstraints = {
        audio: opts?.withAudio ? true : false,
        video: true,
      };
      stream = await navigator.mediaDevices.getDisplayMedia(fallbackConstraints);
    }

    // Log stream details
    const audioTracks = stream.getAudioTracks();
    const videoTracks = stream.getVideoTracks();
    console.log(
      `Screen share stream created: ${audioTracks.length} audio tracks, ${videoTracks.length} video tracks`
    );

    if (audioTracks.length > 0) {
      const settings = audioTracks[0].getSettings();
      console.log('System audio track settings:', settings);
      
      // Enable the track immediately
      audioTracks[0].enabled = true;
      
      // Add track monitoring for transcription
      audioTracks[0].onmute = () =>
        console.warn('Screen share audio track muted - transcription may be affected');
      audioTracks[0].onunmute = () => console.log('Screen share audio track unmuted');
      
      console.log('Screen share audio track enabled and ready for transcription');
    } else if (opts?.withAudio) {
      console.warn('Screen share requested with audio but no audio tracks found');
      // Still return the stream so video can work, but warn about audio
    }

    return stream;
  } catch (error) {
    console.error('Failed to create screen share stream:', error);

    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);

      if (error.name === 'NotAllowedError') {
        alert('Screen recording permission denied. Please allow screen recording access.');
      } else if (error.name === 'NotFoundError') {
        alert('No screen capture sources found.');
      } else {
        alert('Screen recording failed: ' + error.message);
      }
    }

    try {
      const audioConstraints = {
        audio: {
          // @ts-ignore - Chrome-specific constraint
          chromeMediaSource: 'desktop',
          sampleRate: 16000,
          channelCount: 2,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } as MediaTrackConstraints,
        video: false,
      };

      const audioStream = await navigator.mediaDevices.getDisplayMedia(audioConstraints);
      console.log('Fallback audio-only system capture successful');
      return audioStream;
    } catch (fallbackError) {
      console.error('Fallback audio capture also failed:', fallbackError);
      return null;
    }
  }
};

export const monitorStreamHealth = (
  stream: MediaStream,
  onDisconnect: () => void
): (() => void) => {
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 3; // Allow 3 consecutive failures before disconnecting

  const checkHealth = () => {
    try {
      const audioTracks = stream.getAudioTracks();
      console.log(`Audio stream health check: ${audioTracks.length} tracks found`);

      if (audioTracks.length === 0) {
        console.warn('No audio tracks found in stream');
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          onDisconnect();
        }
        return;
      }

      audioTracks.forEach((track, index) => {
        console.log(
          `Track ${index}: readyState=${track.readyState}, kind=${track.kind}, enabled=${track.enabled}, muted=${track.muted}`
        );
      });

      // More lenient health check - consider stream healthy if any track is live OR enabled
      const isHealthy = audioTracks.some(
        (track) => track.readyState === 'live' || (track.enabled && !track.muted)
      );

      if (!isHealthy) {
        console.warn(
          `Audio stream health check failed - no live/enabled tracks (attempt ${consecutiveFailures + 1}/${MAX_CONSECUTIVE_FAILURES})`
        );
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          onDisconnect();
        }
        return;
      }

      // Reset failure counter on successful health check
      consecutiveFailures = 0;
      console.log('Audio stream health check passed');
    } catch (error) {
      console.error('Error during audio stream health check:', error);
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        onDisconnect();
      }
    }
  };

  // Increase check interval to 10 seconds to reduce false positives
  const intervalId = setInterval(checkHealth, 10000);

  return () => {
    clearInterval(intervalId);
  };
};

export const processAudioForDeepgram = (inputData: Float32Array): Int16Array => {
  try {
    // Convert Float32 audio data to 16-bit PCM for Deepgram
    const outputData = new Int16Array(inputData.length);

    // Calculate audio level for debugging
    let sumSquares = 0;
    let maxSample = 0;
    let silentSamples = 0;
    let totalSamples = 0;

    for (let i = 0; i < inputData.length; i++) {
      // Clamp and convert to 16-bit integer range
      const sample = Math.max(-1, Math.min(1, inputData[i]));
      outputData[i] = Math.round(sample * 32767);

      // Calculate audio metrics
      sumSquares += sample * sample;
      maxSample = Math.max(maxSample, Math.abs(sample));
      totalSamples++;

      // Count silent samples (below -60dB threshold)
      if (Math.abs(sample) < 0.001) {
        silentSamples++;
      }
    }

    const rmsLevel = Math.sqrt(sumSquares / inputData.length);
    const dbLevel = 20 * Math.log10(rmsLevel || 0.001); // Avoid log(0)
    const silenceRatio = silentSamples / totalSamples;

    // Enhanced logging with silence detection - more detailed for screenshare
    if (dbLevel > -50 || maxSample > 0.005) {
      // Lower threshold for screenshare audio (which can be quieter)
      console.log(
        `Audio processing: ${inputData.length} samples, RMS: ${rmsLevel.toFixed(4)}, Max: ${maxSample.toFixed(4)}, dB: ${dbLevel.toFixed(1)} dB, Silence: ${(silenceRatio * 100).toFixed(1)}%`
      );
    } else if (silenceRatio > 0.95) {
      // Log when there's mostly silence (common with screenshare)
      console.log(
        `Audio processing: Mostly silence detected (${(silenceRatio * 100).toFixed(1)}%) - this may be normal for screenshare`
      );
    }

    return outputData;
  } catch (error) {
    console.error('Error processing audio for Deepgram:', error);
    return new Int16Array(0);
  }
};
