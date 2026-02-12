import { useState } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useSelector } from 'react-redux';
import EditItemView from './components/EditItemView';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import useSettingsStyles from './common/useSettingsStyles';

const StopPage = () => {
  const { classes } = useSettingsStyles();
  const t = useTranslation();

  const geofences = useSelector((state) => state.geofences.items);

  const [item, setItem] = useState();

  const validate = () => item && item.name;

  return (
    <EditItemView
      endpoint="stops"
      item={item}
      setItem={setItem}
      validate={validate}
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'sharedStop']}
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
              <TextField
                value={item.name || ''}
                onChange={(event) => setItem({ ...item, name: event.target.value })}
                label={t('sharedName')}
              />
              <FormControl>
                <InputLabel>{t('sharedRoute')}</InputLabel>
                <Select
                  value={item.geofenceId || ''}
                  label={t('sharedRoute')}
                  onChange={(event) => {
                    const geofenceId = Number(event.target.value);
                    setItem({
                      ...item,
                      geofenceId,
                      routeId: geofenceId,
                    });
                  }}
                >
                  {Object.values(geofences).map((geofence) => (
                    <MenuItem key={geofence.id} value={geofence.id}>{geofence.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">
                {t('sharedExtra')}
              </Typography>
            </AccordionSummary>
            <AccordionDetails className={classes.details}>
              <TextField
                value={item.description || ''}
                onChange={(event) => setItem({ ...item, description: event.target.value })}
                label={t('sharedDescription')}
              />
            </AccordionDetails>
          </Accordion>
        </>
      )}
    </EditItemView>
  );
};

export default StopPage;
