// DOM Elements
const mainMenu = document.querySelector('.main-menu');
const miniMenu = document.getElementById('mini-menu');
const calculatorSections = {
    gpa: document.getElementById('gpa-section'),
    cgpa: document.getElementById('cgpa-section'),
    attendance: document.getElementById('attendance-section'),
    internals: document.getElementById('internals-section'),
    events: document.getElementById('events-section'),
    announcements: document.getElementById('announcements-section')
};

// Firebase Firestore references
let db;
let auth;
let eventsCollection;
let announcementsCollection;

// Initialize the app
function initApp() {
    // Initialize Firebase
    initializeFirebase();
    
    // Create mini menu cards
    const menuItems = [
        { id: 'gpa', icon: 'fa-calculator', title: 'GPA', color: 'primary' },
        { id: 'cgpa', icon: 'fa-chart-line', title: 'CGPA', color: 'success' },
        { id: 'attendance', icon: 'fa-calendar-check', title: 'Attendance', color: 'warning' },
        { id: 'internals', icon: 'fa-clipboard-list', title: 'Internals', color: 'accent' }
    ];

    miniMenu.innerHTML = menuItems.map(item => `
        <div class="mini-card ${item.id}" onclick="showSection('${item.id}')">
            <i class="fas ${item.icon}"></i>
            <h3>${item.title}</h3>
        </div>
    `).join('');

    // Initialize calculator sections
    initGPASection();
    initCGPASection();
    initAttendanceSection();
    initInternalsSection();
}

// Initialize Firebase
function initializeFirebase() {
    // Initialize Firebase services
    db = firebase.firestore();
    auth = firebase.auth();
    
    // Set up collections
    eventsCollection = db.collection('events');
    announcementsCollection = db.collection('announcements');
    
    // Listen for auth state changes
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in
            document.getElementById('admin-panel').style.display = 'block';
            loadAdminEvents();
            loadAdminAnnouncements();
        } else {
            // User is signed out
            document.getElementById('admin-panel').style.display = 'none';
        }
    });
}

