import React from 'react';
import { Box, Grid, Paper, Typography, Button, IconButton } from '@mui/material';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardRounded';
import LocalDiningIcon from '@mui/icons-material/LocalDiningRounded';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBagRounded';
import MoreHorizIcon from '@mui/icons-material/MoreHorizRounded';

const data = [
    { name: 'Jul', income: 4000, expense: 2400 },
    { name: 'Aug', income: 3000, expense: 1398 },
    { name: 'Sept', income: 9800, expense: 2000 },
    { name: 'Okt', income: 3908, expense: 2780 },
    { name: 'Nov', income: 8000, expense: 1890 },
    { name: 'Des', income: 3800, expense: 2390 },
];

const StatCard = ({ title, amount, percentage, isPositive }) => (
    <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="body1" color="text.secondary">{title}</Typography>
            <IconButton size="small"><MoreHorizIcon /></IconButton>
        </Box>
        <Box>
            <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>{amount}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{
                    bgcolor: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: isPositive ? 'secondary.main' : 'error.main',
                    borderRadius: 2, px: 1, py: 0.5, display: 'flex', alignItems: 'center', gap: 0.5
                }}>
                    {isPositive ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
                    <Typography variant="caption" fontWeight="bold">{percentage}%</Typography>
                </Box>
            </Box>
        </Box>
    </Paper>
);

const SpendingItem = ({ icon, title, amount, date }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: '#F3F4F6', color: 'primary.main' }}>
                {icon}
            </Box>
            <Box>
                <Typography variant="subtitle2" fontWeight="bold">{title}</Typography>
                <Typography variant="caption" color="text.secondary">{date}</Typography>
            </Box>
        </Box>
        <Typography variant="subtitle2" fontWeight="bold">{amount}</Typography>
    </Box>
);

const DashboardMockup = () => {
    return (
        <Box>
            {/* Welcome Section */}
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                <Box>
                    <Typography variant="h3" fontWeight="bold" sx={{ mb: 1 }}>
                        Hi Daniel 👋
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Here's what happening with your money today.
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button variant="text" color="inherit">Withdraw</Button>
                    <Button variant="contained" color="primary" disableElevation>+ Deposit</Button>
                </Box>
            </Box>

            <Grid container spacing={3}>
                {/* Main Chart Section */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 4, borderRadius: 4, mb: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
                            <Box>
                                <Typography variant="body1" color="text.secondary">Total Balance</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Typography variant="h3" fontWeight="bold">$52,890.00</Typography>
                                    <Box sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: 'secondary.main', px: 1, borderRadius: 1 }}>
                                        <Typography variant="caption" fontWeight="bold">+24%</Typography>
                                    </Box>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'primary.main' }} />
                                    <Typography variant="caption">Income</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'primary.light' }} />
                                    <Typography variant="caption">Expense</Typography>
                                </Box>
                            </Box>
                        </Box>

                        <Box sx={{ height: 300, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data} barGap={8}>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF' }} />
                                    <Tooltip cursor={{ fill: 'transparent' }} />
                                    <Bar dataKey="income" fill="#3B82F6" radius={[10, 10, 10, 10]} barSize={40} stackId="a" />
                                    <Bar dataKey="expense" fill="#93C5FD" radius={[10, 10, 10, 10]} barSize={40} stackId="b" />
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    </Paper>

                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <StatCard title="Total Income" amount="$2,950.00" percentage="-12" isPositive={false} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <StatCard title="Total Expenses" amount="$945.00" percentage="+7" isPositive={true} />
                        </Grid>
                    </Grid>
                </Grid>

                {/* Right Side Stats */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 4, borderRadius: 4, height: '100%' }}>
                        <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>Most Spending</Typography>

                        <SpendingItem
                            icon={<LocalDiningIcon />}
                            title="Food & Beverages"
                            date="30 Transactions"
                            amount="$4,200"
                        />
                        <SpendingItem
                            icon={<ShoppingBagIcon />}
                            title="Online Shopping"
                            date="26 Transactions"
                            amount="$2,600"
                        />
                        <SpendingItem
                            icon={<LocalDiningIcon />}
                            title="Restaurants"
                            date="12 Transactions"
                            amount="$1,200"
                        />

                        <Box sx={{ mt: 4, p: 3, borderRadius: 4, background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', color: 'white' }}>
                            <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>Scale your business</Typography>
                            <Typography variant="body2" sx={{ opacity: 0.8, mb: 2 }}>
                                Take your financial management to the next level.
                            </Typography>
                            <Button variant="contained" sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
                                Upgrade Now
                            </Button>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default DashboardMockup;
