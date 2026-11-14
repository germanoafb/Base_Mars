"""
Baixa erupções solares (solar flares) da API DONKI da NASA e salva um
arquivo JSON limpo em static/data/donki_flares.json para o jogo usar.

Os dados ficam ARQUIVADOS: o jogo lê o JSON, nunca chama a NASA ao vivo.
Assim a chave da API não vai para o navegador e o jogo funciona no GitHub Pages.

Como rodar (na pasta do projeto):
    python3 scripts_backend/fetch_donki.py
    python3 scripts_backend/fetch_donki.py --inicio 2024-05-01 --fim 2024-05-31

A chave vem da variável NASA_API_KEY ou do arquivo .env (nunca do código).
Sem chave, usa DEMO_KEY (funciona, mas com limite baixo de pedidos).

Só usa a biblioteca padrão do Python: não precisa instalar nada.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "static" / "data" / "donki_flares.json"
# Versão para o navegador: um .js que funciona até abrindo o index.html direto (sem servidor)
SAIDA_JS = RAIZ / "static" / "data" / "donki_flares.js"
# Dois endereços para os mesmos dados: primeiro o servidor da DONKI no CCMC
# (ccmc.gsfc.nasa.gov, não precisa de chave); se falhar, o api.nasa.gov (usa a chave).
URL_CCMC = "https://ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR"
URL_API_NASA = "https://api.nasa.gov/DONKI/FLR"

# A DONKI aceita no máximo 60 dias por pedido: períodos maiores viram vários pedidos.
MAX_DIAS_POR_PEDIDO = 60

# Período padrão: o ano de 2024, perto do máximo solar.
# Tem várias erupções fortes (classe X), como as de maio de 2024.
INICIO_PADRAO = "2024-01-01"
FIM_PADRAO = "2024-12-31"


def ler_chave():
    """Pega a NASA_API_KEY do ambiente ou do arquivo .env."""
    chave = os.environ.get("NASA_API_KEY")
    if chave:
        return chave
    arquivo_env = RAIZ / ".env"
    if arquivo_env.exists():
        for linha in arquivo_env.read_text(encoding="utf-8").splitlines():
            linha = linha.strip()
            if linha.startswith("NASA_API_KEY="):
                return linha.split("=", 1)[1].strip().strip('"').strip("'")
    return "DEMO_KEY"


def pedir_json(url):
    """Faz o pedido e devolve o JSON da resposta."""
    pedido = urllib.request.Request(url, headers={"User-Agent": "base-mars-data-script"})
    with urllib.request.urlopen(pedido, timeout=60) as resposta:
        return json.load(resposta)


def pedacos(inicio, fim):
    """Divide o período em pedaços de até MAX_DIAS_POR_PEDIDO dias (contando o primeiro e o último)."""
    atual = inicio
    while atual <= fim:
        ultimo = min(fim, atual + timedelta(days=MAX_DIAS_POR_PEDIDO - 1))
        yield atual, ultimo
        atual = ultimo + timedelta(days=1)


def baixar_pedaco(inicio, fim, chave, enderecos):
    """Baixa um pedaço, tentando cada endereço. Devolve (lista, endereço que funcionou)."""
    datas = {"startDate": inicio.isoformat(), "endDate": fim.isoformat()}
    erros = []
    for base in enderecos:
        parametros = {**datas, "api_key": chave} if base == URL_API_NASA else datas
        try:
            return pedir_json(f"{base}?{urllib.parse.urlencode(parametros)}"), base
        except urllib.error.HTTPError as erro:
            erros.append(f"{base}: erro HTTP {erro.code}")
        except (urllib.error.URLError, TimeoutError) as erro:
            erros.append(f"{base}: sem resposta ({getattr(erro, 'reason', erro)})")
    raise RuntimeError(f"Nenhum endereço da DONKI respondeu para {inicio}..{fim}:\n  " + "\n  ".join(erros))


def baixar_flares(inicio, fim, chave):
    """Baixa o período todo, pedaço por pedaço. Devolve (lista de erupções, endereço usado)."""
    enderecos = [URL_CCMC, URL_API_NASA]
    todos, usado = [], None
    for a, b in pedacos(date.fromisoformat(inicio), date.fromisoformat(fim)):
        print(f"  {a} a {b}...")
        lista, usado = baixar_pedaco(a, b, chave, enderecos)
        # Depois que um endereço funciona, ele vira o primeiro a ser tentado
        enderecos = [usado] + [e for e in enderecos if e != usado]
        todos.extend(lista if isinstance(lista, list) else [])
    # Remove repetidos (por segurança, caso um evento apareça em dois pedaços)
    unicos = {f.get("flrID"): f for f in todos}
    return list(unicos.values()), usado


def nivel_da_classe(classe):
    """Letra da classe da erupção: X (mais forte), M, C, B ou A."""
    return (classe or "?")[0].upper()


def limpar(flare):
    """Fica só com o que o jogo precisa, com nomes em português."""
    classe = flare.get("classType") or ""
    return {
        "id": flare.get("flrID"),
        "inicio": flare.get("beginTime"),
        "pico": flare.get("peakTime"),
        "fim": flare.get("endTime"),
        "classe": classe,
        "nivel": nivel_da_classe(classe),
        "regiaoAtiva": flare.get("activeRegionNum"),
        "link": flare.get("link"),
    }


def salvar_js(dados):
    """Salva só as erupções fortes (M e X), no formato que o jogo usa, como window.DONKI_FLARES."""
    fortes = [
        {"id": e["id"], "pico": e["pico"] or e["inicio"], "classe": e["classe"], "nivel": e["nivel"], "link": e["link"]}
        for e in dados["eventos"]
        if e["nivel"] in ("M", "X")
    ]
    pacote = {
        "fonte": dados["fonte"],
        "sobre": dados["sobre"],
        "baixadoEm": dados["baixadoEm"],
        "periodo": dados["periodo"],
        "eventos": fortes,
    }
    texto = json.dumps(pacote, ensure_ascii=False, separators=(",", ":"))
    SAIDA_JS.write_text(
        "// Gerado por scripts_backend/fetch_donki.py. Não edite à mão.\n"
        f"window.DONKI_FLARES = {texto};\n",
        encoding="utf-8",
    )
    return len(fortes)


def main():
    parser = argparse.ArgumentParser(description="Baixa erupções solares da NASA DONKI.")
    parser.add_argument("--inicio", default=INICIO_PADRAO, help="data inicial AAAA-MM-DD")
    parser.add_argument("--fim", default=FIM_PADRAO, help="data final AAAA-MM-DD")
    args = parser.parse_args()

    # Confere as datas antes de gastar um pedido da API
    for valor in (args.inicio, args.fim):
        try:
            date.fromisoformat(valor)
        except ValueError:
            sys.exit(f"Data inválida: {valor} (use AAAA-MM-DD)")
    if args.inicio > args.fim:
        sys.exit("A data inicial vem depois da final.")

    chave = ler_chave()
    print(f"Baixando erupções de {args.inicio} a {args.fim}...")
    try:
        brutos, endpoint = baixar_flares(args.inicio, args.fim, chave)
    except RuntimeError as erro:
        sys.exit(str(erro))

    if not isinstance(brutos, list):
        sys.exit(f"Resposta inesperada da NASA: {str(brutos)[:200]}")

    eventos = sorted((limpar(f) for f in brutos), key=lambda e: e["inicio"] or "")
    contagem = {}
    for e in eventos:
        contagem[e["nivel"]] = contagem.get(e["nivel"], 0) + 1

    dados = {
        "fonte": "NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information)",
        "endpoint": endpoint,  # sem a chave, de propósito
        "sobre": "Dados arquivados, não ao vivo. Baixados uma vez por scripts_backend/fetch_donki.py.",
        "baixadoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "periodo": {"inicio": args.inicio, "fim": args.fim},
        "total": len(eventos),
        "porNivel": dict(sorted(contagem.items())),
        "eventos": eventos,
    }

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Pronto! {len(eventos)} erupções salvas em {SAIDA.relative_to(RAIZ)} {dados['porNivel']}")
    n = salvar_js(dados)
    print(f"E {n} erupções fortes (M e X) em {SAIDA_JS.relative_to(RAIZ)} para o jogo")


if __name__ == "__main__":
    main()
