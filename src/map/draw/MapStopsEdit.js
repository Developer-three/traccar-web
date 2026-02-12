import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useEffect, useMemo, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { map } from '../core/MapView';
import {
  findFonts, geofenceToFeature, geometryToArea,
} from '../core/mapUtil';
import { errorsActions } from '../../store';
import drawTheme from './theme';
import { useTranslation } from '../../common/components/LocalizationProvider';
import fetchOrThrow from '../../common/util/fetchOrThrow';

MapboxDraw.constants.classes.CONTROL_BASE = 'maplibregl-ctrl';
MapboxDraw.constants.classes.CONTROL_PREFIX = 'maplibregl-ctrl-';
MapboxDraw.constants.classes.CONTROL_GROUP = 'maplibregl-ctrl-group';

const stopToFeature = (theme, stop) => ({
  id: stop.id,
  type: 'Feature',
  geometry: geofenceToFeature(theme, { ...stop, attributes: stop.attributes || {} }).geometry,
  properties: {
    user_name: stop.name,
  },
});

const MapStopsEdit = ({ selectedStopId, selectedRouteId, refreshToken, setRefreshToken }) => {
  const sourceId = useMemo(() => `stops-geofence-${Math.random().toString(36).slice(2, 9)}`, []);
  const geofenceLayerId = `${sourceId}-line`;

  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();

  const draw = useMemo(() => new MapboxDraw({
    displayControlsDefault: false,
    controls: {
      polygon: true,
      trash: true,
    },
    userProperties: true,
    styles: [...drawTheme, {
      id: 'gl-draw-title',
      type: 'symbol',
      filter: ['all'],
      layout: {
        'text-field': '{user_name}',
        'text-font': findFonts(map),
        'text-size': 12,
      },
      paint: {
        'text-halo-color': 'white',
        'text-halo-width': 1,
      },
    }],
  }), []);

  const geofences = useSelector((state) => state.geofences.items);
  const [stops, setStops] = useState([]);

  useEffect(() => {
    map.addControl(draw, theme.direction === 'rtl' ? 'top-right' : 'top-left');
    return () => map.removeControl(draw);
  }, [draw, theme.direction]);

  useEffect(() => {
    const loadStops = async () => {
      try {
        const query = new URLSearchParams();
        if (selectedRouteId) {
          query.set('geofenceId', selectedRouteId);
        }
        const response = await fetchOrThrow(`/api/stops${query.toString() ? `?${query.toString()}` : ''}`);
        const data = await response.json();
        setStops(data);
      } catch (error) {
        dispatch(errorsActions.push(error.message));
      }
    };
    loadStops();
  }, [dispatch, selectedRouteId, refreshToken]);

  useEffect(() => {
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });
      map.addLayer({
        id: geofenceLayerId,
        source: sourceId,
        type: 'line',
        paint: {
          'line-color': '#607d8b',
          'line-width': 2,
          'line-opacity': 0.25,
        },
      });
    }

    return () => {
      if (map.getLayer(geofenceLayerId)) {
        map.removeLayer(geofenceLayerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    };
  }, [geofenceLayerId, sourceId]);

  useEffect(() => {
    const features = Object.values(geofences).map((geofence) => geofenceToFeature(theme, geofence));
    map.getSource(sourceId)?.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [geofences, sourceId, theme]);

  useEffect(() => {
    const listener = async (event) => {
      const feature = event.features[0];
      const newItem = {
        name: t('sharedStop'),
        area: geometryToArea(feature.geometry),
        geofenceId: selectedRouteId || null,
        routeId: selectedRouteId || null,
      };
      draw.delete(feature.id);
      try {
        const response = await fetchOrThrow('/api/stops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem),
        });
        const item = await response.json();
        setRefreshToken(Date.now());
        navigate(`/settings/stop/${item.id}`);
      } catch (error) {
        dispatch(errorsActions.push(error.message));
      }
    };

    map.on('draw.create', listener);
    return () => map.off('draw.create', listener);
  }, [dispatch, draw, navigate, selectedRouteId, setRefreshToken, t]);

  useEffect(() => {
    const listener = async (event) => {
      const feature = event.features[0];
      try {
        await fetchOrThrow(`/api/stops/${feature.id}`, { method: 'DELETE' });
        setRefreshToken(Date.now());
      } catch (error) {
        dispatch(errorsActions.push(error.message));
      }
    };

    map.on('draw.delete', listener);
    return () => map.off('draw.delete', listener);
  }, [dispatch, setRefreshToken]);

  useEffect(() => {
    draw.deleteAll();
    stops.forEach((stop) => {
      draw.add(stopToFeature(theme, stop));
    });
  }, [draw, stops, theme]);

  useEffect(() => {
    if (selectedStopId) {
      const feature = draw.get(selectedStopId);
      if (!feature) {
        return;
      }
      let { coordinates } = feature.geometry;
      if (Array.isArray(coordinates[0][0])) {
        [coordinates] = coordinates;
      }
      const bounds = coordinates.reduce(
        (accumulator, coordinate) => accumulator.extend(coordinate),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[1]),
      );
      const canvas = map.getCanvas();
      map.fitBounds(bounds, { padding: Math.min(canvas.width, canvas.height) * 0.1 });
    }
  }, [draw, selectedStopId]);

  return null;
};

export default MapStopsEdit;
