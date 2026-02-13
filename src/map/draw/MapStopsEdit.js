import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import { map } from '../core/MapView';
import { geofenceToFeature, geometryToArea } from '../core/mapUtil';
import { errorsActions } from '../../store';
import drawTheme from './theme';
import fetchOrThrow from '../../common/util/fetchOrThrow';

MapboxDraw.constants.classes.CONTROL_BASE = 'maplibregl-ctrl';
MapboxDraw.constants.classes.CONTROL_PREFIX = 'maplibregl-ctrl-';
MapboxDraw.constants.classes.CONTROL_GROUP = 'maplibregl-ctrl-group';

const flattenCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates)) {
    return [];
  }
  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    return [coordinates];
  }
  return coordinates.flatMap((item) => flattenCoordinates(item));
};

const toSegments = (geometry) => {
  if (!geometry) {
    return [];
  }
  if (geometry.type === 'LineString') {
    return geometry.coordinates.slice(1).map((point, index) => [geometry.coordinates[index], point]);
  }
  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates.flatMap((line) => line.slice(1).map((point, index) => [line[index], point]));
  }
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.flatMap((ring) => ring.slice(1).map((point, index) => [ring[index], point]));
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flatMap((polygon) => polygon.flatMap((ring) => ring.slice(1).map((point, index) => [ring[index], point])));
  }
  return [];
};

const pointOnSegment = (point, start, end, epsilon = 1e-9) => {
  const [px, py] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;

  const cross = (py - y1) * (x2 - x1) - (px - x1) * (y2 - y1);
  if (Math.abs(cross) > epsilon) {
    return false;
  }

  const dot = (px - x1) * (px - x2) + (py - y1) * (py - y2);
  return dot <= epsilon;
};

const isPointInRing = (point, ring) => {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];

    if (pointOnSegment(point, a, b)) {
      return true;
    }

    const intersects = ((a[1] > point[1]) !== (b[1] > point[1]))
      && (point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]);

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const isPointInPolygon = (point, polygonCoordinates) => {
  if (!polygonCoordinates?.length) {
    return false;
  }

  const [outer, ...holes] = polygonCoordinates;

  if (!isPointInRing(point, outer)) {
    return false;
  }

  return !holes.some((hole) => isPointInRing(point, hole));
};

const orientation = (a, b, c) => {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < 1e-12) {
    return 0;
  }
  return value > 0 ? 1 : 2;
};

const segmentsIntersect = (segmentA, segmentB) => {
  const [p1, q1] = segmentA;
  const [p2, q2] = segmentB;

  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  return pointOnSegment(p2, p1, q1)
    || pointOnSegment(q2, p1, q1)
    || pointOnSegment(p1, p2, q2)
    || pointOnSegment(q1, p2, q2);
};

const isStopInsideOrOnRoute = (stopGeometry, routeGeometry) => {
  if (!stopGeometry || !routeGeometry) {
    return false;
  }

  const stopPoints = flattenCoordinates(stopGeometry.coordinates);
  const stopSegments = toSegments(stopGeometry);
  const routeSegments = toSegments(routeGeometry);

  if (!stopPoints.length) {
    return false;
  }

  if (routeGeometry.type === 'Polygon') {
    const insideOrOn = stopPoints.every((point) => isPointInPolygon(point, routeGeometry.coordinates));
    if (insideOrOn) {
      return true;
    }
  }

  if (routeGeometry.type === 'MultiPolygon') {
    const insideAny = stopPoints.every((point) => routeGeometry.coordinates
      .some((polygonCoordinates) => isPointInPolygon(point, polygonCoordinates)));
    if (insideAny) {
      return true;
    }
  }

  return stopSegments.some((stopSegment) => routeSegments.some((routeSegment) => segmentsIntersect(stopSegment, routeSegment)));
};

const normalizeStop = (item) => ({
  ...item,
  attributes: {
    ...item.attributes,
    isStop: true,
    routeGeofenceId: item.routeGeofenceId ?? item.attributes?.routeGeofenceId,
    geofenceIds: item.geofenceIds ?? item.attributes?.geofenceIds,
  },
});

