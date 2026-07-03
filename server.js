const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: ['https://subly-naw.vercel.app', 'http://localhost:5500']
}));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Error:', err));

// Models
const User = require('./models/User');
const Subscription = require('./models/Subscription');
const Alert = require('./models/Alert');

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = await User.create({ name, email, password });
    const token = require('jsonwebtoken').sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ success: true, token, user: { id: user._id, name, email } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = require('jsonwebtoken').sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ success: true, token, user: { id: user._id, name: user.name, email } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Dashboard Stats
app.get('/api/subscriptions/stats/dashboard', async (req, res) => {
  try {
    // Temporary mock data for testing
    res.json({
      success: true,
      stats: {
        monthlySpend: 1247,
        spendChange: -340,
        activeSubscriptions: 14,
        potentialSavings: 420,
        renewalsThisMonth: 3,
        upcomingRenewalsCount: 1,
        unreadAlerts: 3
      },
      monthlyData: [
        { month: 'Jan', spend: 980 },
        { month: 'Feb', spend: 1050 },
        { month: 'Mar', spend: 1100 },
        { month: 'Apr', spend: 1200 },
        { month: 'May', spend: 1180 },
        { month: 'Jun', spend: 1247 },
        { month: 'Jul', spend: 1247 }
      ],
      upcomingRenewals: [
        { id: '1', name: 'AWS', logo: 'A', plan: 'Pay-as-you-go', price: 340, daysUntil: 7 }
      ],
      recentAlerts: [
        { id: '1', type: 'duplicate', title: 'Duplicate Found', message: 'Microsoft 365 & Google Workspace', severity: 'warning', potentialSavings: 150 },
        { id: '2', type: 'unused', title: 'Unused Subscription', message: 'Zoom Pro not used in 3 months', severity: 'info', potentialSavings: 14.99 },
        { id: '3', type: 'renewal', title: 'Upcoming Renewal', message: 'AWS renews in 7 days', severity: 'warning', potentialSavings: 0 }
      ]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Subly API Running', timestamp: new Date() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
