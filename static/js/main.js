// Ponto de entrada do jogo no navegador.
// Cuida só da TELA: monta o HTML de cada tela, lê os cliques do jogador
// e chama as regras em static/js/game/ (window.ARES.jogo).
// As regras do jogo NÃO ficam aqui. O mapa em pixel art fica em mapa.js.
//
// A tela do jogo cabe na tela do aparelho, sem rolar:
//   esquerda = mapa (com placar por cima) + tripulação
//   direita  = energia, 4 sistemas, 3 barras e o botão "Próximo"
//
// Ordem dos scripts no index.html: i18n.js → dados → game/*.js → mapa.js → minigames.js → certificado.js → main.js

(function () {
  "use strict";

  const { t, mudarIdioma, idiomaAtual, idiomaInicial } = window.I18N;
  const J = window.ARES.jogo;
  const C = J.CONFIG;
  const MAPA = window.MAPA;
  const app = document.getElementById("app");

  // O que está na tela agora.
  //   jogador      = índice do personagem escolhido (0 Lia, 1 Davi, 2 Yara)
  //   estacao      = estação do mapa onde o personagem está
  //   recemAvancou = acabou de passar o turno (a fala mostra o diário)
  const ui = { tela: "lancamento", jogo: null, estacao: null, jogador: 0, recemAvancou: false, nome: "", nomeErro: false, certificado: null };

  // Nome do jogador: vai no certificado do fim da missão. Fica salvo só neste aparelho.
  const CHAVE_NOME = "ares_nome";
  const NOME_MAX = 24;
  const limparNome = (s) => String(s || "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, NOME_MAX);
  try { ui.nome = limparNome(localStorage.getItem(CHAVE_NOME)); } catch (e) { ui.nome = ""; }

  // Tripulação: cor da pele, do cabelo e do traje (o mesmo do mapa)
  const TRIPULACAO = [
    { nome: "Lia", papel: "papel_comandante", pele: "#f1c27d", cabelo: "#3b2a20", traje: "#ff8a4c" },
    { nome: "Davi", papel: "papel_engenheiro", pele: "#8d5524", cabelo: "#1b1b1b", traje: "#6fd3ff" },
    { nome: "Yara", papel: "papel_botanica", pele: "#e0ac69", cabelo: "#a0522d", traje: "#6ee08a" },
  ];
  const jogador = () => TRIPULACAO[ui.jogador];

  // Sistemas: ícone, classe de cor e nome
  const SISTEMA = {
    o2: { icone: "i-o2", cls: "aloc--o2", nome: "oxigenio" },
    food: { icone: "i-food", cls: "aloc--comida", nome: "comida" },
    shield: { icone: "i-shield", cls: "aloc--escudo", nome: "escudo" },
    comms: { icone: "i-comms", cls: "aloc--comms", nome: "radio" },
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

  // Botão "?" que abre uma explicação curta (termos científicos, como cada sistema funciona)
  function ajuda(textoHtml, lado = "dir") {
    return `<details class="ajuda ajuda--${lado}"><summary aria-label="${esc(t("ajuda_aria"))}"><span aria-hidden="true">?</span></summary><div class="ajuda-texto">${textoHtml}</div></details>`;
  }

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

  // ---------- Campo de nome (tela de lançamento) ----------
  function campoNome() {
    const erro = ui.nomeErro;
    return `
        <div class="campo-nome${erro ? " campo-nome--erro" : ""}">
          <label class="campo-nome-rotulo" for="nome-jogador">${t("nome_pedido")}</label>
          <input class="campo-nome-input" id="nome-jogador" type="text" maxlength="${NOME_MAX}" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" aria-required="true" value="${esc(ui.nome)}"${erro ? ' aria-invalid="true" aria-describedby="nome-erro"' : ""}>
          ${erro ? `<p class="campo-nome-dica campo-nome-dica--erro" id="nome-erro" role="alert">${t("nome_erro")}</p>` : ""}
        </div>`;
  }

  // ---------- TELA 1: lançamento + escolha do personagem ----------
  function telaLancamento() {
    const astronautas = TRIPULACAO.map((a, i) => {
      const meu = ui.jogador === i;
      return `
      <li>
        <button class="astronauta${meu ? " astronauta--escolhido" : ""}" type="button" data-a="pick" data-i="${i}" aria-pressed="${meu}" style="--traje:${a.traje}">
          ${rosto(a)}
          <span class="astronauta-nome">${a.nome}</span>
          <span class="astronauta-papel">${t(a.papel)}</span>
          <span class="astronauta-voce">${meu ? "✓ " + t("voce") : t("escolher")}</span>
        </button>
      </li>`;
    }).join("");

    return `
    <section class="tela tela--lancamento" aria-labelledby="t-tela">
      <canvas class="mapa-canvas mapa-canvas--enfeite" id="mapa" role="img" aria-label="${esc(t("mapa_aria_lancamento"))}"></canvas>
      <div class="lancamento-texto">
        <h1 id="t-tela" tabindex="-1">${t("lanc_titulo")}</h1>
        <p class="lead">${t("lanc_lead")}</p>
        <p class="explica">${t("lanc_regras", { dias: C.viagem.turnos * C.viagem.diasPorTurno, sois: C.base.sois, energia: C.energiaPorTurno, meta: C.metaCiencia })}</p>
        ${campoNome()}
        <h2 class="subtitulo">${t("escolha_personagem")}</h2>
        <ul class="tripulacao">${astronautas}</ul>
        <button class="btn btn-principal" type="button" data-a="next">${ico("i-ship")} ${t("lancar")}</button>
      </div>
    </section>`;
  }

  // ---------- Painel da direita: energia, sistemas e barras ----------
  function barra(cls, icone, nome, valor, previsaoHtml, pct, pctPrev, aria, ajudaHtml = "") {
    return `
      <div class="barra ${cls}">
        <div class="barra-topo">
          ${ico(icone)}
          <span class="barra-nome">${nome}</span>
          ${ajudaHtml}
          <span class="barra-num">${valor} ${previsaoHtml}</span>
        </div>
        <div class="barra-trilho" role="meter" aria-label="${esc(nome)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-valuetext="${esc(aria)}">
          <div class="barra-prev" style="--prev:${pctPrev}%"></div>
          <div class="barra-fill" style="--val:${pct}%"></div>
        </div>
      </div>`;
  }

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

  // Cartão de um sistema: ícone, nome, "?", efeito e os botões − e +
  function cartaoSistema(e, k) {
    const s = SISTEMA[k];
    return `
      <div class="sistema ${s.cls}${ui.estacao === k ? " aloc--aqui" : ""}">
        <div class="sistema-topo">
          ${ico(s.icone)}
          <span class="sistema-nome">${t(s.nome)}</span>
          ${ajuda(t(`est_${k}_desc`), k === "o2" || k === "shield" ? "esq" : "dir")}
          ${efeitoHtml(e, k)}
        </div>
        <div class="sistema-controles">${controles(e, k)}</div>
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
          <span class="energia-detalhe">${ico("i-sol")} ${J.energiaSolar(e)} + ${ico("i-battery")} ${e.bateria}/${C.bateriaMax}</span>
          ${ajuda(`${t("energia_paineis", { n: J.energiaSolar(e) })} + ${t("energia_bateria", { n: e.bateria, max: C.bateriaMax })}. ${t("energia_sobra", { max: C.bateriaMax })}`)}
        </div>
        <div class="sistemas">
          ${cartaoSistema(e, "o2")}
          ${cartaoSistema(e, "food")}
          ${cartaoSistema(e, "shield")}
          ${cartaoSistema(e, "comms")}
        </div>
        <div class="barras">
          ${barra("barra--o2", "i-o2", t("oxigenio"), `${e.o2}%`, chip(prev.o2 - e.o2, true, `${prev.o2}%`), e.o2, prev.o2, `${e.o2}%`, ajuda(t("explica_suporte")))}
          ${barra("barra--comida", "i-food", t("comida"), `${e.comida}%`, chip(prev.comida - e.comida, true, `${prev.comida}%`), e.comida, prev.comida, `${e.comida}%`)}
          ${barra("barra--rad", "i-rad", t("radiacao"), `${mSv(e.rad)} mSv`, chip(1, false, mSv(prev.rad)), pctRad(e.rad), pctRad(prev.rad), `${mSv(e.rad)} mSv`,
            ajuda(`${t("explica_msv")} ${t("rad_limite", { n: C.limiteCarreira })} ${t("aviso_rad")}`))}
        </div>
      </div>`;
  }

  // ---------- Carta de decisão (aparece por cima do mapa) ----------
  const ICONE_EVENTO = { poeira: "i-dust", solar: "i-flare", filtro: "i-o2", praga: "i-food" };

  // Chips com o efeito de cada opção: ícone + número (nunca só cor).
  // Com "ef2" mostra uma FAIXA (do pior ao melhor resultado do minigame): "+1…+4".
  const sinal = (n) => (n > 0 ? "+" : "−") + Math.abs(n);
  const EFEITO_META = {
    o2: { icone: "i-o2", nome: "oxigenio", neutro: 0, texto: (v) => sinal(v), bom: (v) => v > 0 },
    consumoO2: { icone: "i-o2", nome: "oxigenio", neutro: 0, texto: (v) => sinal(-v), bom: (v) => v < 0 },
    comida: { icone: "i-food", nome: "comida", neutro: 0, texto: (v) => sinal(v), bom: (v) => v > 0 },
    energia: { icone: "i-energy", nome: "energia", neutro: 0, texto: (v) => sinal(v), bom: (v) => v > 0 },
    tempestade: { icone: "i-rad", nome: "radiacao", neutro: 1, texto: (v) => `−${Math.round((1 - v) * 100)}%`, bom: () => true },
  };

  function chipsEfeito(ef, ef2) {
    const itens = [];
    const chaves = new Set([...Object.keys(ef), ...Object.keys(ef2 || {})].filter((k) => EFEITO_META[k]));
    for (const k of chaves) {
      const m = EFEITO_META[k];
      const a = ef[k] ?? m.neutro;
      const b = ef2 ? (ef2[k] ?? m.neutro) : a;
      if (a === m.neutro && b === m.neutro) continue;             // não muda nada: sem chip
      const texto = a === b ? m.texto(a) : `${m.texto(a)}…${m.texto(b)}`;
      const tom = m.bom(a) && m.bom(b) ? "bom" : !m.bom(a) && !m.bom(b) ? "ruim" : "variavel";
      itens.push(`<span class="efeito efeito--${tom}">${ico(m.icone)}<span class="sr-only">${t(m.nome)}</span> ${texto}</span>`);
    }
    return itens.length ? itens.join("") : `<span class="efeito efeito--neutro">${t("efeito_nenhum")}</span>`;
  }

  function cartaEvento(e) {
    const ev = e.evento;
    if (!ev || !ev.visivel || ev.escolha) return "";
    const texto = ev.tipo === "solar"
      ? t("ev_solar_texto", { classe: esc(ev.classe), data: dataCurta(ev.data) })
      : t(`ev_${ev.tipo}_texto`);
    const E = window.ARES.eventos;
    const opcoes = (ev.opcoes || []).map((id) => {
      const faixa = E.faixaDe(ev.tipo, id);          // opção com minigame: mostra do pior ao melhor
      const chips = faixa ? chipsEfeito(faixa.pior, faixa.melhor) : chipsEfeito(E.efeitoDe(ev.tipo, id));
      return `
          <button class="btn-escolha${faixa ? " btn-escolha--mini" : ""}" type="button" data-a="choose" data-id="${id}">
            <span class="escolha-texto">${t("op_" + id)}</span>
            <span class="escolha-efeitos">${faixa ? `<span class="selo-mini">▶ ${t("mini_selo")}</span>` : ""}${chips}</span>
          </button>`;
    }).join("");
    return `
      <div class="carta-camada">
        <div class="evento evento--${ev.tipo}" role="group" aria-labelledby="ev-titulo">
          ${ico(ICONE_EVENTO[ev.tipo] || "i-flare")}
          <div class="evento-corpo">
            <h2 class="evento-titulo" id="ev-titulo">${t(`ev_${ev.tipo}_titulo`)}</h2>
            <p>${texto}</p>
            <p class="evento-pergunta">${t("ev_pergunta")}</p>
            <div class="escolhas">${opcoes}</div>
          </div>
        </div>
      </div>`;
  }

  // Depois de escolher: um selo pequeno lembra a decisão do turno
  function seloDecisao(e) {
    const ev = e.evento;
    if (!ev || !ev.visivel || !ev.escolha) return "";
    const nota = ev.desempenho != null ? ` (${Math.round(ev.desempenho * 100)}%)` : "";
    return `<p class="selo-decisao evento--${ev.tipo}">${ico(ICONE_EVENTO[ev.tipo] || "i-flare")} <b>${t(`ev_${ev.tipo}_titulo`)}</b> ${t("op_" + ev.escolha)}${nota}</p>`;
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

    // Fala: a situação mais urgente primeiro. [quem fala, chave] ou [quem fala, null, html]
    let fala;
    const giro = (e.turno + (e.fase === "base" ? 1 : 0)) % 3;
    const ultimo = e.diario.length ? e.diario[e.diario.length - 1].turno : null;
    const doTurno = e.diario.filter((x) => x.turno === ultimo);
    if (ev && !ev.escolha) fala = ev.tipo === "solar" ? [1, "fala_tempestade"] : ev.tipo === "poeira" ? [1, "fala_poeira"] : ev.tipo === "praga" ? [2, "fala_praga"] : [0, "fala_escolha"];
    else if (ui.estacao) fala = [ui.jogador, null, `<b>${t(`est_${ui.estacao}_nome_${e.fase}`) !== `est_${ui.estacao}_nome_${e.fase}` ? t(`est_${ui.estacao}_nome_${e.fase}`) : t(`est_${ui.estacao}_nome`)}:</b> ${t(`est_${ui.estacao}_desc`)}`];
    else if (ui.recemAvancou && doTurno.length) fala = [ui.jogador, null, `${ico("i-log")} ${doTurno.map(textoEntrada).join(" ")}`];
    else if (prev.o2 < 25) fala = [0, "fala_ar_critico"];
    else if (prev.comida < 25) fala = [2, "fala_comida_critica"];
    else if (tempestadePerigosa) fala = [1, "fala_mais_escudo"];
    else if (J.energiaLivre(e) > 0) fala = [0, "fala_sobra"];
    else if (prev.o2 < 45) fala = [0, "fala_ar_baixo"];
    else if (prev.comida < 45) fala = [2, "fala_comida_baixa"];
    else if (e.fase === "base" && e.turno === 1) fala = [0, "fala_chegada"];
    else if (!doTurno.length) fala = [ui.jogador, null, t("mapa_dica", { nome: jogador().nome })];
    else fala = [giro, "fala_tudo_bem_" + giro];
    return { humores, fala };
  }

  function tripulacaoViva(e) {
    const { humores, fala } = climaDaTripulacao(e);
    const rostos = TRIPULACAO.map((p, i) => `
        <li class="rosto rosto--${humores[i]}${fala[0] === i ? " rosto--falando" : ""}${ui.jogador === i ? " rosto--jogador" : ""}" style="--traje:${p.traje}">
          ${rosto(p, humores[i])}
          <span class="rosto-nome">${p.nome}</span>
          <span class="sr-only">${t("humor_" + humores[i], { nome: p.nome })}${ui.jogador === i ? " (" + t("voce") + ")" : ""}</span>
        </li>`).join("");
    const texto = fala[1] ? t(fala[1]) : fala[2];
    return `
      <div class="tripulacao-viva">
        <ul class="rostos">${rostos}</ul>
        <p class="fala" role="status"><b>${TRIPULACAO[fala[0]].nome}:</b> ${texto}</p>
      </div>`;
  }

  // ---------- TELAS 2 e 3: viagem e base (uma tela só, sem rolar) ----------
  function telaJogo(e, quieto) {
    const naViagem = e.fase === "viagem";
    const total = C.viagem.turnos * C.viagem.diasPorTurno;
    const progresso = Math.round(((e.turno - 1) / C.viagem.turnos) * 100);
    const titulo = naViagem
      ? t("viagem_titulo_curto", { n: (e.turno - 1) * C.viagem.diasPorTurno + 1, total })
      : t("sol_titulo", { n: e.turno, total: C.base.sois });

    const ultimoViagem = naViagem && e.turno >= C.viagem.turnos;
    const ultimoSol = !naViagem && e.turno >= C.base.sois;
    const chave = ultimoViagem ? "pousar" : ultimoSol ? "terminar" : naViagem ? "proximo_turno" : "proximo_sol";
    const esperando = J.precisaEscolher(e);
    const dormir = ui.estacao === "home";

    return `
    <section class="tela tela--jogo tela--${e.fase}${quieto ? " sem-animacao" : ""}" aria-labelledby="t-tela">
      <div class="jogo-grade">
        <div class="jogo-esquerda">
          <div class="mapa-caixa">
            <div class="mapa-moldura">
              <canvas class="mapa-canvas" id="mapa" role="img" aria-label="${esc(t(naViagem ? "mapa_aria_viagem" : "mapa_aria_base", { nome: jogador().nome }))}"></canvas>
              <div class="hud hud--topo">
                <h1 id="t-tela" class="hud-titulo" tabindex="-1">${titulo}</h1>
                ${naViagem ? "" : ajuda(t("explica_sol"), "esq")}
                <span class="selo-ciencia">${ico("i-sci")} <b>${e.ciencia}</b>/${C.metaCiencia}<span class="sr-only"> ${t("ciencia")}</span></span>
              </div>
              ${naViagem ? `
              <div class="hud hud--rodape mapa" style="--progresso:${progresso}%">
                <span class="mapa-ponto mapa-ponto--terra" aria-hidden="true"></span>
                <div class="mapa-linha" aria-hidden="true"><div class="mapa-feito"></div></div>
                <span class="mapa-ponto mapa-ponto--marte" aria-hidden="true"></span>
                <span class="hud-legenda">${t("caminho", { n: progresso })}</span>
              </div>` : ""}
            </div>
          </div>
          ${seloDecisao(e)}
          ${tripulacaoViva(e)}
          ${cartaEvento(e)}
        </div>

        <div class="jogo-direita">
          ${painel(e)}
          <div class="jogo-acoes">
            <button class="btn btn-secundario btn-diario" type="button" data-a="log">${ico("i-log")} <span>${t("diario_curto")}</span></button>
            <button class="btn btn-principal${dormir ? " btn--destaque" : ""}" type="button" data-a="next"${esperando ? ' disabled aria-describedby="dica-escolha"' : ""}>${dormir ? t("dormir") : t(chave)}</button>
          </div>
          ${esperando ? `<p class="dica-escolha" id="dica-escolha">${t("dica_escolha")}</p>` : ""}
        </div>
      </div>
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

  // ---------- Certificado do fim da missão ----------
  // Quem cumpriu a missão (2 ou 3 estrelas) ganha o certificado; o desenho fica em certificado.js.
  function certificadoHtml(r, estrelas) {
    if (r.resultado === "cedo") {
      ui.certificado = null;
      return `<p class="explica cert-sem">${t("cert_sem")}</p>`;
    }
    const nome = limparNome(ui.nome) || jogador().nome;
    const slug = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "comandante";
    const data = new Intl.DateTimeFormat(local(), { day: "numeric", month: "long", year: "numeric" }).format(new Date());
    ui.certificado = {
      nome,
      estrelas,
      arquivo: `certificado-projeto-ares-${slug}`,
      textos: {
        titulo: t("cert_titulo"),
        parabens: t("cert_parabens"),
        texto: t("cert_texto_" + r.resultado, { ciencia: r.ciencia }),
        detalhes: t("cert_detalhes", { dias: r.dias, sois: r.sois, ciencia: r.ciencia }),
        data: t("cert_data", { data }),
        aviso: t("cert_aviso"),
        credito: t("cert_credito"),
        nasa: t("cert_nasa_texto"),
      },
    };
    return `
      <div class="cert">
        <h2 class="cert-titulo">${ico("i-star")} ${t("cert_secao", { nome: esc(nome) })}</h2>
        <canvas class="cert-canvas" id="cert-canvas" role="img" aria-label="${esc(t("cert_aria", { nome }))}"></canvas>
        <button class="btn btn-principal" type="button" data-a="cert-baixar">${t("cert_baixar")}</button>
      </div>`;
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
      ${certificadoHtml(r, estrelas)}
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
      jogador: ui.jogador,
      trajes: TRIPULACAO.map((p) => p.traje),
    };
  }

  // O personagem chegou numa estação do mapa: destaca o sistema e leva o foco até ele
  function chegouNaEstacao(k) {
    ui.estacao = k;
    ui.recemAvancou = false;
    const foco = k === "home" ? '[data-a="next"]' : `.sistema [data-a="adj"][data-k="${k}"][data-d="1"]`;
    desenhar({ quieto: true, foco });
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

    // Fim da missão: desenha o certificado no canvas (certificado.js)
    if (ui.tela === "fim" && ui.certificado && window.ARES.certificado) {
      const cv = app.querySelector("#cert-canvas");
      if (cv) window.ARES.certificado.desenhar(cv, ui.certificado);
    }

    if (foco === "titulo") {
      window.scrollTo(0, 0);
      // Se tem carta de decisão, o foco vai direto para a primeira opção
      const alvo = app.querySelector(".btn-escolha") || app.querySelector("h1");
      if (alvo) alvo.focus({ preventScroll: true });
    } else if (foco) {
      // Se o botão ficou desativado, foca o outro botão do mesmo sistema
      const alvo = app.querySelector(foco);
      const caixa = alvo && alvo.closest(".sistema");
      const alternativo = caixa && caixa.querySelector(".btn-passo:not(:disabled)");
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

    if (acao === "pick") {
      ui.jogador = Number(botao.dataset.i) || 0;
      desenhar({ quieto: true, foco: `[data-a="pick"][data-i="${ui.jogador}"]` });
    } else if (acao === "next") {
      if (ui.tela === "lancamento") {
        if (!limparNome(ui.nome)) {                 // sem nome não decola: o nome vai no certificado
          ui.nomeErro = true;
          desenhar({ quieto: true, foco: "#nome-jogador" });
          return;
        }
        ui.nome = limparNome(ui.nome);
        ui.nomeErro = false;
        try { localStorage.setItem(CHAVE_NOME, ui.nome); } catch (e) { /* sem armazenamento: tudo bem */ }
        ui.jogo = J.criarJogo();
        ui.tela = "jogo";
        ui.recemAvancou = false;
      } else {
        J.avancar(ui.jogo);
        ui.tela = ui.jogo.fase === "fim" ? "fim" : "jogo";
        ui.recemAvancou = true;
      }
      ui.estacao = null;
      if (MAPA) MAPA.soltar();
      desenhar({ foco: "titulo" });
    } else if (acao === "adj") {
      const { k, d } = botao.dataset;
      J.ajustar(ui.jogo, k, Number(d));
      ui.recemAvancou = false;
      desenhar({ quieto: true, foco: `.sistema [data-a="adj"][data-k="${k}"][data-d="${d}"]` });
    } else if (acao === "choose") {
      const e = ui.jogo;
      const id = botao.dataset.id;
      const ev = e.evento;
      const E = window.ARES.eventos;
      const jogo = ev ? E.minigameDe(ev.tipo, id) : null;
      const concluir = (nota) => {                  // nota = null: pulou, vale o resultado médio
        J.escolher(e, id, nota ?? undefined);
        ui.recemAvancou = false;
        desenhar({ quieto: true, foco: '[data-a="next"]' });
      };
      if (jogo && window.MINIGAMES) {
        window.MINIGAMES.iniciar({
          jogo,
          tipo: ev.tipo,
          efeitoHtml: (nota) => chipsEfeito(E.efeitoDe(ev.tipo, id, nota)),
          aoTerminar: concluir,
        });
      } else {
        concluir(null);
      }
    } else if (acao === "cert-baixar") {
      const cv = app.querySelector("#cert-canvas");
      if (cv && ui.certificado && window.ARES.certificado) window.ARES.certificado.baixar(cv, ui.certificado);
    } else if (acao === "log") {
      ui.tela = "diario";
      desenhar({ foco: "titulo" });
    } else if (acao === "back") {
      ui.tela = "jogo";
      desenhar({ foco: "titulo" });
    } else if (acao === "restart") {
      ui.jogo = null;
      ui.certificado = null;
      ui.tela = "lancamento";
      ui.estacao = null;
      desenhar({ foco: "titulo" });
    }
  });

  // Digitar o nome: guarda o que foi escrito (sem redesenhar a tela, para não perder o foco)
  document.addEventListener("input", (evento) => {
    const campo = evento.target;
    if (!campo || campo.id !== "nome-jogador") return;
    ui.nome = campo.value.slice(0, NOME_MAX);
    if (ui.nomeErro && limparNome(ui.nome)) {
      ui.nomeErro = false;
      const caixa = campo.closest(".campo-nome");
      if (caixa) {
        caixa.classList.remove("campo-nome--erro");
        campo.removeAttribute("aria-invalid");
        campo.removeAttribute("aria-describedby");
        caixa.querySelector(".campo-nome-dica")?.remove();
      }
    }
  });

  // Enter no campo de nome = lançar a nave
  document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter" || !evento.target || evento.target.id !== "nome-jogador") return;
    evento.preventDefault();
    const lancar = app.querySelector('.tela--lancamento [data-a="next"]');
    if (lancar) lancar.click();
  });

  // O tutorial (tutorial.js) reaproveita os rostos da tripulação e redesenha o jogo ao trocar de idioma
  window.ARES.tela = { rosto, TRIPULACAO, redesenhar: () => desenhar({ quieto: true }) };

  // ---------- Início ----------
  mudarIdioma(idiomaInicial());
  desenhar();
})();