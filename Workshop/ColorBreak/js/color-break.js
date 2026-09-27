/* ==========================================================================
   COLOR BREAK — CORE LOGIC
   Region-based (paint-bucket) coloring book. No freehand brush, no timer,
   no score, no lives — the player picks a color, taps an enclosed region,
   and the whole region fills. Vanilla JS, canvas-based flood fill.

   Architecture:
     - DRAWINGS: the 6 official illustrations (source-of-truth PNGs).
     - PALETTE: ~8 preset colors + a custom "+" swatch.
     - originalImageData{}: pristine pixel data per drawing, loaded once
       and never mutated — used both as the reset target and as the
       "restore" source for the eraser.
     - drawingState{}: the CURRENT in-memory ImageData per drawing, kept
       alive for the whole Color Break session so switching drawings and
       coming back preserves every fill (per spec section 23/24).
   ========================================================================== */

window.ColorBreak = (function () {

  const DRAWINGS = [
    { key: 'draw1', src: '../Images/draw1.png' },
    { key: 'draw2', src: '../Images/draw2.png' },
    { key: 'draw3', src: '../Images/draw3.png' },
    { key: 'draw4', src: '../Images/draw4.png' },
    { key: 'draw5', src: '../Images/draw5.png' },
    { key: 'draw6', src: '../Images/draw6.png' }
  ];

  // Bites of Control inspired palette — bright but pleasant.
  const PALETTE = [
    { name: 'pink',      hex: '#ff4fa3' },
    { name: 'orange',    hex: '#ff8a2b' },
    { name: 'yellow',    hex: '#ffd23f' },
    { name: 'turquoise', hex: '#3fbfa8' },
    { name: 'green',     hex: '#4fd18b' },
    { name: 'purple',    hex: '#a05fff' },
    { name: 'coral',     hex: '#ff6b4f' },
    { name: 'blue',      hex: '#4f9dff' }
  ];

  // Any pixel whose luminance falls below this is treated as line-art /
  // outside-the-drawing "wall" that a fill can never cross. This covers
  // true black outline pixels AND the fully-transparent margin around
  // each PNG (which decodes to (0,0,0,0) — same wall effect, no special
  // casing needed for the transparent border).
  const BARRIER_LUMINANCE = 170;

  // Per-channel tolerance for "same region" matching, generous enough to
  // absorb the light JPEG/PNG anti-aliasing noise inside a flat white or
  // already-colored region without being loose enough to jump the line.
  const COLOR_TOLERANCE = 40;

  const els = {};
  const originalImageData = {};   // key -> { width, height, data: Uint8ClampedArray }
  const drawingState = {};        // key -> ImageData (current, mutable)
  const loadingPromises = {};     // key -> Promise, avoids double-loading
  const outlineMask = {};         // key -> Uint8Array(w*h), 1 = line-art/transparent margin (never fillable)

  let currentKey = null;
  let currentTool = 'brush';      // 'brush' | 'eraser'
  let currentColor = PALETTE[0].hex;
  let selectedSwatchEl = null;
  let customSwatchEl = null;
  let eraserButtonEl = null;
  let brushButtonEl = null;

  /* ------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------ */

  function init() {
    els.canvas = document.getElementById('cb-canvas');
    els.ctx = els.canvas.getContext('2d', { willReadFrequently: true });
    els.canvasFrame = document.querySelector('.cb-canvas-frame');
    els.grid = document.getElementById('cb-drawing-grid');
    els.palette = document.getElementById('cb-palette');
    els.customInput = document.getElementById('cb-custom-color-input');
    els.modalReset = document.getElementById('cb-modal-reset');
    els.modalCompletion = document.getElementById('cb-modal-completion');
    eraserButtonEl = document.getElementById('cb-eraser-button');
    brushButtonEl = document.getElementById('cb-brush-button');

    buildDrawingGrid();
    buildPalette();

    // Region fill only — Pointer Events unify mouse + touch, and this is
    // a single tap/click per fill, never a drag/stroke.
    els.canvas.style.cursor = 'crosshair';
    els.canvas.addEventListener('pointerdown', handleCanvasPointer);

    els.customInput.addEventListener('input', function () {
      selectColor(els.customInput.value, customSwatchEl);
    });
  }

  function showScreen(id) {
    document.querySelectorAll('.cb-screen').forEach(function (s) {
      s.classList.remove('cb-active');
    });
    document.getElementById(id).classList.add('cb-active');
  }

  /* ------------------------------------------------------------------
     SCREEN NAVIGATION
     ------------------------------------------------------------------ */

  function showIntro() {
    showScreen('cb-screen-intro');
  }

  function showDrawingSelection() {
    showScreen('cb-screen-selection');
  }

  function exitToWorkshopMenu() {
    window.location.href = '../menu.html';
  }

  function closeCanvasToSelection() {
    // State is saved continuously as the player colors (see paintPixels()),
    // so simply switching screens already preserves everything.
    showDrawingSelection();
  }

  function openDrawing(key) {
    console.log('Selected drawing:', key);
    currentKey = key;
    resetToolToDefault();
    showScreen('cb-screen-coloring');
    hideCanvasError();
    loadDrawing(key).then(function () {
      renderCurrentState();
    }).catch(function (err) {
      console.error('Could not prepare drawing for coloring:', key, err);
      showCanvasError();
    });
  }

  /* ------------------------------------------------------------------
     DRAWING SELECTION GRID
     ------------------------------------------------------------------ */

  function buildDrawingGrid() {
    DRAWINGS.forEach(function (d) {
      const card = document.createElement('div');
      card.className = 'cb-drawing-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'Colorear ' + d.key);

      const img = document.createElement('img');
      img.src = d.src;
      img.alt = '';
      img.draggable = false;

      card.appendChild(img);

      card.addEventListener('click', function () { openDrawing(d.key); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') openDrawing(d.key);
      });

      els.grid.appendChild(card);
    });
  }

  /* ------------------------------------------------------------------
     PALETTE
     ------------------------------------------------------------------ */

  function buildPalette() {
    PALETTE.forEach(function (c, i) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'cb-swatch';
      swatch.style.background = c.hex;
      swatch.setAttribute('aria-label', c.name);
      swatch.addEventListener('click', function () { selectColor(c.hex, swatch); });
      els.palette.insertBefore(swatch, els.customInput);
      if (i === 0) {
        selectedSwatchEl = swatch;
        swatch.classList.add('cb-swatch-selected');
      }
    });

    // Custom "+" swatch — opens the native color input.
    customSwatchEl = document.createElement('button');
    customSwatchEl.type = 'button';
    customSwatchEl.className = 'cb-swatch cb-swatch-custom';
    customSwatchEl.setAttribute('aria-label', 'Color personalizado');
    customSwatchEl.innerHTML = '<span>+</span>';
    customSwatchEl.addEventListener('click', function () {
      els.customInput.click();
    });
    els.palette.insertBefore(customSwatchEl, els.customInput);
  }

  /* Two mutually exclusive tools: 'brush' (fill an enclosed region with
     currentColor) and 'eraser' (restore an enclosed region to its
     original uncolored pixels). Picking a color always switches back to
     brush — per spec, that's what makes "erase, then pick pink, then tap"
     work as one fluid motion instead of needing a separate brush click. */

  function setToolButtonsState() {
    if (brushButtonEl) brushButtonEl.classList.toggle('cb-tool-selected', currentTool === 'brush');
    if (eraserButtonEl) eraserButtonEl.classList.toggle('cb-tool-selected', currentTool === 'eraser');
  }

  function selectColor(hex, swatchEl) {
    currentTool = 'brush';
    currentColor = hex;

    if (selectedSwatchEl) selectedSwatchEl.classList.remove('cb-swatch-selected');
    selectedSwatchEl = swatchEl || null;
    if (selectedSwatchEl) selectedSwatchEl.classList.add('cb-swatch-selected');

    setToolButtonsState();
  }

  function selectBrush() {
    currentTool = 'brush';
    setToolButtonsState();
  }

  function selectEraser() {
    currentTool = 'eraser';
    setToolButtonsState();
  }

  function resetToolToDefault() {
    currentTool = 'brush';
    currentColor = PALETTE[0].hex;

    if (selectedSwatchEl) selectedSwatchEl.classList.remove('cb-swatch-selected');
    // Re-select the first swatch element visually (it exists after buildPalette()).
    const first = els.palette.querySelector('.cb-swatch');
    selectedSwatchEl = first || null;
    if (selectedSwatchEl) selectedSwatchEl.classList.add('cb-swatch-selected');

    setToolButtonsState();
  }

  /* ------------------------------------------------------------------
     LOADING A DRAWING INTO THE CANVAS
     ------------------------------------------------------------------ */

  function loadDrawing(key) {
    // A prior FAILED attempt must not be cached as if it succeeded —
    // only cache (and reuse) a promise once we know it actually resolved.
    if (loadingPromises[key]) return loadingPromises[key];

    const meta = DRAWINGS.find(function (d) { return d.key === key; });

    const promise = new Promise(function (resolve, reject) {
      if (originalImageData[key]) {
        resolve();
        return;
      }

      // Reuse the EXACT same path already proven to work for this
      // drawing's thumbnail on the selection screen — no second path
      // system.
      console.log('Loading image:', meta.src);
      const img = new Image();

      img.onload = function () {
        console.log('Drawing loaded:', img.naturalWidth, img.naturalHeight);

        const off = document.createElement('canvas');
        off.width = img.naturalWidth;
        off.height = img.naturalHeight;
        const offCtx = off.getContext('2d');
        offCtx.drawImage(img, 0, 0);

        let imageData;
        try {
          // This is the one call that can fail even though the image
          // loaded and drew correctly: if this page was opened directly
          // from disk (a file:// URL — e.g. double-clicking index.html
          // instead of serving the project over http://), Chrome treats
          // the canvas as tainted by "cross-origin" data and refuses to
          // read pixels back out of it. It's a browser security
          // restriction on the file:// protocol, not a bug in the fill
          // logic — see showCanvasError() below for what the player sees
          // when this happens.
          imageData = offCtx.getImageData(0, 0, off.width, off.height);
        } catch (err) {
          reject(err);
          return;
        }

        originalImageData[key] = {
          width: off.width,
          height: off.height,
          data: new Uint8ClampedArray(imageData.data) // immutable snapshot
        };

        // Precomputed ONCE from the pristine artwork — line art (and the
        // fully-transparent margin around the illustration) never moves,
        // so this is the single source of truth for "can a fill ever
        // cross this pixel", regardless of what color later gets painted
        // there. (Using the CURRENT pixel's own color for this check was
        // an earlier bug: a sufficiently dark preset color, once
        // painted, would misclassify its own region as an outline and
        // could never be re-filled or erased again.)
        outlineMask[key] = buildOutlineMask(imageData.data, off.width, off.height);

        // First time this drawing is opened: its live state starts as an
        // exact copy of the original (nothing colored yet).
        if (!drawingState[key]) {
          drawingState[key] = new ImageData(
            new Uint8ClampedArray(imageData.data),
            off.width,
            off.height
          );
        }

        resolve();
      };

      img.onerror = function (event) {
        console.error('Could not load drawing:', meta.src, event);
        reject(new Error('Image failed to load: ' + meta.src));
      };

      img.src = meta.src;
    });

    // Only cache the promise on the success path — a rejected attempt is
    // NOT remembered, so re-opening the same drawing (e.g. after fixing
    // how the page is served) retries the load instead of replaying the
    // same failure forever.
    promise.then(function () { loadingPromises[key] = promise; });
    loadingPromises[key] = promise;
    promise.catch(function () { delete loadingPromises[key]; });

    return promise;
  }

  function renderCurrentState() {
    const orig = originalImageData[currentKey];
    const state = drawingState[currentKey];

    els.canvas.width = orig.width;
    els.canvas.height = orig.height;

    // The image is drawn into the canvas at its own native resolution
    // (no cropping, no distortion) — the CSS in color-break.css then
    // scales the element itself down to fit .cb-canvas-frame with
    // max-width/max-height: 100% while preserving aspect ratio, so this
    // single putImageData is also what keeps the line art sharp.
    els.ctx.putImageData(state, 0, 0);
  }

  function hideCanvasError() {
    els.canvas.style.display = '';
    if (els.canvasErrorEl) els.canvasErrorEl.remove();
    els.canvasErrorEl = null;
  }

  function showCanvasError() {
    els.canvas.style.display = 'none';
    if (!els.canvasErrorEl) {
      els.canvasErrorEl = document.createElement('div');
      els.canvasErrorEl.className = 'cb-canvas-error';
      els.canvasErrorEl.innerHTML =
        '<p><strong>No se pudo cargar el dibujo.</strong></p>' +
        '<p>Si estás abriendo el archivo directamente (doble clic), el navegador ' +
        'bloquea la lectura de la imagen por seguridad. Abre el proyecto con un ' +
        'servidor local (por ejemplo <code>python3 -m http.server</code>) y vuelve a intentarlo.</p>';
      els.canvasFrame.appendChild(els.canvasErrorEl);
    }
  }

  /* ------------------------------------------------------------------
     POINTER → CANVAS COORDINATES
     ------------------------------------------------------------------ */

  function handleCanvasPointer(evt) {
    evt.preventDefault();

    const rect = els.canvas.getBoundingClientRect();
    const scaleX = els.canvas.width / rect.width;
    const scaleY = els.canvas.height / rect.height;

    const x = Math.floor((evt.clientX - rect.left) * scaleX);
    const y = Math.floor((evt.clientY - rect.top) * scaleY);

    if (x < 0 || y < 0 || x >= els.canvas.width || y >= els.canvas.height) return;

    floodFillAt(x, y);
  }

  /* ------------------------------------------------------------------
     FLOOD FILL (paint-bucket) / ERASE
     Scanline span-fill: fast even on ~1.3MP artwork, and stays inside
     the enclosed region because BARRIER_LUMINANCE stops it dead at any
     dark/black outline pixel (and at the drawing's transparent margin).
     ------------------------------------------------------------------ */

  function luminance(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // Built ONCE per drawing straight from the pristine PNG data — see the
  // comment at its call site in loadDrawing() for why this must never be
  // recomputed from the (possibly already-colored) live canvas.
  function buildOutlineMask(data, w, h) {
    const mask = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
      const a = data[p + 3];
      if (a < 10) { mask[i] = 1; continue; } // transparent margin outside the artwork
      if (luminance(data[p], data[p + 1], data[p + 2]) < BARRIER_LUMINANCE) mask[i] = 1;
    }
    return mask;
  }

  function floodFillAt(x0, y0) {
    const state = drawingState[currentKey];
    const orig = originalImageData[currentKey];
    const mask = outlineMask[currentKey];
    const w = state.width;
    const h = state.height;
    const data = state.data;
    const origData = orig.data;

    const startPixel = y0 * w + x0;
    if (mask[startPixel]) return; // clicked a line, or outside the artwork

    const startIdx = startPixel * 4;
    const r0 = data[startIdx];
    const g0 = data[startIdx + 1];
    const b0 = data[startIdx + 2];

    const erasing = (currentTool === 'eraser');
    let fillR = 0, fillG = 0, fillB = 0;
    if (!erasing) {
      const rgb = hexToRgb(currentColor);
      fillR = rgb.r; fillG = rgb.g; fillB = rgb.b;
    }

    const matches = function (x, y) {
      const p = y * w + x;
      if (mask[p]) return false;
      const idx = p * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      return Math.abs(r - r0) <= COLOR_TOLERANCE &&
             Math.abs(g - g0) <= COLOR_TOLERANCE &&
             Math.abs(b - b0) <= COLOR_TOLERANCE;
    };

    const paint = function (x, y) {
      const idx = (y * w + x) * 4;
      if (erasing) {
        data[idx]     = origData[idx];
        data[idx + 1] = origData[idx + 1];
        data[idx + 2] = origData[idx + 2];
        data[idx + 3] = origData[idx + 3];
      } else {
        data[idx]     = fillR;
        data[idx + 1] = fillG;
        data[idx + 2] = fillB;
        data[idx + 3] = origData[idx + 3]; // preserve the artwork's own alpha/AA
      }
    };

    const visited = new Uint8Array(w * h);
    const stack = [[x0, y0]];

    while (stack.length) {
      const [x, y] = stack.pop();
      const rowIdx = y * w;

      if (visited[rowIdx + x] || !matches(x, y)) continue;

      // Expand left/right to the full contiguous span on this row.
      let xl = x;
      while (xl > 0 && !visited[rowIdx + xl - 1] && matches(xl - 1, y)) xl--;
      let xr = x;
      while (xr < w - 1 && !visited[rowIdx + xr + 1] && matches(xr + 1, y)) xr++;

      for (let i = xl; i <= xr; i++) {
        const idx = rowIdx + i;
        if (visited[idx]) continue;
        visited[idx] = 1;
        paint(i, y);

        if (y > 0 && !visited[idx - w] && matches(i, y - 1)) stack.push([i, y - 1]);
        if (y < h - 1 && !visited[idx + w] && matches(i, y + 1)) stack.push([i, y + 1]);
      }
    }

    els.ctx.putImageData(state, 0, 0);
    // drawingState[currentKey] already IS `state` (same object) — the
    // in-place mutation above is itself the save, so switching drawings
    // or screens and coming back restores exactly this.
  }

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }

  /* ------------------------------------------------------------------
     RESET
     ------------------------------------------------------------------ */

  function requestReset() {
    els.modalReset.classList.add('cb-active');
  }

  function cancelReset() {
    els.modalReset.classList.remove('cb-active');
  }

  function confirmReset() {
    const orig = originalImageData[currentKey];
    drawingState[currentKey] = new ImageData(
      new Uint8ClampedArray(orig.data),
      orig.width,
      orig.height
    );
    renderCurrentState();
    els.modalReset.classList.remove('cb-active');
  }

  /* ------------------------------------------------------------------
     FINISH / COMPLETION
     ------------------------------------------------------------------ */

  function finishDrawing() {
    els.modalCompletion.classList.add('cb-active');
  }

  function keepColoring() {
    els.modalCompletion.classList.remove('cb-active');
  }

  function chooseAnother() {
    els.modalCompletion.classList.remove('cb-active');
    showDrawingSelection();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    showIntro: showIntro,
    showDrawingSelection: showDrawingSelection,
    exitToWorkshopMenu: exitToWorkshopMenu,
    closeCanvasToSelection: closeCanvasToSelection,
    openDrawing: openDrawing,
    selectColor: selectColor,
    selectBrush: selectBrush,
    selectEraser: selectEraser,
    requestReset: requestReset,
    cancelReset: cancelReset,
    confirmReset: confirmReset,
    finishDrawing: finishDrawing,
    keepColoring: keepColoring,
    chooseAnother: chooseAnother
  };

})();
