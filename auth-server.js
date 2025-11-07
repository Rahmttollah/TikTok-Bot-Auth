const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

// Firebase Client SDK
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  addDoc 
} = require('firebase/firestore');

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDDtTxl5lZ1Crerbk0C26teR1jNvrHQCR0",
  authDomain: "tiktok-bot-auth.firebaseapp.com",
  projectId: "tiktok-bot-auth",
  storageBucket: "tiktok-bot-auth.firebasestorage.app",
  messagingSenderId: "214610166671",
  appId: "1:214610166671:web:777a51a7663e83e131c1fa",
  measurementId: "G-ZD7VP1L36E"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'super-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));

// Main Controller URL
const MAIN_CONTROLLER_URL = 'https://tiktok-main-controller-6ro1.onrender.com';

// 🔥 SUPER ADMIN Configuration (ONLY YOU)
const SUPER_ADMIN = {
    username: process.env.SUPER_ADMIN_USERNAME || 'Rahmttollah',
    password: process.env.SUPER_ADMIN_PASSWORD || 'Rahmttollah6677'
};

// =============================
// ✅ FIREBASE DATABASE FUNCTIONS
// =============================

// Users Collection
async function readUsers() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const users = [];
        usersSnapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });
        return users;
    } catch (error) {
        console.error('Error reading users:', error);
        return [];
    }
}

async function addUser(user) {
    try {
        await setDoc(doc(db, 'users', user.id), user);
        return true;
    } catch (error) {
        console.error('Error adding user:', error);
        return false;
    }
}

async function updateUser(userId, updates) {
    try {
        await updateDoc(doc(db, 'users', userId), updates);
        return true;
    } catch (error) {
        console.error('Error updating user:', error);
        return false;
    }
}

// Bot Instances Collection
async function readBotInstances() {
    try {
        const instancesSnapshot = await getDocs(collection(db, 'botInstances'));
        const instances = [];
        instancesSnapshot.forEach(doc => {
            instances.push({ id: doc.id, ...doc.data() });
        });
        return instances;
    } catch (error) {
        console.error('Error reading bot instances:', error);
        return [];
    }
}

async function addBotInstance(instance) {
    try {
        await setDoc(doc(db, 'botInstances', instance.id), instance);
        return true;
    } catch (error) {
        console.error('Error adding bot instance:', error);
        return false;
    }
}

async function updateBotInstance(instanceId, updates) {
    try {
        await updateDoc(doc(db, 'botInstances', instanceId), updates);
        return true;
    } catch (error) {
        console.error('Error updating bot instance:', error);
        return false;
    }
}

async function deleteBotInstance(instanceId) {
    try {
        await deleteDoc(doc(db, 'botInstances', instanceId));
        return true;
    } catch (error) {
        console.error('Error deleting bot instance:', error);
        return false;
    }
}

// Registration Keys Collection
async function readRegistrationKeys() {
    try {
        const keysSnapshot = await getDocs(collection(db, 'registrationKeys'));
        const keys = [];
        keysSnapshot.forEach(doc => {
            keys.push({ id: doc.id, ...doc.data() });
        });
        return keys;
    } catch (error) {
        console.error('Error reading registration keys:', error);
        return [];
    }
}

async function addRegistrationKey(keyData) {
    try {
        await setDoc(doc(db, 'registrationKeys', keyData.key), keyData);
        return true;
    } catch (error) {
        console.error('Error adding registration key:', error);
        return false;
    }
}

async function deleteRegistrationKey(key) {
    try {
        await deleteDoc(doc(db, 'registrationKeys', key));
        return true;
    } catch (error) {
        console.error('Error deleting registration key:', error);
        return false;
    }
}

// =============================
// ✅ EXISTING FUNCTIONS (UNCHANGED - Only database calls updated)
// =============================

// ✅ BOT STATUS CHECKING SYSTEM
async function checkBotStatus(instance) {
    try {
        const response = await axios.get(`${instance.url}/status`, {
            timeout: 5000
        });
        
        if (response.data && typeof response.data === 'object') {
            return {
                online: true,
                running: response.data.running || false,
                success: response.data.success || 0,
                fails: response.data.fails || 0,
                reqs: response.data.reqs || 0,
                rps: response.data.rps || 0,
                lastChecked: new Date().toISOString()
            };
        }
    } catch (error) {
        console.log(`❌ Bot ${instance.url} is offline: ${error.message}`);
    }
    
    return {
        online: false,
        running: false,
        success: 0,
        fails: 0,
        reqs: 0,
        rps: 0,
        lastChecked: new Date().toISOString()
    };
}

