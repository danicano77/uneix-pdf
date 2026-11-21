import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';
import {
  createZip,
  formatBytes,
  mergeDocuments,
  parsePageRange,
  safeFilename,
  splitIntoPages,
} from './pdf';

describe('parsePageRange', () => {
  it('selects every page when the field is empty', () => {
    expect(parsePageRange('', 3)).toEqual([1, 2, 3]);
    expect(parsePageRange('totes', 2)).toEqual([1, 2]);
  });

  it('parses intervals, single pages and open-ended ranges', () => {
    expect(parsePageRange('1-3, 5, 8-', 10)).toEqual([1, 2, 3, 5, 8, 9, 10]);
    expect(parsePageRange('3,1', 4)).toEqual([3, 1]);
  });

  it('removes duplicated pages', () => {
    expect(parsePageRange('2, 2-3', 4)).toEqual([2, 3]);
  });

  it('rejects out-of-range and malformed input', () => {
    expect(() => parsePageRange('5', 3)).toThrow(/no existeix/);
    expect(() => parsePageRange('3-1', 5)).toThrow(/no és vàlid/);
    expect(() => parsePageRange('abc', 5)).toThrow(/No entenc/);
  });
});

describe('formatBytes', () => {
  it('formats sizes using Catalan decimals', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(1024 * 1024 * 2)).toBe('2 MB');
  });
});

describe('mergeDocuments', () => {
  it('copies the requested pages in order into one document', async () => {
    const first = await PDFDocument.create();
    first.addPage([100, 100]);
    first.addPage([200, 200]);

    const second = await PDFDocument.create();
    second.addPage([300, 300]);

    const bytes = await mergeDocuments(
      [
        { doc: await PDFDocument.load(await first.save()), pages: [2] },
        { doc: await PDFDocument.load(await second.save()), pages: [1, 1] },
      ],
      'prova.pdf',
    );

    const merged = await PDFDocument.load(bytes);
    expect(merged.getPageCount()).toBe(3);
    expect(merged.getTitle()).toBe('prova');
    expect(merged.getPage(0).getWidth()).toBe(200);
    expect(merged.getPage(1).getWidth()).toBe(300);
    expect(merged.getPage(2).getWidth()).toBe(300);
  });
});

describe('splitIntoPages', () => {
  it('creates one single-page PDF per selected page', async () => {
    const source = await PDFDocument.create();
    source.addPage([100, 100]);
    source.addPage([200, 200]);
    source.addPage([300, 300]);

    const files = await splitIntoPages(
      [{ doc: await PDFDocument.load(await source.save()), pages: [1, 3], name: 'origen.pdf' }],
      'document-unit',
    );

    expect(files.map((file) => file.name)).toEqual([
      'document-unit-pag-01.pdf',
      'document-unit-pag-03.pdf',
    ]);

    const first = await PDFDocument.load(files[0].bytes);
    const third = await PDFDocument.load(files[1].bytes);
    expect(first.getPageCount()).toBe(1);
    expect(first.getPage(0).getWidth()).toBe(100);
    expect(third.getPage(0).getWidth()).toBe(300);
  });

  it('uses each source name when several documents are split', async () => {
    const source = await PDFDocument.create();
    source.addPage([150, 150]);

    const files = await splitIntoPages(
      [
        { doc: await PDFDocument.load(await source.save()), pages: [1], name: 'a.pdf' },
        { doc: await PDFDocument.load(await source.save()), pages: [1], name: 'b.pdf' },
      ],
      'ignored',
    );

    expect(files.map((file) => file.name)).toEqual(['a-pag-01.pdf', 'b-pag-01.pdf']);
  });
});

describe('createZip', () => {
  it('packages every generated PDF with its filename', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    const files = await splitIntoPages(
      [{ doc: await PDFDocument.load(await doc.save()), pages: [1], name: 'origen.pdf' }],
      'prova',
    );

    const zip = await createZip(files);
    const entries = unzipSync(zip);
    expect(Object.keys(entries)).toEqual(['prova-pag-01.pdf']);
    expect((await PDFDocument.load(entries['prova-pag-01.pdf'])).getPageCount()).toBe(1);
  });
});

describe('safeFilename', () => {
  it('removes characters that are invalid in filenames', () => {
    expect(safeFilename('informe:Final?.pdf')).toBe('informe_Final');
    expect(safeFilename('   ')).toBe('document');
  });
});
