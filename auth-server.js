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
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Rahmttollah';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Rahmttollah6677';

console.log('🔧 Admin Config:', {
    username: ADMIN_USERNAME,
    password: '***' // Password hide karo log mein
});

// File paths
const usersFile = path.join(__dirname, 'users.json');
const tokensFile = path.join(__dirname, 'tokens.json');
const registrationKeysFile = path.join(__dirname, 'registration-keys.json');
const instancesFile = path.join(__dirname, 'bot-instances.json');

// Initialize files
function initializeFiles() {
    if (!fs.existsSync(usersFile)) {
        fs.writeFileSync(usersFile, JSON.stringify([], null, 2));
        console.log('✅ users.json created');
    }
    if (!fs.existsSync(tokensFile)) {
        fs.writeFileSync(tokensFile, JSON.stringify([], null, 2));
        console.log('✅ tokens.json created');
    }
    if (!fs.existsSync(registrationKeysFile)) {
        fs.writeFileSync(registrationKeysFile, JSON.stringify([], null, 2));
        console.log('✅ registration-keys.json created');
    }
    if (!fs.existsSync(instancesFile)) {
        fs.writeFileSync(instancesFile, JSON.stringify([], null, 2));
        console.log('✅ bot-instances.json created');
    }
}

// Read/write functions
function readUsers() {
    try {
        const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        console.log(`📊 Users in DB: ${users.length}`);
        return users;
    } catch (error) {
        console.log('❌ Error reading users:', error.message);
        return [];
    }
}

function writeUsers(users) {
    try {
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
        console.log('✅ Users saved successfully');
        return true;
    } catch (error) {
        console.log('❌ Error writing users:', error.message);
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
// ✅ SIMPLE ADMIN PASSWORD CHECK (TEMPORARY FIX)
// =============================
async function checkAdminPassword(inputPassword) {
    console.log('🔐 Admin Password Check:');
    console.log('  - Input Password:', inputPassword);
    console.log('  - Expected Password:', ADMIN_PASSWORD);
    
    // Temporary: Direct compare for debugging
    const isMatch = inputPassword === ADMIN_PASSWORD;
    console.log('  - Match Result:', isMatch);
    
    return isMatch;
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
        res.sendFile(path.join(__dirname, 'public', 'auth-dashboard.html'));
    } else {
        res.redirect('/login');
    }
});

app.get('/login', (req, res) => {
    if (req.session.user && req.session.user.username) {
        const users = readUsers();
        const userExists = users.find(u => u.username === req.session.user.username && u.isActive);
        
        if (userExists) {
            return res.sendFile(path.join(__dirname, 'public', 'auth-dashboard.html'));
        } else {
            req.session.destroy();
        }
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    if (req.session.user) {
        res.sendFile(path.join(__dirname, 'public', 'auth-dashboard.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'register.html'));
    }
});

app.get('/admin', requireAdmin, (req, res) => {
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
// ✅ DEBUG LOGIN API
// =============================
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, rememberMe } = req.body;

        console.log('🚀 LOGIN ATTEMPT:');
        console.log('  - Username:', username);
        console.log('  - Password:', password);
        console.log('  - Remember Me:', rememberMe);

        if (!username || !password) {
            console.log('❌ Missing username or password');
            return res.json({ success: false, message: 'Username and password required' });
        }

        const users = readUsers();
        console.log('📋 All users:', users.map(u => ({ username: u.username, role: u.role })));

        const user = users.find(u => u.username === username && u.isActive);
        console.log('🔍 Found user:', user);
        
        if (!user) {
            console.log('❌ User not found or inactive');
            
            // Special case: Admin user doesn't exist in DB
            if (username === ADMIN_USERNAME) {
                console.log('👑 Admin user not in DB, creating...');
                const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
                const adminUser = {
                    id: 'admin',
                    username: ADMIN_USERNAME,
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
                console.log('✅ Admin user created in database');
                
                // Now check password
                const passwordValid = await checkAdminPassword(password);
                if (!passwordValid) {
                    console.log('❌ Admin password incorrect');
                    return res.json({ success: false, message: 'Invalid credentials' });
                }
                
                // Create session and token for admin
                const token = generateToken();
                const tokens = readTokens();
                
                tokens.push({
                    token: token,
                    username: ADMIN_USERNAME,
                    role: 'admin',
                    createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    isActive: true
                });
                writeTokens(tokens);

                req.session.user = { 
                    username: ADMIN_USERNAME,
                    email: 'rahmttollahn@gmail.com',
                    role: 'admin',
                    allocatedBots: []
                };
                
                if (rememberMe) {
                    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
                }

                console.log('✅ Admin login successful');
                return res.json({ 
                    success: true, 
                    message: 'Login successful',
                    token: token,
                    role: 'admin',
                    redirectUrl: '/dashboard'
                });
            }
            
            return res.json({ success: false, message: 'Invalid credentials' });
        }

        // Password verification
        let passwordValid = false;
        
        if (username === ADMIN_USERNAME) {
            console.log('🔐 Admin password verification');
            passwordValid = await checkAdminPassword(password);
        } else {
            console.log('🔐 User password verification with bcrypt');
            passwordValid = await bcrypt.compare(password, user.password);
            console.log('  - Bcrypt result:', passwordValid);
        }

        if (!passwordValid) {
            console.log('❌ Password verification failed');
            return res.json({ success: false, message: 'Invalid credentials' });
        }

        console.log('✅ Password verified successfully');

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

        console.log('✅ Login successful for user:', user.username);
        res.json({ 
            success: true, 
            message: 'Login successful',
            token: token,
            role: user.role,
            redirectUrl: '/dashboard'
        });
    } catch (error) {
        console.log('❌ Login error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// [REST OF THE APIs... SAME AS BEFORE]

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

// [ADD OTHER APIS HERE...]

// =============================
// ✅ INIT SERVER WITH DEBUG
// =============================
initializeFiles();

// Check and create admin user
const users = readUsers();
const adminUser = users.find(u => u.username === ADMIN_USERNAME);

if (!adminUser) {
    console.log('👑 Creating admin user on startup...');
    bcrypt.hash(ADMIN_PASSWORD, 10).then(hashedPassword => {
        const newAdminUser = {
            id: 'admin',
            username: ADMIN_USERNAME,
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
        
        users.push(newAdminUser);
        writeUsers(users);
        console.log('✅ Admin user created successfully!');
    });
} else {
    console.log('✅ Admin user already exists');
}

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 =================================');
    console.log('🔐 Auth Server Started Successfully!');
    console.log('🚀 =================================');
    console.log(`📡 Port: ${PORT}`);
    console.log(`👑 Admin Username: ${ADMIN_USERNAME}`);
    console.log(`🔑 Admin Password: ${ADMIN_PASSWORD}`);
    console.log(`🎯 Main Controller: ${MAIN_CONTROLLER_URL}`);
    console.log('🔧 Debug Mode: ACTIVE');
    console.log('=================================\n');
});
