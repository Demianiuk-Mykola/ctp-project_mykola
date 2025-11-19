# Globe Visualization Setup Guide

A comprehensive guide to run the interactive 3D globe visualization with research data integration.

## Prerequisites

- **Python 3.8+** installed on your system
- **Web browser** (Chrome, Firefox, Safari, or Edge)
- **Internet connection** (for loading Three.js library and GeoJSON data)

## Quick Start

### 1. Install Python Dependencies

Open a terminal in the project directory and run:

```bash
pip install -r requirements.txt
```

This will install:
- Flask (web server)
- Flask-CORS (cross-origin resource sharing)
- pandas (data processing)
- numpy (numerical operations)

### 2. Start the Backend API

Run the Flask API server:

```bash
python flask_api_usa.py
```

You should see output like:
```
✓ Loaded 50 records from data/usa_research_data.csv
 * Running on http://127.0.0.1:5000
```

**Keep this terminal window open** - the server needs to stay running.

### 3. Open the Visualization

**Option A: Direct File Open**
- Simply open `index.html` in your web browser
- Most modern browsers support this for local development

**Option B: Local Web Server (Recommended)**

In a **new terminal window**, run:

```bash
# Python 3
python -m http.server 8000

# Or Python 2
python -m SimpleHTTPServer 8000
```

Then navigate to: `http://localhost:8000/index.html`

## Using the Visualization

### Basic Controls

**Globe Rotation:**
- The globe auto-rotates by default
- Click and drag to manually rotate
- Toggle auto-rotation using the "Auto Rotate" button

**Country Selection:**
- Click on any country to select it
- Use the "Search Country" box to find specific countries
- Selected countries highlight with white borders

**Atmosphere Effect:**
- Toggle the blue glow around the globe with "Atmosphere" button
- Enabled by default

### Research Data Filters

When you select a country, the Research Data Filters panel appears in the top-right corner:

1. **Field** - Select from 10 research fields
2. **Subfield** - Top 20 subfields (filtered by selected field)
3. **Funder** - Top 20 funders (filtered by selected subfield)
4. **Topic** - 10 most recent topics (filtered by funder)

**Apply Filters** - Visualizes research data on the globe
**Clear All** - Resets all filters

### Visualization Features

- **Markers** - Show specific research locations (greenish-teal dots)
- **Connections** - Draw lines between research collaborations (red lines)
- **Stats Panel** - Displays FPS, country count, and marker count
- **Legend** - Shows color coding for different elements

## File Structure

```
ctp-project_mykola/
├── index.html                     # Main webpage
├── globe.js                       # Visualization logic
├── flask_api_usa.py              # Backend API
├── requirements.txt              # Python dependencies
└── data/
    └── usa_research_data.csv     # Research data
```

## Troubleshooting

### API Connection Error

**Problem:** "Failed to load fields" or API errors in browser console

**Solution:**
1. Ensure Flask server is running (`python flask_api_usa.py`)
2. Check that it's running on `http://localhost:5000`
3. Verify `globe.js` line 657 has: `const API_BASE_URL = 'http://localhost:5000/api';`

### CORS Errors

**Problem:** "Access-Control-Allow-Origin" errors

**Solution:**
- Make sure Flask-CORS is installed: `pip install flask-cors`
- The API should show `CORS(app)` is enabled
- Try using Option B (local web server) instead of direct file open

### Globe Not Rendering

**Problem:** Blank screen or black canvas

**Solution:**
1. Check browser console (F12) for JavaScript errors
2. Ensure you have internet connection (Three.js loads from CDN)
3. Try a different browser (Chrome/Firefox recommended)
4. Clear browser cache and hard refresh (Ctrl+Shift+R)

### No Countries Visible

**Problem:** Globe renders but no country borders

**Solution:**
1. Check internet connection (GeoJSON loads from GitHub)
2. Check browser console for fetch errors
3. Verify the GeoJSON URL is accessible:
   `https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson`

### Data Not Loading

**Problem:** Filters don't populate or show "No data"

**Solution:**
1. Verify `data/usa_research_data.csv` exists
2. Check Flask terminal for data loading errors
3. Test API manually: visit `http://localhost:5000/api/health`
4. Reload data: visit `http://localhost:5000/api/reload`

## API Endpoints

Test the API directly:

- `http://localhost:5000/` - API info
- `http://localhost:5000/api/health` - Health check
- `http://localhost:5000/api/fields` - List all fields
- `http://localhost:5000/api/subfields?field_id=39` - Get subfields
- `http://localhost:5000/api/funders?subfield_id=3421` - Get funders
- `http://localhost:5000/api/topics?funder_id=F001&subfield_id=3421` - Get topics

## Performance Tips

1. **Close unused applications** to free up GPU resources
2. **Disable markers/connections** when not needed (they impact performance)
3. **FPS counter** in stats panel helps monitor performance
4. **Limit filter selections** - fewer filters = faster loading

## Browser Compatibility

**Recommended:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Required Features:**
- WebGL 2.0 support
- ES6 modules support
- Fetch API support

## System Requirements

**Minimum:**
- 4GB RAM
- Integrated GPU with WebGL support
- 1280x720 display resolution

**Recommended:**
- 8GB+ RAM
- Dedicated GPU
- 1920x1080+ display resolution

## Color Scheme

The interface uses a greenish-teal theme:
- Primary color: `#4ecdc4` (teal)
- Backgrounds: Dark blue/black (`rgba(20, 20, 40, 0.9)`)
- Highlights: White (`#ffffff`)

## Data Information

**Research Data Coverage:**
- Country: USA
- Time Period: 1975-2025
- Fields: 10 target research fields
- Subfields: Top 20 per field
- Funders: Top 20 per subfield
- Topics: 10 most recent per funder

## Need Help?

If you encounter issues not covered in this guide:
1. Check the browser console (F12) for error messages
2. Review Flask terminal output for backend errors
3. Verify all prerequisites are installed
4. Ensure stable internet connection

## Stopping the Application

1. Close the browser tab
2. Stop the Flask server: Press `Ctrl+C` in the Flask terminal
3. Stop the web server (if running): Press `Ctrl+C` in the HTTP server terminal

---

**Enjoy exploring global research data!**
