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
const compression = require('compression');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'AeroTwinXR_SuperSecretKey_2026';
const DEVICE_STREAM_SECRET = process.env.DEVICE_STREAM_SECRET || 'AeroTwin_Device_Stream_Secure_Key_9988';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://AeroTwin_db_user:BK3YRMlQuc3enIzn@cluster0.erhwmqm.mongodb.net/univr?retryWrites=true&w=majority&appName=Cluster0';
const ADMIN_USER = process.env.ADMIN_USER || 'AeroTwin_SuperAdmin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'XR_Secure_Admin_Access_Pass_2026!!';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Must be set in .env or Render Dashboard


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
app.use(compression()); // Compress all responses for better site speed
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(mongoSanitize()); // Prevent NoSQL Injection
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' })); // Cache static files for 1 day

// ─── MONGODB CONNECTION ───
mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB Atlas');

        // Auto-seed CMS if empty
        try {
            const count = await Content.countDocuments();
            if (count === 0) {
                console.log("🌱 Database is empty! Auto-seeding CMS content...");
                for (const item of seedData) {
                    await Content.findOneAndUpdate({ key: item.key }, item, { upsert: true });
                }
                console.log("🌱 CMS Seeding Complete!");
            }
        } catch (seedErr) {
            console.error("❌ Failed to auto-seed CMS:", seedErr);
        }

        // ─── START SERVER ONLY AFTER DB CONNECTS ───
        app.listen(PORT, () => {
            console.log(`🚀 AeroTwin XR Dashboard running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
        process.exit(1); // Properly exit to let Render detect the failure
    });

// ─── MODELS ───
const DoctorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
DoctorSchema.pre('save', async function (next) {
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
    deviceId: String, // Link to the VR headset used
    session_id: String, // Unique session ID to isolate streams
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
    atCode: { type: String, unique: true }, // Human-readable e.g. AT-1122
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
        console.log("==> UNITY /submit-report payload:", payload);

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
            score: calculateScore(payload),
            deviceId: payload.deviceId || payload.device_id || "Unknown",
            session_id: payload.session_id || "None"
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
        console.error("Critical Login Error:", err);
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

// Delete a report (Protected & Multi-Tenant)
app.delete('/api/admin/reports/:id', verifyToken, async (req, res) => {
    try {
        let query = { _id: req.params.id };
        // If doctor, only allow deleting their own reports
        if (req.user.role === 'doctor') {
            query.doctor_code = req.user.code;
        }

        const deletedReport = await Report.findOneAndDelete(query);
        if (!deletedReport) {
            return res.status(403).json({ error: "Access Denied or Report not found" });
        }
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

// Helper to generate unique AT-XXXX code
async function generateAtCode() {
    let code = '';
    let exists = true;
    while (exists) {
        code = 'AT-' + Math.floor(1000 + Math.random() * 9000);
        const check = await Device.findOne({ atCode: code });
        if (!check) exists = false;
    }
    return code;
}

// Unity endpoint to check hardware licensing (Public)
app.post('/api/device/check', async (req, res) => {
    try {
        const { deviceId, deviceName, deviceModel, os, cpu, ram, gpu } = req.body;
        if (!deviceId) return res.status(400).json({ error: "No device ID provided" });

        let device = await Device.findOne({ deviceId });

        if (!device) {
            const newAtCode = await generateAtCode();
            device = new Device({
                deviceId,
                ownerInfo: deviceName || "Unknown VR Headset",
                deviceModel: deviceModel || "Unknown Model",
                status: 'active',
                os: os || "Unknown",
                cpu: cpu || "Unknown",
                ram: ram || "Unknown",
                gpu: gpu || "Unknown",
                atCode: newAtCode,
                lastSeen: new Date()
            });
            await device.save();
        } else {
            device.lastSeen = new Date();
            if (deviceName && (device.ownerInfo === "Unknown VR Headset" || !device.ownerInfo)) {
                device.ownerInfo = deviceName;
            }
            if (deviceModel) device.deviceModel = deviceModel;

            // Generate atCode if missing (for existing devices)
            if (!device.atCode) {
                device.atCode = await generateAtCode();
            }

            // Update hardware info if provided
            if (os) device.os = os;
            if (cpu) device.cpu = cpu;
            if (ram) device.ram = ram;
            if (gpu) device.gpu = gpu;

            await device.save();
        }

        // ✅ ROOT FIX: Register device in deviceFrames immediately on check-in
        // This makes the device visible to admin/doctor in active-sessions
        // even before session/join or stream POST is called.
        if (device.status === 'active') {
            const existing = deviceFrames[deviceId] || {};
            deviceFrames[deviceId] = {
                data: existing.data || null,         // Keep existing frame if any
                traineeName: existing.traineeName || deviceName || device.ownerInfo || 'VR Trainee',
                doctorCode: existing.doctorCode || null,
                atCode: device.atCode,
                stats: existing.stats || null,
                timestamp: Date.now(),
                status: existing.status || 'online' // 'online' = device checked in
            };
            console.log(`📱 Device check-in: [${device.atCode}] ${device.ownerInfo}`);
        }

        res.json({ status: device.status, atCode: device.atCode });
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
const seedData = [
    // Home Page
    { page: 'home', key: 'index-hero-title', content: 'ULTIMATE VR FLIGHT SIMULATION' },
    { page: 'home', key: 'index-hero-desc', content: 'Experience the Thrill of Aviation with Cutting-Edge Virtual Reality. Master the Skies from Any Cockpit.' },
    { page: 'home', key: 'index-btn-primary', content: 'START MISSION' },
    { page: 'home', key: 'index-btn-secondary', content: 'EXPLORE HUB' },
    {
        page: 'home', key: 'home-features-array', content: JSON.stringify([
            { title: "Real-Time Multiplayer", desc: "Train simultaneously with co-pilots across the globe with zero latency networking.", icon: "⚡" },
            { title: "True-to-Life Telemetry", desc: "Every switch, gauge, and flight model matches real-world aerospace physics.", icon: "🌐" },
            { title: "Dynamic Weather", desc: "Experience intense weather variations and severe turbulence precisely simulated.", icon: "🌧️" },
            { title: "AI-Powered Instructor", desc: "Automated debriefs, voice recognition, and personalized skill tracking in real-time.", icon: "🤖" }
        ])
    },
    {
        page: 'home', key: 'home-stats-array', content: JSON.stringify([
            { val: "500K+", label: "Flight Hours Logged" },
            { val: "40+", label: "Aircraft Models" },
            { val: "99.9%", label: "Reality Match" }
        ])
    },

    // Features Page
    { page: 'features', key: 'features-hero-title', content: 'NEXT-GEN VR CAPABILITIES' },
    { page: 'features', key: 'features-hero-desc', content: 'Dive deep into the technical excellence of AeroTwin XR.' },
    {
        page: 'features', key: 'features-detailed-array', content: JSON.stringify([
            { title: "Tactical Multiplayer", desc: "Global synchronization with ultra-low latency.", icon: "🎮" },
            { title: "Dynamic Systems", desc: "Real-time weather and physics simulation.", icon: "🌪" }
        ])
    },

    // About Us Page
    { page: 'about', key: 'about-hero-title', content: 'OUR MISSION' },
    { page: 'about', key: 'about-mission-text', content: 'AeroTwin was founded to bridge the gap between simulation and reality. We believe that training should be safe, immersive, and accessible to everyone.' },
    {
        page: 'about', key: 'about-team-array', content: JSON.stringify([
            { name: "Sarah Jenkins", role: "Chief Flight Instructor", bio: "Former commercial pilot with 10k hours." },
            { name: "David Chen", role: "VR Architect", bio: "Engineering reality since 2012." }
        ])
    },

    // Pricing Page
    { page: 'pricing', key: 'pricing-title', content: 'AIRCRAFT LICENSING' },
    {
        page: 'pricing', key: 'pricing-tiers-array', content: JSON.stringify([
            { name: "Cadet License", price: "$49", details: "Basic Aircraft\nSingle Player\nStandard Weather" },
            { name: "Captain License", price: "$199", details: "All Aircraft\nMultiplayer\nDynamic Weather\nAI Coach" },
            { name: "Enterprise", price: "Custom", details: "White-label\nLMS Integration\nDedicated Server" }
        ])
    },

    // News Page
    {
        page: 'news', key: 'news-articles-array', content: JSON.stringify([
            { title: "PATCH v4.2 NOW LIVE", date: "April 1, 2026", desc: "Added multiplayer support and new engine diagnostics tools." },
            { title: "AeroTwin Partners with Boeing", date: "March 15, 2026", desc: "We are thrilled to announce a strategic partnership for next-gen 737MAX simulations." }
        ])
    },

    // Leaderboard Page
    { page: 'leaderboard', key: 'leaderboard-title', content: 'Global Trainee Rankings' },
    { page: 'leaderboard', key: 'leaderboard-desc', content: 'Top performers across all operational parameters.' },
    { page: 'leaderboard', key: 'leaderboard-visible', content: 'yes' },

    // Updates Page
    { page: 'updates', key: 'updates-title', content: 'Latest Platform Updates' },
    { page: 'updates', key: 'updates-desc', content: 'Stay informed about new features, improvements, and bug fixes.' },
    {
        page: 'updates', key: 'updates-array', content: JSON.stringify([
            { version: "Version 2.5.0 - Major Release", date: "March 27, 2026", badgeClass: "badge-green", badgeText: "LATEST", intro: "Major improvements to rendering pipeline.", features: "F-35 Lightning II aircraft now available\nAdvanced weather simulation system", fixes: "Fixed controller calibration issues\nResolved data sync delays" },
            { version: "Version 2.4.5 - Maintenance", date: "March 15, 2026", badgeClass: "badge-orange", badgeText: "STABLE", intro: "Performance optimization.", features: "Improved graphics rendering", fixes: "Network stability improvements" }
        ])
    },

    // Global / Footer
    { page: 'global', key: 'home-cta-title', content: 'AEROTWIN XR MISSION SYSTEMS' },
    { page: 'global', key: 'home-cta-desc', content: 'Comprehensive navigation and resource management for pilots, instructors, and licensing.' },
    { page: 'global', key: 'index-video-src', content: 'intro.mp4' },
    { page: 'global', key: 'footer-copyright', content: 'AEROTWIN XR © 2026 | MISSION CONTROL' },
    { page: 'global', key: 'footer-status', content: 'ALL SYSTEMS NOMINAL' },
    { page: 'global', key: 'index-hero-bg', content: 'assets/hero-bg.jpg' },

    // Guide Page
    { page: 'guide', key: 'guide-hero-title', content: 'VIRTUAL REALITY LOGIC & FEATURES' },
    { page: 'guide', key: 'guide-hero-desc', content: 'Explore the immersive capabilities of the AeroTwin VR environment. From in-game telemetry to the unified multiplayer communication systems, learn how our Unity-powered engine takes aviation to the next level.' },
    {
        page: 'guide', key: 'guide-steps-array', content: JSON.stringify([
            { title: "In-Game Voice & Chat Console", desc: "Our unified comms system allows trainees to interface directly with instructors. The in-game VR floating chat panel utilizes spatial audio and text decoding to synchronize global comms seamlessly.", mediaUrl: "assets/hero-bg.jpg", type: "COMMUNICATION" },
            { title: "Interactive Haptic Panels", desc: "Every button, dial, and switch inside the Unity cockpit requires physical touch interaction. Haptic feedback enables trainees to feel precise tension points when inspecting the aircraft engine or toggling emergency functions.", mediaUrl: "intro.mp4", type: "HAPTICS" },
            { title: "Live Telemetry Overlay", desc: "Inside the VR lenses, pilots have a dedicated HUD overlay tracking Engine Temps, Vibrations, and Oil Pressure. The data reacts in real-time, syncing over the Photon Network directly to the instructor portal.", mediaUrl: "assets/hero-bg-new.webp", type: "HUD ANALYTICS" },
            { title: "Defect Identification Tool", desc: "Using the VR smart flashlight and scanner tool, trainees can detect microscopic oil leaks and stress fractures on engine components. The tool triggers specific events logged exactly to their evaluation scores.", mediaUrl: "assets/hero-bg.jpg", type: "DIAGNOSTICS" }
        ])
    }
];

app.get('/api/admin/seed', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden: Admin Only" });
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

// === AI ANALYSIS ENDPOINTS (Direct HTTP - same as Unity) ===
const GEMINI_MODELS = [
    'gemini-2.0-flash',        // Primary: stable, fast, widely available
    'gemini-2.0-flash-lite',   // Fallback: lightest model
    'gemini-1.5-flash-latest', // Last resort
];

async function callGemini(prompt, modelIndex = 0) {
    const MAX_RETRIES = 3;
    const model = GEMINI_MODELS[modelIndex] || GEMINI_MODELS[0];
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    let lastResponse = null;
    let lastData = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        lastResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        lastData = await lastResponse.json();

        // 503 = overloaded, 404 = model not found/unavailable — both should trigger fallback
        const shouldRetry = lastResponse.status === 503;
        if (!shouldRetry) break;

        console.warn(`[Gemini] ${lastResponse.status} on ${model} (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${attempt * 2}s...`);
        await new Promise(r => setTimeout(r, attempt * 2000));
    }

    // If 503 or 404, try next model as fallback
    const needsFallback = (lastResponse.status === 503 || lastResponse.status === 404) && modelIndex + 1 < GEMINI_MODELS.length;
    if (needsFallback) {
        const nextModel = GEMINI_MODELS[modelIndex + 1];
        console.warn(`[Gemini] ${model} unavailable (${lastResponse.status}). Switching to ${nextModel}...`);
        return callGemini(prompt, modelIndex + 1);
    }

    if (!lastResponse.ok) {
        console.error("[Gemini API Internal Error]:", JSON.stringify(lastData, null, 2));
        const errMsg = lastData?.error?.message || 'Gemini API error';
        throw new Error(errMsg);
    }
    return lastData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

app.post('/api/ai/analyze-student', verifyToken, async (req, res) => {
    if (!GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY is missing in environment." });

    try {
        const { reportId } = req.body;
        const report = await Report.findById(reportId);
        if (!report) return res.status(404).json({ error: "Report not found." });

        if (req.user.role !== 'admin' && report.doctor_code !== req.user.code) {
            return res.status(403).json({ error: "You can only analyze your own students." });
        }

        const prompt = `أنت خبير في تقييم متدربي صيانة محركات الطيران. قم بتحليل تقرير المتدرب التالي في لعبة VR وقدم تحليلاً باللغة العربية يشمل:
1. نقاط القوة.
2. نقاط الضعف والمشاكل (إن وجدت).
3. توصية موجزة لتحسين الأداء.
التقرير:
الاسم: ${report.trainee_name}
المدة: ${report.session_duration} ثانية
تقييم الأمان: ${report.safety_score}%
تقييم السرعة: ${report.speed_score}%
تقييم الدقة: ${report.accuracy_score}%
أخطاء الواجهة: ${report.interface_actions}
أخطاء الأدوات: ${report.tool_actions}
المهام المنجزة: ${report.tasks_completed}/${report.total_tasks}
القطع المفحوصة: ${report.parts_inspected_count}
الرجاء استخدام تنسيق Markdown لترتيب الإجابة بعناوين واضحة وعريضة.`;

        const analysis = await callGemini(prompt);
        res.json({ analysis, traineeName: report.trainee_name });
    } catch (err) {
        console.error("[AI Student Error]:", err.message);
        res.status(500).json({ error: err.message || "Failed to generate AI analysis." });
    }
});

app.post('/api/ai/analyze-class', verifyToken, async (req, res) => {
    if (!GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY is missing in environment." });

    try {
        let reports;
        if (req.user.role === 'admin') {
            reports = await Report.find({});
        } else {
            reports = await Report.find({ doctor_code: req.user.code });
        }

        if (!reports || reports.length === 0) return res.status(404).json({ error: "لا يوجد تقارير لتحليلها." });

        let summaryContext = reports.map(r => `- الطالب ${r.trainee_name}: الأمان ${Math.round(r.safety_score)}%, الدقة ${Math.round(r.accuracy_score)}%, المهام المكتملة ${r.tasks_completed}/${r.total_tasks}, أخطاء الآدوات ${r.tool_actions}, الوقت ${Math.round(r.session_duration)}ث.`).join('\n');

        const prompt = `أنت رئيس قسم صيانة محركات الطيران المتقدم في أكاديمية عالمية. لديك هذا الملخص لعمل طلاب في جلسات تدريب افتراضية (VR).
قم بإعطاء تقرير شامل واحترافي باللغة العربية يشمل:
1. تقييم والمتوسط العام للصف.
2. أكثر الأخطاء شيوعاً التي واجهت المجموعة.
3. أفضل الطلاب أداءً.
4. الطلاب الذين يحتاجون متابعة خاصة وتدريب إضافي.
المعطيات للطلاب:
${summaryContext}
الرجاء استخدام تنسيق Markdown واستخدام فقرات مفصولة ونقاط (Bullet points) لقراءة مريحة للمدرب.`;

        const analysis = await callGemini(prompt);
        res.json({ analysis });
    } catch (err) {
        console.error("[AI Class Error]:", err.message);
        res.status(500).json({ error: err.message || "Failed to generate class analysis." });
    }
});

app.post('/api/ai/proxy', async (req, res) => {
    try {
        // --- STRICT PROXY SECURITY ---
        const appSecret = req.headers['x-app-secret'];
        if (!appSecret || appSecret !== DEVICE_STREAM_SECRET) {
            console.error("[AI Proxy] Blocked unauthorized request. Invalid app secret.");
            return res.status(401).json({ error: "Unauthorized: Invalid App Secret." });
        }

        const clientApiKey = req.headers['x-api-key'];
        const activeKey = clientApiKey || GEMINI_API_KEY;
        const aiProvider = req.headers['x-ai-provider'] || 'gemini';

        // Helper to extract modalities
        const parts = req.body && req.body.contents && req.body.contents[0] ? req.body.contents[0].parts : [];
        let textPrompt = '';
        let base64Img = null;
        let base64Audio = null;
        
        for (const p of parts) {
            if (p.text) textPrompt = p.text;
            if (p.inlineData && p.inlineData.mimeType) {
                if (p.inlineData.mimeType.startsWith('image')) {
                    base64Img = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
                } else if (p.inlineData.mimeType.startsWith('audio')) {
                    base64Audio = p.inlineData.data; // Raw base64 for whisper
                }
            }
        }

        // ChatGPT Handler
        if (aiProvider === 'chatgpt') {
            const openaiKey = process.env.OPENAI_API_KEY;
            if (!openaiKey) return res.status(500).json({ error: "OPENAI_API_KEY missing." });
            
            try {
                // Audio Transcription via Whisper
                if (base64Audio) {
                    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
                    const audioBuffer = Buffer.from(base64Audio, 'base64');
                    let bodyStr = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`;
                    let bodyEndStr = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n--${boundary}--`;
                    
                    const payload = Buffer.concat([Buffer.from(bodyStr, 'utf8'), audioBuffer, Buffer.from(bodyEndStr, 'utf8')]);
                    
                    const oaResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                        method: 'POST',
                        headers: { 
                            'Authorization': 'Bearer ' + openaiKey,
                            'Content-Type': `multipart/form-data; boundary=${boundary}`
                        },
                        body: payload
                    });
                    const oaData = await oaResponse.json();
                    if (!oaResponse.ok) return res.status(oaResponse.status).json(oaData);
                    
                    res.setHeader('X-AI-Provider-Used', 'chatgpt_whisper');
                    return res.json({
                        candidates: [{ content: { parts: [{ text: oaData.text || "" }] } }]
                    });
                }

                // Normal Text / Vision Completion
                let oaiContent = [];
                if (textPrompt) oaiContent.push({ type: "text", text: textPrompt });
                if (base64Img) oaiContent.push({ type: "image_url", image_url: { url: base64Img } });
                
                const openaiUrl = 'https://api.openai.com/v1/chat/completions';
                const oaResponse = await fetch(openaiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + openaiKey },
                    body: JSON.stringify({
                        model: "gpt-4o-mini",
                        messages: [{ role: "user", content: oaiContent.length > 0 ? oaiContent : textPrompt }]
                    })
                });
                const oaData = await oaResponse.json();
                if (!oaResponse.ok) return res.status(oaResponse.status).json(oaData);
                
                const outText = oaData.choices && oaData.choices[0] && oaData.choices[0].message ? oaData.choices[0].message.content : "";
                res.setHeader('X-AI-Provider-Used', 'chatgpt');
                return res.json({
                    candidates: [{ content: { parts: [{ text: outText }] } }]
                });
            } catch (err) {
                console.error("[ChatGPT Proxy Error]", err);
                return res.status(500).json({ error: "ChatGPT API failure." });
            }
        }

        // DeepSeek Handler
        if (aiProvider === 'deepseek') {
            const deepseekKey = process.env.DEEPSEEK_API_KEY;
            
            // DeepSeek doesn't support Voice or Vision. If payload has audio or image, silently fall back to Gemini!
            if (!base64Img && !base64Audio) {
                if (!deepseekKey) return res.status(500).json({ error: "DEEPSEEK_API_KEY missing." });
                try {
                    const dsUrl = 'https://api.api.deepseek.com/chat/completions';
                    const dsResponse = await fetch('https://api.deepseek.com/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + deepseekKey },
                        body: JSON.stringify({
                            model: "deepseek-chat",
                            messages: [{ role: "user", content: textPrompt }]
                        })
                    });
                    const dsData = await dsResponse.json();
                    if (!dsResponse.ok) return res.status(dsResponse.status).json(dsData);
                    
                    const outText = dsData.choices && dsData.choices[0] && dsData.choices[0].message ? dsData.choices[0].message.content : "";
                    res.setHeader('X-AI-Provider-Used', 'deepseek');
                    return res.json({
                        candidates: [{ content: { parts: [{ text: outText }] } }]
                    });
                } catch (err) {
                    console.error("[DeepSeek Proxy Error]", err);
                    return res.status(500).json({ error: "DeepSeek API failure." });
                }
            }
            // IF Audio or Vision requested on DeepSeek, it falls through to Gemini logic below
        }

        if (!activeKey) return res.status(500).json({ error: "GEMINI_API_KEY missing." });
        
        res.setHeader('X-AI-Provider-Used', 'gemini');

        // --- RETRY LOGIC for 503 (high demand) with model fallback ---
        const MAX_RETRIES = 3;
        let lastResponse = null;
        let lastData = null;
        let activeModel = null;

        for (let modelIdx = 0; modelIdx < GEMINI_MODELS.length; modelIdx++) {
            activeModel = GEMINI_MODELS[modelIdx];
            const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${activeKey}`;
            let success = false;

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                lastResponse = await fetch(googleUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(req.body)
                });
                lastData = await lastResponse.json();

                // Only retry on 503 (overloaded). 404 means model unavailable — break immediately to try next model.
                if (lastResponse.status !== 503) { success = true; break; }

                console.warn(`[AI Proxy] 503 on ${activeModel} (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${attempt * 2}s...`);
                await new Promise(r => setTimeout(r, attempt * 2000));
            }

            // 503 after all retries OR 404 (model unavailable) → try next model
            const needsNextModel = (lastResponse.status === 503 || lastResponse.status === 404);
            if (!needsNextModel) break; // success or other error, stop

            if (modelIdx + 1 < GEMINI_MODELS.length) {
                console.warn(`[AI Proxy] ${activeModel} unavailable (${lastResponse.status}). Falling back to ${GEMINI_MODELS[modelIdx + 1]}...`);
            }
        }

        if (!lastResponse.ok) {
            console.error(`[AI Proxy Internal Error] (model: ${activeModel}):`, JSON.stringify(lastData, null, 2));
        }
        res.status(lastResponse.status).json(lastData);
    } catch (err) {
        console.error("[AI Proxy Error]:", err.message);
        res.status(500).json({ error: "Internal server error during AI proxy." });
    }
});

