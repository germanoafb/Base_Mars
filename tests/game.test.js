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
const CALMO = fixo(0.99);   // 0.99 = nenhum evento no próximo turno

test("partida nova: 8 dos painéis + 2 da bateria", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();
  assert.equal(e.fase, "viagem");
  assert.equal(e.turno, 1);
  assert.equal(jogo.energiaSolar(e), 8);
  assert.equal(e.bateria, 2);
  assert.equal(jogo.energiaDisponivel(e), 10);
  assert.equal(jogo.energiaLivre(e), 2);
});

test("ajustar respeita 0 a 4 pontos e a energia livre", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();
  assert.equal(jogo.ajustar(e, "o2", 1), true);
  assert.equal(jogo.ajustar(e, "o2", 1), true);
  assert.equal(e.alocacao.o2, 4);
  assert.equal(jogo.ajustar(e, "food", 1), false, "sem energia livre");
  assert.equal(jogo.ajustar(e, "comms", -1), true);
  assert.equal(jogo.ajustar(e, "o2", 1), false, "máximo de 4 por sistema");
  e.alocacao.shield = 0;
  assert.equal(jogo.ajustar(e, "shield", -1), false, "não fica negativo");
  assert.equal(jogo.ajustar(e, "xyz", 1), false, "sistema desconhecido");
});

test("energia que sobra vai para a bateria (até 6)", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();
  e.alocacao = { o2: 2, food: 2, shield: 0, comms: 0 };   // sobram 6 de 10
  jogo.avancar(e, CALMO);
  assert.equal(e.bateria, 6);
  assert.equal(jogo.energiaDisponivel(e), 14);
  e.alocacao = { o2: 2, food: 2, shield: 0, comms: 0 };   // sobrariam 10, mas cabem 6
  jogo.avancar(e, CALMO);
  assert.equal(e.bateria, 6);
  e.alocacao = { o2: 4, food: 4, shield: 4, comms: 2 };   // usa 14: bateria zera
  jogo.avancar(e, CALMO);
  assert.equal(e.bateria, 0);
});

test("cada ponto no rádio envia 1 de ciência", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();
  e.alocacao = { o2: 2, food: 2, shield: 2, comms: 4 };
  jogo.avancar(e, CALMO);
  assert.equal(e.ciencia, 4);
  e.alocacao = { o2: 2, food: 2, shield: 0, comms: 4 };   // bateria vazia: só 8 de energia agora
  jogo.avancar(e, CALMO);
  assert.equal(e.ciencia, 8);
});

test("previsão bate com o resultado quando não há evento escondido", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();
  const prev = jogo.previsao(e);
  jogo.avancar(e, CALMO);
  assert.equal(e.o2, prev.o2);
  assert.equal(e.comida, prev.comida);
  assert.equal(e.rad, prev.rad);
});

test("radiação da viagem usa ~1,8 mSv/dia e o escudo reduz", () => {
  const { jogo } = carregar();
  const semEscudo = jogo.criarJogo();
  semEscudo.alocacao = { o2: 2, food: 2, shield: 0, comms: 0 };
  jogo.avancar(semEscudo, CALMO);
  assert.equal(semEscudo.rad, 54);   // 30 dias × 1,8

  const comEscudo = jogo.criarJogo();
  comEscudo.alocacao = { o2: 2, food: 2, shield: 4, comms: 0 };
  jogo.avancar(comEscudo, CALMO);
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
  surpresa.alocacao = { o2: 4, food: 2, shield: 2, comms: 0 };
  jogo.avancar(surpresa, fixo(0.1));
  assert.equal(surpresa.evento.visivel, false);
  // A previsão não conta a tempestade escondida, o resultado conta
  const prev = jogo.previsao(surpresa);
  jogo.avancar(surpresa, CALMO);
  assert.ok(surpresa.rad > prev.rad);
  assert.ok(surpresa.diario.some((x) => x.chave === "log_solar_surpresa"));
});

test("sem dados da NASA não inventa tempestade solar", () => {
  const { jogo } = carregar(null);
  const e = jogo.criarJogo();
  jogo.avancar(e, fixo(0.1));
  assert.equal(e.evento, null);
});

