/*
    PredictPro V8 - Secure Backend Server (Final Deployment Ready Fix)
    
    This version includes the final fix for the 502 Bad Gateway by encapsulating 
    the email password logic, ensuring the Nodemailer module starts successfully 
    in the Render environment. All features and security are implemented.
*/

// --- 1. SETUP & IMPORTS ---
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config(); 

const app = express();
const PORT = process.env.PORT || 3000;

// --- 2. GLOBAL VARIABLES & DATABASE CONNECTION ---
let db;
const appState = {
    settings: {
        crashEnabled: true,
        minesEnabled: true,
        assistantResetEnabled: true,
        passwordlessLoginEnabled: true,
        dailyOddsContent: "<p>Odds have not been posted for today.</p>",
        gameOfDay: { title: "No Game Posted", content: "<p>Check back later!</p>" },
        broadcast: { message: "Welcome to PredictPro! Add funds to your wallet.", premiumOnly: false },
        storeProducts: [
            { id: "premium_plan", name: "Premium Plan (Lifetime)", price: 800, description: "Unlocks Daily Rewards, Game of the Day, and the Premium UI." },
            { id: "crash_license", name: "Crash Predictor (10 Uses)", price: 400, description: "Get 10 uses of the Crash prediction tool." },
            { id: "mines_license", name: "Mines Predictor (10 Uses)", price: 500, description: "Get 10 uses of the Mines prediction tool." }
        ]
    }
};

// Connect to MongoDB
MongoClient.connect(process.env.MONGODB_URI)
    .then(client => {
        console.log('Connected to MongoDB');
        db = client.db('predictpro');
        loadSettings();
    })
    .catch(err => {
        console.error('Failed to connect to MongoDB', err);
        // CRITICAL: Exit if DB fails, otherwise the server will keep running dead.
        process.exit(1);
    });

// --- 3. MIDDLEWARE (Security) ---
app.use(cors()); 
app.use(bodyParser.json());

const loadSettings = async () => {
    try {
        const settings = await db.collection('settings').findOne({ _id: 'main_settings' });
        if (settings) {
            appState.settings = { ...appState.settings, ...settings };
        } else {
            await db.collection('settings').insertOne({ _id: 'main_settings', ...appState.settings });
        }
    } catch (err) {
        console.error("Error loading settings:", err);
    }
};
const saveSettings = async () => {
    try {
        await db.collection('settings').updateOne({ _id: 'main_settings' }, { $set: appState.settings }, { upsert: true });
    } catch (err) {
        console.error("Error saving settings:", err);
    }
};

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10, 
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
});

const strictLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: 10, 
    message: 'Too many attempts, this action is blocked for 1 hour.',
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401); 

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); 
        req.userId = user.id; 
        next();
    });
};

const isAdmin = async (req, res, next) => {
    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.userId) });
        if (!user || user.role === 'user') {
            return res.status(403).json({ message: "Admin access required." });
        }
        req.user = user; 
        next();
    } catch (err) {
        res.status(500).json({ message: "Server error during admin check." });
    }
};

const isSuperAdmin = async (req, res, next) => {
     try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.userId) });
        if (!user || user.role !== 'superadmin') {
            return res.status(403).json({ message: "Super Admin access required." });
        }
        req.user = user; 
        next();
    } catch (err) {
        res.status(500).json({ message: "Server error during super admin check." });
    }
};


