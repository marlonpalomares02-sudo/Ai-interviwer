import React, { useState, useRef } from 'react';
import { useError } from '../contexts/ErrorContext';
import ErrorDisplay from '../components/ErrorDisplay';
import ReactMarkdown from 'react-markdown';
import { FaFilePdf, FaUser, FaBriefcase, FaGraduationCap, FaMagic, FaCopy, FaUpload, FaTrash, FaBolt } from 'react-icons/fa';

interface UploadedFile extends File {
  pdfText?: string;
  error?: string;
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

const ResumeAnalysisPage: React.FC = () => {
  const { error, setError, clearError } = useError();
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [generatedIntroduction, setGeneratedIntroduction] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // Check file type
      if (file.type !== 'application/pdf') {
        setError('Please upload a PDF file only.');
        return;
      }

      console.log('Processing file:', file.name);
      setIsLoading(true);

      try {
        const arrayBuffer = await file.arrayBuffer();
        console.log('Calling parsePDF for file:', file.name);
        const result = await window.electronAPI.parsePDF(arrayBuffer);
        console.log('parsePDF response received:', result);

        if (result.error) {
          console.error('Error parsing PDF:', result.error);
          setError(`Failed to parse PDF: ${result.error}`);
          setIsLoading(false);
          return;
        }

        const processedFile = {
          ...file,
          pdfText: result.text,
          name: file.name,
          type: file.type,
        } as UploadedFile;

        setUploadedFile(processedFile);
        setResumeData(null);
        setGeneratedIntroduction('');
        clearError();
      } catch (error) {
        console.error('Error processing file:', error);
        setError('Failed to process the uploaded file.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const analyzeResume = async (autoGenerateIntro = false) => {
    if (!uploadedFile?.pdfText) {
      setError('No resume text to analyze. Please upload a PDF first.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const config = await window.electronAPI.getConfig();
      
      // Check if DeepSeek API key is configured, if not, update it
      if (!config.deepseek_api_key || config.deepseek_api_key === 'placeholder_deepseek_api_key') {
        try {
          const updatedConfig = {
            ...config,
            deepseek_api_key: 'sk-8bd299211d094c16a60b98de2c6a9a85'
          };
          await window.electronAPI.setConfig(updatedConfig);
          // Re-get the updated config
          const newConfig = await window.electronAPI.getConfig();
          Object.assign(config, newConfig);
        } catch (updateError) {
          console.error('Failed to update DeepSeek configuration:', updateError);
          setError('DeepSeek API key is not configured. Please go to Settings to configure it.');
          setIsAnalyzing(false);
          return;
        }
      }
      
      // Optimized prompt for faster analysis
      const analysisPrompt = `
        QUICK ANALYSIS: Extract key resume information in JSON format.
        
        Resume text:
        ${uploadedFile.pdfText.substring(0, 4000)}
        
        Return ONLY this JSON structure:
        {
          "name": "full name",
          "email": "email",
          "phone": "phone",
          "experience": [{"title": "job title", "company": "company", "duration": "duration", "description": "key responsibilities"}],
          "education": [{"degree": "degree", "institution": "school", "year": "year"}],
          "skills": ["skill1", "skill2"],
          "summary": "brief professional summary"
        }
      `;

      const response = await window.electronAPI.callDeepSeek({
        config: config,
        messages: [
          { 
            role: 'system', 
            content: 'You are a fast resume parser. Extract key information and return ONLY valid JSON. No explanations. No markdown.' 
          },
          { role: 'user', content: analysisPrompt }
        ],
      });

      if ('error' in response) {
        throw new Error(response.error);
      }

      try {
        console.log('Raw AI response:', response.content);
        
        // Fast JSON cleaning and parsing
        let cleanedContent = response.content.trim();
        cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) cleanedContent = jsonMatch[0];
        
        const parsedData = JSON.parse(cleanedContent);
        setResumeData(parsedData);
        clearError();
        console.log('Successfully parsed resume data:', parsedData);
        
        // Auto-generate introduction if requested
        if (autoGenerateIntro) {
          await generateIntroduction(parsedData);
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError, 'Response:', response.content);
        
        // Quick JSON fix attempt
        try {
          let fixedContent = response.content.trim();
          fixedContent = fixedContent.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
          fixedContent = fixedContent.replace(/'/g, '"');
          fixedContent = fixedContent.replace(/,(\s*[}\]])/g, '$1');
          
          const parsedData = JSON.parse(fixedContent);
          setResumeData(parsedData);
          clearError();
          console.log('Successfully parsed after fixing JSON issues');
          
          // Auto-generate introduction if requested
          if (autoGenerateIntro) {
            await generateIntroduction(parsedData);
          }
        } catch (fixError) {
          console.error('Failed to fix JSON:', fixError);
          const errorMessage = response.content.length > 200 
            ? `Failed to parse resume analysis. First 200 chars: ${response.content.substring(0, 200)}...`
            : `Failed to parse resume analysis: ${response.content}`;
          setError(errorMessage);
        }
      }
    } catch (error) {
      console.error('Error analyzing resume:', error);
      setError('Failed to analyze resume. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateIntroduction = async (resumeDataParam?: ResumeData | React.MouseEvent<HTMLButtonElement>) => {
     // Handle both direct calls and onClick events
     let data: ResumeData | undefined;
     
     if (resumeDataParam && 'target' in resumeDataParam) {
       // This is an onClick event, use the current resumeData
       data = resumeData;
     } else {
       // This is a direct call with data parameter
       data = resumeDataParam as ResumeData | undefined;
     }
     
     if (!data) {
       data = resumeData;
     }
    
    if (!data) {
      setError('Please analyze a resume first.');
      return;
    }

    setIsGenerating(true);
    try {
      const config = await window.electronAPI.getConfig();
      
      // Check if DeepSeek API key is configured, if not, update it
      if (!config.deepseek_api_key || config.deepseek_api_key === 'placeholder_deepseek_api_key') {
        try {
          const updatedConfig = {
            ...config,
            deepseek_api_key: 'sk-8bd299211d094c16a60b98de2c6a9a85'
          };
          await window.electronAPI.setConfig(updatedConfig);
          // Re-get the updated config
          const newConfig = await window.electronAPI.getConfig();
          Object.assign(config, newConfig);
        } catch (updateError) {
          console.error('Failed to update DeepSeek configuration:', updateError);
          setError('DeepSeek API key is not configured. Please go to Settings to configure it.');
          setIsGenerating(false);
          return;
        }
      }
      
      console.log('Generating introduction with data:', data);
      
      // Create a clean copy of the data to avoid circular references
      const cleanData = {
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        experience: data.experience || [],
        education: data.education || [],
        skills: data.skills || [],
        summary: data.summary || ''
      };
      
      console.log('Clean data for introduction:', cleanData);
      
      // Optimized prompt for faster generation
      const introductionPrompt = `
        Create a 150-word self-introduction for interview using this resume data:
        ${JSON.stringify(cleanData, null, 2)}
        
        Requirements:
        - Professional greeting
        - Key experience highlights
        - Relevant skills
        - Enthusiasm
        - Natural, confident tone
        - Exactly 150 words
        
        Return ONLY the introduction text, no explanations.
      `;

      const response = await window.electronAPI.callDeepSeek({
        config: config,
        messages: [
          { 
            role: 'system', 
            content: 'You are a career coach. Create concise, impactful self-introductions. Return only the introduction text.' 
          },
          { role: 'user', content: introductionPrompt }
        ],
      });

      if ('error' in response) {
        throw new Error(response.error);
      }

      const introduction = response.content.trim();
      setGeneratedIntroduction(introduction);
      
      // Store in localStorage for access from InterviewPage
      localStorage.setItem('resumeIntroduction', introduction);
      localStorage.setItem('resumeData', JSON.stringify(data));
      
      clearError();
    } catch (error) {
      console.error('Error generating introduction:', error);
      if (error instanceof TypeError && error.message.includes('circular structure')) {
        setError('Failed to generate introduction due to data formatting issue. Please try analyzing the resume again.');
      } else {
        setError('Failed to generate introduction. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedIntroduction) return;
    
    try {
      await navigator.clipboard.writeText(generatedIntroduction);
      // Show temporary success message
      const originalError = error;
      setError('Introduction copied to clipboard!');
      setTimeout(() => {
        if (originalError) {
          setError(originalError);
        } else {
          clearError();
        }
      }, 2000);
    } catch (err) {
      setError('Failed to copy to clipboard.');
    }
  };

  const clearAll = () => {
    setUploadedFile(null);
    setResumeData(null);
    setGeneratedIntroduction('');
    clearError();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2.5rem)] p-4 space-y-4 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <ErrorDisplay error={error} onClose={clearError} />
      
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
          <FaUser className="text-blue-400" />
          <span>Resume Analysis & Introduction Generator</span>
        </h1>
        <button
          onClick={clearAll}
          className="btn btn-error btn-sm"
          disabled={!uploadedFile && !resumeData && !generatedIntroduction}
        >
          <FaTrash className="mr-1" />
          Clear All
        </button>
      </div>

      {/* File Upload Section */}
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg p-6 rounded-2xl border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <FaUpload className="text-blue-400" />
            <span>Upload Resume</span>
          </h2>
          <span className="text-sm text-gray-300">PDF format only</span>
        </div>
        
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/20 rounded-xl bg-black/20">
          {uploadedFile ? (
            <div className="text-center">
              <FaFilePdf className="text-4xl text-red-400 mx-auto mb-2" />
              <p className="text-white font-medium">{uploadedFile.name}</p>
              <p className="text-gray-300 text-sm mt-1">
                {uploadedFile.pdfText ? `${uploadedFile.pdfText.length} characters extracted` : 'Processing...'}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-outline btn-sm mt-4"
              >
                Change File
              </button>
            </div>
          ) : (
            <>
              <FaFilePdf className="text-5xl text-gray-400 mb-4" />
              <p className="text-gray-300 mb-4 text-center">
                Drag and drop your resume PDF here, or click to browse
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Upload PDF Resume'}
              </button>
            </>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf"
          />
        </div>

        {uploadedFile && (
          <div className="mt-4 flex justify-center space-x-4">
            <button
              onClick={() => analyzeResume(false)}
              className="btn btn-primary btn-lg"
              disabled={isAnalyzing || !uploadedFile.pdfText}
            >
              {isAnalyzing ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Analyzing...
                </>
              ) : (
                <>
                  <FaMagic className="mr-2" />
                  Analyze Resume
                </>
              )}
            </button>
            <button
              onClick={() => analyzeResume(true)}
              className="btn btn-accent btn-lg"
              disabled={isAnalyzing || !uploadedFile.pdfText}
              title="Analyze resume and automatically generate self-introduction"
            >
              {isAnalyzing ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Processing...
                </>
              ) : (
                <>
                  <FaBolt className="mr-2" />
                  Quick Analysis + Intro
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 space-x-4 overflow-hidden">
        {/* Resume Analysis Results */}
        <div className="flex-1 flex flex-col bg-gradient-to-br from-blue-800/50 to-blue-900/50 backdrop-blur-lg p-4 rounded-2xl border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <FaBriefcase className="text-blue-400" />
              <span>Resume Analysis</span>
            </h2>
            {resumeData && (
              <span className="text-sm text-green-300">✓ Analyzed</span>
            )}
          </div>
          
          <div className="flex-1 overflow-auto bg-gray-800/30 p-4 rounded-xl border border-white/10">
            {resumeData ? (
              <div className="space-y-4">
                {resumeData.name && (
                  <div>
                    <h3 className="text-white font-bold mb-1">Personal Information</h3>
                    <div className="bg-black/20 p-3 rounded-lg">
                      <p className="text-white"><strong>Name:</strong> {resumeData.name}</p>
                      {resumeData.email && <p className="text-white"><strong>Email:</strong> {resumeData.email}</p>}
                      {resumeData.phone && <p className="text-white"><strong>Phone:</strong> {resumeData.phone}</p>}
                    </div>
                  </div>
                )}

                {resumeData.experience && resumeData.experience.length > 0 && (
                  <div>
                    <h3 className="text-white font-bold mb-1">Work Experience</h3>
                    <div className="space-y-2">
                      {resumeData.experience.map((exp, index) => (
                        <div key={index} className="bg-black/20 p-3 rounded-lg">
                          <p className="text-white font-medium">{exp.title}</p>
                          <p className="text-gray-300">{exp.company} • {exp.duration}</p>
                          <p className="text-gray-300 text-sm mt-1">{exp.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {resumeData.education && resumeData.education.length > 0 && (
                  <div>
                    <h3 className="text-white font-bold mb-1">Education</h3>
                    <div className="space-y-2">
                      {resumeData.education.map((edu, index) => (
                        <div key={index} className="bg-black/20 p-3 rounded-lg">
                          <p className="text-white font-medium">{edu.degree}</p>
                          <p className="text-gray-300">{edu.institution} • {edu.year}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {resumeData.skills && resumeData.skills.length > 0 && (
                  <div>
                    <h3 className="text-white font-bold mb-1">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {resumeData.skills.map((skill, index) => (
                        <span key={index} className="badge badge-primary">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {resumeData.summary && (
                  <div>
                    <h3 className="text-white font-bold mb-1">Professional Summary</h3>
                    <div className="bg-black/20 p-3 rounded-lg">
                      <p className="text-gray-300">{resumeData.summary}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FaBriefcase className="text-4xl mb-2" />
                <p>Upload and analyze a resume to see details here</p>
              </div>
            )}
          </div>

          {resumeData && (
            <button
              onClick={generateIntroduction}
              className="btn btn-secondary mt-4"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Generating Introduction...
                </>
              ) : (
                <>
                  <FaMagic className="mr-2" />
                  Generate Self-Introduction
                </>
              )}
            </button>
          )}
        </div>

        {/* Generated Introduction */}
        <div className="flex-1 flex flex-col bg-gradient-to-br from-purple-800/50 to-purple-900/50 backdrop-blur-lg p-4 rounded-2xl border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <FaGraduationCap className="text-purple-400" />
              <span>Generated Self-Introduction</span>
            </h2>
            {generatedIntroduction && (
              <button
                onClick={copyToClipboard}
                className="btn btn-sm btn-outline"
                title="Copy to clipboard"
              >
                <FaCopy className="mr-1" />
                Copy
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-auto bg-gray-800/30 p-4 rounded-xl border border-white/10">
            {generatedIntroduction ? (
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown
                  className="whitespace-pre-wrap"
                  components={{
                    p: ({ ...props }) => <p style={{ whiteSpace: 'pre-wrap' }} {...props} />,
                  }}
                >
                  {generatedIntroduction}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FaGraduationCap className="text-4xl mb-2" />
                <p className="text-center">
                  {resumeData 
                    ? 'Click "Generate Self-Introduction" to create a tailored introduction'
                    : 'Analyze a resume first to generate a self-introduction'
                  }
                </p>
              </div>
            )}
          </div>

          {generatedIntroduction && (
            <div className="mt-4 flex space-x-2">
              <button
                onClick={generateIntroduction}
                className="btn btn-outline flex-1"
                disabled={isGenerating}
              >
                Regenerate
              </button>
              <button
                onClick={copyToClipboard}
                className="btn btn-primary flex-1"
              >
                <FaCopy className="mr-2" />
                Copy Introduction
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResumeAnalysisPage;
