"""Constants"""

ITEM_TYPE = 'long_answer_xblock'

class ShowAnswer(object):
    """
    Constants for when to show answer
    """
    ALWAYS = "always"
    ANSWERED = "answered"
    ATTEMPTED = "attempted"
    CLOSED = "closed"
    FINISHED = "finished"
    CORRECT_OR_PAST_DUE = "correct_or_past_due"
    PAST_DUE = "past_due"
    NEVER = "never"
