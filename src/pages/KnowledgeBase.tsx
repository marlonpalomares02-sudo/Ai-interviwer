import React, { useState, useRef } from 'react';
import { useKnowledgeBase } from '../contexts/KnowledgeBaseContext';
import { useError } from '../contexts/ErrorContext';
import ErrorDisplay from '../components/ErrorDisplay';
import OpenAI from 'openai';
import ReactMarkdown from 'react-markdown';
import { FaFile, FaImage, FaSave, FaTrash, FaDownload } from 'react-icons/fa';

interface UploadedFile extends File {
  pdfText?: string;
  error?: string;
}

const KnowledgeBase: React.FC = () => {
  const {
    knowledgeBase,
    addToKnowledgeBase,
    conversations,
    addConversation,
    clearConversations,
    displayedAiResult,
    setDisplayedAiResult,
    templates,
    saveTemplate,
    deleteTemplate,
    loadTemplate,
  } = useKnowledgeBase();
  const { error, setError, clearError } = useError();
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateToSave, setTemplateToSave] = useState('');
  const [templateModalTitle, setTemplateModalTitle] = useState('');
  const [templateDefaultName, setTemplateDefaultName] = useState('');
  const [templateContentType, setTemplateContentType] = useState('text/plain');
  const [templateFileName, setTemplateFileName] = useState('');
  const [currentProvider, setCurrentProvider] = useState<string>('deepseek');

  // Centralized API key validation and configuration loading for selected provider
  const validateAndLoadAIConfig = async (): Promise<any> => {
    try {
      // Get current configuration
      let config = await window.electronAPI.getConfig();
      const selectedProvider = config.selected_provider || 'deepseek';
      
      console.log('Current config loaded:', { 
        selectedProvider,
        hasDeepseekKey: !!config.deepseek_api_key,
        hasGeminiKey: !!config.gemini_api_key
      });
      
      // Validate based on selected provider
      if (selectedProvider === 'deepseek') {
        // Check if DeepSeek API key is missing or placeholder
        if (!config.deepseek_api_key || config.deepseek_api_key === 'placeholder_deepseek_api_key') {
          console.log('DeepSeek API key missing or placeholder, updating with valid key...');
          
          try {
            // Update configuration with the valid API key from environment
            const updatedConfig = {
              ...config,
              deepseek_api_key: config.deepseek_api_key || process.env.DEEPSEEK_API_KEY || 'sk-ab9014b66b3948999d51a3ce089fc7c6'
            };
            
            console.log('Updating config with DeepSeek API key...');
            await window.electronAPI.setConfig(updatedConfig);
            
            // Re-load the updated configuration
            config = await window.electronAPI.getConfig();
          } catch (updateError) {
            console.error('Failed to update DeepSeek configuration:', updateError);
            throw new Error(`Failed to update DeepSeek API configuration: ${updateError.message}`);
          }
        }
        
        // Final validation for DeepSeek
        if (!config.deepseek_api_key || config.deepseek_api_key.trim() === '') {
          throw new Error('DeepSeek API key is empty or invalid after configuration loading');
        }
        
      } else if (selectedProvider === 'gemini') {
        // Check if Gemini API key is missing or placeholder
        if (!config.gemini_api_key || config.gemini_api_key === 'placeholder_gemini_api_key') {
          console.log('Gemini API key missing or placeholder, updating with valid key...');
          
          try {
            // Update configuration with the valid API key from environment
            const updatedConfig = {
              ...config,
              gemini_api_key: config.gemini_api_key || process.env.GEMINI_API_KEY || 'AIzaSyD9bPmdYEgSb91mSzBLsC9H4oLygJv4KDM'
            };
            
            console.log('Updating config with Gemini API key...');
            await window.electronAPI.setConfig(updatedConfig);
            
            // Re-load the updated configuration
            config = await window.electronAPI.getConfig();
          } catch (updateError) {
            console.error('Failed to update Gemini configuration:', updateError);
            throw new Error(`Failed to update Gemini API configuration: ${updateError.message}`);
          }
        }
        
        // Final validation for Gemini
        if (!config.gemini_api_key || config.gemini_api_key.trim() === '') {
          throw new Error('Gemini API key is empty or invalid after configuration loading');
        }
      }
      
      console.log(`${selectedProvider.toUpperCase()} config validation successful, API key is ready`);
      
      // Update current provider state
      setCurrentProvider(selectedProvider);
      
      return config;
    } catch (error) {
      console.error('AI configuration validation failed:', error);
      
      // Set user-friendly error message
      const provider = (await window.electronAPI.getConfig()).selected_provider || 'deepseek';
      const errorMessage = error.message.includes('Failed to update') 
        ? `Failed to configure ${provider.toUpperCase()} API. Please check your settings and try again.`
        : `${provider.toUpperCase()} API key is not configured. Please go to Settings to configure it.`;
      
      setError(errorMessage);
      throw error; // Re-throw to stop execution
    }
  };

  const openTemplateModal = (title: string, content: string, defaultName: string, contentType: string, fileName: string = '') => {
    setTemplateModalTitle(title);
    setTemplateToSave(content);
    setTemplateDefaultName(defaultName);
    setTemplateContentType(contentType);
    setTemplateFileName(fileName);
    setNewTemplateName(defaultName);
    setShowTemplateModal(true);
  };

  const simulateTyping = (text: string) => {
    let i = 0;
    setDisplayedAiResult('');
    const interval = setInterval(() => {
      if (i <= text.length) {
        setDisplayedAiResult(text.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setDisplayedAiResult((prev) => prev + '\n\n');
        }, 500);
      }
    }, 10);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() && uploadedFiles.length === 0) return;

    try {
      setIsLoading(true);
      let fileContents: string[] = [];

      if (uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          if ('pdfText' in file) {
            fileContents.push(file.pdfText);
          } else if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            const content = await new Promise<string>((resolve) => {
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsDataURL(file);
            });
            fileContents.push(content);
          } else {
            const reader = new FileReader();
            const content = await new Promise<string>((resolve) => {
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsText(file);
            });
            fileContents.push(content);
          }
        }
      }

      const userMessage = chatInput.trim()
        ? uploadedFiles.length > 0
          ? `[Files: ${uploadedFiles.map((f) => f.name).join(', ')}] ${chatInput}`
          : chatInput
        : uploadedFiles.length > 0
          ? `Please analyze the attached files: ${uploadedFiles.map((f) => f.name).join(', ')}`
          : '';
      addConversation({ role: 'user', content: userMessage });

      // Validate and load configuration using centralized function
      const config = await validateAndLoadAIConfig();
      const selectedProvider = config.selected_provider || 'deepseek';
      
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: '' },
        ...knowledgeBase.map((item) => {
          if (item.startsWith('data:image')) {
            return {
              role: 'user',
              content: [{ type: 'image_url', image_url: { url: item } } as const],
            } as OpenAI.Chat.ChatCompletionUserMessageParam;
          }
          return { role: 'user', content: item } as OpenAI.Chat.ChatCompletionUserMessageParam;
        }),
        ...conversations.map(
          (conv) =>
            ({
              role: conv.role,
              content: conv.content,
            }) as OpenAI.Chat.ChatCompletionMessageParam
        ),
      ];

      if (fileContents.length > 0) {
        for (const content of fileContents) {
          if (content.startsWith('data:image')) {
            messages.push({
              role: 'user',
              content: [{ type: 'image_url', image_url: { url: content } } as const],
            } as OpenAI.Chat.ChatCompletionUserMessageParam);
          } else {
            messages.push({
              role: 'user',
              content: content,
            } as OpenAI.Chat.ChatCompletionUserMessageParam);
          }
        }
      }

      messages.push({
        role: 'user',
        content: userMessage,
      } as OpenAI.Chat.ChatCompletionUserMessageParam);

      setChatInput('');
      setUploadedFiles([]);

      const response = await window.electronAPI.callDeepSeek({
        config: config,
        messages: messages,
      });

      if ('error' in response) {
        throw new Error(response.error);
      }

      if (typeof response.content !== 'string') {
        throw new Error('Unexpected API response structure');
      }

      addConversation({ role: 'assistant', content: response.content });
      simulateTyping(response.content);
    } catch (error) {
      console.error('Detailed error:', error);
      let errorMessage = 'Failed to get response from AI.';
      
      const provider = (await window.electronAPI.getConfig()).selected_provider || 'deepseek';
      
      if (error instanceof Error) {
        if (error.message.includes('Gemini Model Not Found') || error.message.includes('Gemini Bad Request') || error.message.includes('Gemini Access Denied')) {
          errorMessage = error.message;
        } else if (error.message.includes('API key')) {
          errorMessage = `${provider.toUpperCase()} API key is missing or invalid. Please check your settings.`;
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please try with shorter content.';
        } else if (error.message.includes('Network')) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.message.includes('404')) {
          errorMessage = `${provider.toUpperCase()} API endpoint or model not found. Please check your configuration.`;
        } else if (error.message.includes('401')) {
          errorMessage = `Authentication failed. Please check your ${provider.toUpperCase()} API key.`;
        } else {
          errorMessage = `${provider.toUpperCase()} API Error: ${error.message}`;
        }
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      if (uploadedFiles.length + newFiles.length > 3) {
        setError('You can only upload up to 3 files.');
        return;
      }
      console.log(
        'Processing files:',
        newFiles.map((f) => ({ name: f.name, type: f.type }))
      );
      const processedFiles = await Promise.all(
        newFiles.map(async (file) => {
          if (file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            console.log('Calling parsePDF for file:', file.name);
            const result = await window.electronAPI.parsePDF(arrayBuffer);
            console.log('parsePDF response received:', result);
            if (result.error) {
              console.error('Error parsing PDF:', result.error);
              return { ...file, error: result.error } as UploadedFile;
            }
            return {
              ...file,
              pdfText: result.text,
              name: file.name,
              type: file.type,
            } as UploadedFile;
          }
          return file as UploadedFile;
        })
      );
      console.log('Processed files:', processedFiles);
      setUploadedFiles((prevFiles) => [...prevFiles, ...processedFiles]);
    }
  };

  const saveFileAsTemplate = (file: UploadedFile) => {
    const content = file.pdfText || 'Image or file content';
    const defaultName = file.name.replace(/\.[^/.]+$/, "") || file.name;
    
    openTemplateModal('Save File as Template', content, defaultName, file.type, file.name);
  };

  const handleSaveTemplateFromModal = () => {
    if (newTemplateName.trim()) {
      saveTemplate(
        newTemplateName.trim(),
        templateToSave,
        templateFileName,
        templateContentType
      );
      setError('Template saved successfully!');
      setTimeout(() => clearError(), 3000);
    }
  };

  const loadTemplateToFiles = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const mockFile: UploadedFile = {
        name: template.fileName || template.name,
        type: template.fileType || 'text/plain',
        pdfText: template.content,
        size: template.content.length,
        lastModified: template.createdAt.getTime(),
        webkitRelativePath: '',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        slice: () => new Blob(),
        stream: () => new ReadableStream(),
        text: () => Promise.resolve(template.content),
      } as UploadedFile;
      
      setUploadedFiles(prev => [...prev, mockFile]);
      setError('Template loaded successfully!');
      setTimeout(() => clearError(), 3000);
    }
  };

  const saveMessageAsTemplate = (messageContent: string, conversationIndex: number) => {
    openTemplateModal('Save Message as Template', messageContent, `Message ${conversationIndex}`, 'text/plain', `message-${conversationIndex}`);
  };

  const loadTemplateToChatInput = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setChatInput(template.content);
      setError('Template loaded to chat input!');
      setTimeout(() => clearError(), 3000);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2.5rem)] p-2 max-w-4xl mx-auto">
      <ErrorDisplay error={error} onClose={clearError} />
      <div className="flex justify-between items-center mb-1">
        <h1 className="text-xl font-bold">Knowledge Base Chat</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            {templates.length} template{templates.length !== 1 ? 's' : ''} saved
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-auto mb-4 border-2 border-gray-300 rounded-lg p-4 bg-base-100 shadow-md">
        {conversations.map((conv, index) => (
          <div key={index} className={`mb-2 ${conv.role === 'user' ? 'text-right' : 'text-left'}`}>
            <div
              className={`inline-block p-2 rounded-lg ${
                conv.role === 'user'
                  ? 'bg-primary text-primary-content'
                  : 'bg-secondary text-secondary-content'
              }`}
            >
              {conv.role === 'user' ? (
                <div className="flex items-center gap-2">
                  <span>
                    {conv.content.startsWith('[Files:') ? (
                      <>
                        {conv.content.includes('image') ? (
                          <FaImage className="inline mr-1" />
                        ) : (
                          <FaFile className="inline mr-1" />
                        )}
                        {conv.content}
                      </>
                    ) : (
                      conv.content
                    )}
                  </span>
                  {!conv.content.startsWith('[Files:') && (
                    <button
                      onClick={() => saveMessageAsTemplate(conv.content, index)}
                      className="btn btn-xs btn-success ml-2"
                      title="Save as template"
                    >
                      <FaSave />
                    </button>
                  )}
                </div>
              ) : index === conversations.length - 1 ? (
                <ReactMarkdown>{displayedAiResult}</ReactMarkdown>
              ) : (
                <ReactMarkdown>{conv.content}</ReactMarkdown>
              )}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleChatSubmit} className="flex mb-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn btn-accent mr-2"
        >
          Upload
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
        />
        <div className="dropdown dropdown-top">
          <div tabIndex={0} role="button" className="btn btn-outline btn-info mr-2">
            Quick Templates
          </div>
          <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-64 max-h-80 overflow-y-auto">
            <li className="menu-title">
              <span>Load to Chat Input</span>
            </li>
            {templates.length === 0 ? (
              <li><a className="text-gray-500">No templates saved</a></li>
            ) : (
              templates.map((template) => (
                <li key={template.id}>
                  <a onClick={() => loadTemplateToChatInput(template.id)} className="flex flex-col">
                    <span className="font-medium truncate">{template.name}</span>
                    <span className="text-xs text-gray-500 truncate">
                      {template.content.substring(0, 50)}{template.content.length > 50 ? '...' : ''}
                    </span>
                  </a>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="dropdown dropdown-top">
          <div tabIndex={0} role="button" className="btn btn-outline btn-secondary mr-2">
            Templates ({templates.length})
          </div>
          <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-64 max-h-80 overflow-y-auto">
            <li className="menu-title">
              <span>Templates</span>
            </li>
            {templates.length === 0 ? (
              <li><a className="text-gray-500">No templates saved</a></li>
            ) : (
              templates.map((template) => (
                <li key={template.id} className="flex flex-row justify-between items-center">
                  <div className="flex-1">
                    <div className="flex flex-col mb-2">
                      <span className="font-medium truncate">{template.name}</span>
                      <span className="text-xs text-gray-500">
                        {template.fileName || 'Manual content'} • {new Date(template.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => loadTemplateToChatInput(template.id)}
                        className="btn btn-xs btn-primary flex-1"
                        title="Load to chat"
                      >
                        Chat
                      </button>
                      <button 
                        onClick={() => loadTemplateToFiles(template.id)}
                        className="btn btn-xs btn-secondary flex-1"
                        title="Load as file"
                      >
                        File
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete template "${template.name}"?`)) {
                        deleteTemplate(template.id);
                      }
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
        <div className="flex flex-grow items-center mr-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="input input-bordered flex-grow"
            placeholder="Type your message..."
          />
          {chatInput.trim() && (
            <button
              type="button"
              onClick={() => {
                openTemplateModal('Save Current Message as Template', chatInput, 'My Template', 'text/plain');
              }}
              className="btn btn-xs btn-success ml-2"
              title="Save current message as template"
            >
              <FaSave />
            </button>
          )}
        </div>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          Send
        </button>
      </form>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            clearConversations();
            setDisplayedAiResult('');
          }}
          className="btn btn-secondary flex-1"
        >
          Clear Chat
        </button>
        {conversations.length > 0 && (
          <button
            onClick={() => {
              const conversationText = conversations
                .map(conv => `${conv.role.toUpperCase()}: ${conv.content}`)
                .join('\n\n');
              openTemplateModal('Save Conversation as Template', conversationText, 'Conversation Template', 'text/plain', 'conversation-template');
            }}
            className="btn btn-accent"
            title="Save entire conversation as template"
          >
            <FaSave /> Save Conversation
          </button>
        )}
      </div>
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap items-center mb-1 p-2 bg-base-200 rounded-lg">
          {uploadedFiles.map((file, index) => (
            <div key={index} className="flex items-center mr-2 mb-1 bg-base-100 px-2 py-1 rounded border">
              {file && file.type ? (
                file.type.startsWith('image/') ? (
                  <FaImage className="mr-1 text-primary" />
                ) : (
                  <FaFile className="mr-1 text-primary" />
                )
              ) : (
                <FaFile className="mr-1 text-primary" />
              )}
              <span className="mr-2 text-sm">
                {file && file.name
                  ? file.name.length > 20
                    ? file.name.substring(0, 20) + '...'
                    : file.name
                  : 'Unknown file'}
              </span>
              <button
                onClick={() => saveFileAsTemplate(file)}
                className="btn btn-xs btn-success mr-1"
                title="Save as template"
              >
                <FaSave />
              </button>
              <button
                onClick={() => setUploadedFiles((files) => files.filter((_, i) => i !== index))}
                className="btn btn-xs btn-circle btn-ghost"
                title="Remove file"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Template Name Modal */}
      {showTemplateModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{templateModalTitle}</h3>
            <p className="py-4">Enter a name for your template:</p>
            <input
              type="text"
              placeholder="Template name"
              className="input input-bordered w-full"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newTemplateName.trim()) {
                  handleSaveTemplateFromModal();
                  setError(templateModalTitle.includes('Current Message') ? 'Current message saved as template!' : 
                           templateModalTitle.includes('Message') ? 'Message saved as template!' :
                           templateModalTitle.includes('Conversation') ? 'Conversation saved as template!' : 'Template saved successfully!');
                  setTimeout(() => clearError(), 3000);
                  setShowTemplateModal(false);
                  setNewTemplateName('');
                  setTemplateToSave('');
                }
              }}
              autoFocus
            />
            <div className="modal-action">
              <button
                className="btn btn-primary"
                onClick={() => {
                  handleSaveTemplateFromModal();
                  setError(templateModalTitle.includes('Current Message') ? 'Current message saved as template!' : 
                           templateModalTitle.includes('Message') ? 'Message saved as template!' :
                           templateModalTitle.includes('Conversation') ? 'Conversation saved as template!' : 'Template saved successfully!');
                  setTimeout(() => clearError(), 3000);
                  setShowTemplateModal(false);
                  setNewTemplateName('');
                  setTemplateToSave('');
                }}
                disabled={!newTemplateName.trim()}
              >
                Save
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowTemplateModal(false);
                  setNewTemplateName('');
                  setTemplateToSave('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
