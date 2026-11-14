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
  const OPCOES = {
    poeira: [
      { id: "limpar_paineis", efeito: { o2: -8, energia: 3 } },   // sair de traje gasta ar
      { id: "esperar_base", efeito: { consumoO2: -8 } },           // descansar gasta menos ar
    ],
    solar: [
      { id: "abrigo", efeito: { tempestade: 0.3, comida: -4 } },   // abrigo com paredes de água
      { id: "continuar", efeito: {} },                              // confia só no escudo
    ],
    filtro: [
      { id: "consertar_filtro", efeito: { energia: -2 } },
      { id: "repouso", efeito: { o2: -6 } },
    ],
    praga: [
      { id: "arrancar_plantas", efeito: { comida: -6 } },
      { id: "luz_uv", efeito: { energia: -3 } },
    ],
  };

  // Fatos reais que chegam como "mensagem da Terra" quando o rádio está ligado.
  const TOTAL_FATOS = 7;

  function opcoesDe(tipo) {
    return (OPCOES[tipo] || []).map((o) => o.id);
  }

  // Efeito da opção escolhida ({} se nada foi escolhido)
  function efeitoDe(tipo, id) {
    const opcao = (OPCOES[tipo] || []).find((o) => o.id === id);
    return opcao ? opcao.efeito : {};
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

  ARES.eventos = { CHANCES, OPCOES, TOTAL_FATOS, sortear, efeitoDe };
})(typeof window !== "undefined" ? window : globalThis);
