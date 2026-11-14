// Testes das regras do jogo (static/js/game/).
// Rodar: node --test tests/
//
// Os arquivos do jogo são scripts comuns de navegador (definem window.ARES),
// então aqui eles rodam numa "caixa de areia" (vm) com um window de mentira.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ARQUIVOS = [
  "static/js/game/nasa-data.js",
  "static/js/game/events.js",
  "static/js/game/outpost.js",
];

// Carrega o jogo com erupções de mentira (ou nenhuma)
function carregar(erupcoes = [{ id: "a", pico: "2024-05-14T16:51Z", classe: "X8.7", nivel: "X" }, { id: "b", pico: "2024-05-10T06:54Z", classe: "M2.0", nivel: "M" }]) {
  const sandbox = { DONKI_FLARES: erupcoes ? { eventos: erupcoes } : undefined };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const arquivo of ARQUIVOS) vm.runInContext(readFileSync(arquivo, "utf8"), sandbox, { filename: arquivo });
  return sandbox.ARES;
}

// Sorteio previsível: sempre devolve o mesmo número
const fixo = (n) => () => n;

test("partida nova começa na viagem com 10 de energia", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();
  assert.equal(e.fase, "viagem");
  assert.equal(e.turno, 1);
  assert.equal(jogo.energiaDisponivel(e), 10);
  assert.equal(jogo.energiaLivre(e), 0);
});

test("ajustar respeita 0 a 5 pontos e a energia livre", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();
  assert.equal(jogo.ajustar(e, "o2", 1), false, "sem energia livre");
  assert.equal(jogo.ajustar(e, "comms", -1), true);
  assert.equal(jogo.ajustar(e, "o2", 1), true);
  assert.equal(e.alocacao.o2, 4);
  e.alocacao.shield = 0;
  assert.equal(jogo.ajustar(e, "shield", -1), false, "não fica negativo");
  assert.equal(jogo.ajustar(e, "xyz", 1), false, "sistema desconhecido");
});

test("previsão bate com o resultado quando não há evento escondido", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();
  const prev = jogo.previsao(e);
  jogo.avancar(e, fixo(0.99));   // 0.99 = nenhum evento no próximo turno
  assert.equal(e.o2, prev.o2);
  assert.equal(e.comida, prev.comida);
  assert.equal(e.rad, prev.rad);
});

test("radiação da viagem usa ~1,8 mSv/dia e o escudo reduz", () => {
  const { jogo } = carregar();
  const semEscudo = jogo.criarJogo();
  semEscudo.alocacao = { o2: 3, food: 3, shield: 0, comms: 0 };
  jogo.avancar(semEscudo, fixo(0.99));
  assert.equal(semEscudo.rad, 54);   // 30 dias × 1,8

  const comEscudo = jogo.criarJogo();
  comEscudo.alocacao = { o2: 3, food: 2, shield: 5, comms: 0 };
  jogo.avancar(comEscudo, fixo(0.99));
  assert.ok(comEscudo.rad < semEscudo.rad);
});

test("tempestade solar usa uma erupção real e só aparece com rádio ≥ 2", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();             // rádio começa com 2
  jogo.avancar(e, fixo(0.1));             // 0.1 < chance de tempestade solar
  assert.equal(e.evento.tipo, "solar");
  assert.equal(e.evento.visivel, true);
  assert.equal(e.evento.classe, "X8.7");

  const surpresa = jogo.criarJogo();
  surpresa.alocacao.comms = 0;
  surpresa.alocacao.o2 = 5;
  jogo.avancar(surpresa, fixo(0.1));
  assert.equal(surpresa.evento.visivel, false);
  // A previsão não conta a tempestade escondida, o resultado conta
  const prev = jogo.previsao(surpresa);
  jogo.avancar(surpresa, fixo(0.99));
  assert.ok(surpresa.rad > prev.rad);
  assert.equal(surpresa.diario.at(-1).chave, "log_solar_surpresa");
});

test("sem dados da NASA não inventa tempestade solar", () => {
  const { jogo } = carregar(null);
  const e = jogo.criarJogo();
  jogo.avancar(e, fixo(0.1));
  assert.equal(e.evento, null);
});

test("tempestade de poeira corta a energia pela metade e ajusta os pontos", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();
  for (let i = 0; i < 6; i++) jogo.avancar(e, fixo(0.99));   // viagem inteira
  assert.equal(e.fase, "base");
  e.evento = { tipo: "poeira", visivel: true };
  assert.equal(jogo.energiaDisponivel(e), 5);
  // Simula a chegada da poeira no sorteio
  const f = jogo.criarJogo();
  for (let i = 0; i < 6; i++) jogo.avancar(f, fixo(0.99));
  jogo.avancar(f, fixo(0.3));             // entre 0.2 (solar) e 0.45 (poeira)
  assert.equal(f.evento.tipo, "poeira");
  assert.ok(jogo.energiaLivre(f) >= 0, "pontos cabem na energia menor");
});

test("missão completa: 6 turnos de viagem + 10 sóis, depois debriefing", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();
  let turnos = 0;
  while (e.fase !== "fim" && turnos < 50) { jogo.avancar(e, fixo(0.99)); turnos++; }
  assert.equal(turnos, 16);
  assert.equal(e.fim.tipo, "completa");
  const r = jogo.avaliar(e);
  assert.equal(r.dias, 180);
  assert.equal(r.sois, 10);
  assert.ok(r.certo.length > 0 && r.dica.length > 0);
});

test("se o ar acaba, a missão termina mais cedo sem castigo", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();
  e.alocacao = { o2: 0, food: 5, shield: 5, comms: 0 };
  let turnos = 0;
  while (e.fase !== "fim" && turnos < 20) { jogo.avancar(e, fixo(0.99)); turnos++; }
  assert.equal(e.fim.tipo, "cedo");
  assert.equal(e.fim.motivo, "o2");
  assert.ok(jogo.avaliar(e).dica.some((d) => d.chave === "fim_dica_o2"));
});
