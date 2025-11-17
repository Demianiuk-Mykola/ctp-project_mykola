import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Create starfield
function createStarfield() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 10000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    
    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        const radius = 500;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = radius * Math.cos(phi);
        
        const colorVariation = 0.7 + Math.random() * 0.3;
        colors[i3] = colorVariation;
        colors[i3 + 1] = colorVariation;
        colors[i3 + 2] = 0.8 + Math.random() * 0.2;
        
        sizes[i] = Math.random() * 2;
    }
    
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const starMaterial = new THREE.PointsMaterial({
        size: 1.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    return stars;
}

const starfield = createStarfield();

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 4;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Globe parameters
const radius = 2;
const segments = 64;

// Create transparent globe (ocean)
const globeGeometry = new THREE.SphereGeometry(radius, segments, segments);
const globeMaterial = new THREE.MeshBasicMaterial({
    color: 0x4a3a2a,
    transparent: true,
    opacity: 0.6,
    wireframe: false,
    side: THREE.DoubleSide
});
const globe = new THREE.Mesh(globeGeometry, globeMaterial);
scene.add(globe);

// Create atmosphere glow
const atmosphereGeometry = new THREE.SphereGeometry(radius * 1.15, segments, segments);
const atmosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: `
        varying vec3 vNormal;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec3 vNormal;
        void main() {
            float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
            gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
        }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true
});
const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
atmosphere.visible = false;
scene.add(atmosphere);

// Create inner glow
const glowGeometry = new THREE.SphereGeometry(radius * 1.05, segments, segments);
const glowMaterial = new THREE.ShaderMaterial({
    vertexShader: `
        varying vec3 vNormal;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec3 vNormal;
        void main() {
            float intensity = pow(0.8 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
            gl_FragColor = vec4(0.4, 1.0, 0.8, 1.0) * intensity;
        }
    `,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    transparent: true
});
const glow = new THREE.Mesh(glowGeometry, glowMaterial);
glow.visible = false;
scene.add(glow);

// Groups
const countryFillsGroup = new THREE.Group();
scene.add(countryFillsGroup);

const bordersGroup = new THREE.Group();
scene.add(bordersGroup);

const markersGroup = new THREE.Group();
scene.add(markersGroup);

const connectionsGroup = new THREE.Group();
scene.add(connectionsGroup);

// Storage
const borderLines = [];
const countryMeshes = [];
const markers = [];
const connections = [];
let countryData = new Map();
let selectedCountry = null;
let hoveredCountry = null;

// Border colors
const borderColors = [
    0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xf9ca24, 0x6c5ce7,
    0xa29bfe, 0xfd79a8, 0xfdcb6e, 0xe17055, 0x00b894
];

// State
let state = {
    autoRotate: true,
    rotationSpeed: 0.0001,
    showMarkers: false,
    showConnections: false,
    showGlow: false,
    showAtmosphere: false,
    isDragging: false,
    previousMousePosition: { x: 0, y: 0 },
    mouseDownPosition: { x: 0, y: 0 },
    isAnimating: false,
    animationStartTime: 0,
    animationDuration: 1000,
    pauseDuration: 3000,
    targetRotation: { x: 0, y: 0 },
    startRotation: { x: 0, y: 0 }
};

// FPS counter
let lastTime = performance.now();
let frames = 0;
let fps = 0;

// Utility functions
function latLonToVector3(lat, lon, r) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(r * Math.sin(phi) * Math.cos(theta));
    const z = r * Math.sin(phi) * Math.sin(theta);
    const y = r * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
}

function normalizeCountryName(name) {
    if (!name) return '';
    return name.toString().toLowerCase().trim();
}

function getCountryColorIndex(countryName) {
    if (!countryName) return 0;
    const normalized = normalizeCountryName(countryName);
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % borderColors.length;
}

function createBorderKey(points) {
    if (points.length < 2) return null;
    const first = points[0];
    const last = points[points.length - 1];
    const key = `${Math.round(first.x * 1000)},${Math.round(first.y * 1000)},${Math.round(first.z * 1000)}-${Math.round(last.x * 1000)},${Math.round(last.y * 1000)},${Math.round(last.z * 1000)}`;
    return key;
}

// Convert coordinates to country shape
function createCountryShape(coordinates, geometryType) {
    const shapes = [];
    
    const processRing = (ring) => {
        if (ring.length < 3) return null;
        const vertices = ring.map(([lon, lat]) => latLonToVector3(lat, lon, radius * 1.001));
        return vertices;
    };
    
    if (geometryType === 'Polygon') {
        const vertices = processRing(coordinates[0]);
        if (vertices && vertices.length >= 3) shapes.push(vertices);
    } else if (geometryType === 'MultiPolygon') {
        coordinates.forEach(polygon => {
            const vertices = processRing(polygon[0]);
            if (vertices && vertices.length >= 3) shapes.push(vertices);
        });
    }
    
    return shapes;
}

// Load country borders
async function loadCountryBorders() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson');
        const geoData = await response.json();
        
        const countryColorMap = new Map();
        const drawnBorders = new Map();
        
        function getCountryIdentifier(feature) {
            return feature.properties?.ISO_A3 || feature.properties?.ISO_A2 || 
                   feature.properties?.NAME || feature.properties?.name || 
                   feature.properties?.ADMIN || feature.id?.toString() || '';
        }
        
        // Collect country data
        geoData.features.forEach((feature) => {
            const countryId = getCountryIdentifier(feature);
            const normalized = normalizeCountryName(countryId);
            
            if (normalized && !countryColorMap.has(normalized)) {
                const colorIndex = getCountryColorIndex(normalized);
                countryColorMap.set(normalized, borderColors[colorIndex % borderColors.length]);
                
                countryData.set(normalized, {
                    name: feature.properties?.NAME || feature.properties?.name || countryId,
                    code: feature.properties?.ISO_A3 || feature.properties?.ISO_A2 || '',
                    region: feature.properties?.REGION_UN || feature.properties?.SUBREGION || 'Unknown',
                    population: Math.floor(Math.random() * 100000000),
                    gdp: Math.floor(Math.random() * 1000000000000)
                });
            }
        });
        
        // Create filled meshes and borders
        geoData.features.forEach((feature) => {
            const geometryType = feature.geometry.type;
            const coordinates = feature.geometry.coordinates;
            const countryId = getCountryIdentifier(feature);
            const normalized = normalizeCountryName(countryId);
            const color = countryColorMap.get(normalized) || borderColors[0];
            
            // Create filled polygon meshes
            const shapes = createCountryShape(coordinates, geometryType);
            shapes.forEach(vertices => {
                if (vertices.length < 3) return;
                
                const geometry = new THREE.BufferGeometry();
                const positions = new Float32Array(vertices.length * 3);
                
                vertices.forEach((v, i) => {
                    positions[i * 3] = v.x;
                    positions[i * 3 + 1] = v.y;
                    positions[i * 3 + 2] = v.z;
                });
                
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                
                const indices = [];
                for (let i = 1; i < vertices.length - 1; i++) {
                    indices.push(0, i, i + 1);
                }
                geometry.setIndex(indices);
                geometry.computeVertexNormals();
                
                const material = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.0,
                    side: THREE.DoubleSide,
                    depthTest: true,
                    depthWrite: false
                });
                
                const mesh = new THREE.Mesh(geometry, material);
                mesh.userData = {
                    country: normalized,
                    countryName: countryData.get(normalized)?.name,
                    baseColor: color,
                    isCountryMesh: true
                };
                
                countryFillsGroup.add(mesh);
                countryMeshes.push({ mesh, country: normalized, baseColor: color });
            });
            
            // Create border lines
            const processRing = (ring) => {
                const points = ring.map(([lon, lat]) => latLonToVector3(lat, lon, radius * 1.002));
                
                const borderKey = createBorderKey(points);
                const reverseKey = createBorderKey([...points].reverse());
                
                if (borderKey && (drawnBorders.has(borderKey) || drawnBorders.has(reverseKey))) return;
                if (borderKey) drawnBorders.set(borderKey, true);
                
                const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
                const lineMaterial = new THREE.LineBasicMaterial({
                    color: color,
                    linewidth: 1,
                    transparent: true,
                    opacity: 0.7,
                    depthTest: false,
                    depthWrite: false
                });
                const line = new THREE.Line(lineGeometry, lineMaterial);
                line.userData = { country: normalized, countryName: countryData.get(normalized)?.name };
                bordersGroup.add(line);
                
                borderLines.push({
                    line, originalPoints: points, baseColor: color, baseOpacity: 0.7, country: normalized
                });
            };
            
            if (geometryType === 'Polygon') {
                coordinates.forEach(ring => processRing(ring));
            } else if (geometryType === 'MultiPolygon') {
                coordinates.forEach(polygon => polygon.forEach(ring => processRing(ring)));
            }
        });
        
        document.getElementById('country-count').textContent = countryData.size;
        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error('Error loading country borders:', error);
        document.getElementById('loading').innerHTML = '<div class="spinner"></div><div>Error loading data. Please refresh.</div>';
    }
}

// Create marker
function createMarker(lat, lon, label, color = 0xff1493) {
    const position = latLonToVector3(lat, lon, radius * 1.05);
    
    const markerGeometry = new THREE.SphereGeometry(0.03, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ color });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(position);
    
    const glowGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.position.copy(position);
    
    marker.userData = { label, lat, lon, isMarker: true };
    glowMesh.userData = { label, lat, lon, isMarker: true };
    
    markersGroup.add(marker);
    markersGroup.add(glowMesh);
    markers.push({ marker, glow: glowMesh, label, lat, lon });
    updateMarkerCount();
    return marker;
}

// Create connection arc
function createConnection(lat1, lon1, lat2, lon2, color = 0xff6b6b) {
    const start = latLonToVector3(lat1, lon1, radius * 1.02);
    const end = latLonToVector3(lat2, lon2, radius * 1.02);
    const distance = start.distanceTo(end);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.normalize().multiplyScalar(radius * 1.02 + distance * 0.3);
    
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6, linewidth: 2 });
    const line = new THREE.Line(geometry, material);
    connectionsGroup.add(line);
    connections.push(line);
    return line;
}

// Add sample data
function addSampleData() {
    const cities = [
        { lat: 40.7128, lon: -74.0060, label: 'New York' },
        { lat: 51.5074, lon: -0.1278, label: 'London' },
        { lat: 35.6762, lon: 139.6503, label: 'Tokyo' },
        { lat: -33.8688, lon: 151.2093, label: 'Sydney' },
        { lat: 48.8566, lon: 2.3522, label: 'Paris' },
        { lat: 55.7558, lon: 37.6173, label: 'Moscow' }
    ];
    
    cities.forEach(city => createMarker(city.lat, city.lon, city.label));
    
    for (let i = 0; i < cities.length - 1; i++) {
        const city1 = cities[i];
        const city2 = cities[i + 1];
        createConnection(city1.lat, city1.lon, city2.lat, city2.lon);
    }
}

// Mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tooltip = document.getElementById('tooltip');
const infoPanel = document.getElementById('info-panel');

function onMouseDown(event) {
    state.isDragging = true;
    state.previousMousePosition = { x: event.clientX, y: event.clientY };
    state.mouseDownPosition = { x: event.clientX, y: event.clientY };
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    if (state.isDragging) {
        const deltaX = event.clientX - state.previousMousePosition.x;
        const deltaY = event.clientY - state.previousMousePosition.y;
        
        [globe, countryFillsGroup, bordersGroup, markersGroup, connectionsGroup, atmosphere, glow, starfield].forEach(obj => {
            obj.rotation.y += deltaX * 0.01;
            obj.rotation.x += deltaY * 0.01;
        });
        
        state.previousMousePosition = { x: event.clientX, y: event.clientY };
        renderer.domElement.style.cursor = 'grabbing';
        return;
    }
    
    // Raycast for hover
    raycaster.setFromCamera(mouse, camera);
    
    // Check markers
    const markerIntersects = raycaster.intersectObjects(markersGroup.children);
    if (markerIntersects.length > 0) {
        const marker = markerIntersects[0].object;
        if (marker.userData.isMarker && marker.userData.label) {
            // Show detailed info for research data markers
            if (marker.userData.isResearchData) {
                const type = marker.userData.type.charAt(0).toUpperCase() + marker.userData.type.slice(1);
                const works = marker.userData.works.toLocaleString();
                tooltip.textContent = `${marker.userData.label} (${type}: ${works} works)`;
            } else {
                tooltip.textContent = marker.userData.label;
            }
            tooltip.style.display = 'block';
            tooltip.style.left = event.clientX + 10 + 'px';
            tooltip.style.top = event.clientY + 10 + 'px';
            renderer.domElement.style.cursor = 'pointer';

            if (hoveredCountry) {
                unhighlightCountry(hoveredCountry);
                hoveredCountry = null;
            }
            return;
        }
    }
    
    // Check countries
    const fillIntersects = raycaster.intersectObjects(countryFillsGroup.children);
    if (fillIntersects.length > 0) {
        const countryMesh = fillIntersects[0].object;
        if (countryMesh.userData.isCountryMesh) {
            const countryId = countryMesh.userData.country;
            const countryName = countryMesh.userData.countryName;
            
            if (hoveredCountry !== countryId) {
                if (hoveredCountry) unhighlightCountry(hoveredCountry);
                hoveredCountry = countryId;
                highlightCountryHover(countryId);
            }
            
            tooltip.textContent = countryName || countryId;
            tooltip.style.display = 'block';
            tooltip.style.left = event.clientX + 10 + 'px';
            tooltip.style.top = event.clientY + 10 + 'px';
            renderer.domElement.style.cursor = 'pointer';
            return;
        }
    }
    
    // Over ocean
    if (hoveredCountry) {
        unhighlightCountry(hoveredCountry);
        hoveredCountry = null;
    }
    
    const globeIntersects = raycaster.intersectObject(globe);
    if (globeIntersects.length > 0) {
        renderer.domElement.style.cursor = 'grab';
    } else {
        renderer.domElement.style.cursor = 'default';
    }
    tooltip.style.display = 'none';
}

function onMouseUp(event) {
    if (state.isDragging) {
        const dragDistance = Math.sqrt(
            Math.pow(event.clientX - state.mouseDownPosition.x, 2) +
            Math.pow(event.clientY - state.mouseDownPosition.y, 2)
        );
        
        if (dragDistance < 5) {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            
            // Check markers
            const markerIntersects = raycaster.intersectObjects(markersGroup.children);
            if (markerIntersects.length > 0) {
                const marker = markerIntersects[0].object;
                if (marker.userData.isMarker && marker.userData.label) {
                    // Check if it's research data marker
                    if (marker.userData.isResearchData) {
                        showResearchDataInfo(marker.userData);
                    } else {
                        showInfo(marker.userData.label, `Lat: ${marker.userData.lat.toFixed(2)}, Lon: ${marker.userData.lon.toFixed(2)}`);
                    }
                    state.isDragging = false;
                    renderer.domElement.style.cursor = 'default';
                    return;
                }
            }
            
            // Check countries
            const fillIntersects = raycaster.intersectObjects(countryFillsGroup.children);
            if (fillIntersects.length > 0) {
                const countryMesh = fillIntersects[0].object;
                if (countryMesh.userData.isCountryMesh) {
                    const countryId = countryMesh.userData.country;
                    selectCountry(countryId);
                    const data = countryData.get(countryId);
                    if (data) showCountryInfo(data);
                }
            }
        }
    }
    
    state.isDragging = false;
    renderer.domElement.style.cursor = 'default';
}

// Mouse wheel zoom
function onMouseWheel(event) {
    event.preventDefault();
    
    const zoomSpeed = 0.1;
    const delta = event.deltaY > 0 ? 1 : -1;
    
    camera.position.z += delta * zoomSpeed;
    camera.position.z = Math.max(2, Math.min(10, camera.position.z));
}

// UI Functions
function showInfo(title, content) {
    document.getElementById('country-name').textContent = title;
    document.getElementById('country-code').textContent = '';
    document.getElementById('country-region').textContent = '';
    document.getElementById('country-data').textContent = content;
    infoPanel.classList.add('visible');
}

function showCountryInfo(data) {
    document.getElementById('country-name').textContent = data.name;
    document.getElementById('country-code').textContent = `Code: ${data.code}`;
    document.getElementById('country-region').textContent = `Region: ${data.region}`;
    document.getElementById('country-data').textContent =
        `Population: ${(data.population / 1000000).toFixed(1)}M | GDP: $${(data.gdp / 1000000000).toFixed(1)}B`;
    infoPanel.classList.add('visible');
}

function showResearchDataInfo(userData) {
    const typeLabel = userData.type.charAt(0).toUpperCase() + userData.type.slice(1);
    document.getElementById('country-name').textContent = userData.label;
    document.getElementById('country-code').textContent = `Type: ${typeLabel}`;

    let details = `Works Count: ${userData.works.toLocaleString()}`;

    if (userData.type === 'topic' && userData.data.field) {
        details += ` | Field: ${userData.data.field}`;
    }

    if (userData.type === 'funder' && userData.data) {
        const funder = userData.data;
        details = `Funder: ${funder.funder_name}\n`;
        details += `Subfield: ${funder.subfield_name}\n`;
        details += `Works Count: ${funder.subfield_works_count.toLocaleString()}\n`;
        details += `Total Funder Works: ${funder.total_works_count.toLocaleString()}`;
    }

    document.getElementById('country-region').textContent = details;
    document.getElementById('country-data').textContent = '';
    infoPanel.classList.add('visible');
}

function highlightCountryHover(countryId) {
    countryMeshes.forEach(cm => {
        if (cm.country === countryId && cm.mesh.material.opacity < 0.3) {
            cm.mesh.material.opacity = 0.2;
        }
    });
    borderLines.forEach(bl => {
        if (bl.country === countryId) bl.line.material.opacity = 1.0;
    });
}

function unhighlightCountry(countryId) {
    if (selectedCountry === countryId) return;
    
    countryMeshes.forEach(cm => {
        if (cm.country === countryId) cm.mesh.material.opacity = 0.0;
    });
    borderLines.forEach(bl => {
        if (bl.country === countryId) bl.line.material.opacity = bl.baseOpacity;
    });
}

function selectCountry(countryId) {
    // Reset previous
    if (selectedCountry) {
        countryMeshes.forEach(cm => {
            if (cm.country === selectedCountry) cm.mesh.material.opacity = 0.0;
        });
        borderLines.forEach(bl => {
            if (bl.country === selectedCountry) {
                bl.line.material.opacity = bl.baseOpacity;
                bl.line.material.color.setHex(bl.baseColor);
            }
        });
    }
    
    // Highlight selected
    countryMeshes.forEach(cm => {
        if (cm.country === countryId) {
            cm.mesh.material.opacity = 0.4;
            cm.mesh.material.color.setHex(0xffffff);
        }
    });
    borderLines.forEach(bl => {
        if (bl.country === countryId) {
            bl.line.material.opacity = 1.0;
            bl.line.material.color.setHex(0xffffff);
        }
    });
    
    selectedCountry = countryId;
}

function updateMarkerCount() {
    document.getElementById('marker-count').textContent = markers.length;
}

// Search
function setupSearch() {
    const searchInput = document.getElementById('country-search');
    const searchResults = document.getElementById('search-results');
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }
        
        const matches = Array.from(countryData.entries())
            .filter(([key, data]) => 
                data.name.toLowerCase().includes(query) || data.code.toLowerCase().includes(query))
            .slice(0, 10);
        
        if (matches.length === 0) {
            searchResults.style.display = 'none';
            return;
        }
        
        searchResults.innerHTML = matches.map(([key, data]) => 
            `<div class="search-result-item" data-country="${key}">${data.name} (${data.code})</div>`
        ).join('');
        searchResults.style.display = 'block';
        
        searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const countryId = item.dataset.country;
                selectCountry(countryId);
                const data = countryData.get(countryId);
                if (data) showCountryInfo(data);
                searchResults.style.display = 'none';
                searchInput.value = '';
            });
        });
    });
    
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}

// ============ RESEARCH DATA API INTEGRATION ============

// API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Research data state
let researchData = {
    fields: [],
    subfields: [],
    topics: [],
    funders: [],
    filters: {
        field: '',
        subfield: '',
        topic: '',
        funder: ''
    },
    showResearchData: false,
    markers: []
};

// API Functions
async function fetchFields() {
    try {
        const response = await fetch(`${API_BASE_URL}/fields`);
        const data = await response.json();
        researchData.fields = data.data || [];
        return researchData.fields;
    } catch (error) {
        console.error('Error fetching fields:', error);
        return [];
    }
}

async function fetchSubfields() {
    try {
        const response = await fetch(`${API_BASE_URL}/subfields`);
        const data = await response.json();
        researchData.subfields = data.data || [];
        return researchData.subfields;
    } catch (error) {
        console.error('Error fetching subfields:', error);
        return [];
    }
}

async function fetchTopics() {
    try {
        const response = await fetch(`${API_BASE_URL}/topics`);
        const data = await response.json();
        researchData.topics = data.data || [];
        return researchData.topics;
    } catch (error) {
        console.error('Error fetching topics:', error);
        return [];
    }
}

async function fetchFunders() {
    try {
        const response = await fetch(`${API_BASE_URL}/funders`);
        const data = await response.json();
        researchData.funders = data.data || [];
        return researchData.funders;
    } catch (error) {
        console.error('Error fetching funders:', error);
        return [];
    }
}

// Populate filter dropdowns
async function populateFilters() {
    const [fields, subfields, topics, funders] = await Promise.all([
        fetchFields(),
        fetchSubfields(),
        fetchTopics(),
        fetchFunders()
    ]);

    // Populate field dropdown
    const fieldSelect = document.getElementById('field-filter');
    fields.forEach(field => {
        const option = document.createElement('option');
        option.value = field.id;
        option.textContent = field.name;
        fieldSelect.appendChild(option);
    });

    // Populate subfield dropdown
    const subfieldSelect = document.getElementById('subfield-filter');
    subfields.forEach(subfield => {
        const option = document.createElement('option');
        option.value = subfield.id;
        option.textContent = subfield.name;
        subfieldSelect.appendChild(option);
    });

    // Populate topic dropdown
    const topicSelect = document.getElementById('topic-filter');
    topics.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic.id;
        option.textContent = topic.name;
        topicSelect.appendChild(option);
    });

    // Populate funder dropdown
    const funderSelect = document.getElementById('funder-filter');
    const uniqueFunders = new Map();
    funders.forEach(funder => {
        if (!uniqueFunders.has(funder.funder_id)) {
            uniqueFunders.set(funder.funder_id, funder.funder_name);
        }
    });
    uniqueFunders.forEach((name, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        funderSelect.appendChild(option);
    });
}

// Clear research data markers
function clearResearchMarkers() {
    researchData.markers.forEach(markerData => {
        markersGroup.remove(markerData.marker);
        markersGroup.remove(markerData.glow);
    });
    researchData.markers = [];
    updateMarkerCount();
}

// Create research data visualization
function visualizeResearchData() {
    clearResearchMarkers();

    if (!researchData.showResearchData) {
        document.getElementById('research-legend-subfield').style.display = 'none';
        document.getElementById('research-legend-topic').style.display = 'none';
        document.getElementById('research-legend-funder').style.display = 'none';
        return;
    }

    // Get filtered data
    let filteredSubfields = researchData.subfields;
    let filteredFunders = researchData.funders;
    let filteredTopics = researchData.topics;

    // Apply filters
    if (researchData.filters.field) {
        // Filter by field - we need to get topics that belong to this field
        filteredTopics = filteredTopics.filter(topic =>
            topic.field && topic.field.includes(researchData.fields.find(f => f.id == researchData.filters.field)?.name)
        );
    }

    if (researchData.filters.subfield) {
        filteredSubfields = filteredSubfields.filter(sf => sf.id == researchData.filters.subfield);
        filteredFunders = filteredFunders.filter(f => f.subfield_id == researchData.filters.subfield);
    }

    if (researchData.filters.topic) {
        filteredTopics = filteredTopics.filter(t => t.id == researchData.filters.topic);
    }

    if (researchData.filters.funder) {
        filteredFunders = filteredFunders.filter(f => f.funder_id == researchData.filters.funder);
    }

    // Since the data is US-focused, place markers on US
    const usLat = 39.8283;
    const usLon = -98.5795;

    // Create markers for filtered data
    const dataToVisualize = [];

    // Add subfield data
    filteredSubfields.forEach(subfield => {
        dataToVisualize.push({
            type: 'subfield',
            name: subfield.name,
            works: subfield.us_works_count,
            data: subfield
        });
    });

    // Add topic data
    filteredTopics.forEach(topic => {
        dataToVisualize.push({
            type: 'topic',
            name: topic.name,
            works: topic.us_works_count,
            field: topic.field,
            data: topic
        });
    });

    // Add funder data
    filteredFunders.forEach(funder => {
        dataToVisualize.push({
            type: 'funder',
            name: `${funder.funder_name} (${funder.subfield_name})`,
            works: funder.subfield_works_count,
            data: funder
        });
    });

    // Create markers with size based on work count
    if (dataToVisualize.length > 0) {
        const maxWorks = Math.max(...dataToVisualize.map(d => d.works));

        dataToVisualize.forEach((item, index) => {
            // Spread markers around US
            const offsetLat = (Math.random() - 0.5) * 10;
            const offsetLon = (Math.random() - 0.5) * 20;
            const lat = usLat + offsetLat;
            const lon = usLon + offsetLon;

            // Size based on work count
            const size = 0.02 + (item.works / maxWorks) * 0.08;

            // Color based on type
            let color;
            if (item.type === 'subfield') color = 0xffd700; // Gold
            else if (item.type === 'topic') color = 0xff69b4; // Hot pink
            else color = 0x00ffff; // Cyan for funders

            const position = latLonToVector3(lat, lon, radius * 1.05);

            const markerGeometry = new THREE.SphereGeometry(size, 16, 16);
            const markerMaterial = new THREE.MeshBasicMaterial({ color });
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.copy(position);

            const glowGeometry = new THREE.SphereGeometry(size * 1.5, 16, 16);
            const glowMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 });
            const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
            glowMesh.position.copy(position);

            marker.userData = {
                label: item.name,
                lat,
                lon,
                isMarker: true,
                isResearchData: true,
                type: item.type,
                works: item.works,
                data: item.data
            };
            glowMesh.userData = { ...marker.userData };

            markersGroup.add(marker);
            markersGroup.add(glowMesh);
            researchData.markers.push({ marker, glow: glowMesh, ...item });
        });

        updateMarkerCount();

        // Show appropriate legend items
        const hasSubfields = dataToVisualize.some(d => d.type === 'subfield');
        const hasTopics = dataToVisualize.some(d => d.type === 'topic');
        const hasFunders = dataToVisualize.some(d => d.type === 'funder');

        document.getElementById('research-legend-subfield').style.display = hasSubfields ? 'flex' : 'none';
        document.getElementById('research-legend-topic').style.display = hasTopics ? 'flex' : 'none';
        document.getElementById('research-legend-funder').style.display = hasFunders ? 'flex' : 'none';
    }
}

// Setup research data controls
function setupResearchDataControls() {
    const toggleBtn = document.getElementById('toggle-research-data');
    const applyBtn = document.getElementById('apply-filters');
    const clearBtn = document.getElementById('clear-filters');

    // Populate filters on load
    populateFilters();

    // Toggle research data visibility
    toggleBtn.addEventListener('click', (e) => {
        researchData.showResearchData = !researchData.showResearchData;
        e.target.classList.toggle('active');
        visualizeResearchData();
    });

    // Apply filters
    applyBtn.addEventListener('click', () => {
        researchData.filters.field = document.getElementById('field-filter').value;
        researchData.filters.subfield = document.getElementById('subfield-filter').value;
        researchData.filters.topic = document.getElementById('topic-filter').value;
        researchData.filters.funder = document.getElementById('funder-filter').value;
        visualizeResearchData();
    });

    // Clear all filters
    clearBtn.addEventListener('click', () => {
        document.getElementById('field-filter').value = '';
        document.getElementById('subfield-filter').value = '';
        document.getElementById('topic-filter').value = '';
        document.getElementById('funder-filter').value = '';
        researchData.filters = { field: '', subfield: '', topic: '', funder: '' };
        visualizeResearchData();
    });
}

// ============ END RESEARCH DATA API INTEGRATION ============

// Controls
function setupControls() {
    const speedSlider = document.getElementById('rotation-speed');
    const speedValue = document.getElementById('speed-value');
    speedSlider.addEventListener('input', (e) => {
        const speed = parseFloat(e.target.value);
        state.rotationSpeed = speed * 0.001;
        speedValue.textContent = speed.toFixed(1) + 'x';
    });
    
    document.getElementById('toggle-rotation').addEventListener('click', (e) => {
        state.autoRotate = !state.autoRotate;
        e.target.classList.toggle('active');
    });
    
    document.getElementById('reset-view').addEventListener('click', () => {
        [globe, countryFillsGroup, bordersGroup, markersGroup, connectionsGroup, atmosphere, glow, starfield].forEach(obj => {
            obj.rotation.set(0, 0, 0);
        });
        camera.position.z = 4;
    });
    
    document.getElementById('toggle-markers').addEventListener('click', (e) => {
        state.showMarkers = !state.showMarkers;
        markersGroup.visible = state.showMarkers;
        e.target.classList.toggle('active');
        if (state.showMarkers && markers.length === 0) addSampleData();
    });
    
    document.getElementById('toggle-connections').addEventListener('click', (e) => {
        state.showConnections = !state.showConnections;
        connectionsGroup.visible = state.showConnections;
        e.target.classList.toggle('active');
    });
    
    document.getElementById('toggle-glow').addEventListener('click', (e) => {
        state.showGlow = !state.showGlow;
        glow.visible = state.showGlow;
        e.target.classList.toggle('active');
    });
    
    document.getElementById('toggle-atmosphere').addEventListener('click', (e) => {
        state.showAtmosphere = !state.showAtmosphere;
        atmosphere.visible = state.showAtmosphere;
        e.target.classList.toggle('active');
    });
    
    document.getElementById('close-info').addEventListener('click', () => {
        infoPanel.classList.remove('visible');
    });
    
    // Toggle control panel visibility
    const controlPanel = document.getElementById('control-panel');
    const toggleBtn = document.getElementById('toggle-panel');
    
    toggleBtn.addEventListener('click', () => {
        controlPanel.classList.toggle('collapsed');
    });
}

// Event listeners
renderer.domElement.addEventListener('mousedown', onMouseDown);
renderer.domElement.addEventListener('mousemove', onMouseMove);
renderer.domElement.addEventListener('mouseup', onMouseUp);
renderer.domElement.addEventListener('mouseleave', onMouseUp);
renderer.domElement.addEventListener('wheel', onMouseWheel, { passive: false });

// Border opacity update
function updateBorderOpacity() {
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    cameraDirection.multiplyScalar(-1);
    
    borderLines.forEach((borderLine) => {
        const positions = borderLine.line.geometry.attributes.position;
        if (!positions || positions.count === 0) return;
        
        let midpoint = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
            const point = new THREE.Vector3();
            point.fromBufferAttribute(positions, i);
            borderLine.line.localToWorld(point);
            midpoint.add(point);
        }
        midpoint.divideScalar(positions.count);
        
        const directionToMidpoint = midpoint.clone().normalize();
        const dotProduct = directionToMidpoint.dot(cameraDirection);
        
        const dimOpacity = 0.2;
        const opacityRange = borderLine.baseOpacity - dimOpacity;
        const newOpacity = dimOpacity + (dotProduct + 1) / 2 * opacityRange;
        
        borderLine.line.material.opacity = Math.max(dimOpacity, Math.min(borderLine.baseOpacity, newOpacity));
    });
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // FPS counter
    frames++;
    const currentTime = performance.now();
    if (currentTime >= lastTime + 1000) {
        fps = Math.round((frames * 1000) / (currentTime - lastTime));
        document.getElementById('fps').textContent = fps;
        frames = 0;
        lastTime = currentTime;
    }
    
    // Auto-rotate
    if (state.autoRotate && !state.isDragging) {
        [globe, countryFillsGroup, bordersGroup, markersGroup, connectionsGroup, atmosphere, glow, starfield].forEach(obj => {
            obj.rotation.y += state.rotationSpeed;
        });
    }
    
    // Animate marker glow
    markers.forEach((m, i) => {
        const time = Date.now() * 0.001;
        m.glow.material.opacity = 0.3 + Math.sin(time * 2 + i) * 0.2;
        m.glow.scale.setScalar(1 + Math.sin(time * 2 + i) * 0.2);
    });
    
    updateBorderOpacity();
    renderer.render(scene, camera);
}

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Initialize
loadCountryBorders();
setupControls();
setupSearch();
setupResearchDataControls();
animate();