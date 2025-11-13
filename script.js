/*
    PredictPro Ultra V8 (Wallet System)
    Main Application Logic
    
    --- REVISION NOTES (V8) ---
    1.  [NEW] WALLET SYSTEM: Replaced screenshot system. Users have a `walletBalance`.
    2.  [NEW] VOUCHER SYSTEM: Admins pre-approve Transaction IDs on page `page-admin-wallet`.
    3.  [NEW] REDEEM SYSTEM: Users redeem vouchers on `page-wallet` by pasting M-Pesa message.
    4.  [NEW] STORE SYSTEM: Created `page-store`. Users buy "Premium" and "Licenses" with their wallet.
    5.  [NEW] PARTIAL PAYMENTS: Store logic tells user the *remaining* amount.
    6.  [NEW] ASSISTANT CONTRACT: Assistants are forced to accept a contract on first login.
    7.  [NEW] REAL ODDS: "Get Odds" button now shows content posted by the admin.
    8.  [NEW] SECURITY: Added failed-redeem attempt tracking and auto-flagging.
    
    *** *** CRITICAL SECURITY WARNING (FOR SIMULATION ONLY) ***
    *** This 3-file system is NOT SECURE. All "databases" (users, vouchers)
    *** are stored in localStorage, which is VISIBLE to any user.
    *** A hacker can easily open the browser console and:
    *** 1. See all "UNUSED" transaction IDs and steal them.
    *** 2. Manually change their own walletBalance: `App.state.currentUser.walletBalance = 999999`
    *** This file is a SIMULATION ONLY and must not be used on a live server.
    ***
*/

