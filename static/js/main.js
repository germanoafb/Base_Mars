// Ponto de entrada do jogo no navegador.
// Cuida só da TELA: mostra as barras, lê os sliders/cliques do jogador
// e chama as regras em static/js/game/.
// As regras do jogo NÃO ficam aqui.

// As funções de idioma vêm de i18n.js (carregado antes no index.html)
const { mudarIdioma, idiomaAtual, idiomaInicial, traduzir } = window.I18N;

// ---------- Idioma (PT / EN) ----------
mudarIdioma(idiomaInicial());

// Um único "ouvinte" de cliques para a página toda.
// Cada botão diz o que faz pelo atributo data-a (ex.: data-a="next").
document.addEventListener("click", (evento) => {
  const botao = evento.target.closest("[data-a]");
  if (!botao) return;

  if (botao.dataset.a === "lang") {
    mudarIdioma(idiomaAtual() === "pt" ? "en" : "pt");
  }
  // Outras ações (next, adj, log, back, restart) entram aqui quando as regras ficarem prontas.
});

// Quando o jogo trocar o conteúdo de <main id="app">, a tela nova é traduzida sozinha.
const app = document.getElementById("app");
new MutationObserver(() => traduzir(app)).observe(app, { childList: true });
