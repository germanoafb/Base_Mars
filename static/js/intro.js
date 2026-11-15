/* Abertura interativa do Projeto Ares
   - tripulação (Lia, Davi e Yara) em pixel art, com as mesmas cores do jogo
   - animações curtas em "passos", no estilo do resto do jogo
   - trilha de viagem gerada por código (sem mp3) + efeitos de contagem e chegada */
(() => {
  "use strict";

  // O tutorial do Orbi aguarda a abertura terminar.
  window.ARES_INTRO_ATIVA = true;
  const t = (key) => window.I18N ? window.I18N.t(key) : key;

  /* =========================================================
     TRIPULAÇÃO (mesmas cores do TRIPULACAO do main.js)
     ========================================================= */
  const T = [
    { nome: "Lia",  pele: "#f1c27d", cabelo: "#3b2a20", traje: "#ff8a4c" },
    { nome: "Davi", pele: "#8d5524", cabelo: "#1b1b1b", traje: "#6fd3ff" },
    { nome: "Yara", pele: "#e0ac69", cabelo: "#a0522d", traje: "#6ee08a" }
  ];

  // Astronauta de corpo inteiro, 12x16 quadradinhos.
  // o contorno, w capacete, h cabelo, s pele, e olho, t traje, g luva, y luz do peito, b bota
  const SPRITE = [
    "...oooooo...",
    "..owwwwwwo..",
    ".owhhhhhhwo.",
    ".owhsssshwo.",
    ".owsesseswo.",
    ".owsssssswo.",
    "..owsssswo..",
    "...oowwoo...",
    "..tttttttt..",
    ".gttttttttg.",
    ".gttyyyyttg.",
    ".gttttttttg.",
    "..tttttttt..",
    "..ttt..ttt..",
    "..ttt..ttt..",
    "..bbb..bbb.."
  ];

  // Desenha um astronauta. mov = animação de deslocamento, bob = animação de balanço,
  // d = atraso (s), costas = visto de costas (olhando pela janela)
  function astro(p, x, y, s, o = {}) {
    const cor = {
      o: "#5a3040", w: "#ffe9d6", h: p.cabelo,
      s: o.costas ? p.cabelo : p.pele,
      e: o.costas ? p.cabelo : "#1a0f14",
      t: p.traje, g: "#d9b8a4", y: "#ffd24a", b: "#5a3040"
    };
    let r = "";
    SPRITE.forEach((linha, j) => {
      let i = 0;
      while (i < linha.length) {
        const c = linha[i];
        let k = i;
        while (k < linha.length && linha[k] === c) k++;
        if (c !== ".") r += `<rect x="${i * s}" y="${j * s}" width="${(k - i) * s}" height="${s}" fill="${cor[c]}"/>`;
        i = k;
      }
    });
    const d = `style="--d:${o.d || 0}s"`;
    return `<g transform="translate(${x} ${y})"><g class="anim ${o.mov || ""}" ${d}><g class="anim ${o.bob || ""}" ${d}>${r}</g></g></g>`;
  }

  // Carinha de 10x14 para aparecer na janelinha do foguete
  const mini = (p, x, y) =>
    `<rect x="${x}" y="${y}" width="10" height="4" fill="${p.cabelo}"/>` +
    `<rect x="${x}" y="${y + 4}" width="10" height="6" fill="${p.pele}"/>` +
    `<rect x="${x}" y="${y + 10}" width="10" height="4" fill="${p.traje}"/>`;

  /* =========================================================
     PEÇAS DE CENÁRIO
     ========================================================= */
  const FUNDO = `<rect width="900" height="330" fill="#101329"/>`;

  const ESTRELAS = `
    <g class="anim pisca" fill="#ffe9d6"><path d="M70 45h5v5h-5zM300 35h5v5h-5zM650 130h4v4h-4zM820 220h5v5h-5zM120 230h4v4h-4zM560 60h4v4h-4z"/></g>
    <g class="anim pisca" style="--d:.6s" fill="#ffe9d6"><path d="M180 90h4v4h-4zM760 58h5v5h-5zM440 65h4v4h-4zM840 120h4v4h-4zM240 270h4v4h-4zM700 260h5v5h-5z"/></g>`;

  const CHAO = `<rect y="300" width="900" height="30" fill="#50303a"/><rect y="296" width="900" height="4" fill="#8b6572"/>`;

  // Terra e Marte desenhados em volta do ponto (0,0), raio 100
  const TERRA = `
    <circle r="100" fill="#245a9c"/>
    <path d="M-60-40L-25-62L10-50L28-22L0-6L-8 26L-46 34L-70 6Z" fill="#58a96d"/>
    <path d="M34 22L70 6L84 28L68 58L30 62L18 40Z" fill="#58a96d"/>
    <path d="M-30 50L-4 44L8 68L-14 82L-34 70Z" fill="#58a96d"/>
    <path d="M-70-50Q0-105 70-50" fill="none" stroke="#6fd3ff" stroke-width="6" opacity=".5"/>`;

  const MARTE = `
    <circle r="100" fill="#c65335"/>
    <path d="M-50-30L-10-58L26-44L40-14L4 0L-14 30L-56 14Z" fill="#8f382e"/>
    <path d="M20 30L60 12L78 38L58 68L22 62Z" fill="#8f382e"/>
    <path d="M-62 40L-34 28L-16 52L-40 74L-62 64Z" fill="#8f382e"/>`;

  // Foguete em volta do ponto (0,0), ponta para cima
  const foguete = (chama, crew) => `
    <path d="M0-90 Q55-40 36 42 L-36 42 Q-55-40 0-90" fill="#e8e5dc" stroke="#5a3040" stroke-width="7"/>
    <circle cy="-20" r="18" fill="${crew ? "#254a66" : "#6fd3ff"}" stroke="#5a3040" stroke-width="7"/>
    ${crew ? mini(T[0], -16, -28) + mini(T[1], -5, -28) + mini(T[2], 6, -28) : ""}
    <path d="M-36 20l-35 45 35-5M36 20l35 45-35-5" fill="#e8673c" stroke="#5a3040" stroke-width="6"/>
    ${chama ? `<path class="anim flame ${chama}" d="M-23 42L0 105 23 42z" fill="#ffd24a"/><path d="M-12 45L0 80 12 45z" fill="#ff8a4c"/>` : ""}`;

  const texto = (x, y, tam, cor, str, extra = "") =>
    `<text x="${x}" y="${y}" fill="${cor}" font-size="${tam}" text-anchor="middle" font-family="monospace" ${extra}>${str}</text>`;

  /* =========================================================
     CENAS
     ========================================================= */
  const scenes = [
    {
      tag: "intro_tag_0",
      title: "intro_titulo_0",
      text: "intro_texto_0",
      art: "earth"
    },
    {
      tag: "intro_tag_1",
      title: "intro_titulo_1",
      text: "intro_texto_1",
      art: "embark"
    },
    {
      tag: "intro_tag_2",
      title: "intro_titulo_2",
      text: "intro_texto_2",
      art: "launch"
    },
    {
      tag: "intro_tag_3",
      title: "intro_titulo_3",
      text: "intro_texto_3",
      art: "space"
    },
    {
      tag: "intro_tag_4",
      title: "intro_titulo_4",
      text: "intro_texto_4",
      art: "cabin"
    },
    {
      tag: "intro_tag_5",
      title: "intro_titulo_5",
      text: "intro_texto_5",
      art: "ship"
    },
    {
      tag: "intro_tag_6",
      title: "intro_titulo_6",
      text: "intro_texto_6",
      art: "mars"
    }
  ];

  const art = {
    // 1. Tripulação alinhada, com a Terra atrás
    earth: () => `${FUNDO}${ESTRELAS}
      <g transform="translate(450 115) scale(.95)">${TERRA}</g>
      ${CHAO}
      ${astro(T[0], 330, 204, 6, { bob: "respira", d: 0 })}
      ${astro(T[1], 414, 204, 6, { bob: "respira", d: .15 })}
      ${astro(T[2], 498, 204, 6, { bob: "respira", d: .3 })}
      ${T.map((p, i) => texto(366 + i * 84, 320, 13, "#ffe9d6", p.nome.toUpperCase())).join("")}`,

    // 2. Caminhando até a nave
    embark: () => `${FUNDO}${ESTRELAS}
      ${CHAO}
      <rect x="760" y="100" width="18" height="196" fill="#50303a" stroke="#8b6572" stroke-width="4"/>
      <path d="M760 150h-60M760 210h-60" stroke="#8b6572" stroke-width="5"/>
      <g transform="translate(620 196) scale(1.6)">${foguete("", false)}</g>
      ${astro(T[0], 230, 204, 6, { mov: "caminha", bob: "passo", d: 0 })}
      ${astro(T[1], 314, 204, 6, { mov: "caminha", bob: "passo", d: .1 })}
      ${astro(T[2], 398, 204, 6, { mov: "caminha", bob: "passo", d: .2 })}`,

    // 3. Contagem regressiva e decolagem (tripulação na janelinha)
    launch: () => `${FUNDO}${ESTRELAS}
      ${[["3", "0s"], ["2", ".6s"], ["1", "1.2s"]].map(([n, d]) =>
        [230, 670].map(x => `<text class="cont" style="--d:${d}" x="${x}" y="190" fill="#ffd24a" stroke="#5a3040" stroke-width="10" paint-order="stroke" font-size="84" text-anchor="middle" font-family="'Press Start 2P', monospace">${n}</text>`).join("")
      ).join("")}
      ${CHAO}
      <g transform="translate(450 170) scale(1.3)"><g class="anim decola">${foguete("flame-late", true)}</g></g>
      <rect class="anim fumaca-e" x="410" y="272" width="26" height="26" fill="#ffe9d6"/>
      <rect class="anim fumaca-e" style="--d:.25s" x="380" y="280" width="20" height="20" fill="#d9b8a4"/>
      <rect class="anim fumaca-d" x="464" y="272" width="26" height="26" fill="#ffe9d6"/>
      <rect class="anim fumaca-d" style="--d:.25s" x="500" y="280" width="20" height="20" fill="#d9b8a4"/>
      ${texto(450, 321, 15, "#ffd18c", t("intro_art_lancamento"))}`,

    // 4. A nave viajando, a Terra encolhendo
    space: () => `${FUNDO}${ESTRELAS}
      <g transform="translate(240 170) scale(.72)"><g class="anim earth">${TERRA}</g></g>
      <path d="M310 160Q430 70 540 135" fill="none" stroke="#ffd24a" stroke-width="3" stroke-dasharray="9 12"/>
      <g transform="translate(600 155) rotate(25) scale(.85)"><g class="anim voa">${foguete("flame", true)}</g></g>
      ${texto(240, 275, 16, "#ffe9d6", t("intro_art_terra"))}
      ${texto(600, 275, 16, "#ffe9d6", t("intro_art_nave"))}`,

    // 5. Tripulação flutuando diante da janela, Marte bem pequeno ao longe
    cabin: () => `<rect width="900" height="330" fill="#172333"/>
      <rect x="200" y="28" width="500" height="214" fill="#101329" stroke="#8b6572" stroke-width="8"/>
      <g class="anim pisca" fill="#ffe9d6"><path d="M230 60h5v5h-5zM330 200h4v4h-4zM420 50h4v4h-4zM540 90h5v5h-5zM660 200h4v4h-4zM600 60h4v4h-4z"/></g>
      <g class="anim pisca" style="--d:.6s" fill="#ffe9d6"><path d="M270 150h4v4h-4zM380 80h5v5h-5zM500 210h4v4h-4zM640 120h4v4h-4zM470 150h4v4h-4z"/></g>
      <g transform="translate(290 110) scale(.38)"><g class="anim earth">${TERRA}</g></g>
      <rect class="anim marte-longe" x="624" y="96" width="12" height="12" fill="#c65335"/>
      <rect x="446" y="28" width="8" height="214" fill="#8b6572"/>
      <rect y="256" width="900" height="74" fill="#3a2029"/><rect y="252" width="900" height="4" fill="#5a3040"/>
      ${astro(T[0], 330, 160, 6, { costas: true, bob: "flutua", d: 0 })}
      ${astro(T[1], 414, 160, 6, { costas: true, bob: "flutua", d: .4 })}
      ${astro(T[2], 498, 160, 6, { costas: true, bob: "flutua", d: .8 })}
      ${texto(450, 304, 15, "#d9b8a4", t("intro_art_dia"))}`,

    // 6. Painel da nave com a tripulação em frente
    ship: () => `${FUNDO}
      <rect x="80" y="15" width="740" height="205" fill="#263344" stroke="#8b6572" stroke-width="8"/>
      <rect x="105" y="35" width="690" height="165" fill="#172333" stroke="#5a3040" stroke-width="5"/>
      <rect x="130" y="55" width="210" height="125" fill="#101329" stroke="#6fd3ff" stroke-width="5"/>
      <g transform="translate(235 118) scale(.5)">${TERRA}</g>
      <g font-family="monospace" font-size="17" text-anchor="middle">
        <g class="anim pisca" style="--d:0s"><rect x="385" y="60" width="150" height="48" fill="#21465a" stroke="#6fd3ff" stroke-width="4"/>${texto(460, 90, 17, "#6fd3ff", t("intro_art_ar"))}</g>
        <g class="anim pisca" style="--d:.3s"><rect x="565" y="60" width="190" height="48" fill="#24452d" stroke="#6be37a" stroke-width="4"/>${texto(660, 90, 17, "#6be37a", t("intro_art_comida"))}</g>
        <g class="anim pisca" style="--d:.6s"><rect x="385" y="130" width="150" height="48" fill="#263d68" stroke="#4f8dff" stroke-width="4"/>${texto(460, 160, 17, "#9abaff", t("intro_art_escudo"))}</g>
        <g class="anim pisca" style="--d:.9s"><rect x="565" y="130" width="190" height="48" fill="#3a2c55" stroke="#c59bff" stroke-width="4"/>${texto(660, 160, 17, "#d8bdff", t("intro_art_radio"))}</g>
      </g>
      ${astro(T[0], 330, 236, 5, { bob: "respira", d: 0 })}
      ${astro(T[1], 420, 236, 5, { bob: "respira", d: .15 })}
      ${astro(T[2], 510, 236, 5, { bob: "respira", d: .3 })}`,

    // 7. Chegada: a tripulação pula de alegria em Marte
    mars: () => `${FUNDO}${ESTRELAS}
      <g transform="translate(450 120)"><g class="anim mars">${MARTE}</g></g>
      <rect y="296" width="900" height="34" fill="#8f382e"/><rect y="296" width="900" height="4" fill="#c65335"/>
      <path d="M236 296v-34a24 24 0 0 1 48 0v34z" fill="#d9b8a4" stroke="#5a3040" stroke-width="5"/>
      <path d="M630 296v-44a30 30 0 0 1 60 0v44z" fill="#d9b8a4" stroke="#5a3040" stroke-width="5"/>
      <path d="M252 296v-14h16v14M650 296v-18h20v18" fill="#ff8a4c"/>
      ${astro(T[0], 330, 200, 6, { bob: "pula", d: 0 })}
      ${astro(T[1], 414, 200, 6, { bob: "pula", d: .18 })}
      ${astro(T[2], 498, 200, 6, { bob: "pula", d: .36 })}
      ${texto(450, 319, 15, "#ffe9d6", t("intro_art_marte"))}`
  };

  /* =========================================================
     MÚSICA DE VIAGEM (gerada por código, sem arquivo de áudio)
     Calma e flutuante, mais lenta que a trilha do jogo:
     pads suaves + arpejo com eco + baixo + "batidinha de coração".
     O navegador só libera som depois do 1º toque, por isso começa num clique.
     ========================================================= */
  const Musica = (() => {
    const BPM = 88;
    const PASSO = 60 / BPM / 4;     // 1/16 de compasso
    const VOLUME = 0.28;            // 0 a 1: mexa aqui se estiver alto ou baixo
    const ACORDES = [
      [146.83, 174.61, 220.00, 261.63],  // Ré menor
      [116.54, 146.83, 174.61, 233.08],  // Si bemol
      [174.61, 220.00, 261.63, 349.23],  // Fá
      [130.81, 164.81, 196.00, 261.63]   // Dó
    ];
    const BAIXOS = [73.42, 58.27, 87.31, 65.41];
    const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
    const BLIPS = [1046.50, 1318.51, 1567.98, 2093.00];

    let ctx = null, bus = null, sfx = null, eco = null, ruido = null, timer = null;
    let ativo = false, mudo = false, proxima = 0, passo = 0;

    // Começa no mesmo estado de mudo que o jogo
    try { mudo = !!(window.SOM && window.SOM.estaMudo()); } catch (e) {}

    function criar() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.connect(ctx.destination);
      bus = ctx.createGain(); bus.gain.value = 0; bus.connect(comp);
      sfx = ctx.createGain(); sfx.gain.value = 0.6; sfx.connect(comp);
      // Eco rítmico (3 passos): dá a sensação de espaço
      eco = ctx.createDelay(1); eco.delayTime.value = PASSO * 3;
      const volta = ctx.createGain(); volta.gain.value = 0.35;
      const saida = ctx.createGain(); saida.gain.value = 0.4;
      eco.connect(volta); volta.connect(eco); eco.connect(saida); saida.connect(bus);
      // Ruído branco (usado no estrondo do foguete)
      ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const dados = ruido.getChannelData(0);
      for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;
      return true;
    }

    function pad(freq, t0, dur) {
      const filtro = ctx.createBiquadFilter();
      const g = ctx.createGain();
      filtro.type = "lowpass";
      filtro.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.028, t0 + 0.7);
      g.gain.setValueAtTime(0.028, t0 + dur - 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.3);
      [-6, 6].forEach(cents => {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = freq;
        osc.detune.value = cents;
        osc.connect(filtro);
        osc.start(t0);
        osc.stop(t0 + dur + 0.4);
      });
      filtro.connect(g); g.connect(bus);
    }

    function baixo(freq, t0) {
      const osc = ctx.createOscillator();
      const filtro = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      filtro.type = "lowpass";
      filtro.frequency.value = 420;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.17, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);
      osc.connect(filtro); filtro.connect(g); g.connect(bus);
      osc.start(t0);
      osc.stop(t0 + 1.05);
    }

    function pluck(freq, t0) {
      const osc = ctx.createOscillator();
      const filtro = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      filtro.type = "lowpass";
      filtro.frequency.setValueAtTime(2600, t0);
      filtro.frequency.exponentialRampToValueAtTime(800, t0 + 0.2);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.04, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      osc.connect(filtro); filtro.connect(g); g.connect(bus);
      const envio = ctx.createGain(); envio.gain.value = 0.6;
      g.connect(envio); envio.connect(eco);
      osc.start(t0);
      osc.stop(t0 + 0.4);
    }

    function coracao(t0) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(120, t0);
      osc.frequency.exponentialRampToValueAtTime(42, t0 + 0.14);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.16, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      osc.connect(g); g.connect(bus);
      osc.start(t0);
      osc.stop(t0 + 0.3);
    }

    function blip(freq, t0) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t0 + 0.08);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.035, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      osc.connect(g); g.connect(bus);
      const envio = ctx.createGain(); envio.gain.value = 0.7;
      g.connect(envio); envio.connect(eco);
      osc.start(t0);
      osc.stop(t0 + 0.18);
    }

    function tocarPasso(n, t) {
      const s = n % 16;
      const compasso = Math.floor(n / 16) % 4;
      const acorde = ACORDES[compasso];
      if (s === 0) {
        acorde.forEach(f => pad(f, t, PASSO * 16));
        baixo(BAIXOS[compasso], t);
        coracao(t);
      }
      if (s === 8) { baixo(BAIXOS[compasso], t); coracao(t); }
      if (s % 2 === 0) pluck(acorde[ARP[(s / 2) % 8]] * 2, t);
      if (s === 14 && Math.random() < 0.3) blip(BLIPS[Math.floor(Math.random() * BLIPS.length)], t);
    }

    // Agenda os passos um pouquinho antes da hora (não perde o ritmo se a aba travar)
    function agendar() {
      if (!ctx || !ativo) return;
      while (proxima < ctx.currentTime + 0.5) {
        tocarPasso(passo, proxima);
        proxima += PASSO;
        passo += 1;
      }
    }

    function iniciar() {
      if (mudo || ativo) return;
      try {
        if (!ctx && !criar()) return;
        if (ctx.state === "suspended") ctx.resume();
        ativo = true;
        proxima = ctx.currentTime + 0.1;
        passo = 0;
        bus.gain.setTargetAtTime(VOLUME, ctx.currentTime, 0.4);
        agendar();
        timer = setInterval(agendar, 100);
      } catch (e) { ativo = false; }
    }

    function pausar() {
      ativo = false;
      clearInterval(timer);
      if (ctx) bus.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    }

    // ---------- efeitos ----------
    function beep(freq, t0, dur, tipo) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = tipo || "square";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.12, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g); g.connect(sfx);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    function estrondo(t0, dur) {
      const fonte = ctx.createBufferSource();
      const filtro = ctx.createBiquadFilter();
      const g = ctx.createGain();
      fonte.buffer = ruido;
      fonte.loop = true;
      filtro.type = "lowpass";
      filtro.frequency.setValueAtTime(200, t0);
      filtro.frequency.exponentialRampToValueAtTime(1200, t0 + dur * 0.8);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.35, t0 + 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      fonte.connect(filtro); filtro.connect(g); g.connect(sfx);
      fonte.start(t0);
      fonte.stop(t0 + dur + 0.05);
      const osc = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(70, t0);
      osc.frequency.exponentialRampToValueAtTime(420, t0 + dur * 0.9);
      g2.gain.setValueAtTime(0.0001, t0);
      g2.gain.linearRampToValueAtTime(0.2, t0 + 0.4);
      g2.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g2); g2.connect(sfx);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    }

    return {
      // Chamada em qualquer toque: libera o áudio do navegador e começa a música
      ligar() {
        if (mudo) return;
        if (ctx && ctx.state === "suspended") ctx.resume();
        iniciar();
      },
      // Botão ♪ SOM
      alternar() {
        if (!ativo && !mudo) { iniciar(); return; }
        mudo = !mudo;
        if (mudo) pausar(); else iniciar();
      },
      // Fecha a abertura: some devagar
      parar() {
        if (!ctx) return;
        const c = ctx;
        ativo = false;
        clearInterval(timer);
        bus.gain.setTargetAtTime(0, c.currentTime, 0.25);
        ctx = null;
        setTimeout(() => { try { c.close(); } catch (e) {} }, 1500);
      },
      pausaAba(escondida) {
        if (!ctx) return;
        if (escondida) ctx.suspend(); else if (ativo) ctx.resume();
      },
      // Efeitos de cena (a contagem combina com a animação da cena do lançamento)
      cena(nome) {
        if (!ctx || mudo) return;
        const t = ctx.currentTime + 0.02;
        if (nome === "launch") {
          [0, 0.6, 1.2].forEach(d => beep(440, t + d, 0.14));
          beep(880, t + 1.8, 0.35);
          estrondo(t + 1.8, 2.4);
        } else if (nome === "mars") {
          [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => beep(f, t + i * 0.12, i === 3 ? 0.4 : 0.12));
        }
      },
      clique() {
        if (!ctx || mudo) return;
        beep(523.25, ctx.currentTime + 0.01, 0.06);
      },
      estaMudo: () => mudo,
      tocando: () => ativo
    };
  })();

  /* =========================================================
     TELA
     ========================================================= */
  function iniciar() {
    if (document.getElementById("ares-intro")) return;

    const app = document.getElementById("app");
    if (!app) return;

    const root = document.createElement("section");
    root.id = "ares-intro";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", t("intro_aria"));

    root.innerHTML = `
      <div class="intro-shell">
        <div class="intro-top">
          <span>✦ PROJETO ARES</span>
          <span class="intro-top-dir">
            <button class="intro-lang secondary" type="button" data-a="lang" aria-label="${t("intro_idioma_aria")}">PT / EN</button>
            <button class="intro-som secondary" type="button" data-intro="som" aria-pressed="false" aria-label="${t("intro_som_aria")}"><svg class="ico" aria-hidden="true"><use href="#i-som"></use></svg> ${t("intro_som")}</button>
            <span class="intro-progress" aria-label="${t("intro_progresso")}"></span>
          </span>
        </div>
        <button class="intro-skip secondary" type="button" data-intro="skip">${t("intro_pular")}</button>
        <div class="intro-art" aria-hidden="true"></div>
        <div class="intro-copy" aria-live="polite">
          <div class="intro-kicker"></div>
          <h1></h1>
          <p class="intro-description"></p>
        </div>
        <div class="intro-actions">
          <button class="secondary" type="button" data-intro="back">${t("intro_voltar")}</button>
          <button type="button" data-intro="next">${t("intro_proximo")}</button>
        </div>
      </div>`;

    document.body.appendChild(root);
    let index = 0;

    const botaoSom = root.querySelector('[data-intro="som"]');
    const atualizarSom = () => {
      const mudo = Musica.estaMudo();
      // Mesmos ícones de pixel do botão de som do topo do jogo (definidos no index.html)
      botaoSom.innerHTML = `<svg class="ico" aria-hidden="true"><use href="#${mudo ? "i-mudo" : "i-som"}"></use></svg> ${t("intro_som")}`;
      botaoSom.setAttribute("aria-label", t("intro_som_aria"));
      botaoSom.setAttribute("aria-pressed", String(mudo));
      // Pisca chamando para ligar o som, até a música começar
      botaoSom.classList.toggle("chamar", !mudo && !Musica.tocando());
    };

    const render = () => {
      const scene = scenes[index];

      root.querySelector(".intro-art").innerHTML =
        `<svg viewBox="0 0 900 330" preserveAspectRatio="xMidYMid slice">${art[scene.art]()}</svg>`;

      root.querySelector(".intro-kicker").textContent = t(scene.tag);
      root.querySelector("h1").textContent = t(scene.title);
      root.querySelector(".intro-description").textContent = t(scene.text);
      root.setAttribute("aria-label", t("intro_aria"));
      root.querySelector('[data-a="lang"]').setAttribute("aria-label", t("intro_idioma_aria"));
      root.querySelector(".intro-progress").setAttribute("aria-label", t("intro_progresso"));

      root.querySelector(".intro-progress").innerHTML =
        scenes.map((_, i) => `<i class="${i <= index ? "active" : ""}"></i>`).join("");

      const back = root.querySelector('[data-intro="back"]');
      back.textContent = t("intro_voltar");
      back.disabled = index === 0;
      back.style.opacity = index === 0 ? ".35" : "1";

      root.querySelector('[data-intro="next"]').textContent =
        t(index === scenes.length - 1 ? "intro_iniciar" : "intro_proximo");
      root.querySelector('[data-intro="skip"]').textContent = t("intro_pular");

      root.querySelector('[data-intro="skip"]').hidden =
        index === scenes.length - 1;

      Musica.cena(scene.art);
    };
    window.addEventListener("ares:idioma", render);

    const fechar = () => {
      // A música do jogo assume no lugar da abertura (respeitando o mudo)
      const mudoIntro = Musica.estaMudo();
      Musica.parar();
      if (window.SOM) {
        try {
          if (window.SOM.estaMudo() !== mudoIntro) window.SOM.alternarMudo();
          // Com o tutorial do Orbi logo depois, a música do jogo só começa quando ele terminar
          if (!mudoIntro && !window.TUTORIAL) window.SOM.iniciar();
        } catch (e) {}
      }
      window.removeEventListener("ares:idioma", render);
      root.remove();
      window.ARES_INTRO_ATIVA = false;
      window.dispatchEvent(new Event("ares:intro:fechada"));
      app.focus({ preventScroll: true });
    };

    // Qualquer toque libera o áudio do navegador e começa a música
    const ligarSom = (event) => {
      if (event.target.closest && event.target.closest('[data-intro="som"]')) return;
      Musica.ligar();
      atualizarSom();
    };
    root.addEventListener("pointerdown", ligarSom);
    root.addEventListener("keydown", ligarSom);

    root.addEventListener("click", event => {
      const button = event.target.closest("[data-intro]");
      if (!button) return;

      if (button.dataset.intro === "som") {
        Musica.alternar();
        atualizarSom();
        return;
      }

      Musica.ligar();
      atualizarSom();

      if (button.dataset.intro === "skip") fechar();

      if (button.dataset.intro === "back" && index > 0) {
        index--;
        Musica.clique();
        render();
      }

      if (button.dataset.intro === "next") {
        if (index < scenes.length - 1) {
          index++;
          Musica.clique();
          render();
        } else {
          fechar();
        }
      }
    });

    root.addEventListener("keydown", event => {
      if (event.key === "Escape") fechar();

      if (event.key === "ArrowRight" && index < scenes.length - 1) {
        index++;
        Musica.clique();
        render();
      }

      if (event.key === "ArrowLeft" && index > 0) {
        index--;
        Musica.clique();
        render();
      }
    });

    // Economiza bateria: pausa o som quando a aba fica escondida
    document.addEventListener("visibilitychange", () => Musica.pausaAba(document.hidden));

    render();
    atualizarSom();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
