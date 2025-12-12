/// <reference path="../renderer.d.ts" />

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Timer from '../components/Timer';
import { useKnowledgeBase } from '../contexts/KnowledgeBaseContext';
import ErrorDisplay from '../components/ErrorDisplay';
import { useError } from '../contexts/ErrorContext';
import { useInterview } from '../contexts/InterviewContext';
import ReactMarkdown from 'react-markdown';
import ScreenSharePicker from '../components/ScreenSharePicker';
import { AudioErrorHandler } from '../utils/errorHandling';
import {
  createStableAudioStream,
  createScreenShareStream,
  monitorStreamHealth,
  processAudioForDeepgram,
} from '../utils/audioUtils';
import { AudioWorkletManager } from '../utils/audioWorkletManager';
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaDesktop,
  FaStop,
  FaRobot,
  FaWindowRestore,
  FaLightbulb,
  FaUser,
  FaCopy,
} from 'react-icons/fa';
import '../styles/enhanced-ui.css';

interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
  isProcessed: boolean;
}

interface AiResponseSegment {
  id: string;
  text: string;
  timestamp: number;
}

interface ResumeData {
  name?: string;
  email?: string;
  phone?: string;
  experience?: Array<{
    title: string;
    company: string;
    duration: string;
    description: string;
  }>;
  education?: Array<{
    degree: string;
    institution: string;
    year: string;
  }>;
  skills?: string[];
  summary?: string;
}

