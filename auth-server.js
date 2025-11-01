const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

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
const MAIN_CONTROLLER_URL = 'https://tiktok-view-bot.up.railway.app';

// 🔥 SUPER ADMIN Configuration (ONLY YOU)
const SUPER_ADMIN = {
    username: process.env.SUPER_ADMIN_USERNAME || 'Rahmttollah',
    password: process.env.SUPER_ADMIN_PASSWORD || 'Rahmttollah6677'
};

// File paths
const usersFile = path.join(__dirname, 'users.json');
const tokensFile = path.join(__dirname, 'tokens.json');
const registrationKeysFile = path.join(__dirname, 'registration-keys.json');
const instancesFile = path.join(__dirname, 'bot-instances.json');

// Initialize files
function initializeFiles() {
    if (!fs.existsSync(usersFile)) {
        fs.writeFileSync(usersFile, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(tokensFile)) {
        fs.writeFileSync(tokensFile, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(registrationKeysFile)) {
        fs.writeFileSync(registrationKeysFile, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(instancesFile)) {
        fs.writeFileSync(instancesFile, JSON.stringify([], null, 2));
    }
}

// Read/write functions
function readUsers() {
    try {
        return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    } catch (error) {
        return [];
    }
}

function writeUsers(users) {
    try {
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
        return true;
    } catch (error) {
        return false;
    }
}

function readTokens() {
    try {
        return JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
    } catch (error) {
        return [];
    }
}

function writeTokens(tokens) {
    try {
        fs.writeFileSync(tokensFile, JSON.stringify(tokens, null, 2));
        return true;
    } catch (error) {
        return false;
    }
}

function readRegistrationKeys() {
    try {
        return JSON.parse(fs.readFileSync(registrationKeysFile, 'utf8'));
    } catch (error) {
        return [];
    }
}

function writeRegistrationKeys(keys) {
    try {
        fs.writeFileSync(registrationKeysFile, JSON.stringify(keys, null, 2));
        return true;
    } catch (error) {
        return false;
    }
}

function readBotInstances() {
    try {
        if (fs.existsSync(instancesFile)) {
            return JSON.parse(fs.readFileSync(instancesFile, 'utf8'));
        }
    } catch (error) {
        console.log('Error reading bot instances:', error);
    }
    return [];
}

function writeBotInstances(instances) {
    try {
        fs.writeFileSync(instancesFile, JSON.stringify(instances, null, 2));
        return true;
    } catch (error) {
        console.log('Error writing bot instances:', error);
        return false;
    }
}

// 🔥 BOT ALLOCATION SYSTEM
function allocateBotsToUser(username) {
    const instances = readBotInstances();
    const users = readUsers();
    
    // Get unused bots (not allocated to any user)
    const unusedBots = instances.filter(bot => 
        !bot.allocatedTo && bot.enabled
    );
    
    // If not enough bots, return empty
    if (unusedBots.length < 3) {
        console.log(`❌ Not enough unused bots for ${username}. Available: ${unusedBots.length}`);
        return [];
    }
    
    // Select 3 random bots
    const selectedBots = [];
    const shuffled = [...unusedBots].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < 3 && i < shuffled.length; i++) {
        selectedBots.push(shuffled[i].id);
        
        // Mark bot as allocated
        const botIndex = instances.findIndex(bot => bot.id === shuffled[i].id);
        if (botIndex !== -1) {
            instances[botIndex].allocatedTo = username;
            instances[botIndex].allocatedAt = new Date().toISOString();
        }
    }
    
    // Update instances file
    writeBotInstances(instances);
    
    console.log(`✅ Allocated bots to ${username}:`, selectedBots);
    return selectedBots;
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

// Routes
app.get('/', (req, res) => {
    if (req.session.user) {
        // 🔥 SMART DASHBOARD - Auto user type detection
        if (req.session.user.role === 'super_admin' || req.session.user.role === 'sub_admin') {
            res.redirect('/dashboard?type=admin');
        } else {
            res.redirect(`${MAIN_CONTROLLER_URL}/dashboard?token=${getUserToken(req.session.user.username)}`);
        }
    } else {
        res.redirect('/login');
    }
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        if (req.session.user.role === 'super_admin' || req.session.user.role === 'sub_admin') {
            res.redirect('/dashboard?type=admin');
        } else {
            res.redirect(`${MAIN_CONTROLLER_URL}/dashboard?token=${getUserToken(req.session.user.username)}`);
        }
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

app.get('/register', (req, res) => {
    if (req.session.user) {
        res.redirect(`${MAIN_CONTROLLER_URL}/dashboard?token=${getUserToken(req.session.user.username)}`);
    } else {
        res.sendFile(path.join(__dirname, 'public', 'register.html'));
    }
});

// 🔥 SMART ADMIN ACCESS - Manual URL only
app.get('/admin', requireAuth, (req, res) => {
    // Only allow if user is admin
    if (req.session.user.role === 'super_admin' || req.session.user.role === 'sub_admin') {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } else {
        // Normal users get redirected to main controller
        res.redirect(`${MAIN_CONTROLLER_URL}/dashboard?token=${getUserToken(req.session.user.username)}`);
    }
});

// 🔥 SMART DASHBOARD
app.get('/dashboard', requireAuth, (req, res) => {
    const userType = req.query.type;
    
    if (userType === 'admin' && (req.session.user.role === 'super_admin' || req.session.user.role === 'sub_admin')) {
        // Show admin dashboard
        res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
    } else {
        // Normal user - redirect to main controller
        res.redirect(`${MAIN_CONTROLLER_URL}/dashboard?token=${getUserToken(req.session.user.username)}`);
    }
});

// Helper function to get user token
function getUserToken(username) {
    const tokens = readTokens();
    const userToken = tokens.find(t => t.username === username && t.isActive && new Date(t.expiresAt) > new Date());
    return userToken ? userToken.token : '';
}

// =============================
// ✅ USER REGISTER API
// =============================
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, registrationKey } = req.body;
        
        if (!username || !email || !password || !registrationKey) {
            return res.json({ success: false, message: 'All fields are required' });
        }

        const keys = readRegistrationKeys();
        const validKey = keys.find(k => k.key === registrationKey && k.used === false);
        
        if (!validKey) {
            return res.json({ success: false, message: 'Invalid or used registration key' });
        }

        const users = readUsers();
        if (users.find(u => u.username === username)) {
            return res.json({ success: false, message: 'Username already exists' });
        }
        if (users.find(u => u.email === email)) {
            return res.json({ success: false, message: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 🔥 AUTO BOT ALLOCATION - 3 random bots
        const allocatedBots = allocateBotsToUser(username);
        
        const newUser = {
            id: Date.now().toString(),
            username,
            email,
            password: hashedPassword,
            role: 'user', // Default role
            allocatedBots: allocatedBots, // 3 allocated bots
            createdAt: new Date().toISOString(),
            isActive: true
        };

        users.push(newUser);
        
        validKey.used = true;
        validKey.usedBy = username;
        validKey.usedAt = new Date().toISOString();
        writeRegistrationKeys(keys);

        if (writeUsers(users)) {
            res.json({ 
                success: true, 
                message: 'Registration successful! 3 bots allocated to your account.',
                allocatedBots: allocatedBots.length
            });
        } else {
            res.json({ success: false, message: 'Registration failed' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ USER LOGIN API - FIXED SUPER ADMIN
// =============================
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, rememberMe } = req.body;

        if (!username || !password) {
            return res.json({ success: false, message: 'Username and password required' });
        }

        // 🔥 FIX: Check SUPER ADMIN first (hardcoded check)
        if (username === SUPER_ADMIN.username) {
            if (password === SUPER_ADMIN.password) {
                // SUPER ADMIN login successful
                const token = generateToken();
                const tokens = readTokens();
                
                tokens.push({
                    token: token,
                    username: username,
                    createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    isActive: true
                });
                
                writeTokens(tokens);

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
        const users = readUsers();
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
        const tokens = readTokens();
        
        tokens.push({
            token: token,
            username: user.username,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            isActive: true
        });
        
        writeTokens(tokens);

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

// =============================
// ✅ GLOBAL LOGOUT API
// =============================
app.post('/api/global-logout', (req, res) => {
    try {
        const { token } = req.body;
        
        if (token) {
            // Invalidate token
            const tokens = readTokens();
            const updatedTokens = tokens.filter(t => t.token !== token);
            writeTokens(updatedTokens);
        }
        
        // Destroy session
        req.session.destroy();
        
        res.json({ 
            success: true, 
            message: 'Logged out from all systems' 
        });
    } catch (error) {
        res.json({ 
            success: true, 
            message: 'Logged out' 
        });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logout successful' });
});

// =============================
// ✅ SUPER ADMIN APIS
// =============================

// 🔥 PROMOTE USER TO SUB ADMIN (Super Admin Only)
app.post('/api/admin/promote-user', requireSuperAdmin, (req, res) => {
    try {
        const { userId, newRole } = req.body;
        
        if (!['user', 'sub_admin'].includes(newRole)) {
            return res.json({ success: false, message: 'Invalid role' });
        }

        const users = readUsers();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        user.role = newRole;
        
        if (writeUsers(users)) {
            res.json({ 
                success: true, 
                message: `User ${user.username} promoted to ${newRole}`,
                user: user
            });
        } else {
            res.json({ success: false, message: 'Failed to promote user' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ ADMIN APIS
// =============================
app.get('/api/admin/users', requireAdmin, (req, res) => {
    try {
        const users = readUsers();
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
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 🔥 MANAGE USER BOTS (Admin Only)
app.post('/api/admin/users/:userId/bots', requireAdmin, (req, res) => {
    try {
        const { userId } = req.params;
        const { action, botId } = req.body; // 'add' or 'remove'
        
        const users = readUsers();
        const instances = readBotInstances();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        if (!user.allocatedBots) user.allocatedBots = [];

        if (action === 'add') {
            // Find unused bot
            const unusedBot = instances.find(bot => 
                !bot.allocatedTo && bot.enabled && bot.id !== botId
            );
            
            if (!unusedBot) {
                return res.json({ success: false, message: 'No unused bots available' });
            }

            // Add to user
            user.allocatedBots.push(unusedBot.id);
            
            // Update bot allocation
            const botIndex = instances.findIndex(bot => bot.id === unusedBot.id);
            instances[botIndex].allocatedTo = user.username;
            instances[botIndex].allocatedAt = new Date().toISOString();

        } else if (action === 'remove' && botId) {
            // Remove from user
            user.allocatedBots = user.allocatedBots.filter(bot => bot !== botId);
            
            // Free the bot
            const botIndex = instances.findIndex(bot => bot.id === botId);
            if (botIndex !== -1) {
                instances[botIndex].allocatedTo = null;
                instances[botIndex].allocatedAt = null;
            }
        }

        if (writeUsers(users) && writeBotInstances(instances)) {
            res.json({ 
                success: true, 
                message: `User bots updated successfully`,
                allocatedBots: user.allocatedBots
            });
        } else {
            res.json({ success: false, message: 'Failed to update user bots' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/admin/generate-key', requireAdmin, (req, res) => {
    try {
        const { note } = req.body;
        const key = generateRegistrationKey();
        const keys = readRegistrationKeys();
        
        keys.push({
            key: key,
            note: note || 'Generated by admin',
            createdAt: new Date().toISOString(),
            used: false,
            usedBy: null,
            usedAt: null
        });
        
        if (writeRegistrationKeys(keys)) {
            res.json({ success: true, key: key, message: 'Registration key generated' });
        } else {
            res.json({ success: false, message: 'Failed to generate key' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/admin/keys', requireAdmin, (req, res) => {
    try {
        const keys = readRegistrationKeys();
        res.json({ success: true, keys: keys });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/admin/keys/:key', requireAdmin, (req, res) => {
    try {
        const { key } = req.params;
        let keys = readRegistrationKeys();
        const initialLength = keys.length;
        
        keys = keys.filter(k => k.key !== key);
        
        if (keys.length < initialLength) {
            if (writeRegistrationKeys(keys)) {
                res.json({ success: true, message: 'Key deleted successfully' });
            } else {
                res.json({ success: false, message: 'Failed to delete key' });
            }
        } else {
            res.json({ success: false, message: 'Key not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/admin/users/:id/toggle', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const users = readUsers();
        const user = users.find(u => u.id === id);
        
        if (user) {
            user.isActive = !user.isActive;
            if (writeUsers(users)) {
                res.json({ 
                    success: true, 
                    message: `User ${user.isActive ? 'activated' : 'deactivated'}`,
                    user: user
                });
            } else {
                res.json({ success: false, message: 'Failed to update user' });
            }
        } else {
            res.json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ ADMIN BOT INSTANCES MANAGEMENT APIS
// =============================
app.get('/api/admin/instances', requireAdmin, (req, res) => {
    try {
        const instances = readBotInstances();
        res.json({ success: true, instances: instances });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/admin/instances', requireAdmin, (req, res) => {
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

        const instances = readBotInstances();
        
        if (instances.find(inst => inst.url === url)) {
            return res.json({ success: false, message: 'Instance already exists' });
        }

        const newInstance = { 
            id: Date.now().toString(), 
            url: url.trim(), 
            addedAt: new Date().toISOString(), 
            enabled: true,
            allocatedTo: null, // Not allocated to any user
            allocatedAt: null
        };

        instances.push(newInstance);
        
        if (writeBotInstances(instances)) {
            res.json({ 
                success: true, 
                message: 'Bot instance added successfully',
                instance: newInstance
            });
        } else {
            res.json({ success: false, message: 'Failed to add instance' });
        }
    } catch (error) {
        console.log('Error adding instance:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/admin/instances/:id', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        let instances = readBotInstances();
        const initialLength = instances.length;
        
        instances = instances.filter(inst => inst.id !== id);
        
        if (instances.length < initialLength) {
            if (writeBotInstances(instances)) {
                res.json({ success: true, message: 'Bot instance deleted successfully' });
            } else {
                res.json({ success: false, message: 'Failed to delete instance' });
            }
        } else {
            res.json({ success: false, message: 'Instance not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ USER INFO API
// =============================
app.get('/api/user-info', requireAuth, (req, res) => {
    try {
        const tokens = readTokens();
        const userToken = tokens.find(t => 
            t.username === req.session.user.username && 
            t.isActive && 
            new Date(t.expiresAt) > new Date()
        );
        
        const users = readUsers();
        const user = users.find(u => u.username === req.session.user.username);
        
        res.json({
            success: true,
            user: {
                username: req.session.user.username,
                email: req.session.user.email,
                role: req.session.user.role,
                allocatedBots: user?.allocatedBots || []
            },
            token: userToken ? userToken.token : null
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ TOKEN VERIFY API
// =============================
app.post('/api/verify-token', (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.json({ success: false, valid: false });
        }

        const tokens = readTokens();
        const validToken = tokens.find(t => 
            t.token === token && 
            t.isActive && 
            new Date(t.expiresAt) > new Date()
        );

        if (validToken) {
            const users = readUsers();
            const user = users.find(u => u.username === validToken.username);
            
            res.json({ 
                success: true, 
                valid: true, 
                username: validToken.username,
                role: user?.role || 'user'
            });
        } else {
            res.json({ success: true, valid: false });
        }
    } catch (error) {
        res.json({ success: false, valid: false });
    }
});

// =============================
// ✅ GET USER'S ALLOCATED BOT INSTANCES
// =============================
app.get('/api/user-bot-instances', requireAuth, (req, res) => {
    try {
        const users = readUsers();
        const instances = readBotInstances();
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
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ GET BOT INSTANCES FOR MAIN CONTROLLER (User specific)
// =============================
app.get('/api/bot-instances', (req, res) => {
    try {
        const token = req.query.token;
        
        if (!token) {
            return res.json({ success: false, message: 'Token required' });
        }

        // Verify token
        const tokens = readTokens();
        const validToken = tokens.find(t => 
            t.token === token && 
            t.isActive && 
            new Date(t.expiresAt) > new Date()
        );

        if (!validToken) {
            return res.json({ success: false, message: 'Invalid token' });
        }

        const users = readUsers();
        const instances = readBotInstances();
        const user = users.find(u => u.username === validToken.username);
        
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        // 🔥 RETURN ONLY USER'S ALLOCATED BOTS
        const userInstances = instances.filter(instance => 
            user.allocatedBots?.includes(instance.id)
        );

        res.json({ 
            success: true, 
            instances: userInstances,
            userBots: user.allocatedBots || []
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ INIT SERVER
// =============================
initializeFiles();

// Create super admin user if not exists
const users = readUsers();
if (!users.find(u => u.username === SUPER_ADMIN.username)) {
    bcrypt.hash(SUPER_ADMIN.password, 10).then(hashedPassword => {
        users.push({
            id: 'super-admin',
            username: SUPER_ADMIN.username,
            email: 'rahmttollahn@gmail.com',
            password: hashedPassword,
            role: 'super_admin',
            allocatedBots: [], // Super admin doesn't need bots
            createdAt: new Date().toISOString(),
            isActive: true
        });
        writeUsers(users);
        console.log('👑 SUPER ADMIN user created automatically!');
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🔐 Auth Server running on port ${PORT}`);
    console.log(`👑 Super Admin: ${SUPER_ADMIN.username}`);
    console.log(`🎯 Main Controller: ${MAIN_CONTROLLER_URL}`);
    console.log(`🤖 Bot Allocation System: Enabled`);
    console.log(`🚀 Smart Dashboard: Active`);
});
