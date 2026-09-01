import { env, pipeline } from '/vendor/transformers.min.js';
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/models/';
env.backends.onnx.wasm.wasmPaths = '/vendor/';
let extractor = null;
async function ensurePipeline(onProgress) {
  if (extractor === null) {
    extractor = await pipeline('feature-extraction', 'minilm', {
      quantized: true,
      dtype: 'q8',
      device: 'wasm',
      progress_callback: onProgress,
    });
  }
  return extractor;
}
self.onmessage = async (event) => {
  if (event.data.type !== 'embed') return;
  try {
    const pipe = await ensurePipeline((progress) => {
      if (progress.status === 'progress' && progress.total) {
        self.postMessage({
          type: 'progress',
          file: progress.file,
          loaded: progress.loaded,
          total: progress.total,
        });
      }
    });
    const output = await pipe(event.data.query, { pooling: 'mean', normalize: true });
    self.postMessage({ type: 'vector', vector: Array.from(output.data) });
  } catch (error) {
    self.postMessage({ type: 'error', message: String(error && error.message ? error.message : error) });
  }
};
