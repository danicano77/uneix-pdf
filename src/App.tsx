import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  downloadPdf,
  formatBytes,
  loadPdf,
  mergeDocuments,
  parsePageRange,
} from './pdf';
import type { PDFDocument } from 'pdf-lib';

interface PdfItem {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  range: string;
  doc: PDFDocument;
}

interface Plan {
  item: PdfItem;
  pages: number[];
  error?: string;
}

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'S’ha produït un error inesperat.';

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="10" width="15" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: up ? 'rotate(180deg)' : undefined }}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 7V4.5h6V7m3.5 0-.8 12a1.5 1.5 0 0 1-1.5 1.4H7.8A1.5 1.5 0 0 1 6.3 19L5.5 7" />
      <path d="M10 11v5.5M14 11v5.5" />
    </svg>
  );
}

function MergeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4h7l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M14 4v4h4M9 13h6M9 17h4" />
    </svg>
  );
}

export default function App() {
  const [items, setItems] = useState<PdfItem[]>([]);
  const [outputName, setOutputName] = useState('document-unit');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (!incoming.length) return;

    setError('');
    setNotice('');
    const loaded: PdfItem[] = [];
    const problems: string[] = [];

    for (const file of incoming) {
      try {
        const doc = await loadPdf(file);
        loaded.push({
          id: createId(),
          name: file.name,
          size: file.size,
          pageCount: doc.getPageCount(),
          range: '',
          doc,
        });
      } catch (cause) {
        problems.push(`${file.name}: ${errorMessage(cause)}`);
      }
    }

    if (loaded.length) setItems((previous) => [...previous, ...loaded]);
    if (problems.length) setError(problems.join('\n'));
  }, []);

  // Evita que el navegador obri el PDF si es deix anar fora de la zona de càrrega.
  useEffect(() => {
    const block = (event: globalThis.DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 7000);
    return () => clearTimeout(timer);
  }, [notice]);

  const plans = useMemo<Plan[]>(
    () =>
      items.map((item) => {
        try {
          return { item, pages: parsePageRange(item.range, item.pageCount) };
        } catch (cause) {
          return { item, pages: [], error: errorMessage(cause) };
        }
      }),
    [items],
  );

  const totalPages = plans.reduce((sum, plan) => sum + plan.pages.length, 0);
  const totalSize = items.reduce((sum, item) => sum + item.size, 0);
  const hasRangeError = plans.some((plan) => plan.error);

  const updateRange = (id: string, range: string) =>
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, range } : item)));

  const removeItem = (id: string) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
    setNotice('');
  };

  const moveItem = (id: string, direction: -1 | 1) =>
    setItems((previous) => {
      const from = previous.findIndex((item) => item.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= previous.length) return previous;
      const next = [...previous];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });

  const moveItemTo = (id: string, targetId: string) =>
    setItems((previous) => {
      if (id === targetId) return previous;
      const from = previous.findIndex((item) => item.id === id);
      if (from < 0) return previous;
      const next = [...previous];
      const [moved] = next.splice(from, 1);
      const to = next.findIndex((item) => item.id === targetId);
      if (to < 0) return previous;
      next.splice(to, 0, moved);
      return next;
    });

  const onDropzoneDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDropActive(false);
    void addFiles(event.dataTransfer.files);
  };

  const onFileDrop = (event: DragEvent<HTMLLIElement>, targetId: string) => {
    event.preventDefault();
    event.stopPropagation();

    // Si s'hi deixa anar un fitxer nou, l'afegim a la llista.
    if (event.dataTransfer.files.length) {
      void addFiles(event.dataTransfer.files);
      setDragId(null);
      setDropTargetId(null);
      return;
    }

    const sourceId = dragId ?? event.dataTransfer.getData('text/plain');
    if (sourceId) moveItemTo(sourceId, targetId);
    setDragId(null);
    setDropTargetId(null);
  };

  const handleMerge = async () => {
    if (!items.length || busy) return;
    setError('');
    setNotice('');

    if (hasRangeError) {
      setError('Revisa els rangs de pàgines marcats en vermell abans de continuar.');
      return;
    }

    const baseName = outputName.trim() || 'document-unit';
    const filename = `${baseName.replace(/\.pdf$/i, '')}.pdf`;

    setBusy(true);
    try {
      // Dona un cicle al navegador per mostrar l'estat de càrrega.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const bytes = await mergeDocuments(
        plans.map(({ item, pages }) => ({ doc: item.doc, pages })),
        baseName,
      );
      downloadPdf(bytes, filename);
      setNotice(`S’ha desat «${filename}» amb ${totalPages} ${totalPages === 1 ? 'pàgina' : 'pàgines'}.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          Uneix PDF
        </div>
        <span className="privacy">
          <LockIcon />
          <span>Privat: tot es fa al navegador</span>
        </span>
      </header>

      <section className="intro">
        <h1>Ajunta els teus PDF en un de sol</h1>
        <p>Afegeix tants fitxers com vulguis, canvia'n l'ordre si cal i descarrega el resultat.</p>
      </section>

      <label
        className={`dropzone${dropActive ? ' is-active' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setDropActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDropActive(false);
          }
        }}
        onDrop={onDropzoneDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <span className="drop-icon"><UploadIcon /></span>
        <strong>Arrossega els fitxers aquí</strong>
        <span>o <span className="link-like">selecciona'ls des del teu dispositiu</span></span>
        <span className="drop-hint">Admet diversos PDF alhora · Cap fitxer surt del teu equip</span>
      </label>

      {error && (
        <div className="alert alert-error" role="alert">
          <span className="alert-text">{error}</span>
          <button type="button" className="alert-close" onClick={() => setError('')} aria-label="Tanca l'avis">×</button>
        </div>
      )}

      {notice && (
        <div className="alert alert-ok" role="status">
          <span className="alert-text">{notice}</span>
          <button type="button" className="alert-close" onClick={() => setNotice('')} aria-label="Tanca l'avis">×</button>
        </div>
      )}

      {items.length > 0 ? (
        <section className="files-section">
          <div className="list-header">
            <h2>Fitxers <span className="badge">{items.length}</span></h2>
            <button type="button" className="ghost" onClick={() => { setItems([]); setNotice(''); }}>
              Neteja-ho tot
            </button>
          </div>

          <ol className="file-list">
            {plans.map((plan, index) => {
              const { item } = plan;
              return (
                <li
                  key={item.id}
                  className={`file-card${dropTargetId === item.id ? ' is-drop-target' : ''}${dragId === item.id ? ' is-dragging' : ''}`}
                  draggable
                  onDragStart={(event) => {
                    setDragId(item.id);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', item.id);
                  }}
                  onDragEnd={() => { setDragId(null); setDropTargetId(null); }}
                  onDragOver={(event) => {
                    if (dragId && dragId !== item.id) {
                      event.preventDefault();
                      setDropTargetId(item.id);
                    }
                  }}
                  onDragLeave={() => setDropTargetId((current) => (current === item.id ? null : current))}
                  onDrop={(event) => onFileDrop(event, item.id)}
                >
                  <span className="grip" title="Arrossega per reordenar"><GripIcon /></span>
                  <span className="position">{index + 1}</span>

                  <div className="file-body">
                    <div className="file-name" title={item.name}>{item.name}</div>
                    <div className="file-meta">
                      {item.pageCount} {item.pageCount === 1 ? 'pàgina' : 'pàgines'} · {formatBytes(item.size)}
                    </div>
                    <div className="range-row">
                      <label htmlFor={`range-${item.id}`}>Pàgines</label>
                      <input
                        id={`range-${item.id}`}
                        className={plan.error ? 'invalid' : ''}
                        value={item.range}
                        placeholder={`Totes (1-${item.pageCount})`}
                        spellCheck={false}
                        onChange={(event) => updateRange(item.id, event.target.value)}
                      />
                      {!plan.error && plan.pages.length > 0 && (
                        <span className="range-count">{plan.pages.length} sel.</span>
                      )}
                    </div>
                    {plan.error && <div className="range-error">{plan.error}</div>}
                  </div>

                  <div className="file-actions">
                    <button type="button" className="icon-button" onClick={() => moveItem(item.id, -1)} disabled={index === 0} aria-label="Mou cap amunt" title="Mou cap amunt">
                      <ChevronIcon up />
                    </button>
                    <button type="button" className="icon-button" onClick={() => moveItem(item.id, 1)} disabled={index === items.length - 1} aria-label="Mou cap avall" title="Mou cap avall">
                      <ChevronIcon up={false} />
                    </button>
                    <button type="button" className="icon-button danger" onClick={() => removeItem(item.id)} aria-label={`Elimina ${item.name}`} title="Elimina">
                      <TrashIcon />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="drag-tip">Consell: arrossega una targeta per canviar l'ordre dels fitxers.</p>
        </section>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">▤</span>
          <p>Encara no has afegit cap PDF. Les targetes dels fitxers apareixeran aquí.</p>
        </div>
      )}

      <footer className="actionbar">
        <div className="output-field">
          <label htmlFor="output-name">Nom del PDF final</label>
          <div className="name-input">
            <input
              id="output-name"
              value={outputName}
              spellCheck={false}
              onChange={(event) => setOutputName(event.target.value)}
            />
            <span>.pdf</span>
          </div>
        </div>

        <div className="action-side">
          <div className="summary">
            <strong>{totalPages}</strong> {totalPages === 1 ? 'pàgina' : 'pàgines'} · {formatBytes(totalSize)}
          </div>
          <button
            type="button"
            className="primary"
            disabled={!items.length || busy || hasRangeError}
            onClick={() => void handleMerge()}
          >
            {busy ? <span className="spinner" aria-hidden="true" /> : <MergeIcon />}
            {busy ? 'Unint…' : 'Uneix i desa'}
          </button>
        </div>
      </footer>
    </div>
  );
}