test("tempestade de poeira: painéis dão 4 e os pontos cabem na energia", () => {
  const { jogo } = carregar();
  const f = jogo.criarJogo();
  for (let i = 0; i < 6; i++) jogo.avancar(f, CALMO);   // viagem inteira
  assert.equal(f.fase, "base");
  jogo.avancar(f, fixo(0.3));             // entre 0.2 (solar) e 0.45 (poeira)
  assert.equal(f.evento.tipo, "poeira");
  assert.equal(jogo.energiaSolar(f), 4);
  assert.ok(jogo.energiaLivre(f) >= 0, "pontos cabem na energia menor");
});

test("missão completa: 6 turnos de viagem + 10 sóis, depois debriefing", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();
  let turnos = 0;
  while (e.fase !== "fim" && turnos < 50) {
    e.alocacao = { o2: 3, food: 3, shield: 1, comms: 3 };
    jogo.avancar(e, CALMO);
    turnos++;
  }
  assert.equal(turnos, 16);
  assert.equal(e.fim.tipo, "completa");
  const r = jogo.avaliar(e);
  assert.equal(r.dias, 180);
  assert.equal(r.sois, 10);
  assert.equal(r.resultado, "cumprida", "48 de ciência passa da meta de 30");
  assert.ok(r.certo.length > 0 && r.dica.length > 0);
});

test("sobreviver sem bater a meta de ciência = 'sobreviveram'", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();
  while (e.fase !== "fim") {
    e.alocacao = { o2: 3, food: 3, shield: 2, comms: 0 };
    jogo.avancar(e, CALMO);
  }
  assert.equal(jogo.avaliar(e).resultado, "sobreviveram");
});

test("se o ar acaba, a missão termina mais cedo sem castigo", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();
  let turnos = 0;
  while (e.fase !== "fim" && turnos < 20) {
    e.alocacao = { o2: 0, food: 4, shield: 4, comms: 0 };
    jogo.avancar(e, CALMO);
    turnos++;
  }
  assert.equal(e.fim.tipo, "cedo");
  assert.equal(e.fim.motivo, "o2");
  const r = jogo.avaliar(e);
  assert.equal(r.resultado, "cedo");
  assert.ok(r.dica.some((d) => d.chave === "fim_dica_o2"));
});

test("carta de decisão: precisa escolher, e a escolha muda energia e previsão", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();
  for (let i = 0; i < 6; i++) jogo.avancar(e, CALMO);
  jogo.avancar(e, fixo(0.3));             // tempestade de poeira na base
  assert.equal(e.evento.tipo, "poeira");
  assert.equal(jogo.precisaEscolher(e), true);
  const base = jogo.energiaDisponivel(e);

  const antes = jogo.previsao(e).o2;
  assert.equal(jogo.escolher(e, "limpar_paineis"), true);
  assert.equal(jogo.precisaEscolher(e), false);
  assert.equal(jogo.energiaDisponivel(e), base + 3, "limpar os painéis devolve energia");
  assert.equal(jogo.previsao(e).o2, antes - 8, "mas o traje gasta ar");

  assert.equal(jogo.escolher(e, "opcao_que_nao_existe"), false);
  assert.equal(jogo.escolher(e, "esperar_base"), true, "pode trocar antes de avançar");
  assert.equal(jogo.energiaDisponivel(e), base);
});

test("abrigo corta a dose da tempestade solar avisada", () => {
  const { jogo } = carregar();
  const dose = (escolha) => {
    const e = jogo.criarJogo();
    jogo.avancar(e, fixo(0.1));           // tempestade X avisada (rádio 2)
    e.alocacao = { o2: 3, food: 3, shield: 0, comms: 2 };
    jogo.escolher(e, escolha);
    const r0 = e.rad;
    jogo.avancar(e, CALMO);
    return e.rad - r0;
  };
  assert.ok(dose("abrigo") < dose("continuar"));
});

test("carta sem resposta fica com a última opção ao avançar", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo();
  jogo.avancar(e, fixo(0.1));
  assert.equal(jogo.precisaEscolher(e), true);
  jogo.avancar(e, CALMO);
  assert.equal(e.historico.at(-1).evento.escolha, "continuar");
  assert.ok(e.diario.some((x) => x.chave === "log_escolha"));
});

// ---------- Minigames: o desempenho (0 a 1) escala o efeito da opção ativa ----------

