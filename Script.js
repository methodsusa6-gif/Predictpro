/*
    PredictPro Ultra V7
    Main Application Logic
    
    NOTE: All "database" operations are simulated using localStorage.
    All "AI" or "API" calls are faked with timeouts and random numbers
    for demonstration purposes, as requested.
*/

document.addEventListener('DOMContentLoaded', () => {
    const App = {
        // --- 1. STATE & DATABASE ---
        state: {
            currentUser: null,
            users: [],
            payments: [],
            tickets: [],
            settings: {
                crashEnabled: true,
                minesEnabled: true,
                assistantResetEnabled: true,
                passwordlessLoginEnabled: true,
                maintenanceMessage: "Please check back later.",
                gamePrices: {
                    crash: 100,
                    mines: 150,
                    odds: 50
                },
                gameOfDay: {
                    title: "No Game Posted",
                    content: "<p>Check back later for the game of the day!</p>"
                },
                broadcast: {
                    message: "Welcome to PredictPro! Upgrade to Premium for full access.",
                    premiumOnly: false
                }
            },
            logs: [],
            captcha: {
                login: '',
                register: ''
            }
        },

        db: {
            load: () => {
                const users = localStorage.getItem('predictpro_users');
                const payments = localStorage.getItem('predictpro_payments');
                const tickets = localStorage.getItem('predictpro_tickets');
                const settings = localStorage.getItem('predictpro_settings');
                const logs = localStorage.getItem('predictpro_logs');
                
                if (users) {
                    App.state.users = JSON.parse(users);
                } else {
                    // Create Super Admin
                    App.state.users = [
                        {
                            id: `pp-${Date.now()}`,
                            email: "shadowvybez001@gmail.com",
                            password: App.utils.hashPassword("123@legit"),
                            role: "superadmin",
                            isPremium: true,
                            coins: 1000,
                            referrals: [],
                            refCode: App.utils.generateId(8),
                            joinDate: new Date().toISOString(),
                            lastActive: new Date().toISOString(),
                            profilePic: "https://placehold.co/100x100/121533/b0b8d1?text=SA",
                            username: "Super Admin",
                            failedPaymentUploads: 0,
                            paymentCooldownEnd: null,
                            isBanned: false,
                            banReason: null,
                            isFlagged: false,
                            lastRewardClaim: null
                        }
                    ];
                }
                
                App.state.payments = payments ? JSON.parse(payments) : [];
                App.state.tickets = tickets ? JSON.parse(tickets) : [];
                App.state.logs = logs ? JSON.parse(logs) : [];
                if (settings) {
                    // Merge settings to avoid losing new defaults
                    const savedSettings = JSON.parse(settings);
                    App.state.settings = { ...App.state.settings, ...savedSettings };
                }
                App.db.save();
            },
            save: () => {
                localStorage.setItem('predictpro_users', JSON.stringify(App.state.users));
                localStorage.setItem('predictpro_payments', JSON.stringify(App.state.payments));
                localStorage.setItem('predictpro_tickets', JSON.stringify(App.state.tickets));
                localStorage.setItem('predictpro_settings', JSON.stringify(App.state.settings));
                localStorage.setItem('predictpro_logs', JSON.stringify(App.state.logs));
            }
        },

        // --- 2. CORE APP INIT ---
        init: () => {
            App.db.load();
            App.initEventListeners();
            App.ui.auth.generateCaptcha('login');
            App.ui.auth.generateCaptcha('register');
            App.autoDeleteInactiveUsers();
            console.log("PredictPro V7 Initialized.");
        },

        initEventListeners: () => {
            // Auth
            document.querySelector('.auth-toggle').addEventListener('click', App.ui.auth.toggleForm);
            document.getElementById('login-form').addEventListener('submit', App.handlers.auth.login);
            document.getElementById('register-form').addEventListener('submit', App.handlers.auth.register);
            document.getElementById('login-captcha-refresh').addEventListener('click', () => App.ui.auth.generateCaptcha('login'));
            document.getElementById('register-captcha-refresh').addEventListener('click', () => App.ui.auth.generateCaptcha('register'));
            document.getElementById('login-passwordless').addEventListener('change', App.ui.auth.togglePasswordless);
            
            // Global
            document.getElementById('logout-btn').addEventListener('click', App.handlers.auth.logout);
            document.getElementById('menu-toggle').addEventListener('click', App.ui.nav.toggleSidebar);
            document.getElementById('modal-close-btn').addEventListener('click', App.ui.modal.hide);
            document.getElementById('modal-overlay').addEventListener('click', (e) => {
                if (e.target.id === 'modal-overlay') App.ui.modal.hide();
            });

            // Navigation
            document.getElementById('nav-menu').addEventListener('click', App.handlers.nav.navigate);

            // Floating Buttons
            document.getElementById('support-btn').addEventListener('click', App.handlers.support.showSupportModal);
            document.getElementById('report-issue-btn').addEventListener('click', App.handlers.support.reportIssue);

            // Dashboard
            document.getElementById('copy-ref-link-btn').addEventListener('click', App.handlers.dashboard.copyRefLink);

            // Predictions
            document.getElementById('get-crash-prediction').addEventListener('click', App.handlers.predictions.getPrediction);
            document.getElementById('get-mines-prediction').addEventListener('click', App.handlers.predictions.getPrediction);
            document.getElementById('get-odds-prediction').addEventListener('click', App.handlers.predictions.getPrediction);

            // Payments
            document.getElementById('payment-upload-form').addEventListener('submit', App.handlers.payments.submitScreenshot);
            
            // Rewards
            document.getElementById('claim-reward-btn').addEventListener('click', App.handlers.rewards.claimDailyReward);

            // Profile
            document.getElementById('profile-update-form').addEventListener('submit', App.handlers.profile.updateProfile);
            document.getElementById('profile-pic-upload').addEventListener('change', App.handlers.profile.previewProfilePic);

            // User Support
            document.getElementById('support-ticket-form').addEventListener('submit', App.handlers.support.submitTicket);

            // --- Admin Handlers (Event delegation for dynamic content) ---
            document.getElementById('admin-user-table-body').addEventListener('click', App.handlers.admin.handleUserAction);
            document.getElementById('admin-payment-table-body').addEventListener('click', App.handlers.admin.handlePaymentAction);
            document.getElementById('admin-support-inbox-container').addEventListener('click', App.handlers.admin.handleSupportAction);
            document.getElementById('admin-assistants-table-body').addEventListener('click', App.handlers.admin.handleAssistantAction);

            // Admin Page Forms
            document.getElementById('game-of-day-form').addEventListener('submit', App.handlers.admin.postGameOfDay);
            document.getElementById('broadcast-form').addEventListener('submit', App.handlers.admin.sendBroadcast);
            document.getElementById('generate-assistant-btn').addEventListener('click', App.handlers.admin.showAssistantModal);

            // Super Admin Settings
            document.getElementById('system-settings-form').addEventListener('submit', App.handlers.superadmin.saveSettings);
        },

        // --- 3. HANDLERS (User Actions) ---
        handlers: {
            auth: {
                login: (e) => {
                    e.preventDefault();
                    App.ui.showLoader('Logging in...');
                    const emailOrId = document.getElementById('login-email').value.trim();
                    const password = document.getElementById('login-password').value;
                    const captcha = document.getElementById('login-captcha-input').value;
                    const isPasswordless = document.getElementById('login-passwordless').checked;

                    if (captcha !== App.state.captcha.login) {
                        App.ui.auth.showError('login', 'Invalid CAPTCHA.');
                        App.ui.auth.generateCaptcha('login');
                        App.ui.hideLoader();
                        return;
                    }

                    let user = App.state.users.find(u => u.email === emailOrId || u.id === emailOrId);

                    if (!user) {
                        App.ui.auth.showError('login', 'User not found.');
                        App.ui.hideLoader();
                        return;
                    }

                    if (user.isBanned) {
                        App.ui.auth.showError('login', `This account is banned. Reason: ${user.banReason}`);
                        App.ui.hideLoader();
                        return;
                    }

                    const handleLoginSuccess = () => {
                        App.state.currentUser = user;
                        user.lastActive = new Date().toISOString();
                        App.db.save();
                        App.utils.logActivity(user.email, "User Login", `User ${user.email} logged in.`);
                        App.ui.auth.showApp();
                        App.ui.hideLoader();
                    };

                    if (isPasswordless) {
                        if (!App.state.settings.passwordlessLoginEnabled) {
                            App.ui.auth.showError('login', 'Passwordless login is currently disabled.');
                            App.ui.hideLoader();
                            return;
                        }
                        if (user.id !== emailOrId) {
                            App.ui.auth.showError('login', 'Passwordless login requires your Website ID.');
                            App.ui.hideLoader();
                            return;
                        }
                        // Passwordless success
                        handleLoginSuccess();
                    } else {
                        if (password.length === 0) {
                             App.ui.auth.showError('login', 'Password is required.');
                             App.ui.hideLoader();
                             return;
                        }
                        if (App.utils.hashPassword(password) === user.password) {
                            // Password success
                            handleLoginSuccess();
                        } else {
                            App.ui.auth.showError('login', 'Invalid email or password.');
                            App.ui.hideLoader();
                        }
                    }
                },
                register: (e) => {
                    e.preventDefault();
                    App.ui.showLoader('Registering...');
                    const email = document.getElementById('register-email').value.trim();
                    const password = document.getElementById('register-password').value;
                    const refCode = document.getElementById('register-ref-code').value.trim();
                    const captcha = document.getElementById('register-captcha-input').value;

                    if (captcha !== App.state.captcha.register) {
                        App.ui.auth.showError('register', 'Invalid CAPTCHA.');
                        App.ui.auth.generateCaptcha('register');
                        App.ui.hideLoader();
                        return;
                    }
                    if (!email.endsWith('@gmail.com')) {
                        App.ui.auth.showError('register', 'Only @gmail.com addresses are allowed.');
                        App.ui.hideLoader();
                        return;
                    }
                    if (password.length < 6) {
                        App.ui.auth.showError('register', 'Password must be at least 6 characters.');
                        App.ui.hideLoader();
                        return;
                    }
                    if (App.state.users.find(u => u.email === email)) {
                        App.ui.auth.showError('register', 'Email already in use.');
                        App.ui.hideLoader();
                        return;
                    }

                    // Create new user
                    const newUser = {
                        id: `pp-${Date.now()}`,
                        email: email,
                        password: App.utils.hashPassword(password),
                        role: "user",
                        isPremium: false,
                        coins: 50, // Welcome bonus
                        referrals: [],
                        refCode: App.utils.generateId(8),
                        joinDate: new Date().toISOString(),
                        lastActive: new Date().toISOString(),
                        profilePic: `https://placehold.co/100x100/121533/b0b8d1?text=${email.charAt(0).toUpperCase()}`,
                        username: email.split('@')[0],
                        failedPaymentUploads: 0,
                        paymentCooldownEnd: null,
                        isBanned: false,
                        banReason: null,
                        isFlagged: false,
                        lastRewardClaim: null
                    };

                    // Handle referral
                    if (refCode) {
                        let referrer = App.state.users.find(u => u.refCode === refCode);
                        if (referrer) {
                            referrer.coins += 100; // Referrer bonus
                            referrer.referrals.push(newUser.id);
                            newUser.coins += 50; // New user bonus for using code
                            App.utils.logActivity(referrer.email, "Referral", `User ${referrer.email} referred ${newUser.email}.`);
                        }
                    }

                    App.state.users.push(newUser);
                    App.db.save();
                    App.utils.logActivity(newUser.email, "User Registration", `New user ${newUser.email} registered.`);
                    App.ui.hideLoader();
                    App.ui.showToast('Registration successful! Please log in.', 'success');
                    App.ui.auth.switchForm('login-form');
                    App.ui.auth.generateCaptcha('register');
                },
                logout: () => {
                    App.utils.logActivity(App.state.currentUser.email, "User Logout", `User ${App.state.currentUser.email} logged out.`);
                    App.state.currentUser = null;
                    App.ui.auth.showLogin();
                }
            },
            nav: {
                navigate: (e) => {
                    let target = e.target.closest('.nav-link');
                    if (!target) return;
                    e.preventDefault();

                    const pageId = target.dataset.page;
                    App.ui.nav.showPage(pageId);

                    // Close sidebar on mobile after navigation
                    if (window.innerWidth < 1024) {
                        App.ui.nav.toggleSidebar(false);
                    }
                }
            },
            dashboard: {
                copyRefLink: () => {
                    const input = document.getElementById('referral-link-input');
                    const url = `https://predictpro.com/register?ref=${App.state.currentUser.refCode}`;
                    input.value = url;
                    input.select();
                    document.execCommand('copy');
                    App.ui.showToast('Referral link copied!', 'success');
                }
            },
            predictions: {
                /**
                 * FAKE AI PREDICTION HANDLER
                 * This simulates an API call as requested.
                 * It does NOT provide real predictions.
                 */
                getPrediction: (e) => {
                    const game = e.target.dataset.game;
                    const user = App.state.currentUser;
                    const price = App.state.settings.gamePrices[game] || 100;

                    if (!user.isPremium) {
                        App.ui.modal.show(
                            "Premium Feature",
                            "<p>This is a premium feature. Please upgrade your account to get predictions.</p>",
                            `<button class="btn btn-primary" id="modal-go-premium">Upgrade Now</button>`
                        );
                        document.getElementById('modal-go-premium').onclick = () => {
                            App.ui.modal.hide();
                            App.ui.nav.showPage('page-payments');
                        };
                        return;
                    }

                    if (user.coins < price) {
                        App.ui.showToast(`Not enough coins. You need ${price} coins.`, 'danger');
                        return;
                    }

                    // Deduct coins
                    user.coins -= price;
                    App.db.save();
                    App.ui.updateDashboard();
                    App.ui.showLoader(`Analyzing ${game}...`);
                    App.utils.logActivity(user.email, "Prediction", `User requested ${game} prediction for ${price} coins.`);

                    // FAKE API CALL
                    setTimeout(() => {
                        let resultHtml = '';
                        if (game === 'crash') {
                            // Fake Crash: Give a value between 1.1x and 5.0x
                            const value = (Math.random() * (5 - 1.1) + 1.1).toFixed(2);
                            const confidence = Math.random() > 0.7 ? "High" : "Low";
                            resultHtml = `<h4>Crash at ${value}x</h4><p>Confidence: ${confidence}</p>`;
                        } else if (game === 'mines') {
                            // Fake Mines: Give a few "safe" spots
                            resultHtml = `<h4>Safe Spots (3x3):</h4><p>[0,1], [1,2], [2,0]</p><p>Confidence: Medium</p>`;
                        } else {
                            // Fake Odds
                            resultHtml = `<h4>Match: A vs B</h4><p>Prediction: 1 (Home Win)</p><p>Odds: 1.75</p>`;
                        }
                        
                        document.getElementById(`${game}-prediction-result`).innerHTML = resultHtml;
                        document.getElementById(`${game}-prediction-result`).style.display = 'block';
                        App.ui.hideLoader();
                        App.ui.showToast(`${game} prediction generated!`, 'success');
                    }, 2000 + Math.random() * 1000);
                }
            },
            payments: {
                submitScreenshot: async (e) => {
                    e.preventDefault();
                    const user = App.state.currentUser;
                    const fileInput = document.getElementById('payment-screenshot-upload');
                    const file = fileInput.files[0];

                    if (user.paymentCooldownEnd && new Date() < new Date(user.paymentCooldownEnd)) {
                        const remaining = Math.round((new Date(user.paymentCooldownEnd) - new Date()) / 1000 / 60);
                        App.ui.showToast(`You must wait ${remaining} more minutes to try again.`, 'danger');
                        return;
                    }

                    if (!file) {
                        App.ui.showToast('Please select a screenshot to upload.', 'warning');
                        return;
                    }

                    App.ui.showLoader('Uploading and submitting...');

                    const base64img = await App.utils.fileToBase64(file);

                    const newPayment = {
                        id: `pay-${Date.now()}`,
                        userId: user.id,
                        userEmail: user.email,
                        date: new Date().toISOString(),
                        amount: 800,
                        screenshot: base64img,
                        status: 'pending' // pending, approved, rejected
                    };

                    App.state.payments.push(newPayment);
                    App.db.save();
                    App.utils.logActivity(user.email, "Payment", `User submitted payment screenshot for verification.`);
                    App.ui.hideLoader();
                    App.ui.showToast('Screenshot submitted for verification.', 'success');
                    App.ui.renderPaymentHistory();
                    fileInput.value = '';
                }
            },
            rewards: {
                claimDailyReward: () => {
                    const user = App.state.currentUser;
                    
                    if (user.lastRewardClaim) {
                        const lastClaim = new Date(user.lastRewardClaim);
                        const nextClaim = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
                        if (new Date() < nextClaim) {
                            App.ui.showToast('You have already claimed your reward for today.', 'warning');
                            return;
                        }
                    }

                    user.coins += 100;
                    user.lastRewardClaim = new Date().toISOString();
                    App.db.save();
                    App.ui.updateDashboard();
                    App.ui.renderRewardPage();
                    App.ui.showToast('100 coins claimed!', 'success');
                    App.utils.logActivity(user.email, "Reward", `User claimed daily reward of 100 coins.`);
                }
            },
            profile: {
                updateProfile: async (e) => {
                    e.preventDefault();
                    App.ui.showLoader('Updating profile...');
                    const user = App.state.currentUser;
                    const newUsername = document.getElementById('profile-username').value.trim();
                    const file = document.getElementById('profile-pic-upload').files[0];

                    if (newUsername) {
                        user.username = newUsername;
                    }
                    if (file) {
                        user.profilePic = await App.utils.fileToBase64(file);
                    }

                    App.db.save();
                    App.ui.updateSidebar(); // Re-render sidebar with new info
                    App.ui.hideLoader();
                    App.ui.showToast('Profile updated!', 'success');
                    App.utils.logActivity(user.email, "Profile Update", `User updated their profile.`);
                },
                previewProfilePic: (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            document.getElementById('profile-pic-preview').src = event.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                }
            },
            support: {
                submitTicket: (e) => {
                    e.preventDefault();
                    const subject = document.getElementById('support-subject').value;
                    const message = document.getElementById('support-message').value;

                    if (!subject || !message) {
                        App.ui.showToast('Please fill in both subject and message.', 'warning');
                        return;
                    }

                    const newTicket = {
                        id: `tkt-${Date.now()}`,
                        userId: App.state.currentUser.id,
                        userEmail: App.state.currentUser.email,
                        subject: subject,
                        status: 'open', // open, closed
                        messages: [
                            {
                                from: 'user',
                                text: message,
                                date: new Date().toISOString()
                            }
                        ]
                    };

                    App.state.tickets.push(newTicket);
                    App.db.save();
                    App.utils.logActivity(App.state.currentUser.email, "Support Ticket", `User opened new ticket: ${subject}`);
                    App.ui.showToast('Support ticket submitted.', 'success');
                    App.ui.renderUserSupportTickets();
                    document.getElementById('support-ticket-form').reset();
                },
                showSupportModal: () => {
                    App.ui.modal.show(
                        "Contact Support",
                        `<p>How can we help you today?</p>
                        <form id="modal-support-form">
                            <div class="form-group">
                                <label for="modal-support-message">Your Message</label>
                                <textarea id="modal-support-message" rows="5" required placeholder="Describe your issue..."></textarea>
                            </div>
                        </form>`,
                        `<button class="btn btn-primary" id="modal-support-submit">Send Message</button>`
                    );

                    document.getElementById('modal-support-submit').onclick = () => {
                        const message = document.getElementById('modal-support-message').value;
                        if (!message) {
                            App.ui.showToast('Please enter a message.', 'warning');
                            return;
                        }
                        
                        // This is a simplified ticket, no subject
                        const newTicket = {
                            id: `tkt-${Date.now()}`,
                            userId: App.state.currentUser.id,
                            userEmail: App.state.currentUser.email,
                            subject: "Support Request from Chat",
                            status: 'open',
                            messages: [{ from: 'user', text: message, date: new Date().toISOString() }]
                        };
                        App.state.tickets.push(newTicket);
                        App.db.save();
                        App.utils.logActivity(App.state.currentUser.email, "Support Ticket", `User opened new ticket from chat.`);
                        App.ui.modal.hide();
                        App.ui.showToast('Support message sent.', 'success');
                        App.ui.renderUserSupportTickets();
                    };
                },
                reportIssue: () => {
                    /**
                     * FAKE SCREENSHOT HANDLER
                     * Browsers cannot take screenshots of the user's screen for security reasons.
                     * This simulates the action.
                     */
                    App.ui.showToast('Simulating screenshot...', 'warning');
                    App.ui.showLoader('Reporting issue...');
                    
                    setTimeout(() => {
                        const fakeTicket = {
                            id: `tkt-issue-${Date.now()}`,
                            userId: App.state.currentUser.id,
                            userEmail: App.state.currentUser.email,
                            subject: "User Issue Report (with Screenshot)",
                            status: 'open',
                            messages: [
                                {
                                    from: 'user',
                                    text: `User reported an issue from page: ${App.state.currentPage}. A simulated screenshot was attached.`,
                                    date: new Date().toISOString()
                                }
                            ]
                        };
                        App.state.tickets.push(fakeTicket);
                        App.db.save();
                        App.utils.logActivity(App.state.currentUser.email, "Issue Report", `User reported an issue with fake screenshot.`);
                        App.ui.hideLoader();
                        App.ui.showToast('Issue reported to admins.', 'success');
                    }, 1500);
                }
            },
            // --- 4. ADMIN HANDLERS ---
            admin: {
                handleUserAction: (e) => {
                    const button = e.target.closest('button');
                    if (!button) return;
                    
                    const userId = button.dataset.id;
                    const action = button.dataset.action;
                    const user = App.state.users.find(u => u.id === userId);
                    if (!user) return;

                    const adminUser = App.state.currentUser;

                    switch (action) {
                        case 'ban': App.handlers.admin.showBanModal(user); break;
                        case 'unban': 
                            user.isBanned = false;
                            user.banReason = null;
                            App.db.save();
                            App.ui.renderAdminUsers();
                            App.utils.logActivity(adminUser.email, "User Unban", `Admin unbanned ${user.email}.`);
                            break;
                        case 'flag': 
                            user.isFlagged = true;
                            App.db.save();
                            App.ui.renderAdminUsers();
                            App.utils.logActivity(adminUser.email, "User Flag", `Admin flagged ${user.email}.`);
                            break;
                        case 'unflag': 
                            user.isFlagged = false;
                            App.db.save();
                            App.ui.renderAdminUsers();
                            App.utils.logActivity(adminUser.email, "User Unflag", `Admin unflagged ${user.email}.`);
                            break;
                        case 'resetpass': App.handlers.admin.showResetPassModal(user); break;
                        case 'viewlog': App.handlers.admin.showUserLogModal(user); break;
                    }
                },
                showBanModal: (user) => {
                    App.ui.modal.show(
                        `Ban User: ${user.email}`,
                        `<p>You must provide a reason for banning this user. This will be logged.</p>
                        <form id="ban-user-form">
                            <div class="form-group">
                                <label for="ban-reason">Reason for Ban</label>
                                <textarea id="ban-reason" rows="4" required></textarea>
                            </div>
                        </form>`,
                        `<button class="btn btn-danger" id="modal-confirm-ban">Confirm Ban</button>`
                    );
                    document.getElementById('modal-confirm-ban').onclick = () => {
                        const reason = document.getElementById('ban-reason').value;
                        if (!reason) {
                            App.ui.showToast('You must provide a reason.', 'warning');
                            return;
                        }
                        user.isBanned = true;
                        user.banReason = reason;
                        App.db.save();
                        App.ui.renderAdminUsers();
                        App.ui.modal.hide();
                        App.utils.logActivity(App.state.currentUser.email, "User Ban", `Admin banned ${user.email}. Reason: ${reason}`);
                    };
                },
                showResetPassModal: (user) => {
                    const adminUser = App.state.currentUser;
                    const canReset = adminUser.role === 'superadmin' || 
                                     (adminUser.role === 'admin') || 
                                     (adminUser.role === 'assistant' && App.state.settings.assistantResetEnabled);

                    if (!canReset) {
                        App.ui.showToast('You do not have permission to reset passwords.', 'danger');
                        return;
                    }

                    App.ui.modal.show(
                        `Reset Password for ${user.email}`,
                        `<p>Enter a new temporary password for this user.</p>
                        <form id="reset-pass-form">
                            <div class="form-group">
                                <label for="new-temp-pass">New Password</label>
                                <input type="text" id="new-temp-pass" required>
                            </div>
                        </form>`,
                        `<button class="btn btn-warning" id="modal-confirm-reset">Set New Password</button>`
                    );
                    document.getElementById('modal-confirm-reset').onclick = () => {
                        const newPass = document.getElementById('new-temp-pass').value;
                        if (newPass.length < 6) {
                            App.ui.showToast('Password must be at least 6 characters.', 'warning');
                            return;
                        }
                        user.password = App.utils.hashPassword(newPass);
                        App.db.save();
                        App.ui.modal.hide();
                        App.ui.showToast(`Password for ${user.email} has been reset.`, 'success');
                        App.utils.logActivity(adminUser.email, "Password Reset", `Admin reset password for ${user.email}.`);
                    };
                },
                showUserLogModal: (user) => {
                    const userLogs = App.state.logs.filter(log => log.user === user.email).reverse();
                    let logHtml = `<div class="data-table-container" style="max-height: 400px; overflow-y: auto;">
                                    <table class="data-table">
                                        <thead><tr><th>Time</th><th>Action</th><th>Details</th></tr></thead>
                                        <tbody>`;
                    
                    if (userLogs.length === 0) {
                        logHtml += `<tr><td colspan="3">No logs found for this user.</td></tr>`;
                    } else {
                        userLogs.forEach(log => {
                            logHtml += `<tr>
                                <td>${new Date(log.timestamp).toLocaleString()}</td>
                                <td>${log.action}</td>
                                <td>${log.details}</td>
                            </tr>`;
                        });
                    }
                    
                    logHtml += `</tbody></table></div>`;
                    App.ui.modal.show(`Activity Log: ${user.email}`, logHtml, '');
                },

                handlePaymentAction: (e) => {
                    const button = e.target.closest('button');
                    if (!button) return;
                    
                    const paymentId = button.dataset.id;
                    const action = button.dataset.action;
                    const payment = App.state.payments.find(p => p.id === paymentId);
                    if (!payment) return;
                    
                    const user = App.state.users.find(u => u.id === payment.userId);
                    const adminUser = App.state.currentUser;

                    switch (action) {
                        case 'approve':
                            payment.status = 'approved';
                            if (user) {
                                user.isPremium = true;
                                user.failedPaymentUploads = 0; // Reset counter
                                user.paymentCooldownEnd = null;
                            }
                            App.db.save();
                            App.ui.renderAdminPayments();
                            App.utils.logActivity(adminUser.email, "Payment Approved", `Admin approved payment ${payment.id} for ${user.email}.`);
                            break;
                        case 'reject':
                            payment.status = 'rejected';
                            if (user) {
                                user.failedPaymentUploads = (user.failedPaymentUploads || 0) + 1;
                                App.utils.logActivity(adminUser.email, "Payment Rejected", `Admin rejected payment ${payment.id} for ${user.email}. Attempt ${user.failedPaymentUploads}.`);
                                
                                if (user.failedPaymentUploads >= 5) {
                                    // 1 hour cooldown
                                    user.paymentCooldownEnd = new Date(Date.now() + 60 * 60 * 1000).toISOString();
                                    App.ui.showToast(`User ${user.email} has been timed out for 1 hour.`, 'warning');
                                }
                            }
                            App.db.save();
                            App.ui.renderAdminPayments();
                            break;
                        case 'view':
                            App.ui.modal.show(
                                `Screenshot for ${payment.userEmail}`,
                                `<img src="${payment.screenshot}" alt="Payment Screenshot" class="modal-img-preview">`,
                                ''
                            );
                            break;
                        case 'ai-verify':
                            /**
                             * FAKE AI VERIFICATION HANDLER
                             * This simulates an AI check as requested.
                             */
                            button.disabled = true;
                            button.textContent = 'Analyzing...';
                            const aiResultEl = document.querySelector(`.ai-result[data-id="${paymentId}"]`);
                            aiResultEl.textContent = '...';

                            setTimeout(() => {
                                const isFake = Math.random() > 0.7; // 30% chance of being "fake"
                                if (isFake) {
                                    aiResultEl.innerHTML = `<span class="badge badge-danger">Likely Fake</span>`;
                                } else {
                                    aiResultEl.innerHTML = `<span class="badge badge-success">Likely Real</span>`;
                                }
                                button.disabled = false;
                                button.textContent = 'Re-Verify';
                                App.utils.logActivity(adminUser.email, "AI Verify", `Admin ran AI check on payment ${payment.id}. Result: ${isFake ? 'Fake' : 'Real'}`);
                            }, 1500);
                            break;
                    }
                },
                postGameOfDay: (e) => {
                    e.preventDefault();
                    const title = document.getElementById('game-of-day-title').value;
                    const content = document.getElementById('game-of-day-content').value;
                    App.state.settings.gameOfDay = { title, content };
                    App.db.save();
                    App.ui.showToast('Game of the Day has been posted!', 'success');
                    App.utils.logActivity(App.state.currentUser.email, "Game of Day", `Admin posted game: ${title}`);
                    // Also update the dashboard if the user views it
                    App.ui.renderDashboard();
                },
                sendBroadcast: (e) => {
                    e.preventDefault();
                    const message = document.getElementById('broadcast-message-input').value;
                    const premiumOnly = document.getElementById('broadcast-premium-only').checked;
                    App.state.settings.broadcast = { message, premiumOnly };
                    App.db.save();
                    App.ui.showToast('Broadcast sent!', 'success');
                    App.utils.logActivity(App.state.currentUser.email, "Broadcast", `Admin sent broadcast: ${message}`);
                    // Also update the dashboard
                    App.ui.renderDashboard();
                },
                handleSupportAction: (e) => {
                    const button = e.target.closest('button');
                    if (e.target.closest('.ticket-header')) {
                        // Toggle view
                        const body = e.target.closest('.support-ticket').querySelector('.ticket-body');
                        body.style.display = (body.style.display === 'none') ? 'block' : 'none';
                    }
                    if (button) {
                        const ticketId = button.dataset.id;
                        const action = button.dataset.action;
                        const ticket = App.state.tickets.find(t => t.id === ticketId);
                        if (!ticket) return;

                        if (action === 'reply') {
                            const replyText = document.getElementById(`reply-text-${ticket.id}`).value;
                            if (!replyText) {
                                App.ui.showToast('Reply cannot be empty.', 'warning');
                                return;
                            }
                            ticket.messages.push({
                                from: 'admin',
                                text: replyText,
                                date: new Date().toISOString()
                            });
                            App.db.save();
                            App.ui.renderAdminSupport(); // Re-render the inbox
                            App.utils.logActivity(App.state.currentUser.email, "Support Reply", `Admin replied to ticket ${ticket.id}.`);
                        }
                        if (action === 'close') {
                            ticket.status = 'closed';
                            App.db.save();
                            App.ui.renderAdminSupport();
                            App.utils.logActivity(App.state.currentUser.email, "Support Close", `Admin closed ticket ${ticket.id}.`);
                        }
                    }
                },
                showAssistantModal: () => {
                    App.ui.modal.show(
                        "Generate Assistant",
                        `<form id="gen-assistant-form">
                            <div class="form-group">
                                <label for="assistant-email">Assistant Email</label>
                                <input type="email" id="assistant-email" required>
                            </div>
                            <div class="form-group">
                                <label for="assistant-pass">Temporary Password</label>
                                <input type="text" id="assistant-pass" required>
                            </div>
                            <div class="form-group">
                                <label for="assistant-expiry">Expiry Date</label>
                                <input type="date" id="assistant-expiry" required>
                            </div>
                        </form>`,
                        `<button class="btn btn-primary" id="modal-confirm-gen-assistant">Generate</button>`
                    );

                    document.getElementById('modal-confirm-gen-assistant').onclick = () => {
                        const email = document.getElementById('assistant-email').value;
                        const password = document.getElementById('assistant-pass').value;
                        const expiry = document.getElementById('assistant-expiry').value;

                        if (!email || password.length < 6 || !expiry) {
                            App.ui.showToast('Please fill all fields. Password min 6 chars.', 'warning');
                            return;
                        }
                        
                        // Check if user already exists
                        if (App.state.users.find(u => u.email === email)) {
                            App.ui.showToast('User with this email already exists.', 'danger');
                            return;
                        }

                        // Create new assistant user
                        const newAssistant = {
                            id: `pp-${Date.now()}`,
                            email: email,
                            password: App.utils.hashPassword(password),
                            role: "assistant",
                            isPremium: false,
                            coins: 0,
                            referrals: [],
                            refCode: App.utils.generateId(8),
                            joinDate: new Date().toISOString(),
                            lastActive: new Date().toISOString(),
                            profilePic: `https://placehold.co/100x100/121533/b0b8d1?text=A`,
                            username: email.split('@')[0],
                            isBanned: false,
                            banReason: null,
                            isFlagged: false,
                            expiryDate: expiry, // New field for assistants
                            contract: "Standard Assistant Contract V1" // Placeholder
                        };
                        
                        App.state.users.push(newAssistant);
                        App.db.save();
                        App.ui.renderAdminAssistants();
                        App.ui.modal.hide();
                        App.ui.showToast('Assistant account generated!', 'success');
                        App.utils.logActivity(App.state.currentUser.email, "Assistant Generated", `Created assistant ${email}.`);
                    };
                },
                handleAssistantAction: (e) => {
                    const button = e.target.closest('button');
                    if (!button) return;
                    
                    const userId = button.dataset.id;
                    const action = button.dataset.action;
                    const user = App.state.users.find(u => u.id === userId);
                    if (!user) return;
                    
                    if (action === 'contract') {
                        App.ui.modal.show(
                            `Contract: ${user.email}`,
                            `<h3>${user.contract}</h3>
                            <p>This is a placeholder for the digital contract. It would outline:</p>
                            <ul>
                                <li>Permitted actions (e.g., reply to tickets).</li>
                                <li>Forbidden actions (e.g., sharing user data).</li>
                                <li>Penalties for violations.</li>
                                <li>Expiry: ${new Date(user.expiryDate).toLocaleDateString()}</li>
                            </ul>
                            <p><strong>This is a (simulated) screenshot of the contract.</strong></p>`,
                            ''
                        );
                    }
                    if (action === 'delete') {
                        if (confirm(`Are you sure you want to delete assistant ${user.email}? This cannot be undone.`)) {
                            App.state.users = App.state.users.filter(u => u.id !== userId);
                            App.db.save();
                            App.ui.renderAdminAssistants();
                            App.utils.logActivity(App.state.currentUser.email, "Assistant Deleted", `Deleted assistant ${user.email}.`);
                        }
                    }
                }
            },
            // --- 5. SUPER ADMIN HANDLERS ---
            superadmin: {
                saveSettings: (e) => {
                    e.preventDefault();
                    App.ui.showLoader('Saving settings...');
                    const settings = App.state.settings;
                    
                    settings.crashEnabled = document.getElementById('toggle-crash-game').checked;
                    settings.minesEnabled = document.getElementById('toggle-mines-game').checked;
                    settings.assistantResetEnabled = document.getElementById('toggle-assistant-reset').checked;
                    settings.passwordlessLoginEnabled = document.getElementById('toggle-passwordless-login').checked;
                    settings.maintenanceMessage = document.getElementById('maintenance-message-input').value;

                    App.db.save();
                    App.ui.hideLoader();
                    App.ui.showToast('System settings saved.', 'success');
                    App.utils.logActivity(App.state.currentUser.email, "Settings Update", `Super Admin updated system settings.`);
                    // Re-render UI elements that depend on settings
                    App.ui.renderPredictionPage();
                }
            }
        },

        // --- 6. UI/RENDERING ---
        ui: {
            auth: {
                toggleForm: (e) => {
                    if (e.target.classList.contains('auth-toggle-btn')) {
                        App.ui.auth.switchForm(e.target.dataset.form);
                    }
                },
                switchForm: (formId) => {
                    document.getElementById('login-form').classList.add('hidden');
                    document.getElementById('register-form').classList.add('hidden');
                    document.getElementById(formId).classList.remove('hidden');

                    document.querySelector('.auth-toggle-btn[data-form="login-form"]').classList.remove('active');
                    document.querySelector('.auth-toggle-btn[data-form="register-form"]').classList.remove('active');
                    document.querySelector(`.auth-toggle-btn[data-form="${formId}"]`).classList.add('active');
                    
                    App.ui.auth.showError('login', '');
                    App.ui.auth.showError('register', '');
                },
                togglePasswordless: (e) => {
                    const passwordInput = document.getElementById('login-password');
                    if (e.target.checked) {
                        passwordInput.disabled = true;
                        passwordInput.value = '';
                    } else {
                        passwordInput.disabled = false;
                    }
                },
                generateCaptcha: (type) => {
                    const canvas = document.getElementById(`${type}-captcha-canvas`);
                    const ctx = canvas.getContext('2d');
                    const text = App.utils.generateId(6);
                    App.state.captcha[type] = text;
                    
                    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary');
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    ctx.font = 'bold 36px Poppins';
                    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--brand-primary');
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
                    
                    // Add noise
                    for (let i = 0; i < 10; i++) {
                        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-color');
                        ctx.beginPath();
                        ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
                        ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
                        ctx.stroke();
                    }
                },
                showError: (form, message) => {
                    document.getElementById(`${form}-error`).textContent = message;
                },
                showApp: () => {
                    document.getElementById('auth-screen').classList.add('hidden');
                    document.getElementById('app-container').classList.remove('hidden');
                    document.getElementById('app-container').classList.add('visible');
                    App.ui.renderAll();
                },
                showLogin: () => {
                    document.getElementById('app-container').classList.add('hidden');
                    document.getElementById('app-container').classList.remove('visible');
                    document.getElementById('auth-screen').classList.remove('hidden');
                    // Hide floating buttons
                    document.getElementById('whatsapp-btn').classList.add('hidden');
                    document.getElementById('support-btn').classList.add('hidden');
                    document.getElementById('report-issue-btn').classList.add('hidden');
                }
            },
            nav: {
                toggleSidebar: (forceOpen) => {
                    const sidebar = document.getElementById('sidebar');
                    if (typeof forceOpen === 'boolean') {
                        sidebar.classList.toggle('open', forceOpen);
                    } else {
                        sidebar.classList.toggle('open');
                    }
                },
                showPage: (pageId) => {
                    document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
                    const page = document.getElementById(pageId);
                    if (page) {
                        page.classList.remove('hidden');
                        
                        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
                        const activeLink = document.querySelector(`.nav-link[data-page="${pageId}"]`);
                        if (activeLink) {
                            activeLink.classList.add('active');
                            document.getElementById('page-title').textContent = activeLink.textContent.trim().replace(/[^\w\s]/gi, '').trim();
                        }
                        App.state.currentPage = pageId;

                        // Call render function for that page
                        const renderFunc = App.ui.pageRenderers[pageId];
                        if (renderFunc) {
                            renderFunc();
                        }
                    }
                }
            },
            modal: {
                show: (title, body, footer) => {
                    document.getElementById('modal-title').innerHTML = title;
                    document.getElementById('modal-body').innerHTML = body;
                    document.getElementById('modal-footer').innerHTML = footer || ''; // Default to no footer
                    document.getElementById('modal-overlay').classList.remove('hidden');
                },
                hide: () => {
                    document.getElementById('modal-overlay').classList.add('hidden');
                }
            },
            showToast: (message, type = 'success') => {
                const container = document.getElementById('notification-container');
                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                toast.textContent = message;
                container.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    setTimeout(() => toast.remove(), 500);
                }, 4000);
            },
            showLoader: (text) => {
                document.getElementById('loader-text').textContent = text || 'Loading...';
                document.getElementById('loader-overlay').classList.remove('hidden');
            },
            hideLoader: () => {
                document.getElementById('loader-overlay').classList.add('hidden');
            },

            // --- 7. PAGE RENDERERS ---
            renderAll: () => {
                const user = App.state.currentUser;
                if (!user) return;

                // Show floating buttons
                document.getElementById('whatsapp-btn').classList.remove('hidden');
                document.getElementById('support-btn').classList.remove('hidden');
                document.getElementById('report-issue-btn').classList.remove('hidden');

                // Apply Premium UI
                if (user.isPremium) {
                    document.getElementById('app-container').classList.add('premium-ui');
                } else {
                    document.getElementById('app-container').classList.remove('premium-ui');
                }
                
                App.ui.updateSidebar();
                App.ui.nav.showPage('page-dashboard'); // Default to dashboard
            },
            
            updateSidebar: () => {
                const user = App.state.currentUser;
                if (!user) return;

                document.getElementById('sidebar-profile-pic').src = user.profilePic;
                document.getElementById('sidebar-username').innerHTML = `${user.username} ${user.isPremium ? '<span class="premium-verified-badge" title="Meta Verified">✔</span>' : ''}`;
                
                const roleBadges = {
                    user: `<span class="badge badge-premium">User</span>`,
                    premium: `<span class="badge badge-premium">Premium</span>`,
                    admin: `<span class="badge badge-admin">Admin</span>`,
                    assistant: `<span class="badge badge-assistant">Assistant</span>`,
                    superadmin: `<span class="badge badge-super">Super Admin</span>`
                };
                let badge = user.isPremium && user.role === 'user' ? roleBadges.premium : roleBadges[user.role];
                document.getElementById('sidebar-role-badge').innerHTML = badge;

                // Toggle Admin Nav
                document.querySelectorAll('.admin-nav').forEach(el => {
                    el.classList.toggle('hidden', user.role === 'user');
                });
                document.querySelectorAll('.super-admin-nav').forEach(el => {
                    el.classList.toggle('hidden', user.role !== 'superadmin');
                });
            },

            updateDashboard: () => {
                const user = App.state.currentUser;
                if (!user) return;
                
                document.getElementById('stat-coins').textContent = user.coins;
                document.getElementById('stat-referrals').textContent = user.referrals.length;
                document.getElementById('stat-premium-status').textContent = user.isPremium ? 'Active' : 'Not Active';
                document.getElementById('stat-user-id').textContent = user.id;

                const { message, premiumOnly } = App.state.settings.broadcast;
                const broadcastBar = document.getElementById('broadcast-bar');
                if (message && (!premiumOnly || (premiumOnly && user.isPremium))) {
                    document.getElementById('broadcast-message').textContent = message;
                    broadcastBar.classList.remove('hidden');
                } else {
                    broadcastBar.classList.add('hidden');
                }
                
                const gameOfDay = App.state.settings.gameOfDay;
                if (gameOfDay && gameOfDay.title !== 'No Game Posted') {
                    if (user.isPremium) { // Only show game to premium users
                        document.getElementById('game-of-the-day-content').innerHTML = `<h4>${gameOfDay.title}</h4>${gameOfDay.content}`;
                    } else {
                        document.getElementById('game-of-the-day-content').innerHTML = `<p>Upgrade to Premium to view the Game of the Day.</p>`;
                    }
                }
            },
            
            renderPredictionPage: () => {
                const settings = App.state.settings;
                const overlay = document.getElementById('prediction-disabled-overlay');
                const msg = document.getElementById('maintenance-message-display');

                const isCrashDisabled = !settings.crashEnabled;
                const isMinesDisabled = !settings.minesEnabled;

                document.getElementById('predictor-crash').style.opacity = isCrashDisabled ? 0.5 : 1;
                document.getElementById('get-crash-prediction').disabled = isCrashDisabled;
                
                document.getElementById('predictor-mines').style.opacity = isMinesDisabled ? 0.5 : 1;
                document.getElementById('get-mines-prediction').disabled = isMinesDisabled;

                if (isCrashDisabled || isMinesDisabled) {
                    overlay.classList.remove('hidden');
                    msg.textContent = settings.maintenanceMessage;
                } else {
                    overlay.classList.add('hidden');
                }
            },

            renderPaymentHistory: () => {
                const user = App.state.currentUser;
                const history = App.state.payments.filter(p => p.userId === user.id).reverse();
                const tableBody = document.getElementById('payment-history-table');

                if (history.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="3">No payment history.</td></tr>`;
                    return;
                }

                tableBody.innerHTML = history.map(p => {
                    let statusBadge;
                    switch(p.status) {
                        case 'approved': statusBadge = `<span class="badge badge-success">Approved</span>`; break;
                        case 'rejected': statusBadge = `<span class="badge badge-danger">Rejected</span>`; break;
                        default: statusBadge = `<span class="badge badge-warning">Pending</span>`;
                    }
                    return `<tr>
                        <td>${new Date(p.date).toLocaleDateString()}</td>
                        <td>KES ${p.amount}</td>
                        <td>${statusBadge}</td>
                    </tr>`;
                }).join('');
                
                // Handle upload button cooldown
                const btn = document.getElementById('payment-submit-btn');
                const timerEl = document.getElementById('payment-cooldown-timer');
                if (user.paymentCooldownEnd && new Date() < new Date(user.paymentCooldownEnd)) {
                    const remaining = Math.round((new Date(user.paymentCooldownEnd) - new Date()) / 1000 / 60);
                    timerEl.textContent = `Too many failed attempts. Please try again in ${remaining} minutes.`;
                    timerEl.classList.remove('hidden');
                    btn.disabled = true;
                } else {
                    timerEl.classList.add('hidden');
                    btn.disabled = false;
                }
            },

            renderRewardPage: () => {
                const user = App.state.currentUser;
                const btn = document.getElementById('claim-reward-btn');
                const statusText = document.getElementById('reward-status-text');
                const storeBody = document.getElementById('coin-store-body');
                
                if (user.isPremium) {
                    // Check if claimed
                    if (user.lastRewardClaim) {
                        const lastClaim = new Date(user.lastRewardClaim);
                        const nextClaim = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
                        if (new Date() < nextClaim) {
                            btn.disabled = true;
                            statusText.textContent = `You can claim your next reward in ${Math.round((nextClaim - new Date())/1000/60/60)} hours.`;
                        } else {
                            btn.disabled = false;
                            statusText.textContent = 'Your daily reward is ready to claim!';
                        }
                    } else {
                        btn.disabled = false;
                        statusText.textContent = 'Your daily reward is ready to claim!';
                    }
                    // Render store
                    storeBody.innerHTML = `
                        <div class="list-group">
                            <div class="list-group-item"><span>Premium Odds (1 Day)</span> <button class="btn btn-sm btn-primary" data-item="odds_1">Redeem (500 Coins)</button></div>
                            <div class="list-group-item"><span>Crash Predictor (3 Uses)</span> <button class="btn btn-sm btn-primary" data-item="crash_3">Redeem (750 Coins)</button></div>
                        </div>`;
                } else {
                    btn.disabled = true;
                    statusText.textContent = 'You must be a Premium user to claim daily rewards.';
                    storeBody.innerHTML = '<p>Upgrade to Premium to access the coin store.</p>';
                }
            },

            renderProfilePage: () => {
                const user = App.state.currentUser;
                document.getElementById('profile-pic-preview').src = user.profilePic;
                document.getElementById('profile-username').value = user.username;
                document.getElementById('profile-email').value = user.email;
            },

            renderUserSupportTickets: () => {
                const user = App.state.currentUser;
                const tickets = App.state.tickets.filter(t => t.userId === user.id).reverse();
                const container = document.getElementById('ticket-history-container');

                if (tickets.length === 0) {
                    container.innerHTML = '<p>You have no support tickets.</p>';
                    return;
                }
                
                container.innerHTML = tickets.map(ticket => `
                    <div class="support-ticket">
                        <div class="ticket-header">
                            <h4>${ticket.subject}</h4>
                            <span class="badge ${ticket.status === 'open' ? 'badge-success' : 'badge-inactive'}">${ticket.status}</span>
                        </div>
                        <div class="ticket-body" style="display: none;">
                            ${ticket.messages.map(msg => `
                                <div classclass="ticket-message ${msg.from}">
                                    <small>${msg.from === 'user' ? user.username : 'Admin'} on ${new Date(msg.date).toLocaleString()}</small>
                                    <p>${msg.text}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('');
                
                // Add click listener to headers
                container.querySelectorAll('.ticket-header').forEach(header => {
                    header.onclick = () => {
                        const body = header.nextElementSibling;
                        body.style.display = (body.style.display === 'none') ? 'block' : 'none';
                    };
                });
            },

            // --- Admin Page Renderers ---
            renderAdminUsers: () => {
                const adminUser = App.state.currentUser;
                const users = App.state.users;
                const tableBody = document.getElementById('admin-user-table-body');
                const canReset = (adminUser.role === 'superadmin') || (adminUser.role === 'admin') || (adminUser.role === 'assistant' && App.state.settings.assistantResetEnabled);

                tableBody.innerHTML = users.map(user => {
                    let statusBadge = user.isBanned ? `<span class="badge badge-danger">Banned</span>` : 
                                      user.isPremium ? `<span class="badge badge-premium">Premium</span>` : 
                                      `<span class="badge badge-inactive">User</span>`;
                    return `
                        <tr>
                            <td>${user.email}</td>
                            <td>${user.id}</td>
                            <td>${statusBadge}</td>
                            <td><span class="badge ${user.role === 'superadmin' ? 'badge-super' : user.role === 'admin' ? 'badge-admin' : 'badge-assistant'}">${user.role}</span></td>
                            <td>${user.isFlagged ? '<span class="badge badge-warning">Yes</span>' : 'No'}</td>
                            <td class="action-btns">
                                ${user.isBanned ? 
                                    `<button class="btn btn-sm btn-success" data-id="${user.id}" data-action="unban">Unban</button>` : 
                                    `<button class="btn btn-sm btn-danger" data-id="${user.id}" data-action="ban">Ban</button>`
                                }
                                ${user.isFlagged ? 
                                    `<button class="btn btn-sm btn-secondary" data-id="${user.id}" data-action="unflag">Unflag</button>` : 
                                    `<button class="btn btn-sm btn-warning" data-id="${user.id}" data-action="flag">Flag</button>`
                                }
                                <button class="btn btn-sm btn-secondary" data-id="${user.id}" data-action="resetpass" ${!canReset ? 'disabled title="Permission Denied"' : ''}>Reset Pass</button>
                                <button class="btn btn-sm btn-secondary" data-id="${user.id}" data-action="viewlog">View Log</button>
                            </td>
                        </tr>
                    `;
                }).join('');
            },

            renderAdminPayments: () => {
                const payments = App.state.payments.filter(p => p.status === 'pending');
                const tableBody = document.getElementById('admin-payment-table-body');

                if (payments.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="5">No pending payments.</td></tr>`;
                    return;
                }
                
                tableBody.innerHTML = payments.map(p => `
                    <tr>
                        <td>${new Date(p.date).toLocaleString()}</td>
                        <td>${p.userEmail}</td>
                        <td><button class="btn btn-sm btn-secondary" data-id="${p.id}" data-action="view">View</button></td>
                        <td>
                            <span class="ai-result" data-id="${p.id}">Not Checked</span>
                            <button class="btn btn-sm btn-secondary" data-id="${p.id}" data-action="ai-verify">AI Verify</button>
                        </td>
                        <td class="action-btns">
                            <button class="btn btn-sm btn-success" data-id="${p.id}" data-action="approve">Approve</button>
                            <button class="btn btn-sm btn-danger" data-id="${p.id}" data-action="reject">Reject</button>
                        </td>
                    </tr>
                `).join('');
            },

            renderAdminGameManagement: () => {
                const prices = App.state.settings.gamePrices;
                const tableBody = document.getElementById('admin-game-prices-body');
                tableBody.innerHTML = Object.keys(prices).map(game => `
                    <tr>
                        <td>${game.charAt(0).toUpperCase() + game.slice(1)}</td>
                        <td><input type="number" class="form-group" value="${prices[game]}" data-game="${game}" style="max-width: 100px;"></td>
                        <td>
                            <label class="switch">
                                <input type="checkbox" ${App.state.settings[game + 'Enabled'] ? 'checked' : ''} data-game="${game}">
                                <span class="slider"></span>
                            </label>
                        </td>
                    </tr>
                `).join('');
                
                // Need to add listeners here for changes
                tableBody.querySelectorAll('input[type="number"]').forEach(input => {
                    input.onchange = (e) => {
                        App.state.settings.gamePrices[e.target.dataset.game] = parseInt(e.target.value);
                        App.db.save();
                        App.ui.showToast('Price updated.', 'success');
                    };
                });
                tableBody.querySelectorAll('input[type="checkbox"]').forEach(toggle => {
                    toggle.onchange = (e) => {
                        App.state.settings[e.target.dataset.game + 'Enabled'] = e.target.checked;
                        App.db.save();
                        App.ui.showToast('Game availability updated.', 'success');
                    };
                });
            },

            renderAdminSupport: () => {
                const tickets = App.state.tickets.filter(t => t.status === 'open').reverse();
                const container = document.getElementById('admin-support-inbox-container');

                if (tickets.length === 0) {
                    container.innerHTML = '<p>No open support tickets.</p>';
                    return;
                }
                
                container.innerHTML = tickets.map(ticket => `
                    <div class="support-ticket">
                        <div class="ticket-header">
                            <h4>${ticket.subject} <small>(${ticket.userEmail})</small></h4>
                            <span class="badge badge-success">Open</span>
                        </div>
                        <div class="ticket-body" style="display: none;">
                            ${ticket.messages.map(msg => `
                                <div class="ticket-message ${msg.from}">
                                    <small>${msg.from === 'user' ? ticket.userEmail : 'Admin'} on ${new Date(msg.date).toLocaleString()}</small>
                                    <p>${msg.text}</p>
                                </div>
                            `).join('')}
                            <hr>
                            <div class="form-group">
                                <label for="reply-text-${ticket.id}">Your Reply</label>
                                <textarea id="reply-text-${ticket.id}" rows="3"></textarea>
                            </div>
                            <div class="action-btns">
                                <button class="btn btn-sm btn-primary" data-id="${ticket.id}" data-action="reply">Send Reply</button>
                                <button class="btn btn-sm btn-secondary" data-id="${ticket.id}" data-action="close">Close Ticket</button>
                            </div>
                        </div>
                    </div>
                `).join('');
            },

            renderAdminAssistants: () => {
                const assistants = App.state.users.filter(u => u.role === 'assistant');
                const tableBody = document.getElementById('admin-assistants-table-body');
                
                if (assistants.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="4">No assistants found.</td></tr>`;
                    return;
                }
                
                tableBody.innerHTML = assistants.map(user => `
                    <tr>
                        <td>${user.email}</td>
                        <td>${new Date(user.expiryDate).toLocaleDateString()}</td>
                        <td><button class="btn btn-sm btn-secondary" data-id="${user.id}" data-action="contract">View Contract</button></td>
                        <td class="action-btns">
                            <button class="btn btn-sm btn-danger" data-id="${user.id}" data-action="delete">Delete</button>
                        </td>
                    </tr>
                `).join('');
            },

            renderAdminSettings: () => {
                const settings = App.state.settings;
                document.getElementById('toggle-crash-game').checked = settings.crashEnabled;
                document.getElementById('toggle-mines-game').checked = settings.minesEnabled;
                document.getElementById('toggle-assistant-reset').checked = settings.assistantResetEnabled;
                document.getElementById('toggle-passwordless-login').checked = settings.passwordlessLoginEnabled;
                document.getElementById('maintenance-message-input').value = settings.maintenanceMessage;
            },

            renderAdminLogs: () => {
                const logs = App.state.logs.reverse().slice(0, 200); // Show last 200 logs
                const tableBody = document.getElementById('admin-logs-table-body');
                
                if (logs.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="4">No logs found.</td></tr>`;
                    return;
                }
                
                tableBody.innerHTML = logs.map(log => `
                    <tr>
                        <td>${new Date(log.timestamp).toLocaleString()}</td>
                        <td>${log.user}</td>
                        <td>${log.action}</td>
                        <td>${log.details}</td>
                    </tr>
                `).join('');
            },
            
            // Map page IDs to their render functions
            pageRenderers: {
                'page-dashboard': App.ui.updateDashboard,
                'page-predictions': App.ui.renderPredictionPage,
                'page-payments': App.ui.renderPaymentHistory,
                'page-rewards': App.ui.renderRewardPage,
                'page-profile': App.ui.renderProfilePage,
                'page-support': App.ui.renderUserSupportTickets,
                'page-admin-users': App.ui.renderAdminUsers,
                'page-admin-payments': App.ui.renderAdminPayments,
                'page-admin-games': App.ui.renderAdminGameManagement,
                'page-admin-support': App.ui.renderAdminSupport,
                'page-admin-assistants': App.ui.renderAdminAssistants,
                'page-admin-settings': App.ui.renderAdminSettings,
                'page-admin-logs': App.ui.renderAdminLogs,
            }
        },

        // --- 8. UTILITIES ---
        utils: {
            generateId: (length) => {
                let result = '';
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                for (let i = 0; i < length; i++) {
                    result += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return result;
            },
            // DO NOT use in production. This is a weak, non-secure hash for demo only.
            hashPassword: (str) => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash; // Convert to 32bit integer
                }
                return 'hashed_' + Math.abs(hash);
            },
            fileToBase64: (file) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });
            },
            logActivity: (userEmail, action, details) => {
                App.state.logs.push({
                    timestamp: new Date().toISOString(),
                    user: userEmail,
                    action: action,
                    details: details
                });
                App.db.save(); // Save logs immediately
            },
            autoDeleteInactiveUsers: () => {
                const now = new Date();
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                
                const originalCount = App.state.users.length;
                App.state.users = App.state.users.filter(user => {
                    if (user.role !== 'user') return true; // Keep admins
                    if (user.isPremium) return true; // Keep premium users
                    
                    const lastActive = new Date(user.lastActive);
                    if (lastActive < sevenDaysAgo) {
                        App.utils.logActivity('SYSTEM', 'User Purge', `Auto-deleting inactive user ${user.email}.`);
                        return false; // Delete this user
                    }
                    return true;
                });
                
                if (originalCount > App.state.users.length) {
                    App.db.save();
                }
            }
        }
    };

    // Start the application
    App.init();
});
