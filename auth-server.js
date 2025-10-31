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
    if (req.session.user && req.session.user.username === ADMIN_CONFIG.username) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Routes
app.get('/', (req, res) => {
    if (req.session.user) {
        if (req.session.user.username === ADMIN_CONFIG.username) {
            res.redirect('/admin');
        } else {
            res.redirect('/dashboard');
        }
    } else {
        res.redirect('/login');
    }
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        if (req.session.user.username === ADMIN_CONFIG.username) {
            res.redirect('/admin');
        } else {
            res.redirect('/dashboard');
        }
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

app.get('/register', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'register.html'));
    }
});

app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

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
        const newUser = {
            id: Date.now().toString(),
            username,
            email,
            password: hashedPassword,
            createdAt: new Date().toISOString(),
            isActive: true
        };

        users.push(newUser);
        
        validKey.used = true;
        validKey.usedBy = username;
        validKey.usedAt = new Date().toISOString();
        writeRegistrationKeys(keys);

        if (writeUsers(users)) {
            res.json({ success: true, message: 'Registration successful' });
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
            isAdmin: user.username === ADMIN_CONFIG.username
        };
        
        if (rememberMe) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
        }

        res.json({ 
            success: true, 
            message: 'Login successful',
            token: token,
            isAdmin: user.username === ADMIN_CONFIG.username,
            redirectUrl: user.username === ADMIN_CONFIG.username ? '/admin' : `${MAIN_CONTROLLER_URL}/dashboard?token=${token}`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// =============================
// ✅ USER LOGOUT API
// =============================
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logout successful' });
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
            createdAt: user.createdAt,
            isActive: user.isActive,
            isAdmin: user.username === ADMIN_CONFIG.username
        }));
        res.json({ success: true, users: safeUsers });
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
// ✅ USER INFO API (Added)
// =============================
app.get('/api/user-info', requireAuth, (req, res) => {
    try {
        const tokens = readTokens();
        const userToken = tokens.find(t => 
            t.username === req.session.user.username && 
            t.isActive && 
            new Date(t.expiresAt) > new Date()
        );
        
        res.json({
            success: true,
            user: {
                username: req.session.user.username,
                email: req.session.user.email,
                isAdmin: req.session.user.isAdmin
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
            res.json({ 
                success: true, 
                valid: true, 
                username: validToken.username 
            });
        } else {
            res.json({ success: true, valid: false });
        }
    } catch (error) {
        res.json({ success: false, valid: false });
    }
});

// =============================
// ✅ INIT SERVER
// =============================
initializeFiles();

const users = readUsers();
if (!users.find(u => u.username === ADMIN_CONFIG.username)) {
    bcrypt.hash(ADMIN_CONFIG.password, 10).then(hashedPassword => {
        users.push({
            id: 'Rahmtollah',
            username: ADMIN_CONFIG.username,
            email: 'rahmttollahn@gmail.com',
            password: RIFAT6677,
            createdAt: new Date().toISOString(),
            isActive: true
        });
        writeUsers(users);
        console.log('👑 Admin user created');
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🔐 Auth Server running on port ${PORT}`);
    console.log(`👑 Admin: ${ADMIN_CONFIG.username}`);
    console.log(`🎯 Main Controller: ${MAIN_CONTROLLER_URL}`);
});
