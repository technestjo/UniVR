require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoSanitize = require('express-mongo-sanitize');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'AeroTwinXR_SuperSecretKey_2026';
const DEVICE_STREAM_SECRET = process.env.DEVICE_STREAM_SECRET || 'AeroTwin_Device_Stream_Secure_Key_9988';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://technestjo_db_user:QqaoVP8GaFQiCWID@cluster0.2evazsh.mongodb.net/univr?retryWrites=true&w=majority';
const ADMIN_USER = process.env.ADMIN_USER || 'AeroTwin_SuperAdmin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'XR_Secure_Admin_Access_Pass_2026!!';

// ─── SECURITY MIDDLEWARE ───
app.use(helmet({
    contentSecurityPolicy: false, // Allow data URLs for images
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Apply rate limiting specifically to streaming and login
app.use('/api/admin/login', limiter);

// In-memory storage for latest device frames (Live Stream)
const deviceFrames = {};

// ─── MIDDLEWARE ───
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(mongoSanitize()); // Prevent NoSQL Injection
app.use(express.static(path.join(__dirname, 'public')));

// ─── MONGODB CONNECTION ───
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ─── MODELS ───
const DoctorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
DoctorSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

const Doctor = mongoose.model('Doctor', DoctorSchema);

const ContentSchema = new mongoose.Schema({
    page: { type: String, required: true },
    key: { type: String, required: true, unique: true },
    content: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now }
});
const Content = mongoose.model('Content', ContentSchema);

const ReportSchema = new mongoose.Schema({
    timestamp: { type: String },
    trainee_name: String,
    trainee_id: String,
    doctor_code: String,
    fault_type: String,
    pressure: Number,
    temp: Number,
    vibration: Number,
    leak: Boolean,
    safety_score: Number,
    speed_score: Number,
    accuracy_score: Number,
    session_duration: Number,
    button_press_count: Number,
    interface_actions: Number,
    tool_actions: Number,
    ai_inquiries: Number,
    questions_asked: Number,
    safety_checks: Number,
    tasks_completed: Number,
    total_tasks: Number,
    pending_tasks: Number,
    parts_inspected_count: Number,
    inspected_parts: [String],
    exported_reports_count: Number,
    chat_log: String,
    score: Number,
    createdAt: { type: Date, default: Date.now }
});
const Report = mongoose.model('Report', ReportSchema);

const DeviceSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    ownerInfo: { type: String, default: "" },
    deviceModel: { type: String, default: "" }, // For Quest 2 / Quest 3
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    os: { type: String, default: "" },
    cpu: { type: String, default: "" },
    ram: { type: String, default: "" },
    gpu: { type: String, default: "" },
    lastSeen: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});
const Device = mongoose.model('Device', DeviceSchema);

// ─── AUTHENTICATION MIDDLEWARE ───
function verifyToken(req, res, next) {
    const bearerHeader = req.headers['authorization'];
    if (!bearerHeader) return res.status(403).json({ error: 'Access Denied: No Token Provided!' });

    const token = bearerHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Access Denied: Invalid Token!' });
        req.user = decoded;
        next();
    });
}

// ─── PUBLIC API ROUTES ───

// Get all reports for public viewing (Excludes Chat Logs)
app.get('/api/reports', async (req, res) => {
    try {
        const reports = await Report.find({}, { chat_log: 0 }).sort({ createdAt: -1 });
        res.json(reports);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch public reports" });
    }
});

// Verify doctor code (Public)
app.get('/api/doctors/:code', async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ code: req.params.code });
        if (!doctor) return res.status(404).json({ error: "Doctor not found" });
        res.json({ name: doctor.name, code: doctor.code });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch doctor" });
    }
});

