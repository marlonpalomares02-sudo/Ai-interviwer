import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FaRobot,
  FaTimes,
  FaExpand,
  FaCompress,
  FaTrash,
  FaCopy,
  FaExternalLinkAlt,
} from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface PiPWindowProps {
  title?: string;
  initialSize?: { width: number; height: number };
  maxSize?: { width: number; height: number };
}

const PiPWindow: React.FC<PiPWindowProps> = ({
  title = 'AI Assistant',
  initialSize = { width: 400, height: 300 },
  maxSize = { width: 600, height: 500 },
}) => {
  const [aiContent, setAiContent] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const contentRef = useRef<HTMLDivElement>(null);
  const [wordCount, setWordCount] = useState(0);

  // Calculate word count
  useEffect(() => {
    const words = aiContent
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    setWordCount(words.length);
  }, [aiContent]);

  // Listen for content updates from main process
  useEffect(() => {
    const handleContentUpdate = (event: any, content: string) => {
      setAiContent((prev) => {
        if (!prev) return content;
        return prev + '\n\n' + content;
      });
    };

    const handleClearContent = () => {
      setAiContent('');
    };

    window.electronAPI.ipcRenderer.on('update-content', handleContentUpdate);
    window.electronAPI.ipcRenderer.on('clear-pip-content', handleClearContent);

    return () => {
      window.electronAPI.ipcRenderer.removeListener('update-content', handleContentUpdate);
      window.electronAPI.ipcRenderer.removeListener('clear-pip-content', handleClearContent);
    };
  }, []);

  // Auto-scroll functionality
  useEffect(() => {
    if (contentRef.current && autoScroll) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [aiContent, autoScroll]);

  const handleClose = useCallback(() => {
    window.electronAPI.ipcRenderer.invoke('toggle-pip-window');
  }, []);

  const toggleSize = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    window.electronAPI.ipcRenderer.invoke('resize-pip-window', newExpanded);
  }, [isExpanded]);

  const toggleMinimize = useCallback(() => {
    setIsMinimized(!isMinimized);
    window.electronAPI.ipcRenderer.invoke('minimize-pip-window', !isMinimized);
  }, [isMinimized]);

  const clearContent = useCallback(() => {
    setAiContent('');
  }, []);

  const copyContent = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(aiContent);
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy content:', error);
    }
  }, [aiContent]);

  const exportContent = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([aiContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-insights-${timestamp}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [aiContent]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const markdownStyles = `
    .markdown-body {
      font-size: 14px;
      line-height: 1.6;
      color: ${theme === 'dark' ? '#e2e8f0' : '#1a202c'};
    }
    .markdown-body p {
      margin-bottom: 12px;
    }
    .markdown-body h1, .markdown-body h2, .markdown-body h3 {
      margin-top: 16px;
      margin-bottom: 12px;
      font-weight: 600;
      color: ${theme === 'dark' ? '#c084fc' : '#7c3aed'};
    }
    .markdown-body code {
      background: ${theme === 'dark' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.1)'};
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      color: ${theme === 'dark' ? '#fbbf24' : '#d97706'};
    }
    .markdown-body pre {
      background: ${theme === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.05)'};
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
      border: 1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
    }
    .markdown-body blockquote {
      border-left: 4px solid ${theme === 'dark' ? '#8b5cf6' : '#7c3aed'};
      padding-left: 16px;
      margin: 16px 0;
      font-style: italic;
      color: ${theme === 'dark' ? '#a78bfa' : '#6b46c1'};
    }
    .markdown-body ul, .markdown-body ol {
      margin: 12px 0;
      padding-left: 24px;
    }
    .markdown-body li {
      margin: 4px 0;
    }
    .markdown-body strong {
      color: ${theme === 'dark' ? '#fbbf24' : '#d97706'};
      font-weight: 600;
    }
    .markdown-body em {
      color: ${theme === 'dark' ? '#a78bfa' : '#8b5cf6'};
    }
  `;

  const themeClasses =
    theme === 'dark'
      ? 'bg-gradient-to-br from-purple-900/90 to-blue-900/90 text-white'
      : 'bg-gradient-to-br from-blue-100 to-purple-100 text-gray-900';

  const headerClasses =
    theme === 'dark'
      ? 'bg-gradient-to-r from-purple-800 to-purple-900 border-white/10'
      : 'bg-gradient-to-r from-blue-200 to-purple-200 border-gray-300';

  return (
    <div
      className={`h-screen backdrop-blur-lg border rounded-lg overflow-hidden drag-region transition-all duration-300 ${
        theme === 'dark'
          ? 'border-white/20 from-purple-900/90 to-blue-900/90'
          : 'border-gray-300 from-blue-100 to-purple-100'
      } ${isMinimized ? 'h-12' : 'h-screen'}`}
    >
      <style>{markdownStyles}</style>

      {/* Header */}
      <div
        className={`flex items-center justify-between p-3 border-b transition-all duration-300 ${headerClasses}`}
      >
        <div className="flex items-center space-x-2 flex-1">
          <FaRobot
            className={`text-lg pulse ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}
          />
          <span className="font-medium text-sm">{title}</span>
          {!isMinimized && <span className="text-xs opacity-60 ml-2">{wordCount} words</span>}
        </div>

        {!isMinimized && (
          <div className="flex items-center space-x-1">
            <button
              onClick={toggleTheme}
              className={`p-1 rounded transition-all duration-200 no-drag ${
                theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-black/10'
              }`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`p-1 rounded transition-all duration-200 no-drag ${
                autoScroll
                  ? theme === 'dark'
                    ? 'text-green-400 hover:text-green-300'
                    : 'text-green-600 hover:text-green-700'
                  : theme === 'dark'
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
              aria-label={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
            >
              ↓
            </button>

            <button
              onClick={copyContent}
              className={`p-1 rounded transition-all duration-200 no-drag ${
                theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-black/10'
              }`}
              aria-label="Copy content"
            >
              <FaCopy className="text-xs" />
            </button>

            <button
              onClick={exportContent}
              className={`p-1 rounded transition-all duration-200 no-drag ${
                theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-black/10'
              }`}
              aria-label="Export content"
            >
              <FaExternalLinkAlt className="text-xs" />
            </button>

            <button
              onClick={toggleSize}
              className={`p-1 rounded transition-all duration-200 no-drag ${
                theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-black/10'
              }`}
              aria-label={isExpanded ? 'Shrink window' : 'Expand window'}
            >
              {isExpanded ? <FaCompress className="text-sm" /> : <FaExpand className="text-sm" />}
            </button>

            <button
              onClick={clearContent}
              className={`p-1 rounded transition-all duration-200 no-drag ${
                theme === 'dark'
                  ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/20'
                  : 'text-gray-600 hover:text-red-600 hover:bg-red-100'
              }`}
              aria-label="Clear content"
            >
              <FaTrash className="text-sm" />
            </button>

            <button
              onClick={toggleMinimize}
              className={`p-1 rounded transition-all duration-200 no-drag ${
                theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-black/10'
              }`}
              aria-label={isMinimized ? 'Maximize window' : 'Minimize window'}
            >
              {isMinimized ? '▲' : '▼'}
            </button>

            <button
              onClick={handleClose}
              className={`p-1 rounded transition-all duration-200 no-drag ${
                theme === 'dark'
                  ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/20'
                  : 'text-gray-600 hover:text-red-600 hover:bg-red-100'
              }`}
              aria-label="Close PiP window"
            >
              <FaTimes className="text-sm" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {!isMinimized && (
        <div
          ref={contentRef}
          className={`p-4 overflow-auto h-[calc(100%-60px)] custom-scrollbar no-drag transition-all duration-300 ${
            theme === 'dark' ? 'bg-transparent' : 'bg-white/50'
          }`}
        >
          {aiContent ? (
            <ReactMarkdown
              className="whitespace-pre-wrap markdown-body"
              components={{
                p: ({ node, ...props }) => <p style={{ whiteSpace: 'pre-wrap' }} {...props} />,
                code: ({ node, inline, className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter style={tomorrow} language={match[1]} PreTag="div" {...props}>
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {aiContent}
            </ReactMarkdown>
          ) : (
            <div
              className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
            >
              <FaRobot
                className={`text-4xl mx-auto mb-4 opacity-50 ${
                  theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                }`}
              />
              <p className="text-sm">AI insights will appear here...</p>
              <p className="text-xs mt-2 opacity-60">
                Start an interview to see real-time analysis
              </p>
            </div>
          )}
        </div>
      )}

      {/* Resize handle */}
      {!isMinimized && (
        <div
          className={`absolute bottom-0 right-0 w-4 h-4 cursor-se-resize rounded-tl-lg no-drag transition-all duration-200 ${
            theme === 'dark'
              ? 'bg-gradient-to-tl from-transparent to-white/20 hover:to-white/30'
              : 'bg-gradient-to-tl from-transparent to-black/10 hover:to-black/20'
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            window.electronAPI.ipcRenderer.invoke('start-resize', {
              x: e.screenX,
              y: e.screenY,
              direction: 'right-bottom',
            });
          }}
        ></div>
      )}
    </div>
  );
};

export default PiPWindow;
