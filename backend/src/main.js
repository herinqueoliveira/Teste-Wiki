import * as api from "./api.js";
import * as ui from "./ui.js";
import { typeFromFilename, titleFromFilename, fileToHtml } from "./utils.js";

// Estado
let docs = [];
let activeId = null;

const MAX_FILE_SIZE_MB = 10; // limite por arquivo
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_PDF_PAGES = 25; // evita travar o browser e estourar o DB

// Elementos
const searchInput = document.getElementById("searchInput");
const docUpload = document.getElementById("docUpload");
const btnClear = document.getElementById("btnClear");

async function loadDocs() {
    try {
        docs = await api.apiListDocs();
        updateUI();
    } catch (err) {
        console.error(err);
        ui.showToast(err.message || "Erro ao listar documentos", "error");
    }
}

async function openDoc(id) {
    try {
        const doc = await api.apiGetDoc(id);
        activeId = doc.id;
        ui.renderDoc(doc);
        ui.markActiveMenu(activeId);
    } catch (err) {
        console.error(err);
        ui.showToast(err.message || "Erro ao abrir documento", "error");
    }
}

function updateUI() {
    const query = (searchInput?.value || "").trim().toLowerCase();

    const filtered = !query ? docs : docs.filter(d => {
        const t = (d.title || "").toLowerCase();
        const p = (d.previewHtml || "").toLowerCase();
        return t.includes(query) || p.includes(query);
    });

    ui.renderMenu(filtered, openDoc);
    ui.setEmptyState(filtered.length !== 0);

    if (activeId) ui.markActiveMenu(activeId);
}

async function handleFiles(files) {
    if (!files || files.length === 0) return;

    const attachLabel = document.querySelector('label[for="docUpload"]');
    const originalText = attachLabel?.textContent;
    if (attachLabel) attachLabel.textContent = "Anexando...";

    try {
        for (const file of files) {
            const type = typeFromFilename(file.name);

            // validação real de tipo
            if (type === "other") {
                ui.showToast(`Tipo de arquivo não suportado: ${file.name}`, "error", 5000);
                continue;
            }

            // limite real de tamanho
            if (file.size > MAX_FILE_SIZE_BYTES) {
                ui.showToast(
                    `Arquivo grande demais (${(file.size / (1024 * 1024)).toFixed(1)} MB). Limite: ${MAX_FILE_SIZE_MB} MB.`,
                    "error",
                    6000
                );
                continue;
            }

            const title = titleFromFilename(file.name);

            // Toast de progresso (principalmente para PDF/DOCX)
            const progressToast = ui.showToast(`Processando ${file.name}...`, "info", 120000);

            let html;
            try {
                const pdfOpts = (type === "pdf") ? {
                    scale: 1.5,
                    maxPages: MAX_PDF_PAGES,
                    onProgress: ({ page, total }) => ui.updateToast(
                        progressToast,
                        `Processando ${file.name} (página ${page}/${total})...`,
                        "info"
                    ),
                } : {};

                html = await fileToHtml(file, { pdf: pdfOpts });
            } catch (e) {
                ui.updateToast(progressToast, `Falha ao processar ${file.name}: ${e.message}`, "error");
                ui.showToast(`Falha ao processar ${file.name}: ${e.message}`, "error", 7000);
                continue;
            }

            // envia também tamanho/nome original (se seu backend ignorar, ok)
            const created = await api.apiCreateDoc({
                title,
                type,
                html,
                sizeBytes: file.size,
                originalName: file.name,
            });

            // se backend não devolver tamanho, mantém no client
            created.sizeBytes = created.sizeBytes ?? created.size_bytes ?? file.size;
            created._sizeBytes = file.size;

            docs.unshift(created);
            ui.updateToast(progressToast, `${file.name} anexado com sucesso.`, "success");
        }

        updateUI();

        // Abre o último criado
        if (docs[0]?.id) {
            await openDoc(docs[0].id);
        }

        ui.showToast("Documentos anexados com sucesso!", "success");

    } catch (err) {
        console.error(err);
        ui.showToast(err.message || "Erro ao anexar documentos", "error");
    } finally {
        if (attachLabel && originalText) attachLabel.textContent = originalText;
    }
}

async function clearAllDocs() {
    if (docs.length === 0) return;

    if (!confirm("Tem certeza que deseja apagar TODOS os documentos?")) return;

    const typed = prompt("Para confirmar, digite APAGAR");
    if ((typed || "").trim().toUpperCase() !== "APAGAR") {
        ui.showToast("Ação cancelada.", "info");
        return;
    }

    try {
        for (const d of docs) {
            await api.apiDeleteDoc(d.id);
        }
        docs = [];
        activeId = null;
        updateUI();
        ui.renderWelcome();
        ui.showToast("Todos os documentos foram apagados.", "success");
    } catch (err) {
        console.error(err);
        ui.showToast(err.message || "Erro ao limpar documentos", "error");
    }
}

function init() {
    ui.renderWelcome();
    loadDocs();

    searchInput?.addEventListener("input", updateUI);

    docUpload?.addEventListener("change", async (e) => {
        const files = Array.from(e.target.files || []);
        await handleFiles(files);
        e.target.value = "";
    });

    btnClear?.addEventListener("click", clearAllDocs);
}

init();
