import React, { useEffect, useMemo, useState } from 'react';
import {
  FaChrome,
  FaWindowMaximize,
  FaDesktop,
  FaVolumeUp,
  FaSearch,
  FaTimes,
} from 'react-icons/fa';
import '../styles/enhanced-ui.css';

interface ScreenSharePickerProps {
  onSourceSelected: (source: any) => void;
  onClose: () => void;
}

const ScreenSharePicker: React.FC<ScreenSharePickerProps> = ({ onSourceSelected, onClose }) => {
  const [sources, setSources] = useState<any[]>([]);
  const [tab, setTab] = useState<'browser' | 'window' | 'screen'>('browser');
  const [withAudio, setWithAudio] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const fetchSources = async () => {
      const screenSources = await window.electronAPI.getScreenSources();
      setSources(screenSources);
    };
    fetchSources();
  }, []);

  const windowSources = useMemo(
    () => sources.filter((s) => String(s.type || '').includes('window')),
    [sources]
  );
  const screenSources = useMemo(
    () => sources.filter((s) => String(s.type || '').includes('screen')),
    [sources]
  );

  const browserSources = useMemo(
    () =>
      windowSources.filter((s) =>
        ['google chrome', 'microsoft edge', 'brave', 'firefox', 'opera'].some((browser) =>
          s.name.toLowerCase().includes(browser)
        )
      ),
    [windowSources]
  );

  const filteredWindows = useMemo(
    () => windowSources.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())),
    [windowSources, query]
  );

  const filteredScreens = useMemo(
    () => screenSources.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())),
    [screenSources, query]
  );

  const filteredBrowsers = useMemo(
    () => browserSources.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())),
    [browserSources, query]
  );

  return (
    <div
      className="fixed inset-0 bg-gradient-to-br from-slate-900/90 to-purple-900/90 backdrop-blur-sm flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="screen-share-title"
    >
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 max-w-4xl w-full mx-4 border border-white/20 shadow-2xl neon-glow">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2
            id="screen-share-title"
            className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
          >
            Choose what to share
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 text-gray-400 hover:text-white pulse-on-hover"
            aria-label="Close screen share picker"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Tabs and Audio Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex space-x-1 bg-black/20 rounded-xl p-1">
            <button
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 ${tab === 'browser' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'} pulse-on-hover`}
              onClick={() => setTab('browser')}
              aria-label="Select Browser tab"
              aria-pressed={tab === 'browser'}
            >
              <FaChrome className="text-lg" />
              <span className="font-medium">Browser Tab</span>
            </button>
            <button
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 ${tab === 'window' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'} pulse-on-hover`}
              onClick={() => setTab('window')}
              aria-label="Select application window"
              aria-pressed={tab === 'window'}
            >
              <FaWindowMaximize className="text-lg" />
              <span className="font-medium">Window</span>
            </button>
            <button
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 ${tab === 'screen' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'} pulse-on-hover`}
              onClick={() => setTab('screen')}
              aria-label="Select entire screen"
              aria-pressed={tab === 'screen'}
            >
              <FaDesktop className="text-lg" />
              <span className="font-medium">Entire Screen</span>
            </button>
          </div>

          <label className="flex items-center space-x-3 cursor-pointer bg-black/20 rounded-xl p-3 transition-all duration-300 hover:bg-white/10 pulse-on-hover">
            <div className="relative">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={withAudio}
                onChange={(e) => setWithAudio(e.target.checked)}
                aria-label="Share audio with screen"
              />
            </div>
            <div className="flex items-center space-x-2">
              <FaVolumeUp className={`text-purple-400 ${withAudio ? 'pulse' : ''}`} />
              <span className="text-white font-medium">Share Audio</span>
            </div>
          </label>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <FaSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 custom-scrollbar"
            placeholder="Search windows or screens..."
            aria-label="Search screen share sources"
          />
        </div>

        {/* Browser Tab Selection */}
        {tab === 'browser' && (
          <div className="flex flex-col">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
              <div className="flex items-start space-x-3">
                <FaChrome className="text-blue-400 text-xl mt-1" />
                <div className="flex-1">
                  <h4 className="text-blue-400 font-bold mb-1">Chrome Profiles & Tabs</h4>
                  <p className="text-gray-300 text-sm mb-3">
                    To share a specific tab, you can use the System Picker which supports selecting individual tabs directly.
                    Alternatively, move the tab to a new window to see it listed below.
                  </p>
                  <button 
                    onClick={() => {
                      // Use the system/browser default picker (which might support tabs in some environments)
                      // or just bypass the custom picker
                      onSourceSelected({ id: 'system-picker', name: 'System Picker', thumbnail: '', appIcon: null, withAudio });
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 shadow-lg hover:shadow-blue-500/30"
                  >
                    <FaSearch className="text-xs" />
                    Open System Picker (Select Tab)
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto custom-scrollbar p-1">
              {filteredBrowsers.map((source) => (
                <div
                  key={source.id}
                  className="cursor-pointer group bg-gradient-to-br from-gray-700/50 to-gray-800/50 backdrop-blur-lg rounded-xl p-3 border border-white/10 hover:border-blue-400/50 transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
                  onClick={() => onSourceSelected({ id: source.id, withAudio })}
                >
                  <div className="relative mb-3 rounded-lg overflow-hidden">
                    <img src={source.thumbnail} className="w-full h-32 object-cover" alt={source.name} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs text-white border border-white/10">
                       Browser
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {source.appIcon ? (
                      <img src={source.appIcon} className="w-5 h-5 rounded" alt="icon" />
                    ) : (
                      <FaChrome className="text-gray-400" />
                    )}
                    <p className="text-white text-sm font-medium truncate flex-1" title={source.name}>{source.name}</p>
                  </div>
                </div>
              ))}
              {filteredBrowsers.length === 0 && (
                <div className="col-span-2 md:col-span-3 text-center py-12">
                  <div className="w-16 h-16 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FaChrome className="text-2xl text-gray-400" />
                  </div>
                  <p className="text-gray-400 font-medium">No browser windows detected</p>
                  <p className="text-gray-500 text-sm mt-2">Make sure your browser is open and not minimized.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Windows Grid */}
        {tab === 'window' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
            {filteredWindows.map((source) => (
              <div
                key={source.id}
                className="cursor-pointer group bg-gradient-to-br from-gray-700/50 to-gray-800/50 backdrop-blur-lg rounded-xl p-3 border border-white/10 hover:border-purple-400/50 transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
                onClick={() => onSourceSelected({ id: source.id, withAudio })}
              >
                <div className="relative mb-3 rounded-lg overflow-hidden">
                  <img src={source.thumbnail} className="w-full h-32 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
                <div className="flex items-center space-x-2">
                  {source.appIcon && <img src={source.appIcon} className="w-5 h-5 rounded" />}
                  <p className="text-white text-sm font-medium truncate flex-1">{source.name}</p>
                </div>
              </div>
            ))}
            {filteredWindows.length === 0 && (
              <div className="col-span-2 md:col-span-3 text-center py-8">
                <div className="w-16 h-16 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaWindowMaximize className="text-2xl text-gray-400" />
                </div>
                <p className="text-gray-400">No windows available</p>
              </div>
            )}
          </div>
        )}

        {/* Screens Grid */}
        {tab === 'screen' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-96 overflow-y-auto">
            {filteredScreens.map((source) => (
              <div
                key={source.id}
                className="cursor-pointer group bg-gradient-to-br from-gray-700/50 to-gray-800/50 backdrop-blur-lg rounded-xl p-4 border border-white/10 hover:border-blue-400/50 transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
                onClick={() => onSourceSelected({ id: source.id, withAudio })}
              >
                <div className="relative mb-4 rounded-xl overflow-hidden">
                  <img src={source.thumbnail} className="w-full h-40 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute top-3 right-3 bg-blue-500/80 backdrop-blur-sm px-2 py-1 rounded-full">
                    <span className="text-white text-xs font-bold">Screen</span>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <FaDesktop className="text-blue-400 text-lg" />
                  <p className="text-white font-medium">{source.name}</p>
                </div>
              </div>
            ))}
            {filteredScreens.length === 0 && (
              <div className="col-span-1 md:col-span-2 text-center py-8">
                <div className="w-16 h-16 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaDesktop className="text-2xl text-gray-400" />
                </div>
                <p className="text-gray-400">No screens available</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="btn btn-ghost text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-300 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScreenSharePicker;