// VR System POST route
app.post('/api/submit-report', async (req, res) => {
    try {
        const payload = req.body;
        console.log("Received new report from Unity:", payload.trainee_name);

        const newReport = new Report({
            timestamp: new Date().toLocaleString(),
            trainee_name: payload.trainee_name || "Unknown Trainee",
            trainee_id: payload.trainee_id || "AR-000",
            doctor_code: payload.doctor_code || "N/A",
            fault_type: payload.fault_type || "N/A",
            pressure: payload.pressure || 0,
            temp: payload.temp || 0,
            vibration: payload.vibration || 0,
            leak: payload.leak || false,
            safety_score: payload.safety_score || 0,
            speed_score: payload.speed_score || 0,
            accuracy_score: payload.accuracy_score || 0,
            session_duration: payload.session_duration || 0,
            button_press_count: payload.button_press_count || 0,
            interface_actions: payload.interface_actions || 0,
            tool_actions: payload.tool_actions || 0,
            ai_inquiries: payload.ai_inquiries || 0,
            questions_asked: payload.questions_asked || 0,
            safety_checks: payload.safety_checks || 0,
            tasks_completed: payload.tasks_completed || 0,
            total_tasks: payload.total_tasks || 7,
            pending_tasks: payload.pending_tasks || 0,
            parts_inspected_count: payload.parts_inspected_count || 0,
            inspected_parts: payload.inspected_parts || [],
            exported_reports_count: payload.exported_reports_count || 0,
            chat_log: payload.chat_log || "No chat history.",
            score: calculateScore(payload)
        });

        await newReport.save();
        res.status(200).json({ success: true, message: "Report saved successfully to MongoDB!" });
    } catch (error) {
        console.error("Error saving report:", error);
        res.status(500).json({ success: false, message: "Server error saving report." });
    }
});

// Calculate score helper
function calculateScore(data) {
    if (data.safety_score > 0 || data.speed_score > 0 || data.accuracy_score > 0) {
        const safetyW = 0.40;
        const accuracyW = 0.35;
        const speedW = 0.25;
        let weighted = (data.safety_score || 0) * safetyW + 
                       (data.accuracy_score || 0) * accuracyW + 
                       (data.speed_score || 0) * speedW;

        if (data.total_tasks > 0) {
            const taskRatio = (data.tasks_completed || 0) / data.total_tasks;
            weighted = weighted * 0.85 + taskRatio * 100 * 0.15;
        }
        return Math.round(Math.max(0, Math.min(100, weighted)));
    }

    let score = 100;
    if (data.vibration > 5.0) score -= 30;
    if (data.temp > 800) score -= 40;
    if (data.leak) score -= 25;
    if (data.pressure > 0 && data.pressure < 20) score -= 30;
    return Math.max(0, score);
}

// ─── ADMIN API ROUTES ───

// Admin & Doctor Login (Unified with Enhanced Security)
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Missing credentials" });
    }

    try {
        // 1. Check Admin (via Environment Variables)
        if (username === ADMIN_USER && password === ADMIN_PASS) {
            const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
            return res.json({ success: true, token, role: 'admin' });
        } 
        
        // 2. Check Doctor (via Hashed DB Password)
        // Search by code OR name (case-insensitive)
        const doc = await Doctor.findOne({ 
            $or: [
                { code: username },
                { name: { $regex: new RegExp(`^${username}$`, 'i') } }
            ]
        });

        if (doc) {
            let isMatch = false;
            // Check if it's a hashed password
            if (doc.password.startsWith('$2a$') || doc.password.startsWith('$2b$')) {
                isMatch = await bcrypt.compare(password, doc.password);
            } else {
                // Legacy plain-text check
                if (password === doc.password) {
                    isMatch = true;
                    // Automatically upgrade to hashed password for security
                    doc.password = password; 
                    await doc.save();
                    console.log(`✅ Hashed legacy password for doctor: ${doc.name}`);
                }
            }

            if (isMatch) {
                const token = jwt.sign({ role: 'doctor', code: doc.code }, JWT_SECRET, { expiresIn: '8h' });
                return res.json({ success: true, token, role: 'doctor' });
            }
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: "Internal server error during login" });
    }

    res.status(401).json({ success: false, message: "Invalid credentials" });
});

// Get all reports (Protected & Multi-Tenant)
app.get('/api/admin/reports', verifyToken, async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'doctor') {
            query = { doctor_code: req.user.code };
        }
        const reports = await Report.find(query).sort({ createdAt: -1 });
        res.json(reports);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch reports" });
    }
});

