(() => {
'use strict';
const KEEP = 48, BATCH = 8, MARGIN = 1400;
const $ = id => document.getElementById(id);
const stream = $('stream'), top = $('top'), bottom = $('bottom'), q = $('q'), msg = $('msg');
const prevBtn = $('prev'), nextBtn = $('next'), bar = document.querySelector('.bar');
const ONE = 1n;
let current = ONE, busy = false;

// ---- deterministic generation: everything derives from the exact decimal string ----
function hash(s, seed) {
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
const NS = 'http://www.w3.org/2000/svg';
function avatar(h1, h2, hue) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 5 5'); svg.setAttribute('class', 'art'); svg.setAttribute('aria-hidden', 'true');
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('width', 5); bg.setAttribute('height', 5); bg.setAttribute('fill', `hsl(${hue} 40% 14%)`);
  svg.appendChild(bg);
  let bits = h1 ^ (h2 << 1);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) {
    if ((bits >>> (y * 3 + x)) & 1) {
      for (const px of x === 2 ? [2] : [x, 4 - x]) {
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', px); r.setAttribute('y', y); r.setAttribute('width', 1); r.setAttribute('height', 1);
        r.setAttribute('fill', `hsl(${hue + (y * 18)} 75% 66%)`); svg.appendChild(r);
      }
    }
  }
  return svg;
}
const TIERS = ['Aurora','Obsidian','Meridian','Solstice','Vesper','Halcyon','Zenith','Nocturne'];
function build(n) {
  const s = n.toString(), h1 = hash(s, 1), h2 = hash(s, 2), h3 = hash(s, 3);
  const hue = h1 % 360, li = document.createElement('li');
  li.className = 'card'; li.dataset.n = s;
  li.style.setProperty('--h', hue);
  const ang = h2 % 360, x = h3 % 100, y = (h3 >>> 8) % 100;
  li.style.setProperty('--bg', `radial-gradient(circle at ${x}% ${y}%,hsl(${hue} 60% 30% / .45),transparent 55%),conic-gradient(from ${ang}deg at 50% 120%,hsl(${hue + 60} 60% 25% / .35),transparent 40%)`);
  li.appendChild(avatar(h1, h2, hue));
  const h = document.createElement('h2'); h.className = 'name'; h.setAttribute('aria-label', 'Profilith ' + s);
  const l = document.createElement('span'); l.className = 'lbl'; l.textContent = 'Profilith';
  const num = document.createElement('span'); num.className = 'num'; num.textContent = s;
  h.append(l, num); li.appendChild(h);
  const dl = document.createElement('dl'); dl.className = 'meta';
  const rows = [['Identity', 'Unique digital identity'], ['Signature', h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')],
    ['Collection', TIERS[h3 % 8] + ' ' + (h2 % 90 + 10)], ['Digits', String(s.length)]];
  for (const [k, v] of rows) { const d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; d.append(dt, dd); dl.appendChild(d); }
  li.appendChild(dl);
  return li;
}
// Fit the complete number inside the card: size by width, wrap if more digits than one line holds.
function fit(li) {
  const num = li.querySelector('.num'), w = li.clientWidth - parseFloat(getComputedStyle(li).paddingLeft) * 2;
  if (w <= 0) return;
  const d = num.textContent.length, perLine = Math.min(d, 16);
  num.style.fontSize = Math.max(14, Math.min(64, w / (perLine * 0.62))) + 'px';
}
const fitAll = () => { for (const li of stream.children) fit(li); };

const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }, { rootMargin: '0px 0px -5% 0px' });
const add = li => { io.observe(li); };