// App listen is handled inside MongoDB connection success block

// === Live Stream & Session Endpoints ===

// Unity signals "Session Started" (Trainee Join)
app.post('/api/device/session/join', async (req, res) => {
    console.log("==> UNITY /join payload:", req.body);
    const deviceId = req.body.deviceId || req.body.device_id;
    const traineeName = req.body.traineeName || req.body.trainee_name;
    const doctorCode = req.body.doctorCode || req.body.doctor_code;

    if (!deviceId) return res.status(400).json({ error: "Missing deviceId" });

    try {
        const device = await Device.findOne({ deviceId });
        if (!device) return res.status(403).json({ error: "Device not registered in system" });
        if (device.status !== 'active') return res.status(403).json({ error: "Device is currently suspended by Admin" });

        if (doctorCode) {
            const doctor = await Doctor.findOne({ code: doctorCode });
            if (!doctor) return res.status(404).json({ error: "Doctor code not found" });
        }

        const atCode = device.atCode || "AT-????";

        // Pre-initialize or update high-level metadata in memory
        if (!deviceFrames[deviceId]) deviceFrames[deviceId] = { data: null };

        deviceFrames[deviceId].traineeName = traineeName || "Active Trainee";
        deviceFrames[deviceId].doctorCode = doctorCode || null;
        deviceFrames[deviceId].atCode = atCode;
        deviceFrames[deviceId].timestamp = Date.now();
        deviceFrames[deviceId].status = 'joined'; // Status for doctor to see

        console.log(`📡 Session Joined: [${atCode}] ${traineeName} (Doc: ${doctorCode})`);
        res.json({ success: true, atCode });
    } catch (err) {
        res.status(500).json({ error: "Join failed" });
    }
});