test("minigame: cada carta tem uma opção ativa (com minigame) e uma passiva (sem)", () => {
  const { eventos } = carregar();
  for (const tipo of Object.keys(eventos.OPCOES)) {
    const [ativa, passiva] = eventos.OPCOES[tipo];
    assert.ok(eventos.minigameDe(tipo, ativa.id), `${tipo}: a primeira opção tem minigame`);
    assert.equal(eventos.minigameDe(tipo, passiva.id), null, `${tipo}: a última opção é segura`);
    assert.ok(eventos.faixaDe(tipo, ativa.id));
    assert.equal(eventos.faixaDe(tipo, passiva.id), null);
  }
});

test("minigame: sem nota (ou pulando) o efeito é o do balanceamento original", () => {
  const { eventos } = carregar();
  // JSON.parse(JSON.stringify()) porque os objetos vêm de outro "realm" (vm) e o deepEqual estrito estranha o protótipo
  const plano = (o) => JSON.parse(JSON.stringify(o));
  assert.deepEqual(plano(eventos.efeitoDe("poeira", "limpar_paineis")), { o2: -8, energia: 3 });
  assert.deepEqual(plano(eventos.efeitoDe("solar", "abrigo")), { tempestade: 0.3, comida: -4 });
  assert.deepEqual(plano(eventos.efeitoDe("filtro", "consertar_filtro")), { o2: 0, energia: -2 });
  assert.deepEqual(plano(eventos.efeitoDe("praga", "arrancar_plantas")), { comida: -6 });
  assert.deepEqual(plano(eventos.efeitoDe("poeira", "esperar_base")), { consumoO2: -8 }, "passiva não muda");
});

test("minigame: nota 0 dá o pior efeito, nota 1 o melhor, e a nota é limitada a 0..1", () => {
  const { eventos } = carregar();
  assert.equal(eventos.efeitoDe("poeira", "limpar_paineis", 0).energia, 1);
  assert.equal(eventos.efeitoDe("poeira", "limpar_paineis", 1).energia, 4);
  assert.equal(eventos.efeitoDe("poeira", "limpar_paineis", 7).energia, 4, "acima de 1 vira 1");
  assert.equal(eventos.efeitoDe("poeira", "limpar_paineis", -3).energia, 1, "abaixo de 0 vira 0");
  assert.equal(eventos.efeitoDe("poeira", "limpar_paineis", NaN).energia, 3, "lixo vira o padrão");
  assert.equal(eventos.efeitoDe("solar", "abrigo", 1).tempestade, 0.1);
  assert.equal(eventos.efeitoDe("solar", "abrigo", 0).tempestade, 0.5);
  assert.equal(eventos.efeitoDe("filtro", "consertar_filtro", 1).o2, 4);
  assert.equal(eventos.efeitoDe("praga", "arrancar_plantas", 0).comida, -10);
});

test("minigame: nota melhor nunca dá efeito pior (monotônico)", () => {
  const { eventos } = carregar();
  for (const tipo of Object.keys(eventos.OPCOES)) {
    const ativa = eventos.OPCOES[tipo][0];
    let anterior = eventos.efeitoDe(tipo, ativa.id, 0);
    for (let p = 0.1; p <= 1.0001; p += 0.1) {
      const atual = eventos.efeitoDe(tipo, ativa.id, p);
      for (const k of Object.keys(atual)) {
        // tempestade: menor é melhor; os outros: maior é melhor
        if (k === "tempestade") assert.ok(atual[k] <= anterior[k] + 1e-9, `${tipo}.${k} piorou`);
        else assert.ok(atual[k] >= anterior[k], `${tipo}.${k} piorou`);
      }
      anterior = atual;
    }
  }
});

