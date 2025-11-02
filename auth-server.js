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
// Session middleware with better configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'super-secret-key-2024-fixed',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        sameSite: 'lax'
    },
    name: 'tiktokbot.sid' // Specific session name
}));

// ✅ ADD SESSION CLEANUP MIDDLEWARE
app.use((req, res, next) => {
    // Prevent redirect loops by checking path
    if (req.path === '/login' && req.session.user) {
        console.log('🔄 Login route accessed with active session');
        // Continue normally, let the login route handle it
    }
    next();
});

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

// ✅ FIXED BOT ALLOCATION - Priority to users without bots
function allocateBotsToUser(username) {
    const instances = readBotInstances();
    const users = readUsers();
    
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
        const botIndex = instances.findIndex(bot => bot.id === shuffled[i].id);
        if (botIndex !== -1) {
            instances[botIndex].allocatedTo = username;
            instances[botIndex].allocatedAt = new Date().toISOString();
        }
    }
    
    // Update instances file
    if (writeBotInstances(instances)) {
        console.log(`✅ Allocated ${selectedBots.length} bots to ${username}:`, selectedBots);
    } else {
        console.log(`❌ Failed to save bot allocation for ${username}`);
    }
    
    return selectedBots;
}

// ✅ NEW FUNCTION: Assign bots to existing users without bots
function assignBotsToExistingUsers() {
    const users = readUsers();
    const instances = readBotInstances();
    
    let assignedCount = 0;
    
    users.forEach(user => {
        // Check if user has less than 3 bots
        const currentBots = user.allocatedBots?.length || 0;
        if (currentBots < 3) {
            const availableBots = instances.filter(bot => 
                !bot.allocatedTo && bot.enabled
            );
            
            const botsNeeded = 3 - currentBots;
            const botsToAssign = Math.min(availableBots.length, botsNeeded);
            
            if (botsToAssign > 0) {
                const shuffled = [...availableBots].sort(() => 0.5 - Math.random());
                
                for (let i = 0; i < botsToAssign; i++) {
                    if (!user.allocatedBots) user.allocatedBots = [];
                    user.allocatedBots.push(shuffled[i].id);
                    
                    // Mark bot as allocated
                    const botIndex = instances.findIndex(bot => bot.id === shuffled[i].id);
                    if (botIndex !== -1) {
                        instances[botIndex].allocatedTo = user.username;
                        instances[botIndex].allocatedAt = new Date().toISOString();
                    }
                }
                
                assignedCount += botsToAssign;
                console.log(`✅ Assigned ${botsToAssign} bots to existing user ${user.username}`);
            }
        }
    });
    
    if (assignedCount > 0) {
        writeUsers(users);
        writeBotInstances(instances);
        console.log(`🎯 Total ${assignedCount} bots assigned to existing users`);
    }
    
    return assignedCount;
}

