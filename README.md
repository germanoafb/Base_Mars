# Base_Mars — Projeto Ares
Junior Astronaut Mission Trainer: a pixel-art browser game where kids (7–12) fly to Mars and run an outpost, splitting limited power between life support (air and water), food, radiation shielding and the radio to Earth. Built with real NASA data. NASA Space Apps Challenge 2026.

Jogo em pixel art para crianças de 7 a 12 anos, em português e inglês. A Lia anda pela nave e pela base; em cada estação você decide para onde vai a energia. Nenhuma escolha é de graça.

## Como se joga
- **Viagem** (180 dias, 6 turnos) e depois **10 sóis** na base em Marte.
- Os painéis dão **8 de energia** por turno (4 na tempestade de poeira). O que sobra vai para a **bateria** (até 6).
- Divida a energia entre **ar e água**, **estufa**, **escudo** e **rádio**. Cada ponto no rádio envia 1 ponto de **ciência** (meta: 30) e, com 2 ou mais, a Terra avisa das tempestades solares.
- Eventos chegam como **cartas de decisão** com duas opções, e as duas custam algo.
- Fim sem castigo: debriefing com o que deu certo e o que melhorar, de 1 a 3 estrelas.
- **Nome e certificado:** o jogador digita o nome antes de lançar a nave. Quem chega ao fim da missão (2 ou 3 estrelas) ganha um certificado em PNG com o nome, o logo do jogo e o logo da NASA (arquivo em `static/assets/nasa-logo.png`).

Os números ficam em `CONFIG`, no começo de `static/js/game/outpost.js`.

## Dados reais da NASA (arquivados, não ao vivo)
- Radiação: detector RAD do Curiosity (~1,8 mSv/dia na viagem, ~0,64 mSv/sol em Marte).
- Tempestades solares: 1.036 erupções fortes (classes M e X) de 2024 do arquivo NASA DONKI.
- Reciclagem de 98% da água na Estação Espacial (NASA, 2023).

## Estrutura do projeto

O jogo é **HTML + CSS + JavaScript** puro, hospedado no **GitHub Pages** (sem servidor, sem build).
Python é usado só para preparar os dados da NASA.

```
Base_Mars/
├── index.html                ← página do jogo + ícones em pixel art
├── static/
│   ├── styles/style.css      ← visual pixel art
│   ├── js/
│   │   ├── i18n.js           ← todos os textos em PT e EN
│   │   ├── mapa.js           ← mapa em pixel art (canvas): a Lia anda até as estações
│   │   ├── main.js           ← TELA: telas, botões, cartas, tripulação
│   │   ├── certificado.js    ← desenha o certificado (canvas) e baixa o PNG
│   │   └── game/             ← REGRAS do jogo (JS puro, sem mexer na tela)
│   │       ├── outpost.js    ← estado da missão, bateria, ciência e cada turno
│   │       ├── events.js     ← eventos e cartas de decisão
│   │       └── nasa-data.js  ← lê as erupções reais da NASA
│   └── data/
│       ├── donki_flares.json ← erupções de 2024 (NASA DONKI)
│       └── donki_flares.js   ← mesmas erupções, no formato que o navegador lê
├── scripts_backend/
│   └── fetch_donki.py        ← Python: baixa as erupções da NASA → static/data/
└── tests/                    ← testes das regras (node --test tests/)
```

**Regra de ouro:** regra do jogo fica em `static/js/game/`; `main.js` e `mapa.js` só cuidam da tela; Python só mexe nos dados.

### Rodar localmente
Basta abrir o `index.html` no navegador (os scripts são comuns, funcionam sem servidor).
Se preferir um servidor (não precisa de `npm install`):

```
npm start
```

e abra http://localhost:8000. (`python3 -m http.server 8000` também funciona.)

### Testes
```
node --test tests/
```

### Atualizar os dados da NASA
```
python3 scripts_backend/fetch_donki.py
```

## Créditos
Design em pixel art e mapa com estações: ideia original de um membro da equipe.
