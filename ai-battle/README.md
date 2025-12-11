# AI Battle Royale

A real-time startup battle voting platform built with Next.js and Firebase. Perfect for events where startups compete head-to-head with live voting from judges and audience members.

## Features

- **Admin Panel** - Secure login, manage matches, upload startups via Excel, generate QR codes, control voting, adjust weights
- **User Panel** - Judges and audience vote via QR codes (no login required)
- **Display Panel** - TV-ready screen showing live voting progress, countdown timer, and winner announcements
- **Real-time Updates** - All data synced instantly via Firebase Realtime Database
- **Weighted Voting** - Configurable weight between judge and audience votes

## Setup

### 1. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable **Authentication** (Email/Password provider)
4. Enable **Realtime Database**
5. Set database rules (see below)
6. Get your config from Project Settings > General > Your apps > Web app

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your Firebase credentials:

```bash
cp .env.example .env.local
```

Required variables:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. Firebase Database Rules

In Firebase Console > Realtime Database > Rules, set:

```json
{
  "rules": {
    "startups": {
      ".read": true,
      ".write": "auth != null"
    },
    "matches": {
      ".read": true,
      ".write": true
    },
    "votes": {
      ".read": true,
      ".write": true
    },
    "activeMatch": {
      ".read": true,
      ".write": "auth != null"
    },
    "settings": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

### 4. Create Admin User

In Firebase Console > Authentication > Users, add a user with email/password. This will be your admin login.

### 5. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

### Admin Panel (`/admin`)
1. Login with your Firebase admin credentials
2. Upload an Excel file with startup names (column: `name` or `Name`)
3. Create matches by selecting two startups
4. Set voting duration and judge/audience weight
5. Click "QR Codes" to get voting links for judges and audience
6. Click "Start" to begin voting
7. Click "Set Active" to display match on TV screen

### Display Panel (`/display`)
- Open on a TV/projector screen
- Shows live voting progress, countdown, and results
- Updates automatically based on active match

### Voting (`/vote/[code]`)
- Judges and audience scan their respective QR codes
- Vote for their preferred startup
- See confirmation and results

## Excel Format

Your Excel file should have at minimum a `name` column:

| name | description |
|------|-------------|
| Startup A | Optional description |
| Startup B | Optional description |

## Deploy to Vercel

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel project settings
4. Deploy

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, TailwindCSS
- **Backend**: Firebase Realtime Database
- **Auth**: Firebase Authentication
- **Icons**: Lucide React
- **QR Codes**: qrcode.react
- **Excel Parsing**: xlsx