const InterviewPage: React.FC = () => {
  const { knowledgeBase, conversations, addConversation, clearConversations } = useKnowledgeBase();
  const { error, setError, clearError } = useError();
  const {
    currentText,
    setCurrentText,
    aiResult,
    setAiResult,
    displayedAiResult,
    setDisplayedAiResult,
    lastProcessedIndex,
    setLastProcessedIndex,
  } = useInterview();
  const [isRecording, setIsRecording] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeepSeekChatEnabled, setIsDeepSeekChatEnabled] = useState(false);
  const [userMedia, setUserMedia] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [workletManager, setWorkletManager] = useState<AudioWorkletManager | null>(null);
  const [processor, setProcessor] = useState<ScriptProcessorNode | null>(null);
  const [autoSubmitTimer, setAutoSubmitTimer] = useState<NodeJS.Timeout | null>(null);
  const aiResponseRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const transcriptionRef = useRef<HTMLTextAreaElement>(null);
  
  // Resume introduction state
  const [resumeIntroduction, setResumeIntroduction] = useState<string>('');
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [showResumeIntro, setShowResumeIntro] = useState<boolean>(false);
  const [isIntroMaximized, setIsIntroMaximized] = useState<boolean>(false);

  // Segment-based state for auto-deletion
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [aiResponseSegments, setAiResponseSegments] = useState<AiResponseSegment[]>([]);
  const transcriptSegmentsRef = useRef<TranscriptSegment[]>([]);
  
  // Sync ref with state
  useEffect(() => {
    transcriptSegmentsRef.current = transcriptSegments;
  }, [transcriptSegments]);

  // Auto-delete old content (older than 3 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const expiry = 3 * 60 * 1000; // 3 minutes

      setTranscriptSegments((prev) => {
        const next = prev.filter((s) => now - s.timestamp < expiry);
        return next.length !== prev.length ? next : prev;
      });

      setAiResponseSegments((prev) => {
        const next = prev.filter((s) => now - s.timestamp < expiry);
        return next.length !== prev.length ? next : prev;
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Load resume introduction from localStorage
  useEffect(() => {
    const loadResumeData = () => {
      const intro = localStorage.getItem('resumeIntroduction');
      const data = localStorage.getItem('resumeData');
      
      if (intro) {
        setResumeIntroduction(intro);
        setShowResumeIntro(true);
      }
      
      if (data) {
        try {
          setResumeData(JSON.parse(data));
        } catch (error) {
          console.error('Error parsing resume data from localStorage:', error);
        }
      }
    };

    // Load on component mount
    loadResumeData();

    // Listen for storage events (when resume data is updated from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'resumeIntroduction' || e.key === 'resumeData') {
        loadResumeData();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Keyboard shortcuts for self-introduction panel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Ctrl/Cmd + I - Toggle show/hide self-introduction panel
      if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
        event.preventDefault();
        if (resumeIntroduction) {
          const newShowState = !showResumeIntro;
          setShowResumeIntro(newShowState);
          // Always reset maximize state when toggling visibility
          if (showResumeIntro) {
            setIsIntroMaximized(false);
          }
          if (newShowState) {
            setError('Resume Introduction shown via Ctrl+I');
          } else {
            setError('Resume Introduction hidden via Ctrl+I');
          }
          setTimeout(() => clearError(), 2000);
        }
      }

      // Ctrl/Cmd + Shift + I - Maximize/minimize self-introduction panel
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'I') {
        event.preventDefault();
        if (resumeIntroduction && showResumeIntro) {
          setIsIntroMaximized(prev => !prev);
        }
      }

      // Ctrl/Cmd + S - Toggle hide/restore self-introduction panel
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (resumeIntroduction) {
          if (showResumeIntro) {
            // If shown, hide it
            setShowResumeIntro(false);
            setIsIntroMaximized(false); // Also reset maximize state when hiding
            setError('Resume Introduction hidden! Press Ctrl+S to restore.');
            setTimeout(() => clearError(), 3000);
            console.log('Resume Introduction: Hidden via Ctrl+S');
          } else {
            // If hidden, show it (restored to normal size)
            setShowResumeIntro(true);
            setIsIntroMaximized(false); // Ensure it's not maximized when restored
            setError('Resume Introduction restored!');
            setTimeout(() => clearError(), 3000);
            console.log('Resume Introduction: Restored via Ctrl+S');
          }
        } else {
          console.log('Resume Introduction: Not available');
        }
      }

      // Ctrl/Cmd + ? - Show keyboard shortcuts help
      if ((event.ctrlKey || event.metaKey) && event.key === '?') {
        event.preventDefault();
        alert('Keyboard Shortcuts:\n\n' +
              'Ctrl+I: Toggle show/hide self-introduction panel\n' +
              'Ctrl+Shift+I: Maximize/minimize self-introduction panel\n' +
              'Ctrl+S: Toggle hide/restore self-introduction panel\n' +
              'Ctrl+?: Show this help');
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [resumeIntroduction, showResumeIntro]);

  // Sync segments to display context
  useEffect(() => {
    setDisplayedAiResult(aiResponseSegments.map((s) => s.text).join('\n\n---\n\n'));
  }, [aiResponseSegments, setDisplayedAiResult]);

  const [showScreenSharePicker, setShowScreenSharePicker] = useState(false);
  const [recordingType, setRecordingType] = useState<'audio' | 'screen' | null>(null);
  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState<
    'idle' | 'recording' | 'error' | 'no-audio'
  >('idle');
  const [transcriptionError, setTranscriptionError] = useState<string>('');
  const [isPiPWindowOpen, setIsPiPWindowOpen] = useState(false);

  // PiP window toggle function
  const togglePiPWindow = async () => {
    try {
      if (!window.electronAPI?.ipcRenderer) {
        console.log('Electron API not available for PiP window toggle');
        return;
      }
      const result = await window.electronAPI.ipcRenderer.invoke('toggle-pip-window');
      setIsPiPWindowOpen(result.isOpen);
    } catch (error) {
      console.log('Failed to toggle PiP window:', error);
    }
  };



  const markdownStyles = `
    .markdown-body {
      font-size: 16px;
      line-height: 1.6;
    }
    .markdown-body p {
      margin-bottom: 16px;
    }
    .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .markdown-body code {
      padding: 0.2em 0.4em;
      margin: 0;
      font-size: 85%;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      border-radius: 6px;
      color: white;
      font-weight: 500;
    }
    .markdown-body pre {
      word-wrap: normal;
      padding: 16px;
      overflow: auto;
      font-size: 85%;
      line-height: 1.45;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px;
      color: white;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      background-color: #f6f8fa;
      border-radius: 3px;
    }
  `;

  // Centralized API key validation and configuration loading
  const validateAndLoadDeepSeekConfig = async (): Promise<any> => {
    try {
      // Get current configuration
      let config = await window.electronAPI.getConfig();
      console.log('Current config loaded:', { 
        hasApiKey: !!config.deepseek_api_key, 
        apiKey: config.deepseek_api_key ? 'present' : 'missing',
        isPlaceholder: config.deepseek_api_key === 'placeholder_deepseek_api_key'
      });
      
      // Check if API key is missing or placeholder
      if (!config.deepseek_api_key || config.deepseek_api_key === 'placeholder_deepseek_api_key') {
        console.log('DeepSeek API key missing or placeholder, updating with valid key...');
        
        try {
          // Update configuration with the valid API key
          const updatedConfig = {
            ...config,
            deepseek_api_key: 'sk-8bd299211d094c16a60b98de2c6a9a85'
          };
          
          console.log('Updating config with new API key...');
          await window.electronAPI.setConfig(updatedConfig);
          
          // Re-load the updated configuration to ensure it's current
          config = await window.electronAPI.getConfig();
          console.log('Config reloaded after update:', { 
            hasApiKey: !!config.deepseek_api_key, 
            apiKey: config.deepseek_api_key ? 'present' : 'missing',
            isPlaceholder: config.deepseek_api_key === 'placeholder_deepseek_api_key'
          });
          
          // Verify the update was successful
          if (!config.deepseek_api_key || config.deepseek_api_key === 'placeholder_deepseek_api_key') {
            throw new Error('Configuration update failed - API key still missing after update');
          }
          
          console.log('DeepSeek API key successfully updated and loaded');
        } catch (updateError) {
          console.error('Failed to update DeepSeek configuration:', updateError);
          throw new Error(`Failed to update DeepSeek API configuration: ${updateError.message}`);
        }
      }
      
      // Final validation check
      if (!config.deepseek_api_key || config.deepseek_api_key.trim() === '') {
        throw new Error('DeepSeek API key is empty or invalid after configuration loading');
      }
      
      console.log('DeepSeek config validation successful, API key is ready');
      return config;
    } catch (error) {
      console.error('DeepSeek configuration validation failed:', error);
      
      // Set user-friendly error message
      const errorMessage = error.message.includes('Failed to update') 
        ? 'Failed to configure DeepSeek API. Please check your settings and try again.'
        : 'DeepSeek API key is not configured. Please go to Settings to configure it.';
      
      setError(errorMessage);
      throw error; // Re-throw to stop execution
    }
  };

  // Configuration check function (deprecated - use validateAndLoadDeepSeekConfig instead)
  const checkDeepSeekConfiguration = async (): Promise<boolean> => {
    try {
      await validateAndLoadDeepSeekConfig();
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleAskDeepSeek = async (newContent?: string) => {
    let contentToProcess = newContent;
    
    // If no specific content provided, gather unprocessed segments
    if (!contentToProcess) {
      const unprocessed = transcriptSegmentsRef.current.filter(s => !s.isProcessed);
      if (unprocessed.length > 0) {
        contentToProcess = unprocessed.map(s => s.text).join(' ');
        // Mark as processed
        setTranscriptSegments(prev => 
          prev.map(s => unprocessed.some(u => u.id === s.id) ? { ...s, isProcessed: true } : s)
        );
      } else {
        // Fallback to raw currentText slice if no segments (legacy/interim) or empty
        contentToProcess = currentText.slice(lastProcessedIndex).trim();
      }
    }

    if (!contentToProcess) return;

    // Check if electronAPI is available
    if (!window.electronAPI?.getConfig || !window.electronAPI?.callDeepSeek) {
      console.log('Electron API not available for AI processing');
      setError('AI processing not available - Electron API missing');
      setTimeout(() => clearError(), 3000);
      return;
    }

    // Check DeepSeek configuration before proceeding
    const isConfigured = await checkDeepSeekConfiguration();
    if (!isConfigured) {
      return;
    }

    setIsLoading(true);
    try {
      // Validate and load configuration using centralized function
      const config = await validateAndLoadDeepSeekConfig();
      console.log('handleGenerateSmartQuestions: Configuration validated, preparing API call...');

      // Build messages array with system prompt if available
      const messages = [];

      // Add system prompt if configured
      if (config.ai_system_prompt && config.ai_system_prompt.trim()) {
        messages.push({ role: 'system', content: config.ai_system_prompt.trim() });
      }

      // Add knowledge base items
      messages.push(...knowledgeBase.map((item) => ({ role: 'user', content: item })));

      // Add conversation history (limit to last 6 messages for speed)
      messages.push(...conversations.slice(-6));

      // Add current user content
      messages.push({ role: 'user', content: contentToProcess });

      // Use DeepSeek Chat instead of OpenAI
      console.log('handleAskDeepSeek: Making API call with config:', { 
        hasApiKey: !!config.deepseek_api_key,
        apiKeyPreview: config.deepseek_api_key ? config.deepseek_api_key.substring(0, 10) + '...' : 'missing'
      });
      console.log('handleGenerateSmartQuestions: Making API call with config:', { 
        hasApiKey: !!config.deepseek_api_key,
        apiKeyPreview: config.deepseek_api_key ? config.deepseek_api_key.substring(0, 10) + '...' : 'missing'
      });
      const response = await window.electronAPI.callDeepSeek({
        config: config,
        messages: messages,
      });

      if ('error' in response) {
        throw new Error(response.error);
      }

      const formattedResponse = response.content.trim();
      addConversation({ role: 'user', content: contentToProcess });
      addConversation({ role: 'assistant', content: formattedResponse });
      
      // Add to timed segments
      setAiResponseSegments(prev => [
        ...prev,
        { id: crypto.randomUUID(), text: formattedResponse, timestamp: Date.now() }
      ]);
      
      setLastProcessedIndex(currentText.length);

      // Send AI response to PiP window
      try {
        if (window.electronAPI?.ipcRenderer) {
          await window.electronAPI.ipcRenderer.invoke('update-pip-content', formattedResponse);
        } else {
          console.log('Electron API not available for PiP window update');
        }
      } catch (error) {
        console.log('Failed to update PiP window:', error);
      }
    } catch (error) {
      console.error('DeepSeek Chat Error:', error);
      let errorMessage = 'Failed to get response from DeepSeek Chat.';
      
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          errorMessage = 'DeepSeek API key is missing or invalid. Please check your settings.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please try with shorter content.';
        } else if (error.message.includes('Network')) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.message.includes('404')) {
          errorMessage = 'DeepSeek API endpoint not found. Please check your API configuration.';
        } else if (error.message.includes('401')) {
          errorMessage = 'Authentication failed. Please check your DeepSeek API key.';
        } else {
          errorMessage = `DeepSeek API Error: ${error.message}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      if (aiResponseRef.current) {
        aiResponseRef.current.scrollTop = aiResponseRef.current.scrollHeight;
      }
    }
  };

  const handleGenerateSmartQuestions = async () => {
    setIsLoading(true);
    try {
      // Check if electronAPI is available
      if (!window.electronAPI?.getConfig || !window.electronAPI?.callDeepSeek) {
        console.log('Electron API not available for smart questions');
        setError('Smart questions not available - Electron API missing');
        setTimeout(() => clearError(), 3000);
        setIsLoading(false);
        return;
      }

      // Check DeepSeek configuration before proceeding
      const isConfigured = await checkDeepSeekConfiguration();
      if (!isConfigured) {
        setIsLoading(false);
        return;
      }

      // Validate and load configuration using centralized function
      const config = await validateAndLoadDeepSeekConfig();

      const smartQuestionsPrompt = `
        Based on the interview context below (if any), generate 5-7 smart, strategic questions that a Senior Digital Marketing Specialist (Google/Meta Ads Expert) should ask this client right now.
        
        Focus specifically on uncovering missing details about:
        1. Specific KPIs and Success Metrics (ROAS, CPA, CLV, etc.)
        2. Total Media Budget & Allocation details
        3. Primary Business Goals (Lead Gen vs E-comm vs Brand Awareness)
        4. Current/Past Bidding Strategies
        5. Account History (How long they've been running ads, past performance issues)
        
        Format the output as a clean, bulleted list of questions.
        
        Transcription Context:
        ${currentText ? currentText.slice(Math.max(0, currentText.length - 4000)) : "No interview transcription yet. Provide general best-practice discovery questions."}
      `;

      const messages = [
        { role: 'system', content: "You are an expert Digital Marketing Consultant assisting in a client meeting. Your goal is to ask high-impact questions that demonstrate senior-level expertise." },
        { role: 'user', content: smartQuestionsPrompt }
      ];

      const response = await window.electronAPI.callDeepSeek({
        config: config,
        messages: messages,
      });

      if ('error' in response) {
        throw new Error(response.error);
      }

      const formattedResponse = `### 💡 Smart Strategy Questions:\n\n${response.content.trim()}`;
      
      setAiResponseSegments(prev => [
        ...prev,
        { id: crypto.randomUUID(), text: formattedResponse, timestamp: Date.now() }
      ]);
      
      // Send to PiP
      try {
        if (window.electronAPI?.ipcRenderer) {
          await window.electronAPI.ipcRenderer.invoke('update-pip-content', formattedResponse);
        } else {
          console.log('Electron API not available for PiP window update');
        }
      } catch (error) {
        console.log('Failed to update PiP window:', error);
      }

    } catch (error) {
      setError('Failed to generate smart questions. Please try again.');
    } finally {
      setIsLoading(false);
      if (aiResponseRef.current) {
        aiResponseRef.current.scrollTop = aiResponseRef.current.scrollHeight;
      }
    }
  };

  const handleAskDeepSeekStable = useCallback(
    async (newContent: string) => {
      await handleAskDeepSeek(newContent);
    },
    [handleAskDeepSeek]
  );

  const [interimTranscript, setInterimTranscript] = useState('');

  // Sync transcript segments to display context
  useEffect(() => {
    const text = transcriptSegments.map((s) => s.text).join(' ');
    setCurrentText(text + (interimTranscript ? ' ' + interimTranscript : ''));
  }, [transcriptSegments, interimTranscript, setCurrentText]);

  useEffect(() => {
    let lastTranscriptTime = Date.now();
    let checkTimer: NodeJS.Timeout | null = null;

    // Check if electronAPI is available
    if (!window.electronAPI?.ipcRenderer) {
      console.log('Electron API not available, skipping Deepgram transcript listener');
      return;
    }

    const handleDeepgramTranscript = (_event: any, data: any) => {
      console.log('Received Deepgram transcript data:', data);
      const newTranscript = data.transcript?.trim();

      if (!newTranscript) {
        console.log('No transcript received from Deepgram');
        return;
      }

      console.log(`Deepgram transcript: "${newTranscript}" (is_final: ${data.is_final})`);

      if (data.is_final) {
        setTranscriptSegments((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            text: newTranscript,
            timestamp: Date.now(),
            isProcessed: false,
          },
        ]);
        setInterimTranscript('');
        lastTranscriptTime = Date.now();
        console.log('Final transcript updated:', newTranscript);
      } else {
        setInterimTranscript(newTranscript);
        console.log('Interim transcript updated:', newTranscript);
      }
    };

    const checkAndSubmit = () => {
      // Reduced latency: 600ms silence threshold for near real-time response
      if (isDeepSeekChatEnabled && Date.now() - lastTranscriptTime >= 600) {
        const unprocessed = transcriptSegmentsRef.current.filter((s) => !s.isProcessed);
        if (unprocessed.length > 0) {
          const newContent = unprocessed.map((s) => s.text).join(' ');
          if (newContent.trim()) {
            // Mark processed
            setTranscriptSegments((prev) =>
              prev.map((s) => (unprocessed.some((u) => u.id === s.id) ? { ...s, isProcessed: true } : s))
            );
            handleAskDeepSeekStable(newContent);
          }
        }
      }
      // Check more frequently (every 200ms) to catch the threshold quickly
      checkTimer = setTimeout(checkAndSubmit, 200);
    };

    const removeListener = window.electronAPI.ipcRenderer.on(
      'deepgram-transcript',
      handleDeepgramTranscript
    );
    checkTimer = setTimeout(checkAndSubmit, 200);

    return () => {
      removeListener();
      if (checkTimer) clearTimeout(checkTimer);
    };
  }, [
    isDeepSeekChatEnabled,
    handleAskDeepSeekStable,
    setInterimTranscript,
  ]);

  const startRecording = async (type: 'audio' | 'screen') => {
    setRecordingType(type);
    if (type === 'screen') {
      setShowScreenSharePicker(true);
    } else {
      await handleSourceSelected(null);
    }
  };

  const handleSourceSelected = async (source: any) => {
    setShowScreenSharePicker(false);

    const result = await AudioErrorHandler.safeAudioOperation(async () => {
      let stream: MediaStream | null = null;
      let audioStream: MediaStream | null = null;
      let screenPreviewStream: MediaStream | null = null;

      if (recordingType === 'screen') {
        if (source?.withAudio) {
          stream = await createScreenShareStream(source?.id, { withAudio: true });
          // Check if the screen share stream actually has audio tracks
          const audioTracks = stream.getAudioTracks();
          if (audioTracks.length > 0) {
            console.log(`Screen share stream has ${audioTracks.length} audio tracks`);
            audioStream = stream;
            screenPreviewStream = stream;
          } else {
            console.warn('Screen share stream requested with audio but no audio tracks found');
            setError(
              'Failed to capture system audio. Please ensure you select "Share system audio" (or similar) in the screen sharing prompt. Falling back to microphone for transcription.'
            );
            // Fallback to separate audio stream
            audioStream = await createStableAudioStream({
              audio: {
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
              video: false,
            });
            screenPreviewStream = stream;
          }
        } else {
          screenPreviewStream = await createScreenShareStream(source?.id, { withAudio: false });
          audioStream = await createStableAudioStream({
            audio: {
              sampleRate: 16000,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
        }
      } else {
        audioStream = await createStableAudioStream({
          audio: {
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }

      if (!audioStream) {
        throw new Error('Failed to create audio stream');
      }

      // Validate stream health
      const isValid = await AudioErrorHandler.validateAudioStream(audioStream);
      if (!isValid) {
        throw new Error('Audio stream validation failed');
      }

      // Enhanced validation for screen share audio
      if (recordingType === 'screen' && audioStream.getAudioTracks().length > 0) {
        const audioTrack = audioStream.getAudioTracks()[0];
        const settings = audioTrack.getSettings();
        console.log('Screen share audio settings:', settings);

        // More lenient validation for screenshare audio
        if (settings.sampleRate && settings.sampleRate < 8000) {
          console.warn('Low sample rate detected for screen share audio:', settings.sampleRate);
          console.log('Continuing with transcription despite low sample rate');
        }

        // Ensure track is enabled and ready
        audioTrack.enabled = true;
        console.log('Screen share audio track enabled:', audioTrack.enabled);

        // Monitor audio levels for screen share with better error handling
        let silentFrames = 0;
        let audioActivityDetected = false;
        
        const checkAudioLevel = async () => {
          if (audioTrack.enabled && !audioTrack.muted) {
            try {
              // Use a lightweight approach to avoid audio interference
              // Check if track has any activity indicators first
              if (audioTrack.readyState === 'live' && !audioTrack.muted) {
                // Simple activity detection without creating audio contexts
                const settings = audioTrack.getSettings();
                console.log(`Screen share audio track state: enabled=${audioTrack.enabled}, muted=${audioTrack.muted}, readyState=${audioTrack.readyState}`);
                
                // For screenshare, if the track is live and enabled, assume audio is available
                // The actual audio processing happens in AudioWorkletManager without playback
                audioActivityDetected = true;
                silentFrames = 0;
                
                if (transcriptionStatus === 'no-audio') {
                  setTranscriptionStatus('recording');
                  setTranscriptionError('');
                }
                
                console.log('Screen share audio is available for transcription');
              } else {
                silentFrames++;
                if (silentFrames > 5) {
                  console.warn('Screen share audio track not active - check system audio permissions');
                  setTranscriptionStatus('no-audio');
                  setTranscriptionError('No audio detected from screen share. Ensure audio is playing and permissions are granted.');
                }
              }
            } catch (error) {
              console.error('Error checking screen share audio level:', error);
            }
          }
        };

        // Check audio level after a short delay
        setTimeout(checkAudioLevel, 2000);
        
        // Set up periodic audio level checks (less frequent to avoid interference)
        const audioCheckInterval = setInterval(checkAudioLevel, 5000);
        
        // Store interval for cleanup
        (audioStream as any)._audioCheckInterval = audioCheckInterval;
        
        console.log('Screen share audio monitoring initialized');
      } else if (recordingType === 'screen' && audioStream.getAudioTracks().length === 0) {
        console.warn('Screen share requested but no audio tracks available');
        setTranscriptionStatus('no-audio');
        setTranscriptionError('Screen share audio not available. Check system audio permissions.');
      }

      setUserMedia(audioStream);
      if (recordingType === 'screen' && videoRef.current && screenPreviewStream) {
        // MUTE the video preview to prevent audio playback and echoing
        (videoRef.current as any).srcObject = screenPreviewStream;
        (videoRef.current as any).muted = true; // CRITICAL: Prevent audio playback
      }

      // Start Deepgram connection
      if (!window.electronAPI?.getConfig || !window.electronAPI?.ipcRenderer) {
        console.log('Electron API not available for Deepgram connection');
        setError('Transcription not available - Electron API missing');
        setTimeout(() => clearError(), 3000);
        setIsLoading(false);
        return;
      }
      const config = await window.electronAPI.getConfig();
      const deepgramResult = await window.electronAPI.ipcRenderer.invoke('start-deepgram', {
        deepgram_key: config.deepgram_api_key,
      });

      if (!deepgramResult.success) {
        throw new Error(deepgramResult.error || 'Failed to start Deepgram connection');
      }

      // Create audio context safely
      const context = AudioErrorHandler.safeAudioContextCreation({ sampleRate: 16000 });
      if (!context) {
        throw new Error('Failed to create AudioContext');
      }

      setAudioContext(context);

      // Create AudioWorkletManager to replace deprecated ScriptProcessorNode
      const workletManager = new AudioWorkletManager(context);
      setWorkletManager(workletManager);

      // Initialize Audio Worklet - NO FALLBACK to prevent echoing
      let workletInitialized = false;
      try {
        workletInitialized = await workletManager.initialize();
        if (!workletInitialized) {
          throw new Error('Audio Worklet initialization failed');
        }
      } catch (error) {
        console.error('Audio Worklet initialization failed completely:', error);
        // DO NOT use ScriptProcessorNode fallback to prevent echoing
        throw new Error('Audio Worklet is required for echo-free transcription. Please use a modern browser.');
      }

      // Start processing with Audio Worklet only (no fallback)
      const processingStarted = await workletManager.startProcessing(
        audioStream,
        (samples: Float32Array) => {
          try {
            console.log(
              `Audio processing: ${samples.length} samples, first sample: ${samples[0]}`
            );

            const audioData = processAudioForDeepgram(samples);

            // Only send if we have actual audio data
            if (audioData.length > 0) {
              console.log(`Sending ${audioData.length} samples to Deepgram`);
              if (window.electronAPI?.ipcRenderer) {
                window.electronAPI.ipcRenderer.invoke('send-audio-to-deepgram', audioData.buffer);
              } else {
                console.log('Electron API not available for audio transmission');
              }
              } else {
                console.log('No audio data to send (silence detected)');
              }
            } catch (audioError) {
              console.error('Error processing audio data:', audioError);
            }
          }
        );

        if (!processingStarted) {
          throw new Error('Failed to start Audio Worklet processing');
        }

        // Monitor audio stream health for automatic recovery
        const cleanupMonitor = monitorStreamHealth(audioStream, () => {
        console.warn('Audio stream health check failed multiple times, attempting recovery');

        // Try to recover by checking if we can get a new stream
        const attemptRecovery = async () => {
          try {
            console.log('Attempting audio stream recovery...');

            // First, try to get a new stream without stopping current recording
            const newStream = await createStableAudioStream({
              audio: {
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });

            if (newStream && newStream.getAudioTracks().length > 0) {
              console.log('Recovery successful - new stream created');

              // Update the current stream
              if (userMedia) {
                userMedia.getTracks().forEach((track) => track.stop());
              }
              setUserMedia(newStream);

              // Recreate audio context with new stream
              if (audioContext && audioContext.state !== 'closed') {
                audioContext.close();
              }

              const newContext = AudioErrorHandler.safeAudioContextCreation({ sampleRate: 16000 });
              if (newContext) {
                setAudioContext(newContext);

                // Create new AudioWorkletManager for recovery
                const newWorkletManager = new AudioWorkletManager(newContext);
                setWorkletManager(newWorkletManager);

                // Initialize and start the new worklet
                const workletInitialized = await newWorkletManager.initialize();
                if (workletInitialized) {
                  await newWorkletManager.startProcessing(newStream, (samples: Float32Array) => {
                    try {
                      console.log(
                        `Audio processing: ${samples.length} samples, first sample: ${samples[0]}`
                      );

                      const audioData = processAudioForDeepgram(samples);

                      if (audioData.length > 0) {
                        console.log(`Sending ${audioData.length} samples to Deepgram`);
                        if (window.electronAPI?.ipcRenderer) {
                          window.electronAPI.ipcRenderer.invoke(
                            'send-audio-to-deepgram',
                            audioData.buffer
                          );
                        } else {
                          console.log('Electron API not available for audio transmission');
                        }
                      } else {
                        console.log('No audio data to send (silence detected)');
                      }
                    } catch (audioError) {
                      console.error('Error processing audio data:', audioError);
                    }
                  });
                }
              }

              console.log('Stream recovery completed');
            } else {
              console.error('Recovery failed - could not create new stream');
              stopRecording();
            }
          } catch (recoveryError) {
            console.error('Stream recovery failed:', recoveryError);
            stopRecording();
          }
        };

        // Attempt recovery before stopping
        attemptRecovery();
      });

      // Store cleanup function
      (audioStream as any)._cleanupMonitor = cleanupMonitor;

      setIsAudioRecording(true);
      if (recordingType === 'screen') {
        setIsScreenSharing(true);
      }
      setIsRecording(true);
      return { success: true };
    }, 'handleSourceSelected');

    if (!result) {
      setError('Failed to start recording. Please check permissions or try again.');
    }
  };

  const stopRecording = () => {
    console.log('Stopping recording and cleaning up resources...');

    // Stop Deepgram connection first
    if (window.electronAPI?.ipcRenderer) {
      window.electronAPI.ipcRenderer.invoke('stop-deepgram').catch((error) => {
        console.warn('Error stopping Deepgram connection:', error);
      });
    } else {
      console.log('Electron API not available for stopping Deepgram');
    }

    // Clean up Audio Worklet manager
    if (workletManager) {
      try {
        workletManager.cleanup();
      } catch (error) {
        console.warn('Error cleaning up Audio Worklet manager:', error);
      }
      setWorkletManager(null);
    }

    // Clean up audio context
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch((error) => {
        console.warn('Error closing audio context:', error);
      });
      setAudioContext(null);
    }

    // Clean up media stream
    if (userMedia) {
      try {
        // Clear any audio check intervals
        if ((userMedia as any)._audioCheckInterval) {
          clearInterval((userMedia as any)._audioCheckInterval);
          console.log('Cleared audio check interval');
        }
        
        // Stop all tracks
        userMedia.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (trackError) {
            console.warn('Error stopping track:', trackError);
          }
        });

        // Clear stream reference
        userMedia.getTracks().length = 0;
      } catch (streamError) {
        console.warn('Error cleaning up media stream:', streamError);
      }
      setUserMedia(null);
    }

    // Clear video reference
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Reset state
    setIsAudioRecording(false);
    setIsScreenSharing(false);
    setIsRecording(false);
    setRecordingType(null);

    console.log('Recording stopped and resources cleaned up');
  };

  const stopAudioRecording = () => {
    console.log('Stopping audio recording...');
    if (window.electronAPI?.ipcRenderer) {
      window.electronAPI.ipcRenderer.invoke('stop-deepgram').catch(() => {});
    } else {
      console.log('Electron API not available for stopping audio recording');
    }

    // Clean up Audio Worklet manager
    if (workletManager) {
      try {
        workletManager.cleanup();
      } catch {}
      setWorkletManager(null);
    }

    // Clean up ScriptProcessorNode fallback
    if (processor) {
      try {
        if (processor.onaudioprocess) {
          processor.onaudioprocess = null;
        }
        processor.disconnect();
      } catch {}
      setProcessor(null);
    }

    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
      setAudioContext(null);
    }
    if (userMedia) {
      try {
        userMedia.getTracks().forEach((t) => t.stop());
      } catch {}
      setUserMedia(null);
    }
    setIsAudioRecording(false);
    setIsRecording(isScreenSharing);
  };

  const stopScreenShare = () => {
    console.log('Stopping screen share...');
    const stream = (videoRef.current?.srcObject as MediaStream) || null;
    if (stream) {
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {}
    }
    if (videoRef.current) {
      (videoRef.current as any).srcObject = null;
    }
    setIsScreenSharing(false);
    setIsRecording(isAudioRecording);
  };

  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  useEffect(() => {
    if (aiResponseRef.current) {
      aiResponseRef.current.scrollTop = aiResponseRef.current.scrollHeight;
    }
    if (transcriptionRef.current) {
      transcriptionRef.current.scrollTop = transcriptionRef.current.scrollHeight;
    }
  }, [displayedAiResult, currentText]);

  const debounce = (func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  return (
    <div
      className="flex flex-col h-[calc(100vh-2.5rem)] p-4 space-y-4 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 gradient-animated"
    >
      <style>{markdownStyles}</style>
      <ErrorDisplay error={error} onClose={clearError} />
      {showScreenSharePicker && (
        <ScreenSharePicker
          onSourceSelected={handleSourceSelected}
          onClose={() => setShowScreenSharePicker(false)}
        />
      )}

      {/* Header with enhanced gradient background and accessibility */}
      <div
        className="flex justify-center items-center space-x-3 p-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-lg rounded-xl border border-white/10 shadow-2xl neon-glow"
        role="banner"
        aria-label="Recording controls"
      >
        <button
          onClick={() => (isAudioRecording ? stopAudioRecording() : startRecording('audio'))}
          disabled={!isConfigured}
          className={`btn btn-lg ${isAudioRecording ? 'btn-error' : 'btn-primary'} transition-all duration-300 hover:scale-105 hover:shadow-lg flex items-center space-x-2 pulse-on-hover`}
          aria-label={isAudioRecording ? 'Stop audio recording' : 'Start audio recording'}
          aria-pressed={isAudioRecording}
        >
          {isAudioRecording ? (
            <FaMicrophoneSlash className="text-xl pulse" />
          ) : (
            <FaMicrophone className="text-xl" />
          )}
          <span>{isAudioRecording ? 'Stop Recording' : 'Start Recording'}</span>
        </button>

        <button
          onClick={() => (isScreenSharing ? stopScreenShare() : startRecording('screen'))}
          disabled={!isConfigured}
          className={`btn btn-lg ${isScreenSharing ? 'btn-error' : 'btn-secondary'} transition-all duration-300 hover:scale-105 hover:shadow-lg flex items-center space-x-2 pulse-on-hover`}
          aria-label={isScreenSharing ? 'Stop screen sharing' : 'Start screen sharing'}
          aria-pressed={isScreenSharing}
        >
          {isScreenSharing ? (
            <FaStop className="text-xl pulse" />
          ) : (
            <FaDesktop className="text-xl" />
          )}
          <span>{isScreenSharing ? 'Stop Sharing' : 'Share Screen'}</span>
        </button>

        <div className="flex items-center space-x-2 bg-gradient-to-r from-green-500/20 to-blue-500/20 backdrop-blur-lg rounded-lg p-3 border border-white/10">
          <Timer isRunning={isAudioRecording || isScreenSharing} />
        </div>

        {/* DeepSeek Chat Toggle with Enhanced Icon */}
        <label className="flex items-center space-x-2 cursor-pointer bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-lg rounded-lg p-3 border border-white/10 transition-all duration-300 hover:scale-105 pulse-on-hover">
          <input
            type="checkbox"
            checked={isDeepSeekChatEnabled}
            onChange={(e) => setIsDeepSeekChatEnabled(e.target.checked)}
            className="toggle toggle-primary"
            aria-label="Toggle DeepSeek Chat AI assistance"
          />
          <div className="flex items-center space-x-1">
            <FaRobot
              className={`text-xl ${isDeepSeekChatEnabled ? 'text-purple-400 pulse' : 'text-gray-400'}`}
            />
            <span className="text-white font-medium">DeepSeek Chat</span>
          </div>
        </label>

        {/* PiP Window Toggle */}
        <button
          onClick={togglePiPWindow}
          className={`btn btn-lg ${isPiPWindowOpen ? 'btn-accent' : 'btn-outline'} transition-all duration-300 hover:scale-105 hover:shadow-lg flex items-center space-x-2 pulse-on-hover`}
          aria-label={isPiPWindowOpen ? 'Close PiP window' : 'Open PiP window'}
          aria-pressed={isPiPWindowOpen}
        >
          <FaWindowRestore className={`text-xl ${isPiPWindowOpen ? 'animate-pulse' : ''}`} />
          <span>PiP Window</span>
        </button>

        {/* Resume Self-Introduction Toggle */}
        <button
          onClick={() => {
            if (resumeIntroduction) {
              const newShowState = !showResumeIntro;
              setShowResumeIntro(newShowState);
              // Always reset maximize state when toggling visibility
              if (showResumeIntro) {
                setIsIntroMaximized(false);
              }
            }
          }}
          disabled={!resumeIntroduction}
          className={`btn btn-lg ${showResumeIntro ? 'btn-success' : 'btn-outline'} ${!resumeIntroduction ? 'btn-disabled' : 'hover:scale-105 hover:shadow-lg'} transition-all duration-300 flex items-center space-x-2 pulse-on-hover`}
          aria-label={showResumeIntro ? 'Hide Resume Self-Introduction' : 'Show Resume Self-Introduction'}
          aria-pressed={showResumeIntro}
          title={!resumeIntroduction ? 'No resume introduction available' : showResumeIntro ? 'Hide Resume Introduction (Ctrl+I)' : 'Show Resume Introduction (Ctrl+I)'}
        >
          <FaUser className={`text-xl ${showResumeIntro ? 'animate-pulse' : ''}`} />
          <span>Resume Intro</span>
          {resumeIntroduction && (
            <span className={`badge badge-sm ${showResumeIntro ? 'badge-success' : 'badge-outline'} animate-bounce`}>
              {showResumeIntro ? 'VISIBLE' : 'HIDDEN'}
            </span>
          )}
        </button>



        {/* Transcription Status Indicator with Enhanced Styling */}
        {isRecording && (
          <div
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl backdrop-blur-lg border transition-all duration-300 ${
              transcriptionStatus === 'recording'
                ? 'bg-green-500/20 border-green-400/50 text-green-300'
                : transcriptionStatus === 'error'
                  ? 'bg-red-500/20 border-red-400/50 text-red-300'
                  : transcriptionStatus === 'no-audio'
                    ? 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300'
                    : 'bg-blue-500/20 border-blue-400/50 text-blue-300'
            }`}
          >
            <span className="text-sm font-bold animate-pulse">
              {transcriptionStatus === 'recording'
                ? '🎤 Recording'
                : transcriptionStatus === 'error'
                  ? '❌ Transcription Error'
                  : transcriptionStatus === 'no-audio'
                    ? '🔇 No Audio Detected'
                    : '⏳ Starting...'}
            </span>
          </div>
        )}


      </div>
      <div className="flex flex-1 space-x-4 overflow-hidden">
        {/* Transcription Panel */}
        <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg p-4 rounded-2xl border border-white/10 shadow-2xl">
          {recordingType === 'screen' && (
            <div className="relative mb-4 rounded-xl overflow-hidden border border-white/20 shadow-lg">
              <video ref={videoRef} autoPlay muted className="w-full h-auto" />
              <div className="absolute top-2 right-2 bg-red-500/80 backdrop-blur-sm px-2 py-1 rounded-full">
                <span className="text-white text-xs font-bold animate-pulse">LIVE</span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <h3
              className="text-lg font-bold text-white flex items-center space-x-2"
              aria-label="Transcription panel"
            >
              <FaMicrophone className="text-blue-400 float" />
              <span>Transcription</span>
            </h3>
            <div className="flex items-center space-x-2" role="status" aria-live="polite">
              {isRecording && (
                <div
                  className="w-2 h-2 bg-red-500 rounded-full animate-pulse"
                  aria-label="Recording active"
                ></div>
              )}
              <span className="text-sm text-gray-300">{currentText.length} chars</span>
            </div>
          </div>
          <textarea
            ref={transcriptionRef}
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
            className="textarea textarea-bordered flex-1 mb-3 bg-gray-800/50 border-white/20 text-white placeholder-gray-400 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 transition-all duration-300 min-h-[120px] custom-scrollbar"
            placeholder="Your transcribed text will appear here..."
            aria-label="Transcription text area"
            aria-describedby="transcription-status"
          />
          <button
            onClick={() => setCurrentText('')}
            className="btn btn-ghost btn-sm text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-300 rounded-lg pulse-on-hover"
            aria-label="Clear transcription text"
          >
            Clear Transcription
          </button>
        </div>

        {/* Floating Resume Indicator - Always visible when hidden but available */}
        {resumeIntroduction && !showResumeIntro && (
          <div className="fixed top-20 right-4 z-50 animate-bounce">
            <div className="bg-green-600/90 backdrop-blur-lg border border-green-400/50 rounded-full px-4 py-2 shadow-lg">
              <div className="flex items-center space-x-2">
                <FaUser className="text-white text-sm animate-pulse" />
                <span className="text-white text-xs font-medium">Resume Hidden</span>
                <button
                  onClick={() => setShowResumeIntro(true)}
                  className="btn btn-xs btn-success btn-circle"
                  title="Show Resume Introduction"
                >
                  <span className="text-xs">👁</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resume Introduction Available Indicator - Enhanced */}
        {resumeIntroduction && !showResumeIntro && (
          <div className="mb-3 p-3 bg-green-800/40 border-2 border-green-500/60 rounded-lg text-center animate-pulse">
            <p className="text-green-300 text-sm font-medium">
              📋 Resume self-introduction is available but hidden!
            </p>
            <p className="text-green-400 text-xs mt-1">
              Press <kbd className="px-2 py-1 bg-gray-700 rounded text-xs font-mono">Ctrl+I</kbd> to show or <kbd className="px-2 py-1 bg-gray-700 rounded text-xs font-mono">Ctrl+S</kbd> to restore
            </p>
          </div>
        )}

        {/* Resume Self-Introduction Panel */}
        {showResumeIntro && resumeIntroduction && (
          <>
            {isIntroMaximized && (
              <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsIntroMaximized(false)} />
            )}
            <div className={`flex flex-col bg-gradient-to-br from-green-800/50 to-emerald-900/50 backdrop-blur-lg p-4 rounded-2xl border border-white/10 shadow-2xl ${
              isIntroMaximized ? 'fixed inset-4 z-50' : 'flex-1'
            }`}>
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-lg font-bold text-white flex items-center space-x-2"
                aria-label="Resume Self-Introduction panel"
              >
                <FaUser className="text-green-400" />
                <span>Resume Self-Introduction</span>
                {isIntroMaximized && (
                  <span className="text-xs bg-yellow-500 text-black px-2 py-1 rounded-full font-bold animate-pulse">
                    MAXIMIZED
                  </span>
                )}
                <span className="text-xs text-gray-300 ml-2">
                  (Ctrl+I: Hide/Show • Ctrl+Shift+I: Maximize • Ctrl+S: Hide/Restore • Ctrl+?: Help)
                </span>
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsIntroMaximized(!isIntroMaximized)}
                  className="btn btn-ghost btn-sm text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-300 rounded-lg"
                  aria-label={isIntroMaximized ? "Minimize introduction" : "Maximize introduction"}
                  title={isIntroMaximized ? "Minimize (Ctrl+Shift+I)" : "Maximize (Ctrl+Shift+I)"}
                >
                  {isIntroMaximized ? "Minimize" : "Maximize"}
                </button>
                <button
                  onClick={() => setShowResumeIntro(!showResumeIntro)}
                  className="btn btn-ghost btn-sm text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-300 rounded-lg"
                  aria-label={showResumeIntro ? "Hide introduction" : "Show introduction"}
                  title="Hide (Ctrl+I)"
                >
                  Hide
                </button>
                <button
                  onClick={() => {
                    setResumeIntroduction('');
                    setResumeData(null);
                    localStorage.removeItem('resumeIntroduction');
                    localStorage.removeItem('resumeData');
                    setShowResumeIntro(false);
                    setIsIntroMaximized(false);
                  }}
                  className="btn btn-ghost btn-sm text-gray-300 hover:text-red-400 hover:bg-white/10 transition-all duration-300 rounded-lg"
                  aria-label="Clear resume introduction"
                >
                  Clear
                </button>
              </div>
            </div>
            {showResumeIntro && (
              <div className={`overflow-auto bg-gray-800/30 p-4 rounded-xl border border-white/10 mb-3 custom-scrollbar text-white ${
                isIntroMaximized ? 'flex-1' : 'min-h-[120px]'
              }`}>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {resumeIntroduction}
                </div>
              </div>
            )}
            <div className="flex justify-between space-x-2">
              <button
                onClick={async (e) => {
                  try {
                    await navigator.clipboard.writeText(resumeIntroduction);
                    // Visual feedback
                    const button = e.currentTarget as HTMLButtonElement;
                    const originalText = button.innerHTML;
                    button.innerHTML = '<FaCopy /> Copied!';
                    button.classList.add('btn-success');
                    setTimeout(() => {
                      button.innerHTML = originalText;
                      button.classList.remove('btn-success');
                    }, 2000);
                  } catch (error) {
                    console.error('Failed to copy introduction:', error);
                    setError('Failed to copy introduction to clipboard.');
                  }
                }}
                className="btn btn-primary flex-1 flex items-center justify-center space-x-2 transition-all duration-300 hover:scale-105 hover:shadow-lg"
                aria-label="Copy self-introduction to clipboard"
              >
                <FaCopy />
                <span>Copy to Clipboard</span>
              </button>
            </div>
          </div>
        </>
        )}

        {/* AI Response Panel */}
        <div className="flex-1 flex flex-col bg-gradient-to-br from-purple-800/50 to-blue-900/50 backdrop-blur-lg p-4 rounded-2xl border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <h3
              className="text-lg font-bold text-white flex items-center space-x-2"
              aria-label="AI Assistant panel"
            >
              <FaRobot className={`text-purple-400 ${isDeepSeekChatEnabled ? 'pulse' : ''}`} />
              <span>AI Assistant</span>
            </h3>
            <div className="flex items-center space-x-2" role="status" aria-live="polite">
              <div
                className={`w-2 h-2 rounded-full ${isDeepSeekChatEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}
              ></div>
              <span className="text-sm text-gray-300">
                {isDeepSeekChatEnabled ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div
            ref={aiResponseRef}
            className="flex-1 overflow-auto bg-gray-800/30 p-4 rounded-xl border border-white/10 mb-3 min-h-[120px] custom-scrollbar text-white"
            role="region"
            aria-label="AI response content"
            aria-live="polite"
          >
            <ReactMarkdown
              className="whitespace-pre-wrap markdown-body"
              components={{
                p: ({ ...props }) => <p style={{ whiteSpace: 'pre-wrap' }} {...props} />,
              }}
            >
              {displayedAiResult || '*AI insights will appear here as you speak...*'}
            </ReactMarkdown>
          </div>
          <div className="flex justify-between space-x-2">
            <button
              onClick={debounce(() => handleAskDeepSeek(), 300)}
              disabled={!currentText || isLoading}
              className="btn btn-primary flex-1 flex items-center justify-center space-x-2 transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 pulse-on-hover"
              aria-label={isLoading ? 'AI is processing' : 'Ask DeepSeek AI for insights'}
              aria-busy={isLoading}
            >
              <FaRobot className={isLoading ? 'animate-spin' : 'pulse'} />
              <span>{isLoading ? 'Thinking...' : 'Ask DeepSeek'}</span>
            </button>
            <button
              onClick={handleGenerateSmartQuestions}
              disabled={isLoading}
              className="btn btn-secondary flex-1 flex items-center justify-center space-x-2 transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 pulse-on-hover bg-gradient-to-r from-yellow-500 to-orange-500 border-none text-white"
              aria-label="Generate smart questions for client"
            >
              <FaLightbulb className={isLoading ? 'animate-pulse' : ''} />
              <span>Suggest Questions</span>
            </button>
            <button
              onClick={() => setDisplayedAiResult('')}
              className="btn btn-ghost text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-300 rounded-lg pulse-on-hover"
              aria-label="Clear AI response"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewPage;
