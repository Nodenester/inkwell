(function () {
  "use strict";

  var workspace = document.getElementById("workspace");
  var canvas = document.getElementById("canvas");
  var ctx = canvas.getContext("2d");
  var openBtn = document.getElementById("open-btn");
  var fileInput = document.getElementById("file-input");
  var downloadBtn = document.getElementById("download-btn");
  var dropHint = document.getElementById("drop-hint");
  var canvasFrame = document.querySelector(".canvas-frame");
  var imageInfo = document.getElementById("image-info");

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

  var imageLoaded = false;

  // The untouched ("baked") image lives on an offscreen canvas; the visible
  // canvas always shows it rendered through the current adjustment filters.
  var sourceCanvas = document.createElement("canvas");
  var sourceCtx = sourceCanvas.getContext("2d");

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
    render();
    // The visible canvas now holds the filtered pixels — bake them in.
    sourceCanvas.width = canvas.width;
    sourceCanvas.height = canvas.height;
    sourceCtx.drawImage(canvas, 0, 0);
    resetControls();
    render();
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
    adjustControls.forEach(function (el) { el.disabled = !loaded; });
    brushControls.forEach(function (el) { el.disabled = !loaded; });
    resizeControls.forEach(function (el) { el.disabled = !loaded; });
    cropToggle.disabled = !loaded;
    setBrushActive(false);
    setCropActive(false);
    if (loaded) syncResizeInputs();
    dropHint.hidden = loaded;
    canvasFrame.hidden = !loaded;
    updateImageInfo();
  }

  function loadFile(file) {
    if (!file || file.type.indexOf("image/") !== 0) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      sourceCanvas.width = img.naturalWidth;
      sourceCanvas.height = img.naturalHeight;
      sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
      sourceCtx.drawImage(img, 0, 0);
      setLoadedState(true);
      resetControls();
      render();
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      imageInfo.textContent = "Could not load that file";
    };
    img.src = url;
  }

  function openPicker() {
    fileInput.click();
  }

  function downloadPNG() {
    if (!imageLoaded) return;
    var link = document.createElement("a");
    link.download = "inkwell.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
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

  openBtn.addEventListener("click", openPicker);
  dropHint.addEventListener("click", openPicker);
  downloadBtn.addEventListener("click", downloadPNG);

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
    if (e.dataTransfer && e.dataTransfer.files.length) {
      loadFile(e.dataTransfer.files[0]);
    }
  });

  // A drop anywhere else (e.g. the sidebar) must not navigate away
  window.addEventListener("dragover", function (e) { e.preventDefault(); });
  window.addEventListener("drop", function (e) { e.preventDefault(); });

  // Keyboard shortcuts
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (cropActive) {
        e.preventDefault();
        setCropActive(false);
      }
      return;
    }
    var key = e.key.toLowerCase();
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && (key === "b" || key === "c")) {
      var target = e.target;
      var typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
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
