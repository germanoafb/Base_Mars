// DICAS DO ORBI: um cartãozinho que diz à criança o que fazer em cada tela de missão.
//
// - Aparece sozinho na 1ª vez que cada tela/etapa começa (lançamento, viagem, chegada em
//   Marte, carta de decisão, diário e fim). Não escurece nem bloqueia o jogo.
// - O botão com a lâmpada (💡) no topo reabre a dica da tela atual a qualquer momento.
// - Espera o tutorial (tutorial.js) e os minigames fecharem antes de aparecer:
//   os minigames já têm a própria instrução.
// - Só LÊ a tela (classes) e NÃO mexe nas regras do jogo, na pontuação nem nos eventos.
//
// Onde mexer:
//   - Textos (PT e EN): i18n.js, chaves que começam com "dica_"
//   - Visual: style.css, bloco "DICAS DO ORBI"
//   - Para criar uma dica nova: adicione o nome em contextos() e as chaves
//     dica_<nome>_titulo e dica_<nome>_texto em i18n.js (PT e EN).
//
// Script comum (não "module"), como o resto do jogo. Carregue DEPOIS do main.js.

(function () {
  "use strict";

  const I = window.I18N;
  if (!I) return;
  const { t } = I;

  // Números do jogo vêm das regras (nada copiado aqui)
  const J = window.ARES && window.ARES.jogo;
  const C = (J && J.CONFIG) || { energiaPorTurno: 8, metaCiencia: 30, viagem: { turnos: 6, diasPorTurno: 30 }, base: { sois: 10 } };
  const NUMEROS = {
    meta: C.metaCiencia,
    energia: C.energiaPorTurno,
    sois: C.base.sois,
    dias: C.viagem.turnos * C.viagem.diasPorTurno,
  };

  const ico = (id, cls = "ico") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const q = (seletor) => document.querySelector(seletor);

  const vistas = new Set();      // dicas já mostradas sozinhas nesta visita
  let cartao = null;             // o elemento do cartão (criado na 1ª vez)
  let aberta = null;             // qual dica está na tela agora (null = nenhuma)
  let botao = null;              // botão da lâmpada no topo
  let timer = null;

  // ---------- Em que tela estamos? ----------
  // Devolve as dicas que valem para a tela atual, na ordem em que devem aparecer.
  function contextos() {
    if (q(".tela--lancamento")) return ["lancamento"];
    if (q(".tela--diario")) return ["diario"];
    if (q(".tela--fim")) return ["fim"];
    if (q(".tela--jogo")) {
      const lista = [q(".tela--base") ? "base" : "viagem"];
      if (q(".carta-camada")) lista.push("carta");        // carta de decisão na tela
      return lista;
    }
    return [];
  }

  // A dica do botão da lâmpada: a carta tem prioridade, pois é o que precisa de ação agora
  const principal = (lista) => (lista.includes("carta") ? "carta" : lista[0]);

  // Tutorial e minigame abertos: o cartão fica quieto (eles já explicam o que fazer)
  const bloqueado = () => document.body.classList.contains("tut-aberto") || document.body.classList.contains("mini-aberto");

  // ---------- O cartão ----------
  function orbiHtml() {
    const desenho = window.ARES && window.ARES.orbiSvg ? window.ARES.orbiSvg() : ico("i-idea", "ico ico--grande");
    return `<div class="orbi dica-orbi" data-humor="feliz" aria-hidden="true">${desenho}</div>`;
  }

  function desenhar(ctx) {
    if (!cartao) {
      cartao = document.createElement("aside");
      cartao.className = "dica";
      cartao.setAttribute("role", "dialog");
      cartao.setAttribute("aria-modal", "false");           // não bloqueia o jogo
      cartao.setAttribute("aria-labelledby", "dica-titulo");
      document.body.appendChild(cartao);
    }
    cartao.hidden = false;
    cartao.dataset.dica = ctx;
    cartao.innerHTML = `
      ${orbiHtml()}
      <div class="dica-corpo">
        <p class="dica-selo">${t("dica_selo")}</p>
        <h2 class="dica-titulo" id="dica-titulo">${t(`dica_${ctx}_titulo`, NUMEROS)}</h2>
        <p class="dica-texto">${t(`dica_${ctx}_texto`, NUMEROS)}</p>
        <button class="btn btn-principal dica-ok" type="button" data-dica="ok">${ico("i-ship")} <span>${t("dica_entendi")}</span></button>
      </div>
      <button class="dica-x" type="button" data-dica="fechar" aria-label="${t("dica_fechar")}">${ico("i-x")}</button>`;
  }

  function abrir(ctx) {
    vistas.add(ctx);
    aberta = ctx;
    desenhar(ctx);
  }

  function fechar() {
    aberta = null;
    if (cartao) cartao.hidden = true;
  }

  // ---------- Decide o que mostrar (roda depois que a tela "assenta") ----------
  function avaliar() {
    const lista = contextos();
    const parado = bloqueado();

    if (botao) botao.style.display = lista.length && !parado ? "" : "none";

    if (parado || !lista.length) { fechar(); return; }
    if (aberta && !lista.includes(aberta)) fechar();        // mudou de tela: some o cartão antigo
    if (aberta) return;

    const nova = lista.find((c) => !vistas.has(c));         // só dicas que a criança ainda não viu
    if (nova) abrir(nova);
  }

  // O jogo redesenha a tela inteira a cada clique: esperamos um instante para não piscar
  function agendar() {
    clearTimeout(timer);
    timer = setTimeout(avaliar, 150);
  }

  // ---------- Cliques ----------
  function aoClicar(ev) {
    const b = ev.target.closest("[data-dica]");
    if (!b || b === cartao) return;
    const acao = b.dataset.dica;

    if (acao === "abrir") {
      const lista = contextos();
      if (!lista.length || bloqueado()) return;
      const ctx = principal(lista);
      if (aberta === ctx) { fechar(); return; }              // clicar de novo esconde
      abrir(ctx);
    } else if (acao === "ok" || acao === "fechar") {
      if (acao === "ok" && window.SOM && window.SOM.tocar) window.SOM.tocar("escolha");
      fechar();
      const titulo = q("#app h1");                           // devolve o foco ao jogo (teclado)
      if (titulo) titulo.focus({ preventScroll: true });
    }
  }

  function iniciar() {
    // Botão da lâmpada, ao lado do "?" do tutorial
    const topo = q(".topo-botoes");
    if (topo && !topo.querySelector(".btn-dica")) {
      botao = document.createElement("button");
      botao.type = "button";
      botao.className = "btn-idioma btn-dica";
      botao.dataset.dica = "abrir";
      botao.dataset.i18nAria = "dica_ver";                   // o i18n.js traduz o aria-label sozinho
      botao.setAttribute("aria-label", t("dica_ver"));
      botao.title = t("dica_ver");
      botao.innerHTML = ico("i-idea");
      botao.style.display = "none";
      topo.insertBefore(botao, topo.firstChild);
    }

    document.addEventListener("click", aoClicar);
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && aberta) fechar(); });

    const app = document.getElementById("app");
    if (app) new MutationObserver(agendar).observe(app, { childList: true, subtree: true });
    // Tutorial/minigame fechando muda a classe do <body>: aí a dica pode aparecer
    new MutationObserver(agendar).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    // Trocou o idioma: refaz o texto do cartão e o rótulo do botão
    new MutationObserver(() => {
      if (botao) botao.title = t("dica_ver");
      if (aberta) desenhar(aberta);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

    agendar();
  }

  window.DICAS = { abrir: () => { const l = contextos(); if (l.length) abrir(principal(l)); }, fechar };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();