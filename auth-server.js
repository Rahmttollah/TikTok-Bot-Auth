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
    secret: process.env.SESSION_SECRET || 'i-love-my-family-667788',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));

// Main Controller URL
const MAIN_CONTROLLER_URL = 'https://tiktok-view-bot.up.railway.app';

// Admin Configuration
const ADMIN_CONFIG = {
    username: process.env.ADMIN_USERNAME || 'Rahmttollah',
    password: process.env.ADMIN_PASSWORD || 'Rahmttollah6677'
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

// Allocate bots to new user
function allocateBotsToUser(username) {
    const instances = readBotInstances();
    const availableBots = instances.filter(bot => bot.isAvailable && bot.enabled);
    
    if (availableBots.length < 3) {
        console.log(`Not enough available bots for user ${username}`);
        return [];
    }
    
    // Select 3 random bots
    const selectedBots = [];
    const shuffled = [...availableBots].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < 3 && i < shuffled.length; i++) {
        selectedBots.push(shuffled[i].id);
        
        // Update bot allocation
        const botIndex = instances.findIndex(bot => bot.id === shuffled[i].id);
        if (botIndex !== -1) {
            instances[botIndex].allocatedTo = username;
            instances[botIndex].isAvailable = false;
        }
    }
    
    writeBotInstances(instances);
    return selectedBots;
}

// =============================
// ✅ TOKEN VERIFICATION MIDDLEWARE
// =============================
function verifyToken(req, res, next) {
    const token = req.query.token || req.body.token;
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Token required' });
    }

    const tokens = readTokens();
    const validToken = tokens.find(t => 
        t.token === token && 
        t.isActive && 
        new Date(t.expiresAt) > new Date()
    );

    if (validToken) {
        req.user = {
            username: validToken.username,
            role: validToken.role
        };
        next();
    } else {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
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
    if (req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'subadmin')) {
        next();
    } else {
        if (req.originalUrl.startsWith('/api/')) {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        res.redirect('/login');
    }
}

function requireMainAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        if (req.originalUrl.startsWith('/api/')) {
            return res.status(403).json({ success: false, message: 'Main admin access required' });
        }
        res.redirect('/login');
    }
}

