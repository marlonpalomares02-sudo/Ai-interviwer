# 🤖 AI Interview Assistant

An advanced Electron-based application that provides real-time interview transcription and AI-powered response generation using Deepgram and Deepseek APIs.

## 🌟 Features

### ✅ **Core Functionality**
- **Real-time Audio Transcription**: High-accuracy speech-to-text using Deepgram API
- **AI-Powered Responses**: Intelligent answer generation using Deepseek LLM
- **High-Definition Audio Processing**: Advanced audio enhancement and noise reduction
- **Echo Prevention**: AudioWorklet-based processing to eliminate audio feedback
- **Multi-language Support**: Support for various languages and accents

### 🎙️ **Audio Processing**
- **AudioWorklet Integration**: Modern web audio processing architecture
- **Noise Reduction**: Advanced filtering and enhancement algorithms
- **Audio Quality Monitoring**: Real-time signal-to-noise ratio analysis
- **Adaptive Gain Control**: Automatic volume optimization
- **High-Pass/Low-Pass Filtering**: Professional-grade audio processing

### 🧠 **AI Integration**
- **Deepgram API**: Industry-leading speech recognition
- **Deepseek LLM**: Advanced language model for intelligent responses
- **Contextual Understanding**: Maintains conversation context
- **Confidence Scoring**: Transcription accuracy metrics
- **Real-time Processing**: Low-latency audio-to-text conversion

### 🖥️ **User Interface**
- **Modern Electron App**: Cross-platform desktop application
- **Responsive Design**: Clean and intuitive interface
- **Real-time Transcript Display**: Live transcription with confidence indicators
- **Settings Management**: Configurable audio and AI parameters
- **Knowledge Base**: Store and manage interview content

## 🚀 Technical Architecture

### **Frontend Stack**
- **Electron**: Cross-platform desktop framework
- **React**: Modern UI library with hooks and context
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **DaisyUI**: Component library for consistent design

### **Audio Processing Pipeline**
```
Microphone → AudioWorklet → Noise Reduction → Gain Control → Deepgram API
```

### **AI Response Flow**
```
Transcript → Context Processing → Deepseek LLM → Response Generation → UI Display
```

### **Key Components**
- **`AudioWorkletManager`**: Manages audio processing workers
- **`TranscriptionOptimizer`**: Enhances transcription accuracy
- **`HighDefinitionAudioProcessor`**: Professional audio processing
- **`RealtimeTranscriptionProcessor`**: Handles live transcription
- **`ErrorHandling`**: Comprehensive error management

## 📦 Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Deepgram API key
- Deepseek API key

### Setup
1. **Clone the repository**
   ```bash
   git clone https://github.com/marlonpalomares02-sudo/Ai-interviwer.git
   cd Ai-interviwer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API keys**
   Create a `.env` file in the root directory:
   ```
   DEEPGRAM_API_KEY=your_deepgram_api_key_here
   DEEPSEEK_API_KEY=your_deepseek_api_key_here
   ```

4. **Start the application**
   ```bash
   npm start
   ```

## 🔧 Configuration

### Audio Settings
- **Sample Rate**: 48kHz for high-quality audio
- **Buffer Size**: Optimized for low latency
- **Noise Threshold**: Configurable noise reduction
- **Echo Cancellation**: Prevents audio feedback

### AI Settings
- **Language Model**: Configurable LLM parameters
- **Confidence Threshold**: Minimum transcription accuracy
- **Response Style**: Professional, casual, or technical
- **Context Window**: Conversation memory management

## 🛠️ Development

### Available Scripts
- `npm start` - Start the application in development mode
- `npm run package` - Package the application for distribution
- `npm run make` - Create distributables for current platform

### Project Structure
```
src/
├── components/          # React components
├── contexts/           # React context providers
├── pages/             # Main application pages
├── utils/             # Utility functions and services
├── audioWorklets/     # Audio processing workers
├── preload.ts         # Electron preload script
├── renderer.tsx       # React entry point
└── index.ts          # Electron main process
```

## 🔍 Troubleshooting

### Common Issues

1. **Audio Permission Issues**
   - Ensure microphone permissions are granted
   - Check browser audio settings
   - Verify audio device selection

2. **API Connection Issues**
   - Verify API keys are correctly set
   - Check internet connectivity
   - Review API rate limits

3. **Transcription Accuracy**
   - Adjust noise threshold settings
   - Check microphone quality
   - Verify language settings

### Error Handling
The application includes comprehensive error handling for:
- Audio processing failures
- API connection issues
- Network connectivity problems
- Permission denials

## 📈 Performance Optimization

### Audio Processing
- **AudioWorklet Architecture**: Prevents main thread blocking
- **Buffer Management**: Optimized memory usage
- **Real-time Processing**: Low-latency audio pipeline

### AI Integration
- **Streaming Transcription**: Real-time text generation
- **Context Management**: Efficient conversation memory
- **Response Caching**: Improved performance for repeated queries

## 🔒 Security

- **API Key Protection**: Secure storage of sensitive credentials
- **Input Validation**: Comprehensive data sanitization
- **Error Sanitization**: Safe error message handling
- **CSP Headers**: Content Security Policy implementation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Deepgram** for providing excellent speech recognition APIs
- **Deepseek** for advanced language model capabilities
- **Electron** for cross-platform desktop framework
- **React** for the powerful UI library

## 📞 Support

For issues and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section
- Review the documentation

---

**⭐ Star this repository if you find it helpful!**