// ✅ FIXED BOT ALLOCATION - Priority to users without bots
async function allocateBotsToUser(username) {
    const instances = await readBotInstances();
    const users = await readUsers();
    
    // Get available bots (not allocated AND enabled)
    const availableBots = instances.filter(bot => 
        !bot.allocatedTo && bot.enabled
    );
    
    console.log(`🔄 Allocating bots for ${username}. Available: ${availableBots.length}`);
    
    // If no bots available, return empty
    if (availableBots.length === 0) {
        console.log(`❌ No bots available for ${username}`);
        return [];
    }
    
    // Allocate as many as available (max 3)
    const botsToAllocate = Math.min(availableBots.length, 3);
    const selectedBots = [];
    
    // Shuffle and select bots randomly
    const shuffled = [...availableBots].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < botsToAllocate; i++) {
        selectedBots.push(shuffled[i].id);
        
        // Mark bot as allocated
        await updateBotInstance(shuffled[i].id, {
            allocatedTo: username,
            allocatedAt: new Date().toISOString()
        });
    }
    
    console.log(`✅ Allocated ${selectedBots.length} bots to ${username}:`, selectedBots);
    return selectedBots;
}

// ✅ AUTO-DISTRIBUTE BOTS TO ALL USERS
async function autoDistributeBotsToAllUsers() {
    const users = await readUsers();
    const instances = await readBotInstances();
    
    let totalAssigned = 0;
    const distributionLog = [];
    
    console.log('🎯 Starting auto bot distribution to all users...');
    
    // Get available bots
    const availableBots = instances.filter(bot => 
        !bot.allocatedTo && bot.enabled
    );
    
    if (availableBots.length === 0) {
        console.log('❌ No available bots for distribution');
        return { success: false, assigned: 0, message: 'No available bots' };
    }
    
    console.log(`📊 Available bots: ${availableBots.length}, Users to check: ${users.length}`);
    
    // Sort users by number of bots (users with fewer bots get priority)
    const usersNeedingBots = users
        .filter(user => (user.allocatedBots?.length || 0) < 3)
        .sort((a, b) => (a.allocatedBots?.length || 0) - (b.allocatedBots?.length || 0));
    
    console.log(`👥 Users needing bots: ${usersNeedingBots.length}`);
    
    if (usersNeedingBots.length === 0) {
        console.log('✅ All users have maximum bots');
        return { success: true, assigned: 0, message: 'All users have max bots' };
    }
    
    // Distribute available bots to users who need them
    let botIndex = 0;
    
    for (const user of usersNeedingBots) {
        if (botIndex >= availableBots.length) break;
        
        const currentBots = user.allocatedBots?.length || 0;
        const botsNeeded = 3 - currentBots;
        
        if (botsNeeded > 0) {
            const botsToAssign = Math.min(botsNeeded, availableBots.length - botIndex);
            
            for (let i = 0; i < botsToAssign; i++) {
                if (botIndex < availableBots.length) {
                    const bot = availableBots[botIndex];
                    
                    // Add bot to user
                    const updatedBots = [...(user.allocatedBots || []), bot.id];
                    await updateUser(user.id, { allocatedBots: updatedBots });
                    
                    // Mark bot as allocated
                    await updateBotInstance(bot.id, {
                        allocatedTo: user.username,
                        allocatedAt: new Date().toISOString()
                    });
                    
                    distributionLog.push({
                        user: user.username,
                        bot: bot.id,
                        assigned: true
                    });
                    
                    console.log(`✅ Assigned bot ${bot.id} to ${user.username}`);
                    totalAssigned++;
                    botIndex++;
                }
            }
        }
    }
    
    if (totalAssigned > 0) {
        console.log(`🎉 Successfully assigned ${totalAssigned} bots to ${distributionLog.length} users`);
        return { 
            success: true, 
            assigned: totalAssigned, 
            message: `Assigned ${totalAssigned} bots to users`,
            log: distributionLog 
        };
    }
    
    return { success: true, assigned: 0, message: 'No assignments needed' };
}

