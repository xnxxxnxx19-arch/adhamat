// Free, client-side speech recognition. The model is downloaded by the visitor's browser,
// cached there, and never sends microphone audio to this website's server.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

env.allowLocalModels = false;
env.useBrowserCache = true;

let recognizer = null;

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'load') {
      self.postMessage({ type: 'status', text: 'جارٍ تنزيل نموذج الذكاء الاصطناعي لأول مرة…' });
      try {
        recognizer = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-base.en', {
          device: 'webgpu',
          dtype: 'q8',
          progress_callback: info => {
            if (info.status === 'progress' && info.progress != null) {
              self.postMessage({ type: 'status', text: `تحميل النموذج: ${Math.round(info.progress)}%` });
            }
          },
        });
      } catch (error) {
        // Older devices fall back to WebAssembly. It is slower, but still fully free.
        recognizer = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-base.en', {
          device: 'wasm',
          dtype: 'q8',
        });
      }
      self.postMessage({ type: 'ready', text: 'النموذج جاهز. يمكنك البدء في الكلام.' });
    }

    if (data.type === 'transcribe') {
      if (!recognizer) throw new Error('Model is not ready');
      self.postMessage({ type: 'status', text: 'أفهم نطقك الآن…' });
      const result = await recognizer(new Float32Array(data.audio), {
        language: 'english',
        task: 'transcribe',
        chunk_length_s: 8,
        stride_length_s: 1,
      });
      self.postMessage({ type: 'transcript', text: result.text || '' });
    }
  } catch (error) {
    self.postMessage({ type: 'error', text: error.message || 'تعذر تشغيل Whisper.' });
  }
};
