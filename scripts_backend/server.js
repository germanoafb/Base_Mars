// server.js
// Servidor do jogo em localhost (npm start).
// - Serve os arquivos estáticos (o motor do jogo roda todo no navegador).
// - Expõe POST /api/tts: gera a voz do Orbi com as vozes neurais do Edge
//   (msedge-tts) — grátis e sem chave de API — com cache em memória.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 8000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

// ---------- Voz natural do Orbi (Edge TTS: grátis, sem chave) ----------
const VOZ_PADRAO = "pt-BR-AntonioNeural";
const VOZ_VALIDA = /^(pt-BR|en-US)-[A-Za-z]{2,}Neural$/;
const TEXTO_MAX = 500;                     // limite de caracteres por requisição
const CACHE_MAX = 300;                     // frases guardadas em memória
const cacheTts = new Map();                // "voz|rate|pitch|texto" -> Buffer do MP3

// O texto entra no SSML: precisa escapar para não virar marcação.
function escaparXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

async function sintetizar(voz, texto, prosa) {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voz, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escaparXml(texto), prosa);
    const pedacos = [];
    await new Promise((resolve, reject) => {
      audioStream.on("data", (d) => pedacos.push(d));
      audioStream.on("end", resolve);
      audioStream.on("error", reject);
    });
    return Buffer.concat(pedacos);
  } finally {
    tts.close();
  }
}

async function gerarMp3({ text, voice, rate, pitch }) {
  const voz = VOZ_VALIDA.test(voice || "") ? voice : VOZ_PADRAO;
  const prosa = {};
  if (typeof rate === "number" && rate > 0.5 && rate <= 2) prosa.rate = rate;
  if (typeof pitch === "string" && /^[+-]\d{1,3}%$/.test(pitch)) prosa.pitch = pitch;

  const chave = [voz, prosa.rate ?? "", prosa.pitch ?? "", text].join("|");
  if (cacheTts.has(chave)) return cacheTts.get(chave);

  let mp3;
  try {
    mp3 = await sintetizar(voz, text, prosa);
  } catch (e) {
    if (voz === VOZ_PADRAO) throw e;
    mp3 = await sintetizar(VOZ_PADRAO, text, prosa);   // voz desconhecida: cai na padrão
  }

  if (cacheTts.size >= CACHE_MAX) cacheTts.delete(cacheTts.keys().next().value);
  cacheTts.set(chave, mp3);
  return mp3;
}

function lerCorpo(req, limite = 8 * 1024) {
  return new Promise((resolve, reject) => {
    let dados = "";
    req.on("data", (c) => {
      dados += c;
      if (dados.length > limite) { reject(new Error("corpo grande")); req.destroy(); }
    });
    req.on("end", () => resolve(dados));
    req.on("error", reject);
  });
}

async function responderTts(req, res) {
  try {
    const corpo = JSON.parse((await lerCorpo(req)) || "{}");
    const text = String(corpo.text || "").replace(/\s+/g, " ").trim().slice(0, TEXTO_MAX);
    if (!text) {
      res.writeHead(400, { "Content-Type": "application/json" }).end('{"erro":"texto vazio"}');
      return;
    }
    const mp3 = await gerarMp3({ text, voice: corpo.voice, rate: corpo.rate, pitch: corpo.pitch });
    res.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Content-Length": mp3.length,
      "Cache-Control": "no-store",
    }).end(mp3);
  } catch (e) {
    res.writeHead(502, { "Content-Type": "application/json" }).end('{"erro":"tts indisponivel"}');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);

    if (req.method === "POST" && urlPath === "/api/tts") {
      await responderTts(req, res);
      return;
    }

    let filePath = path.join(ROOT_DIR, urlPath);

    // Bloqueia acesso fora da pasta do projeto (ex.: /../../etc/passwd)
    if (filePath !== ROOT_DIR && !filePath.startsWith(ROOT_DIR + path.sep)) {
      res.writeHead(403).end("Proibido");
      return;
    }

    if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");

    const body = await readFile(filePath);
    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    // no-cache: o navegador sempre pega a versão nova dos arquivos (evita testar código velho)
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" }).end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Não encontrado");
  }
});

server.listen(PORT, () => {
  console.log(`Operação Ares rodando em http://localhost:${PORT}`);
});
