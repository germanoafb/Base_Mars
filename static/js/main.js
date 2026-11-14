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
    return `<b>${textoRotulo(entrada.rotulo)}:</b> ${t(entrada.chave, p)}`;
  }

  function classeEntrada(chave) {
    if (chave.startsWith("log_solar")) return "diario-item--solar";
    if (chave === "log_poeira") return "diario-item--poeira";
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
          ${barra("barra--o2", "i-o2", t("oxigenio"), `${e.o2}%`, chip(prev.o2 - e.o2, true, `${prev.o2}%`), e.o2, prev.o2, `${e.o2}%`)}
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

  // ---------- Caixa de evento (só o que a tripulação já sabe) ----------
  function caixaEvento(e) {
    const ev = e.evento;
    if (!ev || !ev.visivel) return "";
    if (ev.tipo === "poeira") {
      return `
      <div class="evento evento--poeira" role="alert">
        ${ico("i-dust")}
        <div><h2 class="evento-titulo">${t("ev_poeira_titulo")}</h2><p>${t("ev_poeira_texto")}</p></div>
      </div>`;
    }
    return `
      <div class="evento evento--solar" role="alert">
        ${ico("i-flare")}
        <div><h2 class="evento-titulo">${t("ev_solar_titulo")}</h2><p>${t("ev_solar_texto", { classe: esc(ev.classe), data: dataCurta(ev.data) })}</p></div>
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
    return `
      <button class="btn btn-secundario" type="button" data-a="log">${ico("i-log")} ${t("ver_diario")}</button>
      <button class="btn btn-principal" type="button" data-a="next">${t(chave)}</button>`;
  }

  function telaViagem(e, quieto) {
    const total = C.viagem.turnos * C.viagem.diasPorTurno;
    const progresso = Math.round(((e.turno - 1) / C.viagem.turnos) * 100);
    return `
    <section class="tela tela--viagem${quieto ? " sem-animacao" : ""}" aria-labelledby="t-tela">
      <div class="mapa" style="--progresso:${progresso}%">
        <h1 id="t-tela" class="mapa-titulo" tabindex="-1">${t("viagem_titulo", { n: (e.turno - 1) * C.viagem.diasPorTurno + 1, total })}</h1>
        <div class="mapa-trilha" aria-hidden="true">
          <svg class="mapa-planeta mapa-planeta--terra" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="var(--terra)"/><path d="M8 14q6-4 10 1t8 0M12 28q5 3 12-2" stroke="var(--comida)" stroke-width="4" stroke-linecap="round" fill="none"/></svg>
          <div class="mapa-linha"><div class="mapa-feito"></div><svg class="mapa-nave" viewBox="0 0 48 24"><use href="#i-ship"/></svg></div>
          <svg class="mapa-planeta mapa-planeta--marte" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="var(--marte)"/><circle cx="14" cy="15" r="4" fill="var(--marte-escuro)"/><circle cx="25" cy="26" r="5" fill="var(--marte-escuro)"/></svg>
        </div>
        <p class="mapa-legenda"><span>${t("terra")}</span><span>${t("caminho", { n: progresso })}</span><span>${t("marte")}</span></p>
        <p class="aviso aviso--rad">${ico("i-rad")} <span>${t("aviso_rad")}</span></p>
      </div>
      ${caixaEvento(e)}
      ${painel(e)}
      ${divisaoEnergia(e)}
      ${diarioUltimo(e)}
      ${botoesJogo(e)}
    </section>`;
  }

  function telaBase(e, quieto) {
    return `
    <section class="tela tela--base${quieto ? " sem-animacao" : ""}" aria-labelledby="t-tela">
      <div class="sol-cabecalho">
        ${ico("i-sol", "ico ico--sol")}
        <div>
          <h1 id="t-tela" class="sol-titulo" tabindex="-1">${t("sol_titulo", { n: e.turno, total: C.base.sois })}</h1>
          <p class="explica">${t("explica_sol")}</p>
        </div>
      </div>
      <div class="cena-base" aria-hidden="true">
        <svg viewBox="0 0 320 110" preserveAspectRatio="xMidYMax slice">
          <path d="M0 80q40-20 90-6t90-10 140 4v42H0z" fill="var(--marte-escuro)"/>
          <path d="M0 92q60-12 130 0t190-4v22H0z" fill="var(--marte)"/>
          <rect x="120" y="64" width="64" height="26" rx="13" fill="#f4f1ff"/>
          <circle cx="140" cy="76" r="5" fill="var(--o2)"/><circle cx="164" cy="76" r="5" fill="var(--o2)"/>
          <path d="M200 90V58M192 52l16 0" stroke="#c9c4ea" stroke-width="3" stroke-linecap="round"/>
          <circle cx="200" cy="50" r="5" fill="none" stroke="var(--texto-suave)" stroke-width="2.5"/>
          <rect x="40" y="70" width="44" height="16" rx="3" fill="var(--escudo)" transform="skewX(-15)"/>
          <path d="M62 86v6" stroke="#c9c4ea" stroke-width="3"/>
        </svg>
      </div>
      ${caixaEvento(e)}
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