// ---- virtual window: only DOM is bounded; BigInt positions are exact ----
const first = () => BigInt(stream.firstElementChild.dataset.n);
const last = () => BigInt(stream.lastElementChild.dataset.n);
function appendBatch() {
  let n = last();
  for (let i = 0; i < BATCH; i++) { n += ONE; const li = build(n); stream.appendChild(li); fit(li); add(li); }
  let drop = 0;
  const startTop = stream.firstElementChild.offsetTop;
  while (stream.children.length > KEEP) { io.unobserve(stream.firstElementChild); stream.firstElementChild.remove(); drop = 1; }
  if (drop) window.scrollBy(0, stream.firstElementChild.offsetTop - startTop);
}
function prependBatch() {
  let n = first(); if (n <= ONE) return false;
  const anchor = stream.firstElementChild, y0 = anchor.getBoundingClientRect().top;
  for (let i = 0; i < BATCH && n > ONE; i++) { n -= ONE; const li = build(n); stream.insertBefore(li, stream.firstElementChild); fit(li); add(li); }
  window.scrollBy(0, anchor.getBoundingClientRect().top - y0);
  while (stream.children.length > KEEP) { io.unobserve(stream.lastElementChild); stream.lastElementChild.remove(); }
  return true;
}
function fill() {
  if (busy) return; busy = true;
  let guard = 0;
  while (guard++ < 40) {
    if (bottom.getBoundingClientRect().top < innerHeight + MARGIN) { appendBatch(); continue; }
    if (first() > ONE && top.getBoundingClientRect().bottom > -MARGIN) { prependBatch(); continue; }
    break;
  }
  busy = false;
}
const sio = new IntersectionObserver(fill, { rootMargin: MARGIN + 'px 0px' });
sio.observe(top); sio.observe(bottom);

// ---- navigation ----
const parse = str => { const t = str.trim(); if (!/^\d+$/.test(t)) return null; return BigInt(t); };
function setMsg(t, err) { msg.textContent = t; msg.classList.toggle('err', !!err); }
function jump(n, smooth) {
  const el = stream.querySelector('[data-n="' + n + '"]');
  if (el) { el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }); return; }
  busy = true;
  for (const c of stream.children) io.unobserve(c);
  stream.textContent = '';
  const start = n > 6n ? n - 6n : ONE;
  for (let k = start; k <= n + 8n; k++) { const li = build(k); stream.appendChild(li); fit(li); add(li); }
  busy = false;
  stream.querySelector('[data-n="' + n + '"]').scrollIntoView({ block: 'start' });
  fill();
}
function setCurrent(n, replace) {
  current = n; const s = n.toString();
  prevBtn.disabled = n <= ONE;
  const hash = '#/profile/' + s;
  if (location.hash !== hash) history[replace ? 'replaceState' : 'pushState'](null, '', hash);
}
let ticking = false;
function track() {
  const line = bar.offsetHeight + 24; let found = null;
  for (const li of stream.children) { if (li.getBoundingClientRect().bottom > line) { found = li; break; } }
  if (!found) return;
  for (const c of stream.querySelectorAll('.current')) c.classList.remove('current');
  found.classList.add('current');
  const n = BigInt(found.dataset.n); if (n !== current) setCurrent(n, true);
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; track(); }); } }, { passive: true });

function go(n, push) { setMsg(''); jump(n, false); setCurrent(n, !push); requestAnimationFrame(track); }
$('search').addEventListener('submit', e => {
  e.preventDefault();
  const raw = q.value.trim();
  if (!raw) return setMsg('Enter a profile number, for example 8775687788.', true);
  const n = parse(raw);
  if (n === null) return setMsg('Use digits only. Profile numbers are whole numbers like 25 or 8775687788.', true);
  if (n < ONE) return setMsg('Profile numbers start at 1.', true);
  go(n, true); q.blur();
});
prevBtn.addEventListener('click', () => { if (current > ONE) { const n = current - ONE; jump(n, true); setCurrent(n, true); } });
nextBtn.addEventListener('click', () => { const n = current + ONE; jump(n, true); setCurrent(n, true); });
$('rand').addEventListener('click', () => {
  const digits = 1 + (crypto.getRandomValues(new Uint8Array(1))[0] % 40);
  const b = crypto.getRandomValues(new Uint8Array(digits)); let s = '';
  for (let i = 0; i < digits; i++) s += i === 0 ? String(1 + b[i] % 9) : String(b[i] % 10);
  go(BigInt(s), true);
});
function fromUrl() {
  const m = (location.hash + ' ' + location.pathname).match(/profile\/(\d+)/);
  const n = m ? BigInt(m[1]) : ONE;
  return n < ONE ? ONE : n;
}
addEventListener('popstate', () => { const n = fromUrl(); jump(n, false); current = n; prevBtn.disabled = n <= ONE; });
addEventListener('hashchange', () => { const n = fromUrl(); if (n !== current) { jump(n, false); current = n; prevBtn.disabled = n <= ONE; } });
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(fitAll, 80); });
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const start = fromUrl(); jump(start, false); setCurrent(start, true);
})();
