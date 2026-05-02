from types import SimpleNamespace

from api import routes
from api.models import Session, new_session


def test_new_session_accepts_explicit_profile(tmp_path, monkeypatch):
    monkeypatch.setattr('api.models.get_last_workspace', lambda: str(tmp_path))

    session = new_session(workspace=str(tmp_path), model='gpt-5.4', profile='paperclip-dev')

    assert session.profile == 'paperclip-dev'
    assert session.compact()['profile'] == 'paperclip-dev'


def test_handle_chat_start_profile_override_persists_to_session(tmp_path, monkeypatch):
    session = Session(session_id='sid123', workspace=str(tmp_path), model='gpt-5.4', profile='default')
    saved = {'called': False}

    def fake_save():
        saved['called'] = True

    session.save = fake_save

    monkeypatch.setattr(routes, 'get_session', lambda sid: session)
    monkeypatch.setattr(routes, 'set_last_workspace', lambda ws: None)
    monkeypatch.setattr(routes, 'j', lambda handler, payload, status=200: (payload, status))
    monkeypatch.setattr(routes, 'bad', lambda handler, msg, status=400: ({'error': msg}, status))
    monkeypatch.setattr(routes, '_run_agent_streaming', lambda *args, **kwargs: None)

    class DummyThread:
        def __init__(self, target=None, args=None, daemon=None):
            self.target = target
            self.args = args or ()
            self.daemon = daemon

        def start(self):
            return None

    monkeypatch.setattr(routes.threading, 'Thread', DummyThread)

    payload, status = routes._handle_chat_start(
        SimpleNamespace(),
        {
            'session_id': 'sid123',
            'message': 'ping',
            'model': 'openai/gpt-5.4-mini',
            'profile': 'paperclip-plan',
            'workspace': str(tmp_path),
        },
    )

    assert status == 200
    assert saved['called'] is True
    assert session.profile == 'paperclip-plan'
    assert payload['session_id'] == 'sid123'
