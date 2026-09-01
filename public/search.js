(function () {
 var dialog = document.getElementById('search-dialog');
 if (!dialog) return;
 var input = document.getElementById('search-input');
 var status = document.getElementById('search-status');
 var resultsBox = document.getElementById('search-results');
 var lastFocus = null;
 var pagefindPromise = null;
 var GROUPS = ['Articles', 'Amendments', 'Parts', 'Schedules', 'Pages'];
 var SUGGESTIONS = ['equality', 'fundamental rights', 'freedom of speech', 'women reservation', 'amendment'];
 var debounceTimer = null;
 function focusables() {
   return Array.prototype.filter.call(
     dialog.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])'),
     function (el) {
       return el.offsetParent !== null;
     },
   );
 }
 function open() {
   lastFocus = document.activeElement;
   var menu = document.querySelector('details.mobile-menu');
   if (menu) menu.removeAttribute('open');
   dialog.hidden = false;
   document.documentElement.style.overflow = 'hidden';
   input.focus();
   loadPagefind();
 }
 function close() {
   dialog.hidden = true;
   document.documentElement.style.overflow = '';
   if (lastFocus && lastFocus.focus) lastFocus.focus();
 }
 function loadPagefind() {
   if (pagefindPromise) return pagefindPromise;
   pagefindPromise = import('/pagefind/pagefind.js')
     .then(function (pf) {
       return pf;
     })
     .catch(function () {
       status.textContent = 'Search is available in the production build.';
       return null;
     });
   return pagefindPromise;
 }
 function cleanTitle(title) {
   return String(title || '').replace(/\s*\|\s*Samvidhan\s*$/, '');
 }
 function renderGroups(entries) {
   resultsBox.textContent = '';
   var shown = 0;
   GROUPS.forEach(function (group) {
     var inGroup = entries.filter(function (entry) {
       return entry.type === group;
     });
     if (inGroup.length === 0) return;
     shown += inGroup.length;
     var heading = document.createElement('h3');
     heading.textContent = group;
     resultsBox.appendChild(heading);
     var list = document.createElement('ul');
     inGroup.forEach(function (entry) {
       var item = document.createElement('li');
       var link = document.createElement('a');
       link.href = entry.url;
       link.textContent = cleanTitle(entry.title);
       item.appendChild(link);
       if (entry.excerpt) {
         var excerpt = document.createElement('p');
         excerpt.className = 'search-excerpt';
         excerpt.innerHTML = entry.excerpt;
         item.appendChild(excerpt);
       }
       list.appendChild(item);
     });
     resultsBox.appendChild(list);
   });
   if (shown === 0) {
     renderSuggestions('No results. Try one of these: ');
   }
 }
 function renderSuggestions(prefix) {
   resultsBox.textContent = '';
   var paragraph = document.createElement('p');
   paragraph.textContent = prefix;
   SUGGESTIONS.forEach(function (term, index) {
     if (index > 0) paragraph.appendChild(document.createTextNode(' · '));
     var button = document.createElement('button');
     button.type = 'button';
     button.className = 'search-suggestion';
     button.textContent = term;
     button.addEventListener('click', function () {
       input.value = term;
       runSearch(term);
     });
     paragraph.appendChild(button);
   });
   resultsBox.appendChild(paragraph);
 }
 var STOP_WORDS = 'a an the is are was were be being how what which who when where why of in to for on at by with from and or not it its as do does did can'.split(' ');
 function refineQuery(query) {
   var words = query
     .toLowerCase()
     .split(/\s+/)
     .filter(function (word) {
       return STOP_WORDS.indexOf(word) === -1;
     });
   return words.length === 0 ? query : words.join(' ');
 }
 async function searchOnce(pf, query) {
   var search = await pf.search(query);
   if (search.results.length === 0) {
     var refined = refineQuery(query);
     if (refined !== query) {
       search = await pf.search(refined);
     }
   }
   return search;
 }
 async function runSearch(query) {
   var pf = await loadPagefind();
   if (!pf) return;
   if (!query || query.trim().length === 0) {
     resultsBox.textContent = '';
     status.textContent = '';
     return;
   }
   status.textContent = 'Searching…';
   try {
     var search = await searchOnce(pf, query);
     var top = search.results.slice(0, 12);
     var data = await Promise.all(
       top.map(function (result) {
         return result.data();
       }),
     );
     var entries = data.map(function (item) {
       return {
         url: item.url,
         title: (item.meta && item.meta.title) || item.url,
         excerpt: item.excerpt,
         type: (item.filters && item.filters.type && item.filters.type[0]) || 'Pages',
       };
     });
     status.textContent = search.results.length + (search.results.length === 1 ? ' result' : ' results');
     renderGroups(entries);
   } catch {
     status.textContent = 'Search failed. Please try again.';
   }
 }
 Array.prototype.forEach.call(document.querySelectorAll('[data-search-open]'), function (trigger) {
   trigger.addEventListener('click', open);
 });
 dialog.querySelector('.search-close').addEventListener('click', close);
 dialog.addEventListener('click', function (event) {
   if (event.target === dialog) close();
 });
 dialog.addEventListener('keydown', function (event) {
   if (event.key !== 'Tab') return;
   var list = focusables();
   if (list.length === 0) return;
   var first = list[0];
   var last = list[list.length - 1];
   if (event.shiftKey && document.activeElement === first) {
     event.preventDefault();
     last.focus();
   } else if (!event.shiftKey && document.activeElement === last) {
     event.preventDefault();
     first.focus();
   }
 });
 document.addEventListener('keydown', function (event) {
   var typing = event.target.closest && event.target.closest('input, textarea, select, [contenteditable]');
   if (event.key === '/' && dialog.hidden && !typing) {
     event.preventDefault();
     open();
   }
   if (event.key === 'Escape' && !dialog.hidden) close();
 });
 var conceptLoaded = false;
 var tabKeywords = document.getElementById('tab-keywords');
 var tabConcept = document.getElementById('tab-concept');
 var panelKeywords = document.getElementById('panel-keywords');
 var panelConcept = document.getElementById('panel-concept');
 function selectTab(concept) {
   tabKeywords.setAttribute('aria-selected', concept ? 'false' : 'true');
   tabConcept.setAttribute('aria-selected', concept ? 'true' : 'false');
   panelKeywords.hidden = concept;
   panelConcept.hidden = !concept;
   resultsBox.textContent = '';
   status.textContent = '';
   if (concept && !conceptLoaded) {
     conceptLoaded = true;
     import('/concept.js')
       .then(function (module) {
         module.initConcept(input);
       })
       .catch(function () {
         status.textContent = 'Concept search is unavailable. Keyword search still works.';
         tabKeywords.click();
       });
   }
 }
 tabKeywords.addEventListener('click', function () {
   selectTab(false);
 });
 tabConcept.addEventListener('click', function () {
   selectTab(true);
 });
 input.addEventListener('input', function () {
   if (tabConcept.getAttribute('aria-selected') === 'true') return;
   clearTimeout(debounceTimer);
   debounceTimer = setTimeout(function () {
     runSearch(input.value);
   }, 200);
 });
})();
