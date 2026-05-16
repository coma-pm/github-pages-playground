import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";

mermaid.initialize({ startOnLoad: false });

const definition = document.getElementById("definition");
const execute = document.getElementById("execute");
const preview = document.getElementById("preview");
let renderRequestId = 0;

async function render() {
  const requestId = ++renderRequestId;

  try {
    const { svg } = await mermaid.render(`mermaid-${crypto.randomUUID()}`, definition.value);

    if (requestId !== renderRequestId) {
      return;
    }

    preview.innerHTML = svg;
  } catch (error) {
    if (requestId !== renderRequestId) {
      return;
    }

    preview.textContent = error instanceof Error ? error.message : String(error);
  }
}

execute.addEventListener("click", () => {
  void render();
});

void render();
