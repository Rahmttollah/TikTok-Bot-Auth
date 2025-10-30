const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'auth-server-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));

// Admin configuration
const ADMIN_CONFIG = {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123'
};

// File paths
const usersFile = path.join(__dirname, 'users.json');
const registrationKeysFile = path.join(__dirname, 'registration-keys.json');
const botInstancesFile = path.join(__dirname, 'bot-instances.json');

// Helper functions
function readJSON(file) {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
    } catch (error) {
        console.log(`Error reading ${file}:`, error);
    }
    return [];
}

function writeJSON(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.log(`Error writing ${file}:`, error);
        return false;
    }
}

// Initialize files
function initializeFiles() {
    if (!fs.existsSync(usersFile)) writeJSON(usersFile, []);
    if (!fs.existsSync(registrationKeysFile)) writeJSON(registrationKeysFile, []);
    if (!fs.existsSync(botInstancesFile)) writeJSON(botInstancesFile, []);
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
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Admin access required' });
    }
}

// Routes
app.get('/', (req, res) => {
    if (req.session.user) {
        if (req.session.user.role === 'admin') {
            res.redirect('/admin');
        } else {
            res.redirect('/dashboard');
        }
    } else {
        res.redirect('/login');
    }
});

// Serve static pages
app.get('/login', (req, res) => {
    if (req.session.user) {
        req.session.user.role === 'admin' ? res.redirect('/admin') : res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

app.get('/register', (req, res) => {
    if (req.session.user) {
        req.session.user.role === 'admin' ? res.redirect('/admin') : res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'register.html'));
    }
});

app.get('/dashboard', requireAuth, (req, res) => {
    if (req.session.user.role === 'admin') {
        res.redirect('/admin');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'user-dashboard.html'));
    }
});

