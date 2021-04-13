"""Setup for long_question XBlock."""

import os
from setuptools import setup, find_packages

import long_question_xblock


def package_data(pkg, root_list):
    """Generic function to find package_data for `pkg` under `root`."""
    data = []
    for root in root_list:
        for dirname, _, files in os.walk(os.path.join(pkg, root)):
            for fname in files:
                data.append(os.path.relpath(os.path.join(dirname, fname), pkg))

    return {pkg: data}

setup(
    name='long-question-xblock',
    version=long_question_xblock.__version__,
    description='Long Answer Assignment XBlock',
    author="Edly",
    zip_safe=False,
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        'XBlock',
        'xblock-utils',
    ],
    entry_points={
        'xblock.v1': [
            'long_question_xblock = long_question_xblock.long_question:LongQuestionXBlock',
        ]
    },
    package_data=package_data("long_question_xblock", ["static", "templates"]),
)
