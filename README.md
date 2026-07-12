<div align="center">

<img src="./screenshots/logo1.png" alt="MeetFlow Logo" width="300"/>

<h1>MeetFlow – Video Conferencing Application</h1>

<p><em>Connect • Collaborate • Communicate</em></p>

<p>
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"/>
  <img src="https://img.shields.io/badge/Node.js-v14%2B-green?logo=node.js" alt="Node.js"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" alt="React"/>
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/WebRTC-Enabled-orange?logo=webrtc" alt="WebRTC"/>
  <img src="https://img.shields.io/badge/Socket.io-Real--Time-black?logo=socket.io" alt="Socket.io"/>
  <img src="https://img.shields.io/github/stars/Mehak-991/MeetFlow?style=social" alt="Stars"/>
</p>

</div>

---

# Overview

MeetFlow is a modern **real-time video conferencing application** that enables seamless communication through high-quality video calls, screen sharing, and instant messaging.

Built using **React, Node.js, WebRTC, and Socket.io**, MeetFlow provides a simple interface for hosting and joining meetings with minimal setup.

---

# Live Demo

> 🚀 **[Try MeetFlow Live →](https://github.com/Mehak-991/MeetFlow)**

---

# Features

| Feature | Description |
|------|-------------|
| 🎥 Video Calls | Real-time video and audio communication |
| 💬 Real-Time Chat | Send messages during meetings |
| 🖥️ Screen Sharing | Share screen with participants |
| 👥 Multi-Participant Meetings | Support for multiple users |
| 🔐 Secure Authentication | Login and registration system |
| 🌗 Dark / Light Mode | UI theme toggle |
| 🔑 Meeting Code Join | Join meeting via code |
| 📱 Responsive Design | Works across devices |
| ⚡ Real-Time Signaling | WebRTC signaling via Socket.io |

---

# Tech Stack

---

## Frontend

[![Frontend](https://skillicons.dev/icons?i=react,html,css,js,materialui&perline=8)](https://skillicons.dev)

| Technology | Purpose |
|-----------|---------|
| React | Frontend UI framework |
| Material UI | UI component library |
| React Router | Client-side routing |
| Socket.io Client | Real-time communication |
| WebRTC | Peer-to-peer video/audio streaming |

---

## Backend

[![Backend](https://skillicons.dev/icons?i=nodejs,express,mongodb,socketio,js&perline=8)](https://skillicons.dev)

| Technology | Purpose |
|-----------|---------|
| Node.js | Runtime environment |
| Express.js | Backend framework |
| Socket.io | WebSocket communication |
| MongoDB | NoSQL database |
| JWT | Authentication tokens |
| bcrypt | Password hashing |

---

## Project Structure

![MeetFlow Project Structure](./docs/mermaid-diagram%20(1).png)


# Installation

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

---

# Backend Setup

### Navigate to backend

```
cd backend
```

### Install dependencies

``` 
npm install
```
### Create environment file

```
cp .env.example .env
```

### Configure environment variables

```
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
PORT=8000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Start backend server

```
npm start
```

Server runs on

```
http://localhost:8000
```


---

# Frontend Setup

### Navigate to frontend

```
cd frontend
```

### Install dependencies

```
npm install
```

### Create environment file

```
cp .env.example .env
```

### Configure environment

```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_SOCKET_URL=http://localhost:8000
```

### Start frontend

```
npm start
```

Frontend runs on

```
http://localhost:3000
```

---

# Application Workflow

---

## Landing Page

![Landing Page](./screenshots/image.png)

Users can

- Create an account
- Login to account
- Join meeting as guest

---

## Authentication

![Authentication](./screenshots/Screenshot%202025-12-04%20205129.png)

Users can

- Register new account
- Login using credentials

Passwords are securely hashed using **bcrypt**.

---

## Meeting Dashboard

![Home](./screenshots/Screenshot%202025-12-04%20205530.png)

Users can

- Create meeting
- Join meeting using meeting code

---

## Meeting Lobby

![Lobby](./screenshots/Gemini_Generated_Image_evf7rdevf7rdevf7.png)

Before joining users can

- Preview camera
- Enable microphone
- Enter display name

---

## Video Meeting Interface

![Meeting](./screenshots/image12.png)

Meeting interface includes

- Video grid
- Chat panel
- Meeting controls
- Participant display

---

## Meeting Controls

![Controls](./screenshots/final0mage.png)

Controls available

- Camera toggle
- Microphone mute/unmute
- Screen sharing
- Chat panel
- Copy meeting code
- Leave meeting

---

# Deployment

## Backend Deployment (Render / Railway)

> ✅ **Recommended:** Use [Render](https://render.com) or [Railway](https://railway.app) — both free tiers available in 2025.

### Deploy on Render

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your GitHub repo
4. Set Build Command: `npm install`
5. Set Start Command: `node src/app.js`
6. Add environment variables in dashboard

### Deploy on Railway

```
npm install -g @railway/cli
railway login
railway init
railway up
```

Set environment variables

```
railway variables set MONGODB_URI=your_uri
railway variables set JWT_SECRET=your_secret
```

---

## Frontend Deployment (Vercel / Netlify)

Build production

```
npm run build
```

Deploy using Vercel

```
vercel --prod
```

or Netlify

```
netlify deploy --prod
```

---

# Security Best Practices

Never commit `.env` files to Git.

Check

```
git status
```

If tracked remove

```
git rm --cached .env
git rm --cached backend/.env
git rm --cached frontend/.env
```

---

# Generate Secure JWT Secret

```
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

# License

This project is licensed under the **MIT License**.

---

# Author

**Mehak Verma**

[![GitHub](https://img.shields.io/badge/GitHub-Mehak--991-181717?logo=github)](https://github.com/Mehak-991)

For support or issues, open a [GitHub Issue](https://github.com/Mehak-991/MeetFlow/issues).
