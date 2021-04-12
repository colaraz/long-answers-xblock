"""
WSGI config for long_question_xblock project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/1.8/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application  # pylint: disable=import-error

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "long_question_xblock.test_settings")

application = get_wsgi_application()  # pylint: disable=invalid-name
