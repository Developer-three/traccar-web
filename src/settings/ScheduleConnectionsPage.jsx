import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Container,
  Button,
  Stack,
  Box,
  Chip,
  Paper,
  CircularProgress,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DevicesIcon from "@mui/icons-material/Devices";
import { useTranslation } from "../common/components/LocalizationProvider";
import SettingsMenu from "./components/SettingsMenu";
import PageLayout from "../common/components/PageLayout";
import useSettingsStyles from "./common/useSettingsStyles";
import fetchOrThrow from "../common/util/fetchOrThrow";
import { useEffectAsync } from "../reactHelper";
import SearchIcon from "@mui/icons-material/Search";
import { TextField, InputAdornment } from "@mui/material";

const ScheduleConnectionPage = () => {
  const { classes } = useSettingsStyles();
  const t = useTranslation();

  const { id: scheduleId } = useParams();
  const [devices, setDevices] = useState([]);
  const [linkedDeviceIds, setLinkedDeviceIds] = useState(new Set());
  const [geofenceId, setGeofenceId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [pendingScheduleLinks, setPendingScheduleLinks] = useState(new Set());
  const [pendingScheduleUnlinks, setPendingScheduleUnlinks] = useState(
    new Set(),
  );
  const [pendingGeofenceLinks, setPendingGeofenceLinks] = useState(new Set());
  const [pendingGeofenceUnlinks, setPendingGeofenceUnlinks] = useState(
    new Set(),
  );
  const [search, setSearch] = useState("");

  useEffectAsync(async () => {
    const [deviceRes, linkedRes, scheduleRes] = await Promise.all([
      fetchOrThrow(`/api/devices`),
      fetchOrThrow(`/api/devices?scheduleId=${scheduleId}`),
      fetchOrThrow(`/api/schedules/${scheduleId}`),
    ]);

    const deviceData = await deviceRes.json();
    const linkedDevices = await linkedRes.json();
    const scheduleData = await scheduleRes.json();
    setDevices(deviceData);
    setGeofenceId(scheduleData.geofenceId);
    setLinkedDeviceIds(new Set(linkedDevices.map((d) => d.id)));
  }, [scheduleId]);

  // const handleToggle = (deviceId) => {
  //   const isOriginallyLinked = linkedDeviceIds.has(deviceId);
  //   if (isOriginallyLinked) {
  //     setPendingScheduleUnlinks((prev) => new Set(prev).add(deviceId));
  //     setPendingGeofenceUnlinks((prev) => new Set(prev).add(deviceId));

  //     setPendingScheduleLinks((prev) => {
  //       const next = new Set(prev);
  //       next.delete(deviceId);
  //       return next;
  //     });

  //     setPendingGeofenceLinks((prev) => {
  //       const next = new Set(prev);
  //       next.delete(deviceId);
  //       return next;
  //     });
  //   } else {
  //     setPendingScheduleLinks((prev) => new Set(prev).add(deviceId));
  //     setPendingGeofenceLinks((prev) => new Set(prev).add(deviceId));

  //     setPendingScheduleUnlinks((prev) => {
  //       const next = new Set(prev);
  //       next.delete(deviceId);
  //       return next;
  //     });

  //     setPendingGeofenceUnlinks((prev) => {
  //       const next = new Set(prev);
  //       next.delete(deviceId);
  //       return next;
  //     });
  //   }
  // };

  const handleToggle = (deviceId) => {

  // Step 1: Determine CURRENT UI state
  let isCurrentlyLinked = linkedDeviceIds.has(deviceId);

  if (pendingScheduleLinks.has(deviceId)) {
    isCurrentlyLinked = true;
  }

  if (pendingScheduleUnlinks.has(deviceId)) {
    isCurrentlyLinked = false;
  }

  // Step 2: Toggle correctly
  if (isCurrentlyLinked) {
    // Mark for unlink
    setPendingScheduleUnlinks((prev) => {
      const next = new Set(prev);
      next.add(deviceId);
      return next;
    });

    setPendingScheduleLinks((prev) => {
      const next = new Set(prev);
      next.delete(deviceId);
      return next;
    });

    setPendingGeofenceUnlinks((prev) => {
      const next = new Set(prev);
      next.add(deviceId);
      return next;
    });

    setPendingGeofenceLinks((prev) => {
      const next = new Set(prev);
      next.delete(deviceId);
      return next;
    });

  } else {
    // Mark for link
    setPendingScheduleLinks((prev) => {
      const next = new Set(prev);
      next.add(deviceId);
      return next;
    });

    setPendingScheduleUnlinks((prev) => {
      const next = new Set(prev);
      next.delete(deviceId);
      return next;
    });

    setPendingGeofenceLinks((prev) => {
      const next = new Set(prev);
      next.add(deviceId);
      return next;
    });

    setPendingGeofenceUnlinks((prev) => {
      const next = new Set(prev);
      next.delete(deviceId);
      return next;
    });
  }
};

  const filteredDevices = devices.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSave = async () => {
    if (!geofenceId) return;

    const scheduleLinkList = Array.from(pendingScheduleLinks).map(
      (deviceId) => ({ scheduleId, deviceId }),
    );
    const scheduleUnlinkList = Array.from(pendingScheduleUnlinks).map(
      (deviceId) => ({ scheduleId, deviceId }),
    );
    const geofenceLinkList = Array.from(pendingGeofenceLinks).map(
      (deviceId) => ({ deviceId, geofenceId }),
    );
    const geofenceUnlinkList = Array.from(pendingGeofenceUnlinks).map(
      (deviceId) => ({ deviceId, geofenceId }),
    );

    try {
      setLoading(true);
      if (scheduleLinkList.length > 0) {
        await fetchOrThrow(`/api/permissions/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scheduleLinkList),
        });
      }
      if (scheduleUnlinkList.length > 0) {
        await fetchOrThrow(`/api/permissions/bulk`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scheduleUnlinkList),
        });
      }
      if (geofenceLinkList.length > 0) {
        await fetchOrThrow(`/api/permissions/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geofenceLinkList),
        });
      }
      if (geofenceUnlinkList.length > 0) {
        await fetchOrThrow(`/api/permissions/bulk`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geofenceUnlinkList),
        });
      }
      setLinkedDeviceIds((prev) => {
        const next = new Set(prev);
        pendingScheduleLinks.forEach((id) => next.add(id));
        pendingScheduleUnlinks.forEach((id) => next.delete(id));
        return next;
      });
      setPendingScheduleLinks(new Set());
      setPendingScheduleUnlinks(new Set());
      setPendingGeofenceLinks(new Set());
      setPendingGeofenceUnlinks(new Set());
    } finally {
      setLoading(false);
    }
  };
  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={["settingsTitle", "sharedSchedule", "sharedConnections"]}
    >
      <Container maxWidth="md" className={classes.container}>
        <Accordion defaultExpanded sx={{ borderRadius: 3, boxShadow: 3 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              <DevicesIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>
                {t("sharedConnections")}
              </Typography>
            </Box>
          </AccordionSummary>

          <AccordionDetails>
           
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
              gap={2}
              flexWrap="wrap"
            >
              <TextField
                size="small"
                placeholder="Search devices"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ minWidth: 500 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                variant="contained"
                color="primary"
                disabled={
                  pendingScheduleLinks.size === 0 &&
                  pendingScheduleUnlinks.size === 0
                }
                onClick={handleSave}
                sx={{ minWidth: 150 }}
              >
                {loading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  "Save Changes"
                )}
              </Button>
            </Box>

            <Stack spacing={2}>
              {filteredDevices.map((device) => {
                let isLinked = linkedDeviceIds.has(device.id);

                if (pendingScheduleLinks.has(device.id)) {
                  isLinked = true;
                }

                if (pendingScheduleUnlinks.has(device.id)) {
                  isLinked = false;
                }

                return (
                  <Paper
                    key={device.id}
                    elevation={1}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "0.2s",
                      "&:hover": { boxShadow: 4 },
                    }}
                  >
                    <Box>
                      <Typography fontWeight={600}>{device.name}</Typography>
                      <Chip
                        size="small"
                        label={isLinked ? "Linked" : "Not Linked"}
                        color={isLinked ? "success" : "default"}
                        sx={{ mt: 1 }}
                      />
                    </Box>

                    <Button
                      variant={isLinked ? "contained" : "outlined"}
                      color={isLinked ? "error" : "primary"}
                      onClick={() => handleToggle(device.id)}
                      sx={{ minWidth: 120 }}
                    >
                      {isLinked ? "Unlink" : "Link"}
                    </Button>
                  </Paper>
                );
              })}
              {filteredDevices.length === 0 && (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      textAlign: 'center',
                      borderRadius: 2,
                    }}
                  >
                    <Typography color="text.secondary">
                      No devices found
                    </Typography>
                  </Paper>
                )}

            </Stack>
          </AccordionDetails>
        </Accordion>
      </Container>
    </PageLayout>
  );
};
export default ScheduleConnectionPage;
