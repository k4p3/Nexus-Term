// Comodidades opcionales: el sitio funciona igual con JavaScript desactivado.
(function () {
  "use strict";

  // Recordar el idioma elegido (solo en este navegador).
  document.querySelectorAll("a[data-lang]").forEach(function (a) {
    a.addEventListener("click", function () {
      try { localStorage.setItem("nexus-lang", a.getAttribute("data-lang")); } catch (e) { /* sin almacenamiento */ }
    });
  });

  // Botón "copiar" en los bloques de código.
  document.querySelectorAll("pre[data-copy]").forEach(function (pre) {
    var label = pre.getAttribute("data-copy-label") || "Copy";
    var done = pre.getAttribute("data-copied-label") || "Copied";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy";
    btn.textContent = label;
    btn.addEventListener("click", function () {
      var text = (pre.querySelector("code") || pre).textContent || "";
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(text.trim()).then(function () {
        btn.textContent = done;
        setTimeout(function () { btn.textContent = label; }, 1800);
      }).catch(function () { /* sin permiso */ });
    });
    pre.appendChild(btn);
  });
})();