// Routes
app.get('/', (req, res) => {
    if (req.session.user) {
        // Show auth dashboard instead of direct redirect
        res.sendFile(path.join(__dirname, 'public', 'auth-dashboard.html'));
    } else {
        res.redirect('/login');
    }
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        res.sendFile(path.join(__dirname, 'public', 'auth-dashboard.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

app.get('/register', (req, res) => {
    if (req.session.user) {
        res.sendFile(path.join(__dirname, 'public', 'auth-dashboard.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'register.html'));
    }
});

app.get('/admin', requireAdmin, (req, res) => {
    // Strict admin verification
    if (req.session.user.role === 'admin' || req.session.user.role === 'subadmin') {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } else {
        res.redirect(`${MAIN_CONTROLLER_URL}/dashboard?token=${getUserToken(req.session.user.username)}`);
    }
});

app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'auth-dashboard.html'));
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
        
        // Allocate bots to new user
        const allocatedBots = allocateBotsToUser(username);
        
        const newUser = {
            id: Date.now().toString(),
            username,
            email,
            password: hashedPassword,
            role: 'user',
            allocatedBots: allocatedBots,
            botLimit: 3,
            createdBy: 'system',
            createdAt: new Date().toISOString(),
            isActive: true,
            lastLogin: null
        };

        users.push(newUser);
        
        validKey.used = true;
        validKey.usedBy = username;
        validKey.usedAt = new Date().toISOString();
        writeRegistrationKeys(keys);

        if (writeUsers(users)) {
            res.json({ 
                success: true, 
                message: 'Registration successful',
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
// ✅ USER LOGIN API
// =============================
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, rememberMe } = req.body;

        if (!username || !password) {
            return res.json({ success: false, message: 'Username and password required' });
        }

        const users = readUsers();
        const user = users.find(u => u.username === username && u.isActive);
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.json({ success: false, message: 'Invalid credentials' });
        }

        // Update last login
        user.lastLogin = new Date().toISOString();
        writeUsers(users);

        const token = generateToken();
        const tokens = readTokens();
        
        tokens.push({
            token: token,
            username: user.username,
            role: user.role,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            isActive: true
        });
        
        writeTokens(tokens);

        req.session.user = { 
            username: user.username,
            email: user.email,
            role: user.role,
            allocatedBots: user.allocatedBots
        };
        
        if (rememberMe) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
        }

        res.json({ 
            success: true, 
            message: 'Login successful',
            token: token,
            role: user.role,
            redirectUrl: '/dashboard' // Always go to auth dashboard first
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ USER LOGOUT API
// =============================
app.post('/api/logout', (req, res) => {
    const token = req.body.token || req.query.token;
    
    // Deactivate token
    if (token) {
        const tokens = readTokens();
        const tokenIndex = tokens.findIndex(t => t.token === token);
        if (tokenIndex !== -1) {
            tokens[tokenIndex].isActive = false;
            writeTokens(tokens);
        }
    }
    
    req.session.destroy();
    res.json({ success: true, message: 'Logout successful' });
});

// =============================
// ✅ AUTH DASHBOARD API
// =============================
app.get('/api/auth-dashboard', requireAuth, (req, res) => {
    try {
        const users = readUsers();
        const instances = readBotInstances();
        const user = users.find(u => u.username === req.session.user.username);
        
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        const userBots = instances.filter(bot => 
            user.allocatedBots.includes(bot.id)
        );

        res.json({
            success: true,
            user: {
                username: user.username,
                email: user.email,
                role: user.role,
                allocatedBots: user.allocatedBots,
                botLimit: user.botLimit,
                createdAt: user.createdAt
            },
            userBots: userBots,
            totalBots: instances.length,
            availableBots: instances.filter(bot => bot.isAvailable).length,
            mainControllerUrl: MAIN_CONTROLLER_URL
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ REDIRECT TO MAIN CONTROLLER
// =============================
app.post('/api/redirect-to-controller', requireAuth, (req, res) => {
    try {
        const token = getUserToken(req.session.user.username);
        if (token) {
            res.json({ 
                success: true, 
                redirectUrl: `${MAIN_CONTROLLER_URL}/dashboard?token=${token}`
            });
        } else {
            res.json({ success: false, message: 'Token not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ GET USER'S ALLOCATED BOTS API
// =============================
app.get('/api/user-bots', verifyToken, (req, res) => {
    try {
        const instances = readBotInstances();
        const users = readUsers();
        
        const user = users.find(u => u.username === req.user.username);
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        const allocatedBots = instances.filter(bot => 
            user.allocatedBots.includes(bot.id)
        );

        res.json({
            success: true,
            allocatedBots: allocatedBots,
            user: {
                username: user.username,
                role: user.role,
                botLimit: user.botLimit
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ ADMIN BOT INSTANCES API
// =============================
app.get('/api/admin/bot-instances', requireAdmin, (req, res) => {
    try {
        const instances = readBotInstances();
        res.json({ success: true, instances: instances });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ REALLOCATE BOTS API
// =============================
app.post('/api/admin/reallocate-bots', requireAdmin, (req, res) => {
    try {
        const { userId } = req.body;
        
        const users = readUsers();
        const instances = readBotInstances();
        
        const user = users.find(u => u.id === userId);
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        // Free up user's current bots
        user.allocatedBots.forEach(botId => {
            const botIndex = instances.findIndex(bot => bot.id === botId);
            if (botIndex !== -1) {
                instances[botIndex].allocatedTo = null;
                instances[botIndex].isAvailable = true;
            }
        });

        // Allocate new bots
        const availableBots = instances.filter(bot => bot.isAvailable && bot.enabled);
        const newAllocations = [];
        
        const shuffled = [...availableBots].sort(() => 0.5 - Math.random());
        for (let i = 0; i < user.botLimit && i < shuffled.length; i++) {
            newAllocations.push(shuffled[i].id);
            
            const botIndex = instances.findIndex(bot => bot.id === shuffled[i].id);
            if (botIndex !== -1) {
                instances[botIndex].allocatedTo = user.username;
                instances[botIndex].isAvailable = false;
            }
        }

        user.allocatedBots = newAllocations;
        
        if (writeUsers(users) && writeBotInstances(instances)) {
            res.json({
                success: true,
                message: `Bots reallocated successfully. ${newAllocations.length} bots allocated.`,
                allocatedBots: newAllocations
            });
        } else {
            res.json({ success: false, message: 'Failed to reallocate bots' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ VERIFY TOKEN API
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
            res.json({ 
                success: true, 
                valid: true, 
                username: validToken.username,
                role: validToken.role
            });
        } else {
            res.json({ success: true, valid: false });
        }
    } catch (error) {
        res.json({ success: false, valid: false });
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
            allocatedBots: user.allocatedBots,
            botLimit: user.botLimit,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            isActive: user.isActive,
            createdBy: user.createdBy
        }));
        res.json({ success: true, users: safeUsers });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create sub-admin or promote user
app.post('/api/admin/promote-user', requireMainAdmin, (req, res) => {
    try {
        const { userId, newRole } = req.body;
        
        if (!['user', 'subadmin'].includes(newRole)) {
            return res.json({ success: false, message: 'Invalid role' });
        }

        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            return res.json({ success: false, message: 'User not found' });
        }

        users[userIndex].role = newRole;
        users[userIndex].createdBy = req.session.user.username;
        
        if (writeUsers(users)) {
            res.json({ 
                success: true, 
                message: `User promoted to ${newRole} successfully`,
                user: users[userIndex]
            });
        } else {
            res.json({ success: false, message: 'Failed to promote user' });
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
            name: `Bot Instance ${Date.now().toString().substring(8)}`,
            allocatedTo: null,
            isAvailable: true,
            enabled: true,
            addedAt: new Date().toISOString(), 
            lastSeen: new Date().toISOString()
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
// ✅ GET BOT INSTANCES FOR MAIN CONTROLLER
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

        const instances = readBotInstances();
        res.json({ success: true, instances: instances });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ INIT SERVER
// =============================
initializeFiles();

// Create admin user if not exists
const users = readUsers();
if (!users.find(u => u.username === ADMIN_CONFIG.username)) {
    bcrypt.hash(ADMIN_CONFIG.password, 10).then(hashedPassword => {
        const adminUser = {
            id: 'admin',
            username: ADMIN_CONFIG.username,
            email: 'rahmttollahn@gmail.com',
            password: hashedPassword,
            role: 'admin',
            allocatedBots: [],
            botLimit: 0,
            createdBy: 'system',
            createdAt: new Date().toISOString(),
            isActive: true,
            lastLogin: new Date().toISOString()
        };
        
        users.push(adminUser);
        writeUsers(users);
        console.log('👑 Admin user created automatically!');
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🔐 Auth Server running on port ${PORT}`);
    console.log(`👑 Admin: ${ADMIN_CONFIG.username}`);
    console.log(`🎯 Main Controller: ${MAIN_CONTROLLER_URL}`);
    console.log(`🤖 Bot Allocation System: Enabled`);
    console.log(`🔑 Token Verification: Active`);
    console.log(`🚀 All APIs: Ready`);
});
