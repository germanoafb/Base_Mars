// Ponto de entrada do jogo no navegador.
// Cuida só da TELA: monta o HTML de cada tela, lê os cliques do jogador
// e chama as regras em static/js/game/ (window.ARES.jogo).
// As regras do jogo NÃO ficam aqui. O mapa em pixel art fica em mapa.js.
//
// Ordem dos scripts no index.html: i18n.js → dados → game/*.js → mapa.js → main.js

(function () {
  "use strict";

  const { t, mudarIdioma, idiomaAtual, idiomaInicial } = window.I18N;
  const J = window.ARES.jogo;
  const C = J.CONFIG;
  const MAPA = window.MAPA;
  const app = document.getElementById("app");

  // O que está na tela agora. estacao = estação do mapa onde a Lia está.
  const ui = { tela: "lancamento", jogo: null, estacao: null };

  // Tripulação: cor da pele, do cabelo e do traje (o mesmo do mapa)
  const TRIPULACAO = [
    { nome: "Lia", papel: "papel_comandante", pele: "#f1c27d", cabelo: "#3b2a20", traje: "#ff8a4c" },
    { nome: "Davi", papel: "papel_engenheiro", pele: "#8d5524", cabelo: "#1b1b1b", traje: "#6fd3ff" },
    { nome: "Yara", papel: "papel_botanica", pele: "#e0ac69", cabelo: "#a0522d", traje: "#6ee08a" },
  ];

  // Estações do mapa: ícone e chaves de texto
  const ESTACAO = {
    food: { icone: "i-food", cls: "aloc--comida" },
    o2: { icone: "i-o2", cls: "aloc--o2" },
    shield: { icone: "i-shield", cls: "aloc--escudo" },
    comms: { icone: "i-comms", cls: "aloc--comms" },
    home: { icone: "i-home", cls: "" },
  };

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

  // ---------- Rosto em pixel art (16×16 quadradinhos) ----------
  // humor: "feliz" | "preocupado" | "assustado"
  function rosto(pessoa, humor = "feliz") {
    const px = [];
    const r = (x, y, w, h, c) => px.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`);
    // Capacete (contorno + vidro branco)
    const meio = [3, 5, 6, 6, 7, 7, 7, 7, 7, 7, 7, 6, 6, 5, 3];
    meio.forEach((w, y) => { r(8 - w - 1, y, (w + 1) * 2, 1, "#5a3040"); });
    meio.forEach((w, y) => { if (y > 0 && y < 14) r(8 - w, y, w * 2, 1, "#ffe9d6"); });
    // Rosto e cabelo
    [3, 4, 5, 5, 5, 5, 4, 4, 3].forEach((w, i) => r(8 - w, 4 + i, w * 2, 1, pessoa.pele));
    r(3, 3, 10, 2, pessoa.cabelo); r(3, 5, 2, 2, pessoa.cabelo); r(11, 5, 2, 2, pessoa.cabelo);
    // Olhos
    r(5, 7, 2, 2, "#1a0f14"); r(9, 7, 2, 2, "#1a0f14");
    if (humor === "feliz") {
      r(4, 9, 1, 1, "#ff8fa3"); r(11, 9, 1, 1, "#ff8fa3");
      r(5, 10, 1, 1, "#1a0f14"); r(10, 10, 1, 1, "#1a0f14"); r(6, 11, 4, 1, "#1a0f14");   // sorriso
    } else if (humor === "preocupado") {
      r(5, 6, 2, 1, "#1a0f14"); r(9, 6, 2, 1, "#1a0f14");                                  // sobrancelhas
      r(6, 11, 4, 1, "#1a0f14");                                                           // boca reta
    } else {
      r(4, 5, 2, 1, "#1a0f14"); r(10, 5, 2, 1, "#1a0f14");                                 // sobrancelhas para cima
      r(7, 10, 2, 2, "#1a0f14");                                                           // boca de "o"
      r(13, 6, 1, 2, "#6fd3ff");                                                           // gota de suor
    }
    return `<svg class="rosto-svg" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${px.join("")}</svg>`;
  }

  // ---------- TELA 1: lançamento ----------
  function telaLancamento() {
    const astronautas = TRIPULACAO.map((a) => `
      <li class="astronauta" style="--traje:${a.traje}">
        ${rosto(a)}
        <span class="astronauta-nome">${a.nome}</span>
        <span class="astronauta-papel">${t(a.papel)}</span>
      </li>`).join("");

    return `
    <section class="tela tela--lancamento" aria-labelledby="t-tela">
      <canvas class="mapa-canvas mapa-canvas--enfeite" id="mapa" role="img" aria-label="${esc(t("mapa_aria_lancamento"))}"></canvas>
      <h1 id="t-tela" tabindex="-1">${t("lanc_titulo")}</h1>
      <p class="lead">${t("lanc_lead")}</p>
      <p class="explica">${t("lanc_regras", { dias: C.viagem.turnos * C.viagem.diasPorTurno, sois: C.base.sois, energia: C.energiaPorTurno, meta: C.metaCiencia })}</p>
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
          <span class="energia-detalhe">
            ${ico("i-sol")} ${t("energia_paineis", { n: J.energiaSolar(e) })}
            · ${ico("i-battery")} ${t("energia_bateria", { n: e.bateria, max: C.bateriaMax })}
          </span>
          <span class="energia-dica">${t("energia_sobra", { max: C.bateriaMax })}</span>
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
  function controles(e, k) {
    const valor = e.alocacao[k];
    const livre = J.energiaLivre(e);
    let pontos = "";
    for (let i = 0; i < C.maxPorSistema; i++) pontos += `<i${i < valor ? ' class="on"' : ""}></i>`;
    return `
        <button class="btn-passo" type="button" data-a="adj" data-k="${k}" data-d="-1" aria-label="${esc(t("menos_" + k))}"${valor <= 0 ? " disabled" : ""}>−</button>
        <span class="aloc-pontos" role="img" aria-label="${esc(t("pontos_aria", { n: valor, max: C.maxPorSistema }))}">${pontos}</span>
        <button class="btn-passo" type="button" data-a="adj" data-k="${k}" data-d="1" aria-label="${esc(t("mais_" + k))}"${valor >= C.maxPorSistema || livre <= 0 ? " disabled" : ""}>+</button>`;
  }

  function efeitoHtml(e, k) {
    const ef = J.efeitoDosSistemas(e);
    if (k === "o2") return chipEfeito(ef.o2);
    if (k === "food") return chipEfeito(ef.food);
    if (k === "shield") return `<span class="previsao previsao--${ef.shield > 0 ? "bom" : "ruim"}">${ef.shield}%</span>`;
    return ef.comms > 0
      ? `<span class="previsao previsao--bom">+${ef.comms} ${ico("i-sci")}</span>`
      : `<span class="previsao previsao--ruim">—</span>`;
  }

  function linhaAlocacao(e, k, nomeChave) {
    const est = ESTACAO[k];
    const aqui = ui.estacao === k;
    return `
      <div class="aloc ${est.cls}${aqui ? " aloc--aqui" : ""}">
        ${ico(est.icone)}
        <span class="aloc-nome">${t(nomeChave)}</span>
        ${controles(e, k)}
        ${efeitoHtml(e, k)}
      </div>`;
  }

  function divisaoEnergia(e) {
    return `
      <div class="energia-divisao">
        <h2 class="subtitulo">${t("para_onde")}</h2>
        ${linhaAlocacao(e, "o2", "oxigenio")}
        ${linhaAlocacao(e, "food", "comida")}
        ${linhaAlocacao(e, "shield", "escudo")}
        ${linhaAlocacao(e, "comms", "radio")}
        <p class="explica">${t("explica_escudo_radio")}</p>
      </div>`;
  }

  // ---------- Painel da estação onde a Lia está (embaixo do mapa) ----------
  function painelEstacao(e) {
    const k = ui.estacao;
    if (!k) return `<div class="estacao estacao--vazia" aria-live="polite">${ico("i-home")} <span>${t("mapa_dica")}</span></div>`;
    const est = ESTACAO[k];
    const nome = t(`est_${k}_nome_${e.fase}`) !== `est_${k}_nome_${e.fase}` ? t(`est_${k}_nome_${e.fase}`) : t(`est_${k}_nome`);
    if (k === "home") {
      const esperando = J.precisaEscolher(e);
      return `
      <div class="estacao" aria-live="polite">
        <h2 class="estacao-nome">${ico(est.icone)} ${nome}</h2>
        <p>${t("est_home_desc")}</p>
        <button class="btn btn-principal" type="button" data-a="next"${esperando ? " disabled" : ""}>${t("dormir")}</button>
      </div>`;
    }
    return `
      <div class="estacao ${est.cls}" aria-live="polite">
        <h2 class="estacao-nome">${ico(est.icone)} ${nome}</h2>
        <p>${t(`est_${k}_desc`)}</p>
        <div class="estacao-controles">${controles(e, k)} ${efeitoHtml(e, k)}</div>
      </div>`;
  }

  // ---------- Carta de decisão (só eventos que a tripulação já conhece) ----------
  const ICONE_EVENTO = { poeira: "i-dust", solar: "i-flare", filtro: "i-o2", praga: "i-food" };

  // Chips com o efeito de cada opção: ícone + número (nunca só cor)
  function chipsEfeito(ef) {
    const itens = [];
    const add = (icone, nomeChave, texto, bom) =>
      itens.push(`<span class="efeito efeito--${bom ? "bom" : "ruim"}">${ico(icone)}<span class="sr-only">${t(nomeChave)}</span> ${texto}</span>`);
    const sinal = (n) => (n > 0 ? "+" : "−") + Math.abs(n);
    if (ef.o2) add("i-o2", "oxigenio", sinal(ef.o2), ef.o2 > 0);
    if (ef.consumoO2) add("i-o2", "oxigenio", sinal(-ef.consumoO2), ef.consumoO2 < 0);
    if (ef.comida) add("i-food", "comida", sinal(ef.comida), ef.comida > 0);
    if (ef.energia) add("i-energy", "energia", sinal(ef.energia), ef.energia > 0);
    if (ef.tempestade !== undefined) add("i-rad", "radiacao", `−${Math.round((1 - ef.tempestade) * 100)}%`, true);
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

  // ---------- Tripulação viva: humor de cada um + uma fala ----------
  function climaDaTripulacao(e) {
    const prev = J.previsao(e);
    const ev = e.evento && e.evento.visivel ? e.evento : null;
    const humorPor = (v) => (v < 25 ? "assustado" : v < 45 ? "preocupado" : "feliz");
    const tempestadePerigosa = ev && ev.tipo === "solar" && e.alocacao.shield < 3 && ev.escolha !== "abrigo";
    const humores = [
      humorPor(prev.o2),                                                               // Lia cuida do ar e da água
      tempestadePerigosa ? "assustado" : ev || e.rad > 400 ? "preocupado" : "feliz",   // Davi: sistemas e radiação
      humorPor(prev.comida),                                                           // Yara cuida da estufa
    ];

    // Fala: a situação mais urgente primeiro. [quem fala (0 Lia, 1 Davi, 2 Yara), chave]
    let fala;
    const giro = (e.turno + (e.fase === "base" ? 1 : 0)) % 3;
    if (ev && !ev.escolha) fala = ev.tipo === "solar" ? [1, "fala_tempestade"] : ev.tipo === "poeira" ? [1, "fala_poeira"] : ev.tipo === "praga" ? [2, "fala_praga"] : [0, "fala_escolha"];
    else if (prev.o2 < 25) fala = [0, "fala_ar_critico"];
    else if (prev.comida < 25) fala = [2, "fala_comida_critica"];
    else if (tempestadePerigosa) fala = [1, "fala_mais_escudo"];
    else if (J.energiaLivre(e) > 0) fala = [0, "fala_sobra"];
    else if (prev.o2 < 45) fala = [0, "fala_ar_baixo"];
    else if (prev.comida < 45) fala = [2, "fala_comida_baixa"];
    else if (e.fase === "base" && e.turno === 1) fala = [0, "fala_chegada"];
    else fala = [giro, "fala_tudo_bem_" + giro];
    return { humores, fala };
  }

  function tripulacaoViva(e) {
    const { humores, fala } = climaDaTripulacao(e);
    const rostos = TRIPULACAO.map((p, i) => `
        <li class="rosto rosto--${humores[i]}${fala[0] === i ? " rosto--falando" : ""}" style="--traje:${p.traje}">
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

  function telaJogo(e, quieto) {
    const naViagem = e.fase === "viagem";
    const total = C.viagem.turnos * C.viagem.diasPorTurno;
    const progresso = Math.round(((e.turno - 1) / C.viagem.turnos) * 100);
    const titulo = naViagem
      ? t("viagem_titulo", { n: (e.turno - 1) * C.viagem.diasPorTurno + 1, total })
      : t("sol_titulo", { n: e.turno, total: C.base.sois });
    return `
    <section class="tela tela--jogo tela--${e.fase}${quieto ? " sem-animacao" : ""}" aria-labelledby="t-tela">
      <div class="cena">
        <div class="cena-topo">
          <h1 id="t-tela" class="cena-titulo" tabindex="-1">${titulo}</h1>
          <span class="selo-ciencia" title="${esc(t("ciencia"))}">${ico("i-sci")} <b>${e.ciencia}</b>/${C.metaCiencia}<span class="sr-only"> ${t("ciencia")}</span></span>
        </div>
        ${naViagem ? "" : `<p class="explica">${t("explica_sol")}</p>`}
        <canvas class="mapa-canvas" id="mapa" role="img" aria-label="${esc(t(naViagem ? "mapa_aria_viagem" : "mapa_aria_base"))}"></canvas>
        ${naViagem ? `<div class="mapa" style="--progresso:${progresso}%">
          <div class="mapa-trilha" aria-hidden="true">
            <span class="mapa-ponto mapa-ponto--terra"></span>
            <div class="mapa-linha"><div class="mapa-feito"></div></div>
            <span class="mapa-ponto mapa-ponto--marte"></span>
          </div>
          <p class="mapa-legenda"><span>${t("terra")}</span><span>${t("caminho", { n: progresso })}</span><span>${t("marte")}</span></p>
        </div>` : ""}
        ${painelEstacao(e)}
        ${tripulacaoViva(e)}
        ${naViagem && e.turno === 1 ? `<p class="aviso aviso--rad">${ico("i-rad")} <span>${t("aviso_rad")}</span></p>` : ""}
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

  // ---------- TELA 5: debriefing (3 finais, nenhum é castigo) ----------
  function telaFim(e) {
    const r = J.avaliar(e);
    const lista = (itens) => itens.map((x) => {
      const p = Object.assign({}, x.p);
      if (p.quando) p.quando = textoRotulo(p.quando);
      return `<li>${t(x.chave, p)}</li>`;
    }).join("");

    const titulo = t("fim_titulo_" + r.resultado);
    const lead = r.resultado === "cedo"
      ? t(e.fim.motivo === "o2" ? "fim_lead_o2" : "fim_lead_comida", { quando: textoRotulo(e.fim.quando) })
      : t("fim_lead_ciencia", { dias: r.dias, sois: r.sois, ciencia: r.ciencia, meta: C.metaCiencia });
    const estrelas = r.resultado === "cumprida" ? 3 : r.resultado === "sobreviveram" ? 2 : 1;

    return `
    <section class="tela tela--fim tela--fim-${r.resultado}" aria-labelledby="t-tela">
      <div class="medalha" role="img" aria-label="${esc(t("estrelas_aria", { n: estrelas }))}">
        ${[0, 1, 2].map((i) => ico("i-star", "ico estrela" + (i < estrelas ? " estrela--on" : ""))).join("")}
      </div>
      <h1 id="t-tela" tabindex="-1">${titulo}</h1>
      <p class="lead">${lead}</p>
      <ul class="resumo">
        <li>${ico("i-ship")}<b>${r.dias}</b> ${t("resumo_dias")}</li>
        <li>${ico("i-sol")}<b>${r.sois}</b> ${t("resumo_sois")}</li>
        <li>${ico("i-sci")}<b>${r.ciencia}</b> ${t("resumo_ciencia")}</li>
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

  // ---------- Estado visual que o mapa usa para desenhar ----------
  function estadoDoMapa() {
    if (ui.tela === "lancamento") return { modo: "lancamento" };
    const e = ui.jogo;
    if (!e || ui.tela !== "jogo") return null;
    const prev = J.previsao(e);
    const ev = e.evento && e.evento.visivel ? e.evento : null;
    return {
      modo: "jogo",
      fase: e.fase,
      alocacao: e.alocacao,
      max: C.maxPorSistema,
      tempestade: Boolean(ev && ev.tipo === "solar"),
      poeira: Boolean(ev && ev.tipo === "poeira"),
      alarme: e.o2 < 30 || prev.o2 < 30,
      o2: e.o2,
      comida: e.comida,
      bateria: e.bateria,
      bateriaMax: C.bateriaMax,
      progresso: (e.turno - 1) / C.viagem.turnos,
      humores: climaDaTripulacao(e).humores,
    };
  }

  // A Lia chegou numa estação do mapa: mostra os controles dela
  function chegouNaEstacao(k) {
    ui.estacao = k;
    desenhar({ quieto: true });
  }

  // ---------- Desenhar a tela atual ----------
  // quieto = sem animação de entrada (ao mexer nos botões)
  // foco = "titulo" ou um seletor CSS do botão que deve receber o foco
  function desenhar({ quieto = false, foco = null } = {}) {
    const e = ui.jogo;
    let html;
    if (ui.tela === "lancamento") html = telaLancamento();
    else if (ui.tela === "diario") html = telaDiario(e);
    else if (ui.tela === "fim") html = telaFim(e);
    else html = telaJogo(e, quieto);
    app.innerHTML = html;

    const canvas = app.querySelector("#mapa");
    if (MAPA) MAPA.conectar(canvas, estadoDoMapa, chegouNaEstacao);

    if (foco === "titulo") {
      window.scrollTo(0, 0);
      const h1 = app.querySelector("h1");
      if (h1) h1.focus({ preventScroll: true });
    } else if (foco) {
      // Se o botão ficou desativado, foca o outro botão da mesma linha
      const alvo = app.querySelector(foco);
      const linha = alvo && (alvo.closest(".aloc") || alvo.closest(".estacao"));
      const alternativo = linha && linha.querySelector(".btn-passo:not(:disabled)");
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
      ui.estacao = null;
      if (MAPA) MAPA.soltar();
      desenhar({ foco: "titulo" });
    } else if (acao === "adj") {
      const { k, d } = botao.dataset;
      J.ajustar(ui.jogo, k, Number(d));
      const dentroDaEstacao = Boolean(botao.closest(".estacao"));
      desenhar({ quieto: true, foco: `${dentroDaEstacao ? ".estacao " : ".aloc "}[data-a="adj"][data-k="${k}"][data-d="${d}"]` });
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
      ui.estacao = null;
      desenhar({ foco: "titulo" });
    }
  });

  // ---------- Início ----------
  mudarIdioma(idiomaInicial());
  desenhar();
})();