app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// Auth APIs
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, rememberMe } = req.body;

        if (!username || !password) {
            return res.json({ success: false, message: 'Username and password required' });
        }

        // Check admin login
        if (username === ADMIN_CONFIG.username && password === ADMIN_CONFIG.password) {
            req.session.user = { 
                username: username, 
                role: 'admin',
                loginTime: new Date().toISOString()
            };
            
            if (rememberMe) {
                req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
            }
            
            return res.json({ 
                success: true, 
                message: 'Admin login successful',
                role: 'admin'
            });
        }

        // Check user login
        const users = readJSON(usersFile);
        const user = users.find(u => u.username === username && u.active);
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.json({ success: false, message: 'Invalid credentials' });
        }

        req.session.user = { 
            username: username, 
            role: 'user',
            userId: user.id,
            loginTime: new Date().toISOString()
        };
        
        if (rememberMe) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
        }

        res.json({ 
            success: true, 
            message: 'Login successful',
            role: 'user'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { username, password, registrationKey } = req.body;
        
        if (!username || !password || !registrationKey) {
            return res.json({ success: false, message: 'All fields required' });
        }

        // Validate registration key
        const keys = readJSON(registrationKeysFile);
        const validKey = keys.find(k => k.key === registrationKey && !k.used && new Date(k.expires) > new Date());
        
        if (!validKey) {
            return res.json({ success: false, message: 'Invalid or expired registration key' });
        }

        const users = readJSON(usersFile);
        
        if (users.find(u => u.username === username)) {
            return res.json({ success: false, message: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: Date.now().toString(),
            username: username,
            password: hashedPassword,
            registrationKey: registrationKey,
            active: true,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        users.push(newUser);
        
        // Mark key as used
        validKey.used = true;
        validKey.usedBy = username;
        validKey.usedAt = new Date().toISOString();
        writeJSON(registrationKeysFile, keys);

        if (writeJSON(usersFile, users)) {
            res.json({ 
                success: true, 
                message: 'Registration successful' 
            });
        } else {
            res.json({ success: false, message: 'Registration failed' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logout successful' });
});

// Admin APIs
app.get('/api/admin/stats', requireAdmin, (req, res) => {
    try {
        const users = readJSON(usersFile);
        const keys = readJSON(registrationKeysFile);
        const instances = readJSON(botInstancesFile);
        
        const stats = {
            totalUsers: users.length,
            activeUsers: users.filter(u => u.active).length,
            totalKeys: keys.length,
            usedKeys: keys.filter(k => k.used).length,
            activeKeys: keys.filter(k => !k.used && new Date(k.expires) > new Date()).length,
            totalInstances: instances.length,
            activeInstances: instances.filter(i => i.enabled).length
        };
        
        res.json({ success: true, stats: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/admin/keys/generate', requireAdmin, (req, res) => {
    try {
        const { count = 1, expiresIn = 30 } = req.body; // days
        
        const keys = readJSON(registrationKeysFile);
        const newKeys = [];
        
        for (let i = 0; i < count; i++) {
            const key = crypto.randomBytes(8).toString('hex').toUpperCase();
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + parseInt(expiresIn));
            
            newKeys.push({
                key: key,
                createdBy: req.session.user.username,
                createdAt: new Date().toISOString(),
                expires: expiryDate.toISOString(),
                used: false,
                usedBy: null,
                usedAt: null
            });
        }
        
        keys.push(...newKeys);
        
        if (writeJSON(registrationKeysFile, keys)) {
            res.json({ 
                success: true, 
                message: `${count} key(s) generated successfully`,
                keys: newKeys
            });
        } else {
            res.json({ success: false, message: 'Failed to generate keys' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/admin/keys', requireAdmin, (req, res) => {
    try {
        const keys = readJSON(registrationKeysFile);
        res.json({ success: true, keys: keys });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
    try {
        const users = readJSON(usersFile);
        // Remove passwords from response
        const safeUsers = users.map(user => ({
            id: user.id,
            username: user.username,
            active: user.active,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            registrationKey: user.registrationKey
        }));
        
        res.json({ success: true, users: safeUsers });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/admin/users/:id/toggle', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        let users = readJSON(usersFile);
        const user = users.find(u => u.id === id);
        
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        
        user.active = !user.active;
        
        if (writeJSON(usersFile, users)) {
            res.json({ 
                success: true, 
                message: `User ${user.active ? 'activated' : 'deactivated'} successfully` 
            });
        } else {
            res.json({ success: false, message: 'Failed to update user' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Bot Instances Management (Admin Only)
app.get('/api/admin/instances', requireAdmin, (req, res) => {
    try {
        const instances = readJSON(botInstancesFile);
        res.json({ success: true, instances: instances });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/admin/instances', requireAdmin, (req, res) => {
    try {
        const { name, url } = req.body;
        
        if (!name || !url) {
            return res.json({ success: false, message: 'Name and URL required' });
        }
        
        try {
            new URL(url);
        } catch (error) {
            return res.json({ success: false, message: 'Invalid URL format' });
        }

        const instances = readJSON(botInstancesFile);
        
        if (instances.find(inst => inst.url === url)) {
            return res.json({ success: false, message: 'Instance URL already exists' });
        }

        const newInstance = {
            id: Date.now().toString(),
            name: name,
            url: url.trim(),
            enabled: true,
            addedBy: req.session.user.username,
            addedAt: new Date().toISOString()
        };

        instances.push(newInstance);
        
        if (writeJSON(botInstancesFile, instances)) {
            res.json({ 
                success: true, 
                message: 'Instance added successfully',
                instance: newInstance
            });
        } else {
            res.json({ success: false, message: 'Failed to add instance' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/admin/instances/:id', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        let instances = readJSON(botInstancesFile);
        const initialLength = instances.length;
        
        instances = instances.filter(inst => inst.id !== id);
        
        if (instances.length < initialLength && writeJSON(botInstancesFile, instances)) {
            res.json({ success: true, message: 'Instance deleted successfully' });
        } else {
            res.json({ success: false, message: 'Instance not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// User Dashboard APIs
app.get('/api/user/dashboard', requireAuth, (req, res) => {
    try {
        if (req.session.user.role !== 'user') {
            return res.status(403).json({ success: false, message: 'User access required' });
        }
        
        const instances = readJSON(botInstancesFile);
        const userInstances = instances.filter(inst => inst.enabled).map(inst => ({
            id: inst.id,
            name: inst.name,
            status: 'online' // This would come from main controller
        }));
        
        res.json({ 
            success: true, 
            user: {
                username: req.session.user.username,
                joined: req.session.user.createdAt
            },
            instances: userInstances
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Auth Server is running',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// Serve login for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Initialize and start server
initializeFiles();
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🔐 Auth Server running on port ${PORT}`);
    console.log(`👑 Admin: ${ADMIN_CONFIG.username}`);
    console.log(`🔑 Initial files initialized`);
});