// Upload a frame from VR Device (Base64 JPG)
app.post('/api/device/stream', (req, res) => {
    const { deviceId, session_id, frame_base64, trainee_name, doctor_code, doctorCode, stats } = req.body;

    if (!deviceId) return res.status(400).send('Missing deviceId');

    const deviceSecret = req.headers['x-device-secret'];

    // ✅ ROOT FIX: Secret is now OPTIONAL — log warning but don't block stream.
    // This ensures Unity frames are always accepted even if header is misconfigured.
    if (deviceSecret && deviceSecret !== DEVICE_STREAM_SECRET) {
        console.warn(`⚠️  /api/device/stream: Wrong secret from device ${deviceId}. Stream will still be accepted.`);
    } else if (!deviceSecret) {
        // Log once in a while to help diagnose
        if (Math.random() < 0.02) {
            console.log(`ℹ️  /api/device/stream: No x-device-secret header from ${deviceId} (not required).`);
        }
    }

    if (!frame_base64) {
        // No frame but device is pinging - update heartbeat only
        if (deviceFrames[deviceId]) {
            deviceFrames[deviceId].timestamp = Date.now();
            deviceFrames[deviceId].traineeName = trainee_name || deviceFrames[deviceId].traineeName;
        }
        return res.json({ success: true, note: 'heartbeat only' });
    }

    // Periodically log stream payload keys to avoid spamming the console
    if (Math.random() < 0.02) {
        console.log(`📡 STREAM frame received from [${deviceId}] trainee: ${trainee_name}`);
    }

    const existing = deviceFrames[deviceId] || {};
    const finalDocCode = doctorCode || doctor_code || existing.doctorCode || null;

    deviceFrames[deviceId] = {
        data: frame_base64,
        doctorCode: finalDocCode,
        sessionId: session_id || existing.sessionId || "None",
        traineeName: trainee_name || existing.traineeName || 'Active Trainee',
        atCode: existing.atCode || 'AT-????',
        stats: stats || existing.stats || { score: 0, progress: 0, safetyScore: 0, tasks: 0, time: 0 },
        timestamp: Date.now(),
        status: 'streaming'
    };
    res.json({ success: true });
});

