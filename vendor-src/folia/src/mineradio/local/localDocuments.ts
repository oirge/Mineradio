// src/mineradio/local/localDocuments.ts
// Header portals live in the parent document; both surfaces share keyboard and dismissal handling.
export function localDocuments(): Document[] {
    const documents = [document];
    try { if (window.parent.document !== document) documents.push(window.parent.document); } catch { /* Standalone preview. */ }
    return documents;
}
