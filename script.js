// --- Firebase Modular SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    query, 
    orderBy,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 1. Lorenza Firebase & Security Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyD5VHuvN0CLdGuuqX1MmMv5jnRE1CaPR5I",
    authDomain: "lorenza-store.firebaseapp.com",
    projectId: "lorenza-store",
    storageBucket: "lorenza-store.firebasestorage.app",
    messagingSenderId: "560764345995",
    appId: "1:560764345995:web:d32b329fc296390e137e8e"
};

// Security: Authorized Admin Emails
const AUTHORIZED_ADMIN_EMAILS = [
    "admin@lorenza.com",
    "ntajmal18@gmail.com",
    "lorenzastartup@gmail.comm",
    "lorenza-startup@gmail.com",
    "lorenza-startup@gmail.comm",
    "lorenzastartup@gmail.com"
];

// Initialize Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const grid = document.getElementById('product-grid');
const openAdminBtn = document.getElementById('open-admin-btn');
const closeLoginBtn = document.getElementById('close-login-btn');
const loginModal = document.getElementById('login-modal');
const adminModal = document.getElementById('admin-modal');
const loginForm = document.getElementById('admin-login-form');
const loginError = document.getElementById('login-error');
const addProductForm = document.getElementById('add-product-form');
const adminLogoutBtn = document.getElementById('admin-logout-btn');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toast-msg');
const menuToggle = document.getElementById('menu-toggle');
const navLinks = document.getElementById('nav-links');
const preloader = document.getElementById('preloader');

// Admin Dashboard Elements
const tabBtnList = document.getElementById('tab-btn-list');
const tabBtnAdd = document.getElementById('tab-btn-add');
const tabContentList = document.getElementById('tab-content-list');
const tabContentAdd = document.getElementById('tab-content-add');
const adminTableBody = document.getElementById('admin-table-body');
const adminSearchInput = document.getElementById('admin-search-input');
const fileInput = document.getElementById('prod-file-input');
const imageUrlInput = document.getElementById('prod-image-url');
const previewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const previewFilename = document.getElementById('preview-filename');
const editProdId = document.getElementById('edit-prod-id');
const addTabTitle = document.getElementById('add-tab-title');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

let currentUser = null;
let allProducts = [];
let selectedFile = null;

// --- 2. Preloader Controller ---
const loaderStartTime = Date.now();
const MIN_LOADER_TIME = 2000;

function dismissPreloader() {
    const elapsedTime = Date.now() - loaderStartTime;
    const remainingTime = Math.max(0, MIN_LOADER_TIME - elapsedTime);

    setTimeout(() => {
        if (preloader) {
            preloader.classList.add('fade-out');
        }
    }, remainingTime);
}

// Helper: Convert Local Image File to Base64 String
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}

// Security Helper: Check Authorized Email
function isEmailAuthorized(email) {
    if (!email) return false;
    const normalized = email.toLowerCase().trim();
    return AUTHORIZED_ADMIN_EMAILS.some(e => e.toLowerCase().trim() === normalized);
}

// --- 3. Real-Time Firestore Sync ---
function subscribeToProducts() {
    const productsRef = collection(db, "products");
    const q = query(productsRef, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        allProducts = [];

        snapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            allProducts.push({ id: docSnapshot.id, ...data });
        });

        renderPublicCatalog(allProducts);
        renderAdminTable(allProducts);
        updateDashboardStats(allProducts);
        dismissPreloader();
    }, (error) => {
        console.error("Firestore Error:", error);
        renderEmptyCatalogFallback();
        dismissPreloader();
    });
}

