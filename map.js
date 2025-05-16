import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
console.log('Mapbox GL JS Loaded:', mapboxgl);
mapboxgl.accessToken = 'pk.eyJ1IjoibmFyYWdoYXZhbiIsImEiOiJjbWFyNnY5MzIwMmxsMm1xOHJ6OHpoY3hiIn0.knI72sl8RlN4QCTBjHSvjQ';

const map = new mapboxgl.Map({
  container: 'map', 
  style: 'mapbox://styles/mapbox/streets-v12', 
  center: [-71.09415, 42.36027], 
  zoom: 12,
  minZoom: 5, 
  maxZoom: 18, 
});

function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

map.on('load', async () => {
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

    let stations = jsonData.data.stations;
    console.log('first station:', stations[0]);
    
    const tripsUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
    const trips = await d3.csv(tripsUrl);

    const departures = d3.rollup(
    trips,
    v => v.length,
    d => d.start_station_id
    );
    const arrivals = d3.rollup(
    trips,
    v => v.length,
    d => d.end_station_id
    );

    stations = stations.map(station => {
    const id = station.short_name;        // “A32000”, etc.
    station.departures    = departures.get(id) ?? 0;
    station.arrivals      = arrivals.get(id)   ?? 0;
    station.totalTraffic = station.departures + station.arrivals;
    return station;
    });

    const radiusScale = d3.scaleSqrt()
    .domain([0, d3.max(stations, d => d.totalTraffic)])
    .range([0, 25]);

    const circles = svg
    .selectAll('circle')
    .data(stations)
    .enter()
    .append('circle')
        .attr('r', d => radiusScale(d.totalTraffic))
        .attr('fill', 'steelblue')
        .attr('fill-opacity', 0.6)     
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .attr('pointer-events', 'auto');

    circles.each(function(d) {
    d3.select(this)
        .append('title')
        .text(
        `${d.totalTraffic} trips\n` +
        `– ${d.departures} departures\n` +
        `– ${d.arrivals} arrivals`
        );
    });

    function project(d) {
    const lon = d.lon ?? d.Long;
    const lat = d.lat ?? d.Lat;
    return map.project([+lon, +lat]);
    }
    function updatePositions() {
    circles
        .attr('cx', d => project(d).x)
        .attr('cy', d => project(d).y);
    }

    updatePositions();
    map.on('move',    updatePositions);
    map.on('zoom',    updatePositions);
    map.on('resize',  updatePositions);
    map.on('moveend', updatePositions);
  } catch (err) {
    console.error('Station data load failed:', err);
  }
});