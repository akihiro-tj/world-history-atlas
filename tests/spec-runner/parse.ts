export type SpecRow = {
  label: string;
  states: string[];
  operations: string[];
  expects: string[];
  layer: string;
};
export type SpecTable = {
  heading: string;
  premise: string[];
  rows: SpecRow[];
};
export type SpecFeature = {
  name: string;
  file: string;
  tables: SpecTable[];
};

function splitCells(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function splitPhrases(cell: string): string[] {
  return cell
    .split('<br>')
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 0);
}

type RawTable = {
  heading: string;
  premise: string[];
  header: string[];
  rows: string[][];
};

function collectRawTables(markdown: string): {
  name: string;
  raws: RawTable[];
} {
  const lines = markdown.split('\n');
  const raws: RawTable[] = [];
  let name = '';
  let heading = '';
  let premise: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      name = (h1[1] ?? '').trim();
      continue;
    }
    const h2 = line.match(/^#{2,}\s+(.+)$/);
    if (h2) {
      heading = (h2[1] ?? '').trim();
      premise = [];
      continue;
    }
    const premiseMatch = line.match(/^前提:\s*(.+)$/);
    if (premiseMatch) {
      premise = splitPhrases(premiseMatch[1] ?? '');
      continue;
    }
    if (/^\|/.test(line) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? '')) {
      const header = splitCells(line);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && /^\|/.test(lines[j] ?? '')) {
        rows.push(splitCells(lines[j] ?? ''));
        j++;
      }
      raws.push({ heading, premise, header, rows });
      i = j - 1;
    }
  }
  return { name, raws };
}

export function parseSpec(markdown: string, file: string): SpecFeature {
  const { name, raws } = collectRawTables(markdown);

  const tables: SpecTable[] = [];
  for (const raw of raws) {
    const col = (header: string) => raw.header.indexOf(header);
    if (col('期待') < 0 || col('層') < 0) continue;

    const rows: SpecRow[] = raw.rows.map((cells) => ({
      label: col('観点') >= 0 ? (cells[col('観点')] ?? '') : '',
      states: col('状態') >= 0 ? splitPhrases(cells[col('状態')] ?? '') : [],
      operations:
        col('操作') >= 0 ? splitPhrases(cells[col('操作')] ?? '') : [],
      expects: splitPhrases(cells[col('期待')] ?? ''),
      layer: cells[col('層')] ?? '',
    }));

    tables.push({ heading: raw.heading, premise: raw.premise, rows });
  }

  return { name: name || file, file, tables };
}

export function rowPhrases(table: SpecTable, row: SpecRow): string[] {
  return [...table.premise, ...row.states, ...row.operations, ...row.expects];
}

export function rowLabel(row: SpecRow): string {
  return row.label;
}