function renderPublicCatalog(products) {
    if (!grid) return;
    grid.innerHTML = '';
    const activeProducts = products.filter(item => item.inStock !== false);

    if (activeProducts.length === 0) {
        renderEmptyCatalogFallback();
        return;
    }

    activeProducts.forEach(item => {
        const badgeHTML = item.badge ? `<span class="badge">${item.badge}</span>` : '';
        const formattedPrice = `$${parseFloat(item.price).toFixed(2)}`;

        const cardHTML = `
            <div class="product-card">
                <div class="card-image">
                    <img src="${item.image}" alt="${item.title}" loading="lazy">
                    ${badgeHTML}
                </div>
                <div class="card-details">
                    <h3>${item.title}</h3>
                    <p class="price">${formattedPrice}</p>
                    <button class="add-to-cart-btn" data-title="${item.title}" data-price="${formattedPrice}">
                        <i class="fa-solid fa-bag-shopping"></i> Place Order
                    </button>
                </div>
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', cardHTML);
    });

    bindCartEvents();
}

function renderEmptyCatalogFallback() {
    if (!grid) return;
    grid.innerHTML = `
        <div class="empty-catalog-card">
            <i class="fa-solid fa-gem"></i>
            <h3>More Products Coming Soon</h3>
            <p>Our master artisans are currently preparing the next handcrafted private collection. Subscribe below to receive exclusive launch alerts.</p>
            <a href="#contact" class="btn btn-secondary"><i class="fa-solid fa-bell"></i> Get Launch Invite</a>
        </div>
    `;
}

function renderAdminTable(products) {
    if (!adminTableBody) return;
    adminTableBody.innerHTML = '';
    if (products.length === 0) {
        adminTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">No products in catalog.</td></tr>`;
        return;
    }

    products.forEach(item => {
        const formattedPrice = `$${parseFloat(item.price).toFixed(2)}`;
        const statusClass = item.inStock !== false ? 'instock' : 'outstock';
        const statusText = item.inStock !== false ? 'In Stock' : 'Out of Stock';

        const rowHTML = `
            <tr>
                <td><img src="${item.image}" alt="${item.title}" class="admin-thumb"></td>
                <td><strong>${item.title}</strong></td>
                <td>${item.category || 'General'}</td>
                <td>${formattedPrice}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <div class="table-action-btns">
                        <button class="btn-icon edit-btn" data-id="${item.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon delete delete-btn" data-id="${item.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
        adminTableBody.insertAdjacentHTML('beforeend', rowHTML);
    });

    bindTableActionEvents();
}

function updateDashboardStats(products) {
    const totalCount = products.length;
    const totalVal = products.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    const inStockCount = products.filter(i => i.inStock !== false).length;

    const statTotal = document.getElementById('stat-total-products');
    const statValue = document.getElementById('stat-total-value');
    const statStock = document.getElementById('stat-instock-count');

    if (statTotal) statTotal.innerText = totalCount;
    if (statValue) statValue.innerText = `$${totalVal.toFixed(2)}`;
    if (statStock) statStock.innerText = inStockCount;
}

// --- 4. Image Inputs & Previews ---
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFile = file;
            const reader = new FileReader();
            reader.onload = (event) => {
                if (imagePreview) imagePreview.src = event.target.result;
                if (previewFilename) previewFilename.innerText = file.name;
                if (previewContainer) previewContainer.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });
}

if (imageUrlInput) {
    imageUrlInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (url) {
            if (imagePreview) imagePreview.src = url;
            if (previewFilename) previewFilename.innerText = "External Link";
            if (previewContainer) previewContainer.classList.remove('hidden');
            selectedFile = null;
        } else if (!selectedFile && previewContainer) {
            previewContainer.classList.add('hidden');
        }
    });
}

// --- 5. Add / Edit Product Submit Handler ---
if (addProductForm) {
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!auth.currentUser || !isEmailAuthorized(auth.currentUser.email)) {
            alert("Permission Denied: You must be logged in with an authorized admin email address.");
            return;
        }

        const title = document.getElementById('prod-title').value;
        const price = parseFloat(document.getElementById('prod-price').value);
        const category = document.getElementById('prod-category').value;
        const badge = document.getElementById('prod-badge').value;
        const desc = document.getElementById('prod-desc').value;
        const inStock = document.getElementById('prod-instock').checked;
        const isEdit = editProdId.value !== "";

        let imageUrl = imageUrlInput ? imageUrlInput.value.trim() : "";

        showToast("Saving product...");

        if (selectedFile) {
            try {
                imageUrl = await fileToBase64(selectedFile);
            } catch (fileErr) {
                console.error("Image processing error:", fileErr);
                showToast("Image encoding failed. Defaulting to placeholder...");
            }
        }

        if (!imageUrl) {
            imageUrl = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop";
        }

        try {
            const productData = {
                title: title,
                price: price,
                category: category,
                badge: badge,
                description: desc,
                inStock: inStock,
                image: imageUrl,
                updatedAt: serverTimestamp()
            };

            if (isEdit) {
                await updateDoc(doc(db, "products", editProdId.value), productData);
                showToast(`Updated "${title}"`);
            } else {
                productData.createdAt = serverTimestamp();
                await addDoc(collection(db, "products"), productData);
                showToast(`Added "${title}" live to store!`);
            }

            resetProductForm();
            switchTab('list');
        } catch (dbError) {
            console.error("Firestore Save Error:", dbError);
            alert("Firestore Write Error:\n" + dbError.message + "\n\nPlease ensure your Firestore Rules permit writes for authenticated users.");
            showToast("Error saving product.");
        }
    });
}

function resetProductForm() {
    if (!addProductForm) return;
    addProductForm.reset();
    editProdId.value = "";
    selectedFile = null;
    if (previewContainer) previewContainer.classList.add('hidden');
    if (addTabTitle) addTabTitle.innerText = "Add New Product";
}

function bindTableActionEvents() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            const item = allProducts.find(p => p.id === id);

            if (item) {
                editProdId.value = item.id;
                document.getElementById('prod-title').value = item.title;
                document.getElementById('prod-price').value = item.price;
                document.getElementById('prod-category').value = item.category || 'Bags';
                document.getElementById('prod-badge').value = item.badge || '';
                document.getElementById('prod-desc').value = item.description || '';
                document.getElementById('prod-instock').checked = item.inStock !== false;
                
                if (imageUrlInput) {
                    imageUrlInput.value = item.image.startsWith('data:image') ? '' : item.image;
                }

                if (imagePreview) imagePreview.src = item.image;
                if (previewFilename) previewFilename.innerText = "Existing Image";
                if (previewContainer) previewContainer.classList.remove('hidden');

                if (addTabTitle) addTabTitle.innerText = "Edit Product";
                switchTab('add');
            }
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            if (!auth.currentUser || !isEmailAuthorized(auth.currentUser.email)) {
                alert("Permission Denied: Unauthorized admin.");
                return;
            }

            const id = this.getAttribute('data-id');
            if (confirm("Delete this product from live store?")) {
                try {
                    await deleteDoc(doc(db, "products", id));
                    showToast("Product deleted.");
                } catch (err) {
                    console.error("Delete error:", err);
                    showToast("Failed to delete product.");
                }
            }
        });
    });
}

if (adminSearchInput) {
    adminSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = allProducts.filter(p => p.title.toLowerCase().includes(term));
        renderAdminTable(filtered);
    });
}

// --- 6. Navigation Tabs & Accordion ---
function switchTab(tab) {
    if (tab === 'list') {
        if (tabBtnList) tabBtnList.classList.add('active');
        if (tabBtnAdd) tabBtnAdd.classList.remove('active');
        if (tabContentList) tabContentList.classList.add('active');
        if (tabContentAdd) tabContentAdd.classList.remove('active');
    } else {
        if (tabBtnAdd) tabBtnAdd.classList.add('active');
        if (tabBtnList) tabBtnList.classList.remove('active');
        if (tabContentAdd) tabContentAdd.classList.add('active');
        if (tabContentList) tabContentList.classList.remove('active');
    }
}

if (tabBtnList) tabBtnList.addEventListener('click', () => switchTab('list'));
if (tabBtnAdd) tabBtnAdd.addEventListener('click', () => switchTab('add'));
if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
        resetProductForm();
        switchTab('list');
    });
}

// FAQ Accordion
document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
        const item = button.parentElement;
        item.classList.toggle('active');
    });
});

// --- 7. Authentication & Restricted Admin Login ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (openAdminBtn) {
        if (user && isEmailAuthorized(user.email)) {
            openAdminBtn.innerHTML = `<i class="fa-solid fa-user-gear"></i> Portal Active`;
        } else {
            openAdminBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Admin`;
            if (adminModal) adminModal.classList.remove('active');
        }
    }
});

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value.trim();
        const pass = document.getElementById('admin-pass').value;

        if (!isEmailAuthorized(email)) {
            if (loginError) {
                loginError.innerText = "Access Denied: Email not authorized as Admin.";
                loginError.classList.add('show');
            }
            return;
        }

        try {
            await signInWithEmailAndPassword(auth, email, pass);
            if (loginError) loginError.classList.remove('show');
            loginForm.reset();
            if (loginModal) loginModal.classList.remove('active');
            if (adminModal) adminModal.classList.add('active');
            showToast("Authenticated as Admin");
        } catch (error) {
            console.error("Auth Error:", error);
            if (loginError) {
                loginError.innerText = "Invalid credentials or password.";
                loginError.classList.add('show');
            }
        }
    });
}

