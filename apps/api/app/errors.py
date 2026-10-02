class DomainError(Exception):
    def __init__(self, code: str, status: int = 409, details: dict | None = None):
        self.code, self.status, self.details = code, status, details or {}
        super().__init__(code)


def require(condition, code="INVALID_STATE_TRANSITION", status=409, details=None):
    if not condition:
        raise DomainError(code, status, details)
