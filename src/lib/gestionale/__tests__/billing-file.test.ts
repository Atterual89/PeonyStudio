import { describe, expect, it } from "vitest";
import { mappedBillingRows, readBillingFile, suggestBillingColumns } from "../billing-file";

describe("importazione anagrafica fiscale",()=>{
  it("riconosce CSV italiano, virgolette e colonne fiscali non previste",async()=>{
    const file=new File([
      '\uFEFFNome;Cognome;Codice fiscale;Indirizzo;Email\n"Maria; Teresa";Rossi;RSSMRA;Via Roma 1;maria@example.test\nLuca;Bianchi;BNCLCA;;\n'
    ],"fatture.csv",{type:"text/csv"});
    const sheet=await readBillingFile(file);
    expect(sheet.headers).toEqual(["Nome","Cognome","Codice fiscale","Indirizzo","Email"]);
    expect(sheet.rows[0][0]).toBe("Maria; Teresa");
    const suggest=suggestBillingColumns(sheet.headers);
    expect(suggest).toEqual({first:"0",last:"1",email:"4"});
    const rows=mappedBillingRows(sheet,{first:0,last:1,email:4});
    expect(rows[0]).toMatchObject({
      first_name:"Maria; Teresa",last_name:"Rossi",email:"maria@example.test",
      fields:{"Codice fiscale":"RSSMRA","Indirizzo":"Via Roma 1",__billing_email:"maria@example.test"},
    });
    expect(rows[1].fields).not.toHaveProperty("Indirizzo");
  });
  it("richiede due colonne distinte per nome e cognome",async()=>{
    const sheet=await readBillingFile(new File(["Nome,Cognome\nMario,Rossi"],"test.csv"));
    expect(()=>mappedBillingRows(sheet,{first:0,last:0,email:null})).toThrow();
  });
  it("legge Excel xlsx senza schema fiscale rigido",async()=>{
    const ExcelJS=(await import("exceljs")).default;
    const book=new ExcelJS.Workbook();const sheet=book.addWorksheet("Clienti");
    sheet.addRow(["Cognome","Nome","Partita IVA","PEC"]);
    sheet.addRow(["Verdi","Giulia","IT01234567890","giulia@pec.test"]);
    const bytes=await book.xlsx.writeBuffer();
    const parsed=await readBillingFile(new File([Buffer.from(bytes)],"clienti.xlsx"));
    expect(parsed.rows[0]).toEqual(["Verdi","Giulia","IT01234567890","giulia@pec.test"]);
    expect(suggestBillingColumns(parsed.headers)).toMatchObject({first:"1",last:"0"});
  });
});
