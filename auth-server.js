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
    secret: process.env.SESSION_SECRET || 'auth-server-super-secret-2024',
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
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123'
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
        res.status(401).json({ success: false, message: 'Authentication required' });
    }
}

function requireAdmin(req, res, next) {
    if (req.session.user && req.session.user.username === ADMIN_CONFIG.username) {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Admin access required' });
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
    // Redirect to main controller with token
    const tokens = readTokens();
    const userToken = tokens.find(t => t.username === req.session.user.username && t.isActive);
    
    if (userToken) {
        res.redirect(`${MAIN_CONTROLLER_URL}/dashboard?token=${userToken.token}`);
    } else {
        res.redirect('/login');
    }
});

// Auth APIs
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, registrationKey } = req.body;
        
        if (!username || !email || !password || !registrationKey) {
            return res.json({ success: false, message: 'All fields are required' });
        }

        // Validate registration key
        const keys = readRegistrationKeys();
        const validKey = keys.find(k => k.key === registrationKey && k.used === false);
        
        if (!validKey) {
            return res.json({ success: false, message: 'Invalid or used registration key' });
        }

        const users = readUsers();
        
        // Check if username or email exists
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
        
        // Mark key as used
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

        // Generate access token for main controller
        const token = generateToken();
        const tokens = readTokens();
        
        // Deactivate old tokens for this user
        tokens.forEach(t => {
            if (t.username === user.username) {
                t.isActive = false;
            }
        });
        
        tokens.push({
            token: token,
            username: user.username,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
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
            redirectUrl: `${MAIN_CONTROLLER_URL}/dashboard?token=${token}`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/logout', (req, res) => {
    // Deactivate user's tokens
    if (req.session.user) {
        const tokens = readTokens();
        tokens.forEach(t => {
            if (t.username === req.session.user.username) {
                t.isActive = false;
            }
        });
        writeTokens(tokens);
    }
    
    req.session.destroy();
    res.json({ success: true, message: 'Logout successful' });
});

// Admin APIs
app.get('/api/admin/users', requireAdmin, (req, res) => {
    try {
        const users = readUsers();
        // Remove passwords from response
        const safeUsers = users.map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            isActive: user.isActive
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

app.post('/api/admin/delete-user', requireAdmin, (req, res) => {
    try {
        const { userId } = req.body;
        let users = readUsers();
        const initialLength = users.length;
        
        users = users.filter(user => user.id !== userId);
        
        if (users.length < initialLength) {
            if (writeUsers(users)) {
                res.json({ success: true, message: 'User deleted successfully' });
            } else {
                res.json({ success: false, message: 'Failed to delete user' });
            }
        } else {
            res.json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Token verification API (Main controller will call this)
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
                isAdmin: validToken.username === ADMIN_CONFIG.username
            });
        } else {
            res.json({ success: true, valid: false });
        }
    } catch (error) {
        res.json({ success: false, valid: false });
    }
});

// Initialize server
initializeFiles();

// Create admin user if not exists
const users = readUsers();
if (!users.find(u => u.username === ADMIN_CONFIG.username)) {
    bcrypt.hash(ADMIN_CONFIG.password, 10).then(hashedPassword => {
        users.push({
            id: 'admin',
            username: ADMIN_CONFIG.username,
            email: 'admin@system.com',
            password: hashedPassword,
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
