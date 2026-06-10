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

  function setLoadedState(loaded, width, height) {
    imageLoaded = loaded;
    downloadBtn.disabled = !loaded;
    adjustControls.forEach(function (el) { el.disabled = !loaded; });
    dropHint.hidden = loaded;
    canvasFrame.hidden = !loaded;
    imageInfo.textContent = loaded ? width + " × " + height + " px" : "No image";
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
      setLoadedState(true, sourceCanvas.width, sourceCanvas.height);
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
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    var key = e.key.toLowerCase();
    if (key === "o") {
      e.preventDefault();
      openPicker();
    } else if (key === "s") {
      e.preventDefault();
      downloadPNG();
    }
  });
})();
