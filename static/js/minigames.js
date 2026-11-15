// Minigames de 15 segundos das cartas de decisão.
// Cuida só da TELA (nenhuma regra de balanceamento aqui): cada jogo devolve uma NOTA de 0 a 1,
// e quem transforma essa nota em energia, ar, comida ou radiação é game/events.js.
//
// Como funciona:
//   MINIGAMES.iniciar({ jogo, tipo, efeitoHtml, aoTerminar })
//     jogo        → "limpar_paineis" | "abrigo" | "consertar_filtro" | "arrancar_plantas"
//     tipo        → tipo da carta ("poeira", "solar"...): só pinta a janela com a cor da carta
//     efeitoHtml  → função(nota) que devolve o HTML dos chips de efeito (mostrado no resultado)
//     aoTerminar  → função(nota): chamada ao continuar. nota = null se a pessoa pulou.
//
// Três fases: instrução → jogando (15 s) → resultado. Quem não quer ou não consegue jogar
// (teclado, leitor de tela, movimento reduzido...) pode pular e ganha o resultado médio.
// Todos os alvos são <button>, então o teclado funciona (Tab + Enter).
//
// Para criar um minigame novo: escreva uma função como as de baixo (recebe a "arena" e o "ctrl",
// devolve { nota() }), coloque em JOGOS e dê textos mini_<nome>_* em i18n.js.
//
// Script comum (não "module"), como o resto do jogo.

