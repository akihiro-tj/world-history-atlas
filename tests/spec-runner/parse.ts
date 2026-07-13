export type AxisValue = { value: string; phrases: string[] };
export type SpecRow = {
  id: string;
  label: string;
  axisValues: Map<string, string>;
  states: string[];
  operations: string[];
  expects: string[];
  layer: string;
  note: string;
  precondition: string[];
};
export type SpecTable = {
  heading: string;
  mode: 'matrix' | 'step';
  axisColumns: { name: string; header: string }[];
  premise: string[];
  rows: SpecRow[];
};
export type SpecFeature = {
  name: string;
  file: string;
  axes: Map<string, AxisValue[]>;
  tables: SpecTable[];
};

// Warning: full-width parens（）— must match the header convention in specs
const AXIS_HEADER = /^(?:状態|操作)（(.+)）$/;

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
    const h1 = lines[i].match(/^#\s+(.+)$/);
    if (h1) {
      name = h1[1].trim();
      continue;
    }
    const h2 = lines[i].match(/^#{2,}\s+(.+)$/);
    if (h2) {
      heading = h2[1].trim();
      premise = [];
      continue;
    }
    const premiseMatch = lines[i].match(/^前提:\s*(.+)$/);
    if (premiseMatch) {
      premise = splitPhrases(premiseMatch[1]);
      continue;
    }
    if (/^\|/.test(lines[i]) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? '')) {
      const header = splitCells(lines[i]);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && /^\|/.test(lines[j])) {
        rows.push(splitCells(lines[j]));
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

  const axes = new Map<string, AxisValue[]>();
  for (const raw of raws.filter((raw) => raw.heading === '軸')) {
    const axisIdx = raw.header.indexOf('軸');
    const valueIdx = raw.header.indexOf('値');
    const phraseIdx = raw.header.indexOf('フレーズ');
    for (const row of raw.rows) {
      const axis = row[axisIdx];
      if (!axes.has(axis)) axes.set(axis, []);
      axes.get(axis)?.push({
        value: row[valueIdx],
        phrases: phraseIdx >= 0 ? splitPhrases(row[phraseIdx] ?? '') : [],
      });
    }
  }

  const tables: SpecTable[] = [];
  for (const raw of raws) {
    if (raw.heading === '軸') continue;
    const col = (header: string) => raw.header.indexOf(header);
    if (col('期待') < 0 || col('層') < 0) continue;

    const axisColumns: { name: string; header: string }[] = [];
    for (const header of raw.header) {
      const matched = header.match(AXIS_HEADER);
      if (matched && axes.has(matched[1])) {
        axisColumns.push({ name: matched[1], header });
      }
    }
    const mode: 'matrix' | 'step' = axisColumns.length > 0 ? 'matrix' : 'step';

    const rows: SpecRow[] = raw.rows.map((cells) => {
      const rawNote = cells[col('備考')] ?? '';
      const preMatch = rawNote.match(/^前置き:\s*(.+)$/);
      return {
        id: cells[col('#')] ?? '',
        label: col('観点') >= 0 ? (cells[col('観点')] ?? '') : '',
        axisValues: new Map(
          axisColumns.map(({ name, header }) => [
            name,
            cells[col(header)] ?? '',
          ]),
        ),
        states: col('状態') >= 0 ? splitPhrases(cells[col('状態')] ?? '') : [],
        operations:
          col('操作') >= 0 ? splitPhrases(cells[col('操作')] ?? '') : [],
        expects: splitPhrases(cells[col('期待')] ?? ''),
        layer: cells[col('層')] ?? '',
        note: preMatch ? '' : rawNote,
        precondition: preMatch ? splitPhrases(preMatch[1]) : [],
      };
    });

    tables.push({
      heading: raw.heading,
      mode,
      axisColumns,
      premise: raw.premise,
      rows,
    });
  }

  return { name: name || file, file, axes, tables };
}

export function rowPhrases(
  feature: SpecFeature,
  table: SpecTable,
  row: SpecRow,
): string[] {
  const phrases = [...table.premise, ...row.precondition];
  if (table.mode === 'matrix') {
    for (const { name } of table.axisColumns) {
      const value = row.axisValues.get(name) ?? '';
      const entry = feature.axes.get(name)?.find((v) => v.value === value);
      phrases.push(...(entry?.phrases ?? []));
    }
  } else {
    phrases.push(...row.states, ...row.operations);
  }
  phrases.push(...row.expects);
  return phrases;
}

export function rowLabel(table: SpecTable, row: SpecRow): string {
  if (table.mode === 'matrix') {
    return table.axisColumns
      .map(({ name }) => row.axisValues.get(name) ?? '')
      .join(' × ');
  }
  return row.label;
}
