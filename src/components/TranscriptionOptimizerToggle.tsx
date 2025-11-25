import React, { useState, useEffect } from 'react';
import {
  enableTranscriptionOptimizations,
  disableTranscriptionOptimizations,
  getOptimizationStatus,
} from '../utils/transcriptionIntegration';

interface TranscriptionOptimizerToggleProps {
  className?: string;
}

const TranscriptionOptimizerToggle: React.FC<TranscriptionOptimizerToggleProps> = ({
  className = '',
}) => {
  const [isOptimized, setIsOptimized] = useState(false);
  const [statistics, setStatistics] = useState<any>(null);

  useEffect(() => {
    // Check initial optimization status
    const status = getOptimizationStatus();
    setIsOptimized(status.isOptimized);
    setStatistics(status.statistics);

    // Set up periodic status updates when optimized
    let intervalId: NodeJS.Timeout;
    if (status.isOptimized) {
      intervalId = setInterval(() => {
        const currentStatus = getOptimizationStatus();
        setStatistics(currentStatus.statistics);
      }, 5000); // Update every 5 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleToggle = () => {
    if (isOptimized) {
      disableTranscriptionOptimizations();
      setIsOptimized(false);
      setStatistics(null);
    } else {
      enableTranscriptionOptimizations();
      setIsOptimized(true);
      // Get initial statistics
      setTimeout(() => {
        const status = getOptimizationStatus();
        setStatistics(status.statistics);
      }, 1000);
    }
  };

  return (
    <div className={`flex flex-col space-y-2 p-3 bg-base-200 rounded-lg ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-medium">Transcription Optimizer</span>
          <div className={`badge ${isOptimized ? 'badge-success' : 'badge-secondary'}`}>
            {isOptimized ? 'ENABLED' : 'DISABLED'}
          </div>
        </div>
        <label className="cursor-pointer label">
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={isOptimized}
            onChange={handleToggle}
          />
        </label>
      </div>

      {isOptimized && (
        <div className="text-sm space-y-1">
          <div className="text-success font-medium">
            ✓ Real-time, accurate, high-definition transcription active
          </div>
          {statistics && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                Avg Confidence:{' '}
                <span className="font-medium">
                  {(statistics.averageConfidence * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                Audio Quality:{' '}
                <span className="font-medium">{(statistics.audioQuality * 100).toFixed(1)}%</span>
              </div>
              <div>
                Latency: <span className="font-medium">{statistics.realtimeLatency}ms</span>
              </div>
              <div>
                Rate:{' '}
                <span className="font-medium">{statistics.transcriptionRate.toFixed(1)} WPM</span>
              </div>
            </div>
          )}
        </div>
      )}

      {!isOptimized && (
        <div className="text-sm text-gray-600">
          Enable for real-time, accurate, high-definition transcription
        </div>
      )}
    </div>
  );
};

export default TranscriptionOptimizerToggle;