(function () {
  "use strict";

  const { t } = window.I18N;
  const DURACAO = 15000;   // ms

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ico = (id, cls = "ico") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const limitar01 = (v) => Math.min(1, Math.max(0, v));
  const soma = (a) => a.reduce((x, y) => x + y, 0);

  function embaralhar(lista) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- Ajudantes dos jogos ----------
  // Mouse/toque disparam no pointerdown (mais rápido e não "perde" alvo que se mexe);
  // teclado e leitor de tela disparam no click (detail 0).
  function aoAtivar(arena, seletor, fn) {
    arena.addEventListener("pointerdown", (e) => {
      if (e.button > 0) return;
      const el = e.target.closest(seletor);
      if (el && arena.contains(el)) fn(el);
    });
    arena.addEventListener("click", (e) => {
      if (e.detail !== 0) return;
      const el = e.target.closest(seletor);
      if (el && arena.contains(el)) fn(el);
    });
  }

  // Pisca uma classe por um instante
  function piscar(el, classe, ms, ctrl) {
    el.classList.add(classe);
    ctrl.depois(() => el.classList.remove(classe), ms);
  }

  // ================= JOGO 1: limpar os painéis (poeira) =================
  // 24 painéis, alguns com poeira (1 ou 2 camadas). Clique ou ARRASTE por cima para limpar.
  function limparPaineis(arena, ctrl) {
    const COLS = 6, N = 24;
    const nivel = new Array(N).fill(0);
    embaralhar([...Array(N).keys()]).slice(0, 18).forEach((i) => { nivel[i] = Math.random() < 0.5 ? 1 : 2; });
    const total = soma(nivel);
    let restante = total;
    let ultimo = -1;

    arena.classList.add("arena--paineis");
    arena.style.setProperty("--cols", COLS);
    arena.innerHTML = nivel.map((n, i) =>
      `<button type="button" class="cel cel--${n}" data-i="${i}" aria-label="${esc(t(n ? "mini_painel_sujo" : "mini_painel_limpo"))}"></button>`).join("");
    const cels = [...arena.children];
    const mostrar = () => ctrl.placar(t("mini_limpar_paineis_placar", { n: Math.round((restante / total) * 100) }));
    mostrar();

    function limpar(i) {
      if (i === ultimo) return;          // arrastando: uma limpada por painel visitado
      ultimo = i;
      if (nivel[i] <= 0) return;
      nivel[i] -= 1;
      restante -= 1;
      cels[i].className = `cel cel--${nivel[i]}`;
      if (!nivel[i]) cels[i].setAttribute("aria-label", t("mini_painel_limpo"));
      ctrl.som("acerto");
      mostrar();
      if (restante === 0) ctrl.fim();
    }

    // Arrastar: o dedo/mouse passa por cima de vários painéis
    arena.addEventListener("pointerdown", (e) => { ultimo = -1; if (e.button <= 0) sobre(e); });
    arena.addEventListener("pointermove", (e) => { if (e.buttons & 1) sobre(e); });
    function sobre(e) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cel = el && el.closest(".cel");
      if (cel && arena.contains(cel)) limpar(Number(cel.dataset.i));
    }
    arena.addEventListener("click", (e) => {      // teclado / leitor de tela
      if (e.detail !== 0) return;
      const cel = e.target.closest(".cel");
      if (cel) { ultimo = -1; limpar(Number(cel.dataset.i)); }
    });

    return { nota: () => limitar01(1 - restante / total) };
  }

  // ================= JOGO 2: proteger o abrigo (tempestade solar) =================
  // Prótons caem do alto. Clique em cada um para desviar antes de chegar no abrigo.
  function protegerAbrigo(arena, ctrl) {
    const VIDA = 2300;          // quanto tempo um próton leva para cair (ms)
    const ULTIMO_SORTEIO = 12000;
    let gerados = 0, desviados = 0;

    arena.classList.add("arena--ceu");
    arena.innerHTML = `<div class="abrigo" aria-hidden="true">${ico("i-home", "ico ico--grande")}</div>`;
    const mostrar = () => ctrl.placar(t("mini_abrigo_placar", { n: `${desviados}/${gerados}` }));
    mostrar();

    function gerar() {
      if (ctrl.agora() > ULTIMO_SORTEIO) return;
      gerados += 1;
      const p = document.createElement("button");
      p.type = "button";
      p.className = "proton";
      p.textContent = "+";
      p.setAttribute("aria-label", t("mini_proton"));
      p.style.left = `${4 + Math.random() * 80}%`;
      p.style.setProperty("--vida", `${VIDA}ms`);
      arena.appendChild(p);
      // dois frames: o navegador precisa "ver" o topo antes de a transição começar
      requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add("proton--cai")));
      ctrl.depois(() => {
        if (!p.isConnected || p.dataset.fim) return;
        p.remove();                                    // chegou no abrigo
        piscar(arena, "arena--dano", 220, ctrl);
        ctrl.som("erro");
      }, VIDA);
      mostrar();
    }

    aoAtivar(arena, ".proton", (p) => {
      if (p.dataset.fim) return;
      p.dataset.fim = "1";
      desviados += 1;
      p.classList.add("proton--ok");
      ctrl.depois(() => p.remove(), 180);
      ctrl.som("acerto");
      mostrar();
    });

    gerar();
    ctrl.cada(gerar, 450);
    return { nota: () => (gerados ? limitar01(desviados / gerados) : 0) };
  }

  // ================= JOGO 3: consertar o filtro (parafusos em ordem) =================
  function consertarFiltro(arena, ctrl) {
    const N = 8, COLS = 4, LINHAS = 3;
    const slots = embaralhar([...Array(COLS * LINHAS).keys()]).slice(0, N);
    let prox = 1, travado = false;

    arena.classList.add("arena--filtro");
    arena.style.setProperty("--cols", COLS);
    // O DOM fica em ordem 1..N (assim o Tab também segue a ordem certa); a posição vem do grid
    arena.innerHTML = slots.map((s, i) =>
      `<button type="button" class="parafuso" data-n="${i + 1}" style="grid-column:${(s % COLS) + 1};grid-row:${Math.floor(s / COLS) + 1}" aria-label="${esc(t("mini_parafuso", { n: i + 1 }))}">${i + 1}</button>`).join("");
    const mostrar = () => ctrl.placar(t("mini_consertar_filtro_placar", { n: Math.min(prox, N) }));
    mostrar();

    aoAtivar(arena, ".parafuso", (b) => {
      if (travado || b.dataset.ok) return;
      if (Number(b.dataset.n) === prox) {
        b.dataset.ok = "1";
        b.classList.add("parafuso--ok");
        b.setAttribute("aria-disabled", "true");
        prox += 1;
        ctrl.som("acerto");
        mostrar();
        if (prox > N) ctrl.fim();
      } else {
        // Ordem errada: balança e trava por meio segundo ("perde tempo")
        travado = true;
        arena.classList.add("arena--travada");
        piscar(b, "parafuso--erro", 300, ctrl);
        ctrl.som("erro");
        ctrl.depois(() => { travado = false; arena.classList.remove("arena--travada"); }, 500);
      }
    });

    return { nota: () => limitar01((prox - 1) / N) };
  }

  // ================= JOGO 4: salvar a estufa (só as folhas doentes) =================
  function arrancarPlantas(arena, ctrl) {
    const N = 12, COLS = 4;
    const ULTIMO_SORTEIO = 11500;
    const doente = new Array(N).fill(false);
    embaralhar([...Array(N).keys()]).slice(0, 3).forEach((i) => { doente[i] = true; });
    let total = 3, salvas = 0, erros = 0;

    arena.classList.add("arena--estufa");
    arena.style.setProperty("--cols", COLS);
    arena.innerHTML = doente.map((d, i) =>
      `<button type="button" class="folha${d ? " folha--doente" : ""}" data-i="${i}" aria-label="${esc(t(d ? "mini_folha_doente" : "mini_folha_saudavel"))}">${ico("i-food", "ico ico--folha")}</button>`).join("");
    const folhas = [...arena.children];
    const mostrar = () => ctrl.placar(t("mini_arrancar_plantas_placar", { n: `${salvas}/${total}` }));
    mostrar();

    function adoecer(i) {
      doente[i] = true;
      folhas[i].classList.add("folha--doente");
      folhas[i].setAttribute("aria-label", t("mini_folha_doente"));
    }

    ctrl.cada(() => {
      if (ctrl.agora() > ULTIMO_SORTEIO) return;
      const saudaveis = doente.map((d, i) => (d ? -1 : i)).filter((i) => i >= 0);
      if (!saudaveis.length) return;
      adoecer(saudaveis[Math.floor(Math.random() * saudaveis.length)]);
      total += 1;
      mostrar();
    }, 1450);

    aoAtivar(arena, ".folha", (el) => {
      const i = Number(el.dataset.i);
      if (doente[i]) {
        doente[i] = false;
        salvas += 1;
        el.classList.remove("folha--doente");
        el.setAttribute("aria-label", t("mini_folha_saudavel"));
        piscar(el, "folha--curada", 300, ctrl);
        ctrl.som("acerto");
      } else {
        erros += 1;                                   // folha saudável: não arranca!
        piscar(el, "folha--erro", 300, ctrl);
        ctrl.som("erro");
      }
      mostrar();
    });

    return { nota: () => limitar01((salvas - 0.5 * erros) / total) };
  }

  // Catálogo: ícone do título, o jogo, e a chave do texto "você sabia?"
  const JOGOS = {
    limpar_paineis: { icone: "i-dust", montar: limparPaineis },
    abrigo: { icone: "i-rad", montar: protegerAbrigo },
    consertar_filtro: { icone: "i-o2", montar: consertarFiltro },
    arrancar_plantas: { icone: "i-food", montar: arrancarPlantas },
  };

  let aberto = false;

  // ---------- A janela do minigame ----------
  function iniciar({ jogo, tipo, efeitoHtml, aoTerminar }) {
    const def = JOGOS[jogo];
    if (!def) { aoTerminar(null); return; }
    if (aberto) return;
    aberto = true;

    const camada = document.createElement("div");
    camada.className = "mini-camada";
    document.body.appendChild(camada);
    document.body.classList.add("mini-aberto");

    let fase = "intro";
    let atual = null;                   // o jogo em andamento
    let nota = 0;
    const timers = [];                  // tudo que precisa ser desligado ao sair
    let t0 = 0;
    const agora = () => performance.now() - t0;

    const som = (nome) => { try { if (window.SOM) window.SOM.tocar(nome); } catch (e) { /* sem som: tudo bem */ } };

    // A mesma voz do Orbi do tutorial (quem não lê bem ainda entende a instrução).
    const narra = (texto) => { const A = window.ARES; if (A && A.falar) A.falar(texto); };
    const cala = () => { const A = window.ARES; if (A && A.calar) A.calar(); };

    const ctrl = {
      agora,
      som,
      placar: (texto) => { const el = camada.querySelector(".mini-placar"); if (el) el.textContent = texto; },
      fim: () => terminar(),
      depois: (fn, ms) => { const id = setTimeout(fn, ms); timers.push(["t", id]); return id; },
      cada: (fn, ms) => { const id = setInterval(fn, ms); timers.push(["i", id]); return id; },
    };

    function desligar() {
      timers.splice(0).forEach(([tipoTimer, id]) => (tipoTimer === "t" ? clearTimeout(id) : clearInterval(id)));
    }

    const titulo = t(`mini_${jogo}_titulo`);
    const moldura = (corpo, acoes) => `
      <div class="mini evento--${esc(tipo)}" role="dialog" aria-modal="true" aria-labelledby="mini-titulo" aria-describedby="mini-instrucao" tabindex="-1">
        <h2 id="mini-titulo" class="mini-titulo">${ico(def.icone, "ico ico--titulo")} ${titulo}</h2>
        <p id="mini-instrucao" class="mini-instrucao">${t(`mini_${jogo}_instrucao`)}</p>
        ${corpo}
        <div class="mini-acoes">${acoes}</div>
      </div>`;
    const botao = (acao, texto, cls) => `<button type="button" class="btn ${cls}" data-m="${acao}">${texto}</button>`;

    function mostrarIntro() {
      fase = "intro";
      camada.innerHTML = moldura(
        `<div class="mini-arena mini-arena--previa" aria-hidden="true">${ico(def.icone, "ico ico--gigante")}</div>`,
        botao("comecar", t("mini_comecar"), "btn-principal") + botao("pular", t("mini_pular"), "btn-secundario"));
      camada.querySelector('[data-m="comecar"]').focus();
      narra(`${titulo}. ${t(`mini_${jogo}_instrucao`)}`);
    }

    function comecar() {
      if (fase !== "intro") return;
      fase = "jogando";
      cala();                                       // a instrução já foi ouvida: não fala por cima do jogo
      camada.innerHTML = moldura(`
        <div class="mini-status">
          <div class="mini-tempo" aria-hidden="true"><div class="mini-tempo-fill"></div></div>
          <span class="mini-segundos" aria-hidden="true">${DURACAO / 1000}</span><span aria-hidden="true">s</span>
        </div>
        <p class="mini-placar"></p>
        <div class="mini-arena"></div>`,
        botao("pular", t("mini_pular"), "btn-secundario"));
      const arena = camada.querySelector(".mini-arena");
      t0 = performance.now();
      atual = def.montar(arena, ctrl);

      const fill = camada.querySelector(".mini-tempo-fill");
      const seg = camada.querySelector(".mini-segundos");
      ctrl.cada(() => {
        const decorrido = agora();
        fill.style.width = `${limitar01(1 - decorrido / DURACAO) * 100}%`;
        seg.textContent = String(Math.max(0, Math.ceil((DURACAO - decorrido) / 1000)));
        if (decorrido >= DURACAO) terminar();
      }, 100);

      const primeiro = arena.querySelector("button");
      (primeiro || camada.querySelector(".mini")).focus({ preventScroll: true });
    }

    function terminar() {
      if (fase !== "jogando") return;
      fase = "fim";
      nota = limitar01(atual ? atual.nota() : 0);
      desligar();
      som("fim");
      const pct = Math.round(nota * 100);
      const veredito = nota >= 0.85 ? "mini_otimo" : nota >= 0.55 ? "mini_bom" : "mini_tentar";
      camada.innerHTML = moldura(`
        <div class="mini-resultado" role="status">
          <p class="mini-nota">${t("mini_resultado", { pct })}</p>
          <div class="mini-barra" aria-hidden="true"><div style="width:${pct}%"></div></div>
          <p class="mini-veredito">${t(veredito)}</p>
          <p class="mini-efeito-titulo">${t("mini_efeito")}</p>
          <div class="escolha-efeitos">${efeitoHtml ? efeitoHtml(nota) : ""}</div>
          <p class="mini-fato"><b>${t("mini_sabia")}</b> ${t(`mini_${jogo}_fato`)}</p>
        </div>`,
        botao("continuar", t("mini_continuar"), "btn-principal"));
      camada.querySelector('[data-m="continuar"]').focus();
      narra(`${t(veredito)} ${t("mini_sabia")} ${t(`mini_${jogo}_fato`)}`);
    }

    function sair(valor) {
      desligar();
      cala();
      document.removeEventListener("keydown", teclas, true);
      camada.remove();
      document.body.classList.remove("mini-aberto");
      aberto = false;
      aoTerminar(valor);
    }

    // Esc pula (ou continua, no resultado). Tab fica preso dentro da janela.
    function teclas(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        sair(fase === "fim" ? nota : null);
      } else if (e.key === "Tab") {
        const itens = [...camada.querySelectorAll("button:not(:disabled):not([aria-disabled='true'])")];
        if (!itens.length) { e.preventDefault(); return; }
        const i = itens.indexOf(document.activeElement);
        const proximo = e.shiftKey ? (i <= 0 ? itens.length - 1 : i - 1) : (i === itens.length - 1 ? 0 : i + 1);
        if (i === -1 || (e.shiftKey ? i === 0 : i === itens.length - 1)) { e.preventDefault(); itens[proximo].focus(); }
      }
    }
    document.addEventListener("keydown", teclas, true);

    camada.addEventListener("click", (e) => {
      const b = e.target.closest("[data-m]");
      if (!b) return;
      if (b.dataset.m === "comecar") comecar();
      else if (b.dataset.m === "pular") sair(null);
      else if (b.dataset.m === "continuar") sair(nota);
    });

    mostrarIntro();
  }

  window.MINIGAMES = { iniciar, DURACAO, JOGOS: Object.keys(JOGOS) };
})();