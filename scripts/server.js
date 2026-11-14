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

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let estadoAtual = null;

// Inicia a missão consultando NASA DONKI, Mars Rover e OSDR em paralelo
app.post("/api/iniciar", async (req, res) => {
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
app.post("/api/proximo-sol", async (req, res) => {
  if (!estadoAtual) {
    const [climaSolar, fotoMarte, cienciaOsdr] = await Promise.all([
      getDonkiSpaceWeather(),
      getMarsTerrainPhoto(),
      getOsdrScienceFact(),
    ]);
    estadoAtual = criarNovoJogo(climaSolar, fotoMarte, cienciaOsdr);
  }

  const { alocacao = { moxie: 34, brocaGelo: 33, estufaCsa: 33 }, escolhaEventoId = null } =
    req.body || {};

  estadoAtual = processarTurno(estadoAtual, alocacao, escolhaEventoId);
  res.json(estadoAtual);
});

// Endpoint extra para curiosidades científicas da NASA OSDR e CSA
app.get("/api/ciencia-extra", async (req, res) => {
  const tema = req.query.tema || "plant growth microgravity";
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