// 🔥 GET BOT STATISTICS
async function getBotStatistics() {
    const instances = await readBotInstances();
    const users = await readUsers();
    
    const totalBots = instances.length;
    const enabledBots = instances.filter(bot => bot.enabled).length;
    const allocatedBots = instances.filter(bot => bot.allocatedTo).length;
    const availableBots = instances.filter(bot => !bot.allocatedTo && bot.enabled).length;
    const offlineBots = instances.filter(bot => !bot.enabled).length;
    
    // Bot usage details
    const botUsage = instances.map(bot => ({
        id: bot.id,
        url: bot.url,
        status: bot.enabled ? 'online' : 'offline',
        allocatedTo: bot.allocatedTo,
        allocatedAt: bot.allocatedAt,
        isUsed: !!bot.allocatedTo
    }));
    
    return {
        totalBots,
        enabledBots,
        allocatedBots,
        availableBots,
        offlineBots,
        botUsage
    };
}

// Generate secure token
function generateToken() {
    return crypto.randomBytes(32).toString('hex') + Date.now().toString();
}

// Generate registration key
function generateRegistrationKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 12; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
        if ((i + 1) % 4 === 0 && i < 11) key += '-';
    }
    return key;
}

// Auth middleware
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

function requireAdmin(req, res, next) {
    if (req.session.user && (req.session.user.role === 'super_admin' || req.session.user.role === 'sub_admin')) {
        next();
    } else {
        if (req.originalUrl.startsWith('/api/')) {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        res.redirect('/login');
    }
}

function requireSuperAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'super_admin') {
        next();
    } else {
        if (req.originalUrl.startsWith('/api/')) {
            return res.status(403).json({ success: false, message: 'Super Admin access required' });
        }
        res.redirect('/login');
    }
}

// =============================
// ✅ ROUTES
// =============================

// ✅ ROOT ROUTE
app.get('/', (req, res) => {
    if (req.query.logout === 'true') {
        req.session.destroy();
        return res.redirect('/login');
    }
    
    if (req.session.user) {
        if (req.session.user.role === 'super_admin' || req.session.user.role === 'sub_admin') {
            return res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
        } else {
            const token = generateToken();
            return res.redirect(`${MAIN_CONTROLLER_URL}/dashboard?token=${token}`);
        }
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ✅ LOGIN ROUTE
app.get('/login', (req, res) => {
    if (req.session.user) {
        if (req.session.user.role === 'super_admin' || req.session.user.role === 'sub_admin') {
            return res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
        } else {
            const token = generateToken();
            return res.redirect(`${MAIN_CONTROLLER_URL}/dashboard?token=${token}`);
        }
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    if (req.session.user) {
        res.redirect(`${MAIN_CONTROLLER_URL}/dashboard`);
    } else {
        res.sendFile(path.join(__dirname, 'public', 'register.html'));
    }
});

// ✅ ADMIN ROUTE
app.get('/admin', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    if (req.session.user.role === 'super_admin' || req.session.user.role === 'sub_admin') {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } else {
        res.redirect(`${MAIN_CONTROLLER_URL}/dashboard`);
    }
});

// ✅ DASHBOARD ROUTE
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    const userType = req.query.type;
    if (userType === 'admin' && (req.session.user.role === 'super_admin' || req.session.user.role === 'sub_admin')) {
        res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
    } else {
        res.redirect(`${MAIN_CONTROLLER_URL}/dashboard`);
    }
});

// ✅ USER REGISTER API
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, registrationKey } = req.body;
        
        if (!username || !email || !password || !registrationKey) {
            return res.json({ success: false, message: 'All fields are required' });
        }

        const keys = await readRegistrationKeys();
        const validKey = keys.find(k => k.key === registrationKey && k.used === false);
        
        if (!validKey) {
            return res.json({ success: false, message: 'Invalid or used registration key' });
        }

        const users = await readUsers();
        if (users.find(u => u.username === username)) {
            return res.json({ success: false, message: 'Username already exists' });
        }
        if (users.find(u => u.email === email)) {
            return res.json({ success: false, message: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 🔥 AUTO BOT ALLOCATION - 3 random bots
        const allocatedBots = await allocateBotsToUser(username);
        
        const newUser = {
            id: Date.now().toString(),
            username,
            email,
            password: hashedPassword,
            role: 'user',
            allocatedBots: allocatedBots,
            createdAt: new Date().toISOString(),
            isActive: true
        };

        // Add user to Firebase
        const userAdded = await addUser(newUser);
        
        if (userAdded) {
            // Update registration key usage
            await updateDoc(doc(db, 'registrationKeys', validKey.key), {
                used: true,
                usedBy: username,
                usedAt: new Date().toISOString()
            });

            res.json({ 
                success: true, 
                message: 'Registration successful! 3 bots allocated to your account.',
                allocatedBots: allocatedBots.length
            });
        } else {
            res.json({ success: false, message: 'Registration failed' });
        }
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ USER LOGIN API
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, rememberMe } = req.body;

        if (!username || !password) {
            return res.json({ success: false, message: 'Username and password required' });
        }

        // 🔥 Check SUPER ADMIN first
        if (username === SUPER_ADMIN.username) {
            if (password === SUPER_ADMIN.password) {
                // SUPER ADMIN login successful
                const token = generateToken();

                req.session.user = { 
                    username: username,
                    email: 'rahmttollahn@gmail.com',
                    role: 'super_admin',
                    isAdmin: true
                };
                
                if (rememberMe) {
                    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
                }

                res.json({ 
                    success: true, 
                    message: 'Super Admin login successful!',
                    token: token,
                    role: 'super_admin',
                    redirectUrl: '/dashboard?type=admin'
                });
                return;
            } else {
                return res.json({ success: false, message: 'Invalid Super Admin password' });
            }
        }

        // Normal user login
        const users = await readUsers();
        const user = users.find(u => u.username === username && u.isActive);
        
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        // Check password for normal users
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.json({ success: false, message: 'Invalid credentials' });
        }

        const token = generateToken();

        req.session.user = { 
            username: user.username,
            email: user.email,
            role: user.role,
            isAdmin: user.role === 'super_admin' || user.role === 'sub_admin'
        };
        
        if (rememberMe) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
        }

        // 🔥 SMART REDIRECT BASED ON ROLE
        let redirectUrl;
        if (user.role === 'super_admin' || user.role === 'sub_admin') {
            redirectUrl = '/dashboard?type=admin';
        } else {
            redirectUrl = `${MAIN_CONTROLLER_URL}/dashboard?token=${token}`;
        }

        res.json({ 
            success: true, 
            message: 'Login successful',
            token: token,
            role: user.role,
            redirectUrl: redirectUrl
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ LOGOUT API
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log('Session destroy error:', err);
        }
    });
    
    res.json({ 
        success: true, 
        message: 'Logout successful',
        redirect_url: '/login?message=logout_success'
    });
});

