import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import maplibregl from 'maplibre-gl';
import { map } from './core/MapView';
import { geofenceToFeature } from './core/mapUtil';

const flattenCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates)) {
    return [];
  }

  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    return [coordinates];
  }

  return coordinates.flatMap((item) => flattenCoordinates(item));
};

const MapRouteGeofences = ({ selectedRouteId }) => {
  const id = 'route-geofences';
  const theme = useTheme();
  const geofences = useSelector((state) => state.geofences.items);

  useEffect(() => {
    map.addSource(id, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    map.addLayer({
      source: id,
      id: `${id}-line`,
      type: 'line',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity'],
      },
    });

    return () => {
      if (map.getLayer(`${id}-line`)) {
        map.removeLayer(`${id}-line`);
      }
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    };
  }, []);

  useEffect(() => {
    const routeId = selectedRouteId ? Number(selectedRouteId) : null;
    const routeGeofences = Object.values(geofences).filter((geofence) => !geofence.attributes?.isStop);

    map.getSource(id)?.setData({
      type: 'FeatureCollection',
      features: routeGeofences.map((geofence) => {
        const feature = geofenceToFeature(theme, geofence);
        const isSelected = routeId != null && Number(geofence.id) === routeId;
        return {
          ...feature,
          properties: {
            ...feature.properties,
            opacity: routeId == null ? 0.2 : (isSelected ? 1 : 0.1),
            width: routeId == null ? 2 : (isSelected ? 4 : 1),
          },
        };
      }),
    });

    if (routeId != null) {
      const selected = routeGeofences.find((geofence) => Number(geofence.id) === routeId);
      if (selected) {
        const feature = geofenceToFeature(theme, selected);
        const points = flattenCoordinates(feature.geometry.coordinates);
        if (points.length > 1) {
          const bounds = points.reduce(
            (acc, coord) => acc.extend(coord),
            new maplibregl.LngLatBounds(points[0], points[1]),
          );
          const canvas = map.getCanvas();
          map.fitBounds(bounds, { padding: Math.min(canvas.width, canvas.height) * 0.2 });
        }
      }
    }
  }, [geofences, selectedRouteId, theme]);

  return null;
};

export default MapRouteGeofences;
