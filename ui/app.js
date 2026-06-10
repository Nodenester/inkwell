(function () {
  "use strict";

  var workspace = document.getElementById("workspace");
  var canvas = document.getElementById("canvas");
  var ctx = canvas.getContext("2d");
  var openBtn = document.getElementById("open-btn");
  var fileInput = document.getElementById("file-input");
  var downloadBtn = document.getElementById("download-btn");
  var exportJpegBtn = document.getElementById("export-jpeg");
  var jpegQualityInput = document.getElementById("jpeg-quality");
  var jpegQualityValue = document.getElementById("jpeg-quality-value");
  var dropHint = document.getElementById("drop-hint");
  var canvasFrame = document.querySelector(".canvas-frame");
  var imageInfo = document.getElementById("image-info");
  var fileError = document.getElementById("file-error");
  var sidebar = document.getElementById("sidebar");
  var sidebarToggle = document.getElementById("sidebar-toggle");
  var helpBtn = document.getElementById("help-btn");
  var helpCloseBtn = document.getElementById("help-close");
  var helpDialog = document.getElementById("help-dialog");

  // Adjustments panel
  var brightnessInput = document.getElementById("adjust-brightness");
  var contrastInput = document.getElementById("adjust-contrast");
  var saturationInput = document.getElementById("adjust-saturation");
  var blurInput = document.getElementById("adjust-blur");
  var grayscaleBtn = document.getElementById("toggle-grayscale");
  var invertBtn = document.getElementById("toggle-invert");
  var applyBtn = document.getElementById("apply-adjust");
  var resetBtn = document.getElementById("reset-adjust");

  var sliders = [brightnessInput, contrastInput, saturationInput, blurInput];
  var adjustControls = sliders.concat([grayscaleBtn, invertBtn, applyBtn, resetBtn]);

  // Brush panel
  var brushToggle = document.getElementById("brush-toggle");
  var brushColorInput = document.getElementById("brush-color");
  var brushSizeInput = document.getElementById("brush-size");
  var brushSizeValue = document.getElementById("brush-size-value");
  var paintModeBtn = document.getElementById("brush-mode-paint");
  var eraseModeBtn = document.getElementById("brush-mode-erase");

  var brushControls = [brushToggle, brushColorInput, brushSizeInput, paintModeBtn, eraseModeBtn];

  // Crop panel
  var cropToggle = document.getElementById("crop-toggle");
  var cropApplyBtn = document.getElementById("crop-apply");
  var cropCancelBtn = document.getElementById("crop-cancel");
  var cropOverlay = document.getElementById("crop-overlay");
  var cropRectEl = document.getElementById("crop-rect");
  var cropReadout = document.getElementById("crop-size-readout");

  // Resize panel
  var resizeWidthInput = document.getElementById("resize-width");
  var resizeHeightInput = document.getElementById("resize-height");
  var resizeLockBtn = document.getElementById("resize-lock");
  var resizeApplyBtn = document.getElementById("resize-apply");

  var resizeControls = [resizeWidthInput, resizeHeightInput, resizeLockBtn, resizeApplyBtn];

  // Transform panel
  var rotateCwBtn = document.getElementById("rotate-cw");
  var rotateCcwBtn = document.getElementById("rotate-ccw");
  var flipHBtn = document.getElementById("flip-h");
  var flipVBtn = document.getElementById("flip-v");

  var transformControls = [rotateCwBtn, rotateCcwBtn, flipHBtn, flipVBtn];

  // View (zoom) panel + status bar
  var zoomInBtn = document.getElementById("zoom-in");
  var zoomOutBtn = document.getElementById("zoom-out");
  var zoomFitBtn = document.getElementById("zoom-fit");
  var zoom100Btn = document.getElementById("zoom-100");
  var zoomReadout = document.getElementById("zoom-readout");
  var zoomStatus = document.getElementById("zoom-status");

  var viewControls = [zoomInBtn, zoomOutBtn, zoomFitBtn, zoom100Btn];

  // History panel
  var undoBtn = document.getElementById("undo-btn");
  var redoBtn = document.getElementById("redo-btn");

  var imageLoaded = false;

  // The untouched ("baked") image lives on an offscreen canvas; the visible
  // canvas always shows it rendered through the current adjustment filters.
  var sourceCanvas = document.createElement("canvas");
  // History snapshots read this canvas back after every edit.
  var sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });

  function sliderValue(input) {
    var n = Number(input.value);
    return isFinite(n) ? n : 0;
  }

  function isPressed(btn) {
    return btn.getAttribute("aria-pressed") === "true";
  }

  function filterString() {
    var parts = [];
    var brightness = sliderValue(brightnessInput);
    var contrast = sliderValue(contrastInput);
    var saturation = sliderValue(saturationInput);
    var blur = sliderValue(blurInput);
    if (brightness !== 0) parts.push("brightness(" + (100 + brightness) / 100 + ")");
    if (contrast !== 0) parts.push("contrast(" + (100 + contrast) / 100 + ")");
    if (saturation !== 0) parts.push("saturate(" + (100 + saturation) / 100 + ")");
    if (isPressed(grayscaleBtn)) parts.push("grayscale(1)");
    if (isPressed(invertBtn)) parts.push("invert(1)");
    if (blur > 0) parts.push("blur(" + blur + "px)");
    return parts.length ? parts.join(" ") : "none";
  }

  function render() {
    if (!imageLoaded) return;
    // Assigning width/height also clears the canvas and resets ctx state.
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    if (typeof ctx.filter === "string") ctx.filter = filterString();
    ctx.drawImage(sourceCanvas, 0, 0);
    if (typeof ctx.filter === "string") ctx.filter = "none";
    applyZoom();
  }

  function updateValueLabel(input) {
    var label = document.getElementById(input.id.replace("adjust-", "") + "-value");
    if (label) label.textContent = input.value;
  }

  function resetControls() {
    sliders.forEach(function (input) {
      input.value = "0";
      updateValueLabel(input);
    });
    grayscaleBtn.setAttribute("aria-pressed", "false");
    invertBtn.setAttribute("aria-pressed", "false");
  }

  function applyAdjustments() {
    if (!imageLoaded) return;
    // Nothing to bake (and no history entry) when every control is neutral.
    if (filterString() === "none") return;
    render();
    // The visible canvas now holds the filtered pixels — bake them in.
    sourceCanvas.width = canvas.width;
    sourceCanvas.height = canvas.height;
    sourceCtx.drawImage(canvas, 0, 0);
    resetControls();
    render();
    pushHistory();
  }

  function resetAdjustments() {
    resetControls();
    render();
  }

  function updateImageInfo() {
    imageInfo.textContent = imageLoaded
      ? sourceCanvas.width + " × " + sourceCanvas.height + " px"
      : "No image";
  }

  function setLoadedState(loaded) {
    imageLoaded = loaded;
    downloadBtn.disabled = !loaded;
    exportJpegBtn.disabled = !loaded;
    jpegQualityInput.disabled = !loaded;
    adjustControls.forEach(function (el) { el.disabled = !loaded; });
    brushControls.forEach(function (el) { el.disabled = !loaded; });
    resizeControls.forEach(function (el) { el.disabled = !loaded; });
    transformControls.forEach(function (el) { el.disabled = !loaded; });
    viewControls.forEach(function (el) { el.disabled = !loaded; });
    cropToggle.disabled = !loaded;
    setBrushActive(false);
    setCropActive(false);
    if (loaded) syncResizeInputs();
    // Every fresh image starts fitted to the view.
    zoomFit = true;
    zoomLevel = 1;
    dropHint.hidden = loaded;
    canvasFrame.hidden = !loaded;
    updateHistoryButtons();
    updateImageInfo();
    applyZoom();
  }

  // ---------- File errors ----------

  var fileErrorTimer = null;

  function showFileError(message) {
    fileError.textContent = message;
    fileError.hidden = false;
    if (fileErrorTimer) clearTimeout(fileErrorTimer);
    fileErrorTimer = setTimeout(hideFileError, 6000);
  }

  function hideFileError() {
    if (fileErrorTimer) {
      clearTimeout(fileErrorTimer);
      fileErrorTimer = null;
    }
    fileError.hidden = true;
  }

  function fileLabel(file) {
    return file && file.name ? "“" + file.name + "”" : "That file";
  }

  // Base name of the opened file (no extension) — used to name exports.
  var exportBaseName = "inkwell";

  function baseNameOf(name) {
    var base = String(name || "").replace(/\.[^.]*$/, "").trim();
    return base || "inkwell";
  }

  function loadFile(file) {
    if (!file) {
      showFileError("Nothing usable was dropped. Drag an image file from your computer.");
      return;
    }
    if (!file.type || file.type.indexOf("image/") !== 0) {
      showFileError(fileLabel(file) + " isn’t an image. Try a PNG, JPEG, GIF, or WebP file.");
      return;
    }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      sourceCanvas.width = img.naturalWidth;
      sourceCanvas.height = img.naturalHeight;
      sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
      sourceCtx.drawImage(img, 0, 0);
      exportBaseName = baseNameOf(file.name);
      hideFileError();
      setLoadedState(true);
      resetControls();
      render();
      // A replacement image starts a fresh editing session.
      clearHistory();
      pushHistory();
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      showFileError("Could not read " + fileLabel(file) + " — it may be corrupted or an unsupported format.");
    };
    img.src = url;
  }

  function openPicker() {
    fileInput.click();
  }

  function triggerDownload(filename, dataUrl) {
    var link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }

  function downloadPNG() {
    if (!imageLoaded) return;
    triggerDownload(exportBaseName + ".png", canvas.toDataURL("image/png"));
  }

  function downloadJPEG() {
    if (!imageLoaded) return;
    var quality = Math.min(100, Math.max(1, sliderValue(jpegQualityInput) || 90)) / 100;
    // JPEG has no alpha channel — composite onto white so transparent areas
    // don't come out black.
    var tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    var t = tmp.getContext("2d");
    t.fillStyle = "#ffffff";
    t.fillRect(0, 0, tmp.width, tmp.height);
    t.drawImage(canvas, 0, 0);
    triggerDownload(exportBaseName + ".jpg", tmp.toDataURL("image/jpeg", quality));
  }

  // ---------- Brush ----------
  //
  // Strokes are painted into the baked image (sourceCanvas) so they survive
  // re-renders and end up in the exported PNG. For instant feedback the same
  // segment is also drawn straight onto the visible canvas; a full render()
  // at stroke end resyncs the preview through the filter pipeline.

  var brushActive = false;
  var stroking = false;
  var strokePointerId = null;
  var lastPoint = null;

  function setBrushActive(active) {
    brushActive = active && imageLoaded;
    if (brushActive) setCropActive(false);
    brushToggle.setAttribute("aria-pressed", brushActive ? "true" : "false");
    canvas.classList.toggle("brush-active", brushActive);
  }

  function brushIsErase() {
    return isPressed(eraseModeBtn);
  }

  function setBrushMode(erase) {
    paintModeBtn.setAttribute("aria-pressed", erase ? "false" : "true");
    eraseModeBtn.setAttribute("aria-pressed", erase ? "true" : "false");
  }

  // Pointer position in canvas pixel coordinates, correct at any display scale.
  function canvasPoint(e) {
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function eachBrushContext(fn) {
    [ctx, sourceCtx].forEach(function (c) {
      c.save();
      if (brushIsErase()) {
        c.globalCompositeOperation = "destination-out";
        c.strokeStyle = "#000";
        c.fillStyle = "#000";
      } else {
        c.globalCompositeOperation = "source-over";
        c.strokeStyle = brushColorInput.value;
        c.fillStyle = brushColorInput.value;
      }
      fn(c);
      c.restore();
    });
  }

  function drawDot(p) {
    var radius = Math.max(0.5, sliderValue(brushSizeInput) / 2);
    eachBrushContext(function (c) {
      c.beginPath();
      c.arc(p.x, p.y, radius, 0, Math.PI * 2);
      c.fill();
    });
  }

  function drawSegment(from, to) {
    eachBrushContext(function (c) {
      c.lineWidth = Math.max(1, sliderValue(brushSizeInput));
      c.lineCap = "round";
      c.lineJoin = "round";
      c.beginPath();
      c.moveTo(from.x, from.y);
      c.lineTo(to.x, to.y);
      c.stroke();
    });
  }

  function endStroke() {
    if (!stroking) return;
    stroking = false;
    strokePointerId = null;
    lastPoint = null;
    // Resync the preview so strokes pass through any live filters too.
    render();
    pushHistory();
  }

  canvas.addEventListener("pointerdown", function (e) {
    if (!brushActive || !imageLoaded || stroking) return;
    if (e.button !== 0 && e.button !== -1) return;
    e.preventDefault();
    var p = canvasPoint(e);
    if (!p) return;
    stroking = true;
    strokePointerId = e.pointerId;
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture is best-effort */ }
    }
    drawDot(p);
    lastPoint = p;
  });

  canvas.addEventListener("pointermove", function (e) {
    if (!stroking || e.pointerId !== strokePointerId) return;
    e.preventDefault();
    // Coalesced events give every intermediate sample for smoother curves.
    var events = (typeof e.getCoalescedEvents === "function" && e.getCoalescedEvents().length)
      ? e.getCoalescedEvents()
      : [e];
    events.forEach(function (ev) {
      var p = canvasPoint(ev);
      if (!p) return;
      if (lastPoint) drawSegment(lastPoint, p);
      lastPoint = p;
    });
  });

  canvas.addEventListener("pointerup", function (e) {
    if (e.pointerId === strokePointerId) endStroke();
  });
  canvas.addEventListener("pointercancel", function (e) {
    if (e.pointerId === strokePointerId) endStroke();
  });

  brushToggle.addEventListener("click", function () {
    setBrushActive(!brushActive);
  });
  paintModeBtn.addEventListener("click", function () { setBrushMode(false); });
  eraseModeBtn.addEventListener("click", function () { setBrushMode(true); });

  brushSizeInput.addEventListener("input", function () {
    brushSizeValue.textContent = brushSizeInput.value;
  });

  // ---------- Crop ----------
  //
  // The overlay sits exactly on top of the canvas. A drag defines a selection
  // in display pixels; on apply it is converted to image pixels and the baked
  // image is cut down to that rectangle.

  var cropActive = false;
  var cropDragging = false;
  var cropPointerId = null;
  var cropDragStart = null;
  var cropSel = null; // {x, y, w, h} in overlay display px

  function setCropActive(active) {
    cropActive = active && imageLoaded;
    if (cropActive) setBrushActive(false);
    cropToggle.setAttribute("aria-pressed", cropActive ? "true" : "false");
    cropOverlay.hidden = !cropActive;
    if (!cropActive) clearCropSelection();
    updateCropButtons();
  }

  function clearCropSelection() {
    cropDragging = false;
    cropPointerId = null;
    cropDragStart = null;
    cropSel = null;
    cropRectEl.hidden = true;
    updateCropButtons();
  }

  function updateCropButtons() {
    cropApplyBtn.disabled = !imageLoaded || !cropActive || !cropSelectionPixels();
    cropCancelBtn.disabled = !imageLoaded || !cropActive;
  }

  // Pointer position clamped to the overlay (i.e. the displayed image).
  function overlayPoint(e) {
    var r = cropOverlay.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - r.left, 0), r.width),
      y: Math.min(Math.max(e.clientY - r.top, 0), r.height)
    };
  }

  // Selection converted to whole image pixels (at least 1×1), or null.
  function cropSelectionPixels() {
    if (!cropSel || cropSel.w < 1 || cropSel.h < 1) return null;
    var r = cropOverlay.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    var scaleX = sourceCanvas.width / r.width;
    var scaleY = sourceCanvas.height / r.height;
    var sx = Math.max(0, Math.min(sourceCanvas.width - 1, Math.round(cropSel.x * scaleX)));
    var sy = Math.max(0, Math.min(sourceCanvas.height - 1, Math.round(cropSel.y * scaleY)));
    var ex = Math.max(sx + 1, Math.min(sourceCanvas.width, Math.round((cropSel.x + cropSel.w) * scaleX)));
    var ey = Math.max(sy + 1, Math.min(sourceCanvas.height, Math.round((cropSel.y + cropSel.h) * scaleY)));
    return { x: sx, y: sy, w: ex - sx, h: ey - sy };
  }

  function setCropSelection(a, b) {
    cropSel = {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(a.x - b.x),
      h: Math.abs(a.y - b.y)
    };
    cropRectEl.hidden = false;
    cropRectEl.style.left = cropSel.x + "px";
    cropRectEl.style.top = cropSel.y + "px";
    cropRectEl.style.width = cropSel.w + "px";
    cropRectEl.style.height = cropSel.h + "px";
    var px = cropSelectionPixels();
    cropReadout.textContent = (px ? px.w + " × " + px.h : "0 × 0") + " px";
    updateCropButtons();
  }

  function endCropDrag() {
    if (!cropDragging) return;
    cropDragging = false;
    cropPointerId = null;
    cropDragStart = null;
    // A click without a real drag leaves no useful selection.
    if (cropSel && (cropSel.w < 3 || cropSel.h < 3)) clearCropSelection();
    updateCropButtons();
  }

  function applyCrop() {
    var sel = cropSelectionPixels();
    if (!sel || !imageLoaded) return;
    var tmp = document.createElement("canvas");
    tmp.width = sel.w;
    tmp.height = sel.h;
    tmp.getContext("2d").drawImage(sourceCanvas, sel.x, sel.y, sel.w, sel.h, 0, 0, sel.w, sel.h);
    sourceCanvas.width = sel.w;
    sourceCanvas.height = sel.h;
    sourceCtx.drawImage(tmp, 0, 0);
    setCropActive(false);
    syncResizeInputs();
    render();
    updateImageInfo();
    pushHistory();
  }

  cropOverlay.addEventListener("pointerdown", function (e) {
    if (!cropActive || cropDragging) return;
    if (e.button !== 0 && e.button !== -1) return;
    e.preventDefault();
    cropDragging = true;
    cropPointerId = e.pointerId;
    if (cropOverlay.setPointerCapture) {
      try { cropOverlay.setPointerCapture(e.pointerId); } catch (err) { /* capture is best-effort */ }
    }
    cropDragStart = overlayPoint(e);
    setCropSelection(cropDragStart, cropDragStart);
  });

  cropOverlay.addEventListener("pointermove", function (e) {
    if (!cropDragging || e.pointerId !== cropPointerId) return;
    e.preventDefault();
    setCropSelection(cropDragStart, overlayPoint(e));
  });

  cropOverlay.addEventListener("pointerup", function (e) {
    if (e.pointerId === cropPointerId) endCropDrag();
  });
  cropOverlay.addEventListener("pointercancel", function (e) {
    if (e.pointerId === cropPointerId) endCropDrag();
  });

  cropToggle.addEventListener("click", function () { setCropActive(!cropActive); });
  cropApplyBtn.addEventListener("click", applyCrop);
  cropCancelBtn.addEventListener("click", function () { setCropActive(false); });

  // ---------- Resize ----------

  var MAX_DIM = 10000;
  var aspectRatio = 1;

  function syncResizeInputs() {
    resizeWidthInput.value = sourceCanvas.width;
    resizeHeightInput.value = sourceCanvas.height;
    aspectRatio = sourceCanvas.width / sourceCanvas.height;
  }

  function parseDim(input) {
    var n = Math.round(Number(input.value));
    if (!isFinite(n) || n < 1) return null;
    return Math.min(n, MAX_DIM);
  }

  function aspectLocked() {
    return isPressed(resizeLockBtn);
  }

  function applyResize() {
    if (!imageLoaded) return;
    var w = parseDim(resizeWidthInput);
    var h = parseDim(resizeHeightInput);
    if (!w || !h) {
      syncResizeInputs();
      return;
    }
    resizeWidthInput.value = w;
    resizeHeightInput.value = h;
    if (w === sourceCanvas.width && h === sourceCanvas.height) return;
    var tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    var tmpCtx = tmp.getContext("2d");
    tmpCtx.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in tmpCtx) tmpCtx.imageSmoothingQuality = "high";
    tmpCtx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, w, h);
    sourceCanvas.width = w;
    sourceCanvas.height = h;
    sourceCtx.drawImage(tmp, 0, 0);
    aspectRatio = w / h;
    render();
    updateImageInfo();
    pushHistory();
  }

  resizeWidthInput.addEventListener("input", function () {
    if (!aspectLocked() || !(aspectRatio > 0)) return;
    var w = parseDim(resizeWidthInput);
    if (w) resizeHeightInput.value = Math.max(1, Math.round(w / aspectRatio));
  });

  resizeHeightInput.addEventListener("input", function () {
    if (!aspectLocked() || !(aspectRatio > 0)) return;
    var h = parseDim(resizeHeightInput);
    if (h) resizeWidthInput.value = Math.max(1, Math.round(h * aspectRatio));
  });

  [resizeWidthInput, resizeHeightInput].forEach(function (input) {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        applyResize();
      }
    });
  });

  resizeLockBtn.addEventListener("click", function () {
    var locking = !aspectLocked();
    resizeLockBtn.setAttribute("aria-pressed", locking ? "true" : "false");
    if (locking) {
      // Re-lock at the proportions currently in the inputs (image as fallback).
      var w = parseDim(resizeWidthInput);
      var h = parseDim(resizeHeightInput);
      aspectRatio = (w && h) ? w / h : sourceCanvas.width / sourceCanvas.height;
    }
  });

  resizeApplyBtn.addEventListener("click", applyResize);

  // ---------- Transform (rotate / flip) ----------
  //
  // Each transform redraws the baked image through a rotated/mirrored context
  // onto a temp canvas, copies it back, and snapshots history — so transforms
  // bake immediately and undo/redo like any other edit.

  function applyTransform(kind) {
    if (!imageLoaded || stroking || cropDragging) return;
    var w = sourceCanvas.width;
    var h = sourceCanvas.height;
    var rotated = kind === "cw" || kind === "ccw";
    var tmp = document.createElement("canvas");
    tmp.width = rotated ? h : w;
    tmp.height = rotated ? w : h;
    var t = tmp.getContext("2d");
    if (kind === "cw") {
      t.translate(tmp.width, 0);
      t.rotate(Math.PI / 2);
    } else if (kind === "ccw") {
      t.translate(0, tmp.height);
      t.rotate(-Math.PI / 2);
    } else if (kind === "flip-h") {
      t.translate(w, 0);
      t.scale(-1, 1);
    } else {
      t.translate(0, h);
      t.scale(1, -1);
    }
    t.drawImage(sourceCanvas, 0, 0);
    sourceCanvas.width = tmp.width;
    sourceCanvas.height = tmp.height;
    sourceCtx.drawImage(tmp, 0, 0);
    // A pending crop selection no longer matches the reoriented image.
    if (cropActive) setCropActive(false);
    syncResizeInputs();
    render();
    updateImageInfo();
    pushHistory();
  }

  rotateCwBtn.addEventListener("click", function () { applyTransform("cw"); });
  rotateCcwBtn.addEventListener("click", function () { applyTransform("ccw"); });
  flipHBtn.addEventListener("click", function () { applyTransform("flip-h"); });
  flipVBtn.addEventListener("click", function () { applyTransform("flip-v"); });

  // ---------- View zoom ----------
  //
  // Zoom only changes the canvas element's CSS size; the bitmap (and the
  // exported PNG) stays at full image resolution. "Fit" recomputes on every
  // render and window resize so the image always fills the available view
  // (never upscaled past 100%).

  var ZOOM_STEPS = [0.05, 0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 1, 1.5, 2, 3, 4, 6, 8];
  var ZOOM_MIN = ZOOM_STEPS[0];
  var ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1];
  var zoomFit = true;
  var zoomLevel = 1;

  // Workspace space left for the canvas once workspace + frame chrome is gone.
  function availableViewSize() {
    var ws = getComputedStyle(workspace);
    var fr = getComputedStyle(canvasFrame);
    var chromeW = parseFloat(ws.paddingLeft) + parseFloat(ws.paddingRight)
      + parseFloat(fr.paddingLeft) + parseFloat(fr.paddingRight)
      + parseFloat(fr.borderLeftWidth) + parseFloat(fr.borderRightWidth);
    var chromeH = parseFloat(ws.paddingTop) + parseFloat(ws.paddingBottom)
      + parseFloat(fr.paddingTop) + parseFloat(fr.paddingBottom)
      + parseFloat(fr.borderTopWidth) + parseFloat(fr.borderBottomWidth);
    return {
      w: Math.max(1, workspace.clientWidth - chromeW),
      h: Math.max(1, workspace.clientHeight - chromeH)
    };
  }

  function fitScale() {
    if (!sourceCanvas.width || !sourceCanvas.height) return 1;
    var avail = availableViewSize();
    var s = Math.min(avail.w / sourceCanvas.width, avail.h / sourceCanvas.height);
    if (!isFinite(s) || s <= 0) return 1;
    return Math.min(s, 1);
  }

  function currentZoom() {
    return zoomFit ? fitScale() : zoomLevel;
  }

  function applyZoom() {
    if (!imageLoaded) {
      zoomReadout.textContent = "—";
      zoomStatus.textContent = "";
      return;
    }
    var z = currentZoom();
    canvas.style.width = Math.max(1, Math.round(sourceCanvas.width * z)) + "px";
    canvas.style.height = Math.max(1, Math.round(sourceCanvas.height * z)) + "px";
    var pct = Math.round(z * 100) + "%";
    zoomReadout.textContent = pct;
    zoomStatus.textContent = "Zoom " + pct + (zoomFit ? " (fit)" : "");
    zoomFitBtn.setAttribute("aria-pressed", zoomFit ? "true" : "false");
  }

  function setZoom(level, fit) {
    zoomFit = !!fit;
    if (!fit) zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, level));
    // The crop selection lives in display pixels; rescaling would misalign it.
    if (cropActive && cropSel) clearCropSelection();
    applyZoom();
  }

  function zoomIn() {
    if (!imageLoaded) return;
    var z = currentZoom();
    for (var i = 0; i < ZOOM_STEPS.length; i++) {
      if (ZOOM_STEPS[i] > z * 1.001) {
        setZoom(ZOOM_STEPS[i], false);
        return;
      }
    }
    setZoom(ZOOM_MAX, false);
  }

  function zoomOut() {
    if (!imageLoaded) return;
    var z = currentZoom();
    for (var i = ZOOM_STEPS.length - 1; i >= 0; i--) {
      if (ZOOM_STEPS[i] < z * 0.999) {
        setZoom(ZOOM_STEPS[i], false);
        return;
      }
    }
    setZoom(ZOOM_MIN, false);
  }

  zoomInBtn.addEventListener("click", zoomIn);
  zoomOutBtn.addEventListener("click", zoomOut);
  zoomFitBtn.addEventListener("click", function () {
    if (imageLoaded) setZoom(1, true);
  });
  zoom100Btn.addEventListener("click", function () {
    if (imageLoaded) setZoom(1, false);
  });

  window.addEventListener("resize", function () {
    if (imageLoaded && zoomFit) applyZoom();
  });

  // ---------- History ----------
  //
  // Every completed mutating operation (adjustment apply, finished brush
  // stroke, crop, resize) snapshots the baked image. Undo/redo move a cursor
  // through those snapshots and copy the chosen one back into sourceCanvas.

  var MAX_HISTORY = 25;
  // Pixel snapshots are uncompressed (4 bytes/px), so besides the state-count
  // cap, keep the whole stack under a byte budget for very large images.
  var MAX_HISTORY_BYTES = 256 * 1024 * 1024;
  var historyStates = [];
  var historyIndex = -1;

  function snapshotState() {
    return {
      width: sourceCanvas.width,
      height: sourceCanvas.height,
      data: sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
    };
  }

  function historyBytes() {
    return historyStates.reduce(function (sum, s) {
      return sum + s.data.data.length;
    }, 0);
  }

  function updateHistoryButtons() {
    undoBtn.disabled = !imageLoaded || historyIndex <= 0;
    redoBtn.disabled = !imageLoaded || historyIndex >= historyStates.length - 1;
  }

  function clearHistory() {
    historyStates = [];
    historyIndex = -1;
    updateHistoryButtons();
  }

  function pushHistory() {
    if (!imageLoaded) return;
    // A new edit invalidates any redo branch.
    historyStates.splice(historyIndex + 1);
    historyStates.push(snapshotState());
    while (historyStates.length > MAX_HISTORY) historyStates.shift();
    while (historyStates.length > 2 && historyBytes() > MAX_HISTORY_BYTES) {
      historyStates.shift();
    }
    historyIndex = historyStates.length - 1;
    updateHistoryButtons();
  }

  function restoreState(state) {
    sourceCanvas.width = state.width;
    sourceCanvas.height = state.height;
    sourceCtx.putImageData(state.data, 0, 0);
    // Live (unapplied) adjustments would re-filter the restored pixels, so
    // drop them: undo/redo must show the recorded canvas exactly.
    resetControls();
    if (cropActive) setCropActive(false);
    syncResizeInputs();
    render();
    updateImageInfo();
  }

  function undo() {
    if (!imageLoaded || stroking || cropDragging || historyIndex <= 0) return;
    historyIndex -= 1;
    restoreState(historyStates[historyIndex]);
    updateHistoryButtons();
  }

  function redo() {
    if (!imageLoaded || stroking || cropDragging) return;
    if (historyIndex >= historyStates.length - 1) return;
    historyIndex += 1;
    restoreState(historyStates[historyIndex]);
    updateHistoryButtons();
  }

  undoBtn.addEventListener("click", undo);
  redoBtn.addEventListener("click", redo);

  openBtn.addEventListener("click", openPicker);
  dropHint.addEventListener("click", openPicker);
  downloadBtn.addEventListener("click", downloadPNG);
  exportJpegBtn.addEventListener("click", downloadJPEG);

  jpegQualityInput.addEventListener("input", function () {
    jpegQualityValue.textContent = jpegQualityInput.value;
  });

  // ---------- Help dialog ----------

  function helpOpen() {
    return helpDialog.hasAttribute("open");
  }

  function openHelp() {
    if (helpOpen()) return;
    if (typeof helpDialog.showModal === "function") helpDialog.showModal();
    else helpDialog.setAttribute("open", "");
  }

  function closeHelp() {
    if (!helpOpen()) return;
    if (typeof helpDialog.close === "function") helpDialog.close();
    else helpDialog.removeAttribute("open");
  }

  helpBtn.addEventListener("click", openHelp);
  helpCloseBtn.addEventListener("click", closeHelp);
  // A click on the backdrop (the dialog element itself, not its content) closes.
  helpDialog.addEventListener("click", function (e) {
    if (e.target === helpDialog) closeHelp();
  });

  // ---------- Sidebar collapse (narrow viewports) ----------

  sidebarToggle.addEventListener("click", function () {
    var open = sidebar.classList.toggle("open");
    sidebarToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  sliders.forEach(function (input) {
    input.addEventListener("input", function () {
      updateValueLabel(input);
      render();
    });
  });

  [grayscaleBtn, invertBtn].forEach(function (btn) {
    btn.addEventListener("click", function () {
      btn.setAttribute("aria-pressed", isPressed(btn) ? "false" : "true");
      render();
    });
  });

  applyBtn.addEventListener("click", applyAdjustments);
  resetBtn.addEventListener("click", resetAdjustments);

  fileInput.addEventListener("change", function () {
    loadFile(fileInput.files[0]);
    // allow re-selecting the same file later
    fileInput.value = "";
  });

  // Drag and drop onto the workspace
  workspace.addEventListener("dragover", function (e) {
    e.preventDefault();
    workspace.classList.add("dragover");
  });
  workspace.addEventListener("dragleave", function (e) {
    if (!workspace.contains(e.relatedTarget)) {
      workspace.classList.remove("dragover");
    }
  });
  workspace.addEventListener("drop", function (e) {
    e.preventDefault();
    workspace.classList.remove("dragover");
    var files = e.dataTransfer ? e.dataTransfer.files : null;
    if (!files || !files.length) {
      showFileError("Nothing usable was dropped. Drag an image file from your computer.");
      return;
    }
    // If several files were dropped, take the first image among them.
    var file = null;
    for (var i = 0; i < files.length; i++) {
      if (files[i].type && files[i].type.indexOf("image/") === 0) {
        file = files[i];
        break;
      }
    }
    loadFile(file || files[0]);
  });

  // A drop anywhere else (e.g. the sidebar) must not navigate away
  window.addEventListener("dragover", function (e) { e.preventDefault(); });
  window.addEventListener("drop", function (e) { e.preventDefault(); });

  // Keyboard shortcuts
  window.addEventListener("keydown", function (e) {
    var targetEl = e.target;
    var typing = targetEl && (targetEl.tagName === "INPUT" || targetEl.tagName === "TEXTAREA");
    if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey && !typing) {
      e.preventDefault();
      if (helpOpen()) closeHelp();
      else openHelp();
      return;
    }
    if (e.key === "Escape") {
      if (helpOpen()) {
        // Modal dialogs close themselves on Esc; this covers the fallback.
        closeHelp();
        return;
      }
      if (cropActive) {
        e.preventDefault();
        setCropActive(false);
      }
      return;
    }
    // Editor shortcuts are paused while the help dialog is up.
    if (helpOpen()) return;
    var key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (key === "y" && !e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }
      if (key === "=" || key === "+") {
        e.preventDefault();
        zoomIn();
        return;
      }
      if (key === "-" || key === "_") {
        e.preventDefault();
        zoomOut();
        return;
      }
      if (key === "0") {
        e.preventDefault();
        if (imageLoaded) setZoom(1, true);
        return;
      }
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && (key === "b" || key === "c")) {
      if (!typing && imageLoaded) {
        e.preventDefault();
        if (key === "b") setBrushActive(!brushActive);
        else setCropActive(!cropActive);
      }
      return;
    }
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    if (key === "o") {
      e.preventDefault();
      openPicker();
    } else if (key === "s") {
      e.preventDefault();
      downloadPNG();
    }
  });
})();