// ✅ ADMIN USERS API
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await readUsers();
        const safeUsers = users.map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            allocatedBots: user.allocatedBots || [],
            createdAt: user.createdAt,
            isActive: user.isActive
        }));
        res.json({ success: true, users: safeUsers });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ ADD BOT INSTANCE API
app.post('/api/admin/instances', requireAdmin, async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.json({ success: false, message: 'URL required' });
        }
        
        try {
            new URL(url);
        } catch (error) {
            return res.json({ success: false, message: 'Invalid URL' });
        }

        const instances = await readBotInstances();
        
        if (instances.find(inst => inst.url === url)) {
            return res.json({ success: false, message: 'Instance already exists' });
        }

        const newInstance = { 
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            url: url.trim(), 
            addedAt: new Date().toISOString(), 
            enabled: true,
            allocatedTo: null,
            allocatedAt: null
        };

        // Add to Firebase
        const instanceAdded = await addBotInstance(newInstance);
        
        if (instanceAdded) {
            console.log(`✅ New bot instance added: ${newInstance.url}`);
            
            // 🔥 AUTO DISTRIBUTE TO USERS AFTER ADDING NEW BOT
            const distributionResult = await autoDistributeBotsToAllUsers();
            
            let message = 'Bot instance added successfully';
            if (distributionResult.assigned > 0) {
                message += ` and ${distributionResult.assigned} bots assigned to users`;
            }
            
            res.json({ 
                success: true, 
                message: message,
                instance: newInstance,
                distribution: distributionResult
            });
        } else {
            res.json({ success: false, message: 'Failed to add instance' });
        }
    } catch (error) {
        console.log('Error adding instance:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ DELETE BOT INSTANCE API
app.delete('/api/admin/instances/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🗑️ Deleting bot instance: ${id}`);
        
        const instances = await readBotInstances();
        const users = await readUsers();
        
        const instanceToDelete = instances.find(inst => inst.id === id);
        
        if (!instanceToDelete) {
            return res.json({ success: false, message: '❌ Instance not found' });
        }
        
        // 1. Remove from ALL users' allocatedBots
        let usersUpdated = 0;
        for (const user of users) {
            if (user.allocatedBots && user.allocatedBots.includes(id)) {
                const updatedBots = user.allocatedBots.filter(botId => botId !== id);
                await updateUser(user.id, { allocatedBots: updatedBots });
                usersUpdated++;
                console.log(`✅ Removed bot ${id} from user ${user.username}`);
            }
        }
        
        // 2. Delete instance from Firebase
        const instanceDeleted = await deleteBotInstance(id);
        
        if (instanceDeleted) {
            console.log(`✅ Bot instance ${id} deleted successfully. Removed from ${usersUpdated} users.`);
            res.json({ 
                success: true, 
                message: `✅ Bot instance deleted successfully. Removed from ${usersUpdated} users.`
            });
        } else {
            res.json({ success: false, message: '❌ Failed to delete instance' });
        }
    } catch (error) {
        console.error('❌ Delete instance error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ GENERATE REGISTRATION KEY API
app.post('/api/admin/generate-key', requireAdmin, async (req, res) => {
    try {
        const { note } = req.body;
        const key = generateRegistrationKey();
        
        const keyData = {
            key: key,
            note: note || 'Generated by admin',
            createdAt: new Date().toISOString(),
            used: false,
            usedBy: null,
            usedAt: null
        };
        
        const keyAdded = await addRegistrationKey(keyData);
        
        if (keyAdded) {
            res.json({ success: true, key: key, message: 'Registration key generated' });
        } else {
            res.json({ success: false, message: 'Failed to generate key' });
        }
    } catch (error) {
        console.error('Error generating key:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ GET REGISTRATION KEYS API
app.get('/api/admin/keys', requireAdmin, async (req, res) => {
    try {
        const keys = await readRegistrationKeys();
        res.json({ success: true, keys: keys });
    } catch (error) {
        console.error('Error fetching keys:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ DELETE REGISTRATION KEY API
app.delete('/api/admin/keys/:key', requireAdmin, async (req, res) => {
    try {
        const { key } = req.params;
        
        const keyDeleted = await deleteRegistrationKey(key);
        
        if (keyDeleted) {
            res.json({ success: true, message: 'Key deleted successfully' });
        } else {
            res.json({ success: false, message: 'Key not found or deletion failed' });
        }
    } catch (error) {
        console.error('Error deleting key:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ TOGGLE USER API
app.post('/api/admin/users/:id/toggle', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const users = await readUsers();
        const user = users.find(u => u.id === id);
        
        if (user) {
            const updated = await updateUser(user.id, { isActive: !user.isActive });
            if (updated) {
                res.json({ 
                    success: true, 
                    message: `User ${!user.isActive ? 'activated' : 'deactivated'}`,
                    user: { ...user, isActive: !user.isActive }
                });
            } else {
                res.json({ success: false, message: 'Failed to update user' });
            }
        } else {
            res.json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        console.error('Error toggling user:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ GET BOT INSTANCES API
app.get('/api/admin/instances', requireAdmin, async (req, res) => {
    try {
        const instances = await readBotInstances();
        res.json({ success: true, instances: instances });
    } catch (error) {
        console.error('Error fetching instances:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ GET BOT INSTANCES WITH STATUS API
app.get('/api/admin/instances-with-status', requireAdmin, async (req, res) => {
    try {
        const instances = await readBotInstances();
        const instancesWithStatus = [];
        
        // Check status for each instance
        for (const instance of instances) {
            const status = await checkBotStatus(instance);
            instancesWithStatus.push({
                ...instance,
                status: status
            });
        }
        
        res.json({ success: true, instances: instancesWithStatus });
    } catch (error) {
        console.error('Error fetching instances with status:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ PROMOTE USER API
app.post('/api/admin/promote-user', requireSuperAdmin, async (req, res) => {
    try {
        const { userId, newRole } = req.body;
        
        if (!['user', 'sub_admin'].includes(newRole)) {
            return res.json({ success: false, message: 'Invalid role' });
        }

        const users = await readUsers();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        // Don't allow demoting super admin
        if (user.role === 'super_admin') {
            return res.json({ success: false, message: 'Cannot modify Super Admin' });
        }

        const updated = await updateUser(user.id, { role: newRole });
        
        if (updated) {
            res.json({ 
                success: true, 
                message: `User ${user.username} ${newRole === 'sub_admin' ? 'promoted to Sub Admin' : 'demoted to User'}`,
                user: {
                    id: user.id,
                    username: user.username,
                    role: newRole
                }
            });
        } else {
            res.json({ success: false, message: 'Failed to update user' });
        }
    } catch (error) {
        console.error('Promote user error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ MANAGE USER BOTS API
app.post('/api/admin/users/:userId/manage-bots', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { action, botId } = req.body;
        
        console.log(`Bot management: ${action} for user ${userId}, bot: ${botId}`);
        
        const users = await readUsers();
        const instances = await readBotInstances();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        if (!user.allocatedBots) user.allocatedBots = [];

        if (action === 'add_bot') {
            // Check if bot exists and is available
            const availableBot = instances.find(bot => 
                !bot.allocatedTo && bot.enabled && bot.id === botId
            );
            
            if (!availableBot) {
                return res.json({ success: false, message: 'Bot not available or already allocated' });
            }

            // Check if user already has this bot
            if (user.allocatedBots.includes(botId)) {
                return res.json({ success: false, message: 'User already has this bot' });
            }

            // Add to user
            const updatedBots = [...user.allocatedBots, availableBot.id];
            await updateUser(user.id, { allocatedBots: updatedBots });
            
            // Update bot allocation
            await updateBotInstance(availableBot.id, {
                allocatedTo: user.username,
                allocatedAt: new Date().toISOString()
            });

            const message = updatedBots.length > 3 ? 
                `✅ Bot allocated to ${user.username} (Warning: User now has ${updatedBots.length} bots)` :
                `✅ Bot allocated to ${user.username}`;
                
            res.json({ 
                success: true, 
                message: message,
                allocatedBots: updatedBots,
                currentCount: updatedBots.length
            });

        } else if (action === 'remove_bot' && botId) {
            // Check if user has this bot
            if (!user.allocatedBots.includes(botId)) {
                return res.json({ success: false, message: '❌ User does not have this bot' });
            }
            
            // Remove from user
            const updatedBots = user.allocatedBots.filter(bot => bot !== botId);
            await updateUser(user.id, { allocatedBots: updatedBots });
            
            // Free the bot
            await updateBotInstance(botId, {
                allocatedTo: null,
                allocatedAt: null
            });

            res.json({ 
                success: true, 
                message: `✅ Bot removed from ${user.username}`,
                allocatedBots: updatedBots,
                currentCount: updatedBots.length
            });
        } else {
            res.json({ success: false, message: '❌ Invalid action' });
        }
    } catch (error) {
        console.error('❌ Bot management error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ✅ GET BOT STATISTICS API
app.get('/api/admin/bot-statistics', requireAdmin, async (req, res) => {
    try {
        const stats = await getBotStatistics();
        res.json({ success: true, statistics: stats });
    } catch (error) {
        console.error('Error fetching bot statistics:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ GET USER BOT DETAILS API
app.get('/api/admin/users/:userId/bot-details', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const users = await readUsers();
        const instances = await readBotInstances();
        
        const user = users.find(u => u.id === userId);
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        const userBots = instances.filter(instance => 
            user.allocatedBots?.includes(instance.id)
        );

        const availableBots = instances.filter(bot => 
            !bot.allocatedTo && bot.enabled
        );

        res.json({
            success: true,
            user: {
                username: user.username,
                allocatedBots: user.allocatedBots || []
            },
            userBots: userBots,
            availableBots: availableBots,
            totalAllocated: userBots.length
        });
    } catch (error) {
        console.error('Error fetching user bot details:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ MANUAL BOT DISTRIBUTION API
app.post('/api/admin/distribute-bots', requireAdmin, async (req, res) => {
    try {
        console.log('🎯 Manual bot distribution requested');
        
        const distributionResult = await autoDistributeBotsToAllUsers();
        
        res.json({
            success: distributionResult.success,
            message: distributionResult.message,
            assigned: distributionResult.assigned,
            log: distributionResult.log
        });
    } catch (error) {
        console.error('Manual distribution error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ GET BOT DISTRIBUTION STATUS
app.get('/api/admin/bot-distribution-status', requireAdmin, async (req, res) => {
    try {
        const users = await readUsers();
        const instances = await readBotInstances();
        
        const availableBots = instances.filter(bot => !bot.allocatedTo && bot.enabled).length;
        const totalBots = instances.filter(bot => bot.enabled).length;
        const allocatedBots = instances.filter(bot => bot.allocatedTo).length;
        
        const usersWithoutBots = users.filter(user => (user.allocatedBots?.length || 0) === 0).length;
        const usersWithPartialBots = users.filter(user => {
            const botCount = user.allocatedBots?.length || 0;
            return botCount > 0 && botCount < 3;
        }).length;
        const usersWithFullBots = users.filter(user => (user.allocatedBots?.length || 0) >= 3).length;
        
        res.json({
            success: true,
            status: {
                availableBots,
                totalBots,
                allocatedBots,
                usersWithoutBots,
                usersWithPartialBots,
                usersWithFullBots,
                canDistribute: availableBots > 0 && (usersWithoutBots > 0 || usersWithPartialBots > 0)
            }
        });
    } catch (error) {
        console.error('Error fetching distribution status:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ USER INFO API
app.get('/api/user-info', requireAuth, async (req, res) => {
    try {
        const users = await readUsers();
        const user = users.find(u => u.username === req.session.user.username);
        
        res.json({
            success: true,
            user: {
                username: req.session.user.username,
                email: req.session.user.email,
                role: req.session.user.role,
                allocatedBots: user?.allocatedBots || []
            },
            token: generateToken()
        });
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ TOKEN VERIFY API
app.post('/api/verify-token', (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.json({ success: false, valid: false });
        }

        // For now, we'll accept any token since we're not storing them
        // You can implement proper token validation if needed
        res.json({ 
            success: true, 
            valid: true,
            username: 'user',
            role: 'user'
        });
    } catch (error) {
        res.json({ success: false, valid: false });
    }
});

// ✅ GET USER'S ALLOCATED BOT INSTANCES
app.get('/api/user-bot-instances', requireAuth, async (req, res) => {
    try {
        const users = await readUsers();
        const instances = await readBotInstances();
        const user = users.find(u => u.username === req.session.user.username);
        
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        // Get only user's allocated bots
        const userBots = instances.filter(instance => 
            user.allocatedBots?.includes(instance.id)
        );

        res.json({ 
            success: true, 
            instances: userBots,
            totalAllocated: user.allocatedBots?.length || 0
        });
    } catch (error) {
        console.error('Error fetching user bot instances:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ GET BOT INSTANCES FOR MAIN CONTROLLER
app.get('/api/bot-instances', async (req, res) => {
    try {
        const token = req.query.token;
        
        if (!token) {
            return res.json({ success: false, message: 'Token required' });
        }

        // For now, we accept any token
        // You can implement proper token validation if needed

        const users = await readUsers();
        const instances = await readBotInstances();
        
        // Return all available instances for now
        // You can modify this to return user-specific instances

        res.json({ 
            success: true, 
            instances: instances,
            userBots: []
        });
    } catch (error) {
        console.error('Error fetching bot instances:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ INITIALIZE FIREBASE DATA
// =============================
async function initializeFirebaseData() {
    try {
        // Check if super admin exists
        const users = await readUsers();
        const superAdminExists = users.find(u => u.username === SUPER_ADMIN.username);
        
        if (!superAdminExists) {
            const hashedPassword = await bcrypt.hash(SUPER_ADMIN.password, 10);
            const superAdminUser = {
                id: 'super-admin',
                username: SUPER_ADMIN.username,
                email: 'rahmttollahn@gmail.com',
                password: hashedPassword,
                role: 'super_admin',
                allocatedBots: [],
                createdAt: new Date().toISOString(),
                isActive: true
            };
            
            await addUser(superAdminUser);
            console.log('👑 SUPER ADMIN user created in Firebase!');
        }
        
        console.log('✅ Firebase data initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing Firebase data:', error);
    }
}

// =============================
// ✅ START SERVER
// =============================
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🔐 Auth Server running on port ${PORT}`);
    console.log(`👑 Super Admin: ${SUPER_ADMIN.username}`);
    console.log(`🎯 Main Controller: ${MAIN_CONTROLLER_URL}`);
    console.log(`🔥 Database: Firebase Firestore`);
    console.log(`🚀 Performance: Enhanced with real-time database`);
    console.log(`📊 Collections: users, botInstances, registrationKeys`);
    
    // Initialize Firebase data
    await initializeFirebaseData();
});
