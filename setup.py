"""Setup for long_answer XBlock."""

import os
from setuptools import setup, find_packages

import long_answer_xblock


def package_data(pkg, root_list):
    """Generic function to find package_data for `pkg` under `root`."""
    data = []
    for root in root_list:
        for dirname, _, files in os.walk(os.path.join(pkg, root)):
            for fname in files:
                data.append(os.path.relpath(os.path.join(dirname, fname), pkg))

    return {pkg: data}

setup(
    name='long-answer-xblock',
    version=long_answer_xblock.__version__,
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
            'long_answer_xblock = long_answer_xblock.long_answer:LongAnswerXBlock',
        ]
    },
    package_data=package_data("long_answer_xblock", ["static", "templates"]),
)