// Show selected section and minimize menu
function showSection(section, event) {
    // Hide all calculator sections
    Object.values(calculatorSections).forEach(el => {
        el.style.display = 'none';
    });

    // Show selected calculator section
    const selectedSection = calculatorSections[section];
    selectedSection.style.display = 'block';

    // Load content if needed
    if (section === 'events') {
        loadEvents();
    } else if (section === 'announcements') {
        loadAnnouncements();
    }

    // Scroll to the section
    selectedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Hide section and show main menu
function hideSection(section) {
    calculatorSections[section].style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Load events from Firestore
function loadEvents() {
    const departmentEventsContainer = document.getElementById("department-events");
    const generalEventsList = document.getElementById("general-events-list");
    const eventSelect = document.getElementById("event-select");
    const loadingElement = document.getElementById("events-loading");
    
    // Show loading spinner
    departmentEventsContainer.innerHTML = '';
    generalEventsList.innerHTML = '';
    eventSelect.innerHTML = '<option value="">Select an event</option>';
    loadingElement.style.display = 'block';
    
    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Query events from Firestore (future events only)
    eventsCollection.where('date', '>=', today)
        .orderBy('date')
        .get()
        .then(querySnapshot => {
            loadingElement.style.display = 'none';
            
            if (querySnapshot.empty) {
                departmentEventsContainer.innerHTML = '<p>No upcoming events found.</p>';
                return;
            }
            
            // Group events by department
            const eventsByDepartment = {};
            const allEvents = [];
            
            querySnapshot.forEach(doc => {
                const event = doc.data();
                event.id = doc.id;
                allEvents.push(event);
                
                // Add to department group or general
                if (event.department && event.department !== 'general') {
                    if (!eventsByDepartment[event.department]) {
                        eventsByDepartment[event.department] = [];
                    }
                    eventsByDepartment[event.department].push(event);
                }
            });
            
            // Display department events
            Object.keys(eventsByDepartment).forEach(dept => {
                const deptDiv = document.createElement("div");
                deptDiv.classList.add("event-category");
                deptDiv.innerHTML = `<h3>${dept} Department Events</h3>
                                     <ul class="events-list" id="${dept}-events-list"></ul>`;
                
                const deptList = deptDiv.querySelector(`#${dept}-events-list`);
                
                eventsByDepartment[dept].forEach(event => {
                    const li = document.createElement("li");
                    li.innerHTML = formatEventItem(event);
                    deptList.appendChild(li);
                    
                    // Add to event select dropdown
                    addEventToSelect(event);
                });
                
                departmentEventsContainer.appendChild(deptDiv);
            });
            
            // Display general events
            const generalEvents = allEvents.filter(event => 
                !event.department || event.department === 'general'
            );
            
            if (generalEvents.length > 0) {
                generalEvents.forEach(event => {
                    const li = document.createElement("li");
                    li.innerHTML = formatEventItem(event);
                    generalEventsList.appendChild(li);
                    
                    // Add to event select dropdown
                    addEventToSelect(event);
                });
            } else {
                generalEventsList.innerHTML = '<li>No general events scheduled.</li>';
            }
        })
        .catch(error => {
            loadingElement.style.display = 'none';
            departmentEventsContainer.innerHTML = `<p class="error">Error loading events: ${error.message}</p>`;
            console.error("Error getting events: ", error);
        });
}

// Format event item HTML
function formatEventItem(event) {
    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    let html = `
        <div class="event-item">
            <div class="event-header">
                <h4>${event.name}</h4>
                <span class="event-date">${formattedDate}</span>
            </div>
            <div class="event-details">
                <p><i class="fas fa-map-marker-alt"></i> ${event.location || 'TBA'}</p>
                ${event.description ? `<p>${event.description}</p>` : ''}
            </div>
            <div class="event-footer">
                ${event.registrationLink ? `
                <button onclick="window.open('${event.registrationLink}', '_blank')">
                    <i class="fas fa-external-link-alt"></i> Register
                </button>
                ` : ''}
                <button onclick="generateQRCode('${event.id}', '${event.name}')">
                    <i class="fas fa-qrcode"></i> Get QR Code
                </button>
            </div>
        </div>
    `;
    
    return html;
}

// Add event to select dropdown
function addEventToSelect(event) {
    const eventSelect = document.getElementById("event-select");
    const option = document.createElement("option");
    option.value = event.id;
    option.textContent = `${event.name} (${new Date(event.date).toLocaleDateString()})`;
    eventSelect.appendChild(option);
}

// Filter events by department
function filterEvents() {
    const department = document.getElementById("department-filter").value;
    const eventLists = document.querySelectorAll(".events-list");
    
    eventLists.forEach(list => {
        if (department === "all") {
            list.parentElement.style.display = "block";
        } else {
            const isDepartmentList = list.id.startsWith(department);
            list.parentElement.style.display = isDepartmentList ? "block" : "none";
        }
    });
}

// Register for selected event
function registerForSelectedEvent() {
    const eventSelect = document.getElementById("event-select");
    const eventId = eventSelect.value;
    
    if (!eventId) {
        alert("Please select an event first");
        return;
    }
    
    // Get event details
    eventsCollection.doc(eventId).get()
        .then(doc => {
            if (doc.exists) {
                const event = doc.data();
                if (event.registrationLink) {
                    window.open(event.registrationLink, "_blank");
                }
                generateQRCode(eventId, event.name);
            } else {
                alert("Event not found");
            }
        })
        .catch(error => {
            console.error("Error getting event: ", error);
            alert("Error getting event details");
        });
}

// Generate QR code for event
function generateQRCode(eventId, eventName) {
    const qrCodeContainer = document.getElementById("qr-code-container");
    qrCodeContainer.innerHTML = "";
    
    // Create a unique registration code (in a real app, this would be stored in the database)
    const registrationCode = `EVENT-${eventId}-${Date.now()}`;
    
    // Create QR code data
    const qrData = JSON.stringify({
        eventId: eventId,
        eventName: eventName,
        registrationCode: registrationCode,
        timestamp: new Date().toISOString()
    });
    
    // Generate QR code
    new QRCode(qrCodeContainer, {
        text: qrData,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
    
    // Add download button
    const downloadBtn = document.createElement("button");
    downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download QR Code';
    downloadBtn.onclick = () => downloadQRCode(eventName);
    qrCodeContainer.appendChild(downloadBtn);
}

// Download QR code as image
function downloadQRCode(eventName) {
    const canvas = document.querySelector("#qr-code-container canvas");
    if (!canvas) return;
    
    const link = document.createElement("a");
    link.download = `Veltech-Event-${eventName.replace(/\s+/g, '-')}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
}

// Load announcements from Firestore
function loadAnnouncements() {
    const announcementsList = document.getElementById("announcements-list");
    const loadingElement = document.getElementById("announcements-loading");
    
    // Show loading spinner
    announcementsList.innerHTML = '';
    loadingElement.style.display = 'block';
    
    // Query announcements from Firestore (sorted by timestamp descending)
    announcementsCollection.orderBy('timestamp', 'desc').limit(20).get()
        .then(querySnapshot => {
            loadingElement.style.display = 'none';
            
            if (querySnapshot.empty) {
                announcementsList.innerHTML = '<li>No announcements available.</li>';
                return;
            }
            
            querySnapshot.forEach(doc => {
                const announcement = doc.data();
                const li = document.createElement("li");
                li.className = `announcement-item ${announcement.priority || 'normal'}`;
                
                const date = new Date(announcement.timestamp?.seconds * 1000 || announcement.timestamp);
                const formattedDate = date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                li.innerHTML = `
                    <div class="announcement-header">
                        <h4>${announcement.title}</h4>
                        <span class="announcement-date">${formattedDate}</span>
                    </div>
                    <div class="announcement-content">
                        <p>${announcement.content}</p>
                    </div>
                `;
                
                announcementsList.appendChild(li);
            });
        })
        .catch(error => {
            loadingElement.style.display = 'none';
            announcementsList.innerHTML = `<li class="error">Error loading announcements: ${error.message}</li>`;
            console.error("Error getting announcements: ", error);
        });
}

// Show admin login modal
function showAdminLogin() {
    document.getElementById('admin-login-modal').style.display = 'block';
}

// Close admin login modal
function closeAdminLogin() {
    document.getElementById('admin-login-modal').style.display = 'none';
    document.getElementById('admin-login-error').textContent = '';
}

// Admin login
function adminLogin() {
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    const errorElement = document.getElementById('admin-login-error');
    
    if (!email || !password) {
        errorElement.textContent = 'Please enter both email and password';
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            closeAdminLogin();
        })
        .catch(error => {
            console.error("Login error:", error);
            errorElement.textContent = error.message;
        });
}

// Admin logout
function adminLogout() {
    auth.signOut()
        .then(() => {
            // Logout successful
        })
        .catch(error => {
            console.error("Logout error:", error);
        });
}

// Show admin tab
function showAdminTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.admin-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Deactivate all tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Activate selected tab
    document.getElementById(`admin-${tabName}-tab`).classList.add('active');
    document.querySelector(`.admin-tab[onclick="showAdminTab('${tabName}')"]`).classList.add('active');
}

// Load events for admin
function loadAdminEvents() {
    const adminEventsList = document.getElementById('admin-events-list');
    
    // Show loading
    adminEventsList.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading events...</div>';
    
    // Query all events (including past ones)
    eventsCollection.orderBy('date').get()
        .then(querySnapshot => {
            if (querySnapshot.empty) {
                adminEventsList.innerHTML = '<p>No events found.</p>';
                return;
            }
            
            adminEventsList.innerHTML = '';
            
            querySnapshot.forEach(doc => {
                const event = doc.data();
                event.id = doc.id;
                
                const eventDate = new Date(event.date);
                const formattedDate = eventDate.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                
                const eventElement = document.createElement('div');
                eventElement.className = 'admin-list-item';
                eventElement.innerHTML = `
                    <div class="admin-item-header">
                        <h4>${event.name}</h4>
                        <span class="admin-item-date">${formattedDate}</span>
                    </div>
                    <div class="admin-item-details">
                        <p><strong>Department:</strong> ${event.department || 'General'}</p>
                        <p><strong>Location:</strong> ${event.location || 'TBA'}</p>
                        ${event.description ? `<p>${event.description}</p>` : ''}
                    </div>
                    <div class="admin-item-actions">
                        <button class="admin-delete-btn" onclick="deleteEvent('${doc.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                `;
                
                adminEventsList.appendChild(eventElement);
            });
        })
        .catch(error => {
            adminEventsList.innerHTML = `<p class="error">Error loading events: ${error.message}</p>`;
            console.error("Error getting events: ", error);
        });
}

