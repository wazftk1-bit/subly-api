const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['https://subly-naw.vercel.app', 'http://localhost:5500', 'http://127.0.0.1:5500'],
  credentials: true
}));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Models
const User = require('./models/User');
const Subscription = require('./models/Subscription');
const Alert = require('./models/Alert');

// ========== AUTH ROUTES ==========

// @desc    Register new user
// @route   POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    
    const user = await User.create({ name, email, password });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name, email }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Login user
// @route   POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Google OAuth Login/Register
// @route   POST /api/auth/google
app.post('/api/auth/google', async (req, res) => {
  try {
    const { email, name, picture } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    
    // Check if user exists
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create new user from Google data
      const randomPassword = Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16);
      const hashedPassword = await bcryptjs.hash(randomPassword, 12);
      
      user = await User.create({
        name: name || email.split('@')[0],
        email,
        avatar: picture || '',
        password: hashedPassword,
        plan: 'free',
      });
      
      console.log('✅ New Google user created:', email);
    } else {
      console.log('✅ Existing Google user logged in:', email);
    }
    
    // Generate JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      }
    });
  } catch (error) {
    console.error('❌ Google auth error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
app.get('/api/auth/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// ========== DASHBOARD ROUTES ==========

// @desc    Get dashboard stats
// @route   GET /api/subscriptions/stats/dashboard
app.get('/api/subscriptions/stats/dashboard', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let userId = null;
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (e) {
        // Invalid token, return mock data
      }
    }
    
    // If user is logged in, get real data (simplified for now)
    // For testing, return mock data
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

// ========== HEALTH CHECK ==========

// @desc    Health check
// @route   GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Subly API Running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ========== ERROR HANDLER ==========

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, message: err.message || 'Server Error' });
});

// ========== START SERVER ==========

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
