/*
    PredictPro V8 - Frontend Client (COMPLETE)
    This file runs in the user's browser. It is "dumb."
    It does not store any data (except the login token).
    It just sends requests to the secure backend server and displays the results.
*/

document.addEventListener('DOMContentLoaded', () => {
    const App = {
        // --- 1. STATE & API ---
        state: {
            token: null,
            currentUser: null, // Holds user data from server
            currentPage: 'page-dashboard',
            appSettings: null, // Holds settings from server
        },
        
        // This is the URL of your backend.
        // For testing, this is correct. For production, change to your domain.
        API_URL: 'http://localhost:3000/api', 

        // --- 2. CORE APP INIT ---
        init: () => {
            App.state.token = localStorage.getItem('predictpro_token');
            if (App.state.token) {
                App.ui.auth.showApp();
            } else {
                App.ui.auth.showLogin();
            }
            App.initEventListeners();
        },

        initEventListeners: () => {
            // Auth
            document.querySelector('.auth-toggle').addEventListener('click', App.ui.auth.toggleForm);
            document.getElementById('login-form').addEventListener('submit', App.handlers.auth.login);
            document.getElementById('register-form').addEventListener('submit', App.handlers.auth.register);
            document.getElementById('forgot-password-link').addEventListener('click', App.handlers.auth.showForgotModal);
            document.querySelectorAll('.password-toggle').forEach(toggle => {
                toggle.addEventListener('click', App.handlers.auth.togglePasswordVisibility);
            });

            // Contract Modal
            document.getElementById('contract-agree-checkbox').addEventListener('change', (e) => {
                document.getElementById('contract-accept-btn').disabled = !e.target.checked;
            });
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
            document.getElementById('support-btn').addEventListener('click', () => App.ui.nav.showPage('page-support'));
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

            // --- ADMIN HANDLERS ---
            document.getElementById('admin-user-table-body').addEventListener('click', App.handlers.admin.handleUserAction);
            document.getElementById('admin-create-voucher-form').addEventListener('submit', App.handlers.admin.createVoucher);
            document.getElementById('game-of-day-form').addEventListener('submit', App.handlers.admin.postGameOfDay);
            document.getElementById('admin-post-odds-form').addEventListener('submit', App.handlers.admin.postDailyOdds);
            document.getElementById('admin-support-inbox-container').addEventListener('click', App.handlers.admin.handleSupportAction);
            document.getElementById('broadcast-form').addEventListener('submit', App.handlers.admin.sendBroadcast);
            document.getElementById('generate-assistant-btn').addEventListener('click', App.handlers.admin.showAssistantModal);
            document.getElementById('admin-assistants-table-body').addEventListener('click', App.handlers.admin.handleAssistantAction);
            document.getElementById('admin-create-product-form').addEventListener('submit', App.handlers.admin.createProduct);
            document.getElementById('admin-products-table-body').addEventListener('click', App.handlers.admin.handleProductAction);
            document.getElementById('system-settings-form').addEventListener('submit', App.handlers.admin.saveSettings);
        },

        // --- 3. HANDLERS (User Actions) ---
        handlers: {
            auth: {
                login: async (e) => {
                    e.preventDefault();
                    App.ui.showLoader('Logging in...');
                    const emailOrId = document.getElementById('login-email').value;
                    const password = document.getElementById('login-password').value;
                    const isPasswordless = document.getElementById('login-passwordless').checked;
                    
                    const res = await App.api.call('/login', 'POST', { emailOrId, password, isPasswordless });
                    
                    if (res.token) {
                        App.state.token = res.token;
                        localStorage.setItem('predictpro_token', res.token);
                        App.ui.hideLoader();
                        
                        if (res.needsContract) {
                            App.ui.showAssistantContract();
                        } else {
                            App.ui.auth.showApp();
                        }
                    } else {
                        App.ui.auth.showError('login', res.message || "Login failed.");
                    }
                },
                register: async (e) => {
                    e.preventDefault();
                    App.ui.showLoader('Registering...');
                    const email = document.getElementById('register-email').value;
                    const password = document.getElementById('register-password').value;
                    const refCode = document.getElementById('register-ref-code').value;
                    
                    const res = await App.api.call('/register', 'POST', { email, password, refCode });
                    
                    if (res.message.includes('success')) {
                        App.ui.hideLoader();
                        App.ui.showToast('Registration successful! Please log in.', 'success');
                        App.ui.auth.switchForm('login-form');
                    } else {
                        App.ui.auth.showError('register', res.message || "Registration failed.");
                    }
                },
                logout: () => {
                    App.state.token = null;
                    App.state.currentUser = null;
                    localStorage.removeItem('predictpro_token');
                    App.ui.auth.showLogin();
                },
                showForgotModal: (e) => {
                    e.preventDefault();
                    App.ui.modal.show(
                        "Forgot Password",
                        `<p>Enter your email. If an account exists, we will send you a reset link.</p>
                         <form id="forgot-pass-form">
                            <div class="form-group">
                                <label for="forgot-email">Your Email</label>
                                <input type="email" id="forgot-email" required>
                            </div>
                         </form>`,
                         `<button class="btn btn-primary" id="modal-forgot-submit">Send Link</button>`
                    );
                    document.getElementById('modal-forgot-submit').onclick = App.handlers.auth.sendResetLink;
                },
                sendResetLink: async () => {
                    const email = document.getElementById('forgot-email').value;
                    if (!email) return;
                    App.ui.showLoader("Sending link...");
                    const res = await App.api.call('/forgot-password', 'POST', { email });
                    App.ui.hideLoader();
                    App.ui.modal.hide();
                    App.ui.showToast(res.message, 'success');
                },
                togglePasswordVisibility: (e) => {
                    const targetId = e.target.dataset.target;
                    const input = document.getElementById(targetId);
                    if (input) {
                        input.type = (input.type === 'password') ? 'text' : 'password';
                        e.target.textContent = (input.type === 'password') ? '👁️' : '🙈';
                    }
                },
                acceptContract: async () => {
                    App.ui.showLoader("Accepting contract...");
                    await App.api.call('/user/accept-contract', 'POST');
                    App.ui.hideLoader();
                    document.getElementById('contract-modal-overlay').classList.add('hidden');
                    App.ui.auth.showApp();
                }
            },
            nav: {
                navigate: (e) => {
                    let target = e.target.closest('.nav-link');
                    if (!target) return;
                    e.preventDefault();
                    App.ui.nav.showPage(target.dataset.page);
                    if (window.innerWidth < 1024) App.ui.nav.toggleSidebar(false);
                }
            },
            dashboard: {
                copyRefLink: () => {
                    const input = document.getElementById('referral-link-input');
                    if (!App.state.currentUser) return;
                    input.value = `https://predictpro.com/register?ref=${App.state.currentUser.refCode}`;
                    input.select();
                    document.execCommand('copy');
                    App.ui.showToast('Referral link copied!', 'success');
                }
            },
            wallet: {
                redeemVoucher: async (e) => {
                    e.preventDefault();
                    App.ui.showLoader("Verifying Transaction...");
                    const mpesaMessage = document.getElementById('mpesa-message-input').value;
                    const res = await App.api.call('/wallet/redeem', 'POST', { mpesaMessage });
                    
                    App.ui.hideLoader();
                    if (res.message.includes('Success')) {
                        App.ui.showToast(res.message, 'success');
                        document.getElementById('payment-verify-form').reset();
                        App.ui.updateAll(); // Refresh all user data
                    } else {
                        // Error message is already shown by api.call
                    }
                }
            },
            store: {
                handleBuyClick: async (e) => {
                    const button = e.target.closest('button');
                    if (!button || !button.dataset.id || button.disabled) return;

                    const productId = button.dataset.id;
                    const product = App.state.appSettings.storeProducts.find(p => p.id === productId);
                    
                    // Optimistic check
                    if (App.state.currentUser.walletBalance < product.price) {
                         const remaining = product.price - App.state.currentUser.walletBalance;
                         return App.handlers.store.showPartialPaymentModal(product, remaining);
                    }

                    App.ui.showLoader(`Purchasing ${product.name}...`);
                    const res = await App.api.call(`/store/buy/${productId}`, 'POST');
                    App.ui.hideLoader();

                    if (res.message.includes('successful')) {
                        App.ui.modal.show(
                            "Purchase Successful!",
                            `<p>You have successfully purchased the **${product.name}**.</p><p>Your new balance is ${res.newBalance} coins.</p>`,
                            `<button class="btn btn-primary" id="modal-ok-btn">OK</button>`
                        );
                        document.getElementById('modal-ok-btn').onclick = App.ui.modal.hide;
                        App.ui.updateAll();
                    } else {
                        // This handles the server-side check for insufficient funds
                        const remaining = product.price - App.state.currentUser.walletBalance;
                        App.handlers.store.showPartialPaymentModal(product, remaining);
                    }
                },
                showPartialPaymentModal: (product, remaining) => {
                    App.ui.modal.show(
                        "Insufficient Funds",
                        `<p>You do not have enough funds to buy the **${product.name}**.</p>
                         <p>Price: <strong>${product.price} coins</strong></p>
                         <p>Your Balance: <strong>${App.state.currentUser.walletBalance} coins</strong></p>
                         <hr>
                         <p>You need **${remaining} more coins**. Please add funds to your wallet and try again.</p>`,
                         `<button class="btn btn-primary" id="modal-add-funds-btn">Add Funds</button>`
                    );
                    document.getElementById('modal-add-funds-btn').onclick = () => {
                        App.ui.modal.hide();
                        App.ui.nav.showPage('page-wallet');
                    };
                }
            },
            predictions: {
                getPrediction: async (e) => {
                    const game = e.target.dataset.game;
                    
                    if (game === 'odds') {
                        App.ui.showLoader("Loading Daily Odds...");
                        const res = await App.api.call('/predictions/odds', 'GET');
                        App.ui.hideLoader();
                        if (res.oddsContent) {
                            const resultEl = document.getElementById('odds-prediction-result');
                            resultEl.innerHTML = res.oddsContent;
                            resultEl.style.display = 'block';
                        }
                        return;
                    }

                    App.ui.showLoader(`Analyzing ${game}...`);
                    const res = await App.api.call(`/predictions/predict/${game}`, 'POST');
                    App.ui.hideLoader();
                    
                    if (res.prediction) {
                        document.getElementById(`${game}-prediction-result`).innerHTML = res.prediction;
                        document.getElementById(`${game}-prediction-result`).style.display = 'block';
                    }
                }
            },
            rewards: {
                claimDailyReward: async () => {
                    App.ui.showLoader("Claiming reward...");
                    const res = await App.api.call('/rewards/claim', 'POST');
                    App.ui.hideLoader();
                    
                    if (res.message.includes('Success')) {
                        App.ui.showToast(res.message, 'success');
                        App.ui.updateAll();
                    }
                }
            },
            profile: {
                updateProfile: async (e) => {
                    e.preventDefault();
                    App.ui.showLoader('Updating profile...');
                    const username = document.getElementById('profile-username').value;
                    const res = await App.api.call('/user/profile', 'POST', { username });
                    // Note: File upload is more complex and not included here.
                    
                    App.ui.hideLoader();
                    if (res.user) {
                        App.state.currentUser = res.user;
                        App.ui.updateSidebar();
                        App.ui.showToast('Profile updated!', 'success');
                    }
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
                submitTicket: async (e) => {
                    e.preventDefault();
                    const subject = document.getElementById('support-subject').value;
                    const message = document.getElementById('support-message').value;
                    if (!subject || !message) return;
                    
                    App.ui.showLoader("Sending ticket...");
                    const res = await App.api.call('/support/ticket', 'POST', { subject, message });
                    App.ui.hideLoader();

                    if (res.message.includes("submitted")) {
                        App.ui.showToast(res.message, 'success');
                        document.getElementById('support-ticket-form').reset();
                        App.ui.renderUserSupportTickets();
                    }
                },
                reportIssue: () => App.ui.showToast("Report issue not yet implemented.", 'warning')
            },

            // --- ADMIN HANDLERS ---
            admin: {
                // Main data load for all admin pages
                loadAdminData: async () => {
                    App.ui.showLoader("Loading Admin Data...");
                    const res = await App.api.call('/admin/data', 'GET');
                    App.ui.hideLoader();
                    if (!res) return;
                    
                    App.state.adminData = res; // Cache all admin data
                    App.state.appSettings = res.settings; // Update frontend settings
                    
                    // Re-render the current page (which is an admin page)
                    const renderFunc = App.ui.pageRenderers[App.state.currentPage];
                    if (renderFunc) renderFunc();
                },

                handleUserAction: async (e) => {
                    const button = e.target.closest('button');
                    if (!button) return;
                    const userId = button.dataset.id;
                    const action = button.dataset.action;

                    if (action === 'ban') {
                        const reason = prompt("Reason for ban:");
                        if (!reason) return;
                        await App.api.call('/admin/users/ban', 'POST', { userId, reason });
                    }
                    if (action === 'unban') {
                        await App.api.call('/admin/users/unban', 'POST', { userId });
                    }
                    if (action === 'flag') {
                        await App.api.call('/admin/users/flag', 'POST', { userId });
                    }
                    if (action === 'unflag') {
                        await App.api.call('/admin/users/unflag', 'POST', { userId });
                    }
                    if (action === 'resetpass') {
                        const newPassword = prompt("Enter new temporary password (min 6 chars):");
                        if (!newPassword || newPassword.length < 6) return App.ui.showToast("Invalid password.", "warning");
                        await App.api.call('/admin/users/resetpass', 'POST', { userId, newPassword });
                    }
                    if (action === 'viewlog') {
                        const logs = App.state.adminData.logs.filter(l => l.userId.toString() === userId);
                        let logHtml = `<div class="data-table-container" style="max-height: 400px; overflow-y: auto;"><table class="data-table"><thead><tr><th>Time</th><th>Action</th><th>Details</th></tr></thead><tbody>`;
                        logHtml += (logs.length === 0) ? `<tr><td colspan="3">No logs found.</td></tr>` : 
                            logs.map(log => `<tr><td>${new Date(log.timestamp).toLocaleString()}</td><td>${log.action}</td><td>${log.details}</td></tr>`).join('');
                        logHtml += `</tbody></table></div>`;
                        App.ui.modal.show(`Activity Log`, logHtml, '');
                    }
                    
                    App.handlers.admin.loadAdminData(); // Refresh data
                },
                createVoucher: async (e) => {
                    e.preventDefault();
                    const txnId = document.getElementById('voucher-txn-id').value;
                    const amount = document.getElementById('voucher-amount').value;
                    
                    App.ui.showLoader("Creating voucher...");
                    const res = await App.api.call('/admin/vouchers', 'POST', { txnId, amount });
                    App.ui.hideLoader();
                    
                    if (res.message.includes("created")) {
                        App.ui.showToast(res.message, 'success');
                        document.getElementById('admin-create-voucher-form').reset();
                        App.handlers.admin.loadAdminData();
                    }
                },
                postGameOfDay: async (e) => {
                    e.preventDefault();
                    const title = document.getElementById('game-of-day-title').value;
                    const content = document.getElementById('game-of-day-content').value;
                    await App.api.call('/admin/settings', 'POST', { gameOfDay: { title, content } });
                    App.ui.showToast("Game of the Day posted!", "success");
                },
                postDailyOdds: async (e) => {
                    e.preventDefault();
                    const content = document.getElementById('odds-content').value;
                    await App.api.call('/admin/settings', 'POST', { dailyOddsContent: content });
                    App.ui.showToast("Daily Odds posted!", "success");
                },
                handleSupportAction: (e) => {
                    App.ui.showToast("Support actions not built in this client.", 'warning');
                },
                sendBroadcast: async (e) => {
                    e.preventDefault();
                    const subject = document.getElementById('broadcast-subject').value;
                    const message = document.getElementById('broadcast-message-input').value;
                    const premiumOnly = document.getElementById('broadcast-premium-only').checked;

                    App.ui.showLoader("Sending broadcast...");
                    const res = await App.api.call('/admin/broadcast', 'POST', { subject, message, premiumOnly });
                    App.ui.hideLoader();
                    App.ui.showToast(res.message, 'success');
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
                    document.getElementById('modal-confirm-gen-assistant').onclick = App.handlers.admin.createAssistant;
                },
                createAssistant: async () => {
                    const email = document.getElementById('assistant-email').value;
                    const password = document.getElementById('assistant-pass').value;
                    
                    App.ui.showLoader("Creating assistant...");
                    const res = await App.api.call('/admin/assistants', 'POST', { email, password });
                    App.ui.hideLoader();
                    
                    if (res.message.includes("created")) {
                        App.ui.modal.hide();
                        App.ui.showToast(res.message, 'success');
                        App.handlers.admin.loadAdminData();
                    }
                },
                handleAssistantAction: async (e) => {
                    const button = e.target.closest('button');
                    if (!button) return;
                    const id = button.dataset.id;
                    if (button.dataset.action === 'delete') {
                        if (confirm(`Are you sure you want to delete this assistant?`)) {
                            await App.api.call(`/admin/assistants/${id}`, 'DELETE');
                            App.handlers.admin.loadAdminData();
                        }
                    }
                },
                createProduct: async (e) => {
                    e.preventDefault();
                    const id = document.getElementById('product-id').value;
                    const name = document.getElementById('product-name').value;
                    const price = parseInt(document.getElementById('product-price').value);
                    const description = document.getElementById('product-description').value;

                    App.ui.showLoader("Saving product...");
                    await App.api.call('/admin/store', 'POST', { id, name, price, description });
                    App.ui.hideLoader();
                    App.ui.showToast("Product saved.", 'success');
                    document.getElementById('admin-create-product-form').reset();
                    App.handlers.admin.loadAdminData();
                },
                handleProductAction: async (e) => {
                    const button = e.target.closest('button');
                    if (!button) return;
                    const id = button.dataset.id;
                    if (button.dataset.action === 'delete') {
                        if (confirm(`Are you sure you want to delete product ${id}?`)) {
                            await App.api.call(`/admin/store/${id}`, 'DELETE');
                            App.handlers.admin.loadAdminData();
                        }
                    }
                },
                saveSettings: async (e) => {
                    e.preventDefault();
                    const settings = {
                        crashEnabled: document.getElementById('toggle-crash-game').checked,
                        minesEnabled: document.getElementById('toggle-mines-game').checked,
                        assistantResetEnabled: document.getElementById('toggle-assistant-reset').checked,
                        passwordlessLoginEnabled: document.getElementById('toggle-passwordless-login').checked
                    };
                    
                    App.ui.showLoader("Saving settings...");
                    await App.api.call('/admin/settings', 'POST', settings);
                    App.ui.hideLoader();
                    App.ui.showToast("Settings saved.", 'success');
                }
            }
        },

        // --- 4. API HELPER ---
        api: {
            call: async (endpoint, method, body = null) => {
                try {
                    const headers = new Headers();
                    headers.append('Content-Type', 'application/json');
                    
                    if (App.state.token) {
                        headers.append('Authorization', `Bearer ${App.state.token}`);
                    }

                    const options = {
                        method: method,
                        headers: headers,
                        body: body ? JSON.stringify(body) : null,
                    };
                    
                    const response = await fetch(App.API_URL + endpoint, options);
                    const res_json = await response.json();
                    
                    if (response.status === 401) {
                        App.handlers.auth.logout();
                        return { message: "Session expired. Please log in again." };
                    }
                    
                    if (!response.ok) {
                        App.ui.hideLoader();
                        App.ui.showToast(res_json.message, 'danger');
                    }
                    return res_json;
                    
                } catch (err) {
                    console.error('API Call Error:', err);
                    App.ui.hideLoader();
                    App.ui.showToast('Connection error. Is the server running?', 'danger');
                    return { message: 'Connection error.' };
                }
            }
        },

        // --- 5. UI/RENDERING ---
        ui: {
            // --- Auth & Nav ---
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
                showError: (form, message) => {
                    const el = document.getElementById(`${form}-error`);
                    if(el) el.textContent = message;
                    if(message) App.ui.hideLoader();
                },
                showApp: async () => {
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
                    document.getElementById('sidebar').classList.toggle('open', forceOpen);
                },
                showPage: (pageId) => {
                    document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
                    const page = document.getElementById(pageId);
                    if (!page) pageId = 'page-dashboard'; // Default
                    document.getElementById(pageId).classList.remove('hidden');
                    
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
            
            // --- Global UI ---
            modal: {
                show: (title, body, footer = '') => {
                    document.getElementById('modal-title').innerHTML = title;
                    document.getElementById('modal-body').innerHTML = body;
                    document.getElementById('modal-footer').innerHTML = footer;
                    document.getElementById('modal-overlay').classList.remove('hidden');
                },
                hide: () => document.getElementById('modal-overlay').classList.add('hidden')
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
            hideLoader: () => document.getElementById('loader-overlay').classList.add('hidden'),

            // --- PAGE RENDERERS (Data-driven) ---
            updateAll: async () => {
                App.ui.showLoader("Syncing account...");
                const res = await App.api.call('/app/load', 'GET');
                App.ui.hideLoader();
                
                if (res.user) {
                    App.state.currentUser = res.user;
                    App.state.appSettings = res.settings; // Save latest settings
                    App.ui.updateSidebar();
                    App.ui.updateDashboard();
                    
                    // Re-render current page
                    const renderFunc = App.ui.pageRenderers[App.state.currentPage];
                    if (renderFunc) renderFunc();
                }
            },
            renderAll: async () => {
                ['whatsapp-btn', 'support-btn', 'report-issue-btn'].forEach(id => {
                    document.getElementById(id).classList.remove('hidden');
                });
                await App.ui.updateAll();
                App.ui.nav.showPage('page-dashboard');
            },
            
            updateSidebar: () => {
                const user = App.state.currentUser;
                if (!user) return;
                
                document.getElementById('app-container').classList.toggle('premium-ui', user.isPremium);
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
                const settings = App.state.appSettings;
                if (!user || !settings) return;
                
                document.getElementById('stat-coins').textContent = user.walletBalance;
                document.getElementById('stat-referrals').textContent = user.referrals ? user.referrals.length : 0;
                document.getElementById('stat-premium-status').textContent = user.isPremium ? 'Active' : 'Not Active';
                document.getElementById('stat-user-id').textContent = user.refCode;
                
                const { message, premiumOnly } = settings.broadcast;
                const broadcastBar = document.getElementById('broadcast-bar');
                if (message && (!premiumOnly || (premiumOnly && user.isPremium))) {
                    document.getElementById('broadcast-message').textContent = message;
                    broadcastBar.classList.remove('hidden');
                } else {
                    broadcastBar.classList.add('hidden');
                }
            
                const gameOfDay = settings.gameOfDay;
                const gameContentEl = document.getElementById('game-of-the-day-content');
                if (gameOfDay && gameOfDay.title !== 'No Game Posted') {
                    gameContentEl.innerHTML = user.isPremium ? 
                        `<h4>${gameOfDay.title}</h4>${gameOfDay.content}` : 
                        `<p>Purchase a Premium Plan to view the Game of the Day.</p>`;
                }
            },
            renderWalletPage: async () => {
                App.ui.showLoader("Loading wallet history...");
                const res = await App.api.call('/wallet/history', 'GET');
                App.ui.hideLoader();
                
                const tableBody = document.getElementById('wallet-history-table');
                if (res.history && res.history.length > 0) {
                    tableBody.innerHTML = res.history.map(log => `
                        <tr>
                            <td>${new Date(log.timestamp).toLocaleDateString()}</td>
                            <td>${log.details}</td>
                            <td style="color: ${log.amount > 0 ? 'var(--success)' : 'var(--danger)'}">${log.amount > 0 ? '+' : ''}${log.amount}</td>
                        </tr>
                    `).join('');
                } else {
                    tableBody.innerHTML = `<tr><td colspan="3">No wallet history.</td></tr>`;
                }
                
                // Cooldown timer
                const user = App.state.currentUser;
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
                const products = App.state.appSettings.storeProducts;
                const grid = document.getElementById('store-item-grid');
                if (!products || products.length === 0) {
                    grid.innerHTML = '<div class="page-placeholder"><p>The store is currently empty.</p></div>';
                    return;
                }
                
                const userInventory = App.state.currentUser.inventory || [];
                grid.innerHTML = products.map(p => {
                    const alreadyOwned = userInventory.includes(p.id);
                    return `
                    <div class="predictor-card">
                        <span class="predictor-icon">🛒</span>
                        <h3>${p.name}</h3>
                        <p>${p.description}</p>
                        <div class="predictor-price">${p.price} <small>coins</small></div>
                        <button class="btn ${alreadyOwned ? 'btn-secondary' : 'btn-primary'} btn-full" 
                                data-id="${p.id}" ${alreadyOwned ? 'disabled' : ''}>
                            ${alreadyOwned ? 'Owned' : 'Buy Now'}
                        </button>
                    </div>`;
                }).join('');
            },
            renderRewardPage: () => {
                const user = App.state.currentUser;
                if (!user) return;
                document.getElementById('reward-status-text').textContent = user.isPremium ? 
                    'Click below to claim your daily reward.' : 
                    'You must purchase the Premium Plan to claim daily rewards.';
                document.getElementById('claim-reward-btn').disabled = !user.isPremium;
            },
            renderProfilePage: () => {
                const user = App.state.currentUser;
                if (!user) return;
                document.getElementById('profile-pic-preview').src = user.profilePic;
                document.getElementById('profile-username').value = user.username;
                document.getElementById('profile-email').value = user.email;
            },
            renderPredictionPage: () => {
                const settings = App.state.appSettings;
                if (!settings) return;
                document.getElementById('predictor-crash').style.opacity = settings.crashEnabled ? 1 : 0.5;
                document.getElementById('get-crash-prediction').disabled = !settings.crashEnabled;
                document.getElementById('predictor-mines').style.opacity = settings.minesEnabled ? 1 : 0.5;
                document.getElementById('get-mines-prediction').disabled = !settings.minesEnabled;
            },
            renderUserSupportTickets: () => {
                // This would fetch tickets from '/support/tickets'
                document.getElementById('ticket-history-container').innerHTML = "<p>Support tickets are not fully implemented in this client.</p>";
            },
            
            // --- ADMIN PAGE RENDERERS ---
            renderAdminUsers: () => {
                const adminData = App.state.adminData;
                if (!adminData) return App.handlers.admin.loadAdminData();
                const tableBody = document.getElementById('admin-user-table-body');
                
                tableBody.innerHTML = adminData.users.map(user => {
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
                                ${user.isBanned ? `<button class="btn btn-sm btn-success" data-id="${user._id}" data-action="unban">Unban</button>` : `<button class="btn btn-sm btn-danger" data-id="${user._id}" data-action="ban">Ban</button>`}
                                ${user.isFlagged ? `<button class="btn btn-sm btn-secondary" data-id="${user._id}" data-action="unflag">Unflag</button>` : `<button class="btn btn-sm btn-warning" data-id="${user._id}" data-action="flag">Flag</button>`}
                                <button class="btn btn-sm btn-secondary" data-id="${user._id}" data-action="resetpass">Reset Pass</button>
                                <button class="btn btn-sm btn-secondary" data-id="${user._id}" data-action="viewlog">View Log</button>
                            </td>
                        </tr>
                    `;
                }).join('');
            },
            renderAdminWallet: () => {
                const adminData = App.state.adminData;
                if (!adminData) return App.handlers.admin.loadAdminData();
                const tableBody = document.getElementById('admin-voucher-table-body');
                tableBody.innerHTML = adminData.vouchers.map(v => `
                    <tr>
                        <td>${new Date(v.createdDate).toLocaleDateString()}</td>
                        <td>${v.txnId}</td>
                        <td>${v.amount} coins</td>
                        <td>${v.status === 'UNUSED' ? `<span class="badge badge-success">UNUSED</span>` : `<span class="badge badge-inactive">USED</span>`}</td>
                        <td>${v.redeemedBy || 'N/A'}</td>
                    </tr>
                `).join('');
            },
            renderAdminGameManagement: () => {
                const settings = App.state.appSettings;
                if (!settings) return App.handlers.admin.loadAdminData();
                document.getElementById('game-of-day-title').value = settings.gameOfDay.title;
                document.getElementById('game-of-day-content').value = settings.gameOfDay.content;
                document.getElementById('odds-content').value = settings.dailyOddsContent;
            },
            renderAdminSupport: () => {
                const adminData = App.state.adminData;
                if (!adminData) return App.handlers.admin.loadAdminData();
                const container = document.getElementById('admin-support-inbox-container');
                container.innerHTML = (adminData.tickets.length === 0) ? '<p>No open support tickets.</p>' :
                    adminData.tickets.map(ticket => `
                        <div class="support-ticket">
                            <div class="ticket-header"><h4>${ticket.subject} <small>(${ticket.userEmail})</small></h4><span class="badge badge-success">Open</span></div>
                        </div>
                    `).join('');
            },
            renderAdminAssistants: () => {
                const adminData = App.state.adminData;
                if (!adminData) return App.handlers.admin.loadAdminData();
                const assistants = adminData.users.filter(u => u.role === 'assistant');
                const tableBody = document.getElementById('admin-assistants-table-body');
                tableBody.innerHTML = assistants.map(user => `
                    <tr>
                        <td>${user.email}</td>
                        <td>${user.hasAcceptedContract ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-warning">Pending</span>'}</td>
                        <td><button class="btn btn-sm btn-secondary" data-id="${user._id}" data-action="contract">View</button></td>
                        <td class="action-btns"><button class="btn btn-sm btn-danger" data-id="${user._id}" data-action="delete">Delete</button></td>
                    </tr>
                `).join('');
            },
            renderAdminStore: () => {
                const adminData = App.state.adminData;
                if (!adminData) return App.handlers.admin.loadAdminData();
                const products = adminData.settings.storeProducts;
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
                const settings = App.state.appSettings;
                if (!settings) return App.handlers.admin.loadAdminData();
                document.getElementById('toggle-crash-game').checked = settings.crashEnabled;
                document.getElementById('toggle-mines-game').checked = settings.minesEnabled;
                document.getElementById('toggle-assistant-reset').checked = settings.assistantResetEnabled;
                document.getElementById('toggle-passwordless-login').checked = settings.passwordlessLoginEnabled;
            },
            renderAdminLogs: () => {
                const adminData = App.state.adminData;
                if (!adminData) return App.handlers.admin.loadAdminData();
                const tableBody = document.getElementById('admin-logs-table-body');
                tableBody.innerHTML = adminData.logs.map(log => `<tr><td>${new Date(log.timestamp).toLocaleString()}</td><td>${log.userId}</td><td>${log.action}</td><td>${log.details}</td></tr>`).join('');
            },
            
            // Page to renderer mapping
            pageRenderers: {
                'page-dashboard': App.ui.updateDashboard,
                'page-wallet': App.ui.renderWalletPage,
                'page-store': App.ui.renderStorePage,
                'page-predictions': App.ui.renderPredictionPage,
                'page-rewards': App.ui.renderRewardPage,
                'page-profile': App.ui.renderProfilePage,
                'page-support': App.ui.renderUserSupportTickets,
                // Admin pages
                'page-admin-users': App.ui.renderAdminUsers,
                'page-admin-wallet': App.ui.renderAdminWallet,
                'page-admin-games': App.ui.renderAdminGameManagement,
                'page-admin-support': App.ui.renderAdminSupport,
                'page-admin-broadcast': () => {}, // No data to load
                'page-admin-assistants': App.ui.renderAdminAssistants,
                'page-admin-store': App.ui.renderAdminStore,
                'page-admin-settings': App.ui.renderAdminSettings,
                'page-admin-logs': App.ui.renderAdminLogs,
            }
        },
    };

    App.init();
});
