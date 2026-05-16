import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";

mermaid.initialize({ startOnLoad: false });

const definition = document.getElementById("definition");
const execute = document.getElementById("execute");
const preview = document.getElementById("preview");
let renderRequestId = 0;

async function render() {
  const requestId = ++renderRequestId;
  const source = definition.value;

  try {
    await mermaid.parse(source, { suppressErrors: false });
    const { svg } = await mermaid.render(`mermaid-${crypto.randomUUID()}`, source);

    if (requestId !== renderRequestId) {
      return;
    }

    preview.textContent = "";
    preview.innerHTML = svg;
  } catch (error) {
    if (requestId !== renderRequestId) {
      return;
    }

    preview.innerHTML = "";
    preview.textContent = error instanceof Error ? error.message : String(error);
  }
}

execute.addEventListener("click", () => {
  void render();
});