// Add new event
function addEvent() {
    const name = document.getElementById('event-name').value;
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const location = document.getElementById('event-location').value;
    const department = document.getElementById('event-department').value;
    const year = document.getElementById('event-year').value;
    const description = document.getElementById('event-description').value;
    const registrationLink = document.getElementById('event-registration-link').value;
    const errorElement = document.getElementById('event-error');
    
    // Validate inputs
    if (!name || !date) {
        errorElement.textContent = 'Event name and date are required';
        return;
    }
    
    // Combine date and time if time is provided
    const eventDate = time ? `${date}T${time}` : date;
    
    // Create event object
    const newEvent = {
        name: name,
        date: eventDate,
        location: location,
        department: department,
        targetYear: year,
        description: description,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (registrationLink) {
        newEvent.registrationLink = registrationLink;
    }
    
    // Add to Firestore
    eventsCollection.add(newEvent)
        .then(() => {
            // Clear form
            document.getElementById('event-name').value = '';
            document.getElementById('event-date').value = '';
            document.getElementById('event-time').value = '';
            document.getElementById('event-location').value = '';
            document.getElementById('event-description').value = '';
            document.getElementById('event-registration-link').value = '';
            errorElement.textContent = '';
            
            // Refresh events list
            loadAdminEvents();
            
            // If events section is visible, refresh it too
            if (document.getElementById('events-section').style.display === 'block') {
                loadEvents();
            }
        })
        .catch(error => {
            errorElement.textContent = error.message;
            console.error("Error adding event: ", error);
        });
}

// Delete event
function deleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event?')) {
        return;
    }
    
    eventsCollection.doc(eventId).delete()
        .then(() => {
            loadAdminEvents();
            
            // If events section is visible, refresh it too
            if (document.getElementById('events-section').style.display === 'block') {
                loadEvents();
            }
        })
        .catch(error => {
            console.error("Error deleting event: ", error);
            alert('Error deleting event');
        });
}

