import React, { useState, useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import ErrorDisplay from '../components/ErrorDisplay';
import { languageOptions } from '../utils/languageOptions';

const Settings: React.FC = () => {
  const { error, setError, clearError } = useError();
  const [deepseekApiKey, setDeepseekApiKey] = useState('');
  const [deepseekApiBase, setDeepseekApiBase] = useState('');
  const [deepseekApiModel, setDeepseekApiModel] = useState('deepseek-chat');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [apiCallMethod, setApiCallMethod] = useState<'direct' | 'proxy'>('direct');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [primaryLanguage, setPrimaryLanguage] = useState('auto');
  const [secondaryLanguage, setSecondaryLanguage] = useState('');
  const [deepgramApiKey, setDeepgramApiKey] = useState('');
  const [aiSystemPrompt, setAiSystemPrompt] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      setDeepseekApiKey(config.deepseek_api_key || '');
      setDeepseekApiModel(config.deepseek_model || 'deepseek-chat');
      setDeepseekApiBase(config.deepseek_api_base || '');
      setApiCallMethod(config.api_call_method || 'direct');
      setPrimaryLanguage(config.primaryLanguage || 'auto');
      setSecondaryLanguage(config.secondaryLanguage || '');
      setDeepgramApiKey(config.deepgram_api_key || '');
      setAiSystemPrompt(config.ai_system_prompt || '');
    } catch (err) {
      console.error('Failed to load configuration', err);
      setError('Failed to load configuration. Please check your settings.');
    }
  };

  const handleSave = async () => {
    try {
      await window.electronAPI.setConfig({
        deepseek_api_key: deepseekApiKey,
        deepseek_model: deepseekApiModel,
        deepseek_api_base: deepseekApiBase,
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

  const testAPIConfig = async () => {
    try {
      setTestResult('Testing...');
      console.log('Sending test-api-config request with config:', {
        deepseek_api_key: deepseekApiKey,
        deepseek_model: deepseekApiModel,
        deepseek_api_base: deepseekApiBase,
      });
      const result = await window.electronAPI.testAPIConfig({
        deepseek_api_key: deepseekApiKey,
        deepseek_model: deepseekApiModel,
        deepseek_api_base: deepseekApiBase,
      });
      console.log('Received test-api-config result:', result);
      if (result.success) {
        setTestResult('API configuration is valid!');
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
      <div className="mb-4">
        <label className="label">AI System Prompt</label>
        <textarea
          value={aiSystemPrompt}
          onChange={(e) => setAiSystemPrompt(e.target.value)}
          className="textarea textarea-bordered w-full h-32"
          placeholder="Enter system prompt to guide AI responses. This will be prepended to all AI conversations."
        />
        <label className="label">
          <span className="label-text-alt">
            This prompt will guide the AI's behavior and response style. Use it to set specific
            instructions for the AI assistant.
          </span>
        </label>
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
