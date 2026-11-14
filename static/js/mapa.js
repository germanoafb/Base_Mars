// Mapa em PIXEL ART desenhado num <canvas> (ideia e desenhos originais do design da equipe).
//
// O personagem escolhido anda pelo mapa. Tocar numa estação faz ele ir até lá,
// e o main.js destaca os controles daquela estação no painel ao lado.
// Estações: estufa (comida), cabine/habitat (dormir = passar o turno),
// suporte de vida (ar e água), escudo e rádio.
//
// Este arquivo só DESENHA. Quem decide as regras é static/js/game/.
// Os botões embaixo do mapa fazem tudo o que o mapa faz (para teclado e leitor de tela).

(function () {
  "use strict";

  const W = 320;   // tamanho "de verdade" do desenho; o CSS aumenta sem borrar
  const H = 180;
  const reduzir = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let canvas = null;
  let g = null;
  let obterEstado = null;   // função do main.js que devolve o estado visual
  let aoChegar = null;      // avisa o main.js quando a Lia chega numa estação
  let T = 0;                // contador de quadros (anima tudo)
  let flash = 0;            // clarão quando chega uma tempestade solar
  let ultimaFase = null;
  let ultimaTempestade = false;

  // Lia: posição atual (x, y), destino (tx, ty) e estação de destino
  const P = { x: 150, y: 136, tx: 150, ty: 136, pend: null, at: null, passo: 0 };

  // Onde fica cada estação (mesmas posições na nave e na base)
  const ESTACOES = [
    { k: "food", x1: 26, x2: 82, dx: 54, py: 84 },
    { k: "home", x1: 108, x2: 168, dx: 140, py: 82 },
    { k: "o2", x1: 170, x2: 189, dx: 179, py: 92 },
    { k: "shield", x1: 190, x2: 212, dx: 203, py: 72 },
    { k: "comms", x1: 276, x2: 308, dx: 293, py: 62 },
  ];

  // Faixa do chão onde dá para andar (y de cima, y de baixo)
  const CHAO = { base: [134, 172], viagem: [132, 139] };

  // ---------- Ajudantes de desenho ----------
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const pisca = (periodo, ligado) => (reduzir ? true : T % periodo < ligado);

  function disco(cx, cy, r, cor) {
    for (let y = -r; y <= r; y++) {
      const w = Math.round(Math.sqrt(r * r - y * y));
      R(cx - w, cy + y, w * 2, 1, cor);
    }
  }

  function cupula(cx, cy, r, cor, brilho) {
    for (let y = 0; y <= r; y++) {
      const w = Math.round(Math.sqrt(r * r - y * y));
      R(cx - w, cy - y, w * 2, 1, y > r * 0.6 ? brilho : cor);
    }
  }

  // Astronauta em pixel: capacete, visor, traje colorido, pernas andando
  function astronauta(x, y, traje, passo) {
    const b = passo % 16 < 8 ? 0 : 1;
    R(x, y - 9, 6, 5, "#fff");
    R(x + 1, y - 8, 4, 3, "#2a4a6a");
    R(x, y - 4, 6, 7, traje);
    R(x, y + 3, 2, 3 - b, "#fff");
    R(x + 4, y + 3, 2, 2 + b, "#fff");
  }

  // Balãozinho acima da cabeça: "!" com medo, "?" preocupado
  function balaoHumor(x, y, humor) {
    if (humor === "feliz") return;
    R(x - 1, y - 20, 8, 8, "#ffe9d6");
    if (humor === "assustado") { R(x + 2, y - 19, 2, 4, "#ff5a5a"); R(x + 2, y - 14, 2, 1, "#ff5a5a"); }
    else { R(x + 1, y - 19, 4, 1, "#1a0f14"); R(x + 4, y - 18, 1, 2, "#1a0f14"); R(x + 2, y - 16, 2, 1, "#1a0f14"); R(x + 2, y - 14, 2, 1, "#1a0f14"); }
  }

  // Nave em pixel (mesma do ícone), escala s
  const NAVE = [
    "....rr..........",
    "....rrr.........",
    ".y.cccccccccc...",
    "yyycccccbbbcccc.",
    "yyycccccbbbcccc.",
    ".y.cccccccccc...",
    "....rrr.........",
    "....rr..........",
  ];
  const COR_NAVE = { r: "#ff7a59", y: "#ffd23f", c: "#ffe9d6", b: "#6fd3ff" };
  function nave(x, y, s) {
    NAVE.forEach((linha, j) => {
      for (let i = 0; i < linha.length; i++) if (linha[i] !== ".") R(x + i * s, y + j * s, s, s, COR_NAVE[linha[i]]);
    });
  }

  function estrelas(qtd) {
    for (let i = 0; i < qtd; i++) {
      const x = (i * 97) % W;
      const y = (i * 53) % 120;
      R(x, y, 1, 1, (i + Math.floor(T / 20)) % 7 === 0 ? "#6a6a8a" : "#ffffff");
    }
  }

  // Pontos de energia de cada estação (quadradinhos amarelos) + seta piscando
  function pontosDasEstacoes(e) {
    ESTACOES.forEach((s) => {
      if (s.k === "home") {
        if (P.at !== "home" && pisca(30, 15)) R(s.dx - 3, s.py - 2, 7, 2, "#ffe9d6");
        return;
      }
      for (let i = 0; i < e.max; i++) R(s.dx - 11 + i * 6, s.py, 5, 5, i < e.alocacao[s.k] ? "#ffd24a" : "#4a2a2a");
      if (P.at !== s.k) {
        const b = pisca(30, 15) ? 0 : 2;
        const y = s.py - 9 + b;
        R(s.dx - 3, y, 7, 1, "#fff"); R(s.dx - 2, y + 1, 5, 1, "#fff"); R(s.dx - 1, y + 2, 3, 1, "#fff");
      }
    });
  }

  // Partículas da tempestade solar. "limite" = altura onde o escudo segura
  function tempestade(e, limite, direcao) {
    const sh = e.alocacao.shield;
    for (let i = 0; i < 16; i++) {
      const x = (i * 47 + T * 3 * direcao + 640) % W;
      const yMax = sh > 0 ? limite - sh * 6 : 150;
      const y = (T * 4 + i * 31) % 150;
      if (sh > 0 && y > yMax) R(x, yMax - ((y - yMax) % 6), 2, 2, "#fff7c0");  // bateu no escudo
      else R(x, y, 2, 6, "#ff6aa0");
    }
  }

  function bateria(x, y, e) {
    R(x, y, 14, 9, "#1a0f14"); R(x + 14, y + 3, 2, 3, "#1a0f14");
    for (let i = 0; i < e.bateriaMax; i++) R(x + 1 + i * 2, y + 1, 1, 7, i < e.bateria ? "#6be37a" : "#3a2030");
  }

  function plantas(x, y, comida, n, passo) {
    const h = 2 + Math.round((comida / 100) * 8);
    for (let i = 0; i < n; i++) {
      const balanco = reduzir ? 0 : Math.round(Math.sin(T / 20 + i));
      R(x + i * 9, y - h + (i % 2), 3, h, "#2a7a30");
      R(x + i * 9 - 1 + balanco, y - h - 2 + (i % 2), 5, 3, "#6be37a");
    }
  }

  function tanqueDeAgua(x, y, w, h, o2) {
    R(x, y, w, h, "#2a2f6b");
    const nivel = Math.round(((h - 2) * o2) / 100);
    R(x + 1, y + h - 1 - nivel, w - 2, nivel, "#6fd3ff");
    R(x + 1, y + 1, 1, h - 2, "#bff0ff");
  }

  function tripulacao(e, chaoY) {
    // Quem não é o jogador anda de leve perto de uma estação (suporte de vida e estufa)
    const lugares = [
      { x: 210, amp: 8, periodo: 60, y: 6, passo: 3 },
      { x: 88, amp: 6, periodo: 45, y: 8, passo: 4 },
    ];
    const outros = [0, 1, 2].filter((i) => i !== e.jogador);
    outros.forEach((i, n) => {
      const l = lugares[n];
      const dx = reduzir ? 0 : Math.sin(T / l.periodo + n) * l.amp;
      astronauta(l.x + dx, chaoY + l.y, e.trajes[i], T / l.passo);
      balaoHumor(l.x + dx, chaoY + l.y, e.humores[i]);
    });
    // O jogador por cima, com uma setinha amarela na cabeça
    astronauta(P.x - 3, P.y, e.trajes[e.jogador], P.andando ? P.passo : 0);
    if (e.humores[e.jogador] === "feliz") { R(P.x - 1, P.y - 14, 3, 1, "#ffd24a"); R(P.x, P.y - 13, 1, 1, "#ffd24a"); }
    balaoHumor(P.x - 3, P.y, e.humores[e.jogador]);
  }

  // ---------- Cenário: BASE EM MARTE ----------
  function desenharBase(e) {
    const poeira = e.poeira;
    R(0, 0, W, H, poeira ? "#a9663f" : "#d98b5c");
    R(0, 0, W, 40, poeira ? "#8a4f33" : "#c97a50");
    R(0, 40, W, 30, poeira ? "#9a5a38" : "#d9885a");
    R(250, 14, 10, 10, e.tempestade ? "#fff7c0" : "#ffe9b0");
    if (e.tempestade) tempestade(e, 125, 1);
    R(0, 120, W, 60, "#b85d3a"); R(0, 120, W, 3, "#9a4a2e");
    for (let i = 0; i < 30; i++) R((i * 53) % W, 125 + ((i * 37) % 50), 3, 2, "#a04e30");

    // Painéis solares (cobertos de poeira na tempestade) + bateria
    const painel = poeira ? "#4a3a5a" : "#2a5fd0";
    for (let i = 0; i < 3; i++) { const x = 215 + i * 22; R(x, 108, 18, 10, painel); R(x + 8, 118, 2, 6, "#ccc"); R(x, 112, 18, 1, poeira ? "#6a5a6a" : "#7aa8ff"); }
    bateria(232, 124, e);

    // Estufa com plantas (crescem com a comida)
    cupula(54, 122, 22, "#5fd16a", "#bff5c0"); R(32, 122, 44, 10, "#3b9a46");
    plantas(40, 120, e.comida, 4);

    // Habitat (alarme vermelho quando o ar está acabando)
    cupula(140, 122, 28, "#e9e1d4", "#ffffff"); R(112, 122, 56, 12, "#bdb3a2");
    R(134, 118, 12, 14, "#4a6a8a"); R(136, 120, 8, 6, "#8ad7ff");
    if (e.alarme && pisca(30, 15)) R(137, 90, 6, 4, "#ff4a4a");

    // Suporte de vida: caixa d'água (nível = ar e água) + torre do escudo
    tanqueDeAgua(172, 104, 12, 28, e.o2);
    R(174, 100, 8, 4, "#ccc");
    R(194, 104, 8, 28, "#7a7a9a"); R(192, 98, 12, 8, e.alocacao.shield ? "#7ad7ff" : "#4a4a6a"); R(196, 92, 4, 6, "#bff0ff");

    // Antena (ondas quando o rádio está ligado)
    R(292, 96, 3, 36, "#ddd"); R(284, 92, 19, 3, "#ddd"); R(286, 86, 15, 6, "#eee"); R(293, 80, 2, 6, "#ff4a4a");
    if (e.alocacao.comms > 0 && pisca(40, 20)) { R(289, 74, 9, 2, "#7dffb0"); if (e.alocacao.comms > 1) R(287, 70, 13, 2, "#7dffb0"); }

    pontosDasEstacoes(e);

    // Escudo: cúpula azul (mais forte com mais pontos)
    if (e.alocacao.shield > 0) {
      g.globalAlpha = 0.15 + e.alocacao.shield * 0.12 + (pisca(30, 3) && e.tempestade ? 0.15 : 0);
      g.strokeStyle = "#7ad7ff"; g.lineWidth = 3;
      g.beginPath(); g.arc(120, 124, 92, Math.PI, 2 * Math.PI); g.stroke();
      g.fillStyle = "#7ad7ff"; g.globalAlpha = 0.06 * e.alocacao.shield; g.fill();
      g.globalAlpha = 1;
    }

    tripulacao(e, CHAO.base[0]);

    if (poeira) {
      g.globalAlpha = 0.35;
      for (let i = 0; i < 40; i++) R((i * 29 + T * 5) % W, (i * 17) % H, 6, 2, "#6b3a22");
      g.globalAlpha = 1;
    }
  }

  // ---------- Cenário: DENTRO DA NAVE (viagem) ----------
  function desenharNave(e) {
    R(0, 0, W, H, "#0b0a1a");
    estrelas(50);
    // A Terra encolhe e Marte cresce conforme a viagem avança
    const p = e.progresso;
    disco(34, 28, Math.max(4, Math.round(22 - 16 * p)), "#3f8cff");
    R(26, 24, 8, 3, "#6ee08a");
    disco(286, 28, Math.round(5 + 15 * p), "#e8673c");
    if (e.tempestade) tempestade(e, 56, 1);

    // Escudo: bolha em volta da nave
    if (e.alocacao.shield > 0) {
      g.globalAlpha = 0.18 + e.alocacao.shield * 0.12;
      g.strokeStyle = "#7ad7ff"; g.lineWidth = 3;
      g.beginPath(); g.ellipse(160, 100, 158, 50 + e.alocacao.shield * 2, 0, 0, 2 * Math.PI); g.stroke();
      g.fillStyle = "#7ad7ff"; g.globalAlpha = 0.05 * e.alocacao.shield; g.fill();
      g.globalAlpha = 1;
    }

    // Casco, parede de dentro e chão
    R(8, 56, 300, 90, "#8a8fb0");
    for (let i = 0; i < 12; i++) R(308 + i, 60 + i * 3, 1, 82 - i * 6, "#8a8fb0");   // bico da nave
    R(12, 60, 292, 82, "#3a3550");
    R(12, 130, 292, 12, "#2a2438"); R(12, 130, 292, 1, "#5a5070");
    // Janelinhas com estrelas
    [96, 236].forEach((x) => { R(x, 68, 14, 10, "#0b0a1a"); R(x + 3, 71, 1, 1, "#fff"); R(x + 9, 74, 1, 1, "#fff"); });

    // Estufa (plantas crescem com a comida)
    R(26, 94, 56, 36, "#1d3b2a"); R(26, 94, 56, 2, "#bff5c0"); R(26, 128, 56, 2, "#3b9a46");
    plantas(34, 126, e.comida, 5);

    // Cabine com beliches (dormir = passar o turno)
    R(112, 100, 52, 6, "#7a5a8a"); R(112, 116, 52, 6, "#7a5a8a");
    R(114, 98, 10, 3, "#ffe9d6"); R(114, 114, 10, 3, "#ffe9d6");
    R(112, 100, 2, 30, "#5a4060"); R(162, 100, 2, 30, "#5a4060");

    // Suporte de vida: caixa d'água + máquina
    tanqueDeAgua(172, 98, 12, 32, e.o2);
    // Console do escudo (luz azul mais forte com mais pontos)
    R(192, 104, 18, 26, "#4a4a6a");
    R(195, 108, 12, 6, e.alocacao.shield ? "#4f8dff" : "#2a2a4a");
    for (let i = 0; i < e.alocacao.shield; i++) R(195 + i * 3, 117, 2, 2, "#7ad7ff");

    // Bateria na parede
    bateria(222, 100, e);

    // Rádio: console + antena saindo pelo teto
    R(280, 104, 26, 26, "#4a4a6a");
    R(284, 108, 18, 10, e.alocacao.comms > 0 && pisca(40, 24) ? "#7dffb0" : "#1d3b2a");
    R(292, 40, 2, 16, "#ddd"); R(286, 38, 14, 3, "#eee");
    if (e.alocacao.comms > 0 && pisca(40, 20)) { R(287, 32, 12, 2, "#7dffb0"); if (e.alocacao.comms > 1) R(285, 27, 16, 2, "#7dffb0"); }

    // Alarme no teto quando o ar está acabando
    if (e.alarme && pisca(30, 15)) { R(148, 60, 10, 4, "#ff4a4a"); g.globalAlpha = 0.12; R(12, 60, 292, 82, "#ff4a4a"); g.globalAlpha = 1; }

    pontosDasEstacoes(e);
    tripulacao(e, CHAO.viagem[0] - 2);
  }

  // ---------- Cenário: LANÇAMENTO (só enfeite) ----------
  function desenharLancamento() {
    R(0, 0, W, H, "#0b0a1a");
    estrelas(60);
    disco(40, 190, 80, "#3f8cff");
    R(10, 130, 30, 6, "#6ee08a"); R(40, 142, 24, 5, "#6ee08a");
    disco(282, 44, 24, "#e8673c");
    R(272, 36, 6, 6, "#b8432a"); R(286, 52, 8, 6, "#b8432a");
    // Caminho pontilhado e a nave voando por ele
    for (let i = 0; i < 20; i++) { const t = i / 20; R(80 + t * 170, 120 - Math.sin(t * Math.PI) * 60 - t * 20, 2, 2, "#c9a08c"); }
    const t = reduzir ? 0.45 : (T % 400) / 400;
    nave(80 + t * 170 - 16, 120 - Math.sin(t * Math.PI) * 60 - t * 20 - 8, 2);
  }

  // ---------- Movimento da Lia ----------
  function moverLia() {
    const dx = P.tx - P.x;
    const dy = P.ty - P.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      P.x += (dx / d) * 1.8;
      P.y += (dy / d) * 1.8;
      P.passo++;
      P.andando = true;
      if (pisca(20, 12)) { R(P.tx - 3, P.ty, 7, 1, "#fff"); R(P.tx, P.ty - 3, 1, 7, "#fff"); }  // marca do destino
    } else if (P.andando) {
      P.andando = false;
      chegou();
    }
  }

  function chegou() {
    P.at = P.pend;
    if (P.at && aoChegar) aoChegar(P.at);
  }

  // ---------- Toque/clique no mapa ----------
  function tocar(ev) {
    const e = obterEstado && obterEstado();
    if (!e || e.modo !== "jogo") return;
    const r = canvas.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    const y = ((ev.clientY - r.top) / r.height) * H;
    const [y0, y1] = CHAO[e.fase];
    const est = ESTACOES.find((s) => x >= s.x1 && x <= s.x2 && y >= 50 && y <= y1 + 4);
    if (est) { P.tx = est.dx; P.ty = y0 + 3; P.pend = est.k; }
    else { P.tx = Math.max(8, Math.min(310, x)); P.ty = Math.max(y0, Math.min(y1, y)); P.pend = null; }
    P.at = null;
    if (reduzir) { P.x = P.tx; P.y = P.ty; chegou(); }   // sem animação: chega na hora
  }

  // ---------- Laço de desenho ----------
  function quadro() {
    if (canvas && canvas.isConnected && obterEstado) {
      const e = obterEstado();
      if (e) {
        if (e.modo === "lancamento") desenharLancamento();
        else {
          if (e.fase !== ultimaFase) {     // fase nova: Lia volta para o meio
            ultimaFase = e.fase;
            P.x = P.tx = 150; P.y = P.ty = CHAO[e.fase][0] + 3; P.at = P.pend = null;
          }
          if (e.tempestade && !ultimaTempestade && !reduzir) flash = 40;
          ultimaTempestade = e.tempestade;
          moverLia();
          if (e.fase === "base") desenharBase(e); else desenharNave(e);
          if (flash > 0) { g.globalAlpha = flash / 120; R(0, 0, W, H, "#ffffff"); g.globalAlpha = 1; flash--; }
        }
      }
    }
    if (!reduzir) T++;
    requestAnimationFrame(quadro);
  }

  // O main.js chama isto toda vez que redesenha a tela (o canvas é novo, a Lia continua onde estava)
  function conectar(novoCanvas, obter, chegar) {
    canvas = novoCanvas;
    obterEstado = obter;
    aoChegar = chegar;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    g = canvas.getContext("2d");
    g.imageSmoothingEnabled = false;
    canvas.addEventListener("pointerdown", tocar);
  }

  // Esquecer a estação aberta (ex.: depois de passar o turno)
  function soltar() {
    P.at = null;
    P.pend = null;
  }

  window.MAPA = { conectar, soltar, estacaoAtual: () => P.at };
  requestAnimationFrame(quadro);
})();
