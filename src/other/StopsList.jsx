import { Fragment, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import {
  Divider, List, ListItemButton, ListItemText,
} from '@mui/material';

import { useEffectAsync } from '../reactHelper';
import CollectionActions from '../settings/components/CollectionActions';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { errorsActions } from '../store';

const useStyles = makeStyles()(() => ({
  list: {
    flexGrow: 1,
    overflow: 'auto',
  },
}));

const StopsList = ({ onStopSelected, routeId, refreshToken }) => {
  const { classes } = useStyles();
  const dispatch = useDispatch();

  const geofences = useSelector((state) => state.geofences.items);

  const [items, setItems] = useState([]);
  const [timestamp, setTimestamp] = useState(Date.now());

  useEffectAsync(async () => {
    try {
      const query = new URLSearchParams();
      if (routeId) {
        query.set('geofenceId', routeId);
      }
      const response = await fetchOrThrow(`/api/stops${query.toString() ? `?${query.toString()}` : ''}`);
      setItems(await response.json());
    } catch (error) {
      dispatch(errorsActions.push(error.message));
    }
  }, [dispatch, routeId, timestamp, refreshToken]);

  return (
    <List className={classes.list}>
      {items.map((item, index) => (
        <Fragment key={item.id}>
          <ListItemButton onClick={() => onStopSelected(item.id)}>
            <ListItemText
              primary={item.name}
              secondary={geofences[item.geofenceId]?.name || item.description}
            />
            <CollectionActions itemId={item.id} editPath="/settings/stop" endpoint="stops" setTimestamp={setTimestamp} />
          </ListItemButton>
          {index < items.length - 1 ? <Divider /> : null}
        </Fragment>
      ))}
    </List>
  );
};

export default StopsList;
