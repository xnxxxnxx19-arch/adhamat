import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

env.allowLocalModels = false;
env.useBrowserCache = true;

let recognizer = null;

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'load') {
      self.postMessage({ type: 'status', text: 'جارٍ تحميل نموذج سريع…' });
      const options = {
        dtype: 'q8',
        progress_callback: info => {
          if (info.status === 'progress' && info.progress != null) {
            self.postMessage({ type: 'status', text: `تحميل النموذج: ${Math.round(info.progress)}%` });
          }
        },
      };
      try {
        recognizer = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny.en', {
          ...options, device: 'webgpu',
        });
      } catch {
        recognizer = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny.en', {
          ...options, device: 'wasm',
        });
      }
      self.postMessage({ type: 'ready', text: 'النموذج السريع جاهز.' });
    }

    if (data.type === 'transcribe') {
      if (!recognizer) throw new Error('Model is not ready');
      self.postMessage({ type: 'status', text: 'أفهم نطقك الآن…' });
      const result = await recognizer(new Float32Array(data.audio), {
        chunk_length_s: 3,
        stride_length_s: 0,
      });
      self.postMessage({ type: 'transcript', text: result.text || '' });
    }
  } catch (error) {
    self.postMessage({ type: 'error', text: error.message || 'تعذر تشغيل التسميع.' });
  }
};
