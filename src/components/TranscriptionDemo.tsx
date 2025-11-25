import React, { useState, useEffect, useCallback } from 'react';
import {
  createEnhancedTranscription,
  EnhancedTranscriptionOptions,
  TranscriptionMetrics,
} from '../utils/enhancedTranscription';
import './TranscriptionDemo.css';

interface TranscriptionDemoProps {
  apiKey: string;
  onError?: (error: string) => void;
}

interface TranscriptionEntry {
  text: string;
  confidence: number;
  timestamp: number;
  metrics: TranscriptionMetrics;
}

export const TranscriptionDemo: React.FC<TranscriptionDemoProps> = ({ apiKey, onError }) => {
  const [isActive, setIsActive] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<TranscriptionMetrics>({
    accuracy: 0,
    latency: 0,
    qualityScore: 0,
    processingSpeed: 0,
    connectionStatus: false,
    audioLevel: 0,
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<object>({});
  const [transcriptionManager, setTranscriptionManager] = useState<any>(null);

  const options: Partial<EnhancedTranscriptionOptions> = {
    apiKey,
    enableHD: true,
    enableRealtime: true,
    enableQualityAnalysis: true,
    enableAccuracyValidation: true,
    sampleRate: 16000,
    language: 'en-US',
    model: 'nova-2',
  };

  const handleTranscription = useCallback(
    (text: string, confidence: number, metrics: TranscriptionMetrics) => {
      const entry: TranscriptionEntry = {
        text,
        confidence,
        timestamp: Date.now(),
        metrics: { ...metrics },
      };

      setTranscriptions((prev) => [...prev, entry]);
      setCurrentMetrics(metrics);
    },
    []
  );

  const handleError = useCallback(
    (error: string) => {
      console.error('Transcription error:', error);
      if (onError) {
        onError(error);
      }
    },
    [onError]
  );

  const startTranscription = async () => {
    try {
      console.log('Starting enhanced transcription demo...');

      const manager = createEnhancedTranscription(options, handleTranscription, handleError);

      setTranscriptionManager(manager);

      const initialized = await manager.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize transcription manager');
      }

      setIsActive(true);
      console.log('Enhanced transcription started');
    } catch (error) {
      console.error('Failed to start transcription:', error);
      handleError(`Failed to start: ${error}`);
    }
  };

  const stopTranscription = () => {
    if (transcriptionManager) {
      transcriptionManager.stop();
      setTranscriptionManager(null);
    }
    setIsActive(false);
    console.log('Enhanced transcription stopped');
  };

  const runAccuracyTest = async () => {
    if (!transcriptionManager) {
      handleError('Transcription manager not initialized');
      return;
    }

    try {
      setIsTesting(true);
      console.log('Running accuracy test...');

      const results = await transcriptionManager.runAccuracyTest();
      setTestResults(results);

      console.log('Accuracy test completed:', results);
    } catch (error) {
      console.error('Accuracy test failed:', error);
      handleError(`Test failed: ${error}`);
    } finally {
      setIsTesting(false);
    }
  };

  const getDetailedStats = () => {
    if (!transcriptionManager) return {};
    return transcriptionManager.getDetailedStats();
  };

  const clearTranscriptions = () => {
    setTranscriptions([]);
  };

  useEffect(() => {
    return () => {
      if (transcriptionManager) {
        transcriptionManager.stop();
      }
    };
  }, [transcriptionManager]);

  return (
    <div className="transcription-demo">
      <div className="demo-header">
        <h2>Enhanced Transcription Demo</h2>
        <div className="demo-controls">
          <button
            onClick={isActive ? stopTranscription : startTranscription}
            className={`demo-button ${isActive ? 'stop' : 'start'}`}
            disabled={!apiKey}
          >
            {isActive ? 'Stop Transcription' : 'Start Transcription'}
          </button>

          <button
            onClick={runAccuracyTest}
            className="demo-button test"
            disabled={!isActive || isTesting}
          >
            {isTesting ? 'Testing...' : 'Run Accuracy Test'}
          </button>

          <button
            onClick={clearTranscriptions}
            className="demo-button clear"
            disabled={transcriptions.length === 0}
          >
            Clear Transcriptions
          </button>
        </div>
      </div>

      <div className="demo-metrics">
        <div className="metrics-grid">
          <div className="metric-card">
            <h3>Connection Status</h3>
            <div
              className={`status-indicator ${currentMetrics.connectionStatus ? 'connected' : 'disconnected'}`}
            >
              {currentMetrics.connectionStatus ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          <div className="metric-card">
            <h3>Accuracy</h3>
            <div className="metric-value">{(currentMetrics.accuracy * 100).toFixed(1)}%</div>
          </div>

          <div className="metric-card">
            <h3>Latency</h3>
            <div className="metric-value">{currentMetrics.latency.toFixed(0)}ms</div>
          </div>

          <div className="metric-card">
            <h3>Quality Score</h3>
            <div className="metric-value">{(currentMetrics.qualityScore * 100).toFixed(1)}%</div>
          </div>

          <div className="metric-card">
            <h3>Audio Level</h3>
            <div className="metric-value">{(currentMetrics.audioLevel * 100).toFixed(1)}%</div>
          </div>

          <div className="metric-card">
            <h3>Processing Speed</h3>
            <div className="metric-value">{currentMetrics.processingSpeed.toFixed(0)} chunks/s</div>
          </div>
        </div>
      </div>

      <div className="demo-transcriptions">
        <h3>Real-time Transcriptions ({transcriptions.length})</h3>
        <div className="transcriptions-list">
          {transcriptions.length === 0 ? (
            <p className="no-transcriptions">
              {isActive ? 'Waiting for audio input...' : 'Start transcription to see results'}
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
                    <span className="entry-confidence">
                      {(entry.confidence * 100).toFixed(1)}% confidence
                    </span>
                  </div>
                  <div className="entry-text">{entry.text}</div>
                  <div className="entry-metrics">
                    <span>Latency: {entry.metrics.latency}ms</span>
                    <span>Quality: {(entry.metrics.qualityScore * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {Object.keys(testResults).length > 0 && (
        <div className="demo-test-results">
          <h3>Accuracy Test Results</h3>
          <pre className="test-results">{JSON.stringify(testResults, null, 2)}</pre>
        </div>
      )}

      <div className="demo-features">
        <h3>Enhanced Features</h3>
        <ul className="features-list">
          <li className={options.enableHD ? 'enabled' : 'disabled'}>
            <span className="feature-icon">{options.enableHD ? '✓' : '✗'}</span>
            High-Definition Audio Processing
          </li>
          <li className={options.enableRealtime ? 'enabled' : 'disabled'}>
            <span className="feature-icon">{options.enableRealtime ? '✓' : '✗'}</span>
            Real-time Transcription
          </li>
          <li className={options.enableQualityAnalysis ? 'enabled' : 'disabled'}>
            <span className="feature-icon">{options.enableQualityAnalysis ? '✓' : '✗'}</span>
            Audio Quality Analysis
          </li>
          <li className={options.enableAccuracyValidation ? 'enabled' : 'disabled'}>
            <span className="feature-icon">{options.enableAccuracyValidation ? '✓' : '✗'}</span>
            Accuracy Validation
          </li>
        </ul>
      </div>
    </div>
  );
};

export default TranscriptionDemo;
