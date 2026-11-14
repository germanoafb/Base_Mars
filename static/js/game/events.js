// Eventos que acontecem durante a missão. Cada evento visível traz uma CARTA DE DECISÃO
// com duas opções, e as duas têm algum custo (nenhuma escolha é de graça).
// As tempestades solares usam erupções REAIS do arquivo da NASA (DONKI),
// carregadas por nasa-data.js.
//
// JavaScript puro, sem mexer na tela, para poder ser testado em tests/.
// Os textos de cada evento e opção ficam em i18n.js (ev_<tipo>_titulo, op_<id>...).

(function (raiz) {
  "use strict";
  const ARES = raiz.ARES || (raiz.ARES = {});

  // Chance de cada evento por turno (a soma de cada fase fica abaixo de 1)
  const CHANCES = {
    viagem: { solar: 0.3, filtro: 0.15 },
    base: { solar: 0.2, poeira: 0.25, filtro: 0.1, praga: 0.1 },
  };

  // Opções de cada carta. Efeitos possíveis (todos valem só neste turno):
  //   o2, comida  → soma direto no recurso
  //   energia     → muda a energia disponível
  //   consumoO2   → muda quanto ar a tripulação gasta
  //   tempestade  → multiplica a dose da tempestade solar (0.3 = só 30%)
  //
  // Cada carta tem uma opção ATIVA (primeiro lugar) e uma PASSIVA (última).
  //   passiva → "efeito" fixo, sem risco.
  //   ativa   → tem um MINIGAME de 15 s ("mini"). O desempenho (0 a 1) mistura o efeito
  //             "pior" (0) com o "melhor" (1). Com o desempenho padrão (0.5, que é o que vale
  //             ao pular o minigame) o resultado é igual ao balanceamento original.
  // A tela dos minigames fica em static/js/minigames.js; aqui só ficam os números.
  const DESEMPENHO_PADRAO = 0.5;

  const OPCOES = {
    poeira: [
      // sair de traje gasta ar; limpar bem devolve a energia dos painéis (4 + até 4 = 8)
      { id: "limpar_paineis", mini: { jogo: "limpar_paineis", pior: { o2: -8, energia: 1 }, melhor: { o2: -8, energia: 4 } } },
      { id: "esperar_base", efeito: { consumoO2: -8 } },           // descansar gasta menos ar
    ],
    solar: [
      // abrigo com paredes de água: quanto mais prótons desviados, menos radiação
      { id: "abrigo", mini: { jogo: "abrigo", pior: { tempestade: 0.5, comida: -4 }, melhor: { tempestade: 0.1, comida: -4 } } },
      { id: "continuar", efeito: {} },                              // confia só no escudo
    ],
    filtro: [
      // conserto bem feito até melhora o ar; mal feito deixa vazar um pouco
      { id: "consertar_filtro", mini: { jogo: "consertar_filtro", pior: { o2: -4, energia: -2 }, melhor: { o2: 4, energia: -2 } } },
      { id: "repouso", efeito: { o2: -6 } },
    ],
    praga: [
      // arrancar só as folhas doentes salva a plantação; errar custa mais comida
      { id: "arrancar_plantas", mini: { jogo: "arrancar_plantas", pior: { comida: -10 }, melhor: { comida: -2 } } },
      { id: "luz_uv", efeito: { energia: -3 } },
    ],
  };

  // Fatos reais que chegam como "mensagem da Terra" quando o rádio está ligado.
  const TOTAL_FATOS = 7;

  function opcoesDe(tipo) {
    return (OPCOES[tipo] || []).map((o) => o.id);
  }

  const achar = (tipo, id) => (OPCOES[tipo] || []).find((o) => o.id === id);
  const limitar01 = (v) => Math.min(1, Math.max(0, v));

  // Mistura dois efeitos: p = 0 → "pior", p = 1 → "melhor".
  // Números inteiros, menos "tempestade" (fração, 2 casas).
  function misturar(pior, melhor, p) {
    const out = {};
    for (const k of new Set([...Object.keys(pior), ...Object.keys(melhor)])) {
      const neutro = k === "tempestade" ? 1 : 0;
      const a = pior[k] ?? neutro;
      const b = melhor[k] ?? neutro;
      const v = a + (b - a) * p;
      out[k] = k === "tempestade" ? Math.round(v * 100) / 100 : Math.round(v);
    }
    return out;
  }

  // Efeito da opção escolhida ({} se nada foi escolhido).
  // desempenho = resultado do minigame (0 a 1); sem ele vale o padrão (0.5).
  function efeitoDe(tipo, id, desempenho) {
    const opcao = achar(tipo, id);
    if (!opcao) return {};
    if (!opcao.mini) return opcao.efeito || {};
    const p = typeof desempenho === "number" && isFinite(desempenho) ? limitar01(desempenho) : DESEMPENHO_PADRAO;
    return misturar(opcao.mini.pior, opcao.mini.melhor, p);
  }

  // Nome do minigame da opção (ou null se for uma opção sem minigame)
  function minigameDe(tipo, id) {
    const opcao = achar(tipo, id);
    return opcao && opcao.mini ? opcao.mini.jogo : null;
  }

  // Pior e melhor efeito possíveis (a tela mostra "+1 a +4" nos botões)
  function faixaDe(tipo, id) {
    const opcao = achar(tipo, id);
    return opcao && opcao.mini ? { pior: opcao.mini.pior, melhor: opcao.mini.melhor } : null;
  }

  // Sorteia o evento do próximo turno.
  // avisado = true quando o rádio teve 2+ pontos: a Terra avisa da tempestade solar antes.
  function sortear(fase, rng, avisado) {
    const chances = CHANCES[fase];
    if (!chances) return null;
    let sorte = rng();

    for (const tipo of Object.keys(chances)) {
      if (sorte < chances[tipo]) {
        if (tipo === "solar") {
          // Sem dados da NASA carregados, não inventamos tempestade: o turno fica calmo
          const erupcao = ARES.dadosNasa && ARES.dadosNasa.sortearErupcao(rng);
          if (!erupcao) return null;
          return {
            tipo,
            visivel: Boolean(avisado),     // sem aviso, a tempestade vem de surpresa (sem carta)
            opcoes: opcoesDe(tipo),
            escolha: null,
            classe: erupcao.classe,
            nivel: erupcao.nivel,
            data: erupcao.pico,
            link: erupcao.link,
          };
        }
        return { tipo, visivel: true, opcoes: opcoesDe(tipo), escolha: null };
      }
      sorte -= chances[tipo];
    }
    return null;
  }

  ARES.eventos = { CHANCES, OPCOES, TOTAL_FATOS, DESEMPENHO_PADRAO, sortear, efeitoDe, minigameDe, faixaDe };
})(typeof window !== "undefined" ? window : globalThis);