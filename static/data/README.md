# static/data
Dados da NASA **já processados** (JSON) que o jogo lê.
São gerados pelos scripts em `scripts/`. Anote aqui a fonte de cada arquivo.

## Arquivos

| Arquivo | Fonte | Gerado por |
| --- | --- | --- |
| `donki_flares.json` | NASA DONKI, erupções solares (FLR). Por padrão, o ano de 2024. | `python3 scripts_backend/fetch_donki.py` |