// Load announcements for admin
function loadAdminAnnouncements() {
    const adminAnnouncementsList = document.getElementById('admin-announcements-list');
    
    // Show loading
    adminAnnouncementsList.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading announcements...</div>';
    
    // Query announcements
    announcementsCollection.orderBy('timestamp', 'desc').get()
        .then(querySnapshot => {
            if (querySnapshot.empty) {
                adminAnnouncementsList.innerHTML = '<p>No announcements found.</p>';
                return;
            }
            
            adminAnnouncementsList.innerHTML = '';
            
            querySnapshot.forEach(doc => {
                const announcement = doc.data();
                announcement.id = doc.id;
                
                const date = new Date(announcement.timestamp?.seconds * 1000 || announcement.timestamp);
                const formattedDate = date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const announcementElement = document.createElement('div');
                announcementElement.className = 'admin-list-item';
                announcementElement.innerHTML = `
                    <div class="admin-item-header">
                        <h4>${announcement.title}</h4>
                        <span class="admin-item-date">${formattedDate}</span>
                    </div>
                    <div class="admin-item-details">
                        <p>${announcement.content}</p>
                        <p><strong>Priority:</strong> ${announcement.priority || 'normal'}</p>
                    </div>
                    <div class="admin-item-actions">
                        <button class="admin-delete-btn" onclick="deleteAnnouncement('${doc.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                `;
                
                adminAnnouncementsList.appendChild(announcementElement);
            });
        })
        .catch(error => {
            adminAnnouncementsList.innerHTML = `<p class="error">Error loading announcements: ${error.message}</p>`;
            console.error("Error getting announcements: ", error);
        });
}

