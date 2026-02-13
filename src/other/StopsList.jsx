import {
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { useTranslation } from '../common/components/LocalizationProvider';
import CollectionActions from '../settings/components/CollectionActions';

const StopsList = ({
  routeId,
  stops,
  onStopSelected,
  refreshStops,
}) => {
  const t = useTranslation();

  return (
    <List>
      {stops
        .filter((stop) => {
          if (!routeId) {
            return true;
          }

          const directMatch = Number(stop.routeGeofenceId) === Number(routeId);
          const linkedMatch = Array.isArray(stop.geofenceIds)
            && stop.geofenceIds.some((id) => Number(id) === Number(routeId));

          return directMatch || linkedMatch;
        })
        .map((stop) => (
          <ListItemButton key={stop.id} onClick={() => onStopSelected(stop.id)}>
            <ListItemText primary={stop.name} secondary={`ID: ${stop.id}`} />
            <div onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
              <CollectionActions
                itemId={stop.id}
                endpoint="stops"
                setTimestamp={() => refreshStops()}
                customActions={[
                  {
                    key: 'editOnMap',
                    title: t('sharedEdit'),
                    icon: <EditIcon fontSize="small" />,
                    handler: () => onStopSelected(stop.id),
                  },
                ]}
              />
            </div>
          </ListItemButton>
        ))}
    </List>
  );
};

export default StopsList;
