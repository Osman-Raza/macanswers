# MacAnswers
 
A campus intelligence platform built for McMaster University students. The goal is simple: improve student life by putting everything you need in one place — no more digging through dozens of poorly organized university pages, no more missed snow days, no more Reddit posts asking questions that are technically answered somewhere but impossible to find.

## Demo

https://github.com/user-attachments/assets/5c384e08-0eb8-4b95-b84e-3687a72aca4a
 
## Features
 
### Ask Anything
An AI-powered chat interface that answers any McMaster-related question in plain English and responds with a direct answer and a link to the exact source page it came from. The knowledge base is built from McMaster's own pages — tuition by program, course selection dates, OSAP and financial aid, dental plan opt-outs, housing deadlines, academic calendar dates, and more. Time-sensitive pages like snow day alerts and announcements are scraped every hour so the information is always current. If the system isn't confident in an answer, it tells you and links you directly to the source instead of guessing.
 
### Campus Issue Tracker
An interactive map of McMaster's campus where students can report problems — broken outlets, malfunctioning printers, accessibility issues, HVAC problems, safety concerns, and more — by dropping a pin at the exact location. Issues are color coded by category and sized by upvote count so the most urgent problems are visually obvious at a glance. Students can upvote issues they've also encountered, which helps prioritize what gets fixed first. Every Monday, an automated email digest sends the top open issues to the relevant McMaster departments. Resolved issues fade from the map automatically.
 
### Transit Lookup
Real-time HSR bus schedules pulled directly from the public GTFS data feed, plus the McMaster shuttle schedule. Students can look up any route by number and see the next departures with a live countdown in minutes — all without leaving the app or navigating a separate transit app.
 
## Tech Stack
 
- **Frontend** — React + Vite, Mapbox
- **Backend** — Node.js + Express
- **Database** — Supabase (PostgreSQL + pgvector)
- **AI** — Gemini API (embeddings + generation)
- **Scrapers** — Python + BeautifulSoup
- **Automation** — GitHub Actions
## Setup
 
1. Clone the repo
2. Create a Supabase project and run `database/migrations.sql` in the SQL editor
3. Get API keys for Gemini and Mapbox
4. Copy `.env.example` to `.env` in `backend/`, `frontend/`, and `scraper/` and fill in your keys
5. Run the backend: `cd backend && npm install && npm run dev`
6. Run the frontend: `cd frontend && npm install && npm run dev`
7. Run the scrapers: `cd scraper && pip install -r requirements.txt && python run_all.py 
