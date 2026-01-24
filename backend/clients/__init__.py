"""
Clients module containing external API integrations.
"""
from .jsearch_client import (
    search_jobs,
    get_job_details,
    extract_job_cards_from_response,
    extract_job_card_data
)
from .gemini_client import model
