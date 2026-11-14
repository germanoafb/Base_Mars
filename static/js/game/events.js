// Eventos que acontecem durante a missão: tempestades solares e de poeira.
// As tempestades solares usam erupções REAIS do arquivo da NASA (DONKI),
// carregadas por nasa-data.js.
//
// JavaScript puro, sem mexer na tela, para poder ser testado em tests/.

(function (raiz) {
  "use strict";
  const ARES = raiz.ARES || (raiz.ARES = {});

  // Chance de cada evento por turno
  const CHANCES = {
    viagem: { solar: 0.3, poeira: 0 },      // no espaço não tem poeira
    base: { solar: 0.2, poeira: 0.25 },
  };

  // Fatos reais que chegam como "mensagem da Terra" quando o rádio está ligado.
  // O texto de cada um fica em i18n.js (fato_0, fato_1, ...).
  const TOTAL_FATOS = 6;

  // Sorteia o evento do próximo turno.
  // avisado = true quando o rádio teve 2+ pontos: a Terra avisa da tempestade solar antes.
  function sortear(fase, rng, avisado) {
    const chance = CHANCES[fase];
    if (!chance) return null;
    const sorte = rng();

    if (sorte < chance.solar) {
      // Sem dados da NASA carregados, não inventamos tempestade: o turno fica calmo
      const erupcao = ARES.dadosNasa && ARES.dadosNasa.sortearErupcao(rng);
      if (!erupcao) return null;
      return {
        tipo: "solar",
        visivel: Boolean(avisado),
        classe: erupcao.classe,
        nivel: erupcao.nivel,
        data: erupcao.pico,
        link: erupcao.link,
      };
    }
    if (sorte < chance.solar + chance.poeira) {
      return { tipo: "poeira", visivel: true };   // poeira dá para ver chegando
    }
    return null;
  }

  ARES.eventos = { CHANCES, TOTAL_FATOS, sortear };
})(typeof window !== "undefined" ? window : globalThis);
