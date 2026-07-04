// Shared render helpers for Kingdom Command.
window.UI = (function () {
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Core asset paths are relative to apps/kingdom/; command lives one level deeper.
  const asset = (p) => (p ? '../' + p : '');

  const fmt = (n) => Number(n || 0).toLocaleString();

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  // Animated 2-frame monster sprite: registers <img data-frames="a|b"> elements,
  // one global interval flips them all.
  function spriteImg(images, cls = '') {
    if (!images || !images.length) return `<span class="empty">no sprite</span>`;
    const frames = images.map(asset).join('|');
    return `<img class="${cls}" src="${esc(asset(images[0]))}" data-frames="${esc(frames)}" alt="" loading="lazy">`;
  }
  let flip = false;
  setInterval(() => {
    flip = !flip;
    document.querySelectorAll('img[data-frames]').forEach((img) => {
      const frames = img.dataset.frames.split('|');
      if (frames.length > 1) img.src = frames[flip ? 1 : 0];
    });
  }, 430);

  function lightbox(src, caption = '') {
    const box = document.getElementById('lightbox');
    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightboxCaption').textContent = caption;
    box.hidden = false;
  }
  document.getElementById('lightbox').addEventListener('click', (e) => (e.currentTarget.hidden = true));

  // Paged generic table for raw dataset browsing.
  function pagedTable(container, rows, { pageSize = 50, columns = null } = {}) {
    let page = 0;
    const cols = columns || (rows.length ? Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object') : []);
    function render() {
      const start = page * pageSize;
      const slice = rows.slice(start, start + pageSize);
      container.innerHTML = `
        <div style="overflow:auto;max-height:calc(100vh - 260px)">
        <table class="tbl">
          <thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>
            ${slice
              .map(
                (r) =>
                  `<tr>${cols
                    .map((c) => {
                      const v = r[c];
                      if (typeof v === 'string' && /\.(gif|png|svg)$/i.test(v) && v.startsWith('data/'))
                        return `<td><img src="${esc(asset(v))}" loading="lazy"></td>`;
                      return `<td>${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</td>`;
                    })
                    .join('')}</tr>`
              )
              .join('')}
          </tbody>
        </table>
        </div>
        <div class="pager">
          <button class="btn small" data-pg="prev" ${page === 0 ? 'disabled' : ''}>← Prev</button>
          <span>${start + 1}–${Math.min(start + pageSize, rows.length)} of ${fmt(rows.length)}</span>
          <button class="btn small" data-pg="next" ${start + pageSize >= rows.length ? 'disabled' : ''}>Next →</button>
        </div>`;
      container.querySelector('[data-pg="prev"]').onclick = () => { page--; render(); };
      container.querySelector('[data-pg="next"]').onclick = () => { page++; render(); };
    }
    render();
  }

  return { esc, asset, fmt, el, spriteImg, lightbox, pagedTable };
})();
