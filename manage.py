#!/usr/bin/env python
"""
Standard manage.py command from django startproject
"""
import os
import sys

if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "long_question_xblock.test_settings")

    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)
