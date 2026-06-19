import collections
from collections import deque
from typing import DefaultDict

_logs: DefaultDict[int, deque] = collections.defaultdict(lambda: deque(maxlen=500))


def append_log(document_id: int, message: str) -> None:
    _logs[document_id].append(message)


def get_logs(document_id: int) -> list[str]:
    return list(_logs[document_id])