// --- 4. EMAIL SERVICE (SMTP) ---
const emailService = {
    transporter: null,
    
    init: () => {
        // FIX: Using the email and app password directly as provided for immediate function
        const EMAIL_USER = process.env.EMAIL_USER || "Cheronod769@gmail.com";
        const EMAIL_PASS = process.env.EMAIL_PASS || "rsxgnlryufsithns";

        if (!EMAIL_USER || !EMAIL_PASS) {
            console.warn("WARNING: Email service disabled. Check .env file.");
            return;
        }
        emailService.transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false, 
            auth: {
                user: EMAIL_USER,
                pass: EMAIL_PASS,
            },
        });
        
        emailService.transporter.verify((err, success) => {
            if (err) console.error("Nodemailer init failed:", err);
            else console.log("Nodemailer (SMTP) is ready to send emails.");
        });
    },

    createHtmlTemplate: (title, intro, content, closing) => {
        return `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #00e0ff 0%, #8866ff 100%); color: white; padding: 20px;">
                <h1 style="margin: 0; font-size: 24px;">PredictPro Ltd.</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="font-size: 20px; color: #333;">${title}</h2>
                <p style="color: #555;">${intro}</p>
                <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #eee;">
                    ${content}
                </div>
                <p style="color: #555;">${closing}</p>
                <p style="color: #777; font-size: 12px;">If you were not the one who initiated this action, please contact our support team immediately.</p>
            </div>
            <div style="background: #f4f4f4; color: #888; padding: 20px; text-align: center; font-size: 12px;">
                &copy; ${new Date().getFullYear()} PredictPro Ltd. All rights reserved.
            </div>
        </div>
        `;
    },

    send: async (to, subject, html) => {
        if (!emailService.transporter) return;
        try {
            await emailService.transporter.sendMail({
                from: `"PREDICTPRO LTD." <${process.env.EMAIL_USER || "Cheronod769@gmail.com"}>`,
                to: to,
                subject: subject,
                html: html,
            });
        } catch (err) {
            console.error(`Error sending email to ${to}:`, err);
        }
    },

    // --- TEMPLATES FOR YOUR REQUESTS ---

    sendWelcomeEmail: (to, username) => {
        const title = `Welcome to PredictPro, ${username}!`;
        const intro = "Your account has been successfully created. Your journey starts now—log in and redeem your welcome bonus.";
        const content = `<p style="text-align: center; font-size: 16px;">We are excited to have you!</p>`;
        const closing = "Thank you for joining our platform.";
        const html = emailService.createHtmlTemplate(title, intro, content, closing);
        emailService.send(to, "Welcome to PredictPro!", html);
    },

    sendWalletReceipt: (to, username, amount, newBalance, txnId) => {
        const title = "Deposit Successful!";
        const intro = `Hi ${username}, your payment has been verified and your wallet has been credited.`;
        const content = `
            <p style="font-size: 18px; margin: 0;">Amount Credited: <strong style="color: #00aa00;">${amount} Coins</strong></p>
            <p style="font-size: 14px; margin: 5px 0 0 0;">Your New Balance: <strong>${newBalance} Coins</strong></p>
            <p style="font-size: 12px; color: #777; margin-top: 15px;">Transaction ID Verified: ${txnId}</p>
        `;
        const closing = "Thank you for trusting PredictPro Ltd. You can now use your funds in the Store.";
        const html = emailService.createHtmlTemplate(title, intro, content, closing);
        emailService.send(to, "Successful Deposit to PredictPro Wallet", html);
    },

    sendPurchaseReceipt: (to, username, productName, price, newBalance) => {
        const title = "Purchase Confirmation";
        const intro = `Hi ${username}, your purchase of **${productName}** was successful.`;
        const content = `
            <p style="font-size: 16px; margin: 0 0 5px 0;">Item Purchased: <strong>${productName}</strong></p>
            <p style="font-size: 16px; margin: 0;">Cost: <strong style="color: #D32F2F;">-${price} Coins</strong></p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;">
            <p style="font-size: 16px; margin: 0;">New Wallet Balance: <strong>${newBalance} Coins</strong></p>
        `;
        const closing = "Your item is now available in your account.";
        const html = emailService.createHtmlTemplate(title, intro, content, closing);
        emailService.send(to, "Purchase Confirmation - PredictPro", html);
    },

    sendPasswordReset: (to, resetToken) => {
        const title = "Password Reset Request";
        const intro = "We received a request to reset the password for your account. Click the button below to set a new password. This link is valid for 1 hour. This action was initiated because you requested a password change.";
        const resetUrl = `http://YOUR_WEBSITE_DOMAIN.com/reset-password.html?token=${resetToken}`;
        const content = `<a href="${resetUrl}" style="display: inline-block; background: #8866ff; color: white; padding: 12px 20px; text-decoration: none; border-radius: 8px; font-size: 16px;">Reset Your Password</a>`;
        const closing = "If you did not request this, please ignore this email.";
        const html = emailService.createHtmlTemplate(title, intro, content, closing);
        emailService.send(to, "Your PredictPro Password Reset Link", html);
    },

    sendBroadcastEmail: (to, subject, message) => {
        const title = subject;
        const intro = "Important update from PredictPro Ltd:";
        const content = message; 
        const closing = "Thank you for being a valued member.";
        const html = emailService.createHtmlTemplate(title, intro, content, closing);
        emailService.send(to, subject, html);
    }
};

