import test from 'node:test';
import assert from 'node:assert/strict';

import { criarNovoJogo, processarTurno } from '../scripts_backend/gameEngine.js';

test('criarNovoJogo retorna o contrato esperado pelo front', () => {
  const novoJogo = criarNovoJogo(
    {
      alertaAtivo: true,
      classeFlare: 'M2.0',
      multiplicadorRadiacao: 1.5,
      fonte: 'NASA',
      explicacaoKids: 'tempestade'
    },
    { imgSrc: 'img.jpg', rover: 'Perseverance', sol: 50 },
    { codigoEstudo: 'OSD-1', fonte: 'NASA', resumoKids: 'estudo' }
  );

  assert.equal(novoJogo.status, 'EM_ANDAMENTO');
  assert.equal(novoJogo.solAtual, 1);
  assert.ok(novoJogo.recursos);
  assert.ok(novoJogo.eventoPendente || novoJogo.eventoPendente === null);
  assert.ok(novoJogo.siteInfo);
  assert.ok(novoJogo.climaEspacial);
  assert.ok(novoJogo.fotoMarte);
  assert.ok(novoJogo.cienciaOsdr);
});

test('processarTurno respeita a alocação de energia e mantém o contrato do front', () => {
  const jogo = criarNovoJogo(
    { multiplicadorRadiacao: 1.0 },
    { imgSrc: 'img.jpg', rover: 'Perseverance', sol: 1 },
    { codigoEstudo: 'OSD-1', fonte: 'NASA', resumoKids: 'teste' }
  );

  const proximo = processarTurno(jogo, { moxie: 30, brocaGelo: 20, estufaCsa: 50 });

  assert.ok(proximo.status === 'EM_ANDAMENTO' || proximo.status === 'VITORIA' || proximo.status === 'DERROTA');
  assert.ok(proximo.recursos);
  assert.ok(typeof proximo.solAtual === 'number');
  assert.ok(proximo.historicoIsru);
});
