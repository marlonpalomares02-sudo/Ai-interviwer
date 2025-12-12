import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

interface Conversation {
  role: string;
  content: string;
}

interface KnowledgeBaseTemplate {
  id: string;
  name: string;
  content: string;
  fileName?: string;
  fileType?: string;
  createdAt: Date;
}

interface KnowledgeBaseContextType {
  knowledgeBase: string[];
  addToKnowledgeBase: (content: string) => void;
  setKnowledgeBase: (knowledgeBase: string[]) => void;
  conversations: Conversation[];
  addConversation: (conversation: Conversation) => void;
  clearConversations: () => void;
  displayedAiResult: string;
  setDisplayedAiResult: React.Dispatch<React.SetStateAction<string>>;
  templates: KnowledgeBaseTemplate[];
  saveTemplate: (name: string, content: string, fileName?: string, fileType?: string) => void;
  deleteTemplate: (id: string) => void;
  loadTemplate: (id: string) => string;
}

const KnowledgeBaseContext = createContext<KnowledgeBaseContextType | undefined>(undefined);

export const KnowledgeBaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [knowledgeBase, setKnowledgeBase] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [displayedAiResult, setDisplayedAiResult] = useState('');
  const [templates, setTemplates] = useState<KnowledgeBaseTemplate[]>([]);

  useEffect(() => {
    const savedKnowledgeBase = localStorage.getItem('knowledgeBase');
    const savedConversations = localStorage.getItem('conversations');
    const savedTemplates = localStorage.getItem('knowledgeBaseTemplates');
    if (savedKnowledgeBase) {
      setKnowledgeBase(JSON.parse(savedKnowledgeBase));
    }
    if (savedConversations) {
      setConversations(JSON.parse(savedConversations));
    }
    if (savedTemplates) {
      const parsedTemplates = JSON.parse(savedTemplates);
      // Convert date strings back to Date objects
      setTemplates(parsedTemplates.map((t: any) => ({
        ...t,
        createdAt: new Date(t.createdAt)
      })));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('knowledgeBase', JSON.stringify(knowledgeBase));
  }, [knowledgeBase]);

  useEffect(() => {
    localStorage.setItem('conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('knowledgeBaseTemplates', JSON.stringify(templates));
  }, [templates]);

  const addToKnowledgeBase = (content: string) => {
    setKnowledgeBase((prev) => [...prev, content]);
  };

  const addConversation = (conversation: Conversation) => {
    setConversations((prev) => [...prev, conversation]);
  };

  const clearConversations = () => {
    setConversations([]);
  };

  const saveTemplate = (name: string, content: string, fileName?: string, fileType?: string) => {
    const newTemplate: KnowledgeBaseTemplate = {
      id: Date.now().toString(),
      name,
      content,
      fileName,
      fileType,
      createdAt: new Date()
    };
    setTemplates(prev => [...prev, newTemplate]);
  };

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(template => template.id !== id));
  };

  const loadTemplate = (id: string): string => {
    const template = templates.find(t => t.id === id);
    return template ? template.content : '';
  };

  return (
    <KnowledgeBaseContext.Provider
      value={{
        knowledgeBase,
        addToKnowledgeBase,
        setKnowledgeBase,
        conversations,
        addConversation,
        clearConversations,
        displayedAiResult,
        setDisplayedAiResult,
        templates,
        saveTemplate,
        deleteTemplate,
        loadTemplate,
      }}
    >
      {children}
    </KnowledgeBaseContext.Provider>
  );
};

export const useKnowledgeBase = () => {
  const context = useContext(KnowledgeBaseContext);
  if (context === undefined) {
    throw new Error('useKnowledgeBase must be used within a KnowledgeBaseProvider');
  }
  return context;
};
