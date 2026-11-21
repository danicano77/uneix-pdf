import type { PDFDocument } from 'pdf-lib';

export interface PageSelection {
  doc: PDFDocument;
  pages: number[];
}

export interface SplitSource extends PageSelection {
  name: string;
}

export interface OutputFile {
  name: string;
  bytes: Uint8Array;
}

const numberFormat = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 });

/** Mida llegible en català, p. ex. «1,2 MB». */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${numberFormat.format(kb)} KB`;
  return `${numberFormat.format(kb / 1024)} MB`;
}

/**
 * Converteix un rang com «1-3, 5, 8-» en una llista de números de pàgina (1-based).
 * Un camp buit o «totes» selecciona totes les pàgines.
 */
export function parsePageRange(input: string, pageCount: number): number[] {
  const value = input.trim().toLowerCase();
  if (!value || value === 'totes' || value === 'tots' || value === '*') {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const result: number[] = [];
  for (const rawPart of value.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;

    const interval = part.match(/^(\d+)\s*-\s*(\d*)$/);
    const single = part.match(/^\d+$/);

    if (interval) {
      const from = Number(interval[1]);
      const to = interval[2] ? Number(interval[2]) : pageCount;
      if (from < 1 || to > pageCount || from > to) {
        throw new Error(`El rang «${part}» no és vàlid per a ${pageCount} pàgines.`);
      }
      for (let page = from; page <= to; page++) result.push(page);
    } else if (single) {
      const page = Number(part);
      if (page < 1 || page > pageCount) {
        throw new Error(`La pàgina ${page} no existeix (n'hi ha ${pageCount}).`);
      }
      result.push(page);
    } else {
      throw new Error(`No entenc «${part}». Fes servir p. ex. 1-3, 5, 8-.`);
    }
  }

  if (!result.length) throw new Error('Selecciona almenys una pàgina.');
  return [...new Set(result)];
}

/** Carrega un fitxer PDF i retorna el document juntament amb el seu nom. */
export async function loadPdf(file: File): Promise<PDFDocument> {
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...header) !== '%PDF-') {
    throw new Error('No sembla un fitxer PDF.');
  }

  try {
    const { PDFDocument } = await import('pdf-lib');
    return await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/encrypt|password/i.test(message)) {
      throw new Error('El PDF està xifrat i no es pot obrir.');
    }
    throw new Error('Aquest PDF està malmès o no s’ha pogut llegir.');
  }
}

/** Copia les pàgines seleccionades de cada document en un de nou. */
export async function mergeDocuments(selections: PageSelection[], title: string): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const output = await PDFDocument.create();

  for (const { doc, pages } of selections) {
    const copied = await output.copyPages(doc, pages.map((page) => page - 1));
    copied.forEach((page) => output.addPage(page));
  }

  output.setTitle(title.replace(/\.pdf$/i, ''));
  output.setProducer('Uneix PDF');
  return output.save({ useObjectStreams: true });
}

/** Neteja un nom perquè sigui vàlid com a nom de fitxer. */
export function safeFilename(input: string): string {
  const cleaned = input
    .replace(/\.pdf$/i, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/[._ ]+$/g, '')
    .trim();
  return cleaned || 'document';
}

/**
 * Genera un PDF independent per a cada pàgina seleccionada.
 * Amb un sol document s'empra el nom base; amb diversos, el nom de cada fitxer.
 */
export async function splitIntoPages(sources: SplitSource[], baseName: string): Promise<OutputFile[]> {
  const { PDFDocument } = await import('pdf-lib');
  const files: OutputFile[] = [];
  const usedNames = new Set<string>();
  const singleSource = sources.length === 1;
  const allPages = sources.flatMap((source) => source.pages);
  const width = Math.max(2, String(allPages.length ? Math.max(...allPages) : 1).length);

  for (const source of sources) {
    const prefix = safeFilename(singleSource ? baseName : source.name);

    for (const page of source.pages) {
      const document = await PDFDocument.create();
      const [copied] = await document.copyPages(source.doc, [page - 1]);
      document.addPage(copied);
      document.setTitle(`${prefix} — pàgina ${page}`);
      document.setProducer('Uneix PDF');

      const bytes = await document.save({ useObjectStreams: true });
      const pageLabel = String(page).padStart(width, '0');
      let name = `${prefix}-pag-${pageLabel}.pdf`;
      let duplicate = 2;
      while (usedNames.has(name.toLowerCase())) {
        name = `${prefix}-pag-${pageLabel}-${duplicate++}.pdf`;
      }
      usedNames.add(name.toLowerCase());
      files.push({ name, bytes });
    }
  }

  return files;
}

/** Afegeix tots els PDF generats a un fitxer ZIP. */
export async function createZip(files: OutputFile[]): Promise<Uint8Array> {
  const { zipSync } = await import('fflate');
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) entries[file.name] = file.bytes;
  return zipSync(entries, { level: 0 });
}

/** Desa qualsevol fitxer generat al dispositiu. */
export function downloadBytes(bytes: Uint8Array, filename: string, mime: string): void {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Desa un PDF resultant. */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  downloadBytes(
    bytes,
    filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`,
    'application/pdf',
  );
}
