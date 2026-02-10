import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Container,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LinkField from '../common/components/LinkField';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import PageLayout from '../common/components/PageLayout';
import useSettingsStyles from './common/useSettingsStyles';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { useEffectAsync } from '../reactHelper';

const ScheduleConnectionsPage = () => {
  const { classes } = useSettingsStyles();
  const t = useTranslation();

  const { id } = useParams();

  const [linkedDevices, setLinkedDevices] = useState([]);
  const [linkedGeofences, setLinkedGeofences] = useState([]);
  const [syncedPairs, setSyncedPairs] = useState(new Set());

  useEffectAsync(async () => {
    const [devicesResponse, geofencesResponse] = await Promise.all([
      fetchOrThrow(`/api/devices?scheduleId=${id}`),
      fetchOrThrow(`/api/geofences?scheduleId=${id}`),
    ]);

    setLinkedDevices(await devicesResponse.json());
    setLinkedGeofences(await geofencesResponse.json());
  }, [id]);

  useEffectAsync(async () => {
    if (!linkedDevices.length || !linkedGeofences.length) {
      return;
    }

    const tasks = [];
    const newPairs = [];

    linkedDevices.forEach((device) => {
      linkedGeofences.forEach((geofence) => {
        const pairKey = `${device.id}:${geofence.id}`;
        if (!syncedPairs.has(pairKey)) {
          tasks.push(fetchOrThrow('/api/permissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId: device.id,
              geofenceId: geofence.id,
            }),
          }));
          newPairs.push(pairKey);
        }
      });
    });

    if (!tasks.length) {
      return;
    }

    await Promise.all(tasks);

    setSyncedPairs((previous) => {
      const next = new Set(previous);
      newPairs.forEach((pairKey) => next.add(pairKey));
      return next;
    });
  }, [linkedDevices, linkedGeofences, syncedPairs]);

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'sharedSchedule', 'sharedConnections']}
    >
      <Container maxWidth="xs" className={classes.container}>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              {t('sharedConnections')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails className={classes.details}>
            <LinkField
              endpointAll="/api/devices"
              endpointLinked={`/api/devices?scheduleId=${id}`}
              baseId={id}
              keyBase="scheduleId"
              keyLink="deviceId"
              label={t('sharedDevice')}
            />
            <LinkField
              endpointAll="/api/geofences"
              endpointLinked={`/api/geofences?scheduleId=${id}`}
              baseId={id}
              keyBase="scheduleId"
              keyLink="geofenceId"
              label={t('sharedGeofences')}
            />
          </AccordionDetails>
        </Accordion>
      </Container>
    </PageLayout>
  );
};

export default ScheduleConnectionsPage;
