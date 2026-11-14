# Base_Mars
Junior Astronaut Mission Trainer: a browser game where kids (7–12) run a Mars outpost, splitting limited power between oxygen, food, radiation shielding and communication with Earth. Built with real NASA data. NASA Space Apps Challenge 2026.

## Estrutura do projeto

O jogo é **HTML + CSS + JavaScript** puro, hospedado no **GitHub Pages** (sem servidor, sem build).
Python é usado só para preparar os dados da NASA.

```
Base_Mars/
├── index.html              ← página do jogo (o GitHub Pages abre esta)
├── static/
│   ├── styles/style.css    ← visual
│   ├── js/
│   │   ├── main.js         ← TELA: barras, sliders, botões
│   │   └── game/           ← REGRAS do jogo (JS puro, sem mexer na tela)
│   │       ├── outpost.js  ← estado da base e cálculo de cada sol
│   │       ├── events.js   ← eventos (tempestades solares reais)
│   │       └── nasa-data.js← carrega os JSONs de static/data/
│   ├── data/               ← dados da NASA já processados (JSON)
│   └── assets/             ← imagens, sons, fontes
├── scripts/                ← Python: baixa/processa dados da NASA → static/data/
└── tests/                  ← testes das regras (node --test tests/)
```

**Regra de ouro:** regra do jogo fica em `static/js/game/`; o `main.js` só cuida da tela; Python só mexe nos dados.

### Rodar localmente
Os módulos JS não funcionam abrindo o arquivo direto (`file://`). Suba um servidor simples na pasta do projeto:

```
python3 -m http.server 8000
```

e abra http://localhost:8000.
