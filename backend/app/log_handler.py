import logging
import re

from app.services.log_store import append_log

_DOC_RE = re.compile(r"\[doc=(\d+)\]")


class DocumentLogHandler(logging.Handler):
    """Routes any log record containing [doc=N] to the in-memory log store."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = self.format(record)
            m = _DOC_RE.search(msg)
            if m:
                append_log(int(m.group(1)), msg)
        except Exception:
            self.handleError(record)


def register_handler() -> None:
    handler = DocumentLogHandler()
    handler.setFormatter(logging.Formatter("%(levelname)s %(name)s — %(message)s"))
    logging.getLogger().addHandler(handler)
