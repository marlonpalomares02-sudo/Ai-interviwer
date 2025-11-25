# Transcription Troubleshooting Guide

If transcription is not working, follow these steps to diagnose and fix the issue:

## 1. Check Deepgram API Key

The most common issue is an invalid or missing Deepgram API key.

### How to check:
1. Go to Settings page
2. Look for "Deepgram API Key" field
3. If empty, you need to add a valid Deepgram API key

### Getting a Deepgram API key:
1. Visit [Deepgram](https://deepgram.com/)
2. Sign up for a free account
3. Go to your dashboard and create an API key
4. Copy the API key and paste it in the settings

## 2. Check Audio Permissions

Make sure the application has microphone permissions:

### Windows:
1. Go to Windows Settings > Privacy & Security > Microphone
2. Ensure "Microphone access" is turned on
3. Check that the app is allowed to access the microphone

### Browser/Electron:
1. When prompted, allow microphone access
2. Check browser/electron permissions

## 3. Test Audio Input

### Check if microphone is working:
1. Open any voice recording app
2. Test if you can record audio
3. If not, check your microphone hardware and drivers

### In the app:
1. Start recording
2. Look for console logs showing audio processing
3. You should see messages like:
   - "Audio processing: 4096 samples, first sample: 0.123"
   - "Sending 4096 samples to Deepgram"

## 4. Check Console for Errors

Open Developer Tools (F12) and check for errors:

### Common error messages:
- `Failed to create audio stream` - Microphone permission issue
- `Deepgram connection error` - API key or network issue
- `No audio data to send` - Microphone not capturing audio

## 5. Network Issues

Deepgram requires internet connection:
- Check your internet connection
- Ensure no firewall is blocking Deepgram API
- Try accessing https://api.deepgram.com in browser

## 6. Quick Fixes

### Reset Configuration:
1. Go to Settings
2. Clear and re-enter Deepgram API key
3. Save settings
4. Restart the application

### Test with Simple Audio:
1. Speak clearly into the microphone
2. Ensure no background noise
3. Test with different volume levels

## 7. Debug Mode

The application now includes enhanced debugging:

### What to look for in console:
```
Audio processing: 4096 samples, first sample: 0.123
Sending 4096 samples to Deepgram
Received Deepgram transcript data: {transcript: "hello world", is_final: true}
Deepgram transcript: "hello world" (is_final: true)
Final transcript updated: hello world
```

### If you see:
- "No audio data to send" - Microphone issue
- "No transcript received from Deepgram" - Deepgram API issue
- Deepgram connections opening/closing repeatedly - API key issue

## 8. Common Solutions

### Issue: Deepgram connections open/close repeatedly
**Solution:** Invalid or missing Deepgram API key

### Issue: No audio processing logs
**Solution:** Microphone permission denied or hardware issue

### Issue: Audio processing but no transcripts
**Solution:** Network issue or Deepgram service problem

### Issue: Transcripts received but not displayed
**Solution:** UI state issue - check React component updates

## 9. Advanced Troubleshooting

### Check Deepgram API directly:
```bash
# Test Deepgram API with curl
curl -X POST \
  "https://api.deepgram.com/v1/listen" \
  -H "Authorization: Token YOUR_DEEPGRAM_API_KEY" \
  -H "Content-Type: audio/wav" \
  --data-binary @audio_file.wav
```

### Check Audio Constraints:
The app uses these audio constraints:
- Sample rate: 16000 Hz
- Channel count: 1 (mono)
- Echo cancellation: true
- Noise suppression: true
- Auto gain control: true

## 10. Contact Support

If issues persist:
1. Check Deepgram status: https://status.deepgram.com/
2. Verify your Deepgram account has available credits
3. Contact application support with console logs

## Quick Test Procedure

1. **Open Developer Tools** (F12)
2. **Go to Settings** and verify Deepgram API key
3. **Start Recording** and check console for:
   - Audio processing logs
   - Deepgram connection messages
   - Transcript data
4. **Speak clearly** into microphone
5. **Check if transcripts appear** in the text area

If all steps show proper logs but no transcripts appear, there may be a UI rendering issue.