// Delete a report (Protected)
app.delete('/api/admin/reports/:id', verifyToken, async (req, res) => {
    try {
        await Report.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete report" });
    }
});

// Get all doctors (Protected)
app.get('/api/admin/doctors', verifyToken, async (req, res) => {
    try {
        const doctors = await Doctor.find().sort({ createdAt: -1 });
        res.json(doctors);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch doctors" });
    }
});

// Add a new doctor (Protected Admin Only)
app.post('/api/admin/doctors', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden: Admin Only" });
    try {
        const { name, code, password } = req.body;
        const exists = await Doctor.findOne({ code });
        if (exists) return res.status(400).json({ error: "Doctor code already exists" });

        const newDoc = new Doctor({ name, code, password: password || '123456' });
        await newDoc.save();
        res.json({ success: true, doctor: newDoc });
    } catch (err) {
        res.status(500).json({ error: "Failed to add doctor" });
    }
});

// Remove a doctor (Protected)
app.delete('/api/admin/doctors/:id', verifyToken, async (req, res) => {
    try {
        await Doctor.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete doctor" });
    }
});

// Get all devices (Protected)
app.get('/api/admin/devices', verifyToken, async (req, res) => {
    try {
        const devices = await Device.find().sort({ lastSeen: -1 });
        res.json(devices);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch devices" });
    }
});

// Update device status (Protected)
app.post('/api/admin/devices/:id/status', verifyToken, async (req, res) => {
    try {
        const { status } = req.body;
        await Device.findByIdAndUpdate(req.params.id, { status });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to update device status" });
    }
});

// Unity endpoint to check hardware licensing (Public)
app.post('/api/device/check', async (req, res) => {
    try {
        const { deviceId, deviceName, deviceModel, os, cpu, ram, gpu } = req.body;
        if (!deviceId) return res.status(400).json({ error: "No device ID provided" });

        let device = await Device.findOne({ deviceId });
        
        if (!device) {
            device = new Device({ 
                deviceId, 
                ownerInfo: deviceName || "Unknown VR Headset",
                deviceModel: deviceModel || "Unknown Model",
                status: 'active',
                os: os || "Unknown",
                cpu: cpu || "Unknown",
                ram: ram || "Unknown",
                gpu: gpu || "Unknown",
                lastSeen: new Date()
            });
            await device.save();
        } else {
            device.lastSeen = new Date();
            if(deviceName && (device.ownerInfo === "Unknown VR Headset" || !device.ownerInfo)) {
               device.ownerInfo = deviceName;
            }
            if(deviceModel) device.deviceModel = deviceModel;

            // Update hardware info if provided
            if (os) device.os = os;
            if (cpu) device.cpu = cpu;
            if (ram) device.ram = ram;
            if (gpu) device.gpu = gpu;
            
            await device.save();
        }

        res.json({ status: device.status });
    } catch (err) {
        console.error("Device Check Error:", err);
        res.status(500).json({ error: "Failed to verify device" });
    }
});

// ─── CMS CONTENT API ROUTES ───

// Get all content for public rendering
app.get('/api/content', async (req, res) => {
    try {
        const allContent = await Content.find();
        const dict = {};
        allContent.forEach(item => { dict[item.key] = item.content; });
        res.json(dict);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch content" });
    }
});

// Get all content (Raw objects for Admin)
app.get('/api/admin/raw-content', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden: Admin Only" });
    try {
        const allContent = await Content.find().sort({ page: 1 });
        res.json(allContent);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch raw content" });
    }
});

