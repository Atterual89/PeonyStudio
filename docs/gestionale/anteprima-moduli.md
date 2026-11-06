# Gestionale Workshop — Box di testo: anteprima a moduli per persona

Sostituisce l'anteprima della Fase 4e (gruppo 2: #6, #7, #8). Migrazione
`025_gw_anteprima_moduli.sql` (+ `.down.sql`, notify finale), non applicata.

- **In cima** solo il riassunto: "Ho trovato N iscrizioni e M pagamenti · K campi da completare". Niente campi comuni (data, incassato da, metodo e tipo per tutti), niente sezione "Da chiarire".
- **Una card per riga**: modulo precompilato con ciò che il parser ha capito (nome e partner, email, stato, quota, note, fattura) e sotto i pagamenti.
- **Ogni pagamento è un mini-modulo**: Importo · Tipo · Metodo · Data · Incassato da (predefinito Ale). Su telefono: Importo + Tipo, Metodo + Data, Incassato da; su schermi larghi una riga sola.
- **Obbligatori**: importo, tipo, metodo, data (e il nome). Quelli che il parser non ha trovato sono vuoti, con bordo evidenziato e "da completare" nel campo. Il testo non ha date: la data va sempre completata. Il tipo è vuoto quando era incerto (importo successivo al primo senza indicazioni). "Non so" per il metodo non c'è più.
- **Avvisi nella card**, vicino al campo, con risposte a un tocco: "Sembra già iscritta come «X»" (sotto il nome), stato del testo in conflitto con i pagamenti (sotto lo stato), "Cancellata senza pagamenti: non si importa" (Importa comunque / Non importare; senza risposta non si importa), fattura senza "ok", `X€/` pagamento o quota (sul primo pagamento).
- **Salva**: con campi mancanti diventa "Completa N campi" e porta al primo mancante; le card con campi mancanti hanno un segno in cima. Una card esclusa ("Includi" spento) o una cancellata non importata non conta.
- **Righe già presenti** ("Aggiorna l'iscrizione esistente"): i pagamenti già registrati in sola lettura e piccoli sopra; sotto, come mini-moduli, solo i pagamenti nuovi. Un pagamento del testo è "già registrato" se ha lo stesso importo (e lo stesso metodo, se indicato da entrambe le parti) di uno registrato, abbinati uno a uno: con due pagamenti da 200 € nel testo e uno registrato, il secondo resta nuovo. "Aggiungilo comunque" lo rimette tra i mini-moduli.
- **025**: `gw_import_roster` legge `received_by` di ogni pagamento (se manca vale quello comune, come prima).