const MapStopsEdit = ({ selectedRouteId, selectedStopId, stops, refreshStops }) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const draw = useMemo(() => new MapboxDraw({
    displayControlsDefault: false,
    controls: {
      polygon: true,
      trash: true,
    },
    userProperties: true,
    styles: drawTheme,
  }), []);

  const geofences = useSelector((state) => state.geofences.items);

  useEffect(() => {
    map.addControl(draw, theme.direction === 'rtl' ? 'top-right' : 'top-left');
    return () => map.removeControl(draw);
  }, [draw, theme.direction]);

  useEffect(() => {
    const listener = async (event) => {
      const feature = event.features[0];
      draw.delete(feature.id);

      if (!selectedRouteId) {
        dispatch(errorsActions.push('Please select a route before creating a stop'));
        return;
      }

      const selectedRoute = Object.values(geofences).find((geofence) => Number(geofence.id) === Number(selectedRouteId));
      const selectedRouteGeometry = selectedRoute ? geofenceToFeature(theme, selectedRoute).geometry : null;

      if (!isStopInsideOrOnRoute(feature.geometry, selectedRouteGeometry)) {
        dispatch(errorsActions.push('Stop must be inside or on the selected route geofence'));
        return;
      }

      const mappedGeofenceIds = Object.values(geofences)
        .filter((geofence) => !geofence.attributes?.isStop)
        .filter((geofence) => isStopInsideOrOnRoute(feature.geometry, geofenceToFeature(theme, geofence).geometry))
        .map((geofence) => geofence.id);

      const selectedRouteNumericId = Number(selectedRouteId);
      const geofenceIds = mappedGeofenceIds.includes(selectedRouteNumericId)
        ? mappedGeofenceIds
        : [selectedRouteNumericId, ...mappedGeofenceIds];

      try {
        await fetchOrThrow('/api/stops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Stop',
            area: geometryToArea(feature.geometry),
            attributes: {
              isStop: true,
              geofenceIds,
            },
            routeGeofenceId: selectedRouteNumericId,
          }),
        }); 
        refreshStops();
      } catch (error) {
        dispatch(errorsActions.push(error.message));
      }
    };

    map.on('draw.create', listener);
    return () => map.off('draw.create', listener);
  }, [dispatch, draw, geofences, refreshStops, selectedRouteId, theme]);

  useEffect(() => {
    const listener = async (event) => {
      const feature = event.features[0];
      try {
        await fetchOrThrow(`/api/stops/${feature.id}`, { method: 'DELETE' });
        refreshStops();
      } catch (error) {
        dispatch(errorsActions.push(error.message));
      }
    };

    map.on('draw.delete', listener);
    return () => map.off('draw.delete', listener);
  }, [dispatch, refreshStops]);

  useEffect(() => {
    const listener = async (event) => {
      const feature = event.features[0];
      const stop = stops.find((item) => Number(item.id) === Number(feature.id));
      if (!stop) {
        return;
      }

       try {
      await fetchOrThrow(`/api/stops/${feature.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: stop.id,
          name: stop.name,
          description: stop.description ?? null,
          area: geometryToArea(feature.geometry),
          routeGeofenceId: stop.routeGeofenceId ?? stop.attributes?.routeGeofenceId,
          attributes: {
            isStop: true,
            geofenceIds: stop.attributes?.geofenceIds ?? [],
          },
        }),
      });
        refreshStops();
      } catch (error) {
        dispatch(errorsActions.push(error.message));
      }
    };

    map.on('draw.update', listener);
    return () => map.off('draw.update', listener);
  }, [dispatch, refreshStops, stops]);

  useEffect(() => {
    draw.deleteAll();
    stops
      .map(normalizeStop)
      .filter((stop) => {
        if (!selectedRouteId) {
          return true;
        }

        const directMatch = Number(stop.attributes?.routeGeofenceId) === Number(selectedRouteId);
        const linkedMatch = Array.isArray(stop.attributes?.geofenceIds)
          && stop.attributes.geofenceIds.some((id) => Number(id) === Number(selectedRouteId));

        return directMatch || linkedMatch;
      })
      .forEach((stop) => {
        const feature=geofenceToFeature(theme, stop);
        feature.id = String(stop.id);
        draw.add(feature);
      });
  }, [draw, selectedRouteId, stops, theme]);

  useEffect(() => {
    if (selectedStopId) {
      draw.changeMode('simple_select', { featureIds: [String(selectedStopId)] });
    }
  }, [draw, selectedStopId]);

  return null;
};

export default MapStopsEdit;
