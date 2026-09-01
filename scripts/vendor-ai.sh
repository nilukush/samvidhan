#!/bin/sh
# Self-hosts the browser bundles for the opt-in concept search: Orama's ESM,
# transformers.js, and the onnxruntime WASM files the model runs on. Copies
# from node_modules so no extra network is needed. Runs before astro build.
set -e
mkdir -p public/vendor
rm -rf public/vendor/orama
cp -r node_modules/@orama/orama/dist/browser public/vendor/orama
cp node_modules/@huggingface/transformers/dist/transformers.min.js public/vendor/
cp node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs public/vendor/
cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded*.mjs public/vendor/
cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded*.wasm public/vendor/
echo "vendored: $(du -sh public/vendor | cut -f1) into public/vendor"
