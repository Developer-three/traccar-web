import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import TextField from '@mui/material/TextField';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Chip,Box,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditItemView from './components/EditItemView';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import { prefixString } from '../common/util/stringUtils';
import { schedulesActions } from '../store';
import { useCatch,useCatchCallback } from '../reactHelper';
import useSettingsStyles from './common/useSettingsStyles';
import fetchOrThrow from '../common/util/fetchOrThrow';
import{useEffect} from 'react';


const SchedulePage = () => {
  const { classes } = useSettingsStyles();
  const dispatch = useDispatch();
  const t = useTranslation();
  // const gmtOffsetMinutes = 330;

  const [item, setItem] = useState();
  const geofences = useSelector((state) => state.geofences.items);

  const [uiDate, setUiDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [uiStartTime, setUiStartTime] = useState("00:00");
  const [uiEndTime, setUiEndTime] = useState('00:00');
  const[routeStops,setRouteStops] = useState([]);

   const routeItems = useMemo(() => {
  if (!geofences) return [];

  const list = Array.isArray(geofences)
    ? geofences
    : Object.values(geofences);

  return list.filter((g) => !g.attributes?.isStop);
}, [geofences]);


   const onItemSaved = useCatch(async () => {
    const response = await fetchOrThrow('/api/schedules');
    dispatch(schedulesActions.refresh(await response.json()));
    });

    const loadStops = useCatchCallback(async (routeId) => {
    if (!routeId) {
      setRouteStops([]);
      return;
    }

    const response = await fetchOrThrow('/api/stops');
    const allStops = await response.json();
    const mappedStops = allStops
      .map((stop) => ({
        ...stop,
        routeGeofenceId: stop.routeGeofenceId ?? stop.attributes?.routeGeofenceId,
        geofenceIds: stop.geofenceIds ?? stop.attributes?.geofenceIds,
      }))
      .filter((stop) => {
        const directMatch = Number(stop.routeGeofenceId) === Number(routeId);
        const linkedMatch = Array.isArray(stop.geofenceIds)
          && stop.geofenceIds.some((id) => Number(id) === Number(routeId));

        return directMatch || linkedMatch;
      });

    setRouteStops(mappedStops);
  }, [])

  useEffect(() => {
    if (!item) {
      return;
    }
     if (item.startTime) {
      const start = dayjs(item.startTime);
      const end = item.duration ? start.add(item.duration, 'second') : start;
      setUiDate(start.format('YYYY-MM-DD'));
      setUiStartTime(start.format('HH:mm'));
      setUiEndTime(end.format('HH:mm'));
    }
     if (item.attributes?.stopIds && !item.stopIds) {
      setItem({ ...item, stopIds: item.attributes.stopIds });
    }

    loadStops(item.geofenceId);
  }, [item?.id]);

    const validate = () => (
    item
    && item.scheduleName
    && item.startTime
    && item.geofenceId
    && Array.isArray(item.stopIds)
    && item.stopIds.length > 0
  );
  const buildUtcIso = (date, time) =>
    dayjs(`${date}T${time}`)
     .format('YYYY-MM-DDTHH:mm:ss+05:30');

  const calculateDuration = (startIso, endIso) =>
    dayjs(endIso).diff(dayjs(startIso), 'second');

  const todayDate = dayjs().format('YYYY-MM-DD');

  const recomputeTime = (date, start, end) => {
     if (!item) {
      return;
    }

  const baseDate = item.recurrence === 'ONCE' ? date : todayDate;
  const startIso = buildUtcIso(baseDate, start);
  const endIso = buildUtcIso(baseDate, end);

  setItem({
    ...item,
    startTime: startIso,
    duration: calculateDuration(startIso, endIso),
  });
};


  return (
    <EditItemView
      endpoint="schedules"
      item={item}
      setItem={setItem}
      defaultItem={{
        scheduleName: '',
        description: '',
        startTime: null,
        duration: 0,
        recurrence: 'DAILY',
        reversed: false,
        waitTime: 0,
        stopIds: [],
      }}
      validate={validate}
      onItemSaved={onItemSaved}
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'sharedSchedule']}
    >
      {item && (
        <>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">
                {t('sharedRequired')}
              </Typography>
            </AccordionSummary>

            <AccordionDetails className={classes.details}>
              {/* NAME */}
              <TextField
                label={t('sharedName')}
                value={item.scheduleName}
                onChange={(e) =>
                  setItem({ ...item, scheduleName: e.target.value })
                }
              />

              {/* DESCRIPTION */}
              <TextField
                label={t('sharedDescription')}
                value={item.description}
                onChange={(e) =>
                  setItem({ ...item, description: e.target.value })
                }
              />

              {/* DATE – ONLY ONCE */}
              {item.recurrence === 'ONCE' && (
                <TextField
                  type="date"
                  label="Date"
                  value={uiDate}
                    onChange={(e) => {
                    const value = e.target.value;
                    setUiDate(value);
                    recomputeTime(value, uiStartTime, uiEndTime);
                    }}
                 />
              )}

              {/* START TIME */}
              <TextField
                type="time"
                label="Start Time"
                value={uiStartTime}
                onChange={(e) => {
                  const value = e.target.value;
                  setUiStartTime(value);
                  recomputeTime(uiDate, value, uiEndTime);
                }}
              />

              <TextField
                type="time"
                label="End Time"
                value={uiEndTime}
                onChange={(e) => {
                  const value = e.target.value;
                  setUiEndTime(value);
                  recomputeTime(uiDate, uiStartTime, value);
                }}
              />


              {/* ROUTE */}
              <FormControl>
              <InputLabel>Route</InputLabel>
              <Select
                value={item.geofenceId || ''}
                label="Route"
                onChange={async (e) => {
                  const routeId = e.target.value;
                  loadStops(routeId);
                  setItem({
                    ...item,
                    geofenceId: routeId,
                    stopIds: [],
                    attributes: {
                      ...item.attributes,
                      stopIds: [],
                    },
                  });
                }}
              >
                {(routeItems||[]).map((route) => (
                  <MenuItem key={route.id} value={route.id}>{route.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <InputLabel>Stops</InputLabel>
              <Select
                multiple
                value={item.stopIds || []}
                label="Stops"
                onChange={(e) => {
                  const stopIds = e.target.value;
                  setItem({
                    ...item,
                    stopIds,
                    attributes: {
                      ...item.attributes,
                      stopIds,
                    },
                  });
                }}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((id) => (
                      <Chip key={id} label={routeStops.find((stop) => stop.id === id)?.name || id} size="small" />
                    ))}
                  </Box>
                )}
              >
                {routeStops.map((stop) => (
                  <MenuItem key={stop.id} value={stop.id}>{stop.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

              {/* RECURRENCE */}
              <FormControl>
                <InputLabel>{t('calendarRecurrence')}</InputLabel>
                <Select
                  value={item.recurrence}
                  onChange={(e) =>
                    setItem({ ...item, recurrence: e.target.value })
                  }
                >
                  {['ONCE', 'DAILY'].map((it) => (
                    <MenuItem key={it} value={it}>
                      {t(prefixString('calendar', it.toLowerCase()))}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* REVERSED */}
              <FormControlLabel
                label="Reversible Route?"
                control={
                  <Checkbox
                    checked={item.reversed}
                    onChange={(e) =>
                      setItem({ ...item, reversed: e.target.checked })
                    }
                  />
                }
              />

              {/* WAIT TIME (minutes → seconds) */}
              {item.reversed && (
                <TextField
                  label={t('sharedWaitTime')}
                  type="number"
                  value={item.waitTime / 60}
                  onChange={(e) =>
                    setItem({
                      ...item,
                      waitTime: Number(e.target.value) * 60,
                    })
                  }
                />
              )}
            </AccordionDetails>
          </Accordion>
        </>
      )}
    </EditItemView>
  );
};

export default SchedulePage;
