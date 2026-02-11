import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Container,
  Button,
  Stack,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import PageLayout from '../common/components/PageLayout';
import useSettingsStyles from './common/useSettingsStyles';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { useEffectAsync } from '../reactHelper';

/* =========================
   API CALLS
========================= */

const linkScheduleToDevice = async (scheduleId, deviceId) => {
  return fetchOrThrow('/api/permissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduleId, deviceId }),
  });
};

const linkDeviceToSchedule = async (deviceId, scheduleId) => {
  return fetchOrThrow('/api/permissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, scheduleId }),
  });
};

const linkDeviceToGeofence = async (deviceId, geofenceId) => {
  return fetchOrThrow('/api/permissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, geofenceId }),
  });
};

const unlinkScheduleFromDevice = async (scheduleId, deviceId) => {
  return fetchOrThrow('/api/permissions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduleId, deviceId }),
  });
};

const ScheduleConnectionsPage = () => {
  const { classes } = useSettingsStyles();
  const t = useTranslation();
  const { id: scheduleId } = useParams();

  const [devices, setDevices] = useState([]);
  const [linkedDeviceIds, setLinkedDeviceIds] = useState(new Set());
  const [geofenceId, setGeofenceId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);

  /* =========================
     FETCH DEVICES + LINKED + SCHEDULE
  ========================= */
  useEffectAsync(async () => {
    const [devicesRes, linkedRes, scheduleRes] = await Promise.all([
      fetchOrThrow('/api/devices'),
      fetchOrThrow(`/api/devices?scheduleId=${scheduleId}`),
      fetchOrThrow(`/api/schedules/${scheduleId}`),
    ]);

    const devicesData = await devicesRes.json();
    const linkedDevices = await linkedRes.json();
    const scheduleData = await scheduleRes.json();

    setDevices(devicesData);
    setGeofenceId(scheduleData.geofenceId);

    // linked device ids
    setLinkedDeviceIds(
      new Set(linkedDevices.map((d) => d.id))
    );
  }, [scheduleId]);

  const handleLink = async (deviceId) => {
    if (!geofenceId) return;

    try {
      setLoadingId(deviceId);

      await linkScheduleToDevice(scheduleId, deviceId);
      await linkDeviceToGeofence(deviceId, geofenceId);
    //   await linkDeviceToSchedule(deviceId, scheduleId);

      setLinkedDeviceIds((prev) => {
        const next = new Set(prev);
        next.add(deviceId);
        return next;
      });
    } finally {
      setLoadingId(null);
    }
  };


  const handleUnlink = async (deviceId) => {
    try {
      setLoadingId(deviceId);

      await unlinkScheduleFromDevice(scheduleId, deviceId);

      setLinkedDeviceIds((prev) => {
        const next = new Set(prev);
        next.delete(deviceId);
        return next;
      });
    } finally {
      setLoadingId(null);
    }
  };

  /* =========================
     UI
  ========================= */
  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={[
        'settingsTitle',
        'sharedSchedule',
        'sharedConnections',
      ]}
    >
      <Container maxWidth="sm" className={classes.container}>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              {t('sharedConnections')}
            </Typography>
          </AccordionSummary>

          <AccordionDetails className={classes.details}>
            <Stack spacing={2}>
              {devices.map((device) => {
                const isLinked = linkedDeviceIds.has(device.id);

                return (
                  <Button
                    key={device.id}
                    variant={isLinked ? 'contained' : 'outlined'}
                    color={isLinked ? 'success' : 'primary'}
                    disabled={loadingId === device.id}
                    onClick={() =>
                      isLinked
                        ? handleUnlink(device.id)
                        : handleLink(device.id)
                    }
                  >
                    {device.name} — {isLinked ? 'Unlink' : 'Link'}
                  </Button>
                );
              })}
            </Stack>
          </AccordionDetails>
        </Accordion>
      </Container>
    </PageLayout>
  );
};

export default ScheduleConnectionsPage;
