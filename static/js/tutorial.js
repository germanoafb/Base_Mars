// Tutorial do jogo, guiado pelo ORBI: um robozinho do Controle da Missão.
//
// O Orbi fala com a criança (voz do próprio aparelho) e ensina o jogo em 7 passos,
// cada um com uma mini-atividade que usa as MESMAS peças do jogo de verdade
// (energia, os 4 sistemas, cartas de decisão, escudo, meta).
//
// Onde mexer:
//   - Textos (PT e EN): i18n.js, chaves que começam com "tut"
//   - Visual: static/styles/tutorial.css
//   - Números: vêm de CONFIG (static/js/game/outpost.js), nada é copiado aqui
//
// A voz usa a Web Speech API (speechSynthesis). O navegador só deixa falar depois de um
// toque, por isso o tutorial começa com o botão "Ouvir o Orbi". Se o aparelho não tiver
// voz, o Orbi "fala" com bipes de robô e o texto continua na tela.
//
// Abre sozinho na primeira visita e pelo botão "?" do topo (window.TUTORIAL.abrir()).

(function () {
  "use strict";

  const I = window.I18N;
  if (!I) return;
  const { t, idiomaAtual, mudarIdioma } = I;

  // Números do jogo (com valores de reserva, caso as regras não tenham carregado)
  const J = window.ARES && window.ARES.jogo;
  const C = (J && J.CONFIG) || {
    energiaPorTurno: 8, bateriaMax: 6, maxPorSistema: 4, metaCiencia: 30,
    inicio: { o2: 70, comida: 70 }, consumo: { o2: 18, comida: 13 }, producao: { o2: 8, comida: 6 },
    viagem: { turnos: 6, diasPorTurno: 30 }, base: { sois: 10 },
    escudo: { tempestade: 0.22 }, doseTempestade: { X: 40, M: 12 },
  };

  const CHAVE_VISTO = "ares_tutorial_visto";
  // true  = o tutorial abre SEMPRE que a página carrega, antes do jogo (dá para "Pular").
  // false = abre só na primeira visita de cada navegador (e pelo botão "?").
  const SEMPRE_ABRIR = true;
  const TREINO = 6;                                  // pontos de energia do treino (passo 4)
  const ESCUDO_PONTOS = 3;                           // pontos no escudo do passo 6
  const DOSE_X = C.doseTempestade.X;                 // mSv de uma tempestade forte sem escudo
  const DOSE_COM_ESCUDO = Math.round(DOSE_X * (1 - ESCUDO_PONTOS * C.escudo.tempestade));
  const reduzMovimento = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Ajudantes ----------
  const esc = (s) => String(s ?? "").replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ico = (id, cls = "ico") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

  // Desenha pixel art a partir de linhas de texto (cada letra é uma cor)
  function pixels(linhas, cores, cls) {
    const rects = [];
    linhas.forEach((linha, y) => {
      for (let x = 0; x < linha.length; x++) {
        const c = cores[linha[x]];
        if (c) rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`);
      }
    });
    return `<svg class="${cls}" viewBox="0 0 ${linhas[0].length} ${linhas.length}" shape-rendering="crispEdges" aria-hidden="true">${rects.join("")}</svg>`;
  }

  const TERRA = pixels([
    "...bbbb...", "..bbggbb..", ".bgggbbbb.", "bbggbbbbbb", "bbgbbbbggb",
    "bbbbbbgggb", "bbbbbbbggb", ".bbbggbbb.", "..bbggbb..", "...bbbb...",
  ], { b: "#3f8cff", g: "#6be37a" }, "tut-planeta");

  const MARTE = pixels([
    "...rrrr...", "..rrrrrr..", ".rrdddrrr.", "rrrddrrrrr", "rrrrrrrddr",
    "rrrrrrrddr", "rrdrrrrrrr", ".rrrrrrrr.", "..rrrrrr..", "...rrrr...",
  ], { r: "#e8673c", d: "#b8432a" }, "tut-planeta");

  // ---------- O ORBI em pixel art (20×23 quadradinhos) ----------
  // Estados do rosto (data-humor): feliz | normal | surpreso | piscar
  // Quando fala, a classe .orbi--falando faz a boca abrir e fechar (CSS).
  function orbiSvg() {
    const COR = { c: "#2a2f45", p: "#e6edf7", s: "#a9b8d0", v: "#141a33", t: "#2ee6c8", y: "#ffd24a", r: "#ff8fa3", q: "#ff7a59", z: "#5b6aa0" };
    const r = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${COR[c]}"/>`;
    const g = (cls, itens) => `<g class="${cls}">${itens.join("")}</g>`;
    const cabecaContorno = [[6, 3, 8], [4, 4, 12], [3, 5, 14], [2, 6, 16], [2, 7, 16], [2, 8, 16], [2, 9, 16], [2, 10, 16], [3, 11, 14], [4, 12, 12]];
    const cabecaMiolo = [[6, 4, 8], [4, 5, 12], [3, 6, 14], [3, 7, 14], [3, 8, 14], [3, 9, 14], [3, 10, 14], [4, 11, 12]];
    const partes = [
      g("o-antena", [r(9, 0, 2, 1, "y"), r(8, 1, 4, 1, "y")]),
      r(9, 2, 2, 1, "c"),
      // cabeça
      ...cabecaContorno.map(([x, y, w]) => r(x, y, w, 1, "c")),
      ...cabecaMiolo.map(([x, y, w]) => r(x, y, w, 1, "p")),
      r(4, 11, 12, 1, "s"), r(16, 6, 1, 5, "s"),
      // fones de ouvido nas laterais
      r(0, 6, 2, 4, "t"), r(18, 6, 2, 4, "t"),
      // viseira escura
      r(5, 6, 10, 1, "v"), r(4, 7, 12, 2, "v"), r(5, 7, 1, 1, "z"),
      // olhos
      g("o-olhos o-olhos--normal", [r(6, 7, 2, 2, "t"), r(12, 7, 2, 2, "t")]),
      g("o-olhos o-olhos--feliz", [r(5, 8, 1, 1, "t"), r(6, 7, 2, 1, "t"), r(8, 8, 1, 1, "t"), r(11, 8, 1, 1, "t"), r(12, 7, 2, 1, "t"), r(14, 8, 1, 1, "t")]),
      g("o-olhos o-olhos--surpreso", [r(6, 6, 2, 3, "t"), r(12, 6, 2, 3, "t")]),
      g("o-olhos o-olhos--piscar", [r(5, 8, 3, 1, "t"), r(12, 8, 3, 1, "t")]),
      // bochechas e boca
      r(4, 10, 1, 1, "r"), r(15, 10, 1, 1, "r"),
      g("o-boca o-boca--fechada", [r(8, 10, 4, 1, "c")]),
      g("o-boca o-boca--aberta", [r(8, 10, 4, 2, "c"), r(9, 11, 2, 1, "r")]),
      // pescoço e corpo
      r(8, 13, 4, 1, "c"),
      r(5, 14, 10, 1, "c"), r(4, 15, 12, 4, "c"), r(5, 19, 10, 1, "c"),
      r(5, 15, 10, 4, "p"), r(5, 18, 10, 1, "s"),
      r(7, 16, 6, 2, "v"), r(8, 16, 1, 1, "t"), r(10, 16, 1, 1, "y"), r(11, 16, 1, 1, "r"),
      // braço esquerdo (parado) e direito (acena)
      r(1, 14, 4, 6, "c"), r(2, 15, 2, 4, "p"), r(2, 19, 2, 1, "y"),
      g("o-braco", [r(15, 14, 4, 6, "c"), r(16, 15, 2, 4, "p"), r(16, 19, 2, 1, "y")]),
      // propulsores com chama
      r(6, 20, 3, 1, "c"), r(11, 20, 3, 1, "c"),
      g("o-chama", [r(7, 21, 1, 1, "q"), r(12, 21, 1, 1, "q")]),
      g("o-chama o-chama--grande", [r(7, 21, 1, 2, "y"), r(12, 21, 1, 2, "y")]),
    ];
    return `<svg class="orbi-svg" viewBox="0 0 20 23" shape-rendering="crispEdges" aria-hidden="true">${partes.join("")}</svg>`;
  }

  // ---------- Sons do Orbi (bipes) ----------
  let ctx = null;
  function audio() {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) { ctx = null; }
    return ctx;
  }

  function tom(freq, t0, dur, tipo, vol) {
    const c = audio();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = tipo || "square";
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol || 0.05, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const efeitosLigados = () => !(window.SOM && window.SOM.estaMudo && window.SOM.estaMudo());

  const SFX = {
    // "bi-bi-biip" quando o Orbi aparece em cada passo
    chamar() { if (!efeitosLigados()) return; const c = audio(); if (!c) return; const n = c.currentTime + 0.02; [660, 880, 1320].forEach((f, i) => tom(f, n + i * 0.07, 0.09, "square", 0.04)); },
    toque(i = 0) { if (!efeitosLigados()) return; const c = audio(); if (!c) return; tom(392 * Math.pow(1.122, i), c.currentTime + 0.01, 0.1, "square", 0.05); },
    acerto() { if (!efeitosLigados()) return; const c = audio(); if (!c) return; const n = c.currentTime + 0.02; [523, 659, 784, 1047].forEach((f, i) => tom(f, n + i * 0.09, 0.14, "triangle", 0.07)); },
    escolha() { if (!efeitosLigados()) return; const c = audio(); if (!c) return; const n = c.currentTime + 0.01; tom(523, n, 0.08, "square", 0.05); tom(784, n + 0.08, 0.12, "square", 0.05); },
  };

  // ---------- A VOZ do Orbi ----------
  // Ajustes: tom (pitch, 1 = normal) e velocidade (rate, 1 = normal).
  // Um tom um pouco acima do normal deixa a voz mais alegre e "de robô simpático";
  // exagerar (acima de ~1.3) vira voz de esquilo e soa estranho.
  // Obs.: algumas vozes (ex.: Google no Chrome) ignoram o tom; aí vale mais a escolha da voz.
  const VOZ = {
    pt: { rate: 1.15, pitch: 1.18, volume: 1 },
    en: { rate: 1.15, pitch: 1.18, volume: 1 },
  };
  const CHAVE_VOZ = "ares_orbi_voz_";

  // ---------- Voz natural via API (Edge TTS, grátis e sem chave) ----------
  // O backend expõe POST /api/tts e devolve um MP3. Se a API falhar,
  // o Orbi volta para as vozes do próprio navegador (Web Speech API).
  const API_TTS = "/api/tts";
  const VOZES_API = {
    pt: ["pt-BR-AntonioNeural", "pt-BR-ThalitaMultilingualNeural", "pt-BR-FranciscaNeural"],
    en: ["en-US-AvaNeural", "en-US-JennyNeural", "en-US-AriaNeural", "en-US-EmmaNeural"],
  };
  let apiFalhouEm = 0;                               // quando a API falhou (não trava para sempre)
  const API_ESPERA = 8000;                           // ms de castigo antes de tentar a API de novo
  const apiIndisponivel = () => Date.now() - apiFalhouEm < API_ESPERA;
  let audioAtual = null;                             // <audio> da fala em andamento
  const audiosNaMemoria = new Map();                 // "voz|texto" -> URL do MP3 (evita baixar de novo)

  const sintese = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window ? window.speechSynthesis : null;
  let vozLigada = true;
  let falaId = 0;
  let timersBipe = [];
  let falasAtivas = [];                              // guarda as falas (senão o navegador pode "esquecer" no meio)
  let aoFalar = () => {};                            // liga/desliga a boca do Orbi

  if (sintese) {
    sintese.getVoices();                             // alguns navegadores só carregam as vozes depois do primeiro pedido
    if (sintese.addEventListener) sintese.addEventListener("voiceschanged", () => { if (raiz && passo >= 0) atualizarRodape(); });
  }

  const guardarVoz = (chave, v) => { try { localStorage.setItem(chave, v); } catch (e) { /* ok */ } };
  const lerVoz = (chave) => { try { return localStorage.getItem(chave); } catch (e) { return null; } };

  // Nota de cada voz: as "naturais/neurais" (Edge, Google, Apple) soam muito mais humanas.
  // As vozes antigas do sistema (as robóticas) ficam por último.
  function pontuarVoz(v, en) {
    const n = v.name.toLowerCase();
    let p = 0;
    if (/natural|neural/.test(n)) p += 80;
    if (/online/.test(n)) p += 30;
    if (/google/.test(n)) p += 50;
    if (/premium|enhanced|siri/.test(n)) p += 40;
    if (/francisca|thalita/.test(n)) p += 30;      // Edge "Natural": as mais gostosas de ouvir
    if (/luciana|fernanda/.test(n)) p += 15;       // Apple (iPhone/Mac)
    if ((en ? /^en[-_]us/i : /^pt[-_]br/i).test(v.lang)) p += 25;
    if (/francisca|thalita|luciana|fernanda|vit[oó]ria|camila|joana|maria|helena|giovanna|leila|raquel|samantha|aria|jenny|ava|zira|susan|emma|olivia|nora|zoe|allison|karen|moira|female/.test(n)) p += 25;
    if (/antonio|daniel|felipe|ricardo|jorge|david|mark|guy|ryan|male/.test(n) && !/female/.test(n)) p -= 15;
    if (/espeak|festival|compact|novelty|bad news|bahh|bells|boing|bubbles|cellos|zarvox|trinoids|whisper|wobble|organ|deranged|hysterical|albert|fred|junior|ralph|good news|jester|superstar/.test(n)) p -= 100;
    return p;
  }

  function listaDeVozes() {
    if (!sintese) return [];
    const en = idiomaAtual() === "en";
    const lista = sintese.getVoices().filter((v) => (en ? /^en/i : /^pt/i).test(v.lang));
    return lista.map((v) => ({ v, nota: pontuarVoz(v, en) })).sort((a, b) => b.nota - a.nota).map((x) => x.v);
  }

  function escolherVoz() {
    const lista = listaDeVozes();
    if (!lista.length) return null;
    const salva = lerVoz(CHAVE_VOZ + idiomaAtual());
    return lista.find((v) => v.voiceURI === salva) || lista[0];
  }

  // Botão "VOZ": passa para a próxima voz disponível e fala uma amostra.
  // Com a API ligada, alterna entre as vozes neurais do Edge (mais bonitas).
  function escolherVozApi() {
    const lista = VOZES_API[idiomaAtual()] || VOZES_API.pt;
    const salva = lerVoz(CHAVE_VOZ + idiomaAtual() + "_api");
    return lista.includes(salva) ? salva : lista[0];
  }

  function trocarVozApi() {
    const lista = VOZES_API[idiomaAtual()] || VOZES_API.pt;
    const i = lista.indexOf(escolherVozApi());
    guardarVoz(CHAVE_VOZ + idiomaAtual() + "_api", lista[(i + 1) % lista.length]);
  }

  function trocarVoz() {
    if (!apiIndisponivel()) { trocarVozApi(); falar(t("tut_voz_amostra")); return; }
    const lista = listaDeVozes().slice(0, 6);
    if (lista.length < 2) return;
    const atual = escolherVoz();
    const i = lista.findIndex((v) => atual && v.voiceURI === atual.voiceURI);
    guardarVoz(CHAVE_VOZ + idiomaAtual(), lista[(i + 1) % lista.length].voiceURI);
    falar(t("tut_voz_amostra"));
  }

  // Só mostra o botão de trocar voz se houver mais de uma opção disponível.
  function temComoTrocarVoz() {
    if (!apiIndisponivel()) return (VOZES_API[idiomaAtual()] || []).length > 1;
    return listaDeVozes().length > 1;
  }

  function pararFala() {
    falaId++;
    timersBipe.forEach(clearTimeout);
    timersBipe = [];
    falasAtivas = [];
    if (audioAtual) { try { audioAtual.pause(); } catch (e) { /* ok */ } audioAtual = null; }
    try { if (sintese) sintese.cancel(); } catch (e) { /* ok */ }
    aoFalar(false);
  }

  // Sem voz no aparelho: o Orbi "fala" com piupius fofos (uma notinha a cada sílaba)
  function balbuciar(texto, id) {
    const c = audio();
    const silabas = Math.max(4, Math.round(texto.length / 3));
    if (c) {
      const NOTAS = [523, 587, 659, 784, 880];                              // escala alegre (pentatônica)
      const n = c.currentTime + 0.05;
      for (let i = 0; i < silabas; i++) {
        const f = NOTAS[(i * 3 + (i % 4)) % NOTAS.length] * (i % 9 === 0 ? 1.5 : 1);
        const t0 = n + i * 0.11;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = i % 2 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(f * 0.9, t0);
        osc.frequency.exponentialRampToValueAtTime(f * 1.12, t0 + 0.08);     // "piu" subindo
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.045, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
        osc.connect(g); g.connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + 0.12);
      }
    }
    timersBipe.push(setTimeout(() => { if (id === falaId) aoFalar(false); }, silabas * 110 + 200));
  }

  function inicializarVoz() {
    if (!sintese) return false;
    try {
      sintese.resume && sintese.resume();
      return true;
    } catch (e) {
      return false;
    }
  }

  function prepararTexto(texto, emPt) {
    let s = String(texto || "");
    s = s.replace(/<[^>]*>/g, " ");                                         // etiquetas HTML (<b>, </b>...)
    s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, " e ");                 // entidades soltas
    s = s.replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, " ");        // emojis
    s = s.replace(/[✦★☆•·»«→←↑↓♪✕✓]/g, " ");                                // símbolos soltos
    if (emPt) {
      s = s.replace(/O₂|O2/g, "oxigênio").replace(/mSv/g, "milisieverts")
           .replace(/(\d+)\s?%/g, "$1 por cento").replace(/(\d+)h(\d+)min/g, "$1 horas e $2 minutos");
    } else {
      s = s.replace(/O₂|O2/g, "oxygen").replace(/mSv/g, "millisieverts")
           .replace(/(\d+)\s?%/g, "$1 percent").replace(/(\d+)h(\d+)min/g, "$1 hours and $2 minutes");
    }
    s = s.replace(/\s+([.,;:!?…])/g, "$1").replace(/([!?.])\1+/g, "$1").replace(/\s+/g, " ").trim();
    return s;
  }

  // Fala pela API: baixa o MP3 de cada frase (com cache) e toca em sequência.
  function buscarAudio(texto, voz, cfg) {
    const chave = voz + "|" + texto;
    if (audiosNaMemoria.has(chave)) return Promise.resolve(audiosNaMemoria.get(chave));
    return fetch(API_TTS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: texto,
        voice: voz,
        rate: cfg.rate,
        pitch: "+" + Math.round((cfg.pitch - 1) * 100) + "%",
      }),
    }).then((r) => {
      if (!r.ok) throw new Error("tts " + r.status);
      return r.blob();
    }).then((b) => {
      const url = URL.createObjectURL(b);
      audiosNaMemoria.set(chave, url);
      return url;
    });
  }

  function tocarMp3(url) {
    return new Promise((resolve, reject) => {
      const a = new Audio(url);
      audioAtual = a;
      a.onended = () => resolve();
      a.onpause = () => resolve();                   // pararFala() pausa o áudio: encerra a espera
      a.onerror = () => reject(new Error("audio"));
      a.play().catch(reject);
    });
  }

  async function falarComApi(blocos, id, cfg) {
    const voz = escolherVozApi();
    let tocou = false;
    try {
      for (const f of blocos) {
        if (id !== falaId) return;
        // Entonação: frases com "!" e "?" ganham um tom um pouquinho mais animado.
        const fim = f.slice(-1);
        const prosa = {
          rate: cfg.rate + (fim === "!" ? 0.03 : 0),
          pitch: cfg.pitch + (fim === "!" ? 0.04 : fim === "?" ? 0.06 : 0),
        };
        const url = await buscarAudio(f, voz, prosa);
        if (id !== falaId) return;
        await tocarMp3(url);
        if (!tocou) console.info("[Orbi] voz natural da API:", voz);
        tocou = true;
      }
      if (id === falaId) aoFalar(false);
    } catch (e) {
      if (tocou) { if (id === falaId) aoFalar(false); return; }   // já falou algo: não repete
      throw e;                                                     // nada tocou: deixa o navegador tentar
    }
  }

  // Fala pelas vozes do navegador (Web Speech API) — plano B.
  function falarComSintese(limpo, frases, id, cfg) {
    if (!sintese || !inicializarVoz()) { balbuciar(limpo, id); return; }
    const emPt = idiomaAtual() !== "en";
    const v = escolherVoz();
    let comecou = false;
    let restantes = frases.length;
    const terminou = () => { if (id !== falaId) return; restantes -= 1; if (restantes <= 0) aoFalar(false); };

    falasAtivas = frases.map((f) => {
      const u = new SpeechSynthesisUtterance(f);
      u.lang = emPt ? "pt-BR" : "en-US";
      if (v) { try { u.voice = v; u.lang = v.lang; } catch (e) { /* voz estranha: usa a padrão do idioma */ } }
      const fim = f.slice(-1);
      const animado = fim === "!" ? 1 : 0;
      const pergunta = fim === "?" ? 1 : 0;
      // Entonação: variação bem discreta. Exagero no tom é o que mais deixa a voz "estranha".
      u.pitch = Math.max(0.5, Math.min(2, cfg.pitch + animado * 0.04 + pergunta * 0.07 + (Math.random() - 0.5) * 0.04));
      u.rate = cfg.rate + animado * 0.03;
      u.volume = cfg.volume;
      u.onstart = () => { comecou = true; };
      u.onend = terminou;
      u.onerror = terminou;
      return u;
    });
    timersBipe.push(setTimeout(() => { if (id === falaId) falasAtivas.forEach((u) => sintese.speak(u)); }, 80));

    // Se o aparelho não começou a falar em 5 segundos, usa os piupius do Orbi
    // (vozes online podem demorar um pouco para a primeira frase)
    timersBipe.push(setTimeout(() => {
      if (id !== falaId || comecou) return;
      try { sintese.cancel(); } catch (e) { /* ok */ }
      const novo = ++falaId;
      aoFalar(true);
      balbuciar(limpo, novo);
    }, 5000));
  }

  // A API sintetiza o texto inteiro de uma vez. Mandar uma frase por arquivo
  // deixava uma pausa audível (e um novo download) a cada ponto final.
  const LIMITE_API = 450;                            // o backend corta em 500 caracteres
  function blocosDaApi(texto, frases) {
    if (texto.length <= LIMITE_API) return [texto];
    const blocos = [];
    let atual = "";
    for (const f of frases) {
      if (atual && (atual + " " + f).length > LIMITE_API) { blocos.push(atual); atual = f; }
      else atual = atual ? atual + " " + f : f;
    }
    if (atual) blocos.push(atual);
    return blocos;
  }

  // Vai gerando o MP3 antes da hora: a síntese demora 1-2s, então o áudio do
  // passo seguinte (e o de boas-vindas) já fica pronto e a voz começa na hora.
  function preaquecer(texto) {
    if (!texto || !vozLigada || apiIndisponivel()) return;
    const emPt = idiomaAtual() !== "en";
    const limpo = prepararTexto(texto, emPt) || String(texto || "");
    if (!limpo) return;
    const cfg = emPt ? VOZ.pt : VOZ.en;
    const frases = (limpo.match(/[^.!?…]+[.!?…]*/g) || [limpo]).map((s) => s.trim()).filter(Boolean);
    const voz = escolherVozApi();
    blocosDaApi(limpo, frases).forEach((f) => {
      const fim = f.slice(-1);
      // Mesmos ajustes usados na fala — assim o áudio é reaproveitado do cache.
      buscarAudio(f, voz, {
        rate: cfg.rate + (fim === "!" ? 0.03 : 0),
        pitch: cfg.pitch + (fim === "!" ? 0.04 : fim === "?" ? 0.06 : 0),
      }).catch(() => { /* sem problema: a fala normal tenta de novo */ });
    });
  }

  function falar(texto) {
    pararFala();
    if (!vozLigada) return;                          // o botão de voz do tutorial manda (o ♪ do jogo só define o começo)
    const id = falaId;
    aoFalar(true);
    const emPt = idiomaAtual() !== "en";
    const limpo = prepararTexto(texto, emPt) || String(texto || "");
    const cfg = emPt ? VOZ.pt : VOZ.en;
    // Frases curtas: o navegador corta falas longas (vale só para as vozes do navegador).
    const frases = (limpo.match(/[^.!?…]+[.!?…]*/g) || [limpo]).map((s) => s.trim()).filter(Boolean);
    const blocos = blocosDaApi(limpo, frases);

    if (!apiIndisponivel()) {
      falarComApi(blocos, id, cfg).catch((e) => {
        if (id !== falaId) return;
        if (e && e.name === "NotAllowedError") {
          // O Chrome só libera áudio depois de um clique na página. Isso NÃO é culpa
          // da API: na próxima fala ela é tentada de novo.
          console.warn("[Orbi] o navegador bloqueou o áudio (autoplay). Clique na página e fale de novo.");
        } else {
          apiFalhouEm = Date.now();                  // backend fora do ar: tenta de novo mais tarde
          console.warn("[Orbi] API de voz falhou, usando a voz do navegador:", e && e.message);
        }
        falarComSintese(limpo, frases, id, cfg);
      });
      return;
    }
    falarComSintese(limpo, frases, id, cfg);
  }

  // ---------- Estado do tutorial ----------
  let raiz = null;                                   // o elemento do tutorial (null = fechado)
  let passo = -1;                                    // -1 = tela de boas-vindas
  let feitos = new Set();                            // passos com a tarefa cumprida
  let est = {};                                      // estado da mini-atividade do passo atual
  let digitando = null;
  let focoAnterior = null;
  const ESCONDER = ["header.topo", "#app", "footer.rodape", ".pular"];

  function visto() { try { return localStorage.getItem(CHAVE_VISTO) === "1"; } catch (e) { return false; } }
  function marcarVisto() { try { localStorage.setItem(CHAVE_VISTO, "1"); } catch (e) { /* ok */ } }

  // ---------- Os 7 passos ----------
  const P = (id) => raiz.querySelector(id);
  const palco = () => P(".tut-palco");

  function chipEfeito(icone, nomeChave, n, bom) {
    return `<span class="efeito efeito--${bom ? "bom" : "ruim"}">${ico(icone)}<span class="sr-only">${t(nomeChave)}</span> ${n > 0 ? "+" : "−"}${Math.abs(n)}</span>`;
  }

  function chipsDaOpcao(tipo, id) {
    const ef = (window.ARES && window.ARES.eventos && window.ARES.eventos.efeitoDe(tipo, id)) || {};
    const itens = [];
    if (ef.o2) itens.push(chipEfeito("i-o2", "oxigenio", ef.o2, ef.o2 > 0));
    if (ef.consumoO2) itens.push(chipEfeito("i-o2", "oxigenio", -ef.consumoO2, ef.consumoO2 < 0));
    if (ef.energia) itens.push(chipEfeito("i-energy", "energia", ef.energia, ef.energia > 0));
    return itens.join("") || `<span class="efeito efeito--neutro">${t("efeito_nenhum")}</span>`;
  }

  const SISTEMAS = [
    { k: "o2", icone: "i-o2", cls: "aloc--o2", nome: "oxigenio", fala: "tut3_o2" },
    { k: "food", icone: "i-food", cls: "aloc--comida", nome: "comida", fala: "tut3_food" },
    { k: "shield", icone: "i-shield", cls: "aloc--escudo", nome: "escudo", fala: "tut3_shield" },
    { k: "comms", icone: "i-comms", cls: "aloc--comms", nome: "radio", fala: "tut3_comms" },
  ];

  const PASSOS = [
    // 1. Boas-vindas e missão
    {
      titulo: "tut1_titulo",
      texto: () => t("tut1_texto"),
      humor: "feliz",
      palco() {
        const tripulacao = (window.ARES && window.ARES.tela && window.ARES.tela.TRIPULACAO) || [];
        const rosto = window.ARES && window.ARES.tela && window.ARES.tela.rosto;
        const rostos = rosto ? tripulacao.map((p) => `
          <li class="rosto" style="--traje:${p.traje}">${rosto(p, "feliz")}<span class="rosto-nome">${esc(p.nome)}</span></li>`).join("") : "";
        return `
          <div class="tut-viagem">
            <div class="tut-ponta">${TERRA}<span>${t("terra")}</span></div>
            <div class="tut-trilha" aria-hidden="true"><span class="tut-nave">${ico("i-ship", "ico tut-nave-ico")}</span></div>
            <div class="tut-ponta">${MARTE}<span>${t("marte")}</span></div>
          </div>
          <ul class="tut-crew">${rostos}</ul>`;
      },
    },

    // 2. Energia: toque no Sol (tarefa)
    {
      titulo: "tut2_titulo",
      texto: () => t("tut2_texto", { energia: C.energiaPorTurno }),
      humor: "normal",
      requer: true,
      iniciar() { est = { n: 0 }; },
      palco() {
        const raios = Array.from({ length: C.energiaPorTurno }, (_, i) => `<span class="tut-raio-caixa">${ico("i-energy", "ico tut-raio")}</span>`).join("");
        return `
          <div class="tut-energia">
            <button class="tut-sol" type="button" data-tx="sol" aria-label="${esc(t("tut2_sol_aria"))}">
              ${ico("i-sol", "ico tut-sol-ico")}
              <span class="tut-toque">${t("tut_toque")}</span>
            </button>
            <div class="tut-energia-lado">
              <div class="tut-raios" role="img" aria-label="${esc(t("tut2_contagem", { n: 0, total: C.energiaPorTurno }))}">${raios}</div>
              <p class="tut-contagem" role="status">${t("tut2_contagem", { n: 0, total: C.energiaPorTurno })}</p>
              <p class="tut-bateria">${ico("i-battery")} ${t("tut2_bateria", { n: C.bateriaMax })}</p>
            </div>
          </div>`;
      },
      aoClicar(el) {
        if (!el.closest('[data-tx="sol"]') || est.n >= C.energiaPorTurno) return;
        est.n++;
        const raios = palco().querySelectorAll(".tut-raio-caixa");
        raios[est.n - 1].classList.add("on");
        const aria = t("tut2_contagem", { n: est.n, total: C.energiaPorTurno });
        palco().querySelector(".tut-contagem").textContent = aria;
        palco().querySelector(".tut-raios").setAttribute("aria-label", aria);
        SFX.toque(est.n);
        if (est.n >= C.energiaPorTurno) {
          palco().querySelector(".tut-sol").disabled = true;
          concluir(t("tut2_feito", { bateria: C.bateriaMax }));
        }
      },
    },

    // 3. Os 4 sistemas: toque em cada um (tarefa)
    {
      titulo: "tut3_titulo",
      texto: () => t("tut3_texto"),
      humor: "normal",
      requer: true,
      iniciar() { est = { vistos: new Set() }; },
      palco() {
        const botoes = SISTEMAS.map((s) => `
          <li><button class="tut-sis ${s.cls}" type="button" data-tx="sis" data-k="${s.k}">
            ${ico(s.icone, "ico tut-sis-ico")}
            <span class="tut-sis-nome">${t(s.nome)}</span>
            <span class="tut-sis-ok" aria-hidden="true">${ico("i-ok")}</span>
            <span class="sr-only tut-sis-sr"></span>
          </button></li>`).join("");
        return `<ul class="tut-sistemas">${botoes}</ul>`;
      },
      aoClicar(el) {
        const b = el.closest('[data-tx="sis"]');
        if (!b) return;
        const s = SISTEMAS.find((x) => x.k === b.dataset.k);
        est.vistos.add(s.k);
        b.classList.add("tut-sis--visto");
        b.querySelector(".tut-sis-sr").textContent = t("tut3_ouvido");
        SFX.toque(est.vistos.size);
        if (est.vistos.size >= SISTEMAS.length) {
          concluir(t("tut3_feito"));
        } else {
          dizer(t(s.fala));
        }
      },
    },

    // 4. Treino: divida a energia (tarefa)
    {
      titulo: "tut4_titulo",
      texto: () => t("tut4_texto", { n: TREINO }),
      humor: "normal",
      requer: true,
      iniciar() { est = { aloc: { o2: 1, food: 1, shield: 0, comms: 0 }, falouFim: "" }; },
      palco() { return treinoHtml(); },
      aoClicar(el) {
        const b = el.closest('[data-tx="adj"]');
        if (!b || b.disabled) return;
        const k = b.dataset.k;
        const d = Number(b.dataset.d);
        const livre = TREINO - somaTreino();
        const novo = est.aloc[k] + d;
        if (novo < 0 || novo > C.maxPorSistema || (d > 0 && livre <= 0)) return;
        est.aloc[k] = novo;
        SFX.toque(d > 0 ? 3 : 1);
        palco().innerHTML = treinoHtml();
        const alvo = palco().querySelector(`[data-tx="adj"][data-k="${k}"][data-d="${d}"]:not(:disabled)`)
          || palco().querySelector(`[data-k="${k}"]:not(:disabled)`);
        if (alvo) alvo.focus({ preventScroll: true });
        if (TREINO - somaTreino() === 0) {
          const prev = previsaoTreino();
          const cai = prev.o2 < C.inicio.o2 || prev.comida < C.inicio.comida;
          const chave = cai ? "tut4_cai" : "tut4_seguro";
          if (est.falouFim !== chave) { est.falouFim = chave; concluir(t(chave)); }
        }
      },
    },

    // 5. Carta de decisão: escolha uma opção (tarefa)
    {
      titulo: "tut5_titulo",
      texto: () => t("tut5_texto"),
      humor: "surpreso",
      requer: true,
      iniciar() { est = { escolha: null }; },
      palco() {
        const opcoes = ["limpar_paineis", "esperar_base"].map((id) => `
          <button class="btn-escolha" type="button" data-tx="op" data-id="${id}">
            <span class="escolha-texto">${t("op_" + id)}</span>
            <span class="escolha-efeitos">${chipsDaOpcao("poeira", id)}</span>
          </button>`).join("");
        return `
          <div class="evento evento--poeira tut-carta" role="group" aria-labelledby="tut-ev-titulo">
            ${ico("i-dust")}
            <div class="evento-corpo">
              <h3 class="evento-titulo" id="tut-ev-titulo">${t("ev_poeira_titulo")}</h3>
              <p>${t("ev_poeira_texto")}</p>
              <div class="escolhas">${opcoes}</div>
            </div>
          </div>`;
      },
      aoClicar(el) {
        const b = el.closest('[data-tx="op"]');
        if (!b) return;
        palco().querySelectorAll('[data-tx="op"]').forEach((x) => x.classList.toggle("escolhida", x === b));
        palco().querySelectorAll('[data-tx="op"]').forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        SFX.escolha();
        est.escolha = b.dataset.id;
        concluir(t(b.dataset.id === "limpar_paineis" ? "tut5_limpar" : "tut5_esperar"));
      },
    },

    // 6. Tempestade solar: ligue o escudo (tarefa)
    {
      titulo: "tut6_titulo",
      texto: () => t("tut6_texto"),
      humor: "surpreso",
      requer: true,
      iniciar() { est = { escudo: false }; },
      palco() {
        return `
          <div class="tut-tempestade">
            <div class="tut-sol-erupcao">${ico("i-flare", "ico tut-flare")}</div>
            <div class="tut-raiosx" aria-hidden="true"><span>›</span><span>›</span><span>›</span></div>
            <div class="tut-muro" aria-hidden="true"></div>
            <div class="tut-nave-caixa">${ico("i-ship", "ico tut-nave2")}</div>
          </div>
          <div class="barra barra--rad tut-barra">
            <div class="barra-topo">
              ${ico("i-rad")}
              <span class="barra-nome">${t("tut6_dose")}</span>
              <span class="barra-num"><b class="tut-dose">+${DOSE_X} mSv</b></span>
            </div>
            <div class="barra-trilho"><div class="barra-fill tut-dose-barra" style="--val:100%"></div></div>
          </div>
          <button class="btn btn-secundario tut-btn-escudo" type="button" data-tx="escudo" aria-pressed="false">
            ${ico("i-shield")} <span>${t("tut6_escudo")}</span>
          </button>`;
      },
      aoClicar(el) {
        const b = el.closest('[data-tx="escudo"]');
        if (!b || est.escudo) return;
        est.escudo = true;
        const p = palco();
        p.querySelector(".tut-tempestade").classList.add("tut-tempestade--escudo");
        p.querySelector(".tut-dose").textContent = `+${DOSE_COM_ESCUDO} mSv`;
        p.querySelector(".tut-dose-barra").style.setProperty("--val", `${Math.round((DOSE_COM_ESCUDO / DOSE_X) * 100)}%`);
        b.setAttribute("aria-pressed", "true");
        b.classList.add("tut-btn-escudo--on");
        b.querySelector("span").textContent = t("tut6_escudo_on");
        SFX.escolha();
        concluir(t("tut6_feito"));
      },
    },

    // 7. A meta e despedida
    {
      titulo: "tut7_titulo",
      texto: () => t("tut7_texto", { meta: C.metaCiencia, dias: C.viagem.turnos * C.viagem.diasPorTurno, sois: C.base.sois }),
      humor: "feliz",
      palco() {
        return `
          <ul class="tut-meta">
            <li>${ico("i-ship")}<b>${C.viagem.turnos * C.viagem.diasPorTurno}</b><span>${t("resumo_dias")}</span></li>
            <li>${ico("i-sol")}<b>${C.base.sois}</b><span>${t("resumo_sois")}</span></li>
            <li>${ico("i-sci")}<b>${C.metaCiencia}</b><span>${t("resumo_ciencia")}</span></li>
          </ul>
          <div class="tut-estrelas" role="img" aria-label="${esc(t("estrelas_aria", { n: 3 }))}">
            ${[0, 1, 2].map((i) => ico("i-star", "ico tut-estrela")).join("")}
          </div>`;
      },
      aoEntrar() { if (!reduzMovimento()) [0, 1, 2].forEach((i) => setTimeout(() => { if (raiz && passo === 6) SFX.toque(i * 2 + 3); }, 400 + i * 250)); },
    },
  ];

  // ---- Treino do passo 4 (mesmas peças do painel do jogo) ----
  const somaTreino = () => Object.values(est.aloc).reduce((a, b) => a + b, 0);

  function previsaoTreino() {
    return {
      o2: limitar(C.inicio.o2 - C.consumo.o2 + C.producao.o2 * est.aloc.o2, 0, 100),
      comida: limitar(C.inicio.comida - C.consumo.comida + C.producao.comida * est.aloc.food, 0, 100),
    };
  }

  function treinoHtml() {
    const livre = TREINO - somaTreino();
    const prev = previsaoTreino();
    const chip = (agora, depois) => {
      const dir = depois - agora;
      const seta = dir > 0 ? "▲" : dir < 0 ? "▼" : "=";
      const tipo = dir === 0 ? "neutra" : dir > 0 ? "bom" : "ruim";
      return `<span class="previsao previsao--${tipo}">${seta} ${depois}%</span>`;
    };
    const cartao = (s) => {
      const v = est.aloc[s.k];
      let pontos = "";
      for (let i = 0; i < C.maxPorSistema; i++) pontos += `<i${i < v ? ' class="on"' : ""}></i>`;
      return `
        <div class="sistema ${s.cls}">
          <div class="sistema-topo">${ico(s.icone)}<span class="sistema-nome">${t(s.nome)}</span></div>
          <div class="sistema-controles">
            <button class="btn-passo" type="button" data-tx="adj" data-k="${s.k}" data-d="-1" aria-label="${esc(t("menos_" + s.k))}"${v <= 0 ? " disabled" : ""}>${ico("i-menos")}</button>
            <span class="aloc-pontos" role="img" aria-label="${esc(t("pontos_aria", { n: v, max: C.maxPorSistema }))}">${pontos}</span>
            <button class="btn-passo" type="button" data-tx="adj" data-k="${s.k}" data-d="1" aria-label="${esc(t("mais_" + s.k))}"${v >= C.maxPorSistema || livre <= 0 ? " disabled" : ""}>${ico("i-mais")}</button>
          </div>
        </div>`;
    };
    const barra = (cls, icone, nome, agora, depois) => `
      <div class="barra ${cls}">
        <div class="barra-topo">${ico(icone)}<span class="barra-nome">${nome}</span><span class="barra-num">${agora}% ${chip(agora, depois)}</span></div>
        <div class="barra-trilho" role="meter" aria-label="${esc(nome)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${agora}">
          <div class="barra-prev" style="--prev:${depois}%"></div><div class="barra-fill" style="--val:${agora}%"></div>
        </div>
      </div>`;
    return `
      <div class="painel tut-painel">
        <div class="energia" role="status">
          ${ico("i-energy", "ico ico--energia")}
          <span class="energia-rotulo">${t("energia_livre")}</span>
          <span class="energia-valor"><b>${livre}</b> ${t("de")} ${TREINO}</span>
        </div>
        <div class="sistemas">${SISTEMAS.map(cartao).join("")}</div>
        <div class="barras">
          ${barra("barra--o2", "i-o2", t("oxigenio"), C.inicio.o2, prev.o2)}
          ${barra("barra--comida", "i-food", t("comida"), C.inicio.comida, prev.comida)}
        </div>
      </div>`;
  }

  // ---------- Montagem da tela ----------
  function esqueleto() {
    const estrelas = PASSOS.map((_, i) => `<li>${ico("i-star", "ico tut-prog-estrela")}</li>`).join("");
    return `
      <div class="tut-caixa" role="dialog" aria-modal="true" aria-labelledby="tut-titulo" aria-label="${esc(t("tut_aria"))}">
        <div class="tut-topo">
          <ol class="tut-progresso" aria-hidden="true">${estrelas}</ol>
          <button class="btn-idioma" type="button" data-tut="idioma" aria-label="Mudar idioma / Change language">
            <span class="idioma-pt" lang="pt-BR">PT</span><span class="idioma-sep" aria-hidden="true">/</span><span class="idioma-en" lang="en">EN</span>
          </button>
          <button class="btn-idioma tut-voz" type="button" data-tut="voz" aria-pressed="true"></button>
          <button class="btn-idioma tut-trocar" type="button" data-tut="trocarvoz"></button>
        </div>

        <div class="tut-cena">
          <div class="orbi" aria-hidden="true">${orbiSvg()}<span class="orbi-nome">ORBI</span></div>
          <div class="tut-balao">
            <h2 id="tut-titulo" class="tut-titulo" tabindex="-1"></h2>
            <p class="tut-texto" aria-hidden="true"></p>
            <p class="sr-only tut-texto-sr" role="status"></p>
          </div>
        </div>

        <div class="tut-palco"></div>
        <p class="tut-dica" role="status"></p>

        <div class="tut-rodape">
          <button class="btn btn-secundario" type="button" data-tut="voltar"></button>
          <button class="btn btn-secundario tut-repetir" type="button" data-tut="repetir">${ico("i-falar")}</button>
          <button class="btn btn-principal" type="button" data-tut="proximo"></button>
        </div>
        <button class="tut-pular" type="button" data-tut="pular"></button>
      </div>`;
  }

  function boasVindasHtml() {
    return `
      <div class="tut-caixa tut-caixa--inicio" role="dialog" aria-modal="true" aria-labelledby="tut-titulo" aria-label="${esc(t("tut_aria"))}">
        <div class="tut-topo tut-topo--inicio">
          <button class="btn-idioma" type="button" data-tut="idioma" aria-label="Mudar idioma / Change language">
            <span class="idioma-pt" lang="pt-BR">PT</span><span class="idioma-sep" aria-hidden="true">/</span><span class="idioma-en" lang="en">EN</span>
          </button>
        </div>
        <div class="orbi orbi--grande orbi--feliz" data-humor="feliz">${orbiSvg()}<span class="orbi-nome">ORBI</span></div>
        <p class="tut-papel">${t("tut_papel")}</p>
        <h1 id="tut-titulo" class="tut-titulo-grande" tabindex="-1">${t("tut_boasvindas_titulo")}</h1>
        <p class="lead tut-lead">${t("tut_boasvindas_texto")}</p>
        <button class="btn btn-principal btn--destaque" type="button" data-tut="comecar">${ico("i-som", "ico ico--quadrado")} <span>${t("tut_comecar")}</span></button>
        <button class="tut-pular" type="button" data-tut="pular">${t("tut_pular")}</button>
      </div>`;
  }

  function orbi() { return raiz ? raiz.querySelector(".orbi") : null; }

  function humor(h) {
    const o = orbi();
    if (o) o.setAttribute("data-humor", h);
  }

  // Texto no balão: aparece letra por letra (toque no balão para ver tudo)
  // O texto inteiro fica escondido atrás (só para reservar a altura do balão e ele não "pular").
  function escreverNoBalao(texto) {
    const el = P(".tut-texto");
    const sr = P(".tut-texto-sr");
    if (!el) return;
    clearInterval(digitando);
    sr.textContent = texto;
    el.innerHTML = '<span class="tut-fantasma"></span><span class="tut-digitado"></span>';
    el.firstChild.textContent = texto;
    const vivo = el.lastChild;
    if (reduzMovimento()) { vivo.textContent = texto; return; }
    let n = 0;
    digitando = setInterval(() => {
      n += 2;
      vivo.textContent = texto.slice(0, n);
      if (n >= texto.length) clearInterval(digitando);
    }, 28);
  }

  // O Orbi diz algo: aparece no balão e é falado
  function dizer(texto, novoHumor) {
    if (novoHumor) humor(novoHumor);
    escreverNoBalao(texto);
    falar(texto);
  }

  // Tarefa cumprida: libera "Próximo", toca a fanfarra e o Orbi comemora
  function concluir(texto) {
    const primeira = !feitos.has(passo);
    feitos.add(passo);
    if (primeira) SFX.acerto();
    dizer(texto, "feliz");
    atualizarRodape();
  }

  function atualizarRodape() {
    const def = PASSOS[passo];
    const ultimo = passo === PASSOS.length - 1;
    const trava = def.requer && !feitos.has(passo);
    const voltar = P('[data-tut="voltar"]');
    const proximo = P('[data-tut="proximo"]');
    voltar.textContent = t("tut_voltar");
    voltar.disabled = passo === 0;
    proximo.textContent = ultimo ? t("tut_fim_botao") : t("tut_proximo");
    proximo.disabled = trava;
    proximo.classList.toggle("btn--destaque", !trava);
    P('[data-tut="repetir"]').setAttribute("aria-label", t("tut_repetir_aria"));
    P(".tut-dica").textContent = trava ? t("tut_tarefa") : "";
    P('[data-tut="pular"]').textContent = t("tut_pular");
    raiz.querySelectorAll(".tut-prog-estrela").forEach((s, i) => {
      s.classList.toggle("tut-prog--feito", i < passo || (i === passo && feitos.has(i)));
      s.classList.toggle("tut-prog--atual", i === passo);
    });
    const voz = P('[data-tut="voz"]');
    voz.innerHTML = ico(vozLigada ? "i-som" : "i-mudo");
    voz.setAttribute("aria-pressed", String(vozLigada));
    voz.setAttribute("aria-label", t(vozLigada ? "tut_voz_desligar" : "tut_voz_ligar"));
    const trocar = P('[data-tut="trocarvoz"]');
    trocar.textContent = t("tut_voz_trocar_curto");
    trocar.setAttribute("aria-label", t("tut_voz_trocar"));
    trocar.style.display = vozLigada && temComoTrocarVoz() ? "" : "none";   // só aparece se há mais de uma voz
  }

  function mostrarPasso(n, { falarAgora = true } = {}) {
    passo = n;
    const def = PASSOS[n];
    raiz.innerHTML = esqueleto();
    aoFalar = (on) => { const o = orbi(); if (o) o.classList.toggle("orbi--falando", on); };

    P(".tut-titulo").textContent = t(def.titulo);
    P(".tut-titulo").insertAdjacentHTML("afterbegin", `<span class="sr-only">${t("tut_passo", { n: n + 1, total: PASSOS.length })}. </span>`);
    if (def.iniciar) def.iniciar();
    P(".tut-palco").innerHTML = def.palco();
    humor(def.humor || "normal");
    atualizarRodape();
    if (def.aoEntrar) def.aoEntrar();

    if (falarAgora) {
      SFX.chamar();
      preaquecer(def.texto());                       // já gera o MP3 enquanto a criança lê
      escreverNoBalao(def.texto());
      setTimeout(() => { if (raiz && passo === n) falar(def.texto()); }, 280);
      const seguinte = PASSOS[n + 1];
      if (seguinte) setTimeout(() => { if (raiz && passo === n) preaquecer(seguinte.texto()); }, 2000);
    } else {
      escreverNoBalao(def.texto());
      clearInterval(digitando);
      P(".tut-digitado").textContent = def.texto();
    }
    P(".tut-titulo").focus({ preventScroll: true });
  }

  function mostrarBoasVindas() {
    passo = -1;
    raiz.innerHTML = boasVindasHtml();
    aoFalar = (on) => { const o = orbi(); if (o) o.classList.toggle("orbi--falando", on); };
    const b = P('[data-tut="comecar"]');
    if (b) b.focus({ preventScroll: true });
  }

  // ---------- Abrir e fechar ----------
  function abrir() {
    if (raiz) return;
    focoAnterior = document.activeElement;
    raiz = document.createElement("div");
    raiz.className = "tut";
    document.body.appendChild(raiz);
    ESCONDER.forEach((sel) => document.querySelectorAll(sel).forEach((el) => el.setAttribute("inert", "")));
    document.body.classList.add("tut-aberto");
    feitos = new Set();
    vozLigada = efeitosLigados();
    mostrarBoasVindas();
    const jaTocou = !navigator.userActivation || navigator.userActivation.hasBeenActive;   // sem toque, o navegador não deixa falar
    if (vozLigada && jaTocou && (!apiIndisponivel() || sintese)) {
      try { window.speechSynthesis && window.speechSynthesis.resume && window.speechSynthesis.resume(); } catch (e) {}
      if (window.I18N && window.I18N.t) {
        const textoBoasVindas = window.I18N.t("tut_boasvindas_texto");
        setTimeout(() => falar(textoBoasVindas), 80);
      }
    }
  }

  function fechar({ terminou = false } = {}) {
    if (!raiz) return;
    pararFala();
    clearInterval(digitando);
    raiz.remove();
    raiz = null;
    ESCONDER.forEach((sel) => document.querySelectorAll(sel).forEach((el) => el.removeAttribute("inert")));
    document.body.classList.remove("tut-aberto");
    marcarVisto();
    if (terminou && window.SOM && window.SOM.iniciar) window.SOM.iniciar();   // a música do jogo começa depois do tutorial
    const alvo = terminou ? document.querySelector("#app .btn-principal") : focoAnterior;
    if (alvo && alvo.focus) alvo.focus({ preventScroll: true });
  }

  // ---------- Cliques ----------
  document.addEventListener("click", (ev) => {
    if (!raiz) return;
    const botao = ev.target.closest("[data-tut]");
    if (botao) {
      const acao = botao.dataset.tut;
      if (acao === "comecar") { mostrarPasso(0); return; }
      if (acao === "pular") { fechar(); return; }
      if (acao === "idioma") {
        mudarIdioma(idiomaAtual() === "pt" ? "en" : "pt");
        const redesenhar = window.ARES && window.ARES.tela && window.ARES.tela.redesenhar;
        if (redesenhar) redesenhar();                // o jogo por baixo também troca de idioma
        pararFala();
        if (passo < 0) mostrarBoasVindas(); else { const antes = passo; mostrarPasso(antes, { falarAgora: false }); falar(PASSOS[antes].texto()); }
        return;
      }
      if (acao === "voz") {
        vozLigada = !vozLigada;
        if (!vozLigada) pararFala();
        atualizarRodape();
        return;
      }
      if (acao === "trocarvoz") { trocarVoz(); return; }
      if (acao === "voltar") { if (passo > 0) mostrarPasso(passo - 1); return; }
      if (acao === "repetir") { const def = PASSOS[passo]; dizer(P(".tut-texto-sr").textContent || def.texto()); return; }
      if (acao === "proximo") {
        if (passo >= PASSOS.length - 1) { fechar({ terminou: true }); return; }
        mostrarPasso(passo + 1);
        return;
      }
    }
    if (passo >= 0 && ev.target.closest(".tut-balao")) {
      clearInterval(digitando);
      P(".tut-digitado").textContent = P(".tut-texto-sr").textContent;     // toque no balão: mostra o texto inteiro
    }
    if (passo >= 0 && ev.target.closest(".tut-palco") && PASSOS[passo].aoClicar) PASSOS[passo].aoClicar(ev.target);
  });

  document.addEventListener("keydown", (ev) => {
    if (raiz && ev.key === "Escape") fechar();
  });

  // Botão "?" do topo e primeira visita
  document.addEventListener("click", (ev) => {
    if (ev.target.closest('[data-tut="abrir"]')) {
      const textoBoasVindas = (window.I18N && window.I18N.t) ? window.I18N.t("tut_boasvindas_texto") : "Bem-vindo ao tutorial de missão.";
      preaquecer(textoBoasVindas);                   // clicou no "?": já vai gerando a primeira fala
      abrir();
      if (!apiIndisponivel() || (window.speechSynthesis && window.speechSynthesis.speaking === false)) {
        setTimeout(() => falar(textoBoasVindas), 100);
      }
    }
  });

  window.ARES = window.ARES || {};
  window.ARES.orbiSvg = orbiSvg;                     // as dicas (dicas.js) reaproveitam o desenho do Orbi
  window.TUTORIAL = { abrir, fechar, jaViu: visto };

  // O resto do jogo usa a MESMA voz do Orbi (minigames, cartas de decisão e cartões de dica).
  // Quem fala por último manda: falar() já interrompe a fala anterior, então não há duas vozes juntas.
  window.ARES.falar = (texto) => { if (vozLigada) falar(texto); };
  window.ARES.preaquecer = (texto) => preaquecer(texto);
  window.ARES.calar = pararFala;

  // O tutorial só abre depois da abertura narrativa (intro.js) terminar
  function iniciar() {
    if (!(SEMPRE_ABRIR || !visto())) return;
    // A intro demora alguns segundos: aproveita para já gerar a voz.
    preaquecer((window.I18N && window.I18N.t) ? window.I18N.t("tut_boasvindas_texto") : "");
    if (PASSOS[0]) preaquecer(PASSOS[0].texto());
    if (window.ARES_INTRO_ATIVA) { window.addEventListener("ares:intro:fechada", () => abrir(), { once: true }); return; }
    abrir();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
