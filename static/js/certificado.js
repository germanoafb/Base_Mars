// Certificado de missão: desenhado num <canvas> em pixel art e baixado como imagem PNG.
// Este arquivo só cuida do DESENHO. Os textos chegam prontos (em PT ou EN) do main.js.
//
// LOGO DA NASA: coloque o arquivo oficial em  static/assets/nasa-logo.png  (ou nasa-logo.svg).
// Se o arquivo não existir, o certificado mostra o texto "NASA Space Apps Challenge 2026" no lugar.
//
// Uso (feito pelo main.js):
//   window.ARES.certificado.desenhar(canvas, dados)   → desenha o certificado
//   window.ARES.certificado.baixar(canvas, dados)     → baixa o PNG
//
// "dados" = { nome, estrelas, arquivo, textos: { titulo, parabens, texto, detalhes, data, aviso, credito, nasa } }

(function () {
  "use strict";

  window.ARES = window.ARES || {};

  const L = 1600;   // largura do certificado (px)
  const A = 1132;   // altura (proporção de uma folha A4 deitada)

  const COR = {
    papel: "#ffe9d6",
    papelSombra: "#f6d5bb",
    tinta: "#1a0f14",
    linha: "#5a3040",
    acento: "#ff8a4c",
    acentoEscuro: "#b8532a",
    marte: "#e8673c",
    marteEscuro: "#b8432a",
    suave: "#7a5560",
    estrelaOn: "#ffb81f",
    estrelaOff: "#e3c7b1",
  };

  const FONTE = {
    titulo: '"Press Start 2P", "Courier New", monospace',
    texto: '"Ares Digitos", "Pixelify Sans", "Courier New", monospace',
    logo: '"Tiny5 Duo", "Press Start 2P", monospace',
  };

  // Logo da NASA: desligado. As regras do Space Apps não deixam as equipes usarem
  // o logo/insígnia da NASA, então o certificado mostra só o texto.
  const LOGOS_NASA = [];

  // Pixel art: cada item é [x, y, largura, altura] em "quadradinhos"
  const MARTE = [[2, 0, 4, 1], [1, 1, 6, 1], [0, 2, 8, 4], [1, 6, 6, 1], [2, 7, 4, 1]];
  const MARTE_SOMBRA = [[2, 2, 2, 2], [5, 4, 2, 2]];
  const ESTRELA = [
    [5, 0, 2, 1], [5, 1, 2, 1], [4, 2, 4, 1], [0, 3, 12, 1], [1, 4, 10, 1], [2, 5, 8, 1],
    [3, 6, 6, 1], [3, 7, 6, 1], [2, 8, 3, 1], [7, 8, 3, 1], [2, 9, 2, 1], [8, 9, 2, 1],
    [1, 10, 2, 1], [9, 10, 2, 1],
  ];

  // ---------- Carregar fontes e logo ----------
  function carregarFontes() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const pedidos = ['40px "Ares Digitos"', '64px "Tiny5 Duo"', '40px "Press Start 2P"', '40px "Pixelify Sans"', '700 40px "Pixelify Sans"'];
    const carregando = Promise.all(pedidos.map((f) => document.fonts.load(f, "AÁãçõ0123456789").catch(() => null)));
    const limite = new Promise((ok) => setTimeout(ok, 2500));   // sem internet: usa as fontes de reserva
    return Promise.race([carregando, limite]).then(() => null, () => null);
  }

  let logoNasa = null;   // promessa guardada: o logo é carregado uma vez só
  function carregarLogoNasa() {
    if (logoNasa) return logoNasa;
    const tentar = (i) => new Promise((ok) => {
      if (i >= LOGOS_NASA.length) { ok(null); return; }
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => tentar(i + 1).then(ok);
      img.src = LOGOS_NASA[i];
    });
    logoNasa = tentar(0);
    return logoNasa;
  }

  // Plano B para navegadores que ignoram textRendering: um separador invisível entre "f" e "i"/"l"
  function semLigadura(v) {
    if (typeof v === "string") return v.replace(/f(?=[il])/g, "f\u200C");
    const o = {};
    Object.keys(v).forEach((k) => { o[k] = semLigadura(v[k]); });
    return o;
  }

  // ---------- Ajudantes de desenho ----------
  function pixels(ctx, retangulos, x, y, escala, cor) {
    ctx.fillStyle = cor;
    retangulos.forEach((r) => ctx.fillRect(x + r[0] * escala, y + r[1] * escala, r[2] * escala, r[3] * escala));
  }

  // Quebra o texto em linhas que cabem na largura dada
  function quebrar(ctx, texto, larguraMax) {
    const linhas = [];
    let atual = "";
    String(texto).split(" ").forEach((palavra) => {
      const teste = atual ? atual + " " + palavra : palavra;
      if (!atual || ctx.measureText(teste).width <= larguraMax) atual = teste;
      else { linhas.push(atual); atual = palavra; }
    });
    if (atual) linhas.push(atual);
    return linhas;
  }

  // Diminui a fonte até o texto caber (nomes compridos)
  function ajustarFonte(ctx, texto, peso, familia, maxPx, minPx, larguraMax) {
    let px = maxPx;
    for (; px > minPx; px -= 2) {
      ctx.font = `${peso} ${px}px ${familia}`;
      if (ctx.measureText(texto).width <= larguraMax) return px;
    }
    ctx.font = `${peso} ${minPx}px ${familia}`;
    return minPx;
  }

  function linhaPontilhada(ctx, x1, x2, y, cor) {
    ctx.fillStyle = cor;
    for (let x = x1; x < x2; x += 16) ctx.fillRect(x, y, 8, 6);
  }

  function moldura(ctx) {
    ctx.fillStyle = COR.papel;
    ctx.fillRect(0, 0, L, A);

    // Quadradinhos de "poeira de estrela" no papel (sempre nos mesmos lugares)
    let semente = 7;
    const sorteio = () => { semente = (semente * 9301 + 49297) % 233280; return semente / 233280; };
    ctx.fillStyle = COR.papelSombra;
    for (let i = 0; i < 160; i++) {
      const s = 6 + Math.floor(sorteio() * 3) * 2;
      ctx.fillRect(80 + Math.floor(sorteio() * (L - 160)), 80 + Math.floor(sorteio() * (A - 160)), s, s);
    }

    // Borda em blocos grossos (escura, laranja, papel) + filete e cantos
    ctx.fillStyle = COR.linha;
    ctx.fillRect(20, 20, L - 40, A - 40);
    ctx.fillStyle = COR.acento;
    ctx.fillRect(34, 34, L - 68, A - 68);
    ctx.fillStyle = COR.papel;
    ctx.fillRect(46, 46, L - 92, A - 92);
    ctx.strokeStyle = COR.linha;
    ctx.lineWidth = 4;
    ctx.strokeRect(64, 64, L - 128, A - 128);
    [[64, 64], [L - 88, 64], [64, A - 88], [L - 88, A - 88]].forEach((c) => {
      ctx.fillStyle = COR.acento;
      ctx.fillRect(c[0], c[1], 24, 24);
      ctx.fillStyle = COR.linha;
      ctx.fillRect(c[0] + 6, c[1] + 6, 12, 12);
    });
  }

  // ---------- Desenhar o certificado ----------
  // opcoes.semLogo = true: não usa o logo da NASA (plano B do download, veja "baixar")
  async function desenhar(canvas, d, opcoes) {
    const semLogo = Boolean(opcoes && opcoes.semLogo);
    const vez = (canvas._certVez = (canvas._certVez || 0) + 1);

    const [, logo] = await Promise.all([carregarFontes(), semLogo ? null : carregarLogoNasa()]);
    if (vez !== canvas._certVez) return null;     // outro desenho começou depois (ex.: trocou de idioma)

    canvas.width = L;
    canvas.height = A;
    const ctx = canvas.getContext("2d");
    // A Pixelify Sans junta "fi" num desenho que parece um "A" ("Am" em vez de "fim"): desliga as ligaduras
    try { ctx.textRendering = "optimizeSpeed"; } catch (e) { /* navegador antigo */ }
    const tx = semLigadura(d.textos || {});
    d = Object.assign({}, d, { nome: semLigadura(d.nome || "") });
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";

    moldura(ctx);

    // --- Topo: logo do jogo (esquerda) e logo da NASA (direita) ---
    pixels(ctx, MARTE, 130, 104, 12, COR.marte);
    pixels(ctx, MARTE_SOMBRA, 130, 104, 12, COR.marteEscuro);
    ctx.fillStyle = COR.marteEscuro;
    ctx.font = `64px ${FONTE.logo}`;
    ctx.fillText("Projeto Ares", 256, 178);

    const caixa = { x: L - 130 - 340, y: 100, w: 340, h: 112 };
    let desenhouLogo = false;
    if (logo) {
      try {
        const lw = logo.naturalWidth || logo.width || 300;
        const lh = logo.naturalHeight || logo.height || 120;
        const esc = Math.min(caixa.w / lw, caixa.h / lh);
        const w = lw * esc;
        const h = lh * esc;
        ctx.drawImage(logo, caixa.x + caixa.w - w, caixa.y + (caixa.h - h) / 2, w, h);
        desenhouLogo = true;
      } catch (e) { desenhouLogo = false; }
    }
    if (!desenhouLogo) {
      ctx.fillStyle = COR.suave;
      ctx.textAlign = "right";
      ctx.font = `600 26px ${FONTE.texto}`;
      quebrar(ctx, tx.nasa || "NASA Space Apps Challenge 2026", caixa.w).forEach((linha, i) => {
        ctx.fillText(linha, caixa.x + caixa.w, caixa.y + 52 + i * 34);
      });
      ctx.textAlign = "left";
    }
    linhaPontilhada(ctx, 130, L - 130, 236, COR.acento);

    // --- Título e "Parabéns," ---
    ctx.textAlign = "center";
    ctx.fillStyle = COR.acentoEscuro;
    ajustarFonte(ctx, String(tx.titulo || "").toUpperCase(), "400", FONTE.titulo, 56, 28, 1240);
    ctx.fillText(String(tx.titulo || "").toUpperCase(), L / 2, 322);

    ctx.fillStyle = COR.tinta;
    ctx.font = `600 42px ${FONTE.texto}`;
    ctx.fillText(tx.parabens || "", L / 2, 398);

    // --- Nome do jogador (a fonte diminui se o nome for comprido) ---
    ctx.fillStyle = COR.marteEscuro;
    ajustarFonte(ctx, d.nome || "", "700", FONTE.texto, 104, 44, 1200);
    ctx.fillText(d.nome || "", L / 2, 506);
    ctx.fillStyle = COR.acento;
    ctx.fillRect(L / 2 - 500, 528, 1000, 6);

    // --- Texto da missão (até 3 linhas) ---
    ctx.fillStyle = COR.tinta;
    ctx.font = `400 38px ${FONTE.texto}`;
    quebrar(ctx, tx.texto || "", 1200).slice(0, 3).forEach((linha, i) => {
      ctx.fillText(linha, L / 2, 602 + i * 50);
    });

    // --- Estrelas (1 a 3) ---
    const total = 3;
    const ligadas = Math.max(0, Math.min(total, d.estrelas || 0));
    const escala = 7;
    const tam = 12 * escala;
    const folga = 28;
    const x0 = (L - (total * tam + (total - 1) * folga)) / 2;
    for (let i = 0; i < total; i++) {
      const x = x0 + i * (tam + folga);
      pixels(ctx, ESTRELA, x + 5, 745 + 5, escala, COR.linha);                      // sombra dura
      pixels(ctx, ESTRELA, x, 745, escala, i < ligadas ? COR.estrelaOn : COR.estrelaOff);
    }

    // --- Detalhes, data, créditos ---
    ctx.fillStyle = COR.linha;
    ctx.font = `600 30px ${FONTE.texto}`;
    ctx.fillText(tx.detalhes || "", L / 2, 884);

    ctx.fillStyle = COR.tinta;
    ctx.font = `400 28px ${FONTE.texto}`;
    ctx.fillText(tx.data || "", L / 2, 934);

    linhaPontilhada(ctx, 130, L - 130, 962, COR.acento);

    ctx.fillStyle = COR.acentoEscuro;
    ctx.font = `16px ${FONTE.titulo}`;
    ctx.fillText(tx.credito || "", L / 2, 1002);

    ctx.fillStyle = COR.suave;
    ctx.font = `400 22px ${FONTE.texto}`;
    ctx.fillText(tx.aviso || "", L / 2, 1036);

    return { comLogo: desenhouLogo };
  }

  // ---------- Baixar como imagem PNG ----------
  async function baixar(canvas, d) {
    const arquivo = (d && d.arquivo ? d.arquivo : "certificado-projeto-ares") + ".png";

    const paraBlob = (cv) => new Promise((ok, erro) => {
      try { cv.toBlob((b) => (b ? ok(b) : erro(new Error("vazio"))), "image/png"); } catch (e) { erro(e); }
    });
    const salvar = (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = arquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    };

    try {
      salvar(await paraBlob(canvas));
      return true;
    } catch (e) {
      // Abrindo o index.html direto do computador (file://), o navegador "trava" o canvas por causa
      // da imagem do logo. Plano B: desenha de novo, sem o logo, só para baixar.
      try {
        const copia = document.createElement("canvas");
        await desenhar(copia, d, { semLogo: true });
        salvar(await paraBlob(copia));
        return true;
      } catch (e2) { return false; /* sem como baixar neste navegador */ }
    }
  }

  window.ARES.certificado = { desenhar, baixar, LARGURA: L, ALTURA: A };
})();
