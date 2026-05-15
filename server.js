require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Create uploads directory if not exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to PES Database'))
    .catch(err => console.error('DB Connection Error:', err));

// --- Models ---

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' },
    isAdmin: { type: Boolean, default: false },
    wins: { type: Number, default: 0 },
    joinedEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' }],
    online: { type: Boolean, default: false }
});

const TournamentSchema = new mongoose.Schema({
    title: String,
    description: String,
    date: String,
    time: String,
    venue: String,
    banner: String,
    structure: {
        quarterFinals: [String],
        semiFinals: [String],
        final: [String],
        winner: String
    },
    createdBy: String,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Tournament = mongoose.model('Tournament', TournamentSchema);

// --- Auth Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- Storage Config ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// --- Routes ---

// Register
app.post('/api/auth/register', upload.single('profilePic'), async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const profilePic = req.file ? `/uploads/${req.file.filename}` : undefined;
        
        const user = new User({ 
            username, 
            email, 
            password: hashedPassword, 
            profilePic,
            isAdmin: username === process.env.ADMIN_USER 
        });
        await user.save();
        
        io.emit('userUpdate', { type: 'new_registration', username });
        res.status(201).json({ message: 'User created' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    // Check Admin Hardcoded credentials
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        const token = jwt.sign({ username, isAdmin: true }, process.env.JWT_SECRET);
        return res.json({ token, isAdmin: true, username });
    }

    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, username: user.username, isAdmin: user.isAdmin }, process.env.JWT_SECRET);
    res.json({ token, isAdmin: user.isAdmin, username: user.username, profilePic: user.profilePic });
});

// Get Users
app.get('/api/users', authenticateToken, async (req, res) => {
    const users = await User.find({}, '-password');
    res.json(users);
});

// Delete User (Admin Only)
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);
    await User.findByIdAndDelete(req.params.id);
    io.emit('userUpdate', { type: 'user_deleted' });
    res.json({ message: 'User deleted' });
});

// Tournament Routes
app.get('/api/tournaments', authenticateToken, async (req, res) => {
    const tournaments = await Tournament.find().sort({ createdAt: -1 });
    res.json(tournaments);
});

app.post('/api/tournaments', authenticateToken, upload.single('banner'), async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);
    const { title, description, date, time, venue } = req.body;
    const banner = req.file ? `/uploads/${req.file.filename}` : 'https://picsum.photos/800/400';
    
    const tournament = new Tournament({
        title, description, date, time, venue, banner,
        structure: {
            quarterFinals: ['TBD', 'TBD', 'TBD', 'TBD', 'TBD', 'TBD', 'TBD', 'TBD'],
            semiFinals: ['TBD', 'TBD', 'TBD', 'TBD'],
            final: ['TBD', 'TBD'],
            winner: ''
        }
    });
    await tournament.save();
    io.emit('tournamentUpdate', tournament);
    res.json(tournament);
});

app.put('/api/tournaments/:id/bracket', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);
    const { structure } = req.body;
    const tournament = await Tournament.findByIdAndUpdate(req.params.id, { structure }, { new: true });
    io.emit('tournamentUpdate', tournament);
    res.json(tournament);
});

app.delete('/api/tournaments/:id', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);
    await Tournament.findByIdAndDelete(req.params.id);
    io.emit('tournamentUpdate', { type: 'deleted' });
    res.json({ message: 'Deleted' });
});

// --- Socket.io Logic ---
let activeUsers = new Set();

io.on('connection', (socket) => {
    socket.on('userLoggedIn', (username) => {
        activeUsers.add(username);
        io.emit('activeCount', activeUsers.size);
        io.emit('userStatusChange', { username, status: 'online' });
    });

    socket.on('disconnect', () => {
        // Simple logic: in a real app we'd map socket.id to user
        io.emit('activeCount', Math.max(0, activeUsers.size - 1));
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`PES running on port ${PORT}`));
