const express = require("express");
const cors = require("cors");
const path = require("path");
const { z } = require("zod");

const Database = require("better-sqlite3");

const app = express();

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || "wiki.db";

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

const db = new Database(DB_PATH);

// Otimizações para uso  web
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS docs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    type        TEXT NOT NULL,
    html        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
`);

function nowISO() {
  return new Date().toISOString();
}

// Schemas Zod
const DocSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  type: z.string().min(1, "Tipo é obrigatório"),
  html: z.string().min(1, "Conteúdo HTML obrigatório").max(500000, "Documento muito grande (max 500KB)")
});

// Listar documentos (com preview do HTML)
app.get("/api/docs", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, title, type, substr(html, 1, 300) AS previewHtml, created_at, updated_at
      FROM docs
      ORDER BY created_at DESC
    `).all();

    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar docs:", err);
    res.status(500).json({ error: "Erro interno ao listar documentos" });
  }
});

app.get("/api/docs/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const row = db.prepare(`SELECT * FROM docs WHERE id = ?`).get(id);
    if (!row) {
      return res.status(404).json({ error: "Documento não encontrado" });
    }

    res.json(row);
  } catch (err) {
    console.error("Erro ao buscar doc:", err);
    res.status(500).json({ error: "Erro interno ao buscar documento" });
  }
});

app.post("/api/docs", (req, res) => {
  try {
    const result = DocSchema.safeParse(req.body);

    if (!result.success) {
      const errorMsg = result.error.errors.map(e => e.message).join(", ");
      return res.status(400).json({ error: errorMsg });
    }

    const { title, type, html } = result.data;

    const now = nowISO();
    const info = db.prepare(`
      INSERT INTO docs (title, type, html, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(title, type, html, now, now);

    const newDoc = db.prepare(`SELECT * FROM docs WHERE id = ?`).get(info.lastInsertRowid);
    res.status(201).json(newDoc);
  } catch (err) {
    console.error("Erro ao criar doc:", err);
    res.status(500).json({ error: "Erro interno ao criar documento" });
  }
});

// Atualizar documento existente
app.put("/api/docs/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const existing = db.prepare(`SELECT * FROM docs WHERE id = ?`).get(id);
    if (!existing) {
      return res.status(404).json({ error: "Documento não encontrado" });
    }

    const title = req.body.title ?? existing.title;
    const type = req.body.type ?? existing.type;
    const html = req.body.html ?? existing.html;

    const result = DocSchema.safeParse({ title, type, html });

    if (!result.success) {
      const errorMsg = result.error.errors.map(e => e.message).join(", ");
      return res.status(400).json({ error: errorMsg });
    }

    const now = nowISO();

    db.prepare(`
      UPDATE docs
      SET title = ?, type = ?, html = ?, updated_at = ?
      WHERE id = ?
    `).run(title, type, html, now, id);

    const updated = db.prepare(`SELECT * FROM docs WHERE id = ?`).get(id);
    res.json(updated);
  } catch (err) {
    console.error("Erro ao atualizar doc:", err);
    res.status(500).json({ error: "Erro interno ao atualizar documento" });
  }
});

// Deletar documento
app.delete("/api/docs/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const info = db.prepare(`DELETE FROM docs WHERE id = ?`).run(id);

    if (info.changes === 0) {
      return res.status(404).json({ error: "Documento não encontrado" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao deletar doc:", err);
    res.status(500).json({ error: "Erro interno ao deletar documento" });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", time: nowISO() });
});

app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

app.listen(PORT, () => {
  console.log(`API da wiki rodando na porta ${PORT} usando DB em ${DB_PATH}`);
});