if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        showToast("Logged out of Admin Portal");
    });
}

// --- 8. WhatsApp VIP Order Concierge ---
function bindCartEvents() {
    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const itemTitle = this.getAttribute('data-title');
            const itemPrice = this.getAttribute('data-price');

            const orderMessage = `Hi Lorenza! I would like to order:\n\n📦 Item: ${itemTitle}\n💰 Price: ${itemPrice}\n\nPlease let me know how to proceed with payment and delivery!`;
            const phoneNumber = "918075203067";
            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(orderMessage)}`;

            showToast(`Opening WhatsApp for "${itemTitle}"...`);
            window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        });
    });
}

function showToast(message) {
    if (!toast || !toastMsg) return;
    toastMsg.innerText = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

if (openAdminBtn) {
    openAdminBtn.addEventListener('click', () => {
        if (auth.currentUser && isEmailAuthorized(auth.currentUser.email)) {
            if (adminModal) adminModal.classList.add('active');
        } else {
            if (loginModal) loginModal.classList.add('active');
        }
    });
}

if (closeLoginBtn) {
    closeLoginBtn.addEventListener('click', () => {
        if (loginModal) loginModal.classList.remove('active');
    });
}

if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => navLinks.classList.toggle('active'));
}

// Scroll Reveal Observer
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, { threshold: 0.1 });

// --- Safe Initialization & Fallback Preloader Dismissal ---
function initApp() {
    subscribeToProducts();
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    
    // Safety Fallback: Dismiss preloader after 3.5s even if Firebase is slow or fails
    setTimeout(() => {
        if (preloader && !preloader.classList.contains('fade-out')) {
            preloader.classList.add('fade-out');
        }
    }, 3500);
}

// Handle both standard loading and async/ES module execution states
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
