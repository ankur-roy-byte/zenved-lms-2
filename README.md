# ZenVed LMS — Next.js (Frontend-Only)

A professional Learning Management System for **ZenVed — India's Deep-Tech
Education Platform**, built with Next.js (App Router). All data — logins,
courses, payments, progress, certificates — lives in the browser
(localStorage). **No backend required**, so it deploys anywhere end-to-end.

## Panels
| Panel | What it does |
|---|---|
| **Admin** | Add/remove courses & chapters, upload/download videos, see every student's chapters-learned progress, revenue stats |
| **Instructor** | Manage chapters of their own courses, see paid students' progress |
| **Student** | Sees **only paid courses unlocked**; locked courses show a Buy (simulated payment) flow; chapter video player with progress tracking; **certificate issued only after payment + 100% completion** |

## Demo logins (stored in the frontend)
| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Instructor | `instructor` | `instructor123` |
| Student | `abc` | `abc` |
| Student 2 | `student` | `student123` |

Student `abc` already has: AI & ML (67% done, in progress) and UAV & Drone
Manufacturing (100% done → certificate ready). All other courses are locked
until "purchased".

## Run locally
```bash
npm install
npm run dev        # http://localhost:3000
```

## Deploy end-to-end (Vercel — recommended)
```bash
npm i -g vercel
vercel             # from the project folder, accept defaults
```
Or push the folder to GitHub and click "Import Project" on vercel.com — no
environment variables or database needed. Also works on Netlify or any Node
host (`npm run build && npm start`).

## Notes
- Admin video uploads play for the current browser session (object URLs) and
  their records persist in localStorage — swap in S3/Cloudinary when you add
  a backend.
- Chapter videos use public sample MP4s so playback works out of the box.
- "Reset demo data" button in the Admin panel restores the seed data.
