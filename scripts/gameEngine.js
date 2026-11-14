// gameEngine.js
export const MARS_SITE_DATA = {
  local: "Cratera Jezero, Marte (18.38° N, 77.58° E)",
  fonteTerreno: "NASA Mars Trek (MOLA / HiRISE)",
  atmosfera: "95.3% CO2 (Dióxido de Carbono)",
  temperaturaMedia: "-60°C",
  radiacaoBasalMsvDia: 0.64,
};

export const EVENTOS_OREGON_TRAIL = [
  {
    id: "dust_storm",
    titulo: "Tempestade de Poeira Marciana!",
    descricao:
      "Uma nuvem de poeira fina cobriu os painéis solares! A geração de energia caiu neste Sol.",
    licaoReal:
      "Em 2018, uma tempestade global encerrou a missão do rover Opportunity por falta de luz solar.",
    opcoes: [
      {
        id: "limpar_paineis",
        texto: "Enviar astronauta para limpar painéis (-15% O2 do traje, +20 W Energia)",
        efeito: { oxigenio: -15, energiaBonus: 20, saude: -5 },
      },
      {
        id: "economizar_estufa",
        texto: "Desligar luzes da estufa por 1 Sol (+15 W Energia, -15% Comida)",
        efeito: { comida: -15, energiaBonus: 15, saude: 0 },
      },
    ],
  },
  {
    id: "solar_flare_radlab",
    titulo: "Alerta de Radiação Solar (Dados NASA DONKI / RadLab)!",
    descricao:
      "Partículas solares estão atingindo Marte! Sem campo magnético como a Terra, a tripulação precisa de escudo.",
    licaoReal:
      "A água é rica em hidrogênio e é um dos melhores escudos reais contra radiação cósmica!",
    opcoes: [
      {
        id: "escudo_agua",
        texto: "Bombear água para os tanques do teto (+10% Saúde, -18% Água)",
        efeito: { agua: -18, saude: 10 },
      },
      {
        id: "manter_irrigacao",
        texto: "Manter água na estufa hidropônica CSA (+10% Comida, -20% Saúde)",
        efeito: { comida: 10, saude: -20 },
      },
    ],
  },
  {
    id: "comms_delay",
    titulo: "Falha no Filtro de CO2 + Atraso de 20 Minutos!",
    descricao:
      "O sinal de rádio para a Terra demora 20 minutos para chegar! Você não pode esperar a NASA responder.",
    licaoReal:
      "A distância entre Terra e Marte cria um atraso de comunicação de 4 a 24 minutos em cada sentido.",
    opcoes: [
      {
        id: "forcar_moxie",
        texto: "Aumentar potência do MOXIE para converter CO2 em O2 extra (+18% O2, -20 W Energia)",
        efeito: { oxigenio: 18, energiaBonus: -20 },
      },
      {
        id: "modo_repouso",
        texto: "Colocar tripulação em repouso para gastar menos ar (+8% O2, -10% Comida)",
        efeito: { oxigenio: 8, comida: -10 },
      },
    ],
  },
];

const clamp = (valor, min, max) => Math.min(max, Math.max(min, Math.round(valor)));

export function criarNovoJogo(spaceWeather, fotoMarte, cienciaOsdr) {
  return {
    solAtual: 1,
    solObjetivo: 7,
    status: "EM_ANDAMENTO",
    motivoFim: "",
    siteInfo: MARS_SITE_DATA,
    climaEspacial: spaceWeather,
    fotoMarte,
    cienciaOsdr,
    recursos: {
      oxigenio: 75,
      agua: 75,
      comida: 75,
      saude: 90,
      energiaTotal: 100,
    },
    historicoIsru: {
      o2ProduzidoKg: 0,
      aguaMineradaL: 0,
      comidaColhidaKg: 0,
    },
    eventoPendente: null,
  };
}

export function processarTurno(estado, alocacao, escolhaEventoId = null) {
  if (estado.status !== "EM_ANDAMENTO") return estado;

  const rec = estado.recursos;
  const energiaDisp = rec.energiaTotal;

  let wMoxie = Math.max(0, Number(alocacao.moxie || 0));
  let wBroca = Math.max(0, Number(alocacao.brocaGelo || alocacao.broca_gelo || 0));
  let wEstufa = Math.max(0, Number(alocacao.estufaCsa || alocacao.estufa_csa || 0));

  const soma = wMoxie + wBroca + wEstufa;
  if (soma > energiaDisp && soma > 0) {
    const fator = energiaDisp / soma;
    wMoxie = Math.floor(wMoxie * fator);
    wBroca = Math.floor(wBroca * fator);
    wEstufa = Math.floor(wEstufa * fator);
  }

  if (estado.eventoPendente && escolhaEventoId) {
    const opcao = estado.eventoPendente.opcoes.find((o) => o.id === escolhaEventoId);
    if (opcao) {
      const ef = opcao.efeito;
      rec.oxigenio += ef.oxigenio || 0;
      rec.agua += ef.agua || 0;
      rec.comida += ef.comida || 0;
      rec.saude += ef.saude || 0;
      rec.energiaTotal = clamp(rec.energiaTotal + (ef.energiaBonus || 0), 40, 120);
    }
    estado.eventoPendente = null;
  }

  const prodO2 = wMoxie * 0.45;
  const prodAgua = wBroca * 0.45;
  const fatorAgua = rec.agua >= 20 ? 1.0 : 0.4;
  const prodComida = wEstufa * 0.45 * fatorAgua;

  const multRad = estado.climaEspacial?.multiplicadorRadiacao || 1.0;
  const danoRadiacao = rec.agua < 40 ? 4 * multRad : 1.5 * multRad;

  rec.oxigenio = clamp(rec.oxigenio + prodO2 - 14, 0, 100);
  rec.agua = clamp(rec.agua + prodAgua - 14, 0, 100);
  rec.comida = clamp(rec.comida + prodComida - 13, 0, 100);
  rec.saude = clamp(
    rec.saude - danoRadiacao + (rec.comida > 60 ? 2 : 0),
    0,
    100
  );

  estado.historicoIsru.o2ProduzidoKg = Number(
    (estado.historicoIsru.o2ProduzidoKg + wMoxie * 0.12).toFixed(1)
  );
  estado.historicoIsru.aguaMineradaL = Number(
    (estado.historicoIsru.aguaMineradaL + wBroca * 0.25).toFixed(1)
  );
  estado.historicoIsru.comidaColhidaKg = Number(
    (estado.historicoIsru.comidaColhidaKg + wEstufa * 0.08).toFixed(1)
  );

  if (rec.oxigenio <= 0 || rec.agua <= 0 || rec.comida <= 0 || rec.saude <= 0) {
    estado.status = "DERROTA";
    estado.motivoFim =
      "Um recurso vital chegou a zero! Em Marte, sem reabastecimento da Terra, cada watt de energia precisa equilibrar ar, água e comida.";
    return estado;
  }

  if (estado.solAtual >= estado.solObjetivo) {
    estado.status = "VITORIA";
    estado.motivoFim = `Missão Cumprida! Você sobreviveu ${estado.solObjetivo} Sols em Marte produzindo ${estado.historicoIsru.o2ProduzidoKg} kg de Oxigênio com o MOXIE!`;
    return estado;
  }

  estado.solAtual += 1;
  const idx = Math.floor(Math.random() * EVENTOS_OREGON_TRAIL.length);
  estado.eventoPendente = EVENTOS_OREGON_TRAIL[idx];

  return estado;
}