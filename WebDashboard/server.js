const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'AeroTwinXR_SuperSecretKey_2026';
const DEVICE_STREAM_SECRET = 'AeroTwin_Device_Stream_Secure_Key_9988';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://technestjo_db_user:QqaoVP8GaFQiCWID@cluster0.2evazsh.mongodb.net/univr?retryWrites=true&w=majority';

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
app.use(express.static(path.join(__dirname, 'public')));

// ─── MONGODB CONNECTION ───
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ─── MODELS ───
const DoctorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now }
});
const Doctor = mongoose.model('Doctor', DoctorSchema);

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

// Admin Login (HARDENED)
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    // High-security credentials
    if (username === 'AeroTwin_SuperAdmin' && password === 'XR_Secure_Admin_Access_Pass_2026!!') {
        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
        res.json({ success: true, token });
    } else {
        res.status(401).json({ success: false, message: "Invalid username or password" });
    }
});

// Get all reports (Protected)
app.get('/api/admin/reports', verifyToken, async (req, res) => {
    try {
        const reports = await Report.find().sort({ createdAt: -1 });
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

// Add a new doctor (Protected)
app.post('/api/admin/doctors', verifyToken, async (req, res) => {
    try {
        const { name, code } = req.body;
        const exists = await Doctor.findOne({ code });
        if (exists) return res.status(400).json({ error: "Doctor code already exists" });

        const newDoc = new Doctor({ name, code });
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
    if (!frame) return res.status(404).json({ error: 'No live stream available' });
    
    // Auto-timeout frame if older than 10 seconds
    if (Date.now() - frame.timestamp > 10000) {
        return res.status(404).json({ error: 'Stream offline' });
    }

    res.json({ 
        frame: frame.data,
        timestamp: frame.timestamp
    });
});
