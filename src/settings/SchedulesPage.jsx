import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableRow,
  TableCell,
  TableHead,
  TableBody,
  TablePagination,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import { useEffectAsync } from '../reactHelper';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';
import CollectionFab from './components/CollectionFab';
import CollectionActions from './components/CollectionActions';
import TableShimmer from '../common/components/TableShimmer';
import SearchHeader, { filterByKeyword } from './components/SearchHeader';
import useSettingsStyles from './common/useSettingsStyles';
import fetchOrThrow from '../common/util/fetchOrThrow';
import dayjs from 'dayjs';

const SchedulesPage = () => {
  const { classes } = useSettingsStyles();
  const navigate = useNavigate();
  const t = useTranslation();
  const [timestamp, setTimestamp] = useState(Date.now());
  const [items, setItems] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  // pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [totalCount, setTotalCount] = useState(0);

  useEffectAsync(async () => {
    setLoading(true);
    try {
      const response = await fetchOrThrow(
        `/api/schedules/page?page=${page}&size=${rowsPerPage}`
      );
      const data = await response.json();

      const list = Array.isArray(data) ? data : data.content || [];

      const normalized = list.map((item) => ({
        ...item,
        name: item.scheduleName,
      }));

      setItems(normalized);

      setTotalCount(
        Array.isArray(data)
          ? data.length
          : data.totalElements || 0
      );
    } finally {
      setLoading(false);
    }
  }, [timestamp, page, rowsPerPage]);

  const actionConnections = {
    key: 'connections',
    title: t('sharedConnections'),
    icon: <LinkIcon fontSize="small" />,
    handler: (scheduleId) => navigate(`/settings/schedule/${scheduleId}/connections`),
  };

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'sharedSchedules']}
    >
      <SearchHeader
        keyword={searchKeyword}
        setKeyword={setSearchKeyword}
      />

      <Table className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell>{t('sharedName')}</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Start Time</TableCell>
            <TableCell>End Time</TableCell>
            <TableCell>Frequency</TableCell>
            <TableCell>Reversed</TableCell>
            <TableCell>Wait Time [min]</TableCell>
            <TableCell className={classes.columnAction}>
              Actions
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {!loading ? (
            items
              .filter(filterByKeyword(searchKeyword))
              .map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.description || '-'}</TableCell>

                  <TableCell>
                    {dayjs(item.startTime).format('HH:mm')}
                  </TableCell>

                  <TableCell>
                    {item.startTime && item.duration
                      ? dayjs(item.startTime)
                          .add(item.duration, 'second')
                          .format('HH:mm')
                      : '-'}
                  </TableCell>

                  <TableCell>{item.recurrence || '-'}</TableCell>


                  <TableCell>
                    {item.reversed ? 'Yes' : 'No'}
                  </TableCell>

                  <TableCell>
                    {Math.floor(item.waitTime)/60 || 0}
                  </TableCell>

                  <TableCell
                    className={classes.columnAction}
                    padding="none"
                  >
                    <CollectionActions
                      itemId={item.id}
                      editPath="/settings/schedule"
                      endpoint="schedules"
                      setTimestamp={setTimestamp}
                      customActions={[actionConnections]}
                    />
                  </TableCell>
                </TableRow>
              ))
          ) : (
            <TableShimmer columns={8} endAction />
           
          )}
        </TableBody>
      </Table>

      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={(e, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 20, 50]}
      />

      <CollectionFab editPath="/settings/schedule" />
    </PageLayout>
  );
};

export default SchedulesPage;