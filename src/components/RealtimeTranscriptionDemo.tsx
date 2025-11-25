import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  createEnhancedTranscription,
  EnhancedTranscriptionOptions,
} from '../utils/enhancedTranscription';
import {
  testRealtimeTranscription,
  monitorRealtimeTranscription,
} from '../utils/realtimeTranscriptionTest';
import './TranscriptionDemo.css';

interface RealtimeTranscriptionDemoProps {
  apiKey?: string;
  onError?: (error: string) => void;
}

interface TranscriptionEntry {
  text: string;
  confidence: number;
  timestamp: number;
  latency: number;
  isRealtime: boolean;
}

export const RealtimeTranscriptionDemo: React.FC<RealtimeTranscriptionDemoProps> = ({
  apiKey = 'demo-key',
  onError,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState({
    latency: 0,
    audioLevel: 0,
    qualityScore: 0,
    processingSpeed: 0,
    connectionStatus: false,
    websocketStatus: 'disconnected',
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<object>({});
  const [connectionLog, setConnectionLog] = useState<string[]>([]);

  const transcriptionManagerRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const addConnectionLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setConnectionLog((prev) => [...prev.slice(-9), `[${timestamp}] ${message}`]);
  }, []);

  const handleTranscription = useCallback(
    (text: string, confidence: number, metrics: any) => {
      const entry: TranscriptionEntry = {
        text,
        confidence,
        timestamp: Date.now(),
        latency: metrics.latency,
        isRealtime: true,
      };

      setTranscriptions((prev) => [...prev.slice(-19), entry]); // Keep last 20 entries
      setCurrentMetrics({
        latency: metrics.latency,
        audioLevel: Math.round(metrics.audioLevel * 100),
        qualityScore: Math.round(metrics.qualityScore * 100),
        processingSpeed: metrics.processingSpeed,
        connectionStatus: metrics.connectionStatus,
        websocketStatus: metrics.websocketStatus || 'connected',
      });

      addConnectionLog(
        `📝 Transcribed: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}" (${(confidence * 100).toFixed(1)}%)`
      );
    },
    [addConnectionLog]
  );

  const handleError = useCallback(
    (error: string) => {
      console.error('❌ Transcription error:', error);
      addConnectionLog(`❌ Error: ${error}`);
      if (onError) {
        onError(error);
      }
    },
    [onError, addConnectionLog]
  );

  const startRealtimeTranscription = async () => {
    try {
      setIsConnecting(true);
      addConnectionLog('🔄 Starting real-time transcription setup...');

      // Get audio stream with optimal settings for real-time processing
      addConnectionLog('🎙️ Requesting audio stream...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Note: latency property is not supported in all browsers
          // We'll handle latency optimization through chunk processing instead
        },
        video: false,
      });

      mediaStreamRef.current = stream;
      addConnectionLog('✅ Audio stream obtained');

      // Create audio context for real-time processing
      audioContextRef.current = new AudioContext({
        sampleRate: 16000,
        latencyHint: 'interactive',
      });

      // Configure for maximum real-time performance
      const options: Partial<EnhancedTranscriptionOptions> = {
        apiKey,
        enableHD: true,
        enableRealtime: true,
        enableQualityAnalysis: true,
        enableAccuracyValidation: true,
        sampleRate: 16000,
        language: 'en-US',
        model: 'nova-2',
        // WebSocket optimization
        websocketUrl: 'wss://api.deepgram.com/v1/listen',
        enableInterimResults: true,
        enableEndpointing: true,
        punctuate: true,
        profanityFilter: false,
        diarize: false, // Disable for faster processing
      };

      addConnectionLog('🔄 Creating transcription manager...');
      const manager = createEnhancedTranscription(options, handleTranscription, handleError);

      transcriptionManagerRef.current = manager;

      addConnectionLog('🔄 Initializing transcription service...');
      const initialized = await manager.initialize(stream);

      if (!initialized) {
        throw new Error('Failed to initialize transcription manager');
      }

      addConnectionLog('✅ Real-time transcription started successfully');
      setIsActive(true);
      setIsConnecting(false);

      // Start monitoring
      startMonitoring();
    } catch (error) {
      console.error('❌ Failed to start real-time transcription:', error);
      addConnectionLog(`❌ Failed to start: ${error}`);
      setIsConnecting(false);
      handleError(`Failed to start: ${error}`);
    }
  };

  const stopRealtimeTranscription = () => {
    addConnectionLog('🛑 Stopping real-time transcription...');

    if (transcriptionManagerRef.current) {
      transcriptionManagerRef.current.stop();
      transcriptionManagerRef.current = null;
    }

    // Clean up audio stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Clean up audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsActive(false);
    addConnectionLog('✅ Real-time transcription stopped');
  };

  const runRealtimeTest = async () => {
    if (!apiKey || apiKey === 'demo-key') {
      handleError('Please provide a valid Deepgram API key for testing');
      return;
    }

    try {
      setIsTesting(true);
      addConnectionLog('🧪 Running real-time transcription test...');

      const results = await testRealtimeTranscription(apiKey);
      setTestResults(results);

      addConnectionLog(`🎯 Test completed: ${results.success ? '✅ PASSED' : '❌ FAILED'}`);
      addConnectionLog(`   Transcriptions: ${results.transcriptionCount}`);
      addConnectionLog(`   Avg Latency: ${results.averageLatency.toFixed(1)}ms`);
      addConnectionLog(`   Quality Score: ${results.qualityScore.toFixed(1)}%`);
    } catch (error) {
      console.error('❌ Real-time test failed:', error);
      handleError(`Test failed: ${error}`);
    } finally {
      setIsTesting(false);
    }
  };

  const startMonitoring = () => {
    if (transcriptionManagerRef.current) {
      monitorRealtimeTranscription(transcriptionManagerRef.current);
    }
  };

  const clearTranscriptions = () => {
    setTranscriptions([]);
    addConnectionLog('🗑️ Transcriptions cleared');
  };

  const clearConnectionLog = () => {
    setConnectionLog([]);
  };

  useEffect(() => {
    return () => {
      if (transcriptionManagerRef.current) {
        transcriptionManagerRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="transcription-demo">
      <div className="demo-header">
        <h2>🎙️ Real-Time Transcription Demo</h2>
        <div className="demo-controls">
          <button
            onClick={isActive ? stopRealtimeTranscription : startRealtimeTranscription}
            className={`demo-button ${isActive ? 'stop' : 'start'}`}
            disabled={isConnecting || !apiKey}
          >
            {isConnecting
              ? '⏳ Connecting...'
              : isActive
                ? '🛑 Stop Transcription'
                : '🎙️ Start Real-Time'}
          </button>

          <button
            onClick={runRealtimeTest}
            className="demo-button test"
            disabled={!isActive || isTesting || apiKey === 'demo-key'}
          >
            {isTesting ? '🧪 Testing...' : '🧪 Run Real-Time Test'}
          </button>

          <button
            onClick={clearTranscriptions}
            className="demo-button clear"
            disabled={transcriptions.length === 0}
          >
            🗑️ Clear Transcriptions
          </button>

          <button
            onClick={clearConnectionLog}
            className="demo-button"
            disabled={connectionLog.length === 0}
          >
            🧹 Clear Log
          </button>
        </div>
      </div>

      {/* Real-time Metrics */}
      <div className="demo-metrics">
        <h3>⚡ Real-Time Performance Metrics</h3>
        <div className="metrics-grid">
          <div className="metric-card">
            <h3>Connection Status</h3>
            <div
              className={`status-indicator ${currentMetrics.connectionStatus ? 'connected' : 'disconnected'}`}
            >
              {currentMetrics.connectionStatus ? '✅ Connected' : '❌ Disconnected'}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              {currentMetrics.websocketStatus}
            </div>
          </div>

          <div className="metric-card">
            <h3>Latency</h3>
            <div className="metric-value">{currentMetrics.latency}ms</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              Target: &lt;300ms
            </div>
          </div>

          <div className="metric-card">
            <h3>Audio Level</h3>
            <div className="metric-value">{currentMetrics.audioLevel}%</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              {currentMetrics.audioLevel > 10 ? '🔊 Active' : '🔇 Quiet'}
            </div>
          </div>

          <div className="metric-card">
            <h3>Quality Score</h3>
            <div className="metric-value">{currentMetrics.qualityScore}%</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              {currentMetrics.qualityScore > 80
                ? '✨ Excellent'
                : currentMetrics.qualityScore > 60
                  ? '👍 Good'
                  : '⚠️ Poor'}
            </div>
          </div>

          <div className="metric-card">
            <h3>Processing Speed</h3>
            <div className="metric-value">{currentMetrics.processingSpeed.toFixed(1)}</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>chunks/sec</div>
          </div>

          <div className="metric-card">
            <h3>Transcriptions</h3>
            <div className="metric-value">{transcriptions.length}</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>real-time</div>
          </div>
        </div>
      </div>

      {/* Real-time Transcriptions */}
      <div className="demo-transcriptions">
        <h3>📝 Real-Time Transcriptions ({transcriptions.length})</h3>
        <div className="transcriptions-list">
          {transcriptions.length === 0 ? (
            <p className="no-transcriptions">
              {isActive
                ? '👂 Listening for speech... Speak now!'
                : isConnecting
                  ? '⏳ Setting up real-time transcription...'
                  : '🎙️ Click "Start Real-Time" to begin transcription'}
            </p>
          ) : (
            transcriptions
              .slice(-10)
              .reverse()
              .map((entry, index) => (
                <div key={entry.timestamp} className="transcription-entry">
                  <div className="entry-header">
                    <span className="entry-time">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="entry-confidence">⚡ {entry.latency}ms latency</span>
                  </div>
                  <div className="entry-text">{entry.text}</div>
                  <div className="entry-metrics">
                    <span>🎯 {(entry.confidence * 100).toFixed(1)}% confidence</span>
                    <span>{entry.isRealtime ? '🔄 Real-time' : '⏸️ Final'}</span>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Connection Log */}
      <div className="demo-transcriptions">
        <h3>📡 Connection Log ({connectionLog.length})</h3>
        <div className="transcriptions-list" style={{ maxHeight: '200px' }}>
          {connectionLog.length === 0 ? (
            <p className="no-transcriptions">📡 Connection log will appear here...</p>
          ) : (
            connectionLog
              .slice()
              .reverse()
              .map((log, index) => (
                <div
                  key={index}
                  className="transcription-entry"
                  style={{ border: 'none', padding: '5px 0' }}
                >
                  <div className="entry-text" style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                    {log}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <div className="demo-test-results">
          <h3>🧪 Real-Time Test Results</h3>
          <pre className="test-results">{JSON.stringify(testResults, null, 2)}</pre>
        </div>
      )}

      {/* Real-time Features Status */}
      <div className="demo-features">
        <h3>⚡ Real-Time Features Status</h3>
        <ul className="features-list">
          <li className={isActive ? 'enabled' : 'disabled'}>
            <span className="feature-icon">{isActive ? '🔄' : '⏸️'}</span>
            Real-time Audio Processing - {isActive ? 'Active' : 'Inactive'}
          </li>
          <li className={currentMetrics.connectionStatus ? 'enabled' : 'disabled'}>
            <span className="feature-icon">{currentMetrics.connectionStatus ? '🔗' : '🔌'}</span>
            WebSocket Connection - {currentMetrics.connectionStatus ? 'Connected' : 'Disconnected'}
          </li>
          <li className={currentMetrics.latency < 500 ? 'enabled' : 'disabled'}>
            <span className="feature-icon">{currentMetrics.latency < 300 ? '⚡' : '🐌'}</span>
            Low Latency Mode - {currentMetrics.latency}ms
          </li>
          <li className={currentMetrics.audioLevel > 5 ? 'enabled' : 'disabled'}>
            <span className="feature-icon">{currentMetrics.audioLevel > 10 ? '🔊' : '🔇'}</span>
            Voice Activity Detection - {currentMetrics.audioLevel > 5 ? 'Active' : 'Quiet'}
          </li>
        </ul>
      </div>

      {/* Instructions */}
      <div className="demo-features">
        <h3>🎯 How to Test Real-Time Transcription</h3>
        <ol style={{ fontSize: '14px', lineHeight: '1.6' }}>
          <li>🎙️ Click "Start Real-Time" to begin (ensure microphone access is granted)</li>
          <li>👂 Start speaking - you should see transcriptions appear instantly</li>
          <li>⚡ Watch the latency metrics - should be under 300ms for real-time performance</li>
          <li>🧪 Run the real-time test to validate performance (requires valid API key)</li>
          <li>📡 Monitor the connection log to ensure WebSocket stability</li>
        </ol>
      </div>
    </div>
  );
};

export default RealtimeTranscriptionDemo;
