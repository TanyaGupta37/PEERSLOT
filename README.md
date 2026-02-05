# PEERSLOT
PeerSlot is a peer-to-peer academic support web platform designed for university students.
It helps students find the right peer for doubt-solving, study sessions, and academic collaboration in a structured, reliable, and secure way, instead of informal chats.

The platform uses Firebase Authentication and Firestore to manage users and profiles, and provides a clean dashboard experience with search, calendar, and session views.
<hr>
<h2>Tech Stack</h2>
<ul>
  <li>Frontend: HTML, CSS, JavaScript (ES Modules)</li>
  <li>Backend: Firebase Authentication, Firestore</li>
  <li>Hosting (planned): Firebase Hosting / GitHub Pages</li>
</ul>
<hr>
<h2>Running Project Locally</h2>
This project uses JavaScript ES modules and Firebase CDN imports, so it must be run through an HTTP server.
Opening the HTML files directly (file://) will not work. <br>
<h3>Method 1 using Python (Recommended Method)</h3>
<ol>
  <li>Open terminal/Power Shell</li>
  <li>Navigate to project folder: cd path/to/PeerSlot
  </li>
  <li>Start a local server: python -m http.server 5500 <br>
  (If this doesn’t work, try python3 instead of python.)
  </li>
  <li>Open your browser and go to: http://localhost:5500/index.html
</li>
</ol>
<h3>Method 2 using Node.js</h3>
<ol>
  <li>npx http-server</li>
  <li>Then Open: http://localhost:8080</li>
  <li>Using PHP: php -S localhost:8000</li>
</ol>
