// Lettura locale lato server: nessun file originale viene conservato.
import "server-only";

export type BillingSheet = { headers: string[]; rows: string[][] };
const MAX_SIZE = 3 * 1024 * 1024;
const MAX_ROWS = 1000;
const MAX_COLS = 100;

function parseCsv(text: string): string[][] {
  const probe = text.slice(0, 4096);
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (let i = 0; i < probe.length; i++) {
    const ch = probe[i];
    if (ch === '"') { if (quoted && probe[i+1] === '"') i++; else quoted = !quoted; }
    else if (!quoted && ch in counts) counts[ch as keyof typeof counts]++;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
  }
  const delimiter = (Object.keys(counts) as (keyof typeof counts)[]).sort((a,b)=>counts[b]-counts[a])[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i+1] === '"') { cell += '"'; i++; }
      else if (!quoted && !cell.trim()) quoted = true;
      else if (quoted) quoted = false;
      else cell += ch;
    } else if (!quoted && ch === delimiter) {
      row.push(cell.trim()); cell = "";
    } else if (!quoted && (ch === "\r" || ch === "\n")) {
      if (ch === "\r" && text[i+1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) rows.push(row);
      if (rows.length > MAX_ROWS + 1) throw new Error("Il file supera 1000 nominativi.");
      row = [];
    } else cell += ch;
  }
  if (quoted) throw new Error("CSV non valido: virgolette non chiuse.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function fromGrid(grid: string[][]): BillingSheet {
  if (grid.length < 2) throw new Error("Il file deve contenere intestazioni e almeno una persona.");
  if (grid.length - 1 > MAX_ROWS) throw new Error("Importa al massimo 1000 persone per file.");
  if (grid[0].length > MAX_COLS) throw new Error("Troppe colonne nel file (massimo 100).");
  const seen = new Map<string,number>();
  const headers = grid[0].map((raw,i)=>{
    const base = raw.trim().slice(0,100) || "Colonna " + (i+1);
    const count = (seen.get(base) || 0)+1; seen.set(base,count);
    return count === 1 ? base : base + " (" + count + ")";
  });
  const rows = grid.slice(1).filter(row=>row.some(v=>v.trim())).map(row=>headers.map((_,i)=>(row[i]||"").trim().slice(0,500)));
  if (!rows.length) throw new Error("Nessuna riga con dati.");
  return { headers, rows };
}

export async function readBillingFile(file: File): Promise<BillingSheet> {
  if (!file || file.size === 0 || file.size > MAX_SIZE) throw new Error("Carica un file entro 5 MB.");
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "csv" || ext === "tsv") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text = new TextDecoder("utf-8").decode(bytes);
    if (text.includes("\uFFFD")) text = new TextDecoder("windows-1252").decode(bytes);
    return fromGrid(parseCsv(text.replace(/^\uFEFF/, "")));
  }
  if (ext === "xlsx") {
    const ExcelJS = (await import("exceljs")).default;
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as Parameters<typeof book.xlsx.load>[0]);
    const sheet = book.worksheets.find(w=>w.rowCount > 1);
    if (!sheet) throw new Error("Nessun foglio con dati.");
    const cols = Math.min(sheet.columnCount, MAX_COLS+1);
    if (cols > MAX_COLS) throw new Error("Troppe colonne nel file (massimo 100).");
    if (sheet.rowCount > MAX_ROWS + 1) throw new Error("Importa al massimo 1000 persone per file.");
    const grid: string[][] = [];
    for (let i = 1; i <= sheet.rowCount; i++) {
      const row: string[] = [];
      for (let j = 1; j <= cols; j++) row.push(String(sheet.getRow(i).getCell(j).text || "").trim());
      grid.push(row);
    }
    return fromGrid(grid);
  }
  throw new Error("Formato non supportato. Usa .xlsx o .csv.");
}

export function suggestBillingColumns(headers: string[]) {
  const norm = (s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const detect = (needles: string[])=> {
    const index=headers.findIndex(h=>needles.includes(norm(h)));
    return index < 0 ? "" : String(index);
  };
  return {
    first: detect(["nome","firstname","givenname"]),
    last: detect(["cognome","lastname","surname","familyname"]),
    email: detect(["email","emailfatturazione","emailcliente","mail","indirizzoemail"]),
  };
}

export function mappedBillingRows(sheet:BillingSheet, mapping:{ first:number; last:number; email:number | null }) {
  if (mapping.first < 0 || mapping.last < 0 || mapping.first === mapping.last ||
      mapping.first >= sheet.headers.length || mapping.last >= sheet.headers.length ||
      (mapping.email !== null && (mapping.email < 0 || mapping.email >= sheet.headers.length))) {
    throw new Error("Seleziona due colonne distinte per nome e cognome.");
  }
  return sheet.rows.map(row=>{
    const first_name=row[mapping.first]?.trim() || "";
    const last_name=row[mapping.last]?.trim() || "";
    const email=mapping.email===null?"":row[mapping.email]?.trim().toLowerCase() || "";
    const fields=Object.fromEntries(sheet.headers.flatMap((header,i)=>{
      const value=row[i]?.trim();
      return value ? [[header,value]] : [];
    }));
    if (email) fields.__billing_email=email;
    return {first_name,last_name,email,fields};
  });
}
