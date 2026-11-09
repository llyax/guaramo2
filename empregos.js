// O currículo é montado em memória e exportado em português.
(() => {
  const form = document.querySelector("#cv-form");
  if (!form) return;

  const result = document.querySelector("#cv-result");
  const preview = document.querySelector("#cv-text");
  const title = document.querySelector("#cv-preview-title");
  const status = document.querySelector("#cv-status");
  const download = document.querySelector("#cv-download");
  const sections = [
    ["target", "Objetivo profissional"],
    ["history", "Experiência"],
    ["learning", "Formação e cursos"],
    ["skills", "Idiomas e habilidades"]
  ];

  function clearPreview() {
    result.hidden = true;
    preview.textContent = "";
    status.textContent = "";
  }

  form.hidden = false;
  form.addEventListener("input", clearPreview);
  window.addEventListener("pagehide", () => {
    form.reset();
    clearPreview();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = new FormData(form);
    const value = (name) => fields.get(name).trim();
    if (!value("name") || !value("target")) {
      const lang = document.documentElement.lang === "es" ? 1 : 0;
      status.textContent = copy["cv-invalid"][lang];
      form.elements.namedItem(!value("name") ? "name" : "target").focus();
      return;
    }

    const header = [value("name"), value("region"), value("contact")].filter(Boolean);
    const blocks = sections
      .map(([name, heading]) => [value(name), heading])
      .filter(([text]) => Boolean(text))
      .map(([text, heading]) => heading + "\n" + text);
    preview.textContent = [header.join("\n"), ...blocks].join("\n\n") + "\n";
    status.textContent = "";
    result.hidden = false;
    title.focus();
  });

  download.addEventListener("click", () => {
    if (!preview.textContent) return;
    const file = new Blob(["\uFEFF", preview.textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "curriculo-guaramo.txt";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();

