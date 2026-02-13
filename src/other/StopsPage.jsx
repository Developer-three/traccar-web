import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Divider, Typography, IconButton, Toolbar, Paper, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useNavigate } from 'react-router-dom';
import MapView from '../map/core/MapView';
import MapCurrentLocation from '../map/MapCurrentLocation';
import MapGeocoder from '../map/geocoder/MapGeocoder';
import MapScale from '../map/MapScale';
import BackIcon from '../common/components/BackIcon';
import { useTranslation } from '../common/components/LocalizationProvider';
import { errorsActions, geofencesActions } from '../store';
import { useCatchCallback } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import MapRouteGeofences from '../map/MapRouteGeofences';
import MapStopsEdit from '../map/draw/MapStopsEdit';
import StopsList from './StopsList';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    flexGrow: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'row',
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column-reverse',
    },
  },
  drawer: {
    display: 'flex',
    flexDirection: 'column',
    [theme.breakpoints.up('sm')]: {
      width: theme.dimensions.drawerWidthDesktop,
    },
    [theme.breakpoints.down('sm')]: {
      height: theme.dimensions.drawerHeightPhone,
    },
  },
  mapContainer: {
    flexGrow: 1,
  },
  title: {
    flexGrow: 1,
  },
  form: {
    padding: theme.spacing(2),
  },
}));

const StopsPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();

  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedStopId, setSelectedStopId] = useState();
  const [stops, setStops] = useState([]);

  const selectStopForEdit = (stopId) => {
    setSelectedStopId(undefined);
    window.requestAnimationFrame(() => setSelectedStopId(stopId));
  };

  const geofences = useSelector((state) => state.geofences.items);

  const refreshGeofences = useCatchCallback(async () => {
    const response = await fetchOrThrow('/api/geofences');
    dispatch(geofencesActions.refresh(await response.json()));
  }, [dispatch]);

  const refreshStops = useCatchCallback(async () => {
    try {
      const response = await fetchOrThrow('/api/stops');
      const data = await response.json();
      const list = Array.isArray(data) ? data : data.content || data.items || [];
      const normalizedStops = list.map((item) => ({
      ...item,
      routeGeofenceId: item.routeGeofenceId ?? item.attributes?.routeGeofenceId,
      geofenceIds: item.geofenceIds ?? item.attributes?.geofenceIds,
      attributes: {
        ...item.attributes,
        isStop: true,
      },
    }));
      setStops(normalizedStops);
    } catch (error) {
      dispatch(errorsActions.push(error.message));
    }
  }, [dispatch]);

  useEffect(() => {
    refreshGeofences();
    refreshStops();
  }, [refreshGeofences, refreshStops]);

   const renameStop = useCatchCallback(async (stop) => {
    const value = window.prompt(`${t('sharedName')}:`, stop.name ?? '');
    if (value === null) {
      return;
    }

    const name = value.trim();
    if (!name || name === stop.name) {
      return;
    }

    try {
      await fetchOrThrow(`/api/stops/${stop.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: stop.id,
          name,
          description: stop.description ?? null,
          area: stop.area,
          routeGeofenceId: stop.routeGeofenceId ?? stop.attributes?.routeGeofenceId,
          attributes: {
            ...stop.attributes,
            isStop: true,
            geofenceIds: stop.geofenceIds ?? stop.attributes?.geofenceIds ?? [],
          },
        }),
      });
      refreshStops();
    } catch (error) {
      dispatch(errorsActions.push(error.message));
    }
  }, [dispatch, refreshStops, t]);

  return (
    <div className={classes.root}>
      <div className={classes.content}>
        <Paper square className={classes.drawer}>
          <Toolbar>
            <IconButton edge="start" sx={{ mr: 2 }} onClick={() => navigate(-1)}>
              <BackIcon />
            </IconButton>
            <Typography variant="h6" className={classes.title}>{t('reportStops')}</Typography>
          </Toolbar>
          <Divider />
          <div className={classes.form}>
            <FormControl fullWidth>
              <InputLabel>Route</InputLabel>
              <Select
                value={selectedRouteId}
                label="Route"
                onChange={(event) => setSelectedRouteId(event.target.value)}
              >
                {Object.values(geofences)
                  .filter((item) => !item.attributes?.isStop)
                  .map((item) => (
                    <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
                  ))}
              </Select>
            </FormControl>
          </div>
          <Divider />
          <StopsList
            routeId={selectedRouteId}
            stops={stops}
            onStopSelected={selectStopForEdit}
            refreshStops={refreshStops}
          />
        </Paper>
        <div className={classes.mapContainer}>
          <MapView>
            <MapRouteGeofences selectedRouteId={selectedRouteId} />
            <MapStopsEdit
              selectedRouteId={selectedRouteId}
              selectedStopId={selectedStopId}
              onStopRenamed={renameStop}
              stops={stops}
              refreshStops={refreshStops}
            />
          </MapView>
          <MapScale />
          <MapCurrentLocation />
          <MapGeocoder />
        </div>
      </div>
    </div>
  );
};

export default StopsPage;
