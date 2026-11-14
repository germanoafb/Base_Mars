// Traduções do jogo: português (pt) e inglês (en).
//
// Como usar no HTML:
//   <span data-i18n="comida">Comida</span>          → troca o texto
//   <button data-i18n-aria="mais_o2" aria-label=…>   → troca o aria-label (leitor de tela)
//   <h1 data-i18n="dia_viagem" data-n="72">          → {n} no texto vira 72
//
// Para adicionar um texto novo: crie a mesma chave em "pt" e em "en".
//
// Script comum (não "module") para funcionar até abrindo o index.html direto,
// sem servidor. Tudo fica dentro de window.I18N.

(function () {

const TEXTOS = {
  pt: {
    pular: "Pular para o jogo",
    lanc_titulo: "Rumo a Marte, comandante!",
    lanc_lead: "Sua nave tem pouca energia. Divida bem entre ar, comida e escudo. Nenhuma escolha é de graça!",
    tripulacao: "Sua tripulação",
    papel_comandante: "Comandante",
    papel_engenheiro: "Engenheiro",
    papel_botanica: "Botânica",
    lancar: "Lançar a nave!",

    energia_livre: "Energia livre",
    de: "de",
    oxigenio: "Oxigênio",
    comida: "Comida",
    radiacao: "Radiação",
    escudo: "Escudo",
    radio: "Rádio Terra",
    explica_msv: "<b>mSv</b> (milisievert) mede quanta radiação o corpo recebeu. Quanto menos, melhor!",

    dia_viagem: "Dia {n} de viagem",
    terra: "Terra",
    marte: "Marte",
    caminho: "{n}% do caminho",
    aviso_rad: "No espaço a radiação é cerca de <b>3 vezes maior</b> que em Marte. Escudo ajuda!",
    para_onde: "Para onde vai a energia?",
    menos_o2: "Menos energia para oxigênio",
    mais_o2: "Mais energia para oxigênio",
    menos_food: "Menos energia para comida",
    mais_food: "Mais energia para comida",
    menos_shield: "Menos energia para o escudo",
    mais_shield: "Mais energia para o escudo",
    menos_comms: "Menos energia para o rádio",
    mais_comms: "Mais energia para o rádio",
    proximo_turno: "Próximo turno ➜",

    sol: "Sol",
    explica_sol: "<b>Sol</b> = um dia em Marte. Dura 24 horas e 39 minutos.",
    ev_poeira_titulo: "Tempestade de poeira!",
    ev_poeira_texto: "A poeira cobre os painéis solares. Hoje você tem <b>metade da energia</b>.",
    ver_diario: "Ver diário de bordo",
    proximo_sol: "Próximo sol ➜",

    diario: "Diário de bordo",
    diario_ex1: "<b>Dia 71:</b> tudo calmo. A Lia viu a Terra virar um pontinho azul.",
    diario_ex2: "<b>Sol 7:</b> tempestade de poeira, os painéis geraram metade da energia.",
    diario_ex3: "<b>Sol 6:</b> tempestade solar! O escudo protegeu a tripulação.",
    diario_ex4: "<b>Sol 5:</b> a Yara colheu as primeiras alfaces.",
    voltar: "Voltar para a base",

    fim_titulo: "Missão concluída!",
    fim_lead: "Vocês ficaram 30 sóis em Marte. Veja o que aprendemos.",
    sois: "sóis",
    tripulantes_bem: "de 3 tripulantes bem",
    deu_certo: "Deu certo",
    certo_ex1: "Você ligou o escudo na tempestade solar. Ótima ideia!",
    certo_ex2: "O oxigênio nunca ficou baixo.",
    proxima: "Para a próxima",
    dica_ex1: "A comida ficou baixa no sol 12. Plantas precisam de energia para crescer.",
    jogar_de_novo: "↻ Jogar de novo",

    rodape_aviso: "<b>Dados arquivados, não ao vivo.</b> Os números vêm de medições já publicadas pela NASA.",
    fonte_rad: 'Radiação na viagem (~1,8 mSv/dia) e em Marte (~0,64 mSv/sol): detector <abbr title="Radiation Assessment Detector">RAD</abbr> do rover Curiosity (Zeitlin et al., 2013; Hassler et al., 2014).',
    fonte_donki: 'Tempestades solares: arquivo <a href="https://kauai.ccmc.gsfc.nasa.gov/DONKI/" target="_blank" rel="noopener">NASA DONKI</a>.',
    fonte_sol: 'Duração do sol (24h39min): <a href="https://mars.nasa.gov/" target="_blank" rel="noopener">NASA Mars Exploration</a>.',
    credito: "NASA Space Apps Challenge 2026 · Ilustrações feitas pela equipe.",
  },

  en: {
    pular: "Skip to the game",
    lanc_titulo: "Off to Mars, commander!",
    lanc_lead: "Your ship has little power. Share it between air, food and shield. Every choice has a cost!",
    tripulacao: "Your crew",
    papel_comandante: "Commander",
    papel_engenheiro: "Engineer",
    papel_botanica: "Botanist",
    lancar: "Launch the ship!",

    energia_livre: "Free power",
    de: "of",
    oxigenio: "Oxygen",
    comida: "Food",
    radiacao: "Radiation",
    escudo: "Shield",
    radio: "Earth radio",
    explica_msv: "<b>mSv</b> (millisievert) measures how much radiation the body got. Less is better!",

    dia_viagem: "Day {n} of the trip",
    terra: "Earth",
    marte: "Mars",
    caminho: "{n}% of the way",
    aviso_rad: "In space, radiation is about <b>3 times higher</b> than on Mars. The shield helps!",
    para_onde: "Where does the power go?",
    menos_o2: "Less power for oxygen",
    mais_o2: "More power for oxygen",
    menos_food: "Less power for food",
    mais_food: "More power for food",
    menos_shield: "Less power for the shield",
    mais_shield: "More power for the shield",
    menos_comms: "Less power for the radio",
    mais_comms: "More power for the radio",
    proximo_turno: "Next turn ➜",

    sol: "Sol",
    explica_sol: "<b>Sol</b> = one day on Mars. It lasts 24 hours and 39 minutes.",
    ev_poeira_titulo: "Dust storm!",
    ev_poeira_texto: "Dust covers the solar panels. Today you have <b>half the power</b>.",
    ver_diario: "See the logbook",
    proximo_sol: "Next sol ➜",

    diario: "Logbook",
    diario_ex1: "<b>Day 71:</b> all calm. Lia saw Earth become a tiny blue dot.",
    diario_ex2: "<b>Sol 7:</b> dust storm, the panels made half the power.",
    diario_ex3: "<b>Sol 6:</b> solar storm! The shield kept the crew safe.",
    diario_ex4: "<b>Sol 5:</b> Yara picked the first lettuces.",
    voltar: "Back to the base",

    fim_titulo: "Mission complete!",
    fim_lead: "You stayed 30 sols on Mars. Here is what we learned.",
    sois: "sols",
    tripulantes_bem: "of 3 crew members fine",
    deu_certo: "What went well",
    certo_ex1: "You turned on the shield during the solar storm. Great idea!",
    certo_ex2: "Oxygen never got low.",
    proxima: "Next time",
    dica_ex1: "Food got low on sol 12. Plants need power to grow.",
    jogar_de_novo: "↻ Play again",

    rodape_aviso: "<b>Archived data, not live.</b> The numbers come from measurements NASA has already published.",
    fonte_rad: 'Radiation during the trip (~1.8 mSv/day) and on Mars (~0.64 mSv/sol): Curiosity rover\'s <abbr title="Radiation Assessment Detector">RAD</abbr> detector (Zeitlin et al., 2013; Hassler et al., 2014).',
    fonte_donki: 'Solar storms: <a href="https://kauai.ccmc.gsfc.nasa.gov/DONKI/" target="_blank" rel="noopener">NASA DONKI</a> archive.',
    fonte_sol: 'Length of a sol (24h39min): <a href="https://mars.nasa.gov/" target="_blank" rel="noopener">NASA Mars Exploration</a>.',
    credito: "NASA Space Apps Challenge 2026 · Illustrations made by the team.",
  },
};

// Idioma atual ("pt" ou "en")
let idioma = "pt";

function idiomaAtual() {
  return idioma;
}

// Pega um texto pela chave. Ex.: t("dia_viagem", { n: 72 })
function t(chave, valores = {}) {
  const texto = TEXTOS[idioma][chave] ?? TEXTOS.pt[chave] ?? chave;
  return texto.replace(/\{(\w+)\}/g, (_, nome) => valores[nome] ?? "");
}

// Traduz tudo que tem data-i18n / data-i18n-aria dentro de "raiz"
function traduzir(raiz = document) {
  raiz.querySelectorAll("[data-i18n]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18n, { n: el.dataset.n });
  });
  raiz.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
}

// Troca o idioma, salva a escolha e traduz a página inteira
function mudarIdioma(novo) {
  idioma = novo === "en" ? "en" : "pt";
  document.documentElement.lang = idioma === "en" ? "en" : "pt-BR";
  try { localStorage.setItem("ares-idioma", idioma); } catch (e) { /* sem armazenamento: tudo bem */ }
  traduzir(document);
  // Também traduz os modelos <template> (as próximas telas já nascem no idioma certo)
  document.querySelectorAll("template").forEach((tpl) => traduzir(tpl.content));
}

// Idioma inicial: o que a pessoa escolheu antes, ou o do navegador
function idiomaInicial() {
  try {
    const salvo = localStorage.getItem("ares-idioma");
    if (salvo) return salvo;
  } catch (e) { /* ignora */ }
  return (navigator.language || "pt").toLowerCase().startsWith("pt") ? "pt" : "en";
}

  // Deixa as funções disponíveis para os outros scripts
  window.I18N = { TEXTOS, t, traduzir, mudarIdioma, idiomaAtual, idiomaInicial };
})();
