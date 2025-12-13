import React, { useState, useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import ErrorDisplay from '../components/ErrorDisplay';
import { languageOptions } from '../utils/languageOptions';
import { FaSave, FaTrash } from 'react-icons/fa';

const defaultSystemPrompt = `You are a digital marketing specialist with 10 years of experience. Your expertise covers Google Ads, Meta Ads, campaign setup, bidding strategies, keyword research, copywriting, conversion tracking (including GA4 and Google Tag), and landing page optimization.

When analyzing the interview transcription:
1. Keep answers short, sharp, and precise. No long lectures.
2. Adopt a casual, smart, and confident tone—like a pro having a chat.
3. Drop quick, relevant examples to show you know your stuff (e.g., "I'd check GA4 debug view first").
4. Focus on high-impact strategies and results.`;

interface PromptTemplate {
  name: string;
  prompt: string;
}

const Settings: React.FC = () => {
  const { error, setError, clearError } = useError();
  const [deepseekApiKey, setDeepseekApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiApiModel, setOpenaiApiModel] = useState('gpt-3.5-turbo');
  const [openaiApiBase, setOpenaiApiBase] = useState('');
  const [deepseekApiBase, setDeepseekApiBase] = useState('');
  const [deepseekApiModel, setDeepseekApiModel] = useState('deepseek-chat');
  const [geminiApiModel, setGeminiApiModel] = useState('gemini-1.5-flash');
  const [selectedProvider, setSelectedProvider] = useState<'deepseek' | 'gemini' | 'openai'>('deepseek');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [apiCallMethod, setApiCallMethod] = useState<'direct' | 'proxy'>('direct');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [primaryLanguage, setPrimaryLanguage] = useState('auto');
  const [secondaryLanguage, setSecondaryLanguage] = useState('');
  const [deepgramApiKey, setDeepgramApiKey] = useState('');
  const [aiSystemPrompt, setAiSystemPrompt] = useState(defaultSystemPrompt);
  
  // Template state
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  useEffect(() => {
    loadConfig();
    loadTemplates();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      setDeepseekApiKey(config.deepseek_api_key || '');
      setGeminiApiKey(config.gemini_api_key || '');
      setOpenaiApiKey(config.openai_key || '');
      setOpenaiApiModel(config.gpt_model || 'gpt-3.5-turbo');
      setOpenaiApiBase(config.api_base || '');
      setDeepseekApiModel(config.deepseek_model || 'deepseek-chat');
      setDeepseekApiBase(config.deepseek_api_base || '');
      setGeminiApiModel(config.gemini_model || 'gemini-1.5-flash');
      setSelectedProvider(config.selected_provider || 'deepseek');
      setApiCallMethod(config.api_call_method || 'direct');
      setPrimaryLanguage(config.primaryLanguage || 'auto');
      setSecondaryLanguage(config.secondaryLanguage || '');
      setDeepgramApiKey(config.deepgram_api_key || '');
      setAiSystemPrompt(config.ai_system_prompt || defaultSystemPrompt);
    } catch (err) {
      console.error('Failed to load configuration', err);
      setError('Failed to load configuration. Please check your settings.');
    }
  };

  const loadTemplates = async () => {
    try {
      const savedTemplates = await window.electronAPI.getPromptTemplates();
      setTemplates(savedTemplates || []);
    } catch (err) {
      console.error('Failed to load templates', err);
    }
  };

  const handleSave = async () => {
    try {
      await window.electronAPI.setConfig({
        deepseek_api_key: deepseekApiKey,
        gemini_api_key: geminiApiKey,
        openai_key: openaiApiKey,
        gpt_model: openaiApiModel,
        api_base: openaiApiBase,
        deepseek_model: deepseekApiModel,
        deepseek_api_base: deepseekApiBase,
        gemini_model: geminiApiModel,
        selected_provider: selectedProvider,
        api_call_method: apiCallMethod,
        primaryLanguage: primaryLanguage,
        deepgram_api_key: deepgramApiKey,
        ai_system_prompt: aiSystemPrompt,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save configuration');
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) return;
    
    try {
      const newTemplates = [...templates, { name: newTemplateName, prompt: aiSystemPrompt }];
      await window.electronAPI.setPromptTemplates(newTemplates);
      setTemplates(newTemplates);
      setNewTemplateName('');
      setShowSaveTemplate(false);
    } catch (err) {
      setError('Failed to save template');
    }
  };

  const handleDeleteTemplate = async (index: number) => {
    try {
      const newTemplates = templates.filter((_, i) => i !== index);
      await window.electronAPI.setPromptTemplates(newTemplates);
      setTemplates(newTemplates);
    } catch (err) {
      setError('Failed to delete template');
    }
  };

  const applyTemplate = (prompt: string) => {
    setAiSystemPrompt(prompt);
  };

  const handleGeminiModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'custom') {
      setGeminiApiModel('');
    } else {
      setGeminiApiModel(value);
    }
  };

  const testAPIConfig = async () => {
    try {
      setTestResult('Testing...');
      
      // First, get the current saved configuration to use as fallback
      const savedConfig = await window.electronAPI.getConfig();
      
      // If DeepSeek is selected and no API key is provided, automatically use the hardcoded one
      let finalDeepseekKey = deepseekApiKey || savedConfig.deepseek_api_key;
      if (selectedProvider === 'deepseek' && (!finalDeepseekKey || finalDeepseekKey === 'placeholder_deepseek_api_key')) {
        finalDeepseekKey = 'sk-8bd299211d094c16a60b98de2c6a9a85';
        // Also update the state to show the user what key is being used
        setDeepseekApiKey(finalDeepseekKey);
      }
      
      // Use form values if provided, otherwise use saved values
      const testConfig = {
        deepseek_api_key: finalDeepseekKey,
        gemini_api_key: geminiApiKey || savedConfig.gemini_api_key || '',
        openai_key: openaiApiKey || savedConfig.openai_key || '',
        gpt_model: openaiApiModel || savedConfig.gpt_model || 'gpt-3.5-turbo',
        api_base: openaiApiBase || savedConfig.api_base || '',
        deepseek_model: deepseekApiModel || savedConfig.deepseek_model || 'deepseek-chat',
        deepseek_api_base: deepseekApiBase || savedConfig.deepseek_api_base || '',
        gemini_model: geminiApiModel || savedConfig.gemini_model || 'gemini-1.5-flash',
        selected_provider: selectedProvider || savedConfig.selected_provider || 'deepseek',
      };
      
      console.log('Sending test-api-config request with config:', testConfig);
      const result = await window.electronAPI.testAPIConfig(testConfig);
      console.log('Received test-api-config result:', result);
      if (result.success) {
        setTestResult('API configuration is valid!');
        
        // If test was successful and we used the hardcoded key, save the configuration
        if (selectedProvider === 'deepseek' && deepseekApiKey !== finalDeepseekKey) {
          try {
            await handleSave();
            setTestResult('API configuration is valid! Settings saved automatically.');
          } catch (saveError) {
            console.error('Failed to save configuration after successful test:', saveError);
            setTestResult('API configuration is valid! (But failed to save settings automatically)');
          }
        }
      } else {
        setTestResult(`API configuration test failed: ${result.error || 'Unknown error'}`);
        setError(`Failed to test API configuration: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('API configuration test error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setTestResult(`API configuration test failed: ${errorMessage}`);
      setError(`Failed to test API configuration: ${errorMessage}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <ErrorDisplay error={error} onClose={clearError} />
      <h1 className="text-2xl font-bold mb-4">Settings</h1>

      <div className="mb-4">
        <label className="label">AI Provider</label>
        <select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value as 'deepseek' | 'gemini' | 'openai')}
          className="select select-bordered w-full"
        >
          <option value="deepseek">DeepSeek Chat</option>
          <option value="gemini">Google Gemini Flash</option>
          <option value="openai">OpenAI GPT</option>
        </select>
      </div>

      {selectedProvider === 'deepseek' && (
        <>
          <div className="mb-4">
            <label className="label">DeepSeek API Key</label>
            <input
              type="password"
              value={deepseekApiKey}
              onChange={(e) => setDeepseekApiKey(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>
          <div className="mb-4">
            <label className="label">DeepSeek API Base URL (Optional)</label>
            <input
              type="text"
              value={deepseekApiBase}
              onChange={(e) => setDeepseekApiBase(e.target.value)}
              className="input input-bordered w-full"
            />
            <label className="label">
              <span className="label-text-alt">
                Enter proxy URL if using API proxy. For example: https://your-proxy.com/v1
              </span>
            </label>
          </div>
          <div className="mb-4">
            <label className="label">DeepSeek API Model</label>
            <input
              type="text"
              value={deepseekApiModel}
              onChange={(e) => setDeepseekApiModel(e.target.value)}
              className="input input-bordered w-full"
            />
            <label className="label">
              <span className="label-text-alt">
                Please use a model supported by your API. Preferably deepseek-chat.
              </span>
            </label>
          </div>
        </>
      )}

      {selectedProvider === 'gemini' && (
        <>
          <div className="mb-4">
            <label className="label">Gemini API Key</label>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="input input-bordered w-full"
              placeholder="Enter your Google Gemini API Key"
            />
          </div>
          <div className="mb-4">
            <label className="label">Gemini Model</label>
            <select
              value={['gemini-1.5-flash-001', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'].includes(geminiApiModel) ? geminiApiModel : 'custom'}
              onChange={handleGeminiModelChange}
              className="select select-bordered w-full mb-2"
            >
              <option value="gemini-1.5-flash-001">Gemini 1.5 Flash (Recommended)</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</option>
              <option value="custom">Custom Model ID...</option>
            </select>
            
            {!['gemini-1.5-flash-001', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'].includes(geminiApiModel) && (
              <input
                type="text"
                value={geminiApiModel}
                onChange={(e) => setGeminiApiModel(e.target.value)}
                className="input input-bordered w-full"
                placeholder="Enter custom model ID (e.g., gemini-1.0-pro)"
              />
            )}
            <label className="label">
              <span className="label-text-alt">
                Select a preset or enter a specific model ID manually.
              </span>
            </label>
          </div>
        </>
      )}

      {selectedProvider === 'openai' && (
        <>
          <div className="mb-4">
            <label className="label">OpenAI API Key</label>
            <input
              type="password"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              className="input input-bordered w-full"
              placeholder="Enter your OpenAI API Key"
            />
          </div>
          <div className="mb-4">
            <label className="label">OpenAI API Base URL (Optional)</label>
            <input
              type="text"
              value={openaiApiBase}
              onChange={(e) => setOpenaiApiBase(e.target.value)}
              className="input input-bordered w-full"
              placeholder="https://api.openai.com/v1"
            />
            <label className="label">
              <span className="label-text-alt">
                Enter proxy URL if using API proxy. Default: https://api.openai.com/v1
              </span>
            </label>
          </div>
          <div className="mb-4">
            <label className="label">OpenAI Model</label>
            <select
              value={openaiApiModel}
              onChange={(e) => setOpenaiApiModel(e.target.value)}
              className="select select-bordered w-full"
            >
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-4-turbo-preview">GPT-4 Turbo</option>
            </select>
          </div>
        </>
      )}

      <div className="mb-4">
        <label className="label">API Call Method</label>
        <select
          value={apiCallMethod}
          onChange={(e) => setApiCallMethod(e.target.value as 'direct' | 'proxy')}
          className="select select-bordered w-full"
        >
          <option value="direct">Direct</option>
          <option value="proxy">Proxy</option>
        </select>
      </div>
      <div className="mb-4">
        <label className="label">Deepgram API Key</label>
        <input
          type="password"
          value={deepgramApiKey}
          onChange={(e) => setDeepgramApiKey(e.target.value)}
          className="input input-bordered w-full"
        />
      </div>
      <div className="mb-4">
        <label className="label">Primary Language</label>
        <select
          value={primaryLanguage}
          onChange={(e) => setPrimaryLanguage(e.target.value)}
          className="select select-bordered w-full"
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      
      {/* AI System Prompt Section */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="label font-bold">AI System Prompt</label>
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-sm btn-outline">
              Load Template
            </div>
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
              {templates.length === 0 ? (
                <li><a className="text-gray-500">No templates saved</a></li>
              ) : (
                templates.map((template, index) => (
                  <li key={index} className="flex flex-row justify-between items-center">
                    <a onClick={() => applyTemplate(template.prompt)} className="flex-1 truncate">
                      {template.name}
                    </a>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(index);
                      }}
                      className="btn btn-ghost btn-xs text-error"
                    >
                      <FaTrash />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
        
        <textarea
          value={aiSystemPrompt}
          onChange={(e) => setAiSystemPrompt(e.target.value)}
          className="textarea textarea-bordered w-full h-32"
          placeholder="Enter system prompt to guide AI responses. This will be prepended to all AI conversations."
        />
        
        <div className="flex justify-between items-center mt-2">
          <label className="label">
            <span className="label-text-alt">
              This prompt will guide the AI's behavior and response style.
            </span>
          </label>
          
          {!showSaveTemplate ? (
            <button 
              onClick={() => setShowSaveTemplate(true)} 
              className="btn btn-xs btn-outline btn-success gap-1"
            >
              <FaSave /> Save as Template
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Template Name"
                className="input input-bordered input-xs w-32"
              />
              <button onClick={handleSaveTemplate} className="btn btn-xs btn-success">
                Save
              </button>
              <button onClick={() => setShowSaveTemplate(false)} className="btn btn-xs btn-ghost">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between mt-4">
        <button onClick={handleSave} className="btn btn-primary">
          Save Settings
        </button>
        <button onClick={testAPIConfig} className="btn btn-secondary">
          Test API Configuration
        </button>
      </div>
      {saveSuccess && <p className="text-success mt-2">Settings saved successfully</p>}
      {testResult && (
        <p className={`mt-2 ${testResult.includes('valid') ? 'text-success' : 'text-error'}`}>
          {testResult}
        </p>
      )}
    </div>
  );
};

export default Settings;
