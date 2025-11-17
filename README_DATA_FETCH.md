# USA Research Data System (1975-2025)

## Overview
This system fetches and displays USA research publication data from OpenAlex API for 10 specific fields, filtered by publications with funders from 1975-2025.

## Target Fields
1. Chemical Engineering
2. Chemistry
3. Computer Science
4. Earth and Planetary Sciences
5. Energy
6. Engineering
7. Environmental Science
8. Materials Science
9. Mathematics
10. Physics and Astronomy

## Data Structure
The system uses cascading filters:
- **Field** → **Subfield** → **Funder** → **Topic**

### Data Flow:
1. **Field**: Choose from 10 target fields
2. **Subfield**: Shows top 20 subfields by funder count for selected field
3. **Funder**: Shows top 20 funders by publication count for selected subfield
4. **Topic**: Shows 10 most recent topics funded by selected funder

## Setup Instructions

### 1. Fetch Data from OpenAlex

Run the data fetching script (this may take 10-30 minutes due to API rate limits):

```bash
python3 fetch_usa_research_data.py
```

This creates `data/usa_research_data.csv` with all the filtered research data.

### 2. Start the Flask API

Use the new USA-specific API:

```bash
python3 flask_api_usa.py
```

The API will run on `http://localhost:5000`

### 3. Open the Visualization

Open `index.html` in your browser or run:

```bash
python3 -m http.server 8000
```

Then visit: `http://localhost:8000/index.html`

## API Endpoints

### GET /api/health
Check API status and data statistics

### GET /api/fields
Get all 10 target fields

### GET /api/subfields?field_id=<id>
Get top 20 subfields for a field (sorted by funder count)

### GET /api/funders?subfield_id=<id>
Get top 20 funders for a subfield (sorted by publication count)

### GET /api/topics?funder_id=<id>&subfield_id=<id>
Get 10 most recent topics for a funder in a subfield

## UI Interaction

### Research Data Filters Panel

1. **Field Dropdown**
   - Default: "Choose Field"
   - Select one of 10 target fields

2. **Subfield Dropdown**
   - Default: "-none-" (disabled until field is selected)
   - Enabled when field is selected
   - Shows up to 20 subfields with most funders

3. **Funder Dropdown**
   - Default: "Choose Funder" (disabled until subfield is selected)
   - Enabled when subfield is selected (not "-none-")
   - Shows up to 20 funders with most publications

4. **Topic Dropdown**
   - Default: "Choose Topic" (disabled until funder is selected)
   - Enabled when funder is selected
   - Shows 10 most recent topics funded by that funder

5. **Buttons**
   - **Apply Filters**: Log current selections (marker visualization to be added later)
   - **Clear All**: Reset all dropdowns to default state

## Data File Format

The `usa_research_data.csv` file contains:

| Column | Description |
|--------|-------------|
| field_id | OpenAlex field ID |
| field_name | Field name |
| subfield_id | OpenAlex subfield ID |
| subfield_name | Subfield name |
| subfield_works_count | Number of publications in subfield |
| funder_id | OpenAlex funder ID |
| funder_name | Funder name |
| funder_works_count | Number of publications funded |
| topics | JSON string of topic list (id, name, works_count) |
| fetch_date | When data was fetched |
| country_code | US |
| year_range | 1975-2025 |

## Notes

- Data is cached in memory by the Flask API
- Use `/api/reload` endpoint (POST) to refresh data without restarting
- Marker visualization will be implemented in the next phase
- The cascading filters ensure logical data selection flow