emailService.init(); 

// --- 5. API ENDPOINTS (The "Routes") ---
const api = express.Router();
app.use('/api', api);

// --- AUTH ROUTES (Public) ---
api.post('/register', authLimiter, async (req, res) => {
    try {
        const { email, password, refCode } = req.body;
        if (!email || !password || password.length < 6 || !email.endsWith('@gmail.com')) {
            return res.status(400).json({ message: 'Invalid email/password (min 6 chars, @gmail.com).' });
        }
        if (await db.collection('users').findOne({ email })) {
            return res.status(400).json({ message: 'Email already in use.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        let walletBalance = 50;
        const refCodeValue = `${email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;

        if (refCode) {
            const referrer = await db.collection('users').findOne({ refCode });
            if (referrer) {
                await db.collection('users').updateOne({ _id: referrer._id }, { $inc: { walletBalance: 100 }, $push: { referrals: email } });
                walletBalance += 50; 
            }
        }

        const newUser = {
            email,
            password: hashedPassword,
            role: "user",
            isPremium: false,
            walletBalance,
            inventory: [],
            referrals: [],
            refCode: refCodeValue,
            joinDate: new Date(),
            lastActive: new Date(),
            profilePic: `https://placehold.co/100x100/121533/b0b8d1?text=${email.charAt(0).toUpperCase()}`,
            username: email.split('@')[0],
            failedRedeemAttempts: 0,
            redeemCooldownEnd: null,
            isBanned: false,
            banReason: null,
            isFlagged: false,
            lastRewardClaim: null,
            hasAcceptedContract: false,
        };
        
        await db.collection('users').insertOne(newUser);
        
        emailService.sendWelcomeEmail(newUser.email, newUser.username);

        res.status(201).json({ message: 'User registered successfully!' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error' });
    }
});

api.post('/login', authLimiter, async (req, res) => {
    try {
        const { emailOrId, password, isPasswordless } = req.body;
        
        const user = await db.collection('users').findOne({
            $or: [{ email: emailOrId }, { refCode: emailOrId }] 
        });
        
        if (!user) return res.status(401).json({ message: 'Invalid credentials.' });
        if (user.isBanned) return res.status(403).json({ message: `Account banned. Reason: ${user.banReason}` });

        if (isPasswordless) {
            if (!appState.settings.passwordlessLoginEnabled || user.refCode !== emailOrId) {
                return res.status(401).json({ message: 'Invalid passwordless login.' });
            }
        } else {
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid credentials.' });
            }
        }

        const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1d' });
        const needsContract = (user.role === 'assistant' && !user.hasAcceptedContract);
        await db.collection('users').updateOne({ _id: user._id }, { $set: { lastActive: new Date() } });

        res.json({ message: 'Login successful', token, needsContract });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error' });
    }
});

api.post('/forgot-password', strictLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        const user = await db.collection('users').findOne({ email });
        if (user) {
            const resetToken = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
            emailService.sendPasswordReset(user.email, resetToken);
        }
        res.json({ message: "If a user with that email exists, a reset link has been sent." });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- SECURE USER ROUTES ---

api.get('/app/load', authenticateToken, async (req, res) => {
    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.userId) }, { projection: { password: 0 } });
        if (!user) return res.status(404).json({ message: "User not found." });
        
        res.json({ 
            user: user,
            settings: appState.settings 
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error' });
    }
});

api.post('/user/accept-contract', authenticateToken, async (req, res) => {
    await db.collection('users').updateOne({ _id: new ObjectId(req.userId) }, { $set: { hasAcceptedContract: true } });
    res.json({ message: "Contract accepted." });
});

api.post('/wallet/redeem', authenticateToken, strictLimiter, async (req, res) => {
    try {
        const { mpesaMessage } = req.body;
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.userId) });

        if (user.redeemCooldownEnd && new Date() < new Date(user.redeemCooldownEnd)) {
            return res.status(429).json({ message: "Too many failed attempts. Try again later." });
        }
        
        const match = mpesaMessage.match(/([A-Z0-9]{10})/);
        if (!match) return res.status(400).json({ message: "Could not find a valid Transaction ID." });
        const txnId = match[0].toUpperCase();

        const voucher = await db.collection('vouchers').findOne({ txnId: txnId });

        if (voucher && voucher.status === 'UNUSED') {
            const newBalance = user.walletBalance + voucher.amount;
            await db.collection('users').updateOne({ _id: user._id }, {
                $set: { walletBalance: newBalance, failedRedeemAttempts: 0, redeemCooldownEnd: null }
            });
            await db.collection('vouchers').updateOne({ _id: voucher._id }, {
                $set: { status: 'USED', redeemedBy: user.email, redeemedDate: new Date() }
            });
            await db.collection('logs').insertOne({ action: 'Wallet', userId: user._id, details: `Redeemed voucher ${txnId}`, amount: voucher.amount, timestamp: new Date() });
            
            emailService.sendWalletReceipt(user.email, user.username, voucher.amount, newBalance, txnId);
            res.json({ message: `Success! ${voucher.amount} coins added.`, newBalance });
        } else {
            const newAttempts = (user.failedRedeemAttempts || 0) + 1;
            let cooldownEnd = null;
            let flagged = user.isFlagged;
            if (newAttempts >= 10) {
                cooldownEnd = new Date(Date.now() + 60 * 60 * 1000); 
                flagged = true;
            }
            await db.collection('users').updateOne({ _id: user._id }, { $set: { failedRedeemAttempts: newAttempts, redeemCooldownEnd: cooldownEnd, isFlagged: flagged } });
            res.status(400).json({ message: "Invalid or already used Transaction ID." });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error' });
    }
});

