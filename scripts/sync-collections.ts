import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ArticleSchema, PartSchema, ScheduleSchema } from '../src/lib/schemas/index.ts';

export interface SyncResult {
  articles: number;
  parts: number;
  schedules: number;
  /** Articles without an explainer when an explainers file is in use. */
  unexplained: string[];
}

interface ConstitutionShape {
  parts?: Array<Record<string, unknown>>;
  articles?: Array<Record<string, unknown>>;
  schedules?: Array<Record<string, unknown>>;
}

const COLLECTIONS = [
  {
    name: 'articles',
    schema: ArticleSchema,
    idOf: (entry: Record<string, unknown>) => String(entry['number'] ?? ''),
  },
  {
    name: 'parts',
    schema: PartSchema,
    idOf: (entry: Record<string, unknown>) => String(entry['number'] ?? ''),
  },
  {
    name: 'schedules',
    schema: ScheduleSchema,
    idOf: (entry: Record<string, unknown>) => String(entry['number'] ?? ''),
  },
] as const;

/**
 * Copies validated data from data/processed/constitution.json into the Astro
 * content collection directories. No silent skips: every schema violation or
 * dangling reference aborts the sync naming the entry and the field.
 *
 * The output directories are regenerated from scratch on every run, so the
 * result is idempotent and stale files from older editions cannot linger.
 */
export function syncCollections(inputPath: string, outDir: string, options?: { explainersPath?: string }): SyncResult {
  const data = JSON.parse(readFileSync(inputPath, 'utf8')) as ConstitutionShape;
  const errors: string[] = [];
  const result: SyncResult = { articles: 0, parts: 0, schedules: 0, unexplained: [] };
  const explainers =
    options?.explainersPath && existsSync(options.explainersPath)
      ? (JSON.parse(readFileSync(options.explainersPath, 'utf8')) as Record<string, string>)
      : undefined;

  const partIds = new Set<string>(
    (data.parts ?? []).map((part) => String(part['number'] ?? '')).filter((id) => id !== ''),
  );

  for (const collection of COLLECTIONS) {
    const entries = (data[collection.name] ?? []) as Array<Record<string, unknown>>;
    const collectionDir = join(outDir, collection.name);
    rmSync(collectionDir, { recursive: true, force: true });
    mkdirSync(collectionDir, { recursive: true });

    const written = new Set<string>();
    for (let entry of entries) {
      const id = collection.idOf(entry);
      if (id === '') {
        errors.push(`${collection.name}: entry without a number: ${JSON.stringify(entry).slice(0, 80)}`);
        continue;
      }
      if (written.has(id)) {
        errors.push(`${collection.name}/${id}: duplicate entry`);
        continue;
      }
      if (collection.name === 'articles' && explainers) {
        const explainer = explainers[id];
        if (typeof explainer === 'string' && explainer.trim() !== '') {
          entry = { ...entry, explainer };
        }
      }
      const parsed = collection.schema.safeParse(entry);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push(`${collection.name}/${id}: ${issue.path.join('.')}: ${issue.message}`);
        }
        continue;
      }
      if (collection.name === 'articles') {
        const part = parsed.data['part'] as string;
        if (!partIds.has(part)) {
          errors.push(`articles/${id}: references unknown part ${part}`);
          continue;
        }
      }
      written.add(id);
      if (collection.name === 'articles' && explainers && parsed.data['explainer'] === undefined) {
        result.unexplained.push(id);
      }
      writeFileSync(join(collectionDir, `${id}.json`), `${JSON.stringify(parsed.data, null, 2)}\n`);
      result[collection.name] += 1;
    }
  }

  if (errors.length > 0) {
    throw new Error(`data:sync failed with ${errors.length} problem(s):\n${errors.join('\n')}`);
  }
  return result;
}

function isDirectRun(): boolean {
  const argv1 = process.argv[1] ?? '';
  return argv1.includes('sync-collections');
}

if (isDirectRun()) {
  const inputPath = 'data/processed/constitution.json';
  const outDir = 'src/content';
  const result = syncCollections(inputPath, outDir, { explainersPath: 'data/processed/explainers/explainers.json' });
  console.log(
    `synced ${result.articles} articles, ${result.parts} parts, ${result.schedules} schedules from ${inputPath} into ${outDir}`,
  );
  if (result.unexplained.length > 0) {
    console.warn(
      `WARNING: ${result.unexplained.length} articles have no explainer yet (batches pending). First 20: ${result.unexplained.slice(0, 20).join(', ')}`,
    );
  }
  const files = readdirSync(join(outDir, 'articles')).length;
  console.log(`article files on disk: ${files}`);
}