// Seed CMS Data (One-time use / Admin only)
app.get('/api/admin/seed', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden: Admin Only" });
    const seedData = [
        // Home Page
        { page: 'home', key: 'index-hero-title', content: 'ULTIMATE VR FLIGHT SIMULATION' },
        { page: 'home', key: 'index-hero-desc', content: 'Experience the Thrill of Aviation with Cutting-Edge Virtual Reality. Master the Skies from Any Cockpit.' },
        { page: 'home', key: 'index-btn-primary', content: 'START MISSION' },
        { page: 'home', key: 'index-btn-secondary', content: 'EXPLORE HUB' },
        { page: 'home', key: 'home-features-array', content: JSON.stringify([
            { title: "Real-Time Multiplayer", desc: "Train simultaneously with co-pilots across the globe with zero latency networking.", icon: "⚡" },
            { title: "True-to-Life Telemetry", desc: "Every switch, gauge, and flight model matches real-world aerospace physics.", icon: "🌐" },
            { title: "Dynamic Weather", desc: "Experience intense weather variations and severe turbulence precisely simulated.", icon: "🌧️" },
            { title: "AI-Powered Instructor", desc: "Automated debriefs, voice recognition, and personalized skill tracking in real-time.", icon: "🤖" }
        ])},
        { page: 'home', key: 'home-stats-array', content: JSON.stringify([
            { val: "500K+", label: "Flight Hours Logged" },
            { val: "40+", label: "Aircraft Models" },
            { val: "99.9%", label: "Reality Match" }
        ])},
        
        // Features Page
        { page: 'features', key: 'features-hero-title', content: 'NEXT-GEN VR CAPABILITIES' },
        { page: 'features', key: 'features-hero-desc', content: 'Dive deep into the technical excellence of AeroTwin XR.' },
        { page: 'features', key: 'features-detailed-array', content: JSON.stringify([
            { title: "Tactical Multiplayer", desc: "Global synchronization with ultra-low latency.", icon: "🎮" },
            { title: "Dynamic Systems", desc: "Real-time weather and physics simulation.", icon: "🌪" }
        ])},
        
        // About Us Page
        { page: 'about', key: 'about-hero-title', content: 'OUR MISSION' },
        { page: 'about', key: 'about-mission-text', content: 'AeroTwin was founded to bridge the gap between simulation and reality. We believe that training should be safe, immersive, and accessible to everyone.' },
        { page: 'about', key: 'about-team-array', content: JSON.stringify([
            { name: "Sarah Jenkins", role: "Chief Flight Instructor", bio: "Former commercial pilot with 10k hours." },
            { name: "David Chen", role: "VR Architect", bio: "Engineering reality since 2012." }
        ])},
        
        // Pricing Page
        { page: 'pricing', key: 'pricing-title', content: 'AIRCRAFT LICENSING' },
        { page: 'pricing', key: 'pricing-tiers-array', content: JSON.stringify([
            { name: "Cadet License", price: "$49", details: "Basic Aircraft\nSingle Player\nStandard Weather" },
            { name: "Captain License", price: "$199", details: "All Aircraft\nMultiplayer\nDynamic Weather\nAI Coach" },
            { name: "Enterprise", price: "Custom", details: "White-label\nLMS Integration\nDedicated Server" }
        ])},
        
        // News Page
        { page: 'news', key: 'news-articles-array', content: JSON.stringify([
            { title: "PATCH v4.2 NOW LIVE", date: "April 1, 2026", desc: "Added multiplayer support and new engine diagnostics tools." },
            { title: "AeroTwin Partners with Boeing", date: "March 15, 2026", desc: "We are thrilled to announce a strategic partnership for next-gen 737MAX simulations." }
        ])},

        // Leaderboard Page
        { page: 'leaderboard', key: 'leaderboard-title', content: 'Global Trainee Rankings' },
        { page: 'leaderboard', key: 'leaderboard-desc', content: 'Top performers across all operational parameters.' },
        { page: 'leaderboard', key: 'leaderboard-visible', content: 'yes' },

        // Updates Page
        { page: 'updates', key: 'updates-title', content: 'Latest Platform Updates' },
        { page: 'updates', key: 'updates-desc', content: 'Stay informed about new features, improvements, and bug fixes.' },
        { page: 'updates', key: 'updates-array', content: JSON.stringify([
            { version: "Version 2.5.0 - Major Release", date: "March 27, 2026", badgeClass: "badge-green", badgeText: "LATEST", intro: "Major improvements to rendering pipeline.", features: "F-35 Lightning II aircraft now available\nAdvanced weather simulation system", fixes: "Fixed controller calibration issues\nResolved data sync delays" },
            { version: "Version 2.4.5 - Maintenance", date: "March 15, 2026", badgeClass: "badge-orange", badgeText: "STABLE", intro: "Performance optimization.", features: "Improved graphics rendering", fixes: "Network stability improvements" }
        ])},

        // Global / Footer
        { page: 'global', key: 'home-cta-title', content: 'AEROTWIN XR MISSION SYSTEMS' },
        { page: 'global', key: 'home-cta-desc', content: 'Comprehensive navigation and resource management for pilots, instructors, and licensing.' },
        { page: 'global', key: 'index-video-src', content: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
        { page: 'global', key: 'footer-copyright', content: 'AEROTWIN XR © 2026 | MISSION CONTROL' },
        { page: 'global', key: 'footer-status', content: 'ALL SYSTEMS NOMINAL' },
        { page: 'global', key: 'index-hero-bg', content: 'assets/hero-bg.jpg' }
    ];

    try {
        for (const item of seedData) {
            await Content.findOneAndUpdate({ key: item.key }, item, { upsert: true });
        }
        res.json({ success: true, message: "Large seed operation completed." });
    } catch (err) {
        res.status(500).json({ error: "Seed failed" });
    }
});

