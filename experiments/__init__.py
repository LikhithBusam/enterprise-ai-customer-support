from pydantic import BaseModel


class BaselineResult(BaseModel):
    ticket_id: str
    resolved: bool
    steps_taken: int
    tool_calls_made: list[dict]
    final_response: str
