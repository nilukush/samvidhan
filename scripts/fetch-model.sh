#!/bin/sh
# Fetches the self-hosted quantized MiniLM model for the browser worker.
# CI runs this before build; locally it is only needed once.
set -e
mkdir -p public/models/minilm/onnx
cd public/models/minilm
for f in config.json tokenizer.json tokenizer_config.json; do
  [ -s "$f" ] || curl -sL "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/$f" -o "$f"
done
[ -s onnx/model_quantized.onnx ] || curl -sL "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx" -o onnx/model_quantized.onnx
echo "model present: $(du -sh onnx/model_quantized.onnx | cut -f1)"
