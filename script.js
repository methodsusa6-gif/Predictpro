/*
    PredictPro V8 - Frontend Client (Final Deployment Ready Fix)
    
    This file is fully updated:
    1.  API_URL is now dynamically built based on the current host, removing the need
        for manual replacement (The FIX).
    2.  All frontend logic is set to communicate with your secure Node.js backend.
*/

document.addEventListener('DOMContentLoaded', () => {
    const App = {
        // --- 1. STATE & API ---
        state: {
            token: null,
            currentUser: null, 
            currentPage: 'page-dashboard',
            storeProducts: [], 
            settings: {}, 
        },
        
        // ** FINAL FIX: Dynamically determine API URL **
        API_URL: window.location.protocol + "//" + window.location.host.replace('www.', '') + '/api',

        // --- 2. CORE APP INIT ---
        init: () => {
            App.state.token = localStorage.getItem('predictpro_token');
            if (App.state.token) {
                App.ui.auth.showApp();
            } else {
                App.ui.auth.showLogin();
            }
            App.initEventListeners();
            console.log("API Target: " + App.API_URL);
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

            // Support
            document.getElementById('support-ticket-form').addEventListener('submit', App.handlers.support.submitTicket);

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
                        App.ui.showToast('Registration successful! Please check your email.', 'success');
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
                    const res = await App.api.call('/user/accept-contract', 'POST');
                    App.ui.hideLoader();
                    
                    if (res.message.includes('accepted')) {
                        document.getElementById('contract-modal-overlay').classList.add('hidden');
                        App.ui.auth.showApp();
                    } else {
                        App.ui.showToast("Failed to accept contract. Please try logging in again.", 'danger');
                    }
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
                    App.ui.showLoader("Verifying...");
                    const mpesaMessage = document.getElementById('mpesa-message-input').value;
                    const res = await App.api.call('/wallet/redeem', 'POST', { mpesaMessage });
                    
                    App.ui.hideLoader();
                    if (res.message.includes('Success')) {
                        App.ui.showToast(res.message, 'success');
                        document.getElementById('payment-verify-form').reset();
                        App.ui.updateAll();
                    } else {
                        App.ui.showToast(res.message, 'danger');
                    }
                }
            },
            store: {
                handleBuyClick: async (e) => {
                    const button = e.target.closest('button');
                    if (!button || !button.dataset.id) return;

                    const productId = button.dataset.id;
                    const product = App.state.storeProducts.find(p => p.id === productId);
                    if (!product) return App.ui.showToast("Error: Product details unavailable.", 'danger');

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
                        App.ui.modal.show(
                            "Insufficient Funds",
                            `<p>${res.message}</p><p>Please add funds to your wallet and try again.</p>`,
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
                getPrediction: async (e) => {
                    const game = e.target.dataset.game;
                    
                    if (game === 'odds') {
                        App.ui.showLoader("Loading Daily Odds...");
                        const res = await App.api.call('/predictions/odds', 'GET');
                        App.ui.hideLoader();
                        
                        const resultEl = document.getElementById('odds-prediction-result');
                        if (res.oddsContent) {
                            resultEl.innerHTML = res.oddsContent;
                            resultEl.style.display = 'block';
                        } else {
                            App.ui.showToast(res.message, 'danger');
                            resultEl.style.display = 'none';
                        }
                        return;
                    }

                    // For Crash/Mines (simulated, behind license check)
                    App.ui.showLoader(`Analyzing ${game}...`);
                    const res = await App.api.call(`/predictions/predict/${game}`, 'POST');
                    App.ui.hideLoader();
                    
                    const resultEl = document.getElementById(`${game}-prediction-result`);
                    if (res.prediction) {
                        resultEl.innerHTML = res.prediction;
                        resultEl.style.display = 'block';
                    } else {
                        App.ui.showToast(res.message, 'danger');
                        resultEl.style.display = 'none';
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
                    } else {
                        App.ui.showToast(res.message, 'warning');
                    }
                }
            },
            support: {
                reportIssue: () => App.ui.showToast("Reporting issue logic not fully implemented yet.", 'warning'),
                submitTicket: async (e) => {
                    e.preventDefault();
                    App.ui.showLoader("Submitting ticket...");
                    const subject = document.getElementById('support-subject').value;
                    const message = document.getElementById('support-message').value;
                    
                    const res = await App.api.call('/support/submit', 'POST', { subject, message });
                    App.ui.hideLoader();
                    
                    if (res.message.includes('success')) {
                        App.ui.showToast('Support ticket submitted.', 'success');
                        e.target.reset();
                        App.ui.nav.showPage('page-support');
                    } else {
                        App.ui.showToast(res.message, 'danger');
                    }
                }
            }
        },

        // --- 4. API HELPER ---
        api: {
            call: async (endpoint, method, body = null) => {
                const headers = new Headers();
                headers.append('Content-Type', 'application/json');
                
                if (App.state.token) {
                    headers.append('Authorization', `Bearer ${App.state.token}`);
                }

                const options = { method, headers };
                if (body) options.body = JSON.stringify(body);
                
                try {
                    const response = await fetch(App.API_URL + endpoint, options);
                    
                    if (response.status === 401 || response.status === 403) {
                        App.ui.showToast("Session expired or access denied. Logging out.", 'danger');
                        App.handlers.auth.logout();
                        return { message: "Session expired." };
                    }
                    
                    return await response.json();
                } catch (err) {
                    console.error('API Call Error:', err);
                    App.ui.hideLoader();
                    // This error means the frontend cannot find the server at all.
                    return { message: 'Connection error. The backend server may be down.' };
                }
            }
        },

        // --- 5. UI/RENDERING ---
        ui: {
            auth: {
                switchForm: (formId) => {
                    document.getElementById('login-form').classList.add('hidden');
                    document.getElementById('register-form').classList.add('hidden');
                    document.getElementById(formId).classList.remove('hidden');
                    document.querySelectorAll('.auth-toggle-btn').forEach(btn => btn.classList.remove('active'));
                    document.querySelector(`.auth-toggle-btn[data-form="${formId}"]`).classList.add('active');
                    App.ui.auth.showError('login', '');
                    App.ui.auth.showError('register', '');
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
                    if (!page) pageId = 'page-dashboard';
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
                    App.state.settings = res.settings;
                    
                    if (res.settings && res.settings.storeProducts) {
                        App.state.storeProducts = res.settings.storeProducts;
                    }

                    App.ui.updateSidebar();
                    App.ui.updateDashboard();
                    
                    const renderFunc = App.ui.pageRenderers[App.state.currentPage];
                    if (renderFunc) renderFunc();
                } else {
                    App.handlers.auth.logout();
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
                const settings = App.state.settings;
                if (!user || !settings) return;
                
                document.getElementById('stat-coins').textContent = user.walletBalance;
                document.getElementById('stat-referrals').textContent = user.referrals.length;
                document.getElementById('stat-premium-status').textContent = user.isPremium ? 'Active' : 'Not Active';
                document.getElementById('stat-user-id').textContent = user.refCode || user._id;

                const { message, premiumOnly } = settings.broadcast;
                const broadcastBar = document.getElementById('broadcast-bar');
                const isBroadcastVisible = message && (!premiumOnly || (premiumOnly && user.isPremium));
                
                if (isBroadcastVisible) {
                    document.getElementById('broadcast-message').innerHTML = message;
                    broadcastBar.classList.remove('hidden');
                } else {
                    broadcastBar.classList.add('hidden');
                }
                
                const gameContentEl = document.getElementById('game-of-the-day-content');
                if (user.isPremium) {
                    gameContentEl.innerHTML = `<h4>${settings.gameOfDay.title}</h4>${settings.gameOfDay.content}`;
                } else {
                    gameContentEl.innerHTML = `<p>Purchase a Premium Plan to view the Game of the Day.</p>`;
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
            },
            renderStorePage: async () => {
                const products = App.state.settings.storeProducts;
                const user = App.state.currentUser;
                const grid = document.getElementById('store-item-grid');
                
                if (products.length === 0) {
                    grid.innerHTML = '<div class="page-placeholder"><p>The store is currently empty.</p></div>';
                    return;
                }
                
                const userInventory = user.inventory || [];
                
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
                const btn = document.getElementById('claim-reward-btn');
                document.getElementById('reward-status-text').textContent = user.isPremium ? 
                    'Click below to claim your daily reward.' : 
                    'You must purchase the Premium Plan to claim daily rewards.';
                btn.disabled = !user.isPremium;
            },
            renderProfilePage: () => {
                const user = App.state.currentUser;
                if (!user) return;
                document.getElementById('profile-pic-preview').src = user.profilePic;
                document.getElementById('profile-username').value = user.username;
                document.getElementById('profile-email').value = user.email;
            },
            renderUserSupportTickets: async () => {
                 App.ui.showLoader("Loading tickets...");
                 const res = await App.api.call('/support/user-tickets', 'GET');
                 App.ui.hideLoader();
                 
                 const container = document.getElementById('ticket-history-container');
                 if (res.tickets && res.tickets.length > 0) {
                    container.innerHTML = res.tickets.map(ticket => `
                        <div class="support-ticket">
                            <div class="ticket-header">
                                <h4>${ticket.subject}</h4>
                                <span class="badge ${ticket.status === 'open' ? 'badge-success' : 'badge-inactive'}">${ticket.status}</span>
                            </div>
                            <div class="ticket-body" style="display: block;">
                                ${ticket.messages.map(msg => `<div class="ticket-message ${msg.from}"><small>${msg.from} on ${new Date(msg.date).toLocaleString()}</small><p>${msg.text}</p></div>`).join('')}
                            </div>
                        </div>
                    `).join('');
                 } else {
                     container.innerHTML = "<p>You have no support tickets.</p>";
                 }
            },
            // Admin pages are placeholders for now
            renderAdminUsers: () => { App.ui.showToast("Admin dashboard data needs to be loaded.", 'warning'); },
            renderAdminWallet: () => { App.ui.showToast("Admin wallet data needs to be loaded.", 'warning'); },
            renderAdminGameManagement: () => { App.ui.showToast("Admin game data needs to be loaded.", 'warning'); },
            renderAdminSupport: () => { App.ui.showToast("Admin support inbox needs to be loaded.", 'warning'); },
            renderAdminAssistants: () => { App.ui.showToast("Admin assistant data needs to be loaded.", 'warning'); },
            renderAdminStore: () => { App.ui.showToast("Admin store data needs to be loaded.", 'warning'); },
            renderAdminSettings: () => { App.ui.showToast("Admin settings data needs to be loaded.", 'warning'); },
            renderAdminLogs: () => { App.ui.showToast("Admin logs data needs to be loaded.", 'warning'); },
            
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
                'page-admin-broadcast': () => {},
                'page-admin-assistants': App.ui.renderAdminAssistants,
                'page-admin-store': App.ui.renderAdminStore,
                'page-admin-settings': App.ui.renderAdminSettings,
                'page-admin-logs': App.ui.renderAdminLogs,
            }
        },
    };

    App.init();
});
