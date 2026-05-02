from types import SimpleNamespace
from urllib.parse import urlparse

from api import routes


def test_fact_routes_create_list_approve_reject(tmp_path, monkeypatch):
    monkeypatch.setattr(routes.facts_store, 'FACTS_DIR', tmp_path)
    monkeypatch.setattr(routes, 'j', lambda handler, payload, status=200: (payload, status))
    monkeypatch.setattr(routes, 'bad', lambda handler, msg, status=400: ({'error': msg}, status))

    payload, status = routes._handle_memory_candidate_create(SimpleNamespace(), {
        'category': 'decision',
        'scope': 'company',
        'scope_ref': 'FMG',
        'statement': 'Paperclip writes require explicit approval.',
        'source_session_id': 'sess1',
    })
    assert status == 200
    candidate_id = payload['candidate']['id']
    assert payload['candidate']['status'] == 'pending'

    payload, status = routes._handle_memory_candidates_read(SimpleNamespace(), urlparse('/api/memory-candidates?status=pending'))
    assert status == 200
    assert payload['candidates'][0]['id'] == candidate_id

    payload, status = routes._handle_memory_candidate_approve(SimpleNamespace(), {'candidate_id': candidate_id})
    assert status == 200
    assert payload['fact']['status'] == 'active'

    payload, status = routes._handle_facts_read(SimpleNamespace(), urlparse('/api/facts?scope=company&scope_ref=FMG&q=approval'))
    assert status == 200
    assert payload['facts'][0]['source_candidate_id'] == candidate_id

    payload, status = routes._handle_memory_candidate_create(SimpleNamespace(), {
        'category': 'preference', 'scope': 'global', 'scope_ref': 'default', 'statement': 'Temporary note'
    })
    reject_id = payload['candidate']['id']
    payload, status = routes._handle_memory_candidate_reject(SimpleNamespace(), {'candidate_id': reject_id, 'reason': 'not durable'})
    assert status == 200
    assert payload['candidate']['status'] == 'rejected'


def test_memory_candidate_create_requires_statement(monkeypatch):
    monkeypatch.setattr(routes, 'j', lambda handler, payload, status=200: (payload, status))
    monkeypatch.setattr(routes, 'bad', lambda handler, msg, status=400: ({'error': msg}, status))
    payload, status = routes._handle_memory_candidate_create(SimpleNamespace(), {'scope': 'global'})
    assert status == 400
    assert 'statement' in payload['error']
