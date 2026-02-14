import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import { Skeleton, TableSkeleton } from '../ui/Skeleton';

export const DashboardSkeleton = () => {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

            {/* 1. Solicitudes Section (Collapsed Header) */}
            <Paper elevation={0} sx={{ bgcolor: 'white', borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'grey.100' }}>
                    <Stack direction="row" alignItems="center" gap={1}>
                        <Skeleton variant="circular" width={20} height={20} />
                        <Skeleton variant="text" width={120} height={24} />
                    </Stack>
                </Box>
            </Paper>

            {/* 2. Filters Section */}
            <Paper elevation={0} sx={{ bgcolor: 'white', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Box sx={{ py: 1, px: 3, height: 73 }}>
                    <Stack direction="row" alignItems="center" gap={3} sx={{ height: '100%' }}>
                        {/* Slider */}
                        <Box sx={{ minWidth: 320, ml: '180px' }}>
                            <Skeleton variant="text" width={200} height={16} sx={{ mb: 1 }} />
                            <Skeleton variant="rounded" width="100%" height={24} />
                        </Box>

                        <Divider orientation="vertical" flexItem sx={{ height: 40 }} />

                        {/* Selects */}
                        <Skeleton variant="rounded" width={160} height={40} />
                        <Skeleton variant="rounded" width={160} height={40} />
                        <Skeleton variant="rounded" width={160} height={40} />
                        <Skeleton variant="rounded" width={180} height={40} />

                        {/* Button */}
                        <Skeleton variant="rounded" width={120} height={36} />
                    </Stack>
                </Box>
            </Paper>

            {/* 3. KPI Section Grid */}
            <Stack direction="row" gap={1.5} flexWrap="wrap">
                {/* KPI 1: Sparkline */}
                <Paper elevation={0} sx={{ flex: '1 1 340px', height: 180, p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                    <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between">
                            <Skeleton variant="text" width={100} height={20} />
                            <Skeleton variant="text" width={40} height={20} />
                        </Stack>
                        <Skeleton variant="text" width={80} height={40} />
                        <Skeleton variant="rounded" width="100%" height={60} />
                    </Stack>
                </Paper>

                {/* KPI 2: Cumplimiento */}
                <Paper elevation={0} sx={{ flex: '1 1 400px', height: 180, p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                    <Stack direction="row" gap={2} height="100%">
                        <Box sx={{ width: 120 }}>
                            <Skeleton variant="text" width={80} mb={1} />
                            <Skeleton variant="text" width={60} height={40} />
                            <Skeleton variant="text" width={100} />
                        </Box>
                        <Divider orientation="vertical" />
                        <Box sx={{ flex: 1 }}>
                            <Skeleton variant="rounded" width="100%" height={32} sx={{ mb: 1 }} />
                            <Stack spacing={1}>
                                <Skeleton variant="text" width="100%" />
                                <Skeleton variant="text" width="100%" />
                                <Skeleton variant="text" width="100%" />
                            </Stack>
                        </Box>
                    </Stack>
                </Paper>

                {/* KPI 3: Tiempos */}
                <Paper elevation={0} sx={{ flex: '1 1 320px', height: 180, p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                    <Stack spacing={2}>
                        <Skeleton variant="text" width={120} />
                        <Skeleton variant="rounded" width="100%" height={20} />
                        <Stack direction="row" justifyContent="space-around">
                            <Skeleton variant="circular" width={40} height={40} />
                            <Skeleton variant="circular" width={40} height={40} />
                            <Skeleton variant="circular" width={40} height={40} />
                        </Stack>
                    </Stack>
                </Paper>

                {/* KPI 4: Fuentes */}
                <Paper elevation={0} sx={{ flex: '1 1 320px', height: 180, p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                    <Stack spacing={2} alignItems="center">
                        <Skeleton variant="text" width={150} />
                        <Stack direction="row" alignItems="center" gap={2}>
                            <Skeleton variant="circular" width={100} height={100} />
                            <Stack>
                                <Skeleton variant="text" width={80} />
                                <Skeleton variant="text" width={80} />
                            </Stack>
                        </Stack>
                    </Stack>
                </Paper>
            </Stack>

            {/* 4. Second Row (Charts/Details) */}
            <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                    <Paper elevation={0} sx={{ p: 2, height: 400, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                        <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
                        <Skeleton variant="rounded" width="100%" height={300} />
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper elevation={0} sx={{ p: 2, height: 400, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                        <Skeleton variant="text" width={150} height={32} sx={{ mb: 2 }} />
                        <Stack spacing={2}>
                            <Skeleton variant="rounded" width="100%" height={60} />
                            <Skeleton variant="rounded" width="100%" height={60} />
                            <Skeleton variant="rounded" width="100%" height={60} />
                            <Skeleton variant="rounded" width="100%" height={60} />
                        </Stack>
                    </Paper>
                </Grid>
            </Grid>

        </Box>
    );
};

export const KPIGridSkeleton = () => (
    <Stack direction="row" gap={1.5} flexWrap="wrap">
        {/* KPI 1: Sparkline */}
        <Paper elevation={0} sx={{ flex: '1 1 340px', height: 180, p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
            <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between">
                    <Skeleton variant="text" width={100} height={20} />
                    <Skeleton variant="text" width={40} height={20} />
                </Stack>
                <Skeleton variant="text" width={80} height={40} />
                <Skeleton variant="rounded" width="100%" height={60} />
            </Stack>
        </Paper>

        {/* KPI 2: Cumplimiento */}
        <Paper elevation={0} sx={{ flex: '1 1 400px', height: 180, p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
            <Stack direction="row" gap={2} height="100%">
                <Box sx={{ width: 120 }}>
                    <Skeleton variant="text" width={80} mb={1} />
                    <Skeleton variant="text" width={60} height={40} />
                    <Skeleton variant="text" width={100} />
                </Box>
                <Divider orientation="vertical" />
                <Box sx={{ flex: 1 }}>
                    <Skeleton variant="rounded" width="100%" height={32} sx={{ mb: 1 }} />
                    <Stack spacing={1}>
                        <Skeleton variant="text" width="100%" />
                        <Skeleton variant="text" width="100%" />
                        <Skeleton variant="text" width="100%" />
                    </Stack>
                </Box>
            </Stack>
        </Paper>

        {/* KPI 3: Tiempos */}
        <Paper elevation={0} sx={{ flex: '1 1 320px', height: 180, p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
            <Stack spacing={2}>
                <Skeleton variant="text" width={120} />
                <Skeleton variant="rounded" width="100%" height={20} />
                <Stack direction="row" justifyContent="space-around">
                    <Skeleton variant="circular" width={40} height={40} />
                    <Skeleton variant="circular" width={40} height={40} />
                    <Skeleton variant="circular" width={40} height={40} />
                </Stack>
            </Stack>
        </Paper>

        {/* KPI 4: Fuentes */}
        <Paper elevation={0} sx={{ flex: '1 1 320px', height: 180, p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
            <Stack spacing={2} alignItems="center">
                <Skeleton variant="text" width={150} />
                <Stack direction="row" alignItems="center" gap={2}>
                    <Skeleton variant="circular" width={100} height={100} />
                    <Stack>
                        <Skeleton variant="text" width={80} />
                        <Skeleton variant="text" width={80} />
                    </Stack>
                </Stack>
            </Stack>
        </Paper>
    </Stack>
);

export default DashboardSkeleton;