test("minigame: a nota entra na energia, no ar e fica no histórico e no diário", () => {
  const { jogo } = carregar();
  const montar = (nota) => {
    const e = jogo.criarJogo();
    for (let i = 0; i < 6; i++) jogo.avancar(e, CALMO);
    jogo.avancar(e, fixo(0.3));                       // poeira na base
    jogo.escolher(e, "limpar_paineis", nota);
    return e;
  };
  const ruim = montar(0), bom = montar(1);
  assert.equal(jogo.energiaDisponivel(bom) - jogo.energiaDisponivel(ruim), 3, "limpar bem rende +3 de energia");
  assert.equal(bom.evento.desempenho, 1);

  jogo.avancar(bom, CALMO);
  assert.equal(bom.historico.at(-1).evento.desempenho, 1);
  const log = bom.diario.find((x) => x.chave === "log_minigame");
  assert.equal(log.p.pct, 100);

  // trocar para a opção passiva apaga a nota (não herda o bônus)
  const e = montar(1);
  jogo.escolher(e, "esperar_base");
  assert.equal(e.evento.desempenho, null);
  assert.equal(e.diario.some((x) => x.chave === "log_minigame"), false);
});

test("minigame: abrigo bem jogado corta mais radiação que abrigo mal jogado", () => {
  const { jogo } = carregar();
  const dose = (nota) => {
    const e = jogo.criarJogo();
    jogo.avancar(e, fixo(0.1));
    e.alocacao = { o2: 3, food: 3, shield: 0, comms: 2 };
    jogo.escolher(e, "abrigo", nota);
    const r0 = e.rad;
    jogo.avancar(e, CALMO);
    return e.rad - r0;
  };
  assert.ok(dose(1) < dose(0.5));
  assert.ok(dose(0.5) < dose(0));
});

test("minigame: o debriefing elogia quem jogou bem e dá dica a quem foi mal", () => {
  const { jogo } = carregar();
  const jogar = (nota) => {
    const e = jogo.criarJogo();
    jogo.avancar(e, fixo(0.1));                       // tempestade solar avisada
    jogo.escolher(e, "abrigo", nota);
    jogo.avancar(e, CALMO);
    return jogo.avaliar(e);
  };
  assert.ok(jogar(0.9).certo.some((x) => x.chave === "fim_certo_minigame"));
  assert.ok(jogar(0.1).dica.some((x) => x.chave === "fim_dica_minigame"));
  const pulou = jogar(undefined);
  assert.equal(pulou.certo.some((x) => x.chave === "fim_certo_minigame"), false, "pular não conta como jogar");
  assert.equal(pulou.dica.some((x) => x.chave === "fim_dica_minigame"), false);
});
// ---------- Bônus dos personagens ----------
test("bônus do Davi (engenheiro): na poeira os painéis dão 6 (e não 4); fora dela, normal", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo("engenheiro");
  assert.equal(jogo.energiaSolar(e), 8);
  e.evento = { tipo: "poeira", visivel: true };
  assert.equal(jogo.energiaSolar(e), 6);
  const normal = jogo.criarJogo();
  normal.evento = { tipo: "poeira", visivel: true };
  assert.equal(jogo.energiaSolar(normal), 4);
});

test("bônus da Yara (botânica): cada ponto na estufa também dá +1 de ar", () => {
  const { jogo } = carregar();
  const normal = jogo.criarJogo();
  const yara = jogo.criarJogo("botanica");
  // alocação inicial: 2 pontos na estufa
  assert.equal(jogo.previsao(yara).o2 - jogo.previsao(normal).o2, 2);
  assert.equal(jogo.previsao(yara).comida, jogo.previsao(normal).comida);
  assert.equal(jogo.efeitoDosSistemas(yara).o2 - jogo.efeitoDosSistemas(normal).o2, 2);
});

test("bônus da Lia (comandante): rádio com 3+ pontos envia +1 de ciência; com menos, nada extra", () => {
  const { jogo } = carregar();
  const fraco = jogo.criarJogo("comandante");          // começa com 2 no rádio
  jogo.avancar(fraco, CALMO);
  assert.equal(fraco.ciencia, 2);
  const forte = jogo.criarJogo("comandante");
  assert.ok(jogo.ajustar(forte, "comms", 1));           // 3 no rádio
  assert.equal(jogo.efeitoDosSistemas(forte).comms, 4);
  jogo.avancar(forte, CALMO);
  assert.equal(forte.ciencia, 4);
});

test("sem personagem (ou desconhecido): nenhum bônus", () => {
  const { jogo } = carregar();
  const e = jogo.criarJogo("astronauta-misterioso");
  assert.equal(e.especialidade, null);
  assert.ok(jogo.ajustar(e, "comms", 1));
  jogo.avancar(e, CALMO);
  assert.equal(e.ciencia, 3);
});
