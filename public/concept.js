const STATUS_EL = document.getElementById('concept-status');
const RESULTS_EL = document.getElementById('concept-results');
let orama = null;
let db = null;
let worker = null;
let inputEl = null;
let debounceTimer = null;
let currentVector = null;
function setStatus(text) {
  if (STATUS_EL) STATUS_EL.textContent = text;
}
function fallbackToKeyword(reason) {
  const keywordTab = document.getElementById('tab-keywords');
  if (keywordTab) keywordTab.click();
  const visibleStatus = document.getElementById('search-status');
  if (visibleStatus) visibleStatus.textContent = reason + ' Showing keyword results instead.';
  setStatus(reason + ' Showing keyword results instead.');
}
async function loadIndex() {
  setStatus('Loading the concept index…');
  const response = await fetch('/vectors/chunks.json');
  const artifact = await response.json();
  const { create, insertMultiple } = await import('/vendor/orama/index.js');
  orama = { create, insertMultiple, search: (await import('/vendor/orama/index.js')).search };
  db = await create({
    schema: { n: 'string', t: 'string', e: `vector[${artifact.dims}]` },
  });
  const docs = artifact.chunks.map((chunk) => ({
    n: chunk.n,
    t: chunk.t,
    e: Array.from(chunk.v, (value) => (value / 127) * artifact.scale),
  }));
  await insertMultiple(db, docs);
  setStatus(`Concept index ready (${docs.length} passages).`);
}
function ensureWorker() {
  if (worker === null) {
    worker = new Worker('/embed-worker.js', { type: 'module' });
    worker.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'progress') {
        const megabytes =
          (data.loaded / 1024 / 1024).toFixed(1) + ' of ' + (data.total / 1024 / 1024).toFixed(1) + ' MB';
        setStatus(`Loading the language model: ${megabytes}…`);
      } else if (data.type === 'vector') {
        currentVector = data.vector;
        runSearch(inputEl ? inputEl.value : '');
      } else if (data.type === 'error') {
        fallbackToKeyword('The language model could not load.');
      }
    };
    worker.onerror = () => fallbackToKeyword('The language model could not load.');
  }
  return worker;
}
function renderResults(hits) {
  if (RESULTS_EL) RESULTS_EL.textContent = '';
  const seen = new Set();
  const list = document.createElement('ul');
  for (const hit of hits) {
    const number = hit.document.n;
    if (seen.has(number)) continue;
    seen.add(number);
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = '/articles/' + number.toLowerCase() + '/';
    link.textContent = 'Article ' + number;
    item.appendChild(link);
    const snippet = document.createElement('p');
    snippet.className = 'search-excerpt';
    snippet.textContent = hit.document.t.slice(0, 160) + '…';
    item.appendChild(snippet);
    list.appendChild(item);
  }
  if (RESULTS_EL) RESULTS_EL.appendChild(list);
  if (seen.size === 0 && RESULTS_EL) {
    const none = document.createElement('p');
    none.textContent = 'No concept matches. Try the keyword tab for exact terms.';
    RESULTS_EL.appendChild(none);
  }
}
async function runSearch(query) {
  if (!query || query.trim().length === 0 || currentVector === null || db === null) return;
  setStatus('Searching by meaning…');
  try {
    const results = await orama.search(db, {
      mode: 'hybrid',
      term: query,
      vector: { value: currentVector, property: 'e' },
      similarity: 0.4,
      limit: 24,
    });
    setStatus(results.hits.length + (results.hits.length === 1 ? ' passage' : ' passages') + ' matched by meaning');
    renderResults(results.hits);
  } catch {
    fallbackToKeyword('Concept search hit an error.');
  }
}
export function initConcept(input) {
  inputEl = input;
  const connection = navigator.connection || {};
  if (connection.saveData) {
    fallbackToKeyword('Concept search is off because data saver is on.');
    return;
  }
  loadIndex().catch(() => {
    fallbackToKeyword('The concept index could not load.');
    return;
  });
  ensureWorker();
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = input.value;
      ensureWorker().postMessage({ type: 'embed', query });
      setStatus('Embedding your question…');
    }, 400);
  });
  if (input.value && input.value.trim().length > 0) {
    ensureWorker().postMessage({ type: 'embed', query: input.value });
    setStatus('Embedding your question…');
  }
}
