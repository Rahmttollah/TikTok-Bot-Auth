const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cors({
    origin: ['https://tiktok-view-bot.up.railway.app'],
    credentials: true
}));

const JWT_SECRET = process.env.JWT_SECRET || 'TikTok_Auth_Secret_Key_2024_Mobile_Friendly';
const ADMIN_KEY = process.env.ADMIN_KEY || 'ADMIN123';

const usersFile = path.join(__dirname, 'users.json');

function readUsers() {
    try {
        if (fs.existsSync(usersFile)) {
            return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        }
    } catch (error) {}
    return [];
}

function writeUsers(users) {
    try {
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
        return true;
    } catch (error) {
        return false;
    }
}

app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, adminKey } = req.body;
        
        if (!username || !email || !password) {
            return res.json({ success: false, message: 'All fields required' });
        }

        const users = readUsers();
        
        if (users.find(u => u.username === username)) {
            return res.json({ success: false, message: 'Username exists' });
        }

        if (users.find(u => u.email === email)) {
            return res.json({ success: false, message: 'Email exists' });
        }

        let role = 'user';
        if (adminKey && adminKey === ADMIN_KEY) {
            role = 'admin';
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: Date.now().toString(),
            username,
            email,
            password: hashedPassword,
            role,
            createdAt: new Date().toISOString(),
            isActive: true
        };

        users.push(newUser);
        
        if (writeUsers(users)) {
            const token = jwt.sign(
                { userId: newUser.id, username: newUser.username, role: newUser.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            res.json({ 
                success: true, 
                message: 'Registration successful',
                token: token,
                user: { username: newUser.username, role: newUser.role },
                redirect: 'https://tiktok-view-bot.up.railway.app/dashboard'
            });
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

        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: rememberMe ? '7d' : '24h' }
        );

        res.json({ 
            success: true, 
            message: 'Login successful',
            token: token,
            user: { username: user.username, role: user.role },
            redirect: 'https://tiktok-view-bot.up.railway.app/dashboard'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/verify-token', (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.json({ success: false, message: 'Token required' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ 
            success: true, 
            user: { 
                userId: decoded.userId, 
                username: decoded.username, 
                role: decoded.role 
            }
        });
    } catch (error) {
        res.json({ success: false, message: 'Invalid token' });
    }
});

app.get('/api/users', (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ success: false, message: 'Token required' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const users = readUsers();
        const safeUsers = users.map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
            isActive: user.isActive
        }));

        res.json({ success: true, users: safeUsers });
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Auth Server Running',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🔐 Auth Server running on port ${PORT}`);
    if (!fs.existsSync(usersFile)) {
        writeUsers([]);
        console.log('📁 Users file initialized');
    }
});
