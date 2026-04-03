const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'AeroTwin_XR_Security_Key_2024';
const DEVICE_STREAM_SECRET = 'AeroTwin_Device_Stream_Secure_Key_9988';

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Cluster (AeroTwin)'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Models
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'doctor'], default: 'doctor' },
    code: { type: String, unique: true } // Unique code for doctors
});

const ReportSchema = new mongoose.Schema({
    trainee_id: String,
    trainee_name: String,
    doctor_code: String,
    score: Number,
    safety_score: Number,
    speed_score: Number,
    accuracy_score: Number,
    session_duration: Number,
    tasks_completed: Number,
    total_tasks: Number,
    pending_tasks: Number,
    interface_actions: Number,
    tool_actions: Number,
    ai_inquiries: Number,
    parts_inspected_count: Number,
    vibration: Number,
    temp: Number,
    leak: Boolean,
    chat_log: String,
    deviceId: String,
    createdAt: { type: Object, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Report = mongoose.model('Report', ReportSchema);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// JWT Verification
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Failed to authenticate token' });
        req.user = decoded;
        next();
    });
};

// --- AUTH ROUTES ---
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role, code: user.code }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ success: true, token, role: user.role });
});

// --- REPORT ROUTES ---
app.get('/api/admin/reports', verifyToken, async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'doctor') query.doctor_code = req.user.code;
        const reports = await Report.find(query).sort({ createdAt: -1 });
        res.json(reports);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch reports" });
    }
});

app.delete('/api/admin/reports/:id', verifyToken, async (req, res) => {
    try {
        await Report.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete" });
    }
});

// --- VR DEVICE DATA INGESTION ---
app.post('/api/device/report', async (req, res) => {
    try {
        const secret = req.headers['x-app-secret'];
        if (secret !== 'AeroTwin_Device_Stream_Secure_Key_9988') return res.status(403).send('Forbidden');

        const report = new Report({
            ...req.body,
            createdAt: Date.now()
        });
        await report.save();
        res.json({ success: true, id: report._id });
    } catch (err) {
        res.status(500).json({ error: "Ingestion failed" });
    }
});

// --- AI INTELLIGENCE SYSTEM (GEMINI PROXY) ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Surgical Fix: Use v1beta and gemini-2.5-flash as requested by user
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

app.post('/api/ai/analyze-student', verifyToken, async (req, res) => {
    try {
        const report = await Report.findById(req.body.reportId);
        if (!report) return res.status(404).send('Report not found');

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

        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        const analysis = data.candidates[0].content.parts[0].text;
        res.json({ analysis });
    } catch (err) {
        res.status(500).json({ error: "AI sync failed" });
    }
});

app.post('/api/ai/analyze-class', verifyToken, async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'doctor') query.doctor_code = req.user.code;
        const reports = await Report.find(query).limit(15);

        const summaryContext = reports.map(r => 
            `- ${r.trainee_name}: Score ${r.score}%, Safety ${r.safety_score}%, Speed ${r.speed_score}%`
        ).join('\n');

        const prompt = `أنت رئيس قسم صيانة محركات الطيران المتقدم في أكاديمية عالمية. لديك هذا الملخص لعمل طلاب في جلسات تدريب افتراضية (VR).
قم بإعطاء تقرير شامل واحترافي باللغة العربية يشمل:
1. تقييم والمتوسط العام للصف.
2. أكثر الأخطاء شيوعاً التي واجهت المجموعة.
3. أفضل الطلاب أداءً.
4. الطلاب الذين يحتاجون متابعة خاصة وتدريب إضافي.
المعطيات للطلاب:
${summaryContext}
الرجاء استخدام تنسيق Markdown واستخدم فقرات مفصولة ونقاط (Bullet points) لقراءة مريحة للمدرب.`;

        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        const analysis = data.candidates[0].content.parts[0].text;
        res.json({ analysis });
    } catch (err) {
        res.status(500).json({ error: "AI Class sync failed" });
    }
});

// --- LIVE STREAM SYSTEM ---
const deviceFrames = {};

// Device joins session
app.post('/api/device/session/join', async (req, res) => {
    try {
        const { deviceId, atCode, traineeName, doctorCode } = req.body;
        if (!deviceId || !atCode) return res.status(400).send('Missing data');

        deviceFrames[deviceId] = {
            traineeName: traineeName || "Active Trainee",
            doctorCode: doctorCode || null,
            atCode: atCode,
            timestamp: Date.now(),
            status: 'joined' // Status for doctor to see
        };

        console.log(`📡 Session Joined: [${atCode}] ${traineeName} (Doc: ${doctorCode})`);
        res.json({ success: true, atCode });
    } catch (err) {
        res.status(500).json({ error: "Join failed" });
    }
});

// Upload a frame from VR Device (Base64 JPG)
app.post('/api/device/stream', (req, res) => {
    // Surgical Fix: Accept both camelCase and snake_case for deviceId
    const deviceId = req.body.deviceId || req.body.device_id;
    const { frame_base64, trainee_name, doctor_code, stats } = req.body;
    
    const deviceSecret = req.headers['x-device-secret'];
    if (deviceSecret !== DEVICE_STREAM_SECRET) return res.status(403).json({ error: 'Invalid device secret' });

    if (!deviceId || !frame_base64) return res.status(400).send('Missing data');

    const existing = deviceFrames[deviceId] || {};
    deviceFrames[deviceId] = {
        data: frame_base64,
        doctorCode: doctor_code || existing.doctorCode || null,
        traineeName: trainee_name || existing.traineeName || "Active Trainee",
        atCode: existing.atCode || "AT-????",
        stats: stats || existing.stats || { score: 0, progress: 0, safetyScore: 0 },
        timestamp: Date.now()
    };
    res.json({ success: true });
});

// Get all active sessions for a specific doctor
app.get('/api/admin/active-sessions', verifyToken, async (req, res) => {
    const now = Date.now();
    const active = [];

    for (const [id, frame] of Object.entries(deviceFrames)) {
        if (now - frame.timestamp < 30000) {
            let isAllowed = (req.user.role === 'admin') || (String(frame.doctorCode) === String(req.user.code));
            if (isAllowed) {
                active.push({
                    deviceId: id,
                    traineeName: frame.traineeName,
                    atCode: frame.atCode || "AT-????",
                    timestamp: frame.timestamp,
                    hasFeed: !!frame.data,
                    stats: frame.stats
                });
            }
        }
    }
    res.json(active);
});

// Retrieve latest frame for Admin Dashboard
app.get('/api/device/stream/:deviceId', verifyToken, (req, res) => {
    const frame = deviceFrames[req.params.deviceId];
    if (!frame || (Date.now() - frame.timestamp > 10000)) {
        return res.json({ status: 'offline' });
    }
    res.json({ 
        status: 'online', 
        frame: frame.data, 
        stats: frame.stats,
        timestamp: frame.timestamp 
    });
});

app.listen(PORT, () => {
    console.log(`🚀 AeroTwin Backend online on port ${PORT}`);
});