// 🔥 GET BOT STATISTICS
function getBotStatistics() {
    const instances = readBotInstances();
    const users = readUsers();
    
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

// ✅ FIXED ROOT ROUTE - No redirect loops
app.get('/', (req, res) => {
    if (req.session.user) {
        // If user is admin, show admin dashboard
        if (req.session.user.role === 'super_admin' || req.session.user.role === 'sub_admin') {
            return res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
        } else {
            // Normal user - redirect to main controller with token
            const token = getUserToken(req.session.user.username);
            if (token) {
                return res.redirect(`${MAIN_CONTROLLER_URL}/dashboard?token=${token}`);
            }
        }
    }
    // No user session - show login page
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ✅ FIXED LOGIN ROUTE
app.get('/login', (req, res) => {
    if (req.session.user) {
        // Already logged in - redirect appropriately
        if (req.session.user.role === 'super_admin' || req.session.user.role === 'sub_admin') {
            return res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
        } else {
            const token = getUserToken(req.session.user.username);
            if (token) {
                return res.redirect(`${MAIN_CONTROLLER_URL}/dashboard?token=${token}`);
            }
        }
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    if (req.session.user) {
        res.redirect(`${MAIN_CONTROLLER_URL}/dashboard?token=${getUserToken(req.session.user.username)}`);
    } else {
        res.sendFile(path.join(__dirname, 'public', 'register.html'));
    }
});

// ✅ FIXED ADMIN ROUTE
app.get('/admin', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    // Only allow if user is admin
    if (req.session.user.role === 'super_admin' || req.session.user.role === 'sub_admin') {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } else {
        // Normal users get redirected to main controller
        const token = getUserToken(req.session.user.username);
        if (token) {
            res.redirect(`${MAIN_CONTROLLER_URL}/dashboard?token=${token}`);
        } else {
            res.redirect('/login');
        }
    }
});

// ✅ FIXED DASHBOARD ROUTE
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    const userType = req.query.type;
    if (userType === 'admin' && (req.session.user.role === 'super_admin' || req.session.user.role === 'sub_admin')) {
        res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
    } else {
        // Normal user - redirect to main controller
        const token = getUserToken(req.session.user.username);
        if (token) {
            res.redirect(`${MAIN_CONTROLLER_URL}/dashboard?token=${token}`);
        } else {
            res.redirect('/login');
        }
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
// ✅ FIXED PROMOTE USER API
// =============================
app.post('/api/admin/promote-user', requireSuperAdmin, (req, res) => {
    try {
        const { userId, newRole } = req.body;
        
        console.log(`Promote user: ${userId} to ${newRole}`);
        
        if (!['user', 'sub_admin'].includes(newRole)) {
            return res.json({ success: false, message: '❌ Invalid role' });
        }

        const users = readUsers();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return res.json({ success: false, message: '❌ User not found' });
        }

        // Don't allow demoting super admin
        if (user.role === 'super_admin') {
            return res.json({ success: false, message: '❌ Cannot modify Super Admin' });
        }

        const oldRole = user.role;
        user.role = newRole;
        
        if (writeUsers(users)) {
            res.json({ 
                success: true, 
                message: `✅ User ${user.username} ${newRole === 'sub_admin' ? 'promoted to Sub Admin' : 'demoted to User'}`,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            });
            console.log(`✅ User ${user.username} role changed from ${oldRole} to ${newRole}`);
        } else {
            res.json({ success: false, message: '❌ Failed to update user' });
        }
    } catch (error) {
        console.error('❌ Promote user error:', error);
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

// =============================
// ✅ FIXED BOT REMOVAL API
// =============================
app.post('/api/admin/users/:userId/manage-bots', requireAdmin, (req, res) => {
    try {
        const { userId } = req.params;
        const { action, botId } = req.body;
        
        console.log(`Bot management: ${action} for user ${userId}, bot: ${botId}`);
        
        const users = readUsers();
        const instances = readBotInstances();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        if (!user.allocatedBots) user.allocatedBots = [];

        if (action === 'add_bot') {
            // Check if user already has 3 bots
            if (user.allocatedBots.length >= 3) {
                return res.json({ success: false, message: 'User already has maximum 3 bots' });
            }
            
            // Find available bot
            const availableBot = instances.find(bot => 
                !bot.allocatedTo && bot.enabled && bot.id === botId
            );
            
            if (!availableBot) {
                return res.json({ success: false, message: 'Bot not available or already allocated' });
            }

            // Add to user
            user.allocatedBots.push(availableBot.id);
            
            // Update bot allocation
            const botIndex = instances.findIndex(bot => bot.id === availableBot.id);
            instances[botIndex].allocatedTo = user.username;
            instances[botIndex].allocatedAt = new Date().toISOString();

            if (writeUsers(users) && writeBotInstances(instances)) {
                res.json({ 
                    success: true, 
                    message: `✅ Bot allocated to ${user.username}`,
                    allocatedBots: user.allocatedBots
                });
            } else {
                res.json({ success: false, message: '❌ Failed to update databases' });
            }

        } else if (action === 'remove_bot' && botId) {
            console.log(`Removing bot ${botId} from user ${user.username}`);
            
            // Check if user has this bot
            if (!user.allocatedBots.includes(botId)) {
                return res.json({ success: false, message: '❌ User does not have this bot' });
            }
            
            // Remove from user
            user.allocatedBots = user.allocatedBots.filter(bot => bot !== botId);
            
            // Free the bot
            const botIndex = instances.findIndex(bot => bot.id === botId);
            if (botIndex !== -1) {
                instances[botIndex].allocatedTo = null;
                instances[botIndex].allocatedAt = null;
                console.log(`✅ Bot ${botId} freed from user ${user.username}`);
            }

            const usersWritten = writeUsers(users);
            const instancesWritten = writeBotInstances(instances);
            
            if (usersWritten && instancesWritten) {
                res.json({ 
                    success: true, 
                    message: `✅ Bot removed from ${user.username}`,
                    allocatedBots: user.allocatedBots
                });
            } else {
                res.json({ success: false, message: '❌ Failed to update databases' });
            }
        } else {
            res.json({ success: false, message: '❌ Invalid action' });
        }
    } catch (error) {
        console.error('❌ Bot management error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// =============================
// ✅ GET BOT STATISTICS API
// =============================
app.get('/api/admin/bot-statistics', requireAdmin, (req, res) => {
    try {
        const stats = getBotStatistics();
        res.json({ success: true, statistics: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ GET USER BOT DETAILS API
// =============================
app.get('/api/admin/users/:userId/bot-details', requireAdmin, (req, res) => {
    try {
        const { userId } = req.params;
        const users = readUsers();
        const instances = readBotInstances();
        
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
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ BULK ADD BOT INSTANCES
// =============================
app.post('/api/admin/bulk-add-instances', requireAdmin, (req, res) => {
    try {
        const { urls } = req.body; // Array of URLs
        
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.json({ success: false, message: 'URLs array required' });
        }

        const instances = readBotInstances();
        const results = {
            added: 0,
            failed: 0,
            duplicates: 0,
            details: []
        };

        urls.forEach(url => {
            const trimmedUrl = url.trim();
            
            if (!trimmedUrl) {
                results.failed++;
                results.details.push({ url: trimmedUrl, status: 'empty', error: 'Empty URL' });
                return;
            }

            // Validate URL
            try {
                new URL(trimmedUrl);
            } catch (error) {
                results.failed++;
                results.details.push({ url: trimmedUrl, status: 'invalid', error: 'Invalid URL' });
                return;
            }

            // Check for duplicates
            if (instances.find(inst => inst.url === trimmedUrl)) {
                results.duplicates++;
                results.details.push({ url: trimmedUrl, status: 'duplicate', error: 'Already exists' });
                return;
            }

            // Add instance
            const newInstance = { 
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                url: trimmedUrl, 
                addedAt: new Date().toISOString(), 
                enabled: true,
                allocatedTo: null,
                allocatedAt: null
            };

            instances.push(newInstance);
            results.added++;
            results.details.push({ url: trimmedUrl, status: 'added', id: newInstance.id });
        });

        if (writeBotInstances(instances)) {
            res.json({ 
                success: true, 
                message: `Bulk add completed: ${results.added} added, ${results.duplicates} duplicates, ${results.failed} failed`,
                results: results
            });
        } else {
            res.json({ success: false, message: 'Failed to save instances' });
        }
    } catch (error) {
        console.error('Bulk add error:', error);
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

// ✅ FIXED DELETE KEY API
app.delete('/api/admin/keys/:key', requireAdmin, (req, res) => {
    try {
        const { key } = req.params;
        console.log(`Deleting key: ${key}`);
        
        let keys = readRegistrationKeys();
        const initialLength = keys.length;
        
        keys = keys.filter(k => k.key !== key);
        
        if (keys.length < initialLength) {
            if (writeRegistrationKeys(keys)) {
                console.log(`✅ Key ${key} deleted successfully`);
                res.json({ success: true, message: '✅ Key deleted successfully' });
            } else {
                res.json({ success: false, message: '❌ Failed to delete key' });
            }
        } else {
            res.json({ success: false, message: '❌ Key not found' });
        }
    } catch (error) {
        console.error('❌ Delete key error:', error);
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

// ✅ FIXED DELETE BOT INSTANCE API
app.delete('/api/admin/instances/:id', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Deleting bot instance: ${id}`);
        
        let instances = readBotInstances();
        const initialLength = instances.length;
        
        // Find instance to get details
        const instanceToDelete = instances.find(inst => inst.id === id);
        
        instances = instances.filter(inst => inst.id !== id);
        
        if (instances.length < initialLength) {
            if (writeBotInstances(instances)) {
                console.log(`✅ Bot instance ${id} deleted successfully`);
                
                // If instance was allocated to a user, remove from user's allocated bots
                if (instanceToDelete && instanceToDelete.allocatedTo) {
                    const users = readUsers();
                    const user = users.find(u => u.username === instanceToDelete.allocatedTo);
                    if (user && user.allocatedBots) {
                        user.allocatedBots = user.allocatedBots.filter(botId => botId !== id);
                        writeUsers(users);
                        console.log(`✅ Also removed from user ${instanceToDelete.allocatedTo}`);
                    }
                }
                
                res.json({ success: true, message: '✅ Bot instance deleted successfully' });
            } else {
                res.json({ success: false, message: '❌ Failed to delete instance' });
            }
        } else {
            res.json({ success: false, message: '❌ Instance not found' });
        }
    } catch (error) {
        console.error('❌ Delete instance error:', error);
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
    console.log(`📊 Bot Statistics API: Available`);
    console.log(`🔧 Bot Management API: Enhanced`);
    console.log(`🔄 Redirect Loops: FIXED`);
    console.log(`📦 Bulk Bot Addition: Available`);
});
