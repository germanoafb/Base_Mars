// nasaService.js
import dotenv from "dotenv";
dotenv.config();

const NASA_API_KEY = process.env.NASA_API_KEY || "DEMO_KEY";

const FALLBACK_NASA = {
  spaceWeather: {
    alertaAtivo: true,
    classeFlare: "M2.4",
    multiplicadorRadiacao: 1.5,
    fonte: "NASA DONKI (Cache Real - Cratera Jezero)",
    explicacaoKids:
      "O Sol soltou uma explosão de energia! A radiação em Marte subiu 50% hoje.",
  },
  fotoMarte: {
    imgSrc:
      "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/01000/ids/edr/browse/ncam/NLF_1000_0755726527_451ECM_N0481052NCAM02000_01_195J01_1200.jpg",
    rover: "Perseverance (Cratera Jezero)",
    sol: 1000,
  },
  cienciaOsdr: {
    codigoEstudo: "OSD-101",
    fonte: "NASA OSDR / RadLab",
    resumoKids:
      "Na Estação Espacial e em Marte, tanques de água nas paredes da base bloqueiam partículas solares perigosas!",
  },
};

async function fetchComTimeout(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function getDonkiSpaceWeather() {
  const hoje = new Date();
  const quinzeDiasAtras = new Date();
  quinzeDiasAtras.setDate(hoje.getDate() - 15);

  const endDate = hoje.toISOString().split("T")[0];
  const startDate = quinzeDiasAtras.toISOString().split("T")[0];
  const url = `https://api.nasa.gov/DONKI/FLR?startDate=${startDate}&endDate=${endDate}&api_key=${NASA_API_KEY}`;

  try {
    const flares = await fetchComTimeout(url);
    if (Array.isArray(flares) && flares.length > 0) {
      const ultimoFlare = flares[flares.length - 1];
      const classe = ultimoFlare.classType || "C1.0";

      let mult = 1.1;
      let msg = `Clima espacial calmo (Flare ${classe}). Radiação basal normal de Marte.`;

      if (classe.startsWith("X")) {
        mult = 2.0;
        msg = `ALERTA MÁXIMO! Erupção Solar classe ${classe} detectada pela NASA. Radiação dobrou!`;
      } else if (classe.startsWith("M")) {
        mult = 1.5;
        msg = `Atenção Comandante! Erupção Solar classe ${classe} detectada. Use água como escudo!`;
      }

      return {
        alertaAtivo: classe.startsWith("M") || classe.startsWith("X"),
        classeFlare: classe,
        dataEvento: ultimoFlare.beginTime || startDate,
        multiplicadorRadiacao: mult,
        fonte: "NASA DONKI Live API",
        explicacaoKids: msg,
      };
    }
  } catch (_) {}

  return FALLBACK_NASA.spaceWeather;
}

export async function getOsdrScienceFact(topic = "radiation bone density plant growth") {
  const url = `https://osdr.nasa.gov/osdr/data/search?term=${encodeURIComponent(topic)}&size=3&type=cgene`;

  try {
    const data = await fetchComTimeout(url);
    const hits = data?.hits?.hits || [];
    if (hits.length > 0) {
      const source = hits[0]._source || {};
      const accession = source.Accession || "OSD-101";
      return {
        codigoEstudo: accession,
        tituloOriginal: source["Study Title"] || "Estudo de Biologia Espacial NASA",
        fonte: "NASA OSDR / RadLab",
        resumoKids: `Cientistas da NASA (estudo ${accession}) descobriram que sem gravidade e com radiação, astronautas precisam de comida fresca da estufa e tanques de água ao redor do dormitório!`,
      };
    }
  } catch (_) {}

  return FALLBACK_NASA.cienciaOsdr;
}

export async function getMarsTerrainPhoto() {
  const url = `https://api.nasa.gov/mars-photos/api/v1/rovers/perseverance/latest_photos?api_key=${NASA_API_KEY}`;

  try {
    const data = await fetchComTimeout(url);
    const photos = data?.latest_photos || [];
    if (photos.length > 0) {
      const p = photos[0];
      return {
        imgSrc: p.img_src,
        rover: "Perseverance (Cratera Jezero)",
        sol: p.sol,
        terraDate: p.earth_date,
      };
    }
  } catch (_) {}

  return FALLBACK_NASA.fotoMarte;
}