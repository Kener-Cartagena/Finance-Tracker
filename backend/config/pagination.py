"""
Global pagination class reused across all apps.
"""

from rest_framework.pagination import PageNumberPagination


class StandardResultsPagination(PageNumberPagination):
    """
    Default pagination: 20 items per page.
    Client can override with ?page_size=N (max 100).
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
