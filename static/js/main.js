// Ponto de entrada do jogo no navegador.
// Cuida só da TELA: monta o HTML de cada tela, lê os cliques do jogador
// e chama as regras em static/js/game/ (window.ARES.jogo).
// As regras do jogo NÃO ficam aqui.
//
// Ordem dos scripts no index.html: i18n.js → dados → game/*.js → main.js

(function () {
  "use strict";

  const { t, mudarIdioma, idiomaAtual, idiomaInicial } = window.I18N;
  const J = window.ARES.jogo;
  const C = J.CONFIG;
  const app = document.getElementById("app");

  // O que está na tela agora
  const ui = { tela: "lancamento", jogo: null };

  // Tripulação (rosto: cor da pele e do cabelo)
  const TRIPULACAO = [
    { nome: "Lia", papel: "papel_comandante", pele: "#f1c27d", cabelo: "#3b2a20" },
    { nome: "Davi", papel: "papel_engenheiro", pele: "#8d5524", cabelo: "#1b1b1b" },
    { nome: "Yara", papel: "papel_botanica", pele: "#e0ac69", cabelo: "#a0522d" },
  ];

  // ---------- Ajudantes ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ico = (id, cls = "ico") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const local = () => (idiomaAtual() === "en" ? "en-US" : "pt-BR");
  const mSv = (v) => (Math.round(v * 10) / 10).toLocaleString(local(), { maximumFractionDigits: 1 });

  function dataCurta(iso) {
    const d = iso ? new Date(iso) : null;
    if (!d || isNaN(d)) return "";
    return new Intl.DateTimeFormat(local(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
  }

  const textoRotulo = (r) => t(r.tipo === "dia" ? "rotulo_dia" : "rotulo_sol", { n: r.n });

  // Chip de previsão: seta + texto, cor conforme bom/ruim (nunca só a cor)
  function chip(direcao, sobeEhBom, texto) {
    const seta = direcao > 0 ? "▲" : direcao < 0 ? "▼" : "=";
    const tipo = direcao === 0 ? "neutra" : (direcao > 0) === sobeEhBom ? "bom" : "ruim";
    return `<span class="previsao previsao--${tipo}">${seta} ${texto}</span>`;
  }

  // Número com sinal para os efeitos (+4, −2, =)
  function chipEfeito(n) {
    if (n === 0) return `<span class="previsao previsao--neutra">=</span>`;
    return `<span class="previsao previsao--${n > 0 ? "bom" : "ruim"}">${n > 0 ? "+" : "−"}${Math.abs(n)}</span>`;
  }

  // Texto de uma entrada do diário, com os parâmetros já formatados
  function textoEntrada(entrada) {
    const p = Object.assign({}, entrada.p);
    if ("data" in p) p.data = dataCurta(p.data);
    if ("dose" in p) p.dose = mSv(p.dose);
    if ("classe" in p) p.classe = esc(p.classe);
    if ("fato" in p) p.fato = t("fato_" + p.fato);
    if ("op" in p) p.op = t("op_" + p.op);
    return `<b>${textoRotulo(entrada.rotulo)}:</b> ${t(entrada.chave, p)}`;
  }

  function classeEntrada(chave) {
    if (chave.startsWith("log_solar")) return "diario-item--solar";
    if (chave === "log_poeira" || chave === "log_filtro" || chave === "log_praga") return "diario-item--poeira";
    if (chave === "log_chegada" || chave === "log_terra") return "diario-item--bom";
    return "";
  }

  // ---------- TELA 1: lançamento ----------
  function telaLancamento() {
    const astronautas = TRIPULACAO.map((a) => `
      <li class="astronauta">
        <svg class="astronauta-rosto" style="--pele:${a.pele};--cabelo:${a.cabelo}" viewBox="0 0 64 64" aria-hidden="true"><use href="#i-astro"/></svg>
        <span class="astronauta-nome">${a.nome}</span>
        <span class="astronauta-papel">${t(a.papel)}</span>
      </li>`).join("");

    return `
    <section class="tela tela--lancamento" aria-labelledby="t-tela">
      <div class="cena-lancamento" aria-hidden="true">
        <svg viewBox="0 0 320 120" class="cena-svg">
          <circle cx="40" cy="120" r="70" fill="var(--terra)"/>
          <path d="M5 95q20-15 40-5t30-10" stroke="var(--comida)" stroke-width="10" fill="none" stroke-linecap="round" opacity=".8"/>
          <circle cx="280" cy="40" r="26" fill="var(--marte)"/>
          <circle cx="272" cy="34" r="5" fill="var(--marte-escuro)"/>
          <circle cx="290" cy="50" r="6" fill="var(--marte-escuro)"/>
          <path d="M80 70Q170 10 248 40" stroke="var(--texto-suave)" stroke-width="2.5" stroke-dasharray="2 9" stroke-linecap="round" fill="none"/>
        </svg>
        <svg class="nave-lancamento" viewBox="0 0 48 24"><use href="#i-ship"/></svg>
      </div>
      <h1 id="t-tela" tabindex="-1">${t("lanc_titulo")}</h1>
      <p class="lead">${t("lanc_lead")}</p>
      <p class="explica">${t("lanc_regras", { dias: C.viagem.turnos * C.viagem.diasPorTurno, sois: C.base.sois, energia: C.energiaPorTurno })}</p>
      <h2 class="subtitulo">${t("tripulacao")}</h2>
      <ul class="tripulacao">${astronautas}</ul>
      <button class="btn btn-principal" type="button" data-a="next">${ico("i-ship")} ${t("lancar")}</button>
    </section>`;
  }

  // ---------- Painel: energia + 3 barras ----------
  function barra(cls, icone, nome, valor, previsaoHtml, pct, pctPrev, aria, extra = "") {
    return `
      <div class="barra ${cls}">
        <div class="barra-topo">
          ${ico(icone)}
          <span class="barra-nome">${nome}</span>
          <span class="barra-num">${valor} ${previsaoHtml}</span>
        </div>
        <div class="barra-trilho" role="meter" aria-label="${esc(nome)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-valuetext="${esc(aria)}">
          <div class="barra-prev" style="--prev:${pctPrev}%"></div>
          <div class="barra-fill" style="--val:${pct}%"></div>
        </div>
        ${extra}
      </div>`;
  }

  function painel(e) {
    const prev = J.previsao(e);
    const pctRad = (v) => Math.min(100, (v / C.limiteCarreira) * 100);
    return `
      <div class="painel">
        <div class="energia" role="status">
          ${ico("i-energy", "ico ico--energia")}
          <span class="energia-rotulo">${t("energia_livre")}</span>
          <span class="energia-valor"><b>${J.energiaLivre(e)}</b> ${t("de")} ${J.energiaDisponivel(e)}</span>
        </div>
        <div class="barras">
          ${barra("barra--o2", "i-o2", t("oxigenio"), `${e.o2}%`, chip(prev.o2 - e.o2, true, `${prev.o2}%`), e.o2, prev.o2, `${e.o2}%`,
            `<p class="explica">${t("explica_suporte")}</p>`)}
          ${barra("barra--comida", "i-food", t("comida"), `${e.comida}%`, chip(prev.comida - e.comida, true, `${prev.comida}%`), e.comida, prev.comida, `${e.comida}%`)}
          ${barra("barra--rad", "i-rad", t("radiacao"), `${mSv(e.rad)} mSv`, chip(1, false, mSv(prev.rad)), pctRad(e.rad), pctRad(prev.rad), `${mSv(e.rad)} mSv`,
            `<p class="explica">${t("explica_msv")} ${t("rad_limite", { n: C.limiteCarreira })}</p>`)}
        </div>
      </div>`;
  }

  // ---------- Divisão de energia (− e +) ----------
  function linhaAlocacao(e, k, cls, icone, nomeChave, efeitoHtml) {
    const valor = e.alocacao[k];
    const livre = J.energiaLivre(e);
    const nome = t(nomeChave);
    let pontos = "";
    for (let i = 0; i < C.maxPorSistema; i++) pontos += `<i${i < valor ? ' class="on"' : ""}></i>`;
    return `
      <div class="aloc ${cls}">
        ${ico(icone)}
        <span class="aloc-nome">${nome}</span>
        <button class="btn-passo" type="button" data-a="adj" data-k="${k}" data-d="-1" aria-label="${esc(t("menos_" + k))}"${valor <= 0 ? " disabled" : ""}>−</button>
        <span class="aloc-pontos" role="img" aria-label="${esc(t("pontos_aria", { n: valor, max: C.maxPorSistema }))}">${pontos}</span>
        <button class="btn-passo" type="button" data-a="adj" data-k="${k}" data-d="1" aria-label="${esc(t("mais_" + k))}"${valor >= C.maxPorSistema || livre <= 0 ? " disabled" : ""}>+</button>
        ${efeitoHtml}
      </div>`;
  }

  function divisaoEnergia(e) {
    const ef = J.efeitoDosSistemas(e);
    const escudo = `<span class="previsao previsao--${ef.shield > 0 ? "bom" : "ruim"}">${ef.shield}%</span>`;
    const radio = ef.comms >= 2
      ? `<span class="previsao previsao--bom">${t("efeito_radio_aviso")}</span>`
      : ef.comms === 1
        ? `<span class="previsao previsao--neutra">${t("efeito_radio_msg")}</span>`
        : `<span class="previsao previsao--ruim">—</span>`;
    return `
      <div class="energia-divisao">
        <h2 class="subtitulo">${t("para_onde")}</h2>
        ${linhaAlocacao(e, "o2", "aloc--o2", "i-o2", "oxigenio", chipEfeito(ef.o2))}
        ${linhaAlocacao(e, "food", "aloc--comida", "i-food", "comida", chipEfeito(ef.food))}
        ${linhaAlocacao(e, "shield", "aloc--escudo", "i-shield", "escudo", escudo)}
        ${linhaAlocacao(e, "comms", "aloc--comms", "i-comms", "radio", radio)}
        <p class="explica">${t("explica_escudo_radio")}</p>
      </div>`;
  }

  // ---------- Carta de decisão (só eventos que a tripulação já conhece) ----------
  const ICONE_EVENTO = { poeira: "i-dust", solar: "i-flare", filtro: "i-o2", praga: "i-food" };

  // Chips com o efeito de cada opção: ícone + número (nunca só cor)
  function chipsEfeito(ef) {
    const itens = [];
    const add = (icone, nomeChave, n, texto, bom) =>
      itens.push(`<span class="efeito efeito--${bom ? "bom" : "ruim"}">${ico(icone)}<span class="sr-only">${t(nomeChave)}</span> ${texto}</span>`);
    const sinal = (n) => (n > 0 ? "+" : "−") + Math.abs(n);
    if (ef.o2) add("i-o2", "oxigenio", ef.o2, sinal(ef.o2), ef.o2 > 0);
    if (ef.consumoO2) add("i-o2", "oxigenio", -ef.consumoO2, sinal(-ef.consumoO2), ef.consumoO2 < 0);
    if (ef.comida) add("i-food", "comida", ef.comida, sinal(ef.comida), ef.comida > 0);
    if (ef.energia) add("i-energy", "energia", ef.energia, sinal(ef.energia), ef.energia > 0);
    if (ef.tempestade !== undefined) add("i-rad", "radiacao", 0, `−${Math.round((1 - ef.tempestade) * 100)}%`, true);
    return itens.length ? itens.join("") : `<span class="efeito efeito--neutro">${t("efeito_nenhum")}</span>`;
  }

  function cartaEvento(e) {
    const ev = e.evento;
    if (!ev || !ev.visivel) return "";
    const texto = ev.tipo === "solar"
      ? t("ev_solar_texto", { classe: esc(ev.classe), data: dataCurta(ev.data) })
      : t(`ev_${ev.tipo}_texto`);
    const opcoes = (ev.opcoes || []).map((id) => {
      const escolhida = ev.escolha === id;
      return `
          <button class="btn-escolha${escolhida ? " escolhida" : ""}" type="button" data-a="choose" data-id="${id}" aria-pressed="${escolhida}">
            <span class="escolha-texto">${t("op_" + id)}</span>
            <span class="escolha-efeitos">${chipsEfeito(window.ARES.eventos.efeitoDe(ev.tipo, id))}</span>
          </button>`;
    }).join("");
    return `
      <div class="evento evento--${ev.tipo}" role="group" aria-labelledby="ev-titulo">
        ${ico(ICONE_EVENTO[ev.tipo] || "i-flare")}
        <div class="evento-corpo">
          <h2 class="evento-titulo" id="ev-titulo">${t(`ev_${ev.tipo}_titulo`)}</h2>
          <p>${texto}</p>
          <p class="evento-pergunta">${t("ev_pergunta")}</p>
          <div class="escolhas">${opcoes}</div>
        </div>
      </div>`;
  }

  // ---------- Tripulação viva: rostos com expressão + uma fala ----------
  // humor: "feliz" | "preocupado" | "assustado"
  function rosto(pessoa, humor) {
    const boca = humor === "feliz"
      ? `<path d="M26 40q6 5 12 0" stroke="#1d1b38" stroke-width="2.6" stroke-linecap="round" fill="none"/>`
      : humor === "preocupado"
        ? `<path d="M27 42q5-3 10 0" stroke="#1d1b38" stroke-width="2.6" stroke-linecap="round" fill="none"/>`
        : `<ellipse cx="32" cy="42" rx="3.2" ry="4" fill="#1d1b38"/>`;
    const sobrancelhas = humor === "feliz" ? ""
      : humor === "preocupado"
        ? `<path d="M21 27l7 2M43 27l-7 2" stroke="#1d1b38" stroke-width="2.2" stroke-linecap="round"/>`
        : `<path d="M21 26l7-2M43 26l-7-2" stroke="#1d1b38" stroke-width="2.2" stroke-linecap="round"/>`;
    const suor = humor === "assustado" ? `<path d="M47 30q3 5 0 7q-3-2 0-7z" fill="#6fd3ff"/>` : "";
    return `
      <svg class="rosto-svg" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill="#f4f1ff"/>
        <circle cx="32" cy="32" r="30" fill="none" stroke="#c9c4ea" stroke-width="3"/>
        <rect x="12" y="15" width="40" height="34" rx="17" fill="${pessoa.pele}"/>
        <path d="M14 26c2-9 10-13 18-13s16 4 18 13c-6-4-12-5-18-5s-12 1-18 5z" fill="${pessoa.cabelo}"/>
        ${sobrancelhas}
        <circle cx="25" cy="33" r="2.8" fill="#1d1b38"/>
        <circle cx="39" cy="33" r="2.8" fill="#1d1b38"/>
        ${humor === "feliz" ? `<circle cx="20" cy="39" r="3" fill="#ff8fa3" opacity=".55"/><circle cx="44" cy="39" r="3" fill="#ff8fa3" opacity=".55"/>` : ""}
        ${boca}${suor}
      </svg>`;
  }

  // Quem está como, e quem fala o quê, a partir da previsão do turno
  function climaDaTripulacao(e) {
    const prev = J.previsao(e);
    const ev = e.evento && e.evento.visivel ? e.evento : null;
    const humorPor = (v) => (v < 25 ? "assustado" : v < 45 ? "preocupado" : "feliz");
    const tempestadePerigosa = ev && ev.tipo === "solar" && e.alocacao.shield < 3 && ev.escolha !== "abrigo";
    const humores = [
      humorPor(prev.o2),                                                      // Lia cuida do ar
      tempestadePerigosa ? "assustado" : ev || e.rad > 400 ? "preocupado" : "feliz",  // Davi: sistemas e radiação
      humorPor(prev.comida),                                                  // Yara cuida da estufa
    ];

    // Fala: a situação mais urgente primeiro. [quem fala (0 Lia, 1 Davi, 2 Yara), chave]
    let fala;
    if (ev && !ev.escolha) fala = ev.tipo === "solar" ? [1, "fala_tempestade"] : ev.tipo === "poeira" ? [1, "fala_poeira"] : ev.tipo === "praga" ? [2, "fala_praga"] : [0, "fala_escolha"];
    else if (prev.o2 < 25) fala = [0, "fala_ar_critico"];
    else if (prev.comida < 25) fala = [2, "fala_comida_critica"];
    else if (tempestadePerigosa) fala = [1, "fala_mais_escudo"];
    else if (J.energiaLivre(e) > 0) fala = [0, "fala_sobra"];
    else if (prev.o2 < 45) fala = [0, "fala_ar_baixo"];
    else if (prev.comida < 45) fala = [2, "fala_comida_baixa"];
    else if (e.fase === "base" && e.turno === 1) fala = [0, "fala_chegada"];
    else fala = [(e.turno + (e.fase === "base" ? 1 : 0)) % 3, "fala_tudo_bem_" + ((e.turno + (e.fase === "base" ? 1 : 0)) % 3)];
    return { humores, fala };
  }

  function tripulacaoViva(e) {
    const { humores, fala } = climaDaTripulacao(e);
    const rostos = TRIPULACAO.map((p, i) => `
        <li class="rosto rosto--${humores[i]}${fala[0] === i ? " rosto--falando" : ""}">
          ${rosto(p, humores[i])}
          <span class="rosto-nome">${p.nome}</span>
          <span class="sr-only">${t("humor_" + humores[i], { nome: p.nome })}</span>
        </li>`).join("");
    return `
      <div class="tripulacao-viva">
        <ul class="rostos">${rostos}</ul>
        <p class="fala fala--${fala[0]}" role="status"><b>${TRIPULACAO[fala[0]].nome}:</b> ${t(fala[1])}</p>
      </div>`;
  }

  // ---------- Cenas que reagem ao estado do jogo ----------
  // Estado visual: escudo (0 a 1), tempestade, poeira, alarme de ar, tamanho das plantas, rádio
  function estadoDaCena(e) {
    const prev = J.previsao(e);
    const ev = e.evento && e.evento.visivel ? e.evento : null;
    return {
      escudo: e.alocacao.shield / C.maxPorSistema,
      tempestade: Boolean(ev && ev.tipo === "solar"),
      poeira: Boolean(ev && ev.tipo === "poeira"),
      alarme: e.o2 < 30 || prev.o2 < 30,
      planta: Math.max(0.15, e.comida / 100),
      radio: e.alocacao.comms,
    };
  }

  function ondasRadio(x, y, n) {
    let ondas = "";
    for (let i = 1; i <= Math.min(n, 2); i++) {
      ondas += `<path d="M${x + 6 * i} ${y - 6 * i}a${8 * i} ${8 * i} 0 0 1 0 ${12 * i}" stroke="var(--comms)" stroke-width="2.5" fill="none" stroke-linecap="round" style="animation-delay:${i * 0.3}s"/>`;
    }
    return n > 0 ? `<g class="cena-ondas">${ondas}</g>` : "";
  }

  function plantas(x, y, escala, n) {
    let g = "";
    for (let i = 0; i < n; i++) {
      const h = 6 + 16 * escala;
      const px = x + i * 9;
      g += `<path d="M${px} ${y}v-${h}" stroke="var(--comida)" stroke-width="2.5" stroke-linecap="round"/>` +
        `<ellipse cx="${px - 3}" cy="${y - h * 0.6}" rx="${2 + 2 * escala}" ry="${1.5 + 1.5 * escala}" fill="var(--comida)"/>` +
        `<ellipse cx="${px + 3}" cy="${y - h}" rx="${2 + 2 * escala}" ry="${1.5 + 1.5 * escala}" fill="var(--comida)"/>`;
    }
    return g;
  }

  function cenaViagem(e) {
    const c = estadoDaCena(e);
    const p = (e.turno - 1) / C.viagem.turnos;
    const rTerra = 34 - 22 * p;
    const rMarte = 10 + 26 * p;
    return `
      <svg class="cena-jogo" viewBox="0 0 360 190" role="img" aria-label="${esc(t("cena_viagem_aria"))}">
        <g fill="#fff" opacity=".7"><circle cx="70" cy="30" r="1.2"/><circle cx="150" cy="18" r="1"/><circle cx="250" cy="40" r="1.4"/><circle cx="300" cy="150" r="1"/><circle cx="110" cy="160" r="1.3"/><circle cx="210" cy="170" r="1"/></g>
        <circle cx="34" cy="95" r="${rTerra}" fill="var(--terra)"/>
        <path d="M${34 - rTerra * 0.6} ${95 - rTerra * 0.2}q${rTerra * 0.4} -${rTerra * 0.3} ${rTerra * 0.8} 0" stroke="var(--comida)" stroke-width="${2 + rTerra / 8}" fill="none" stroke-linecap="round"/>
        <circle cx="326" cy="95" r="${rMarte}" fill="var(--marte)"/>
        <circle cx="${326 - rMarte * 0.3}" cy="${95 - rMarte * 0.25}" r="${rMarte * 0.22}" fill="var(--marte-escuro)"/>
        ${c.tempestade ? `<g class="cena-raios" stroke="var(--energia)" stroke-width="2" stroke-linecap="round" opacity=".8"><path d="M0 40l70 20"/><path d="M0 120l80 -10"/><path d="M0 170l60 -25"/></g><rect class="cena-tempestade" width="360" height="190" fill="var(--radiacao)"/>` : ""}
        <g class="cena-nave">
          <ellipse class="cena-escudo" cx="180" cy="95" rx="78" ry="50" fill="var(--escudo)" stroke="var(--escudo)" stroke-width="3" style="opacity:${(c.escudo * 0.9).toFixed(2)}"/>
          <svg x="120" y="65" width="120" height="60" viewBox="0 0 48 24"><use href="#i-ship"/></svg>
          <rect x="160" y="118" width="40" height="14" rx="7" fill="#2a2f6b" stroke="#c9c4ea" stroke-width="1.5"/>
          ${plantas(167, 129, c.planta * 0.45, 3)}
          ${c.alarme ? `<circle class="cena-alarme" cx="172" cy="70" r="6" fill="#ff4d4d"/>` : ""}
          ${ondasRadio(240, 95, c.radio)}
        </g>
      </svg>`;
  }

  function cenaBase(e) {
    const c = estadoDaCena(e);
    return `
      <svg class="cena-jogo cena-jogo--base" viewBox="0 0 360 190" role="img" aria-label="${esc(t("cena_base_aria"))}">
        <rect width="360" height="190" fill="#e9a27a"/>
        <circle cx="300" cy="40" r="12" fill="#fff4d6" opacity=".9"/>
        ${c.tempestade ? `<rect class="cena-tempestade" width="360" height="190" fill="var(--radiacao)"/>` : ""}
        <path d="M0 130q50-25 110-8t110-12 140 6v74H0z" fill="var(--marte-escuro)"/>
        <path d="M0 150q70-14 160 0t200-6v46H0z" fill="var(--marte)"/>
        <ellipse class="cena-escudo" cx="180" cy="152" rx="82" ry="58" fill="var(--escudo)" stroke="var(--escudo)" stroke-width="3" style="opacity:${(c.escudo * 0.9).toFixed(2)}"/>
        <path d="M60 165a30 30 0 0 1 60 0z" fill="rgba(110,224,138,.25)" stroke="#c9f5d4" stroke-width="2"/>
        ${plantas(73, 163, c.planta, 4)}
        <!-- Caixa d'água: o nível acompanha a barra de ar e água -->
        <rect x="122" y="134" width="14" height="32" rx="4" fill="#2a2f6b" stroke="#c9c4ea" stroke-width="1.5"/>
        <rect x="124" y="${136 + 28 * (1 - e.o2 / 100)}" width="10" height="${28 * e.o2 / 100}" rx="2" fill="var(--o2)"/>
        <rect x="140" y="128" width="80" height="38" rx="19" fill="#f4f1ff"/>
        <circle cx="162" cy="146" r="6" fill="var(--o2)"/><circle cx="198" cy="146" r="6" fill="var(--o2)"/>
        ${c.alarme ? `<circle class="cena-alarme" cx="180" cy="124" r="6" fill="#ff4d4d"/>` : ""}
        <g transform="translate(250 150)">
          <rect x="0" y="0" width="34" height="14" rx="2" fill="var(--escudo)" transform="skewX(-15)"/>
          <rect x="40" y="0" width="34" height="14" rx="2" fill="var(--escudo)" transform="skewX(-15)"/>
          ${c.poeira ? `<rect x="-4" y="0" width="80" height="14" fill="#a8612f" opacity=".75" transform="skewX(-15)"/>` : ""}
          <path d="M14 14v8M54 14v8" stroke="#c9c4ea" stroke-width="3"/>
        </g>
        <path d="M232 166V128M224 122h16" stroke="#c9c4ea" stroke-width="3" stroke-linecap="round"/>
        <circle cx="232" cy="120" r="5" fill="none" stroke="#f4f1ff" stroke-width="2.5"/>
        ${ondasRadio(236, 120, c.radio)}
        ${c.poeira ? `<g class="cena-poeira"><rect x="-60" width="480" height="190" fill="#b5652e" opacity=".35"/><path d="M-40 60q60-20 120 0t120 0 120 0 120 0" stroke="#f3c6a0" stroke-width="6" fill="none" opacity=".5"/><path d="M-60 100q60-20 120 0t120 0 120 0 120 0" stroke="#f3c6a0" stroke-width="4" fill="none" opacity=".4"/></g>` : ""}
      </svg>`;
  }

  // Últimas entradas do diário (as do turno anterior)
  function diarioUltimo(e) {
    const ultimo = e.diario.length ? e.diario[e.diario.length - 1].turno : null;
    const entradas = e.diario.filter((x) => x.turno === ultimo);
    const texto = entradas.length ? entradas.map((x) => `<p>${textoEntrada(x)}</p>`).join("") : `<p>${t("diario_vazio")}</p>`;
    return `<div class="diario-ultimo">${ico("i-log")}<div>${texto}</div></div>`;
  }

  // ---------- TELAS 2 e 3: viagem e base ----------
  function botoesJogo(e) {
    const ultimoViagem = e.fase === "viagem" && e.turno >= C.viagem.turnos;
    const ultimoSol = e.fase === "base" && e.turno >= C.base.sois;
    const chave = ultimoViagem ? "pousar" : ultimoSol ? "terminar" : e.fase === "viagem" ? "proximo_turno" : "proximo_sol";
    const esperando = J.precisaEscolher(e);
    return `
      <button class="btn btn-secundario" type="button" data-a="log">${ico("i-log")} ${t("ver_diario")}</button>
      ${esperando ? `<p class="dica-escolha" id="dica-escolha">${t("dica_escolha")}</p>` : ""}
      <button class="btn btn-principal" type="button" data-a="next"${esperando ? ' disabled aria-describedby="dica-escolha"' : ""}>${t(chave)}</button>`;
  }

  function telaViagem(e, quieto) {
    const total = C.viagem.turnos * C.viagem.diasPorTurno;
    const progresso = Math.round(((e.turno - 1) / C.viagem.turnos) * 100);
    return `
    <section class="tela tela--viagem${quieto ? " sem-animacao" : ""}" aria-labelledby="t-tela">
      <div class="cena mapa" style="--progresso:${progresso}%">
        <h1 id="t-tela" class="mapa-titulo" tabindex="-1">${t("viagem_titulo", { n: (e.turno - 1) * C.viagem.diasPorTurno + 1, total })}</h1>
        ${cenaViagem(e)}
        <div class="mapa-trilha" aria-hidden="true">
          <span class="mapa-ponto mapa-ponto--terra"></span>
          <div class="mapa-linha"><div class="mapa-feito"></div><svg class="mapa-nave" viewBox="0 0 48 24"><use href="#i-ship"/></svg></div>
          <span class="mapa-ponto mapa-ponto--marte"></span>
        </div>
        <p class="mapa-legenda"><span>${t("terra")}</span><span>${t("caminho", { n: progresso })}</span><span>${t("marte")}</span></p>
        ${tripulacaoViva(e)}
        ${e.turno === 1 ? `<p class="aviso aviso--rad">${ico("i-rad")} <span>${t("aviso_rad")}</span></p>` : ""}
      </div>
      ${cartaEvento(e)}
      ${painel(e)}
      ${divisaoEnergia(e)}
      ${diarioUltimo(e)}
      ${botoesJogo(e)}
    </section>`;
  }

  function telaBase(e, quieto) {
    return `
    <section class="tela tela--base${quieto ? " sem-animacao" : ""}" aria-labelledby="t-tela">
      <div class="cena">
        <div class="sol-cabecalho">
          ${ico("i-sol", "ico ico--sol")}
          <div>
            <h1 id="t-tela" class="sol-titulo" tabindex="-1">${t("sol_titulo", { n: e.turno, total: C.base.sois })}</h1>
            <p class="explica">${t("explica_sol")}</p>
          </div>
        </div>
        ${cenaBase(e)}
        ${tripulacaoViva(e)}
      </div>
      ${cartaEvento(e)}
      ${painel(e)}
      ${divisaoEnergia(e)}
      ${diarioUltimo(e)}
      ${botoesJogo(e)}
    </section>`;
  }

  // ---------- TELA 4: diário de bordo ----------
  function telaDiario(e) {
    const itens = e.diario.slice().reverse()
      .map((x) => `<li class="diario-item ${classeEntrada(x.chave)}">${textoEntrada(x)}</li>`).join("");
    return `
    <section class="tela tela--diario" aria-labelledby="t-tela">
      <h1 id="t-tela" tabindex="-1">${ico("i-log")} ${t("diario")}</h1>
      ${itens ? `<ol class="diario">${itens}</ol>` : `<p class="explica">${t("diario_vazio")}</p>`}
      <button class="btn btn-principal" type="button" data-a="back">${t("voltar_jogo")}</button>
    </section>`;
  }

  // ---------- TELA 5: debriefing ----------
  function telaFim(e) {
    const r = J.avaliar(e);
    const lista = (itens) => itens.map((x) => {
      const p = Object.assign({}, x.p);
      if (p.quando) p.quando = textoRotulo(p.quando);
      return `<li>${t(x.chave, p)}</li>`;
    }).join("");

    const cedo = e.fim && e.fim.tipo === "cedo";
    const titulo = cedo ? t("fim_titulo_cedo") : t("fim_titulo");
    const lead = cedo
      ? t(e.fim.motivo === "o2" ? "fim_lead_o2" : "fim_lead_comida", { quando: textoRotulo(e.fim.quando) })
      : t("fim_lead_ok", { dias: r.dias, sois: r.sois });

    return `
    <section class="tela tela--fim" aria-labelledby="t-tela">
      <div class="medalha" aria-hidden="true">
        <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="var(--energia)"/><path d="M32 16l4.7 9.6 10.6 1.5-7.7 7.5 1.8 10.5L32 40l-9.4 5.1 1.8-10.5-7.7-7.5 10.6-1.5z" fill="#fff"/></svg>
      </div>
      <h1 id="t-tela" tabindex="-1">${titulo}</h1>
      <p class="lead">${lead}</p>
      <ul class="resumo">
        <li>${ico("i-ship")}<b>${r.dias}</b> ${t("resumo_dias")}</li>
        <li>${ico("i-sol")}<b>${r.sois}</b> ${t("resumo_sois")}</li>
        <li>${ico("i-rad")}<b>${mSv(r.rad)}</b> mSv</li>
        <li>${ico("i-check")}<b>3</b> ${t("resumo_seguros")}</li>
      </ul>
      <p class="explica">${t("fim_comparacao", { dose: mSv(r.rad), anos: r.anosNaTerra })}</p>
      <div class="debrief debrief--certo">
        <h2>${ico("i-check")} ${t("deu_certo")}</h2>
        <ul>${lista(r.certo)}</ul>
      </div>
      <div class="debrief debrief--dica">
        <h2>${ico("i-idea")} ${t("proxima")}</h2>
        <ul>${lista(r.dica)}</ul>
      </div>
      <button class="btn btn-principal" type="button" data-a="restart">${t("jogar_de_novo")}</button>
    </section>`;
  }

  // ---------- Desenhar a tela atual ----------
  // quieto = sem animação de entrada (ao mexer nos botões − e +)
  // foco = "titulo" ou um seletor CSS do botão que deve receber o foco
  function desenhar({ quieto = false, foco = null } = {}) {
    const e = ui.jogo;
    let html;
    if (ui.tela === "lancamento") html = telaLancamento();
    else if (ui.tela === "diario") html = telaDiario(e);
    else if (ui.tela === "fim") html = telaFim(e);
    else html = e.fase === "viagem" ? telaViagem(e, quieto) : telaBase(e, quieto);
    app.innerHTML = html;

    if (foco === "titulo") {
      window.scrollTo(0, 0);
      const h1 = app.querySelector("h1");
      if (h1) h1.focus({ preventScroll: true });
    } else if (foco) {
      // Se o botão ficou desativado, foca o outro botão da mesma linha
      const alvo = app.querySelector(foco);
      const alternativo = alvo && alvo.closest(".aloc") && alvo.closest(".aloc").querySelector(".btn-passo:not(:disabled)");
      const escolhido = alvo && !alvo.disabled ? alvo : alternativo;
      if (escolhido) escolhido.focus({ preventScroll: true });
    }
  }

  // ---------- Cliques: cada botão diz o que faz pelo data-a ----------
  document.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-a]");
    if (!botao || botao.disabled) return;
    const acao = botao.dataset.a;

    if (acao === "lang") {
      mudarIdioma(idiomaAtual() === "pt" ? "en" : "pt");
      desenhar({ quieto: true });
      return;
    }

    if (acao === "next") {
      if (ui.tela === "lancamento") {
        ui.jogo = J.criarJogo();
        ui.tela = "jogo";
      } else {
        J.avancar(ui.jogo);
        ui.tela = ui.jogo.fase === "fim" ? "fim" : "jogo";
      }
      desenhar({ foco: "titulo" });
    } else if (acao === "adj") {
      const { k, d } = botao.dataset;
      J.ajustar(ui.jogo, k, Number(d));
      desenhar({ quieto: true, foco: `[data-a="adj"][data-k="${k}"][data-d="${d}"]` });
    } else if (acao === "choose") {
      J.escolher(ui.jogo, botao.dataset.id);
      desenhar({ quieto: true, foco: `[data-a="choose"][data-id="${botao.dataset.id}"]` });
    } else if (acao === "log") {
      ui.tela = "diario";
      desenhar({ foco: "titulo" });
    } else if (acao === "back") {
      ui.tela = "jogo";
      desenhar({ foco: "titulo" });
    } else if (acao === "restart") {
      ui.jogo = null;
      ui.tela = "lancamento";
      desenhar({ foco: "titulo" });
    }
  });

  // ---------- Início ----------
  mudarIdioma(idiomaInicial());
  desenhar();
})();
