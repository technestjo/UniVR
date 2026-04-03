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

// --- MODELS ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'doctor'], default: 'doctor' },
    code: { type: String, unique: true } // Unique code for doctors
});

const DoctorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    password: { type: String, default: '123456' },
    createdAt: { type: Date, default: Date.now }
});

const DeviceSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    atCode: String,
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    ownerInfo: { type: String, default: 'AeroTwin Unit' },
    deviceModel: String,
    os: String,
    ram: String,
    cpu: String,
    gpu: String,
    lastSeen: { type: Date, default: Date.now }
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
    createdAt: { type: Date, default: Date.now }
});

const CmsContentSchema = new mongoose.Schema({
    page: { type: String, required: true, unique: true },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    lastUpdated: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Doctor = mongoose.model('Doctor', DoctorSchema);
const Device = mongoose.model('Device', DeviceSchema);
const Report = mongoose.model('Report', ReportSchema);
const CmsContent = mongoose.model('CmsContent', CmsContentSchema);

// --- MIDDLEWARE ---
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
    
    // Check main User table first
    let user = await User.findOne({ username, password });
    
    // If not found in User, check Doctors table (allowing doctors to login via admin.html if needed)
    if (!user) {
        const doc = await Doctor.findOne({ code: username, password });
        if (doc) {
            user = { _id: doc._id, username: doc.name, role: 'doctor', code: doc.code };
        }
    }

    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role, code: user.code }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ success: true, token, role: user.role });
});

// --- ADMIN MANAGEMENT ROUTES ---

// Reports
app.get('/api/admin/reports', verifyToken, async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'doctor') query.doctor_code = req.user.code;
        const reports = await Report.find(query).sort({ createdAt: -1 });
        res.json(reports);
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

app.delete('/api/admin/reports/:id', verifyToken, async (req, res) => {
    try {
        await Report.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Delete failed" }); }
});

// Doctors
app.get('/api/admin/doctors', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const docs = await Doctor.find().sort({ createdAt: -1 });
    res.json(docs);
});

app.post('/api/admin/doctors', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { name, code, password } = req.body;
    try {
        const newDoc = new Doctor({ name, code, password });
        await newDoc.save();
        res.json({ success: true });
    } catch (err) { res.status(400).json({ error: "Duplicate code" }); }
});

app.delete('/api/admin/doctors/:id', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    await Doctor.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// Devices
app.get('/api/admin/devices', verifyToken, async (req, res) => {
    const devices = await Device.find().sort({ lastSeen: -1 });
    res.json(devices);
});

app.post('/api/admin/devices/:id/status', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    await Device.findByIdAndUpdate(req.params.id, { status: req.body.status });
    res.json({ success: true });
});

// CMS Content
app.get('/api/cms/:page', async (req, res) => {
    const content = await CmsContent.findOne({ page: req.params.page });
    res.json(content ? content.content : {});
});

app.post('/api/cms/:page', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    await CmsContent.findOneAndUpdate(
        { page: req.params.page },
        { content: req.body, lastUpdated: Date.now() },
        { upsate: true, new: true, upsert: true }
    );
    res.json({ success: true });
});

// --- VR DEVICE DATA INGESTION ---
app.post('/api/device/report', async (req, res) => {
    try {
        const secret = req.headers['x-app-secret'];
        if (secret !== 'AeroTwin_Device_Stream_Secure_Key_9988') return res.status(403).send('Forbidden');
        const report = new Report({ ...req.body, createdAt: Date.now() });
        await report.save();
        res.json({ success: true, id: report._id });
    } catch (err) { res.status(500).json({ error: "Ingestion failed" }); }
});

// System health check for devices
app.post('/api/device/sync', async (req, res) => {
    const { deviceId, atCode, ownerInfo, specs } = req.body;
    if (!deviceId) return res.status(400).send('Missing ID');
    
    const dev = await Device.findOneAndUpdate(
        { deviceId },
        { 
            atCode, 
            ownerInfo, 
            lastSeen: Date.now(),
            deviceModel: specs?.model,
            os: specs?.os,
            ram: specs?.ram,
            cpu: specs?.cpu,
            gpu: specs?.gpu
        },
        { upsert: true, new: true }
    );
    res.json({ success: true, status: dev.status });
});

// --- AI INTELLIGENCE SYSTEM ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Surgical Fix: Upgrade to v1beta/2.5-flash as requested by user
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
الرجاء استخدام تنسيق Markdown لترتيب الإجابة بعناوين واضحة وعريضة.`;

        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        res.json({ analysis: data.candidates[0].content.parts[0].text, traineeName: report.trainee_name });
    } catch (err) { res.status(500).json({ error: "AI sync failed" }); }
});

app.post('/api/ai/analyze-class', verifyToken, async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'doctor') query.doctor_code = req.user.code;
        const reports = await Report.find(query).limit(10);
        const sum = reports.map(r => `- ${r.trainee_name}: ${r.score}%`).join('\n');
        const prompt = `أنت رئيس قسم صيانة محركات الطيران. لديك هذا الملخص لطلابك. أعط بفقرة قصيرة وجهة نظرك بالصف باللغة العربية.\n${sum}`;
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        res.json({ analysis: data.candidates[0].content.parts[0].text });
    } catch (err) { res.status(500).json({ error: "AI Class failed" }); }
});

// --- LIVE STREAM SYSTEM ---
const deviceFrames = {};

app.post('/api/device/stream', (req, res) => {
    // Surgical Fix: Accept both camelCase and snake_case for deviceId
    const deviceId = req.body.deviceId || req.body.device_id;
    const { frame_base64, trainee_name, doctor_code, stats } = req.body;
    if (!deviceId || !frame_base64) return res.status(400).send('Missing data');

    deviceFrames[deviceId] = {
        data: frame_base64,
        doctorCode: doctor_code || null,
        traineeName: trainee_name || "Active Trainee",
        stats: stats || { score: 0, progress: 0, safetyScore: 0 },
        timestamp: Date.now()
    };
    res.json({ success: true });
});

app.get('/api/admin/active-sessions', verifyToken, async (req, res) => {
    const now = Date.now();
    const active = [];
    for (const [id, frame] of Object.entries(deviceFrames)) {
        if (now - frame.timestamp < 30000) {
            let isAllowed = (req.user.role === 'admin') || (String(frame.doctorCode) === String(req.user.code));
            if (isAllowed) {
                active.push({ deviceId: id, traineeName: frame.traineeName, atCode: "AT-ACTIVE", hasFeed: !!frame.data, stats: frame.stats });
            }
        }
    }
    res.json(active);
});

app.get('/api/device/stream/:deviceId', verifyToken, (req, res) => {
    const frame = deviceFrames[req.params.deviceId];
    if (!frame || (Date.now() - frame.timestamp > 10000)) return res.json({ status: 'offline' });
    res.json({ status: 'online', frame: frame.data, stats: frame.stats, timestamp: frame.timestamp });
});

app.listen(PORT, () => {
    console.log(`🚀 AeroTwin Backend online on port ${PORT}`);
});
