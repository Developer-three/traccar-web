import { useState } from 'react';
import {
  Divider,
  Typography,
  IconButton,
  Toolbar,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MapView from '../map/core/MapView';
import MapCurrentLocation from '../map/MapCurrentLocation';
import StopsList from './StopsList';
import { useTranslation } from '../common/components/LocalizationProvider';
import MapGeocoder from '../map/geocoder/MapGeocoder';
import MapScale from '../map/MapScale';
import BackIcon from '../common/components/BackIcon';
import MapStopsEdit from '../map/draw/MapStopsEdit';

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
  routeSelect: {
    margin: theme.spacing(1),
  },
}));

const StopsPage = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const t = useTranslation();

  const geofences = useSelector((state) => state.geofences.items);

  const [selectedStopId, setSelectedStopId] = useState();
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [refreshToken, setRefreshToken] = useState(Date.now());

  return (
    <div className={classes.root}>
      <div className={classes.content}>
        <Paper square className={classes.drawer}>
          <Toolbar>
            <IconButton edge="start" sx={{ mr: 2 }} onClick={() => navigate(-1)}>
              <BackIcon />
            </IconButton>
            <Typography variant="h6" className={classes.title}>{t('sharedStops')}</Typography>
          </Toolbar>
          <Divider />
          <FormControl className={classes.routeSelect} size="small">
            <InputLabel>{t('sharedRoute')}</InputLabel>
            <Select
              value={selectedRouteId}
              label={t('sharedRoute')}
              onChange={(event) => setSelectedRouteId(event.target.value)}
            >
              <MenuItem value="">{t('sharedAll')}</MenuItem>
              {Object.values(geofences).map((geofence) => (
                <MenuItem key={geofence.id} value={geofence.id}>{geofence.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Divider />
          <StopsList
            onStopSelected={setSelectedStopId}
            routeId={selectedRouteId}
            refreshToken={refreshToken}
          />
        </Paper>
        <div className={classes.mapContainer}>
          <MapView>
            <MapStopsEdit
              selectedStopId={selectedStopId}
              selectedRouteId={selectedRouteId || null}
              refreshToken={refreshToken}
              setRefreshToken={setRefreshToken}
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
