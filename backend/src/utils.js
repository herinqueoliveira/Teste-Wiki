
  // Utils & Helpers //
export function typeFromFilename(name) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (ext === "md" || ext === "txt" || ext === "pdf" || ext === "docx") return ext;
    return "other";
}

export function titleFromFilename(name) {
    return (name || "Documento").replace(/\.[^/.]+$/, "");
}

export function formatBytes(bytes) {
    const b = Number(bytes);
    if (!Number.isFinite(b) || b < 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    let v = b;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
    }
    const digits = i === 0 ? 0 : (i === 1 ? 0 : 1);
    return `${v.toFixed(digits)} ${units[i]}`;
}

export function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR");
}

export function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}



// Markdown simples (sem lib)
export function markdownToHtml(md) {
    let s = String(md || "");

    // Escapa HTML
    s = escapeHtml(s);

    // Cabeçalhos
    s = s.replace(/^######\s?(.*)$/gm, "<h6>$1</h6>");
    s = s.replace(/^#####\s?(.*)$/gm, "<h5>$1</h5>");
    s = s.replace(/^####\s?(.*)$/gm, "<h4>$1</h4>");
    s = s.replace(/^###\s?(.*)$/gm, "<h3>$1</h3>");
    s = s.replace(/^##\s?(.*)$/gm, "<h2>$1</h2>");
    s = s.replace(/^#\s?(.*)$/gm, "<h1>$1</h1>");

    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Links [texto](url)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, `<a href="$2" target="_blank" rel="noopener">$1</a>`);

    // Listas simples
    s = s.replace(/^\s*-\s+(.*)$/gm, "<li>$1</li>");
    s = s.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);

    // Quebra de linha -> parágrafos
    const blocks = s.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    s = blocks.map(p => {
        if (p.startsWith("<h") || p.startsWith("<ul>")) return p;
        return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    }).join("\n");

    return `<div class="md">${s}</div>`;
}

export async function txtToHtml(text) {
    return `<pre class="txt">${escapeHtml(text)}</pre>`;
}

export async function docxToHtml(arrayBuffer) {
    if (!window.mammoth) {
        throw new Error("Biblioteca Mammoth não carregou (docx).");
    }
    const result = await window.mammoth.convertToHtml({ arrayBuffer });
    return `<div class="docx">${result.value}</div>`;
}

export async function pdfToHtml(arrayBuffer, opts = {}) {
    const { scale = 1.5, maxPages = Infinity, onProgress } = opts;

    if (!window.pdfjsLib) {
        throw new Error("Biblioteca pdf.js não carregou (pdf).");
    }

    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const total = pdf.numPages;
    if (Number.isFinite(maxPages) && total > maxPages) {
        throw new Error(`PDF com ${total} páginas excede o limite de ${maxPages}.`);
    }

    const parts = [];
    parts.push(`<div class="pdf">`);

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (typeof onProgress === "function") {
            onProgress({ page: pageNum, total: pdf.numPages });
        }

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataUrl = canvas.toDataURL("image/png");
        parts.push(`
      <div class="pdf-page">
        <div class="pdf-page-label">Página ${pageNum}</div>
        <img class="pdf-page-img" src="${dataUrl}" alt="Página ${pageNum}" />
      </div>
    `);
    }

    parts.push(`</div>`);
    return parts.join("\n");
}

export async function fileToHtml(file, opts = {}) {
    const ext = typeFromFilename(file.name);

    if (ext === "md") {
        const text = await file.text();
        return markdownToHtml(text);
    }

    if (ext === "txt") {
        const text = await file.text();
        return txtToHtml(text);
    }

    if (ext === "docx") {
        const ab = await file.arrayBuffer();
        return docxToHtml(ab);
    }

    if (ext === "pdf") {
        const ab = await file.arrayBuffer();
        return pdfToHtml(ab, opts.pdf || {});
    }

    // fallback: texto
    const text = await file.text();
    return txtToHtml(text);
}
