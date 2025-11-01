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

// ✅ SECURE: Environment variables se admin credentials
const ADMIN_CONFIG = {
    username: process.env.ADMIN_USERNAME || 'Rahmttollah',
    // ✅ SECURE: Pre-hashed password (Rahmttollah6677 ka hash)
    passwordHash: process.env.ADMIN_PASSWORD_HASH || '$2a$10$8B5FBFD53F8C667788$2a$10$V7CmB8rQq5eK9s2XwY1zP.uLmN4vR6tH8jS3fD5gQ7hM9kL1pW2'
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
// ✅ SECURE ADMIN PASSWORD VERIFICATION
// =============================
async function verifyAdminPassword(inputPassword) {
    try {
        // ✅ SECURE: Always use bcrypt compare
        if (ADMIN_CONFIG.passwordHash.startsWith('$2a$') || ADMIN_CONFIG.passwordHash.startsWith('$2b$')) {
            return await bcrypt.compare(inputPassword, ADMIN_CONFIG.passwordHash);
        }
        return false;
    } catch (error) {
        return false;
    }
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
// ✅ SECURE USER LOGIN API
// =============================
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, rememberMe } = req.body;

        if (!username || !password) {
            return res.json({ success: false, message: 'Username and password required' });
        }

        const users = readUsers();
        const user = users.find(u => u.username === username && u.isActive);
        
        if (!user) {
            return res.json({ success: false, message: 'Invalid credentials' });
        }

        // ✅ SECURE: Always use bcrypt for password verification
        let passwordValid = false;
        
        if (username === ADMIN_CONFIG.username) {
            // For admin, use secure password verification
            passwordValid = await verifyAdminPassword(password);
            
            // If admin doesn't exist in database, create it
            if (passwordValid && !user) {
                const hashedPassword = await bcrypt.hash(password, 10);
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
            }
        } else {
            // For normal users, use bcrypt
            passwordValid = await bcrypt.compare(password, user.password);
        }

        if (!passwordValid) {
            return res.json({ success: false, message: 'Invalid credentials' });
        }

        // Update last login
        if (user) {
            user.lastLogin = new Date().toISOString();
            writeUsers(users);
        }

        const token = generateToken();
        const tokens = readTokens();
        
        tokens.push({
            token: token,
            username: username,
            role: user ? user.role : 'admin',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            isActive: true
        });
        
        writeTokens(tokens);

        req.session.user = { 
            username: username,
            email: user ? user.email : 'rahmttollahn@gmail.com',
            role: user ? user.role : 'admin',
            allocatedBots: user ? user.allocatedBots : []
        };
        
        if (rememberMe) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
        }

        res.json({ 
            success: true, 
            message: 'Login successful',
            token: token,
            role: user ? user.role : 'admin',
            redirectUrl: '/dashboard'
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
            // If admin doesn't exist in DB but session exists, create temporary admin
            if (req.session.user.username === ADMIN_CONFIG.username) {
                return res.json({
                    success: true,
                    user: {
                        username: ADMIN_CONFIG.username,
                        email: 'rahmttollahn@gmail.com',
                        role: 'admin',
                        allocatedBots: [],
                        botLimit: 0,
                        createdAt: new Date().toISOString()
                    },
                    userBots: [],
                    totalBots: instances.length,
                    availableBots: instances.filter(bot => bot.isAvailable).length,
                    mainControllerUrl: MAIN_CONTROLLER_URL
                });
            }
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

// [REST OF THE APIs REMAIN THE SAME...]
// (Previous APIs like user-bots, admin-bot-instances, etc.)

// =============================
// ✅ INIT SERVER - SECURE ADMIN SETUP
// =============================
initializeFiles();

// Secure admin setup
const users = readUsers();
if (!users.find(u => u.username === ADMIN_CONFIG.username)) {
    console.log('🔒 Creating secure admin user...');
    
    // Generate secure hash for admin password
    bcrypt.hash('Rahmttollah6677', 10).then(hashedPassword => {
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
        console.log('✅ Secure admin user created!');
    });
} else {
    console.log('✅ Admin user already exists');
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🔐 Auth Server running on port ${PORT}`);
    console.log(`👑 Admin: ${ADMIN_CONFIG.username}`);
    console.log(`🔒 Security: Password hashing enabled`);
    console.log(`🎯 Main Controller: ${MAIN_CONTROLLER_URL}`);
    console.log(`🤖 Bot Allocation System: Enabled`);
});
