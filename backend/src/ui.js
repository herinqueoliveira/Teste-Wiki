import { formatDate, formatBytes, escapeHtml } from "./utils.js";

const ICONS = {
    md: "📝",
    txt: "📄",
    pdf: "📕",
    docx: "📘",
    other: "📁",
};

// Elementos
const uploadsList = document.getElementById("uploadsList");
const menuEmpty = document.getElementById("menuEmpty");
const conteudo = document.getElementById("conteudo");


export function showToast(message, type = "info", durationMs = 3000) {
    const container = document.getElementById("toast-container");
    if (!container) return null;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerText = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, Math.max(500, durationMs));

    return toast;
}

export function updateToast(toastEl, message, type) {
    if (!toastEl) return;
    if (typeof message === "string") toastEl.innerText = message;
    if (type) toastEl.className = `toast toast-${type}`;
}

/* =========================
   Menu
========================= */
export function clearActiveMenu() {
    uploadsList?.querySelectorAll(".menu__item.active").forEach(el => el.classList.remove("active"));
}

export function markActiveMenu(id) {
    clearActiveMenu();
    const el = uploadsList?.querySelector(`.menu__item[data-id="${id}"]`);
    if (el) el.classList.add("active");
}

function buildMenuItem(row, onOpenDoc) {
    const item = document.createElement("div");
    item.className = "menu__item";
    item.dataset.id = String(row.id);

    const icon = ICONS[row.type] || ICONS.other;
    const updated = formatDate(row.updated_at) || formatDate(row.created_at);

    // tenta achar tamanho em diferentes formatos
    const sizeBytes = row.sizeBytes ?? row.size_bytes ?? row._sizeBytes;
    const sizeLabel = sizeBytes ? formatBytes(sizeBytes) : "";

    const parts = [];
    if (updated) parts.push(`Atualizado em ${updated}`);
    if (sizeLabel) parts.push(sizeLabel);

    const meta = parts.join(" • ");

    item.innerHTML = `
    <div class="item-top">
      <div class="icon">${icon}</div>
      <div class="texts">
        <div class="title">${escapeHtml(row.title || "Sem título")}</div>
        <div class="meta">${meta}</div>
      </div>
    </div>
  `;

    if (onOpenDoc) {
        item.addEventListener("click", () => onOpenDoc(row.id));
    }

    return item;
}

export function renderMenu(list, onOpenDoc) {
    if (!uploadsList) return;
    uploadsList.innerHTML = "";
    list.forEach(row => uploadsList.appendChild(buildMenuItem(row, onOpenDoc)));
}

export function setEmptyState(hasDocs) {
    if (!menuEmpty) return;
    menuEmpty.hidden = hasDocs;
}


export function renderWelcome() {
    if (!conteudo) return;
    conteudo.innerHTML = `
    <h1>Bem-vindo ao Wiki Serviços</h1>
    <p>Use o botão <strong>Anexar</strong> para enviar arquivos <code>.md</code>, <code>.txt</code>, <code>.pdf</code> ou <code>.docx</code>.</p>
    <p>Ao anexar, o conteúdo já fica pronto e formatado (com imagens). Nada de editar.</p>
    <p>Os arquivos ficam salvos no servidor local (Node.js + SQLite).</p>
  `;
}

export function renderDoc(doc) {
    if (!conteudo) return;

    let cleanHtml = doc.html || "";
    if (window.DOMPurify) {
        cleanHtml = window.DOMPurify.sanitize(cleanHtml);
    } else {
        console.warn("DOMPurify não encontrado. HTML não sanitizado.");
    }

    conteudo.innerHTML = `
    <div class="doc__container">
      <div class="doc__header">
        <h1 class="doc__title">${escapeHtml(doc.title || "Sem título")}</h1>
        <div class="doc__meta">Atualizado em ${escapeHtml(formatDate(doc.updated_at) || formatDate(doc.created_at) || "")}</div>
      </div>
      <div class="doc__body">
        ${cleanHtml}
      </div>
    </div>
  `;
}
