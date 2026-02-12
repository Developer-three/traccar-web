import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
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
  OutlinedInput,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditItemView from './components/EditItemView';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import { prefixString } from '../common/util/stringUtils';
import { errorsActions, schedulesActions } from '../store';
import { useCatch } from '../reactHelper';
import useSettingsStyles from './common/useSettingsStyles';
import fetchOrThrow from '../common/util/fetchOrThrow';

const SchedulePage = () => {
  const { classes } = useSettingsStyles();
  const dispatch = useDispatch();
  const t = useTranslation();

  const [item, setItem] = useState();
  const geofences = useSelector((state) => state.geofences.items);

  const [uiDate, setUiDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [uiStartTime, setUiStartTime] = useState('00:00');
  const [uiEndTime, setUiEndTime] = useState('00:00');
  const [routeStops, setRouteStops] = useState([]);

  const onItemSaved = useCatch(async () => {
    const response = await fetchOrThrow('/api/schedules');
    dispatch(schedulesActions.refresh(await response.json()));
  });

  const validate = () => item && item.scheduleName && item.startTime && item.geofenceId;

  const buildUtcIso = (date, time) => dayjs(`${date}T${time}`).format('YYYY-MM-DDTHH:mm:ssZ');

  const calculateDuration = (startIso, endIso) => dayjs(endIso).diff(dayjs(startIso), 'second');

  const recomputeTime = (date, start, end) => {
    const baseDate = item.recurrence === 'ONCE' ? date : dayjs().format('YYYY-MM-DD');
    const startIso = buildUtcIso(baseDate, start);
    const endIso = buildUtcIso(baseDate, end);

    setItem((previous) => ({
      ...previous,
      startTime: startIso,
      duration: calculateDuration(startIso, endIso),
    }));
  };

  useEffect(() => {
    const fetchStops = async () => {
      if (!item?.geofenceId) {
        setRouteStops([]);
        return;
      }
      try {
        const response = await fetchOrThrow(`/api/stops?geofenceId=${item.geofenceId}`);
        const data = await response.json();
        setRouteStops(data);
      } catch (error) {
        dispatch(errorsActions.push(error.message));
      }
    };
    fetchStops();
  }, [dispatch, item?.geofenceId]);

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
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">{t('sharedRequired')}</Typography>
          </AccordionSummary>

          <AccordionDetails className={classes.details}>
            <TextField
              label={t('sharedName')}
              value={item.scheduleName}
              onChange={(event) => setItem({ ...item, scheduleName: event.target.value })}
            />

            <TextField
              label={t('sharedDescription')}
              value={item.description}
              onChange={(event) => setItem({ ...item, description: event.target.value })}
            />

            {item.recurrence === 'ONCE' && (
              <TextField
                type="date"
                label={t('sharedDate')}
                InputLabelProps={{ shrink: true }}
                value={uiDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setUiDate(value);
                  recomputeTime(value, uiStartTime, uiEndTime);
                }}
              />
            )}

            <TextField
              type="time"
              label={t('reportStartTime')}
              InputLabelProps={{ shrink: true }}
              value={uiStartTime}
              onChange={(event) => {
                const value = event.target.value;
                setUiStartTime(value);
                recomputeTime(uiDate, value, uiEndTime);
              }}
            />

            <TextField
              type="time"
              label={t('reportEndTime')}
              InputLabelProps={{ shrink: true }}
              value={uiEndTime}
              onChange={(event) => {
                const value = event.target.value;
                setUiEndTime(value);
                recomputeTime(uiDate, uiStartTime, value);
              }}
            />

            <FormControl>
              <InputLabel>{t('sharedRoute')}</InputLabel>
              <Select
                value={item.geofenceId || ''}
                label={t('sharedRoute')}
                onChange={(event) => setItem({ ...item, geofenceId: event.target.value, stopIds: [] })}
              >
                {Object.values(geofences).map((geofence) => (
                  <MenuItem key={geofence.id} value={geofence.id}>
                    {geofence.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <InputLabel>{t('sharedStops')}</InputLabel>
              <Select
                multiple
                value={item.stopIds || []}
                input={<OutlinedInput label={t('sharedStops')} />}
                renderValue={(selected) => routeStops
                  .filter((stop) => selected.includes(stop.id))
                  .map((stop) => stop.name)
                  .join(', ')}
                onChange={(event) => setItem({ ...item, stopIds: event.target.value })}
              >
                {routeStops.map((stop) => (
                  <MenuItem key={stop.id} value={stop.id}>{stop.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <InputLabel>{t('calendarRecurrence')}</InputLabel>
              <Select
                value={item.recurrence}
                label={t('calendarRecurrence')}
                onChange={(event) => setItem({ ...item, recurrence: event.target.value })}
              >
                {['ONCE', 'DAILY'].map((it) => (
                  <MenuItem key={it} value={it}>
                    {t(prefixString('calendar', it.toLowerCase()))}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              label={t('shareIsReversed')}
              control={(
                <Checkbox
                  checked={item.reversed}
                  onChange={(event) => setItem({ ...item, reversed: event.target.checked })}
                />
              )}
            />

            {item.reversed && (
              <TextField
                label={t('sharedWaitTime')}
                type="number"
                value={item.waitTime / 60}
                onChange={(event) => setItem({
                  ...item,
                  waitTime: Number(event.target.value) * 60,
                })}
              />
            )}
          </AccordionDetails>
        </Accordion>
      )}
    </EditItemView>
  );
};

export default SchedulePage;