// Admin mass updates content
app.post('/api/admin/content', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden: Admin Only" });
    try {
        const { items } = req.body; // array of { page, key, content }
        for (const item of items) {
            await Content.findOneAndUpdate(
                { key: item.key },
                { page: item.page, content: item.content, updatedAt: new Date() },
                { upsert: true, new: true }
            );
        }
        res.json({ success: true });
    } catch (err) {
         res.status(500).json({ error: "Failed to save content" });
    }
});

// Update single content item (Admin Only)
app.put('/api/admin/content/:key', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin Only' });
    try {
        const { page, content } = req.body;
        const updated = await Content.findOneAndUpdate(
            { key: req.params.key },
            { page, content, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        res.json({ success: true, data: updated });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update content' });
    }
});

// Delete content item (Admin Only)
app.delete('/api/admin/content/:key', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin Only' });
    try {
        await Content.findOneAndDelete({ key: req.params.key });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete content' });
    }
});

// Get content by page (Admin Only)
app.get('/api/admin/content/page/:page', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin Only' });
    try {
        const items = await Content.find({ page: req.params.page }).sort({ key: 1 });
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch page content' });
    }
});

// Get all pages list (Admin Only)
app.get('/api/admin/pages', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin Only' });
    try {
        const pages = await Content.distinct('page');
        res.json(pages.sort());
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch pages' });
    }
});

// Fallback route for SPA / generic pages
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 AeroTwin XR Dashboard running on port ${PORT}`);
});

// === Live Stream Endpoints ===

// Upload a frame from VR Device (Base64 JPG)
app.post('/api/device/stream', (req, res) => {
    const { deviceId, frameBase64 } = req.body;
    const deviceSecret = req.headers['x-device-secret'];

    // Security Check: Ensure only authenticated devices can stream
    if (deviceSecret !== DEVICE_STREAM_SECRET) {
        return res.status(403).json({ error: 'Invalid device secret' });
    }

    if (!deviceId || !frameBase64) return res.status(400).send('Missing data');

    deviceFrames[deviceId] = {
        data: frameBase64,
        timestamp: Date.now()
    };
    res.json({ success: true });
});

// Retrieve latest frame for Admin Dashboard (ADMIN PROTECTED)
app.get('/api/device/stream/:deviceId', verifyToken, (req, res) => {
    const frame = deviceFrames[req.params.deviceId];
    
    // If no frame exists or it's older than 10 seconds -> Return "Offline" status (No 404 to avoid console Clutter)
    if (!frame || (Date.now() - frame.timestamp > 10000)) {
        return res.json({ status: 'offline' });
    }

    res.json({ 
        status: 'online',
        frame: frame.data,
        timestamp: frame.timestamp
    });
});
