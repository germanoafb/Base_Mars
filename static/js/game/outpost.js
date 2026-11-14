// Estado da missão e as regras de cada turno.
//
// Fases: "viagem" (Terra → Marte, 1 turno = 30 dias) → "base" (1 turno = 1 sol) → "fim".
// Recursos: ar e água (%), comida (%) e radiação acumulada (mSv).
// A cada turno o jogador divide a energia entre suporte de vida, estufa, escudo e rádio.
// Energia que sobra vai para a BATERIA (usa no turno seguinte).
// O rádio também envia PONTOS DE CIÊNCIA para a Terra (a meta da missão).
//
// JavaScript puro, sem mexer na tela (nada de document/HTML aqui),
// para poder ser testado em tests/. Textos ficam em i18n.js: aqui só guardamos chaves.

(function (raiz) {
  "use strict";
  const ARES = raiz.ARES || (raiz.ARES = {});

  // ---------- Números do jogo (mude aqui para balancear) ----------
  const CONFIG = {
    energiaPorTurno: 8,        // o que os painéis solares geram
    energiaNaPoeira: 4,        // tempestade de poeira: metade da energia
    bateriaMax: 6,             // a bateria guarda a energia que sobrou
    bateriaInicio: 2,
    maxPorSistema: 4,
    metaCiencia: 30,           // pontos de ciência para "missão cumprida"
    inicio: { o2: 70, comida: 70 },
    consumo: { o2: 18, comida: 13 },        // gasto da tripulação por turno
    producao: { o2: 8, comida: 6 },         // ganho por ponto de energia
    viagem: { turnos: 6, diasPorTurno: 30, radDia: 1.8 },  // 180 dias; RAD/Curiosity: ~1,8 mSv/dia
    base: { sois: 10, radSol: 0.64 },                       // RAD/Curiosity: ~0,64 mSv/sol
    escudo: { fundo: 0.075, tempestade: 0.22 }, // por ponto: corta 7,5% da radiação comum e 22% da tempestade
    doseTempestade: { X: 40, M: 12 },           // mSv extra no espaço, sem escudo
    fatorMarte: 0.5,           // em Marte, o planeta e o ar bloqueiam parte da tempestade
    limiteCarreira: 600,       // NASA: limite de 600 mSv na carreira de um astronauta
    doseBoa: 300,              // abaixo disso o debriefing elogia
    radNaturalAno: 2.4,        // média mundial de radiação natural na Terra (mSv por ano)
    nivelBaixo: 30,            // abaixo disso o recurso "ficou baixo"
  };

  const SISTEMAS = ["o2", "food", "shield", "comms"];
  const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
  const decimo = (v) => Math.round(v * 10) / 10;
  const soma = (a) => SISTEMAS.reduce((t, k) => t + a[k], 0);

  // ---------- Criar uma partida nova ----------
  function criarJogo() {
    return {
      fase: "viagem",
      turno: 1,                       // turno dentro da fase atual
      o2: CONFIG.inicio.o2,
      comida: CONFIG.inicio.comida,
      rad: 0,
      alocacao: { o2: 2, food: 2, shield: 2, comms: 2 },
      bateria: CONFIG.bateriaInicio,
      ciencia: 0,
      evento: null,                   // primeiro turno é calmo
      diario: [],                     // { turno, rotulo, chave, p }
      historico: [],                  // um registro por turno jogado
      fatosRecebidos: 0,
      fim: null,                      // { tipo: "completa" | "cedo", motivo?, quando? }
    };
  }

  // "Dia 30" na viagem (fim do período de 30 dias) ou "Sol 3" na base
  function rotulo(e) {
    return e.fase === "viagem"
      ? { tipo: "dia", n: e.turno * CONFIG.viagem.diasPorTurno }
      : { tipo: "sol", n: e.turno };
  }

  // ---------- Energia ----------
  function energiaDisponivel(e) {
    return Math.max(0, energiaSolar(e) + e.bateria + (efeitoEscolhido(e).energia || 0));
  }

  // Só o que os painéis geram neste turno (sem a bateria)
  function energiaSolar(e) {
    return e.evento && e.evento.tipo === "poeira" ? CONFIG.energiaNaPoeira : CONFIG.energiaPorTurno;
  }

  // ---------- Cartas de decisão ----------
  // Efeito da opção escolhida na carta do turno ({} se não há carta ou escolha)
  function efeitoEscolhido(e) {
    const ev = e.evento;
    return ev && ev.visivel && ev.escolha ? ARES.eventos.efeitoDe(ev.tipo, ev.escolha) : {};
  }

  // A carta está na tela esperando uma escolha?
  function precisaEscolher(e) {
    const ev = e.evento;
    return Boolean(ev && ev.visivel && ev.opcoes && ev.opcoes.length && !ev.escolha);
  }

  // Botão da carta: escolhe (ou troca) a opção. Devolve true se mudou.
  function escolher(e, id) {
    const ev = e.evento;
    if (!ev || !ev.visivel || !ev.opcoes || !ev.opcoes.includes(id)) return false;
    ev.escolha = id;
    encaixarEnergia(e);
    return true;
  }

  function energiaLivre(e) {
    return energiaDisponivel(e) - soma(e.alocacao);
  }

  // Botões − e +: muda 1 ponto se for permitido. Devolve true se mudou.
  function ajustar(e, sistema, delta) {
    if (!SISTEMAS.includes(sistema) || (delta !== 1 && delta !== -1)) return false;
    const novo = e.alocacao[sistema] + delta;
    if (novo < 0 || novo > CONFIG.maxPorSistema) return false;
    if (delta > 0 && energiaLivre(e) <= 0) return false;
    e.alocacao[sistema] = novo;
    return true;
  }

  // Quando a energia cai (poeira), tira pontos até caber: rádio, escudo, comida, ar
  function encaixarEnergia(e) {
    const ordem = ["comms", "shield", "food", "o2"];
    let i = 0;
    while (energiaLivre(e) < 0) {
      const k = ordem[i % ordem.length];
      if (e.alocacao[k] > 0) e.alocacao[k] -= 1;
      i += 1;
    }
  }

  // ---------- Cálculo de um turno ----------
  // incluirOculto = false → só o que o jogador sabe (usado na previsão da tela)
  function calcularTurno(e, incluirOculto) {
    const a = e.alocacao;
    const ef = efeitoEscolhido(e);
    const naViagem = e.fase === "viagem";
    const gastoAr = CONFIG.consumo.o2 + (ef.consumoO2 || 0);
    const o2 = limitar(Math.round(e.o2 + CONFIG.producao.o2 * a.o2 - gastoAr + (ef.o2 || 0)), 0, 100);
    const comida = limitar(Math.round(e.comida + CONFIG.producao.comida * a.food - CONFIG.consumo.comida + (ef.comida || 0)), 0, 100);

    const radComum = naViagem ? CONFIG.viagem.diasPorTurno * CONFIG.viagem.radDia : CONFIG.base.radSol;
    const fundo = radComum * (1 - CONFIG.escudo.fundo * a.shield);

    let tempestade = 0;
    const ev = e.evento;
    if (ev && ev.tipo === "solar" && (incluirOculto || ev.visivel)) {
      tempestade = CONFIG.doseTempestade[ev.nivel] * (naViagem ? 1 : CONFIG.fatorMarte) *
        (1 - CONFIG.escudo.tempestade * a.shield) * (ef.tempestade ?? 1);
    }

    return {
      o2,
      comida,
      fundo: decimo(fundo),
      tempestade: decimo(tempestade),
      rad: decimo(e.rad + fundo + tempestade),
    };
  }

  // Previsão do fim do turno para mostrar na tela (+/-)
  function previsao(e) {
    return calcularTurno(e, false);
  }

  // Quanto cada sistema muda no turno (para mostrar ao lado dos botões)
  function efeitoDosSistemas(e) {
    const a = e.alocacao;
    return {
      o2: Math.round(CONFIG.producao.o2 * a.o2 - CONFIG.consumo.o2),
      food: Math.round(CONFIG.producao.comida * a.food - CONFIG.consumo.comida),
      shield: Math.round(CONFIG.escudo.tempestade * a.shield * 100),   // % de proteção na tempestade
      comms: a.comms,
    };
  }

  // ---------- Avançar o turno (botão "Próximo") ----------
  function avancar(e, rng) {
    if (e.fase === "fim") return e;
    rng = rng || Math.random;

    // Carta sem resposta: fica com a última opção (a mais "neutra")
    const ev = e.evento;
    if (precisaEscolher(e)) escolher(e, ev.opcoes[ev.opcoes.length - 1]);

    const r = calcularTurno(e, true);
    const sobra = energiaLivre(e);
    const quando = rotulo(e);
    const id = e.historico.length + 1;
    const anotar = (chave, p) => e.diario.push({ turno: id, rotulo: quando, chave, p: p || {} });

    e.historico.push({
      fase: e.fase,
      rotulo: quando,
      alocacao: Object.assign({}, e.alocacao),
      evento: ev ? { tipo: ev.tipo, nivel: ev.nivel || null, visivel: ev.visivel, escolha: ev.escolha || null } : null,
      o2: r.o2,
      comida: r.comida,
      dose: decimo(r.fundo + r.tempestade),
      bateria: Math.min(CONFIG.bateriaMax, sobra),
    });
    e.o2 = r.o2;
    e.comida = r.comida;
    e.rad = r.rad;
    e.bateria = Math.min(CONFIG.bateriaMax, sobra);   // o que sobrou fica guardado
    e.ciencia += e.alocacao.comms;                     // cada ponto no rádio = 1 de ciência

    // Diário de bordo
    if (ev && ev.tipo === "solar") {
      const p = { classe: ev.classe, data: ev.data, dose: r.tempestade };
      if (!ev.visivel) anotar("log_solar_surpresa", p);
      else anotar(e.alocacao.shield >= 3 ? "log_solar_protegidos" : "log_solar_fraco", p);
    } else if (ev) {
      anotar("log_" + ev.tipo);          // log_poeira, log_filtro, log_praga
    } else {
      anotar((e.fase === "viagem" ? "log_calmo_" : "log_base_") + (id % 3));
    }
    if (ev && ev.visivel && ev.escolha) anotar("log_escolha", { op: ev.escolha });
    if (e.alocacao.comms >= 1) {
      anotar("log_terra", { fato: e.fatosRecebidos % ARES.eventos.TOTAL_FATOS });
      e.fatosRecebidos += 1;
    }

    // Acabou o ar ou a comida: a missão termina mais cedo, sem castigo
    if (e.o2 <= 0 || e.comida <= 0) {
      const motivo = e.o2 <= 0 ? "o2" : "comida";
      anotar(motivo === "o2" ? "log_fim_o2" : "log_fim_comida");
      e.fase = "fim";
      e.fim = { tipo: "cedo", motivo, quando };
      e.evento = null;
      return e;
    }

    // Próxima etapa
    if (e.fase === "viagem" && e.turno >= CONFIG.viagem.turnos) {
      e.fase = "base";
      e.turno = 1;
      anotar("log_chegada");
    } else if (e.fase === "base" && e.turno >= CONFIG.base.sois) {
      e.fase = "fim";
      e.fim = { tipo: "completa" };
      e.evento = null;
      return e;
    } else {
      e.turno += 1;
    }

    e.evento = ARES.eventos.sortear(e.fase, rng, e.alocacao.comms >= 2);
    encaixarEnergia(e);
    return e;
  }

  // ---------- Debriefing: o que deu certo e o que melhorar ----------
  function avaliar(e) {
    const h = e.historico;
    const certo = [];
    const dica = [];

    const solares = h.filter((x) => x.evento && x.evento.tipo === "solar");
    // Protegida = escudo forte (3+) ou tripulação no abrigo
    const protegidas = solares.filter((x) => x.alocacao.shield >= 3 || x.evento.escolha === "abrigo").length;
    if (solares.length && protegidas === solares.length) certo.push({ chave: "fim_certo_escudo", p: { n: protegidas } });
    else if (protegidas > 0) certo.push({ chave: "fim_certo_escudo_parcial", p: { n: protegidas, total: solares.length } });
    if (protegidas < solares.length) dica.push({ chave: "fim_dica_escudo" });
    if (solares.some((x) => x.evento.escolha === "abrigo")) certo.push({ chave: "fim_certo_abrigo" });

    const menor = (campo) => h.reduce((m, x) => (!m || x[campo] < m[campo] ? x : m), null);
    const piorO2 = menor("o2");
    const piorComida = menor("comida");
    if (piorO2 && piorO2.o2 < CONFIG.nivelBaixo) dica.push({ chave: "fim_dica_o2", p: { quando: piorO2.rotulo } });
    else if (piorO2) certo.push({ chave: "fim_certo_o2" });
    if (piorComida && piorComida.comida < CONFIG.nivelBaixo) dica.push({ chave: "fim_dica_comida", p: { quando: piorComida.rotulo } });
    else if (piorComida) certo.push({ chave: "fim_certo_comida" });

    const comRadio = h.filter((x) => x.alocacao.comms >= 1).length;
    if (h.length && comRadio >= h.length / 2) certo.push({ chave: "fim_certo_radio" });
    else dica.push({ chave: "fim_dica_radio" });

    if (e.ciencia >= CONFIG.metaCiencia) certo.push({ chave: "fim_certo_ciencia", p: { n: e.ciencia } });
    else dica.push({ chave: "fim_dica_ciencia", p: { n: e.ciencia, meta: CONFIG.metaCiencia } });

    if (e.rad < CONFIG.doseBoa) certo.push({ chave: "fim_certo_rad", p: { n: CONFIG.doseBoa } });
    else dica.push({ chave: "fim_dica_rad", p: { n: CONFIG.doseBoa } });

    if (!certo.length) certo.push({ chave: "fim_certo_tentou" });
    if (!dica.length) dica.push({ chave: "fim_dica_padrao" });

    const turnosViagem = h.filter((x) => x.fase === "viagem").length;
    // Resultado: "cumprida" (sobreviveu + meta de ciência), "sobreviveram" ou "cedo"
    const resultado = e.fim && e.fim.tipo === "cedo" ? "cedo"
      : e.ciencia >= CONFIG.metaCiencia ? "cumprida" : "sobreviveram";
    return {
      resultado,
      ciencia: e.ciencia,
      certo,
      dica,
      dias: turnosViagem * CONFIG.viagem.diasPorTurno,
      sois: h.filter((x) => x.fase === "base").length,
      rad: e.rad,
      anosNaTerra: Math.round(e.rad / CONFIG.radNaturalAno),
    };
  }

  ARES.jogo = {
    CONFIG,
    SISTEMAS,
    criarJogo,
    energiaDisponivel,
    energiaSolar,
    efeitoEscolhido,
    precisaEscolher,
    escolher,
    energiaLivre,
    ajustar,
    previsao,
    efeitoDosSistemas,
    avancar,
    avaliar,
  };
})(typeof window !== "undefined" ? window : globalThis);
