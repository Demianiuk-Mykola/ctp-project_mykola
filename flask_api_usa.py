from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import os
import ast

app = Flask(__name__)
CORS(app)

DATA_DIR = "data"
data_cache = None


def load_data():
    global data_cache

    if data_cache is not None:
        return data_cache

    try:
        csv_path = os.path.join(DATA_DIR, 'usa_research_data.csv')
        df = pd.read_csv(csv_path)
        data_cache = df
        print(f"✓ Loaded {len(df)} records from {csv_path}")
        return data_cache
    except Exception as e:
        print(f"Error loading data: {e}")
        return None


def reload_data():
    global data_cache
    data_cache = None
    return load_data()


@app.route('/')
def home():
    return jsonify({
        'name': 'USA Research Data API (1975-2025)',
        'version': '2.0',
        'endpoints': {
            '/api/health': 'Check API health and data status',
            '/api/fields': 'Get all 10 target fields',
            '/api/subfields?field_id=<id>': 'Get top 20 subfields for a field (by funder count)',
            '/api/funders?subfield_id=<id>': 'Get top 20 funders for a subfield',
            '/api/topics?funder_id=<id>&subfield_id=<id>': 'Get 10 most recent topics for funder',
            '/api/reload': 'Reload data from CSV file'
        }
    })


@app.route('/api/health')
def health():
    data = load_data()

    if data is None or data.empty:
        return jsonify({
            'status': 'error',
            'message': 'Data file not found. Run fetch_usa_research_data.py first.'
        }), 500

    fetch_date = data['fetch_date'].iloc[0] if 'fetch_date' in data.columns else 'Unknown'

    return jsonify({
        'status': 'healthy',
        'data_loaded': True,
        'last_updated': fetch_date,
        'country': 'USA',
        'year_range': '1975-2025',
        'records': {
            'total': len(data),
            'fields': data['field_name'].nunique(),
            'subfields': data['subfield_name'].nunique(),
            'funders': data['funder_name'].nunique()
        }
    })


@app.route('/api/fields')
def get_fields():
    """Get all 10 target fields"""
    data = load_data()
    if data is None or data.empty:
        return jsonify({'error': 'Data not loaded'}), 500

    # Group by field and get unique fields with total works count
    fields = data.groupby(['field_id', 'field_name']).agg({
        'subfield_works_count': 'sum',
        'funder_works_count': 'sum',
        'field_total_funders': 'first'  # Get field_total_funders
    }).reset_index()

    fields_list = []
    for _, row in fields.iterrows():
        fields_list.append({
            'id': int(row['field_id']),
            'name': row['field_name'],
            'total_works': int(row['subfield_works_count']),
            'total_funders': int(row['field_total_funders']) if 'field_total_funders' in row else 0
        })

    # Sort by name
    fields_list = sorted(fields_list, key=lambda x: x['name'])

    return jsonify({
        'count': len(fields_list),
        'data': fields_list
    })


@app.route('/api/subfields')
def get_subfields():
    """Get top 20 subfields for a specific field (by funder count)"""
    field_id = request.args.get('field_id')

    if not field_id:
        return jsonify({'error': 'field_id parameter is required'}), 400

    data = load_data()
    if data is None or data.empty:
        return jsonify({'error': 'Data not loaded'}), 500

    # Filter by field
    field_data = data[data['field_id'] == int(field_id)]

    if field_data.empty:
        return jsonify({'count': 0, 'data': []})

    # Group by subfield and count funders
    subfields = field_data.groupby(['subfield_id', 'subfield_name']).agg({
        'funder_id': 'nunique',  # Count unique funders
        'subfield_works_count': 'first',
        'subfield_total_funders': 'first'  # Get subfield_total_funders
    }).reset_index()

    subfields = subfields.rename(columns={'funder_id': 'funder_count'})

    # Sort by funder count (descending) and take top 20
    subfields = subfields.sort_values('funder_count', ascending=False).head(20)

    subfields_list = []
    for _, row in subfields.iterrows():
        subfields_list.append({
            'id': int(row['subfield_id']),
            'name': row['subfield_name'],
            'works_count': int(row['subfield_works_count']),
            'funder_count': int(row['funder_count']),
            'total_funders': int(row['subfield_total_funders']) if 'subfield_total_funders' in row else 0
        })

    return jsonify({
        'count': len(subfields_list),
        'data': subfields_list
    })


@app.route('/api/funders')
def get_funders():
    """Get top 20 funders for a specific subfield"""
    subfield_id = request.args.get('subfield_id')

    if not subfield_id:
        return jsonify({'error': 'subfield_id parameter is required'}), 400

    data = load_data()
    if data is None or data.empty:
        return jsonify({'error': 'Data not loaded'}), 500

    # Filter by subfield
    subfield_data = data[data['subfield_id'] == int(subfield_id)]

    if subfield_data.empty:
        return jsonify({'count': 0, 'data': []})

    # Group by funder
    funders = subfield_data.groupby(['funder_id', 'funder_name']).agg({
        'funder_works_count': 'first'
    }).reset_index()

    # Sort by works count (descending) and take top 20
    funders = funders.sort_values('funder_works_count', ascending=False).head(20)

    funders_list = []
    for _, row in funders.iterrows():
        funders_list.append({
            'id': row['funder_id'],
            'name': row['funder_name'],
            'works_count': int(row['funder_works_count'])
        })

    return jsonify({
        'count': len(funders_list),
        'data': funders_list
    })


@app.route('/api/topics')
def get_topics():
    """Get 10 most recent topics for a specific funder and subfield"""
    funder_id = request.args.get('funder_id')
    subfield_id = request.args.get('subfield_id')

    if not funder_id or not subfield_id:
        return jsonify({'error': 'Both funder_id and subfield_id parameters are required'}), 400

    data = load_data()
    if data is None or data.empty:
        return jsonify({'error': 'Data not loaded'}), 500

    # Filter by funder and subfield
    filtered_data = data[
        (data['funder_id'] == funder_id) &
        (data['subfield_id'] == int(subfield_id))
    ]

    if filtered_data.empty:
        return jsonify({'count': 0, 'data': []})

    # Extract topics from the topics column (stored as string representation of list)
    all_topics = []
    for _, row in filtered_data.iterrows():
        try:
            topics = ast.literal_eval(row['topics'])
            all_topics.extend(topics)
        except:
            continue

    # Remove duplicates and sort by works count
    unique_topics = {}
    for topic in all_topics:
        topic_id = topic['topic_id']
        if topic_id not in unique_topics:
            unique_topics[topic_id] = topic
        else:
            # If duplicate, keep the one with higher works count
            if topic['topic_works_count'] > unique_topics[topic_id]['topic_works_count']:
                unique_topics[topic_id] = topic

    # Sort by works count and take top 10
    topics_list = sorted(unique_topics.values(), key=lambda x: x['topic_works_count'], reverse=True)[:10]

    return jsonify({
        'count': len(topics_list),
        'data': topics_list
    })


@app.route('/api/reload', methods=['POST'])
def reload():
    try:
        reload_data()
        return jsonify({
            'status': 'success',
            'message': 'Data reloaded successfully'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
