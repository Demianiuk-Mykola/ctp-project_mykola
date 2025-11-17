"""
Fetch USA research data from OpenAlex API (1975-2025, publications with funders)
For 10 specific fields: Chemical Engineering, Chemistry, Computer Science,
Earth and Planetary Sciences, Energy, Engineering, Environmental sciences,
Materials Science, Mathematics, Physics and Astronomy
"""

import sys
import io

# Set UTF-8 encoding for Windows console compatibility
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from pyalex import Works, config
import pandas as pd
from datetime import datetime
from collections import defaultdict
import time
import os

config.email = "arunsisarrancs@gmail.com"

DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)

# Target fields with their OpenAlex IDs
TARGET_FIELDS = {
    'Chemical Engineering': '15',
    'Chemistry': '16',
    'Computer Science': '17',
    'Earth and Planetary Sciences': '19',
    'Energy': '21',
    'Engineering': '22',
    'Environmental Science': '23',
    'Materials Science': '25',
    'Mathematics': '26',
    'Physics and Astronomy': '31'
}


def fetch_field_subfield_funder_data():
    """
    Fetch publications from USA (1975-2025) that have funders,
    grouped by field, subfield, and funder
    """
    print("=" * 80)
    print("FETCHING USA RESEARCH DATA FROM OPENALEX (1975-2025)")
    print("=" * 80)
    print()

    all_data = []

    for field_name, field_id in TARGET_FIELDS.items():
        print(f"\nProcessing Field: {field_name} (ID: {field_id})")
        print("-" * 80)

        try:
            # Query works for this field (simplified - we'll filter by grants at funder level)
            works_query = Works().filter(**{
                'topics.field.id': field_id,
                'authorships.institutions.country_code': 'US',
                'from_publication_date': '1975-01-01',
                'to_publication_date': '2025-12-31'
            })

            # Group by subfield to get subfield counts
            print(f"  Fetching subfields for {field_name}...")
            subfield_groups = works_query.group_by('topics.subfield.id').get()

            if not subfield_groups:
                print(f"  No data found for {field_name}")
                continue

            # Process each subfield
            for subfield_group in subfield_groups[:20]:  # Top 20 subfields
                subfield_id = subfield_group['key'].split('/')[-1]
                subfield_name = subfield_group['key_display_name']
                subfield_works_count = subfield_group['count']

                print(f"    Subfield: {subfield_name} ({subfield_works_count} works)")

                # Now get funders for this subfield (grouping by grants.funder automatically filters to works with grants)
                funder_query = Works().filter(**{
                    'topics.subfield.id': subfield_id,
                    'authorships.institutions.country_code': 'US',
                    'from_publication_date': '1975-01-01',
                    'to_publication_date': '2025-12-31'
                })

                funder_groups = funder_query.group_by('grants.funder').get()

                if not funder_groups:
                    continue

                # Process each funder
                for funder_group in funder_groups[:20]:  # Top 20 funders per subfield
                    funder_id = funder_group['key'].split('/')[-1]
                    funder_name = funder_group['key_display_name']
                    funder_works_count = funder_group['count']

                    # Get topics for this funder-subfield combination
                    topic_query = Works().filter(**{
                        'topics.subfield.id': subfield_id,
                        'grants.funder': funder_group['key'],
                        'authorships.institutions.country_code': 'US',
                        'from_publication_date': '1975-01-01',
                        'to_publication_date': '2025-12-31'
                    })

                    topic_groups = topic_query.group_by('topics.id').get()

                    # Get up to 10 topics
                    topics_list = []
                    for topic_group in topic_groups[:10]:
                        topic_id = topic_group['key'].split('/')[-1]
                        topic_name = topic_group['key_display_name']
                        topic_works_count = topic_group['count']
                        topics_list.append({
                            'topic_id': topic_id,
                            'topic_name': topic_name,
                            'topic_works_count': topic_works_count
                        })

                    # Store the complete record
                    all_data.append({
                        'field_id': field_id,
                        'field_name': field_name,
                        'subfield_id': subfield_id,
                        'subfield_name': subfield_name,
                        'subfield_works_count': subfield_works_count,
                        'funder_id': funder_id,
                        'funder_name': funder_name,
                        'funder_works_count': funder_works_count,
                        'topics': str(topics_list)  # Store as string for CSV
                    })

                    print(f"      Funder: {funder_name} ({funder_works_count} works, {len(topics_list)} topics)")

                # Rate limiting
                time.sleep(0.5)

        except Exception as e:
            print(f"  Error processing {field_name}: {e}")
            continue

    return all_data


def save_data_to_csv(data):
    """Save the collected data to CSV file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    df = pd.DataFrame(data)
    df['fetch_date'] = timestamp
    df['country_code'] = 'US'
    df['year_range'] = '1975-2025'

    csv_path = os.path.join(DATA_DIR, 'usa_research_data.csv')
    df.to_csv(csv_path, index=False)

    print()
    print("=" * 80)
    print(f"[SUCCESS] Saved {len(data)} records to {csv_path}")
    print(f"  Fields: {df['field_name'].nunique()}")
    print(f"  Subfields: {df['subfield_name'].nunique()}")
    print(f"  Funders: {df['funder_name'].nunique()}")
    print(f"  Last updated: {timestamp}")
    print("=" * 80)


def main():
    print("\nStarting data fetch from OpenAlex API...")
    print("This may take several minutes due to API rate limits.\n")

    data = fetch_field_subfield_funder_data()

    if data:
        save_data_to_csv(data)
        print("\n[SUCCESS] Data fetch complete!")
    else:
        print("\n[ERROR] No data was fetched. Please check the API connection.")


if __name__ == "__main__":
    main()
