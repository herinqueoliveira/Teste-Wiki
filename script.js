const API_BASE = "http://127.0.0.1:3000";

// DOM (conforme seu index.html)
const uploadsList = document.getElementById("uploadsList");
const menuEmpty = document.getElementById("menuEmpty");
const conteudo = document.getElementById("conteudo");
const searchInput = document.getElementById("searchInput");
const docUpload = document.getElementById("docUpload");
const btnClear = document.getElementById("btnClear");

// Estado
let docs = [];
let activeId = null;

// Ícones por tipo
const ICONS = {
  md: "📝",
  txt: "📄",
  pdf: "📕",
  docx: "📘",
  other: "📁",
};

function typeFromFilename(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "md" || ext === "txt" || ext === "pdf" || ext === "docx") return ext;
  return "other";
}

function titleFromFilename(name) {
  return (name || "Documento").replace(/\.[^/.]+$/, "");
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setEmptyState() {
  if (!menuEmpty) return;
  menuEmpty.hidden = docs.length !== 0;
}

/* =========================
   API
========================= */

async function apiListDocs() {
  const res = await fetch(`${API_BASE}/api/docs`);
  if (!res.ok) throw new Error(`Falha ao listar docs: ${res.status}`);
  const data = await res.json();
  // compatível se backend retornar array OU {items:[]}
  return Array.isArray(data) ? data : (data.items || []);
}

async function apiGetDoc(id) {
  const res = await fetch(`${API_BASE}/api/docs/${id}`);
  if (!res.ok) throw new Error(`Falha ao buscar doc: ${res.status}`);
  return await res.json();
}

async function apiCreateDoc(payload) {
  const res = await fetch(`${API_BASE}/api/docs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = `Falha ao criar doc: ${res.status}`;
    try {
      const err = await res.json();
      if (err?.error) msg = err.error;
    } catch {}
    throw new Error(msg);
  }

  return await res.json();
}

async function apiDeleteDoc(id) {
  const res = await fetch(`${API_BASE}/api/docs/${id}`, { method: "DELETE" });
  if (!res.ok) {
    let msg = `Falha ao deletar doc: ${res.status}`;
    try {
      const err = await res.json();
      if (err?.error) msg = err.error;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

/* =========================
   Render menu
========================= */

function clearActiveMenu() {
  uploadsList?.querySelectorAll(".menu__item.active").forEach(el => el.classList.remove("active"));
}

function markActiveMenu(id) {
  clearActiveMenu();
  const el = uploadsList?.querySelector(`.menu__item[data-id="${id}"]`);
  if (el) el.classList.add("active");
}

function buildMenuItem(row) {
  const item = document.createElement("div");
  item.className = "menu__item";
  item.dataset.id = String(row.id);

  const icon = ICONS[row.type] || ICONS.other;
  const updated = formatDate(row.updated_at) || formatDate(row.created_at);

  item.innerHTML = `
    <div class="item-top">
      <div class="icon">${icon}</div>
      <div class="texts">
        <div class="title">${escapeHtml(row.title || "Sem título")}</div>
        <div class="meta">${updated ? `Atualizado em ${updated}` : ""}</div>
      </div>
    </div>
  `;

  item.addEventListener("click", async () => {
    await openDoc(row.id);
  });

  return item;
}

function renderMenu(list) {
  if (!uploadsList) return;
  uploadsList.innerHTML = "";
  list.forEach(row => uploadsList.appendChild(buildMenuItem(row)));
}

/* =========================
   Abrir doc no conteúdo
========================= */

function renderWelcome() {
  conteudo.innerHTML = `
    <h1>Bem-vindo ao Wiki Serviços</h1>
    <p>Use o botão <strong>Anexar</strong> para enviar arquivos <code>.md</code>, <code>.txt</code>, <code>.pdf</code> ou <code>.docx</code>.</p>
    <p>Ao anexar, o conteúdo já fica pronto e formatado (com imagens). Nada de editar.</p>
    <p>Os arquivos ficam salvos no servidor local (Node.js + SQLite).</p>
  `;
}

async function openDoc(id) {
  try {
    const doc = await apiGetDoc(id);
    activeId = doc.id;
    markActiveMenu(activeId);

    // Exibe HTML salvo
    conteudo.innerHTML = `
      <div class="doc__container">
        <div class="doc__header">
          <h1 class="doc__title">${escapeHtml(doc.title || "Sem título")}</h1>
          <div class="doc__meta">Atualizado em ${escapeHtml(formatDate(doc.updated_at) || formatDate(doc.created_at) || "")}</div>
        </div>
        <div class="doc__body">
          ${doc.html || ""}
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    alert(err.message || "Erro ao abrir documento");
  }
}

/* =========================
   Conversores (Upload)
========================= */

// Markdown simples (sem lib) – dá para melhorar depois, mas já resolve.
function markdownToHtml(md) {
  let s = String(md || "");

  // Escapa HTML primeiro
  s = escapeHtml(s);

  // Cabeçalhos
  s = s.replace(/^######\s?(.*)$/gm, "<h6>$1</h6>");
  s = s.replace(/^#####\s?(.*)$/gm, "<h5>$1</h5>");
  s = s.replace(/^####\s?(.*)$/gm, "<h4>$1</h4>");
  s = s.replace(/^###\s?(.*)$/gm, "<h3>$1</h3>");
  s = s.replace(/^##\s?(.*)$/gm, "<h2>$1</h2>");
  s = s.replace(/^#\s?(.*)$/gm, "<h1>$1</h1>");

  // Negrito e itálico
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

async function txtToHtml(text) {
  return `<pre class="txt">${escapeHtml(text)}</pre>`;
}

async function docxToHtml(arrayBuffer) {
  if (!window.mammoth) {
    throw new Error("Biblioteca Mammoth não carregou (docx).");
  }
  const result = await window.mammoth.convertToHtml({ arrayBuffer });
  // result.value é HTML
  return `<div class="docx">${result.value}</div>`;
}

async function pdfToHtml(arrayBuffer) {
  if (!window.pdfjsLib) {
    throw new Error("Biblioteca pdf.js não carregou (pdf).");
  }

  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Renderiza páginas como imagens (mais “bonito” e fiel)
  const parts = [];
  parts.push(`<div class="pdf">`);

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });

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

async function fileToHtml(file) {
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
    return pdfToHtml(ab);
  }

  // fallback: texto
  const text = await file.text();
  return txtToHtml(text);
}

/* =========================
   Upload handler
========================= */

async function handleFiles(files) {
  if (!files || files.length === 0) return;

  // feedback simples
  const originalBtnText = document.querySelector('label[for="docUpload"]')?.textContent;
  const attachLabel = document.querySelector('label[for="docUpload"]');
  if (attachLabel) attachLabel.textContent = "Anexando...";

  try {
    for (const file of files) {
      const type = typeFromFilename(file.name);
      const title = titleFromFilename(file.name);
      const html = await fileToHtml(file);

      // cria doc
      const created = await apiCreateDoc({ title, type, html });

      // atualiza lista local
      docs.unshift(created);
    }

    // re-render menu e abre o último anexado
    renderMenu(applySearchFilter(docs, searchInput?.value || ""));
    setEmptyState();

    // abre o mais recente que acabou de entrar
    if (docs[0]?.id) {
      await openDoc(docs[0].id);
    }
  } catch (err) {
    console.error(err);
    alert(err.message || "Erro ao anexar documentos");
  } finally {
    if (attachLabel && originalBtnText) attachLabel.textContent = originalBtnText;
  }
}

/* =========================
   Busca
========================= */

function applySearchFilter(list, q) {
  const query = (q || "").trim().toLowerCase();
  if (!query) return list;

  return list.filter(d => {
    const t = (d.title || "").toLowerCase();
    const p = (d.previewHtml || "").toLowerCase();
    return t.includes(query) || p.includes(query);
  });
}

async function onSearchChange() {
  const q = searchInput?.value || "";
  const filtered = applySearchFilter(docs, q);
  renderMenu(filtered);
  setEmptyState();

  // Se tiver doc aberto, filtra também o conteúdo mostrando termo (opcional)
  // (mantive simples: não mexe no doc aberto)
}

/* =========================
   Limpar tudo
========================= */

async function clearAllDocs() {
  if (docs.length === 0) return;
  if (!confirm("Tem certeza que deseja apagar TODOS os documentos?")) return;

  try {
    // deleta um por um (seu backend não tem DELETE /api/docs)
    for (const d of docs) {
      await apiDeleteDoc(d.id);
    }
    docs = [];
    activeId = null;
    renderMenu(docs);
    setEmptyState();
    renderWelcome();
  } catch (err) {
    console.error(err);
    alert(err.message || "Erro ao limpar documentos");
  }
}

/* =========================
   Init
========================= */

async function init() {
  renderWelcome();

  try {
    docs = await apiListDocs();
    renderMenu(docs);
    setEmptyState();

    // abre primeiro doc automaticamente (opcional)
    // if (docs[0]?.id) await openDoc(docs[0].id);

  } catch (err) {
    console.error(err);
    alert("Não consegui conectar na API. Verifique se o server.js está rodando na mesma origem/porta.");
  }

  // Eventos
  searchInput?.addEventListener("input", onSearchChange);

  docUpload?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    await handleFiles(files);
    e.target.value = ""; // limpa input
  });

  btnClear?.addEventListener("click", clearAllDocs);
}

init();