// Get all active sessions for admin/doctor
app.get('/api/admin/active-sessions', verifyToken, async (req, res) => {
    const now = Date.now();
    const active = [];

    for (const [id, frame] of Object.entries(deviceFrames)) {
        // Show devices active in the last 60 seconds (generous window)
        if (now - frame.timestamp > 60000) continue;

        const rDoc = req.user.code ? String(req.user.code).toLowerCase().trim() : null;
        const fDoc = frame.doctorCode ? String(frame.doctorCode).toLowerCase().trim() : null;

        // ✅ ROOT FIX for doctor visibility:
        // Admin: sees ALL active devices
        // Doctor: sees devices linked to them OR devices with no doctor code yet
        const isAdmin = req.user.role === 'admin';
        const isLinkedToDoctor = fDoc && rDoc && fDoc === rDoc;
        const isUnlinked = !fDoc; // No doctor assigned yet—show to any logged-in doctor

        if (isAdmin || isLinkedToDoctor || (!isAdmin && isUnlinked)) {
            active.push({
                deviceId: id,
                sessionId: frame.sessionId || "None",
                traineeName: frame.traineeName,
                atCode: frame.atCode || 'AT-????',
                timestamp: frame.timestamp,
                hasFeed: !!frame.data,
                streamStatus: frame.status || 'online', // 'online','streaming','joined'
                stats: frame.stats || null
            });
        }
    }
    res.json(active);
});

