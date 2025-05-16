import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
console.log('Mapbox GL JS Loaded:', mapboxgl);
// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoibmFyYWdoYXZhbiIsImEiOiJjbWFyNnY5MzIwMmxsMm1xOHJ6OHpoY3hiIn0.knI72sl8RlN4QCTBjHSvjQ';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18, // Maximum allowed zoom
});

function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

map.on('load', async () => {
  // 3.1 Boston bike lanes
  map.addSource('boston_route', {
    type: 'geojson',
    data:
      'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });
  map.addLayer({
    id: 'bike-lanes-boston',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': '#32D400',
      'line-width': 3,
      'line-opacity': 0.4,
    },
  });

  // 3.2 Cambridge bike lanes
  map.addSource('cambridge_route', {
    type: 'geojson',
    data:
      'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
  });
  map.addLayer({
    id: 'bike-lanes-cambridge',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': '#32D400',
      'line-width': 3,
      'line-opacity': 0.4,
    },
  });

  const svg        = d3.select('#map').select('svg');
  const stationsUrl =
    'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';

  try {
    const jsonData = await d3.json(stationsUrl);
    console.log('raw JSON:', jsonData);

    // unzip the array
    const stations = jsonData.data.stations;
    console.log('first station:', stations[0]);

    // bind circles
    const circles = svg
      .selectAll('circle')
      .data(stations)
      .enter()
      .append('circle')
      .attr('r', 5)
      .attr('fill', 'steelblue')
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8);

    // a helper that handles both key conventions
    function project(d) {
      const lon = d.lon  ?? d.Long;
      const lat = d.lat  ?? d.Lat;
      return map.project([+lon, +lat]);
    }

    // position update
    function updatePositions() {
      circles
        .attr('cx', d => project(d).x)
        .attr('cy', d => project(d).y);
    }

    // initial draw + reproject on every interaction
    updatePositions();
    map.on('move',     updatePositions);
    map.on('zoom',     updatePositions);
    map.on('resize',   updatePositions);
    map.on('moveend',  updatePositions);

  } catch (err) {
    console.error('Station data load failed:', err);
  }
});