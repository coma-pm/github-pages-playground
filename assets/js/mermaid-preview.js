import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";

mermaid.initialize({ startOnLoad: false });

const definition = document.getElementById("definition");
const preview = document.getElementById("preview");

async function render() {
  const { svg } = await mermaid.render(`mermaid-${crypto.randomUUID()}`, definition.value);
  preview.innerHTML = svg;
}

definition.addEventListener("input", () => {
  void render();
});

void render();