// Add new announcement
function addAnnouncement() {
    const title = document.getElementById('announcement-title').value;
    const content = document.getElementById('announcement-content').value;
    const priority = document.getElementById('announcement-priority').value;
    const errorElement = document.getElementById('announcement-error');
    
    // Validate inputs
    if (!title || !content) {
        errorElement.textContent = 'Title and content are required';
        return;
    }
    
    // Create announcement object
    const newAnnouncement = {
        title: title,
        content: content,
        priority: priority,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Add to Firestore
    announcementsCollection.add(newAnnouncement)
        .then(() => {
            // Clear form
            document.getElementById('announcement-title').value = '';
            document.getElementById('announcement-content').value = '';
            errorElement.textContent = '';
            
            // Refresh announcements list
            loadAdminAnnouncements();
            
            // If announcements section is visible, refresh it too
            if (document.getElementById('announcements-section').style.display === 'block') {
                loadAnnouncements();
            }
        })
        .catch(error => {
            errorElement.textContent = error.message;
            console.error("Error adding announcement: ", error);
        });
}

// Delete announcement
function deleteAnnouncement(announcementId) {
    if (!confirm('Are you sure you want to delete this announcement?')) {
        return;
    }
    
    announcementsCollection.doc(announcementId).delete()
        .then(() => {
            loadAdminAnnouncements();
            
            // If announcements section is visible, refresh it too
            if (document.getElementById('announcements-section').style.display === 'block') {
                loadAnnouncements();
            }
        })
        .catch(error => {
            console.error("Error deleting announcement: ", error);
            alert('Error deleting announcement');
        });
}

// Initialize GPA Calculator Section
function initGPASection() {
    calculatorSections.gpa.innerHTML = `
        <div class="section-header">
            <h2>GPA Calculator</h2>
            <button class="back-btn" onclick="hideSection('gpa')"><i class="fas fa-arrow-left"></i> Back</button>
        </div>

        <div class="form-group">
            <label for="gpa-subjects">Number of Subjects</label>
            <input type="number" id="gpa-subjects" min="1" max="10" value="5">
        </div>

        <button class="btn-block" onclick="generateSubjectInputs()">Generate Subjects</button>

        <div id="gpa-subject-container" class="subject-container" style="display: none;">
            <div id="gpa-subject-inputs"></div>
            <button class="btn-block" onclick="calculateGPA()">Calculate GPA</button>
        </div>

        <div id="gpa-result" class="result-container">
            <div class="result-label">Your GPA is</div>
            <div id="gpa-value" class="result-value"></div>
        </div>
    `;
}

// Generate subject inputs for GPA calculator
function generateSubjectInputs() {
    const numSubjects = parseInt(document.getElementById('gpa-subjects').value);
    const container = document.getElementById('gpa-subject-inputs');
    container.innerHTML = '';

    for (let i = 1; i <= numSubjects; i++) {
        const subjectDiv = document.createElement('div');
        subjectDiv.className = 'subject-row';
        subjectDiv.innerHTML = `
            <div>
                <label for="subject${i}-credits">Credits</label>
                <input type="number" id="subject${i}-credits" min="1" max="10" value="3">
            </div>
            <div>
                <label for="subject${i}-grade">Grade</label>
                <select id="subject${i}-grade">
                    <option value="10">S (90-100%)</option>
                    <option value="9">A (80-89%)</option>
                    <option value="8">B (70-79%)</option>
                    <option value="7">C (60-69%)</option>
                    <option value="6">D (50-59%)</option>
                    <option value="5">E (40-49%)</option>
                    <option value="0">F (Below 40%)</option>
                </select>
            </div>
        `;
        container.appendChild(subjectDiv);
    }

    document.getElementById('gpa-subject-container').style.display = 'block';
    document.getElementById('gpa-result').classList.remove('show');
}

// Calculate GPA
function calculateGPA() {
    const numSubjects = parseInt(document.getElementById('gpa-subjects').value);
    let totalCredits = 0;
    let totalGradePoints = 0;

    for (let i = 1; i <= numSubjects; i++) {
        const credits = parseInt(document.getElementById(`subject${i}-credits`).value);
        const grade = parseInt(document.getElementById(`subject${i}-grade`).value);

        totalCredits += credits;
        totalGradePoints += credits * grade;
    }

    const gpa = (totalGradePoints / totalCredits).toFixed(2);

    document.getElementById('gpa-value').textContent = gpa;
    document.getElementById('gpa-result').classList.add('show');

    // Add pulse animation
    document.getElementById('gpa-value').classList.add('pulse');
    setTimeout(() => {
        document.getElementById('gpa-value').classList.remove('pulse');
    }, 1000);
}

// Initialize CGPA Calculator Section
function initCGPASection() {
    calculatorSections.cgpa.innerHTML = `
        <div class="section-header">
            <h2>CGPA Calculator</h2>
            <button class="back-btn" onclick="hideSection('cgpa')"><i class="fas fa-arrow-left"></i> Back</button>
        </div>

        <div class="form-group">
            <label for="cgpa-semesters">Number of Semesters Completed</label>
            <input type="number" id="cgpa-semesters" min="1" max="10" value="1">
        </div>

        <button class="btn-block" onclick="generateSemesterInputs()">Generate Semesters</button>

        <div id="cgpa-semester-container" class="subject-container" style="display: none;">
            <div id="cgpa-semester-inputs"></div>
            <button class="btn-block" onclick="calculateCGPA()">Calculate CGPA</button>
        </div>

        <div id="cgpa-result" class="result-container">
            <div class="result-label">Your CGPA is</div>
            <div id="cgpa-value" class="result-value"></div>
        </div>
    `;
}

// Generate semester inputs for CGPA calculator
function generateSemesterInputs() {
    const numSemesters = parseInt(document.getElementById('cgpa-semesters').value);
    const container = document.getElementById('cgpa-semester-inputs');
    container.innerHTML = '';

    for (let i = 1; i <= numSemesters; i++) {
        const semesterDiv = document.createElement('div');
        semesterDiv.className = 'subject-row';
        semesterDiv.innerHTML = `
            <div>
                <label for="semester${i}-gpa">Semester ${i} GPA</label>
                <input type="number" id="semester${i}-gpa" min="0" max="10" step="0.01" placeholder="Enter GPA">
            </div>
            <div>
                <label for="semester${i}-credits">Total Credits</label>
                <input type="number" id="semester${i}-credits" min="1" max="50" value="25">
            </div>
        `;
        container.appendChild(semesterDiv);
    }

    document.getElementById('cgpa-semester-container').style.display = 'block';
    document.getElementById('cgpa-result').classList.remove('show');
}

// Calculate CGPA
function calculateCGPA() {
    const numSemesters = parseInt(document.getElementById('cgpa-semesters').value);
    let totalCredits = 0;
    let totalGradePoints = 0;

    for (let i = 1; i <= numSemesters; i++) {
        const gpa = parseFloat(document.getElementById(`semester${i}-gpa`).value);
        const credits = parseInt(document.getElementById(`semester${i}-credits`).value);

        if (isNaN(gpa)) {
            alert(`Please enter GPA for Semester ${i}`);
            return;
        }

        totalCredits += credits;
        totalGradePoints += credits * gpa;
    }

    const cgpa = (totalGradePoints / totalCredits).toFixed(2);

    document.getElementById('cgpa-value').textContent = cgpa;
    document.getElementById('cgpa-result').classList.add('show');

    // Add pulse animation
    document.getElementById('cgpa-value').classList.add('pulse');
    setTimeout(() => {
        document.getElementById('cgpa-value').classList.remove('pulse');
    }, 1000);
}

// Initialize Attendance Calculator Section
function initAttendanceSection() {
    calculatorSections.attendance.innerHTML = `
        <div class="section-header">
            <h2>Attendance Calculator</h2>
            <button class="back-btn" onclick="hideSection('attendance')"><i class="fas fa-arrow-left"></i> Back</button>
        </div>

        <div class="form-group">
            <label for="total-sessions">Total Sessions</label>
            <input type="number" id="total-sessions" min="1">
        </div>

        <div class="form-group">
            <label for="faculty-sessions">Faculty Sessions (Classes taken by faculty)</label>
            <input type="number" id="faculty-sessions" min="1">
        </div>

        <div class="form-group">
            <label for="present-sessions">Sessions Attended</label>
            <input type="number" id="present-sessions" min="0">
        </div>

        <button class="btn-block" onclick="calculateAttendance()">Calculate Attendance</button>

        <div id="attendance-result" class="result-container">
            <div class="result-label">Present Percentage</div>
            <div id="faculty-percentage" class="result-value"></div>

            <div class="result-label" style="margin-top: 20px;">Overall Attendance Percentage</div>
            <div id="overall-percentage" class="result-value"></div>

            <div id="attendance-status" class="attendance-status" style="display: none;">
                <h3 style="text-align: center; margin-bottom: 15px;">Attendance Status</h3>
                <div id="eligibility-status" class="status-item">
                    <span class="status-label">Eligibility Status:</span>
                    <span class="status-value" id="eligibility-text"></span>
                </div>
                <div class="status-item">
                    <span class="status-label">For Condonation you need:</span>
                    <span class="status-value" id="condonation-classes"></span>
                </div>
                <div class="status-item">
                    <span class="status-label">For Eligibility you need:</span>
                    <span class="status-value" id="eligibility-classes"></span>
                </div>
            </div>
        </div>
    `;
}

// Calculate attendance percentages
function calculateAttendance() {
    const totalSessions = parseInt(document.getElementById('total-sessions').value);
    const facultySessions = parseInt(document.getElementById('faculty-sessions').value);
    const presentSessions = parseInt(document.getElementById('present-sessions').value);

    if (presentSessions > facultySessions) {
        alert('Present sessions cannot be more than faculty sessions');
        return;
    }

    let facultyPercentage = ((presentSessions / facultySessions) * 100).toFixed(2);
    let overallPercentage = ((presentSessions / totalSessions) * 100).toFixed(2);
    
    facultyPercentage = Math.min(parseFloat(facultyPercentage), 100);
    overallPercentage = Math.min(parseFloat(overallPercentage), 100);

    document.getElementById('faculty-percentage').textContent = facultyPercentage + '%';
    document.getElementById('overall-percentage').textContent = overallPercentage + '%';
    document.getElementById('attendance-result').classList.add('show');

    // Calculate attendance status
    const condonationThreshold = Math.ceil(0.65 * totalSessions);
    const eligibilityThreshold = Math.ceil(0.75 * totalSessions);

    const condonationNeeded = Math.max(0, condonationThreshold - presentSessions);
    const eligibilityNeeded = Math.max(0, eligibilityThreshold - presentSessions);

    const statusContainer = document.getElementById('attendance-status');
    statusContainer.style.display = 'block';

    document.getElementById('condonation-classes').textContent = condonationNeeded + ' more classes';
    document.getElementById('eligibility-classes').textContent = eligibilityNeeded + ' more classes';

    const eligibilityText = document.getElementById('eligibility-text');
    if (presentSessions >= eligibilityThreshold) {
        eligibilityText.textContent = 'You are eligible';
        eligibilityText.parentElement.classList.add('eligible');
        eligibilityText.parentElement.classList.remove('condonation', 'not-eligible');
    } else if (presentSessions >= condonationThreshold) {
        eligibilityText.textContent = 'Eligible for condonation';
        eligibilityText.parentElement.classList.add('condonation');
        eligibilityText.parentElement.classList.remove('eligible', 'not-eligible');
    } else {
        eligibilityText.textContent = 'Not eligible';
        eligibilityText.parentElement.classList.add('not-eligible');
        eligibilityText.parentElement.classList.remove('eligible', 'condonation');
    }

    // Add pulse animation
    document.querySelectorAll('#faculty-percentage, #overall-percentage').forEach(el => {
        el.classList.add('pulse');
        setTimeout(() => {
            el.classList.remove('pulse');
        }, 1000);
    });
}

// Initialize Internals Calculator Section
function initInternalsSection() {
    calculatorSections.internals.innerHTML = `
        <div class="section-header">
            <h2>Internals Calculator</h2>
            <button class="back-btn" onclick="hideSection('internals')"><i class="fas fa-arrow-left"></i> Back</button>
        </div>

        <div class="tabs">
            <div class="tab active" onclick="switchTab('theory')">Theory</div>
            <div class="tab" onclick="switchTab('integrated')">Integrated</div>
        </div>

        <div id="theory-tab" class="tab-content active">
            <div class="form-group">
                <label for="test1">Test 1 Marks (Max 30)</label>
                <input type="number" id="test1" min="0" max="30">
            </div>

            <div class="form-group">
                <label for="test2">Test 2 Marks (Max 30)</label>
                <input type="number" id="test2" min="0" max="30">
            </div>

            <div class="form-group">
                <label for="test3">Test 3 Marks (Max 30)</label>
                <input type="number" id="test3" min="0" max="30">
            </div>

            <div class="form-group">
                <label for="attendance-marks">Attendance Marks (Max 5)</label>
                <input type="number" id="attendance-marks" min="0" max="5">
            </div>

            <div class="form-group">
                <label for="assignment-marks">Assignment Marks (Max 5)</label>
                <input type="number" id="assignment-marks" min="0" max="5">
            </div>

            <button class="btn-block" onclick="calculateTheoryInternals()">Calculate Internals</button>

            <div id="theory-result" class="result-container">
                <div class="result-label">Your Internal Marks</div>
                <div id="theory-internals" class="internals-result"></div>
            </div>
        </div>

        <div id="integrated-tab" class="tab-content">
            <div class="form-group">
                <label for="mid1">Mid 1 Marks (Max 20)</label>
                <input type="number" id="mid1" min="0" max="20">
            </div>

            <div class="form-group">
                <label for="mid2">Mid 2 Marks (Max 20)</label>
                <input type="number" id="mid2" min="0" max="20">
            </div>

            <div class="form-group">
                <label for="lab-marks">Lab Marks (Max 20)</label>
                <input type="number" id="lab-marks" min="0" max="20">
            </div>

            <div class="form-group">
                <label for="integrated-attendance">Attendance Marks (Max 5)</label>
                <input type="number" id="integrated-attendance" min="0" max="5">
            </div>

            <div class="form-group">
                <label for="integrated-assignment">Assignment Marks (Max 5)</label>
                <input type="number" id="integrated-assignment" min="0" max="5">
            </div>

            <button class="btn-block" onclick="calculateIntegratedInternals()">Calculate Internals</button>

            <div id="integrated-result" class="result-container">
                <div class="result-label">Your Internal Marks</div>
                <div id="integrated-internals" class="internals-result"></div>
            </div>
        </div>
    `;
}

// Switch between theory and integrated tabs
function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(el => {
        el.classList.remove('active');
    });

    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
    });

    document.querySelector(`.tab[onclick="switchTab('${tab}')"]`).classList.add('active');
    document.getElementById(`${tab}-tab`).classList.add('active');
}

