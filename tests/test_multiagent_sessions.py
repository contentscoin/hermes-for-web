import json
from pathlib import Path

from api import models
from api.models import Session


def test_session_compact_includes_explicit_profile(tmp_path, monkeypatch):
    monkeypatch.setattr(models, 'SESSION_DIR', tmp_path)
    session = Session(workspace=str(tmp_path), model='gpt-5.4', profile='paperclip-dev')

    data = session.compact()

    assert data['profile'] == 'paperclip-dev'


def test_session_load_defaults_missing_profile_to_default(tmp_path, monkeypatch):
    monkeypatch.setattr(models, 'SESSION_DIR', tmp_path)
    session_path = tmp_path / 'legacy123.json'
    session_path.write_text(
        json.dumps(
            {
                'session_id': 'legacy123',
                'title': 'Legacy',
                'workspace': str(tmp_path),
                'model': 'gpt-5.4',
                'messages': [],
                'tool_calls': [],
                'created_at': 1,
                'updated_at': 1,
                'pinned': False,
                'archived': False,
                'project_id': None,
                'input_tokens': 0,
                'output_tokens': 0,
                'estimated_cost': None,
            }
        ),
        encoding='utf-8',
    )

    loaded = Session.load('legacy123')

    assert loaded is not None
    assert loaded.profile == 'default'
    assert loaded.compact()['profile'] == 'default'


def test_get_profile_home_resolves_named_profile(tmp_path, monkeypatch):
    import api.profiles as profiles

    monkeypatch.setattr(profiles, '_DEFAULT_HERMES_HOME', tmp_path)
    expected = tmp_path / 'profiles' / 'paperclip-dev'

    assert profiles.get_profile_home('paperclip-dev') == expected


def test_get_profile_home_defaults_to_base_home(tmp_path, monkeypatch):
    import api.profiles as profiles

    monkeypatch.setattr(profiles, '_DEFAULT_HERMES_HOME', tmp_path)

    assert profiles.get_profile_home(None) == tmp_path