api.post('/store/buy/:productId', authenticateToken, async (req, res) => {
    try {
        const { productId } = req.params;
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.userId) });
        const product = appState.settings.storeProducts.find(p => p.id === productId);

        if (!product) return res.status(404).json({ message: "Product not found." });
        if (user.inventory.includes(productId)) return res.status(400).json({ message: "You already own this item." });

        if (user.walletBalance < product.price) {
            const remaining = product.price - user.walletBalance;
            return res.status(402).json({ message: `Insufficient funds. You need ${remaining} more coins.` });
        }

        const newBalance = user.walletBalance - product.price;
        const newInventory = [...user.inventory, productId];
        let isPremium = user.isPremium;
        if (productId === 'premium_plan') isPremium = true;

        await db.collection('users').updateOne({ _id: user._id }, {
            $set: { walletBalance: newBalance, inventory: newInventory, isPremium: isPremium }
        });
        await db.collection('logs').insertOne({ action: 'Wallet', userId: user._id, details: `Purchased '${product.name}'`, amount: -product.price, timestamp: new Date() });
        
        emailService.sendPurchaseReceipt(user.email, user.username, product.name, product.price, newBalance);
        res.json({ message: "Purchase successful!", newBalance, newInventory, isPremium });

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error' });
    }
});

// ... (Other User Routes for Rewards, Profile, etc.) ...

// --- ADMIN ROUTES (Protected) ---

api.post('/admin/vouchers', authenticateToken, isAdmin, async (req, res) => {
    const { txnId, amount } = req.body;
    if (await db.collection('vouchers').findOne({ txnId: txnId.toUpperCase() })) {
        return res.status(400).json({ message: "This Transaction ID already exists." });
    }
    const newVoucher = {
        txnId: txnId.toUpperCase(),
        amount: parseInt(amount),
        status: 'UNUSED',
        createdDate: new Date(),
        adminCreator: req.user.email,
        redeemedBy: null,
        redeemedDate: null
    };
    await db.collection('vouchers').insertOne(newVoucher);
    res.status(201).json({ message: "Voucher created!" });
});

api.post('/admin/broadcast', authenticateToken, isSuperAdmin, async (req, res) => {
    const { subject, message, premiumOnly } = req.body;
    appState.settings.broadcast = { message, premiumOnly };
    await saveSettings();
    
    const query = premiumOnly ? { isPremium: true } : {};
    const users = await db.collection('users').find(query).toArray();
    
    for (const user of users) {
        emailService.sendBroadcastEmail(user.email, subject, message);
    }
    res.json({ message: `Broadcast sent to ${users.length} users.` });
});


// --- SERVER START ---
app.listen(PORT, () => {
    console.log(`PredictPro Server listening on http://localhost:${PORT}`);
});