// Calculate theory internals
function calculateTheoryInternals() {
    const test1 = parseInt(document.getElementById('test1').value) || 0;
    const test2 = parseInt(document.getElementById('test2').value) || 0;
    const test3 = parseInt(document.getElementById('test3').value) || 0;
    const attendance = parseInt(document.getElementById('attendance-marks').value) || 0;
    const assignment = parseInt(document.getElementById('assignment-marks').value) || 0;

    if (test1 > 30 || test2 > 30 || test3 > 30) {
        alert('Test marks cannot exceed 30');
        return;
    }

    if (attendance > 5) {
        alert('Attendance marks cannot exceed 5');
        return;
    }

    if (assignment > 5) {
        alert('Assignment marks cannot exceed 5');
        return;
    }

    const testMarks = ((test1 + test2 + test3) / 3).toFixed(2);
    const internals = Math.ceil(parseFloat(testMarks) + attendance + assignment);

    const resultElement = document.getElementById('theory-internals');
    resultElement.innerHTML = internals;

    if (internals >= 40) {
        resultElement.innerHTML += ' <i class="fas fa-check-circle"></i>';
    } else {
        resultElement.innerHTML += ' <i class="fas fa-exclamation-circle"></i>';
    }

    document.getElementById('theory-result').classList.add('show');

    // Add pulse animation
    resultElement.classList.add('pulse');
    setTimeout(() => {
        resultElement.classList.remove('pulse');
    }, 1000);
}

