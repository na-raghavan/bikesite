import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
console.log('Mapbox GL JS Loaded:', mapboxgl);
mapboxgl.accessToken = 'pk.eyJ1IjoibmFyYWdoYXZhbiIsImEiOiJjbWFyNnY5MzIwMmxsMm1xOHJ6OHpoY3hiIn0.knI72sl8RlN4QCTBjHSvjQ';
let timeFilter = -1;

function formatTime(minutes) {
  const d = new Date(0, 0, 0, 0, minutes);
  return d.toLocaleString('en-US', { timeStyle: 'short' });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function computeStationTraffic(stations, trips) {
  const departures = d3.rollup(trips, v => v.length, d => d.start_station_id);
  const arrivals   = d3.rollup(trips, v => v.length, d => d.end_station_id);
  return stations.map(station => {
    const id = station.short_name;
    station.departures    = departures.get(id) ?? 0;
    station.arrivals      = arrivals.get(id)   ?? 0;
    station.totalTraffic  = station.departures + station.arrivals;
    return station;
  });
}

function filterTripsByTime(trips, timeFilter) {
  if (timeFilter === -1) return trips;
  return trips.filter(trip => {
    const startM = minutesSinceMidnight(trip.started_at);
    const endM   = minutesSinceMidnight(trip.ended_at);
    return (
      Math.abs(startM - timeFilter) <= 60 ||
      Math.abs(endM   - timeFilter) <= 60
    );
  });
}
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

    const tripsUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
    const trips = await d3.csv(tripsUrl, trip => {
    trip.started_at = new Date(trip.started_at);
    trip.ended_at   = new Date(trip.ended_at);
    return trip;
    });

    const rawStations = jsonData.data.stations;

    let stations = computeStationTraffic(rawStations, trips);

    const radiusScale = d3.scaleSqrt()
    .domain([0, d3.max(stations, d => d.totalTraffic)])
    .range([0, 25]);

    const stationFlow = d3
    .scaleQuantize()
    .domain([0, 1])
    .range([0, 0.5, 1]); 

    const circles = svg
    .selectAll('circle')
    .data(stations, d => d.short_name)
    .enter()
    .append('circle')
        .attr('r',      d => radiusScale(d.totalTraffic))
        .attr('fill',   'steelblue')
        .attr('fill-opacity', 0.6)
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .attr('pointer-events', 'auto')
        .style('--departure-ratio', d => stationFlow(d.departures / d.totalTraffic))
    .each(function(d) {
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

    const timeSlider   = document.getElementById('time-slider');
    const selectedTime = document.getElementById('selected-time');
    const anyTimeLabel = document.getElementById('any-time');

    function updateScatterPlot(filterVal) {
    if (filterVal === -1) {
        radiusScale.range([0, 25]);
    } else {
        radiusScale.range([3, 50]);
    }

    const filteredTrips    = filterTripsByTime(trips, filterVal);
    const filteredStations = computeStationTraffic(rawStations, filteredTrips);

    circles
        .data(filteredStations, d => d.short_name)
        .join('circle')
        .attr('r', d => radiusScale(d.totalTraffic))
        .style('--departure-ratio', d => stationFlow(d.departures / d.totalTraffic));
    }

    function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);

    if (timeFilter === -1) {
        selectedTime.textContent = '';
        anyTimeLabel.style.display = 'block';
    } else {
        selectedTime.textContent = formatTime(timeFilter);
        anyTimeLabel.style.display = 'none';
    }

    updateScatterPlot(timeFilter);
    }

    timeSlider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay();  
  } catch (err) {
    console.error('Station data load failed:', err);
  }
});