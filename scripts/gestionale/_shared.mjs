// Funzioni comuni agli script del gestionale.
// Uso: node --env-file=.env.local scripts/gestionale/<script>.mjs

import { createClient } from "@supabase/supabase-js";

export function createDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    exit(
      "Variabili NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY mancanti.\n" +
        "Lancia lo script con: node --env-file=.env.local scripts/gestionale/<script>.mjs",
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function exit(message, code = 1) {
  console.error(message);
  process.exit(code);
}

export function normalizeName(name) {
  return String(name ?? "").trim().toLowerCase();
}

export function nameFromArgs() {
  const name = process.argv.slice(2).join(" ").trim();
  if (!name) exit("Indica il nome dell'operatore, ad esempio: Laura");
  return name;
}

/**
 * Chiede un valore senza mostrarlo a schermo (né salvarlo nella cronologia
 * della shell). Funziona in PowerShell e nel Prompt dei comandi.
 */
export function promptHidden(question) {
  const { stdin, stdout } = process;

  if (!stdin.isTTY) {
    exit(
      "Serve un terminale interattivo per inserire il PIN in modo nascosto.\n" +
        "Usa PowerShell o il Prompt dei comandi (in Git Bash: winpty node ...).",
    );
  }

  return new Promise((resolve) => {
    let value = "";
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    function finish() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
      resolve(value);
    }

    function onData(chunk) {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          finish();
          return;
        }
        if (char === "\u0003") {
          stdin.setRawMode(false);
          stdout.write("\n");
          process.exit(130);
        }
        if (char === "\u0008" || char === "\u007f") {
          value = value.slice(0, -1);
        } else if (/^\d$/.test(char)) {
          value += char;
        }
      }
    }

    stdin.on("data", onData);
  });
}