const App = {
    // --- 1. STATE & DATABASE (SIMULATED) ---
    state: {
        currentUser: null,
        users: [],
        vouchers: [], // NEW: Database for {id, amount, status, redeemedBy}
        storeProducts: [], // NEW: Database for {id, name, price, description}
        tickets: [],
        settings: {
            crashEnabled: true,
            minesEnabled: true,
            assistantResetEnabled: true,
            passwordlessLoginEnabled: true,
            dailyOddsContent: "<p>Odds have not been posted for today.</p>",
            gameOfDay: {
                title: "No Game Posted",
                content: "<p>Check back later for the game of the day!</p>"
            },
            broadcast: {
                message: "Welcome to PredictPro! Add funds to your wallet to get started.",
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
            const vouchers = localStorage.getItem('predictpro_vouchers');
            const products = localStorage.getItem('predictpro_store');
            const tickets = localStorage.getItem('predictpro_tickets');
            const settings = localStorage.getItem('predictpro_settings');
            const logs = localStorage.getItem('predictpro_logs');
            
            // --- User Database ---
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
                        isPremium: false, // Premium is now a purchased item
                        walletBalance: 1000,
                        inventory: [], // NEW: What the user owns (e.g., 'premium_plan', 'crash_license')
                        referrals: [],
                        refCode: App.utils.generateId(8),
                        joinDate: new Date().toISOString(),
                        lastActive: new Date().toISOString(),
                        profilePic: "https://placehold.co/100x100/121533/b0b8d1?text=SA",
                        username: "Super Admin",
                        failedRedeemAttempts: 0,
                        redeemCooldownEnd: null,
                        isBanned: false,
                        banReason: null,
                        isFlagged: false,
                        lastRewardClaim: null,
                        hasAcceptedContract: true // Super Admin doesn't need to accept
                    }
                ];
            }
            
            // --- Other Databases ---
            App.state.vouchers = vouchers ? JSON.parse(vouchers) : [];
            App.state.tickets = tickets ? JSON.parse(tickets) : [];
            App.state.logs = logs ? JSON.parse(logs) : [];

            if (settings) {
                const savedSettings = JSON.parse(settings);
                App.state.settings = { ...App.state.settings, ...savedSettings };
            }

            if (products) {
                App.state.storeProducts = JSON.parse(products);
            } else {
                // Create default store products
                App.state.storeProducts = [
                    { id: "premium_plan", name: "Premium Plan (Lifetime)", price: 800, description: "Unlocks Daily Rewards, Game of the Day, and the Premium UI." },
                    { id: "crash_license", name: "Crash Predictor (10 Uses)", price: 400, description: "Get 10 uses of the Crash prediction tool." },
                    { id: "mines_license", name: "Mines Predictor (10 Uses)", price: 500, description: "Get 10 uses of the Mines prediction tool." }
                ];
            }

            App.db.save();
        },
        save: () => {
            localStorage.setItem('predictpro_users', JSON.stringify(App.state.users));
            localStorage.setItem('predictpro_vouchers', JSON.stringify(App.state.vouchers));
            localStorage.setItem('predictpro_store', JSON.stringify(App.state.storeProducts));
            localStorage.setItem('predictpro_tickets', JSON.stringify(App.state.tickets));
            localStorage.setItem('predictpro_settings', JSON.stringify(App.state.settings));
            localStorage.setItem('predictpro_logs', JSON.stringify(App.state.logs));
        }
    },

    // --- 2. CORE APP INIT ---
    init: () => {
        App.db.load();
        App.initEventListeners();
        App.autoDeleteInactiveUsers();
        console.log("PredictPro V8 (Wallet Sim) Initialized.");
    },
    
    postInit: () => {
        App.ui.auth.generateCaptcha('login');
        App.ui.auth.generateCaptcha('register');
        console.log("PredictPro V8 Post-Init (Canvas ready).");
    },

    initEventListeners: () => {
        // Auth
        document.querySelector('.auth-toggle').addEventListener('click', App.ui.auth.toggleForm);
        document.getElementById('login-form').addEventListener('submit', App.handlers.auth.login);
        document.getElementById('register-form').addEventListener('submit', App.handlers.auth.register);
        document.getElementById('login-captcha-refresh').addEventListener('click', () => App.ui.auth.generateCaptcha('login'));
        document.getElementById('register-captcha-refresh').addEventListener('click', () => App.ui.auth.generateCaptcha('register'));
        document.getElementById('login-passwordless').addEventListener('change', App.ui.auth.togglePasswordless);
        document.querySelectorAll('.password-toggle').forEach(toggle => {
            toggle.addEventListener('click', App.handlers.auth.togglePasswordVisibility);
        });

        // Contract Modal
        document.getElementById('contract-agree-checkbox').addEventListener('change', App.handlers.auth.toggleContractButton);
        document.getElementById('contract-accept-btn').addEventListener('click', App.handlers.auth.acceptContract);
        
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

        // Wallet
        document.getElementById('payment-verify-form').addEventListener('submit', App.handlers.wallet.redeemVoucher);

        // Store
        document.getElementById('store-item-grid').addEventListener('click', App.handlers.store.handleBuyClick);

        // Predictions
        document.getElementById('get-crash-prediction').addEventListener('click', App.handlers.predictions.getPrediction);
        document.getElementById('get-mines-prediction').addEventListener('click', App.handlers.predictions.getPrediction);
        document.getElementById('get-odds-prediction').addEventListener('click', App.handlers.predictions.getPrediction);
        
        // Rewards
        document.getElementById('claim-reward-btn').addEventListener('click', App.handlers.rewards.claimDailyReward);

        // Profile
        document.getElementById('profile-update-form').addEventListener('submit', App.handlers.profile.updateProfile);
        document.getElementById('profile-pic-upload').addEventListener('change', App.handlers.profile.previewProfilePic);

        // User Support
        document.getElementById('support-ticket-form').addEventListener('submit', App.handlers.support.submitTicket);

        // --- Admin Handlers (Event delegation) ---
        document.getElementById('admin-user-table-body').addEventListener('click', App.handlers.admin.handleUserAction);
        document.getElementById('admin-support-inbox-container').addEventListener('click', App.handlers.admin.handleSupportAction);
        document.getElementById('admin-assistants-table-body').addEventListener('click', App.handlers.admin.handleAssistantAction);
        document.getElementById('admin-products-table-body').addEventListener('click', App.handlers.admin.handleProductAction);

        // Admin Page Forms
        document.getElementById('admin-create-voucher-form').addEventListener('submit', App.handlers.admin.createVoucher);
        document.getElementById('game-of-day-form').addEventListener('submit', App.handlers.admin.postGameOfDay);
        document.getElementById('admin-post-odds-form').addEventListener('submit', App.handlers.admin.postDailyOdds);
        document.getElementById('broadcast-form').addEventListener('submit', App.handlers.admin.sendBroadcast);
        document.getElementById('generate-assistant-btn').addEventListener('click', App.handlers.admin.showAssistantModal);
        document.getElementById('admin-create-product-form').addEventListener('submit', App.handlers.admin.createProduct);

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
                    return App.ui.auth.showError('login', 'Invalid CAPTCHA.');
                }

                let user = App.state.users.find(u => u.email === emailOrId || u.id === emailOrId);

                if (!user) {
                    return App.ui.auth.showError('login', 'User not found.');
                }
                if (user.isBanned) {
                    return App.ui.auth.showError('login', `This account is banned. Reason: ${user.banReason}`);
                }

                const handleLoginSuccess = () => {
                    App.state.currentUser = user;
                    user.lastActive = new Date().toISOString();
                    App.db.save();
                    App.utils.logActivity(user.email, "User Login", `User ${user.email} logged in.`);
                    App.ui.hideLoader();
                    
                    // NEW: Check for assistant contract
                    if (user.role === 'assistant' && !user.hasAcceptedContract) {
                        App.ui.showAssistantContract();
                    } else {
                        App.ui.auth.showApp();
                    }
                };

                if (isPasswordless) {
                    if (!App.state.settings.passwordlessLoginEnabled) {
                        return App.ui.auth.showError('login', 'Passwordless login is currently disabled.');
                    }
                    if (user.id !== emailOrId) {
                        return App.ui.auth.showError('login', 'Passwordless login requires your Website ID.');
                    }
                    handleLoginSuccess();
                } else {
                    if (password.length === 0) {
                         return App.ui.auth.showError('login', 'Password is required.');
                    }
                    if (App.utils.hashPassword(password) === user.password) {
                        handleLoginSuccess();
                    } else {
                        App.ui.auth.showError('login', 'Invalid email or password.');
                    }
                }
            },
            register: (e) => {
                e.preventDefault();
                const email = document.getElementById('register-email').value.trim();
                const password = document.getElementById('register-password').value;
                const refCode = document.getElementById('register-ref-code').value.trim();
                const captcha = document.getElementById('register-captcha-input').value;

                if (captcha !== App.state.captcha.register) {
                    return App.ui.auth.showError('register', 'Invalid CAPTCHA.');
                }
                if (!email.endsWith('@gmail.com')) {
                    return App.ui.auth.showError('register', 'Only @gmail.com addresses are allowed.');
                }
                if (password.length < 6) {
                    return App.ui.auth.showError('register', 'Password must be at least 6 characters.');
                }
                if (App.state.users.find(u => u.email === email)) {
                    return App.ui.auth.showError('register', 'Email already in use.');
                }

                // Create new user
                const newUser = {
                    id: `pp-${Date.now()}`,
                    email: email,
                    password: App.utils.hashPassword(password),
                    role: "user",
                    isPremium: false,
                    walletBalance: 50, // Welcome bonus
                    inventory: [],
                    referrals: [],
                    refCode: App.utils.generateId(8),
                    joinDate: new Date().toISOString(),
                    lastActive: new Date().toISOString(),
                    profilePic: `https://placehold.co/100x100/121533/b0b8d1?text=${email.charAt(0).toUpperCase()}`,
                    username: email.split('@')[0],
                    failedRedeemAttempts: 0,
                    redeemCooldownEnd: null,
                    isBanned: false,
                    banReason: null,
                    isFlagged: false,
                    lastRewardClaim: null,
                    hasAcceptedContract: false // Default
                };

                // Handle referral
                if (refCode) {
                    let referrer = App.state.users.find(u => u.refCode === refCode);
                    if (referrer) {
                        referrer.walletBalance += 100; // Referrer bonus
                        referrer.referrals.push(newUser.id);
                        newUser.walletBalance += 50; // New user bonus
                        App.utils.logActivity(referrer.email, "Referral", `User ${referrer.email} referred ${newUser.email}.`);
                    }
                }

                App.state.users.push(newUser);
                App.db.save();
                App.utils.logActivity(newUser.email, "User Registration", `New user ${newUser.email} registered.`);
                App.ui.showToast('Registration successful! Please log in.', 'success');
                App.ui.auth.switchForm('login-form');
            },
            logout: () => {
                App.utils.logActivity(App.state.currentUser.email, "User Logout", `User ${App.state.currentUser.email} logged out.`);
                App.state.currentUser = null;
                App.ui.auth.showLogin();
            },
            togglePasswordVisibility: (e) => {
                const targetId = e.target.dataset.target;
                const passwordInput = document.getElementById(targetId);
                if (passwordInput) {
                    passwordInput.type = (passwordInput.type === 'password') ? 'text' : 'password';
                    e.target.textContent = (passwordInput.type === 'password') ? '👁️' : '🙈';
                }
            },
            toggleContractButton: (e) => {
                document.getElementById('contract-accept-btn').disabled = !e.target.checked;
            },
            acceptContract: () => {
                App.state.currentUser.hasAcceptedContract = true;
                App.db.save();
                document.getElementById('contract-modal-overlay').classList.add('hidden');
                App.ui.auth.showApp();
                App.utils.logActivity(App.state.currentUser.email, "Contract", "Assistant accepted contract.");
            }
        },
        nav: {
            navigate: (e) => {
                let target = e.target.closest('.nav-link');
                if (!target) return;
                e.preventDefault();
                const pageId = target.dataset.page;
                App.ui.nav.showPage(pageId);
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
        wallet: {
            redeemVoucher: (e) => {
                e.preventDefault();
                const user = App.state.currentUser;
                const message = document.getElementById('mpesa-message-input').value;

                if (user.redeemCooldownEnd && new Date() < new Date(user.redeemCooldownEnd)) {
                    const remaining = Math.round((new Date(user.redeemCooldownEnd) - new Date()) / 1000 / 60);
                    App.ui.showToast(`You must wait ${remaining} more minutes to try again.`, 'danger');
                    return;
                }

                // SIMULATE extracting the ID. This is NOT secure.
                // A real system would use a regex like /[A-Z0-9]{10}/
                const extractedId = message.split(' ')[0]; 
                
                if (!extractedId) {
                    return App.ui.showToast('Could not find a Transaction ID in that message.', 'danger');
                }
                
                // Find the voucher in the "database"
                let voucher = App.state.vouchers.find(v => v.id.toUpperCase() === extractedId.toUpperCase());
                
                if (voucher && voucher.status === 'UNUSED') {
                    // SUCCESS!
                    const amount = voucher.amount;
                    user.walletBalance += amount;
                    user.failedRedeemAttempts = 0; // Reset counter
                    user.redeemCooldownEnd = null;
                    
                    voucher.status = 'USED';
                    voucher.redeemedBy = user.email;
                    voucher.redeemedDate = new Date().toISOString();
                    
                    App.utils.logWallet(user, `Redeemed voucher ${voucher.id}`, amount);
                    App.db.save();
                    
                    App.ui.updateDashboard();
                    App.ui.renderWalletPage();
                    App.ui.showToast(`Success! ${amount} coins added to your wallet.`, 'success');
                    document.getElementById('payment-verify-form').reset();
                    
                } else {
                    // FAILURE!
                    user.failedRedeemAttempts = (user.failedRedeemAttempts || 0) + 1;
                    App.utils.logActivity(user.email, "Redeem Failed", `Failed to redeem ID: ${extractedId}`);
                    
                    let msg = "Transaction ID is invalid or has already been used.";
                    
                    if (user.failedRedeemAttempts >= 10) { // 10-try limit
                        user.redeemCooldownEnd = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour ban
                        user.isFlagged = true;
                        msg = "Too many failed attempts. Your account is flagged and redeeming is locked for 1 hour.";
                        App.utils.logActivity(user.email, "Security", "User auto-flagged for 10 failed redeem attempts.");
                    }
                    
                    App.db.save();
                    App.ui.renderWalletPage();
                    App.ui.showToast(msg, 'danger');
                }
            }
        },
        store: {
            handleBuyClick: (e) => {
                const button = e.target.closest('button');
                if (!button || !button.dataset.id) return;

                const productId = button.dataset.id;
                const product = App.state.storeProducts.find(p => p.id === productId);
                const user = App.state.currentUser;

                if (!product) {
                    return App.ui.showToast("Error: Product not found.", 'danger');
                }
                
                // Check if user already owns it (for non-consumables)
                if (user.inventory.includes(productId)) {
                    return App.ui.showToast("You already own this item.", 'warning');
                }
                
                if (user.walletBalance >= product.price) {
                    // Purchase Success
                    user.walletBalance -= product.price;
                    user.inventory.push(productId);
                    
                    // Special logic for "premium_plan"
                    if (product.id === 'premium_plan') {
                        user.isPremium = true;
                    }
                    
                    App.utils.logWallet(user, `Purchased '${product.name}'`, -product.price);
                    App.db.save();
                    App.ui.updateAll(); // Update everything
                    App.ui.modal.show(
                        "Purchase Successful!",
                        `<p>You have successfully purchased the **${product.name}**.</p><p>Your new balance is ${user.walletBalance} coins.</p>`,
                        `<button class="btn btn-primary" id="modal-ok-btn">OK</button>`
                    );
                    document.getElementById('modal-ok-btn').onclick = App.ui.modal.hide;

                } else {
                    // Purchase Failed (Partial Payment Logic)
                    const remaining = product.price - user.walletBalance;
                    App.ui.modal.show(
                        "Insufficient Funds",
                        `<p>You do not have enough funds to buy the **${product.name}**.</p>
                         <p>Price: <strong>${product.price} coins</strong></p>
                         <p>Your Balance: <strong>${user.walletBalance} coins</strong></p>
                         <hr>
                         <p>You need **${remaining} more coins**. Please add funds to your wallet and try again.</p>`,
                         `<button class="btn btn-primary" id="modal-add-funds-btn">Add Funds</button>`
                    );
                    document.getElementById('modal-add-funds-btn').onclick = () => {
                        App.ui.modal.hide();
                        App.ui.nav.showPage('page-wallet');
                    };
                }
            }
        },
        predictions: {
            getPrediction: (e) => {
                const game = e.target.dataset.game;
                const user = App.state.currentUser;

                let licenseId = '';
                if (game === 'crash') licenseId = 'crash_license';
                if (game === 'mines') licenseId = 'mines_license';
                
                // For "Odds", we check for Premium status, not a license
                if (game === 'odds') {
                    if (!user.isPremium) {
                        return App.ui.showToast("You must be a Premium user to view Daily Odds.", 'danger');
                    }
                    // Show the real odds
                    App.ui.showLoader("Loading Daily Odds...");
                    setTimeout(() => {
                        const oddsContent = App.state.settings.dailyOddsContent;
                        const resultEl = document.getElementById('odds-prediction-result');
                        resultEl.innerHTML = oddsContent;
                        resultEl.style.display = 'block';
                        App.ui.hideLoader();
                    }, 500);
                    return;
                }

                // For Crash/Mines, check for a license
                if (!user.inventory.includes(licenseId)) {
                    App.ui.modal.show(
                        "License Required",
                        `<p>You do not have a license for the **${game} predictor**.</p><p>Please purchase one from the Store.</p>`,
                        `<button class="btn btn-primary" id="modal-go-store">Go to Store</button>`
                    );
                    document.getElementById('modal-go-store').onclick = () => {
                        App.ui.modal.hide();
                        App.ui.nav.showPage('page-store');
                    };
                    return;
                }
                
                // --- FAKE PREDICTION (as requested) ---
                App.ui.showLoader(`Analyzing ${game}...`);
                App.utils.logActivity(user.email, "Prediction", `User requested ${game} prediction.`);

                setTimeout(() => {
                    let resultHtml = '';
                    if (game === 'crash') {
                        const value = (Math.random() * (5 - 1.1) + 1.1).toFixed(2);
                        resultHtml = `<h4>Crash at ${value}x</h4><p>Confidence: Low</p>`;
                    } else if (game === 'mines') {
                        resultHtml = `<h4>Safe Spots:</h4><p>[0,1], [1,2], [2,0]</p>`;
                    }
                    
                    document.getElementById(`${game}-prediction-result`).innerHTML = resultHtml;
                    document.getElementById(`${game}-prediction-result`).style.display = 'block';
                    App.ui.hideLoader();
                }, 2000);
            }
        },
        rewards: {
            claimDailyReward: () => {
                const user = App.state.currentUser;

                if (!user.isPremium) {
                    return App.ui.showToast('Only Premium users can claim daily rewards.', 'danger');
                }
                
                if (user.lastRewardClaim) {
                    const lastClaim = new Date(user.lastRewardClaim);
                    const nextClaim = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
                    if (new Date() < nextClaim) {
                        return App.ui.showToast('You have already claimed your reward for today.', 'warning');
                    }
                }

                user.walletBalance += 100;
                user.lastRewardClaim = new Date().toISOString();
                App.utils.logWallet(user, "Claimed daily reward", 100);
                App.db.save();
                App.ui.updateDashboard();
                App.ui.renderRewardPage();
                App.ui.showToast('100 coins claimed!', 'success');
            }
        },
        profile: {
            updateProfile: async (e) => {
                e.preventDefault();
                App.ui.showLoader('Updating profile...');
                const user = App.state.currentUser;
                user.username = document.getElementById('profile-username').value.trim() || user.username;
                
                const file = document.getElementById('profile-pic-upload').files[0];
                if (file) {
                    user.profilePic = await App.utils.fileToBase64(file);
                }

                App.db.save();
                App.ui.updateSidebar();
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
                if (!subject || !message) return;

                const newTicket = {
                    id: `tkt-${Date.now()}`,
                    userId: App.state.currentUser.id,
                    userEmail: App.state.currentUser.email,
                    subject: subject,
                    status: 'open',
                    messages: [{ from: 'user', text: message, date: new Date().toISOString() }]
                };
                App.state.tickets.push(newTicket);
                App.db.save();
                App.utils.logActivity(App.state.currentUser.email, "Support Ticket", `Opened ticket: ${subject}`);
                App.ui.showToast('Support ticket submitted.', 'success');
                App.ui.renderUserSupportTickets();
                e.target.reset();
            },
            showSupportModal: () => {
                App.ui.modal.show(
                    "Contact Support",
                    `<form id="modal-support-form"><div class="form-group"><label for="modal-support-message">Your Message</label><textarea id="modal-support-message" rows="5" required placeholder="Describe your issue..."></textarea></div></form>`,
                    `<button class="btn btn-primary" id="modal-support-submit">Send Message</button>`
                );

                document.getElementById('modal-support-submit').onclick = () => {
                    const message = document.getElementById('modal-support-message').value;
                    if (!message) return;
                    
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
                    App.utils.logActivity(App.state.currentUser.email, "Support Ticket", `Opened ticket from chat.`);
                    App.ui.modal.hide();
                    App.ui.showToast('Support message sent.', 'success');
                    App.ui.renderUserSupportTickets();
                };
            },
            reportIssue: () => {
                App.ui.showToast('Simulating screenshot...', 'warning');
                App.ui.showLoader('Reporting issue...');
                
                setTimeout(() => {
                    const fakeTicket = {
                        id: `tkt-issue-${Date.now()}`,
                        userId: App.state.currentUser.id,
                        userEmail: App.state.currentUser.email,
                        subject: "User Issue Report (with Screenshot)",
                        status: 'open',
                        messages: [{ from: 'user', text: `Reported issue from page: ${App.state.currentPage}.`, date: new Date().toISOString() }]
                    };
                    App.state.tickets.push(fakeTicket);
                    App.db.save();
                    App.utils.logActivity(App.state.currentUser.email, "Issue Report", `User reported issue.`);
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
                        user.isBanned = false; user.banReason = null;
                        App.utils.logActivity(adminUser.email, "User Unban", `Admin unbanned ${user.email}.`);
                        break;
                    case 'flag': 
                        user.isFlagged = true;
                        App.utils.logActivity(adminUser.email, "User Flag", `Admin flagged ${user.email}.`);
                        break;
                    case 'unflag': 
                        user.isFlagged = false;
                        App.utils.logActivity(adminUser.email, "User Unflag", `Admin unflagged ${user.email}.`);
                        break;
                    case 'resetpass': App.handlers.admin.showResetPassModal(user); break;
                    case 'viewlog': App.handlers.admin.showUserLogModal(user); break;
                }
                App.db.save();
                App.ui.renderAdminUsers();
            },
            showBanModal: (user) => {
                App.ui.modal.show(
                    `Ban User: ${user.email}`,
                    `<form id="ban-user-form"><div class="form-group"><label for="ban-reason">Reason for Ban</label><textarea id="ban-reason" rows="4" required></textarea></div></form>`,
                    `<button class="btn btn-danger" id="modal-confirm-ban">Confirm Ban</button>`
                );
                document.getElementById('modal-confirm-ban').onclick = () => {
                    const reason = document.getElementById('ban-reason').value;
                    if (!reason) return App.ui.showToast('You must provide a reason.', 'warning');
                    
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
                    return App.ui.showToast('You do not have permission to reset passwords.', 'danger');
                }

                App.ui.modal.show(
                    `Reset Password for ${user.email}`,
                    `<form id="reset-pass-form"><div class="form-group"><label for="new-temp-pass">New Password</label><input type="text" id="new-temp-pass" required></div></form>`,
                    `<button class="btn btn-warning" id="modal-confirm-reset">Set New Password</button>`
                );
                document.getElementById('modal-confirm-reset').onclick = () => {
                    const newPass = document.getElementById('new-temp-pass').value;
                    if (newPass.length < 6) return App.ui.showToast('Password must be at least 6 characters.', 'warning');
                    
                    user.password = App.utils.hashPassword(newPass);
                    App.db.save();
                    App.ui.modal.hide();
                    App.ui.showToast(`Password for ${user.email} has been reset.`, 'success');
                    App.utils.logActivity(adminUser.email, "Password Reset", `Admin reset password for ${user.email}.`);
                };
            },
            showUserLogModal: (user) => {
                const userLogs = App.state.logs.filter(log => log.user === user.email).reverse();
                let logHtml = `<div class="data-table-container" style="max-height: 400px; overflow-y: auto;"><table class="data-table"><thead><tr><th>Time</th><th>Action</th><th>Details</th></tr></thead><tbody>`;
                logHtml += (userLogs.length === 0) ? `<tr><td colspan="3">No logs found.</td></tr>` : 
                    userLogs.map(log => `<tr><td>${new Date(log.timestamp).toLocaleString()}</td><td>${log.action}</td><td>${log.details}</td></tr>`).join('');
                logHtml += `</tbody></table></div>`;
                App.ui.modal.show(`Activity Log: ${user.email}`, logHtml, '');
            },
            createVoucher: (e) => {
                e.preventDefault();
                const txnId = document.getElementById('voucher-txn-id').value.trim().toUpperCase();
                const amount = parseInt(document.getElementById('voucher-amount').value);
                
                if (!txnId || !amount || amount <= 0) {
                    return App.ui.showToast("Invalid ID or amount.", 'danger');
                }
                
                // Check if ID already exists
                if (App.state.vouchers.find(v => v.id === txnId)) {
                    return App.ui.showToast("This Transaction ID has already been approved.", 'danger');
                }

                const newVoucher = {
                    id: txnId,
                    amount: amount,
                    status: 'UNUSED',
                    createdDate: new Date().toISOString(),
                    adminCreator: App.state.currentUser.email,
                    redeemedBy: null,
                    redeemedDate: null
                };

                App.state.vouchers.push(newVoucher);
                App.db.save();
                App.ui.renderAdminWallet();
                e.target.reset();
                App.ui.showToast(`Voucher ${txnId} for ${amount} coins created!`, 'success');
                App.utils.logActivity(App.state.currentUser.email, "Voucher Create", `Created voucher ${txnId} for ${amount}.`);
            },
            postGameOfDay: (e) => {
                e.preventDefault();
                App.state.settings.gameOfDay = {
                    title: document.getElementById('game-of-day-title').value,
                    content: document.getElementById('game-of-day-content').value
                };
                App.db.save();
                App.ui.showToast('Game of the Day has been posted!', 'success');
                App.utils.logActivity(App.state.currentUser.email, "Game of Day", `Admin posted game.`);
                App.ui.renderDashboard();
            },
            postDailyOdds: (e) => {
                e.preventDefault();
                App.state.settings.dailyOddsContent = document.getElementById('odds-content').value;
                App.db.save();
                App.ui.showToast('Daily Odds have been posted!', 'success');
                App.utils.logActivity(App.state.currentUser.email, "Odds Posted", `Admin posted new daily odds.`);
            },
            sendBroadcast: (e) => {
                e.preventDefault();
                App.state.settings.broadcast = {
                    message: document.getElementById('broadcast-message-input').value,
                    premiumOnly: document.getElementById('broadcast-premium-only').checked
                };
                App.db.save();
                App.ui.showToast('Broadcast sent!', 'success');
                App.utils.logActivity(App.state.currentUser.email, "Broadcast", `Admin sent broadcast.`);
                App.ui.renderDashboard();
            },
            handleSupportAction: (e) => {
                if (e.target.closest('.ticket-header')) {
                    e.target.closest('.support-ticket').querySelector('.ticket-body').style.display = 'block';
                }
                const button = e.target.closest('button');
                if (button) {
                    const ticketId = button.dataset.id;
                    const action = button.dataset.action;
                    const ticket = App.state.tickets.find(t => t.id === ticketId);
                    if (!ticket) return;

                    if (action === 'reply') {
                        const replyText = document.getElementById(`reply-text-${ticket.id}`).value;
                        if (!replyText) return;
                        ticket.messages.push({ from: 'admin', text: replyText, date: new Date().toISOString() });
                        App.utils.logActivity(App.state.currentUser.email, "Support Reply", `Replied to ticket ${ticket.id}.`);
                    }
                    if (action === 'close') {
                        ticket.status = 'closed';
                        App.utils.logActivity(App.state.currentUser.email, "Support Close", `Closed ticket ${ticket.id}.`);
                    }
                    App.db.save();
                    App.ui.renderAdminSupport();
                }
            },
            showAssistantModal: () => {
                App.ui.modal.show(
                    "Generate Assistant",
                    `<form id="gen-assistant-form">
                        <div class="form-group"><label for="assistant-email">Assistant Email</label><input type="email" id="assistant-email" required></div>
                        <div class="form-group"><label for="assistant-pass">Temporary Password</label><input type="text" id="assistant-pass" required></div>
                    </form>`,
                    `<button class="btn btn-primary" id="modal-confirm-gen-assistant">Generate</button>`
                );

                document.getElementById('modal-confirm-gen-assistant').onclick = () => {
                    const email = document.getElementById('assistant-email').value;
                    const password = document.getElementById('assistant-pass').value;

                    if (!email || password.length < 6) {
                        return App.ui.showToast('Please fill all fields. Password min 6 chars.', 'warning');
                    }
                    if (App.state.users.find(u => u.email === email)) {
                        return App.ui.showToast('User with this email already exists.', 'danger');
                    }

                    const newAssistant = {
                        id: `pp-${Date.now()}`,
                        email: email,
                        password: App.utils.hashPassword(password),
                        role: "assistant",
                        isPremium: false,
                        walletBalance: 0,
                        inventory: [],
                        referrals: [],
                        refCode: App.utils.generateId(8),
                        joinDate: new Date().toISOString(),
                        lastActive: new Date().toISOString(),
                        profilePic: `https://placehold.co/100x100/121533/b0b8d1?text=A`,
                        username: email.split('@')[0],
                        isBanned: false, banReason: null, isFlagged: false,
                        hasAcceptedContract: false // NEW: Force contract
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
                    App.ui.modal.show(`Contract: ${user.email}`, `<p>Status: ${user.hasAcceptedContract ? 'Accepted' : 'Pending'}</p><p>This shows the contract details...</p>`);
                }
                if (action === 'delete') {
                    if (confirm(`Are you sure you want to delete assistant ${user.email}?`)) {
                        App.state.users = App.state.users.filter(u => u.id !== userId);
                        App.db.save();
                        App.ui.renderAdminAssistants();
                        App.utils.logActivity(App.state.currentUser.email, "Assistant Deleted", `Deleted assistant ${user.email}.`);
                    }
                }
            },
            createProduct: (e) => {
                e.preventDefault();
                const id = document.getElementById('product-id').value.trim();
                const name = document.getElementById('product-name').value.trim();
                const price = parseInt(document.getElementById('product-price').value);
                const description = document.getElementById('product-description').value.trim();

                if (!id || !name || !price) {
                    return App.ui.showToast("ID, Name, and Price are required.", 'danger');
                }
                
                // Check if product exists to update it
                let existingProduct = App.state.storeProducts.find(p => p.id === id);
                if (existingProduct) {
                    existingProduct.name = name;
                    existingProduct.price = price;
                    existingProduct.description = description;
                    App.ui.showToast("Product updated!", 'success');
                } else {
                    App.state.storeProducts.push({ id, name, price, description });
                    App.ui.showToast("Product created!", 'success');
                }
                
                App.db.save();
                App.ui.renderAdminStore();
                e.target.reset();
            },
            handleProductAction: (e) => {
                const button = e.target.closest('button');
                if (!button) return;
                const id = button.dataset.id;
                
                if (button.dataset.action === 'delete') {
                    if (confirm(`Are you sure you want to delete product ${id}?`)) {
                        App.state.storeProducts = App.state.storeProducts.filter(p => p.id !== id);
                        App.db.save();
                        App.ui.renderAdminStore();
                        App.ui.showToast("Product deleted.", 'success');
                    }
                }
            }
        },
        // --- 5. SUPER ADMIN HANDLERS ---
        superadmin: {
            saveSettings: (e) => {
                e.preventDefault();
                App.ui.showLoader('Saving settings...');
                App.state.settings.crashEnabled = document.getElementById('toggle-crash-game').checked;
                App.state.settings.minesEnabled = document.getElementById('toggle-mines-game').checked;
                App.state.settings.assistantResetEnabled = document.getElementById('toggle-assistant-reset').checked;
                App.state.settings.passwordlessLoginEnabled = document.getElementById('toggle-passwordless-login').checked;

                App.db.save();
                App.ui.hideLoader();
                App.ui.showToast('System settings saved.', 'success');
                App.utils.logActivity(App.state.currentUser.email, "Settings Update", `Updated system settings.`);
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
                document.querySelectorAll('.auth-toggle-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelector(`.auth-toggle-btn[data-form="${formId}"]`).classList.add('active');
                App.ui.auth.showError('login', '');
                App.ui.auth.showError('register', '');
            },
            togglePasswordless: (e) => {
                document.getElementById('login-password').disabled = e.target.checked;
            },
            generateCaptcha: (type) => {
                try {
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
                } catch (e) { console.error("CAPTCHA draw error:", e); }
            },
            showError: (form, message) => {
                const el = document.getElementById(`${form}-error`);
                if(el) el.textContent = message;
                if(message) App.ui.hideLoader();
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
                ['whatsapp-btn', 'support-btn', 'report-issue-btn'].forEach(id => {
                    document.getElementById(id).classList.add('hidden');
                });
            }
        },
        showAssistantContract: () => {
            document.getElementById('contract-modal-overlay').classList.remove('hidden');
        },
        nav: {
            toggleSidebar: (forceOpen) => {
                const sidebar = document.getElementById('sidebar');
                sidebar.classList.toggle('open', forceOpen);
            },
            showPage: (pageId) => {
                document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
                const page = document.getElementById(pageId);
                if (!page) {
                    console.error(`Page not found: ${pageId}`);
                    pageId = 'page-dashboard'; // Default to dashboard
                    document.getElementById(pageId).classList.remove('hidden');
                }
                page.classList.remove('hidden');
                
                document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
                const activeLink = document.querySelector(`.nav-link[data-page="${pageId}"]`);
                if (activeLink) {
                    activeLink.classList.add('active');
                    document.getElementById('page-title').textContent = activeLink.textContent.trim().replace(/[^\w\s]/gi, '').trim();
                }
                App.state.currentPage = pageId;

                const renderFunc = App.ui.pageRenderers[pageId];
                if (renderFunc) renderFunc();
            }
        },
        modal: {
            show: (title, body, footer = '') => {
                document.getElementById('modal-title').innerHTML = title;
                document.getElementById('modal-body').innerHTML = body;
                document.getElementById('modal-footer').innerHTML = footer;
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
        updateAll: () => {
            App.ui.updateSidebar();
            App.ui.updateDashboard();
            // Re-render current page
            const renderFunc = App.ui.pageRenderers[App.state.currentPage];
            if (renderFunc) renderFunc();
        },
        renderAll: () => {
            const user = App.state.currentUser;
            if (!user) return;

            ['whatsapp-btn', 'support-btn', 'report-issue-btn'].forEach(id => {
                document.getElementById(id).classList.remove('hidden');
            });

            document.getElementById('app-container').classList.toggle('premium-ui', user.isPremium);
            
            App.ui.updateSidebar();
            App.ui.nav.showPage('page-dashboard');
        },
        
        updateSidebar: () => {
            const user = App.state.currentUser;
            if (!user) return;

            document.getElementById('sidebar-profile-pic').src = user.profilePic;
            document.getElementById('sidebar-username').innerHTML = `${user.username} ${user.isPremium ? '<span class="premium-verified-badge" title="Meta Verified">✔</span>' : ''}`;
            
            const roleBadges = {
                user: `<span class="badge ${user.isPremium ? 'badge-premium' : 'badge-inactive'}">${user.isPremium ? 'Premium' : 'User'}</span>`,
                admin: `<span class="badge badge-admin">Admin</span>`,
                assistant: `<span class="badge badge-assistant">Assistant</span>`,
                superadmin: `<span class="badge badge-super">Super Admin</span>`
            };
            document.getElementById('sidebar-role-badge').innerHTML = roleBadges[user.role] || roleBadges.user;

            document.querySelectorAll('.admin-nav').forEach(el => el.classList.toggle('hidden', user.role === 'user'));
            document.querySelectorAll('.super-admin-nav').forEach(el => el.classList.toggle('hidden', user.role !== 'superadmin'));
        },
        updateDashboard: () => {
            const user = App.state.currentUser;
            if (!user) return;
            
            document.getElementById('stat-coins').textContent = user.walletBalance;
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
            const gameContentEl = document.getElementById('game-of-the-day-content');
            if (gameOfDay && gameOfDay.title !== 'No Game Posted') {
                if (user.isPremium) {
                    gameContentEl.innerHTML = `<h4>${gameOfDay.title}</h4>${gameOfDay.content}`;
                } else {
                    gameContentEl.innerHTML = `<p>Purchase a Premium Plan to view the Game of the Day.</p>`;
                }
            }
        },
        renderWalletPage: () => {
            const user = App.state.currentUser;
            const history = App.state.logs.filter(log => log.user === user.email && log.action === 'Wallet').reverse();
            const tableBody = document.getElementById('wallet-history-table');

            tableBody.innerHTML = (history.length === 0) ? `<tr><td colspan="3">No wallet history.</td></tr>` : 
                history.map(log => `
                    <tr>
                        <td>${new Date(log.timestamp).toLocaleDateString()}</td>
                        <td>${log.details}</td>
                        <td style="color: ${log.amount > 0 ? 'var(--success)' : 'var(--danger)'}">${log.amount > 0 ? '+' : ''}${log.amount}</td>
                    </tr>
                `).join('');
            
            const btn = document.getElementById('payment-verify-btn');
            const timerEl = document.getElementById('payment-cooldown-timer');
            if (user.redeemCooldownEnd && new Date() < new Date(user.redeemCooldownEnd)) {
                const remaining = Math.round((new Date(user.redeemCooldownEnd) - new Date()) / 1000 / 60);
                timerEl.textContent = `Too many failed attempts. Please try again in ${remaining} minutes.`;
                timerEl.classList.remove('hidden');
                btn.disabled = true;
            } else {
                timerEl.classList.add('hidden');
                btn.disabled = false;
            }
        },
        renderStorePage: () => {
            const products = App.state.storeProducts;
            const user = App.state.currentUser;
            const grid = document.getElementById('store-item-grid');
            
            if (products.length === 0) {
                grid.innerHTML = '<div class="page-placeholder"><p>The store is currently empty.</p></div>';
                return;
            }

            grid.innerHTML = products.map(p => {
                const alreadyOwned = user.inventory.includes(p.id);
                return `
                <div class="predictor-card">
                    <span class="predictor-icon">🛒</span>
                    <h3>${p.name}</h3>
                    <p>${p.description}</p>
                    <div class="predictor-price">${p.price} <small>coins</small></div>
                    <button class="btn ${alreadyOwned ? 'btn-secondary' : 'btn-primary'} btn-full" 
                            data-id="${p.id}" ${alreadyOwned ? 'disabled' : ''}>
                        ${alreadyOwned ? 'Already Owned' : 'Buy Now'}
                    </button>
                </div>
                `;
            }).join('');
        },
        renderPredictionPage: () => {
            const settings = App.state.settings;
            document.getElementById('predictor-crash').style.opacity = settings.crashEnabled ? 1 : 0.5;
            document.getElementById('get-crash-prediction').disabled = !settings.crashEnabled;
            document.getElementById('predictor-mines').style.opacity = settings.minesEnabled ? 1 : 0.5;
            document.getElementById('get-mines-prediction').disabled = !settings.minesEnabled;
        },
        renderRewardPage: () => {
            const user = App.state.currentUser;
            const btn = document.getElementById('claim-reward-btn');
            const statusText = document.getElementById('reward-status-text');
            
            if (user.isPremium) {
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
            } else {
                btn.disabled = true;
                statusText.textContent = 'You must purchase the Premium Plan to claim daily rewards.';
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

            container.innerHTML = (tickets.length === 0) ? '<p>You have no support tickets.</p>' : 
                tickets.map(ticket => `
                    <div class="support-ticket">
                        <div class="ticket-header">
                            <h4>${ticket.subject}</h4>
                            <span class="badge ${ticket.status === 'open' ? 'badge-success' : 'badge-inactive'}">${ticket.status}</span>
                        </div>
                        <div class="ticket-body" style="display: none;">
                            ${ticket.messages.map(msg => `<div class="ticket-message ${msg.from}"><small>${msg.from === 'user' ? user.username : 'Admin'} on ${new Date(msg.date).toLocaleString()}</small><p>${msg.text}</p></div>`).join('')}
                        </div>
                    </div>
                `).join('');
            
            container.querySelectorAll('.ticket-header').forEach(header => {
                header.onclick = () => header.nextElementSibling.style.display = 'block';
            });
        },

        // --- Admin Page Renderers ---
        renderAdminUsers: () => {
            const adminUser = App.state.currentUser;
            const users = App.state.users;
            const tableBody = document.getElementById('admin-user-table-body');
            const canReset = adminUser.role === 'superadmin' || adminUser.role === 'admin' || (adminUser.role === 'assistant' && App.state.settings.assistantResetEnabled);

            tableBody.innerHTML = users.map(user => {
                let statusBadge = user.isBanned ? `<span class="badge badge-danger">Banned</span>` : 
                                  user.isPremium ? `<span class="badge badge-premium">Premium</span>` : 
                                  `<span class="badge badge-inactive">User</span>`;
                return `
                    <tr>
                        <td>${user.email}<br><small>${user.role}</small></td>
                        <td>${user.walletBalance} coins</td>
                        <td>${statusBadge}</td>
                        <td>${user.isFlagged ? '<span class="badge badge-warning">Yes</span>' : 'No'}</td>
                        <td class="action-btns">
                            ${user.isBanned ? `<button class="btn btn-sm btn-success" data-id="${user.id}" data-action="unban">Unban</button>` : `<button class="btn btn-sm btn-danger" data-id="${user.id}" data-action="ban">Ban</button>`}
                            ${user.isFlagged ? `<button class="btn btn-sm btn-secondary" data-id="${user.id}" data-action="unflag">Unflag</button>` : `<button class="btn btn-sm btn-warning" data-id="${user.id}" data-action="flag">Flag</button>`}
                            <button class="btn btn-sm btn-secondary" data-id="${user.id}" data-action="resetpass" ${!canReset ? 'disabled title="Permission Denied"' : ''}>Reset Pass</button>
                            <button class="btn btn-sm btn-secondary" data-id="${user.id}" data-action="viewlog">View Log</button>
                        </td>
                    </tr>
                `;
            }).join('');
        },
        renderAdminWallet: () => {
            const vouchers = App.state.vouchers.reverse();
            const tableBody = document.getElementById('admin-voucher-table-body');
            tableBody.innerHTML = (vouchers.length === 0) ? `<tr><td colspan="5">No vouchers created yet.</td></tr>` :
                vouchers.map(v => `
                    <tr>
                        <td>${new Date(v.createdDate).toLocaleDateString()}</td>
                        <td>${v.id}</td>
                        <td>${v.amount} coins</td>
                        <td>${v.status === 'UNUSED' ? `<span class="badge badge-success">UNUSED</span>` : `<span class="badge badge-inactive">USED</span>`}</td>
                        <td>${v.redeemedBy || 'N/A'}</td>
                    </tr>
                `).join('');
        },
        renderAdminGameManagement: () => {
            document.getElementById('game-of-day-title').value = App.state.settings.gameOfDay.title;
            document.getElementById('game-of-day-content').value = App.state.settings.gameOfDay.content;
            document.getElementById('odds-content').value = App.state.settings.dailyOddsContent;
        },
        renderAdminSupport: () => {
            const tickets = App.state.tickets.filter(t => t.status === 'open').reverse();
            const container = document.getElementById('admin-support-inbox-container');
            container.innerHTML = (tickets.length === 0) ? '<p>No open support tickets.</p>' :
                tickets.map(ticket => `
                    <div class="support-ticket">
                        <div class="ticket-header"><h4>${ticket.subject} <small>(${ticket.userEmail})</small></h4><span class="badge badge-success">Open</span></div>
                        <div class="ticket-body" style="display: none;">
                            ${ticket.messages.map(msg => `<div class="ticket-message ${msg.from}"><small>${msg.from} on ${new Date(msg.date).toLocaleString()}</small><p>${msg.text}</p></div>`).join('')}
                            <hr>
                            <div class="form-group"><label>Your Reply</label><textarea id="reply-text-${ticket.id}" rows="3"></textarea></div>
                            <div class="action-btns"><button class="btn btn-sm btn-primary" data-id="${ticket.id}" data-action="reply">Send Reply</button><button class="btn btn-sm btn-secondary" data-id="${ticket.id}" data-action="close">Close Ticket</button></div>
                        </div>
                    </div>
                `).join('');
        },
        renderAdminAssistants: () => {
            const assistants = App.state.users.filter(u => u.role === 'assistant');
            const tableBody = document.getElementById('admin-assistants-table-body');
            tableBody.innerHTML = (assistants.length === 0) ? `<tr><td colspan="4">No assistants found.</td></tr>` :
                assistants.map(user => `
                    <tr>
                        <td>${user.email}</td>
                        <td>${user.hasAcceptedContract ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-warning">Pending</span>'}</td>
                        <td><button class="btn btn-sm btn-secondary" data-id="${user.id}" data-action="contract">View</button></td>
                        <td class="action-btns"><button class="btn btn-sm btn-danger" data-id="${user.id}" data-action="delete">Delete</button></td>
                    </tr>
                `).join('');
        },
        renderAdminStore: () => {
            const products = App.state.storeProducts;
            const tableBody = document.getElementById('admin-products-table-body');
            tableBody.innerHTML = products.map(p => `
                <tr>
                    <td>${p.id}</td>
                    <td>${p.name}</td>
                    <td>${p.price} coins</td>
                    <td class="action-btns"><button class="btn btn-sm btn-danger" data-id="${p.id}" data-action="delete">Delete</button></td>
                </tr>
            `).join('');
        },
        renderAdminSettings: () => {
            const settings = App.state.settings;
            document.getElementById('toggle-crash-game').checked = settings.crashEnabled;
            document.getElementById('toggle-mines-game').checked = settings.minesEnabled;
            document.getElementById('toggle-assistant-reset').checked = settings.assistantResetEnabled;
            document.getElementById('toggle-passwordless-login').checked = settings.passwordlessLoginEnabled;
        },
        renderAdminLogs: () => {
            const logs = App.state.logs.reverse().slice(0, 200);
            const tableBody = document.getElementById('admin-logs-table-body');
            tableBody.innerHTML = (logs.length === 0) ? `<tr><td colspan="4">No logs found.</td></tr>` :
                logs.map(log => `<tr><td>${new Date(log.timestamp).toLocaleString()}</td><td>${log.user}</td><td>${log.action}</td><td>${log.details}</td></tr>`).join('');
        },
        
        pageRenderers: {
            'page-dashboard': App.ui.updateDashboard,
            'page-wallet': App.ui.renderWalletPage,
            'page-store': App.ui.renderStorePage,
            'page-predictions': App.ui.renderPredictionPage,
            'page-rewards': App.ui.renderRewardPage,
            'page-profile': App.ui.renderProfilePage,
            'page-support': App.ui.renderUserSupportTickets,
            'page-admin-users': App.ui.renderAdminUsers,
            'page-admin-wallet': App.ui.renderAdminWallet,
            'page-admin-games': App.ui.renderAdminGameManagement,
            'page-admin-support': App.ui.renderAdminSupport,
            'page-admin-assistants': App.ui.renderAdminAssistants,
            'page-admin-store': App.ui.renderAdminStore,
            'page-admin-settings': App.ui.renderAdminSettings,
            'page-admin-logs': App.ui.renderAdminLogs,
        }
    },

    // --- 8. UTILITIES ---
    utils: {
        generateId: (length) => {
            let result = '';
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
            return result;
        },
        hashPassword: (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
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
            App.state.logs.push({ timestamp: new Date().toISOString(), user: userEmail, action, details });
            App.db.save();
        },
        logWallet: (user, details, amount) => {
            App.state.logs.push({
                timestamp: new Date().toISOString(),
                user: user.email,
                action: 'Wallet',
                details: details,
                amount: amount // NEW: For tracking wallet history
            });
        },
        autoDeleteInactiveUsers: () => {
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            
            App.state.users = App.state.users.filter(user => {
                if (user.role !== 'user' || user.isPremium) return true;
                if (new Date(user.lastActive) < sevenDaysAgo) {
                    App.utils.logActivity('SYSTEM', 'User Purge', `Auto-deleting inactive user ${user.email}.`);
                    return false;
                }
                return true;
            });
            App.db.save();
        }
    }
};

// --- START THE APP ---
document.addEventListener('DOMContentLoaded', App.init);
window.addEventListener('load', App.postInit);
