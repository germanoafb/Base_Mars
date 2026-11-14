// Carrega os dados da NASA já processados.
// As erupções solares vêm de static/data/donki_flares.js (gerado pelo script Python),
// que define window.DONKI_FLARES. Usamos .js (e não fetch de JSON) para o jogo
// funcionar até abrindo o index.html direto, sem servidor.
//
// Sempre guardar e mostrar a DATA dos dados: nunca apresentar dado salvo como "ao vivo".

(function (raiz) {
  "use strict";
  const ARES = raiz.ARES || (raiz.ARES = {});
  const bruto = raiz.DONKI_FLARES;
  const erupcoes = bruto && Array.isArray(bruto.eventos) ? bruto.eventos : [];
  const fortesX = erupcoes.filter((e) => e.nivel === "X");
  const medias = erupcoes.filter((e) => e.nivel === "M");

  ARES.dadosNasa = {
    disponivel: erupcoes.length > 0,
    fonte: bruto ? bruto.fonte : null,
    periodo: bruto ? bruto.periodo : null,
    baixadoEm: bruto ? bruto.baixadoEm : null,
    total: erupcoes.length,

    // Sorteia uma erupção real. As X (mais fortes) são raras nos dados,
    // então damos 30% de chance para elas aparecerem no jogo.
    sortearErupcao(rng) {
      const lista = fortesX.length && (rng() < 0.3 || !medias.length) ? fortesX : medias;
      if (!lista.length) return null;
      return lista[Math.floor(rng() * lista.length)];
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
