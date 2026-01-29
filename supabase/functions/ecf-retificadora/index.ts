import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
import JSZip from "https://esm.sh/jszip@3.10.1"

type AjustePeriodo = {
  exercicio: number
  metodo: "ANUAL" | "TRIMESTRAL"
  periodo: "ANUAL" | "1T" | "2T" | "3T" | "4T"
  perdaGeradaNoPeriodo: number
  novaBaseIRPJ: number
  novoIRPJ15: number
  novoIRPJAdicional: number
  novaBaseCSLL: number
  novaCSLLTotal: number
}

type Payload = {
  empresaId: string
  arquivos: { exercicio: number; filePath: string }[]
  ajustes: AjustePeriodo[]
  codAjusteIRPJ: string
  codAjusteCSLL: string
  descricaoAjuste: string
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
}

const formatNumber = (n: number, sep: "." | ",") => {
  if (!Number.isFinite(n)) n = 0;
  const s = n.toFixed(2);
  return sep === "." ? s : s.replace(/\./g, ",");
};

function detectDecimalSeparator(lines: string[]): "." | "," {
  for (const ln of lines) {
    if (!ln.startsWith("|")) continue;
    const parts = ln.split("|");
    if (["N630", "N670", "M300", "M350"].includes(parts[1])) {
      const cand = parts[4] || "";
      if (cand.includes(",")) return ",";
      if (/\d\.\d/.test(cand)) return ".";
    }
  }
  return ",";
}

function extractPeriodFromFields(fields: string[]): string | null {
  for (let i = 2; i < Math.min(fields.length, 8); i++) {
    const token = (fields[i] || "").toUpperCase();
    if (token === "ANUAL" || /^([1-4])T$/.test(token)) return token;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as Payload;
    console.log("Payload recebido:", JSON.stringify(payload));

    const { empresaId, arquivos, ajustes, codAjusteIRPJ, codAjusteCSLL, descricaoAjuste } = payload;
    if (!arquivos || arquivos.length === 0) throw new Error("A lista de arquivos está vazia.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const zip = new JSZip();
    let filesInZip = 0;

    for (const arq of arquivos) {
      console.log(`Iniciando processamento do ano: ${arq.exercicio}`);
      
      const { data: fileData, error: dlErr } = await supabaseAdmin.storage
        .from("ecf-uploads")
        .download(arq.filePath);

      if (dlErr) {
        console.error(`Erro ao baixar arquivo ${arq.filePath}:`, dlErr);
        continue;
      }

      const fileContent = await fileData.text();
      const lines = fileContent.split(/\r?\n/);
      
      // Filtro robusto: garante que comparamos números com números
      const ajustesDoAno = ajustes.filter((a: any) => Number(a.exercicio) === Number(arq.exercicio));

      if (ajustesDoAno.length === 0) {
        console.warn(`Nenhum ajuste encontrado para o ano ${arq.exercicio}. Pulando.`);
        continue;
      }

      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split("|");
        const reg = parts[1];
        if (reg === "M010") {
          const p = extractPeriodFromFields(parts);
          if (p) curM = { p, s: i };
        } else if (reg === "M990" && curM) {
          mRanges.set(curM.p, { start: curM.s, end: i });
        } else if (reg === "N030") {
          const p = extractPeriodFromFields(parts);
          if (p) curN = { p, s: i };
        } else if (reg === "N990" && curN) {
          nRanges.set(curN.p, { start: curN.s, end: i });
        }
      }

      for (const aj of ajustesDoAno) {
        const pKey = aj.periodo.toUpperCase();
        const nR = nRanges.get(pKey);
        if (nR) {
          for (let i = nR.start; i <= nR.end; i++) {
            const p = lines[i].split("|");
            if (p[1] === "N630") {
              if (p[2] === "1") p[4] = formatNumber(aj.novaBaseIRPJ, sep);
              if (p[2] === "3") p[4] = formatNumber(aj.novoIRPJ15, sep);
              if (p[2] === "4") p[4] = formatNumber(aj.novoIRPJAdicional, sep);
              lines[i] = p.join("|");
            } else if (p[1] === "N670") {
              if (p[2] === "1") p[4] = formatNumber(aj.novaBaseCSLL, sep);
              if (p[2] === "2") p[4] = formatNumber(aj.novaCSLLTotal, sep);
              lines[i] = p.join("|");
            }
          }
        }

        const mR = mRanges.get(pKey);
        if (mR) {
          const m410 = `|M410|${payload.codAjusteIRPJ}|${payload.descricaoAjuste}|${formatNumber(aj.perdaGeradaNoPeriodo, sep)}|`;
          const m510 = `|M510|${payload.codAjusteCSLL}|${payload.descricaoAjuste}|${formatNumber(aj.perdaGeradaNoPeriodo, sep)}|`;
          let insIdx = mR.end;
          for (let k = mR.start; k <= mR.end; k++) {
            if (lines[k].startsWith("|M415|")) { insIdx = k; break; }
          }
          lines.splice(insIdx, 0, m410, m510);
          mRanges.forEach(v => { if (v.start > insIdx) { v.start += 2; v.end += 2; } });
          nRanges.forEach(v => { if (v.start > insIdx) { v.start += 2; v.end += 2; } });
        }
      }

      let c0 = 0, cM = 0, c9 = 0, total = 0;
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i].trim();
        if (!ln.startsWith("|")) continue;
        total++;
        const reg = ln.substring(1, 5);
        if (reg.startsWith("0")) c0++;
        if (reg.startsWith("M")) cM++;
        if (reg.startsWith("9")) c9++;
        if (reg === "0990") lines[i] = `|0990|${c0}|`;
        if (reg === "M990") lines[i] = `|M990|${cM}|`;
        if (reg === "9990") lines[i] = `|9990|${c9}|`;
        if (reg === "9999") {
          lines[i] = `|9999|${total}|`;
          lines.length = i + 1;
          break;
        }
      }
      
      zip.file(`${arq.exercicio}-RETIFICADORA.txt`, lines.join("\r\n") + "\r\n");
      filesInZip++;
    }

    if (filesInZip === 0) {
      throw new Error("O processamento terminou, mas nenhum arquivo foi adicionado ao ZIP. Verifique se os anos dos ajustes coincidem com os anos dos arquivos.");
    }

    const zipContent = await zip.generateAsync({ 
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    console.log(`ZIP concluído: ${filesInZip} arquivos, ${zipContent.length} bytes.`);

    return new Response(zipContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="ECF_RETIFICADORAS.zip"`,
        "Content-Length": zipContent.length.toString(),
      },
    });

  } catch (err: any) {
    console.error("ERRO NA FUNÇÃO:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, // Retornamos 400 para erros de validação/dados
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});