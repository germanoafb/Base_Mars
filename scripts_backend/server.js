// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  getDonkiSpaceWeather,
  getMarsTerrainPhoto,
  getOsdrScienceFact,
} from "./nasaService.js";
import { criarNovoJogo, processarTurno } from "./gameEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const app = express();
const PORT = process.env.PORT || 5000;

const normalizeAlocacao = (body = {}) => {
  const raw = body.alocacao ?? body.allocation ?? {};
  const fallback = { moxie: 34, brocaGelo: 33, estufaCsa: 33 };
  const normalized = {
    moxie: Number(raw.moxie ?? raw.moxieWatts ?? raw.moxie_watts ?? raw.moxieW ?? fallback.moxie),
    brocaGelo: Number(raw.brocaGelo ?? raw.broca_gelo ?? raw.brocaGeloWatts ?? raw.broca_gelo_watts ?? raw.brocaGeloW ?? fallback.brocaGelo),
    estufaCsa: Number(raw.estufaCsa ?? raw.estufa_csa ?? raw.estufaCsaWatts ?? raw.estufa_csa_watts ?? raw.estufaCsaW ?? fallback.estufaCsa),
  };

  const hasAnyValue = Object.values(raw).some((value) => value !== undefined && value !== null && value !== '');
  return hasAnyValue ? normalized : fallback;
};

const normalizeEscolhaEvento = (body = {}) =>
  body.escolhaEventoId ??
  body.eventChoiceId ??
  body.escolha_evento_id ??
  body.eventoEscolhidoId ??
  null;

app.use(cors());
app.use(express.json());
app.use(express.static(ROOT_DIR));
app.get("/", (req, res) => res.sendFile(path.join(ROOT_DIR, "index.html")));

let estadoAtual = null;

// Inicia a missão consultando NASA DONKI, Mars Rover e OSDR em paralelo
app.post(["/api/iniciar", "/api/start"], async (req, res) => {
  try {
    const [climaSolar, fotoMarte, cienciaOsdr] = await Promise.all([
      getDonkiSpaceWeather(),
      getMarsTerrainPhoto(),
      getOsdrScienceFact(),
    ]);

    estadoAtual = criarNovoJogo(climaSolar, fotoMarte, cienciaOsdr);
    res.json(estadoAtual);
  } catch (err) {
    res.status(500).json({ erro: "Falha ao iniciar missão em Marte." });
  }
});

// Processa um Sol (turno) com a alocação de Watts e a decisão do evento
app.post(["/api/proximo-sol", "/api/proximo-turno", "/api/next-turn"], async (req, res) => {
  if (!estadoAtual) {
    const [climaSolar, fotoMarte, cienciaOsdr] = await Promise.all([
      getDonkiSpaceWeather(),
      getMarsTerrainPhoto(),
      getOsdrScienceFact(),
    ]);
    estadoAtual = criarNovoJogo(climaSolar, fotoMarte, cienciaOsdr);
  }

  const body = req.body || {};
  const alocacao = normalizeAlocacao(body);
  const escolhaEventoId = normalizeEscolhaEvento(body);

  estadoAtual = processarTurno(
    estadoAtual,
    {
      moxie: Number.isFinite(alocacao.moxie) ? alocacao.moxie : 34,
      brocaGelo: Number.isFinite(alocacao.brocaGelo) ? alocacao.brocaGelo : 33,
      estufaCsa: Number.isFinite(alocacao.estufaCsa) ? alocacao.estufaCsa : 33,
    },
    escolhaEventoId
  );
  res.json(estadoAtual);
});

// Endpoint extra para curiosidades científicas da NASA OSDR e CSA
app.get(["/api/ciencia-extra", "/api/science-extra"], async (req, res) => {
  const tema = req.query.tema || req.query.topic || "plant growth microgravity";
  const fatoOsdr = await getOsdrScienceFact(tema);

  res.json({
    osdr: fatoOsdr,
    csaDica:
      "Agência Espacial Canadense (CSA): Cultivar plantas em estufas fechadas no espaço ensina a produzir alimentos no Ártico e em desertos aqui na Terra usando 90% menos água!",
  });
});

app.listen(PORT, () => {
  console.log(`Servidor Operação Ares rodando em http://localhost:${PORT}`);
});