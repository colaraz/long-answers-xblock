"""
Utility functions for the LQ XBlock
"""
import hashlib
import os
import datetime
import time
from functools import partial
import pytz
import six

from django.conf import settings

def utcnow():
    """
    Get current date and time in UTC
    """
    return datetime.datetime.now(tz=pytz.utc)


def is_finalized_submission(submission_data):
    """
    Helper function to determine whether or not a Submission was finalized by the student
    """
    if submission_data and submission_data.get('answer') is not None:
        return submission_data['answer'].get('finalized', True)
    return False