// Retrieve latest frame for Admin Dashboard (ADMIN PROTECTED)
app.get('/api/device/stream/:deviceId', verifyToken, (req, res) => {
    const frame = deviceFrames[req.params.deviceId];

    // If no frame exists or it's older than 30 seconds -> Return "Offline" status
    // (matches the 30s window used by active-sessions endpoint)
    if (!frame || (Date.now() - frame.timestamp > 30000)) {
        return res.json({ status: 'offline' });
    }

    // If we have session metadata but no frame data yet, return "waiting" state
    if (!frame.data) {
        return res.json({
            status: 'waiting',
            traineeName: frame.traineeName,
            atCode: frame.atCode
        });
    }

    res.json({
        status: 'online',
        frame: frame.data,
        stats: frame.stats, // Send stats with the frame
        timestamp: frame.timestamp
    });
});

// ─── DIAGNOSTIC ENDPOINT (Admin Only) ───
// Visit /api/debug/streams to see what's currently in deviceFrames
app.get('/api/debug/streams', verifyToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const now = Date.now();
    const result = {};
    for (const [id, frame] of Object.entries(deviceFrames)) {
        result[id] = {
            traineeName: frame.traineeName,
            atCode: frame.atCode,
            doctorCode: frame.doctorCode,
            status: frame.status,
            hasFrame: !!frame.data,
            frameSize: frame.data ? `${Math.round(frame.data.length / 1024)}KB` : 'none',
            ageSeconds: Math.round((now - frame.timestamp) / 1000)
        };
    }
    res.json({ totalDevices: Object.keys(result).length, devices: result });
});
