(function () {
  // skala tetap biar size konten di Word konsisten & tajam
  var EXPORT_SCALE = 3;
  var DEBOUNCE_MS = 300;
  var DARK_THEMES = {
    dark: true,
    "redux-dark": true,
    "redux-dark-color": true,
    "neo-dark": true,
  };

  var mermaid = window.mermaid;
  if (!mermaid) {
    document.getElementById("error").hidden = false;
    document.getElementById("error").textContent = "Mermaid belum ke-load.";
    return;
  }

  var syntaxEl = document.getElementById("syntax");
  var previewEl = document.getElementById("preview");
  var errorEl = document.getElementById("error");
  var btnExport = document.getElementById("btnExport");
  var versionEl = document.getElementById("mermaidVersion");
  var themeSelect = document.getElementById("themeSelect");
  var lookSelect = document.getElementById("lookSelect");

  var renderTimer = null;
  var renderId = 0;

  if (versionEl && mermaid.version) {
    versionEl.textContent = "mermaid " + mermaid.version;
  }

  function isDarkTheme(theme) {
    return !!DARK_THEMES[theme];
  }

  function getExportBackground() {
    return isDarkTheme(themeSelect.value) ? "#1e1e1e" : "#ffffff";
  }

  function applyMermaidConfig() {
    var theme = themeSelect.value;
    var look = lookSelect.value;

    mermaid.initialize({
      startOnLoad: false,
      theme: theme,
      look: look,
      securityLevel: "loose",
      fontFamily: "Segoe UI, Tahoma, sans-serif",
      logLevel: "error",
      // foreignObject HTML label bikin canvas tainted → toBlob gagal
      htmlLabels: false,
      flowchart: { htmlLabels: false },
    });

    previewEl.classList.toggle("is-dark", isDarkTheme(theme));
  }

  function showError(message) {
    errorEl.hidden = false;
    errorEl.textContent = message;
    btnExport.disabled = true;
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = "";
    btnExport.disabled = false;
  }

  function getSvgSize(svg) {
    var viewBox = svg.viewBox && svg.viewBox.baseVal;
    if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
      return { width: viewBox.width, height: viewBox.height };
    }

    var attrW = parseFloat(svg.getAttribute("width"));
    var attrH = parseFloat(svg.getAttribute("height"));
    if (attrW > 0 && attrH > 0) {
      return { width: attrW, height: attrH };
    }

    var bbox = svg.getBBox();
    return {
      width: Math.max(bbox.width, 1),
      height: Math.max(bbox.height, 1),
    };
  }

  async function renderDiagram() {
    var code = syntaxEl.value.trim();
    if (!code) {
      previewEl.innerHTML = "";
      showError("Syntax kosong.");
      return;
    }

    renderId += 1;
    var currentId = "mermaid-preview-" + renderId;

    try {
      var result = await mermaid.render(currentId, code);
      previewEl.innerHTML = result.svg;
      clearError();
    } catch (err) {
      previewEl.innerHTML = "";
      showError(err && err.message ? err.message : String(err));
    }
  }

  function scheduleRender() {
    if (renderTimer) {
      clearTimeout(renderTimer);
    }
    renderTimer = setTimeout(function () {
      renderDiagram();
    }, DEBOUNCE_MS);
  }

  function onThemeOrLookChange() {
    applyMermaidConfig();
    renderDiagram();
  }

  function downloadBlob(pngBlob, filename) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(pngBlob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 1000);
  }

  function prepareSvgClone(svg, size) {
    var clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    clone.setAttribute("width", String(size.width));
    clone.setAttribute("height", String(size.height));
    if (!clone.getAttribute("viewBox")) {
      clone.setAttribute("viewBox", "0 0 " + size.width + " " + size.height);
    }

    // pastiin style SVG gak ketarik resource luar
    var styles = clone.querySelectorAll("style");
    for (var i = 0; i < styles.length; i++) {
      var css = styles[i].textContent || "";
      styles[i].textContent = css.replace(/@import[^;]+;/g, "");
    }

    return clone;
  }

  function exportPng() {
    var svg = previewEl.querySelector("svg");
    if (!svg) {
      showError("Belum ada diagram untuk di-export.");
      return;
    }

    var size = getSvgSize(svg);
    var width = Math.ceil(size.width * EXPORT_SCALE);
    var height = Math.ceil(size.height * EXPORT_SCALE);

    var clone = prepareSvgClone(svg, size);
    var svgString = new XMLSerializer().serializeToString(clone);
    // data URL (bukan blob) biar canvas gak tainted
    var url =
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);

    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      var ctx = canvas.getContext("2d");
      ctx.fillStyle = getExportBackground();
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      try {
        canvas.toBlob(function (pngBlob) {
          if (!pngBlob) {
            showError("Gagal membuat PNG.");
            return;
          }
          downloadBlob(pngBlob, "mermaid-diagram.png");
        }, "image/png");
      } catch (err) {
        showError(
          "Export gagal (canvas tainted). Hard refresh halaman, pastikan diagram sudah re-render."
        );
      }
    };

    img.onerror = function () {
      showError("Gagal render SVG ke image.");
    };

    img.src = url;
  }

  syntaxEl.addEventListener("input", scheduleRender);
  themeSelect.addEventListener("change", onThemeOrLookChange);
  lookSelect.addEventListener("change", onThemeOrLookChange);
  btnExport.addEventListener("click", exportPng);

  applyMermaidConfig();
  renderDiagram();
})();
