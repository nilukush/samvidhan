import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { pipeline } from '@huggingface/transformers';
import { chunkArticle, type ChunkInput } from '../../src/lib/chunk.ts';

const CONSTITUTION_PATH = 'data/processed/constitution.json';
const EXPLAINERS_PATH = 'data/processed/explainers/explainers.json';
const OUTPUT_PATH = 'public/vectors/chunks.json';
const MODEL = 'Xenova/all-MiniLM-L6-v2';
const DIMS = 384;
const ARTIFACT_BUDGET = 3 * 1024 * 1024;

interface VectorArtifact {
  model: string;
  dims: number;
  /** Global int8 scale: float = int8 / 127 * scale. */
  scale: number;
  chunks: Array<{ n: string; t: string; v: number[] }>;
}

async function main(): Promise<void> {
  const constitution = JSON.parse(readFileSync(CONSTITUTION_PATH, 'utf8')) as {
    articles: Array<{ number: string; title: string; clauses: Array<{ text: string }>; explainer?: string }>;
  };
  const explainers = JSON.parse(readFileSync(EXPLAINERS_PATH, 'utf8')) as Record<string, string>;

  const inputs: ChunkInput[] = constitution.articles.map((article) => ({
    number: article.number,
    title: article.title,
    clauses: article.clauses,
    explainer: explainers[article.number],
  }));

  const chunks = inputs.flatMap((input) => chunkArticle(input));
  console.log(`embedding ${chunks.length} chunks from ${inputs.length} articles`);

  const extractor = await pipeline('feature-extraction', MODEL, { quantized: true, dtype: 'q8' });

  let maxAbs = 0;
  const floatVectors: Array<{ n: string; t: string; v: Float32Array }> = [];
  const started = Date.now();
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i] as { articleNumber: string; text: string };
    const output = await extractor(chunk.text, { pooling: 'mean', normalize: true });
    const vector = new Float32Array(DIMS);
    for (let d = 0; d < DIMS; d++) {
      const value = (output.data as Float32Array)[d] as number;
      vector[d] = value;
      const abs = Math.abs(value);
      if (abs > maxAbs) maxAbs = abs;
    }
    floatVectors.push({ n: chunk.articleNumber, t: chunk.text, v: vector });
    if ((i + 1) % 100 === 0)
      console.log(`  ${i + 1}/${chunks.length} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
  }

  const scale = maxAbs / 127;
  // Chunk text stays in the artifact: the hybrid search runs its keyword half
  // over this text inside Orama.
  const artifact: VectorArtifact = {
    model: MODEL,
    dims: DIMS,
    scale,
    chunks: floatVectors.map(({ n, t, v }) => ({
      n,
      t,
      v: Array.from(v, (value) => Math.round((value / maxAbs) * 127)),
    })),
  };

  mkdirSync('public/vectors', { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(artifact));
  const size = statSync(OUTPUT_PATH).size;
  console.log(`wrote ${OUTPUT_PATH}: ${size} bytes (${(size / 1024 / 1024).toFixed(2)} MB)`);
  if (size > ARTIFACT_BUDGET) {
    throw new Error(`vector artifact exceeds the 3 MB budget`);
  }
}

await main();
