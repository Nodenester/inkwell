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

  var imageLoaded = false;

  function setLoadedState(loaded, width, height) {
    imageLoaded = loaded;
    downloadBtn.disabled = !loaded;
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
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setLoadedState(true, canvas.width, canvas.height);
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