// Calculate integrated internals
function calculateIntegratedInternals() {
    const mid1 = parseInt(document.getElementById('mid1').value) || 0;
    const mid2 = parseInt(document.getElementById('mid2').value) || 0;
    const labMarks = parseInt(document.getElementById('lab-marks').value) || 0;
    const attendance = parseInt(document.getElementById('integrated-attendance').value) || 0;
    const assignment = parseInt(document.getElementById('integrated-assignment').value) || 0;

    if (mid1 > 20 || mid2 > 20) {
        alert('Mid marks cannot exceed 20');
        return;
    }

    if (labMarks > 20) {
        alert('Lab marks cannot exceed 20');
        return;
    }

    if (attendance > 5) {
        alert('Attendance marks cannot exceed 5');
        return;
    }

    if (assignment > 5) {
        alert('Assignment marks cannot exceed 5');
        return;
    }

    const midMarks = ((mid1 + mid2) / 4).toFixed(2);
    const internals = (parseFloat(midMarks) + attendance + assignment + labMarks).toFixed(2);

    document.getElementById('integrated-internals').textContent = internals;
    document.getElementById('integrated-result').classList.add('show');

    // Add pulse animation
    document.getElementById('integrated-internals').classList.add('pulse');
    setTimeout(() => {
        document.getElementById('integrated-internals').classList.remove('pulse');
    }, 1000);
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);