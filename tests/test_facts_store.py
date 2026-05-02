import json
from pathlib import Path

import pytest

from api import facts


def test_candidate_approve_reject_and_filters(tmp_path):
    cand = facts.create_candidate(
        'decision', 'project', 'venturepass-ai-patent', 'Use approval-gated Paperclip reflection.',
        source_session_id='sess1', source_message_ids=['m1'], confidence=0.9,
        reason='CEO decision', store_dir=tmp_path,
    )
    assert cand['status'] == 'pending'
    assert cand['safety']['paperclip_write'] is False

    pending = facts.list_candidates(store_dir=tmp_path)
    assert [c['id'] for c in pending] == [cand['id']]
    assert facts.list_candidates(scope='company', store_dir=tmp_path) == []

    result = facts.approve_candidate(cand['id'], edited_statement='Use explicit approval gates before Paperclip reflection.', store_dir=tmp_path)
    assert result['candidate']['status'] == 'approved'
    assert result['fact']['status'] == 'active'
    assert result['fact']['source_candidate_id'] == cand['id']
    assert result['fact']['source_session_id'] == 'sess1'
    assert result['fact']['statement'].startswith('Use explicit approval')

    listed = facts.list_facts(scope='project', scope_ref='venturepass-ai-patent', query='approval', store_dir=tmp_path)
    assert [f['id'] for f in listed] == [result['fact']['id']]


def test_rejection_does_not_create_fact(tmp_path):
    cand = facts.create_candidate('preference', 'global', 'default', 'Keep Korean-first status reports.', store_dir=tmp_path)
    rejected = facts.reject_candidate(cand['id'], reason='too generic', store_dir=tmp_path)
    assert rejected['status'] == 'rejected'
    assert rejected['rejection_reason'] == 'too generic'
    assert facts.list_facts(store_dir=tmp_path) == []


def test_malformed_jsonl_lines_are_skipped(tmp_path):
    path = tmp_path / facts.CANDIDATES_FILE
    path.write_text('{bad json}\n' + json.dumps({'id':'cand_ok','status':'pending','statement':'ok'}) + '\n', encoding='utf-8')
    rows = facts.list_candidates(store_dir=tmp_path)
    assert len(rows) == 1
    assert rows[0]['id'] == 'cand_ok'


def test_approve_unknown_candidate_raises_key_error(tmp_path):
    with pytest.raises(KeyError):
        facts.approve_candidate('cand_missing', store_dir=tmp_path)
