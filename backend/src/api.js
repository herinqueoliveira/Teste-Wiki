import { API_BASE } from "./config.js";

export async function apiListDocs() {
    const res = await fetch(`${API_BASE}/api/docs`);
    if (!res.ok) throw new Error(`Falha ao listar docs: ${res.status}`);
    const data = await res.json();
    // compatível se backend retornar array OU {items:[]}
    return Array.isArray(data) ? data : (data.items || []);
}

export async function apiGetDoc(id) {
    const res = await fetch(`${API_BASE}/api/docs/${id}`);
    if (!res.ok) throw new Error(`Falha ao buscar doc: ${res.status}`);
    return await res.json();
}

export async function apiCreateDoc(payload) {
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
        } catch { }
        throw new Error(msg);
    }

    return await res.json();
}

export async function apiDeleteDoc(id) {
    const res = await fetch(`${API_BASE}/api/docs/${id}`, { method: "DELETE" });
    if (!res.ok) {
        let msg = `Falha ao deletar doc: ${res.status}`;
        try {
            const err = await res.json();
            if (err?.error) msg = err.error;
        } catch { }
        throw new Error(msg);
    }
    return await res.json();
}
