# ArgantaLab — Complete Build Handoff

## 0. Project Name

**App / Academy Name:** ArgantaLab  
**Playable Product / Game World Name:** Arganta  
**Main File:** `index.html`  
**Project Type:** Single HTML PWA learning app + iframe-based HTML game launcher  
**Primary Learner:** Child / beginner builder  
**Core Tools:** ChatGPT, Codex, GitHub, HTML, CSS, JavaScript  
**Optional Visual Libraries:** GSAP, Three.js, Chart.js, D3.js  

---

## 1. One-Sentence Concept

**ArgantaLab is a responsive PWA learning app where a child builds and plays Arganta, a Roblox-inspired HTML game world, while learning web apps, AI prompting, frontend/backend/database, data analytics, AI agents, GitHub, publishing, and product presentation through cinematic 3D interactive lessons.**

---

## 2. Core Philosophy

ArgantaLab is not a normal coding course.

It is a **build-by-doing product academy**.

The child should:

1. Play the product.
2. Understand how the product works.
3. Improve the product with AI.
4. Analyze the product with data.
5. Publish the product.
6. Present and sell the product to others.

The learning loop is:

```txt
Play → Learn → Build → Debug → Analyze → Publish → Pitch
```

The most important principle:

```txt
The game is the product.
The lessons explain the product.
The presentation sells the product.
```

---

## 3. High-Level Product Structure

ArgantaLab has **5 main navigation groups**.

These must be used on mobile, iPad, and desktop.

```txt
ArgantaLab
│
├── Arganta
│   ├── Game Hub
│   ├── Featured Game
│   ├── Game Grid
│   ├── Game Player iframe
│   └── Profile Preview
│
├── Web Quest
│   ├── Internet Map
│   ├── App Machine
│   ├── Build Map
│   └── System Chain
│
├── AI Forge
│   ├── Prompt Power
│   ├── ChatGPT Brain
│   ├── Codex Builder
│   └── Agent Command
│
├── Data Lab
│   ├── Game Stats
│   ├── Chart Magic
│   ├── Boss Dashboard
│   └── Prediction Bot
│
└── Launch Studio
    ├── Builder Log
    ├── GitHub Trail
    ├── Launch Pad
    ├── Pitch Studio
    └── Demo Stage
```

---

## 4. Navigation Rules

### 4.1 Mobile and iPad Navigation

Use a maximum of **5 bottom navigation items**.

Short labels:

```txt
Arganta | Web | AI | Data | Launch
```

Full tab names:

```txt
Arganta
Web Quest
AI Forge
Data Lab
Launch Studio
```

Bottom navigation style:

```txt
- Fixed bottom dock
- Glassmorphism
- Rounded pill container
- Blur background
- Soft white border
- Inline SVG icons
- Active tab glow
- Large tap targets
- Native-app feeling
```

Recommended icon concepts:

```txt
Arganta = play triangle / gamepad
Web = globe / browser orbit
AI = spark / robot orb
Data = bar chart / dashboard
Launch = rocket / presentation stage
```

Do not use emojis for final icons. Use custom inline SVG.

---

### 4.2 Desktop Navigation

Desktop uses a **left-hand drawer**, not bottom nav.

```txt
┌──────────────────────────────────────────────────────────────┐
│ ArgantaLab                                  Baginda  XP 120   │
├───────────────┬──────────────────────────────┬───────────────┤
│ LEFT DRAWER   │ MAIN SCENE                    │ SIDE PANEL    │
│               │                              │               │
│ Arganta       │ 3D scene / game grid          │ Key idea      │
│ Web Quest     │ lesson / dashboard / pitch    │ Vocabulary    │
│ AI Forge      │                              │ Mission       │
│ Data Lab      │                              │ Notes         │
│ Launch Studio │                              │               │
└───────────────┴──────────────────────────────┴───────────────┘
```

Desktop drawer rules:

```txt
- Always visible at 1920x1080
- Glass panel
- Active tab highlighted
- Main content centered
- Right panel shows explanation, mission, vocabulary, or pitch notes
```

---

## 5. Responsive Requirements

ArgantaLab must work beautifully across:

```txt
- 1920x1080 desktop
- iPad / tablet
- iPhone / mobile
```

### 5.1 Desktop: 1920x1080

Layout:

```txt
┌──────────────────────────────────────────────────────────────┐
│ Top Bar: ArgantaLab logo, title, profile, XP                 │
├───────────────┬──────────────────────────────┬───────────────┤
│ Left Drawer   │ Main Cinematic / Product      │ Side Panel    │
│ 220-280px     │ Flexible center area          │ 300-380px     │
└───────────────┴──────────────────────────────┴───────────────┘
```

Desktop rules:

```txt
- Use 3-column app layout
- Left drawer visible
- Right explanation panel visible
- Main scene should feel cinematic and spacious
- No bottom nav
- Target full HD presentation quality
```

---

### 5.2 iPad / Tablet

Layout:

```txt
┌──────────────────────────────────────┐
│ Top Bar: ArgantaLab                  │
├─────────────────────┬────────────────┤
│ Main content         │ Lesson card    │
│ 3D scene / iframe    │ Key ideas      │
│ dashboard / pitch    │ Mission        │
└─────────────────────┴────────────────┘
│ Bottom glass nav                      │
└──────────────────────────────────────┘
```

iPad rules:

```txt
- Prefer 2-column layout in landscape
- Use bottom nav
- Main cinematic area remains large
- Explanation card sits right or below depending width
```

---

### 5.3 Mobile

Layout:

```txt
┌─────────────────────────────┐
│ ArgantaLab                  │
│ Current module              │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Main cinematic / product    │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Explanation card            │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Arganta Web AI Data Launch  │
└─────────────────────────────┘
```

Mobile rules:

```txt
- Single column
- Bottom glass nav fixed
- Large touch targets
- No tiny text
- Game iframe full-width
- Lesson explanation below scene
- Charts stack vertically
- Avoid horizontal overflow
```

---

## 6. PWA Requirements

`index.html` must be PWA-ready and feel like a native app.

### 6.1 Required Files

```txt
index.html
manifest.webmanifest
sw.js
AppGame_Strike_Zone_3D.html
AppGame_Obby.html
AppGame_Clicker.html
AppGame_Pet_Catcher.html
```

Optional icon folder:

```txt
icons/
  argantalab-icon.svg
  argantalab-icon-192.png
  argantalab-icon-512.png
```

If possible, generate icons from inline SVG.

---

### 6.2 Manifest Metadata

```json
{
  "name": "ArgantaLab",
  "short_name": "ArgantaLab",
  "description": "Build games. Learn systems. Pitch products.",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#05070d",
  "theme_color": "#101827",
  "orientation": "any",
  "icons": [
    {
      "src": "icons/argantalab-icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icons/argantalab-icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

### 6.3 App Icon Concept

The ArgantaLab icon should be premium, simple, and native-app-like.

Icon design:

```txt
- Rounded square
- Deep navy / graphite background
- Glowing glass cube
- Letter A or abstract A-shape
- Small orbit line
- Hidden play triangle
- Cyan-blue glow
- Warm gold accent
```

No emoji.  
No clipart.  
No childish cartoon style.

---

## 7. Visual Design Standard

ArgantaLab must feel:

```txt
Apple keynote
+
Roblox creator world
+
Science museum exhibit
+
Cinematic AI lab
+
Native mobile app
```

### 7.1 Style

```txt
- Dark premium base
- Glassmorphism cards
- Soft neon accents
- Rounded corners
- 3D hero objects
- Smooth GSAP transitions
- Three.js cinematic scenes
- Animated charts
- Native app polish
```

### 7.2 Color Palette

```txt
Deep space navy: #05070d
Graphite black: #101216
Panel glass: rgba(255,255,255,0.08)
Cyan glow: #67e8f9
Royal blue: #3b82f6
Warm gold: #f5c76b
Soft white: #f8fafc
Muted slate: #94a3b8
```

### 7.3 Typography

Use system fonts:

```css
font-family:
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

No external fonts required.

---

## 8. Motion Design Standard

Use GSAP for cinematic transitions.

Use Three.js for 3D lesson objects.

Motion language:

```txt
- Floating glass cards
- Slow rotating 3D objects
- Smooth tab transitions
- Particle trails
- Soft camera moves
- Animated lesson step reveals
- Badge unlock pop
- Chart reveal animations
- Presentation stage spotlight
```

Avoid:

```txt
- Chaotic animation
- Too many colors
- Excessive flashing
- Hard-to-read text
```

---

## 9. Technical Architecture

### 9.1 Simple File Structure

```txt
ArgantaLab/
│
├── index.html
├── manifest.webmanifest
├── sw.js
│
├── AppGame_Strike_Zone_3D.html
├── AppGame_Obby.html
├── AppGame_Clicker.html
├── AppGame_Pet_Catcher.html
│
└── icons/
    ├── argantalab-icon.svg
    ├── argantalab-icon-192.png
    └── argantalab-icon-512.png
```

### 9.2 Master App Behavior

`index.html` is the main app shell.

It should:

```txt
- Show the ArgantaLab UI
- Show 5 main tabs
- Open Arganta games in iframe
- Store learner progress in localStorage
- Show cinematic lesson modules
- Show analytics dashboard
- Show presentation / pitch studio
- Work as PWA
```

### 9.3 Game Loading Rule

Each game is a separate HTML file in the same folder.

Example:

```txt
AppGame_Strike_Zone_3D.html
AppGame_Obby.html
AppGame_Clicker.html
```

Arganta opens games using:

```html
<iframe src="AppGame_Strike_Zone_3D.html"></iframe>
```

The first build can use a simple hardcoded list inside `index.html`.

Example:

```js
const GAME_FILES = [
  "AppGame_Strike_Zone_3D.html",
  "AppGame_Obby.html",
  "AppGame_Clicker.html",
  "AppGame_Pet_Catcher.html"
];
```

The display name should be generated from the filename.

Example:

```txt
AppGame_Strike_Zone_3D.html → Strike Zone 3D
AppGame_Pet_Catcher.html → Pet Catcher
```

---

## 10. Tab 1 — Arganta

### 10.1 Purpose

Arganta is the actual playable product.

It is a Roblox-inspired HTML game world where each game is a single HTML file.

### 10.2 Content

```txt
- Game hub
- Featured game
- Game grid
- Game player iframe
- XP preview
- Badge preview
- Avatar/profile card
```

### 10.3 First Game

First game:

```txt
Strike Zone 3D
File: AppGame_Strike_Zone_3D.html
```

It should be treated as the first major product artifact.

### 10.4 Arganta Wireframe

```txt
┌─────────────────────────────────────────────┐
│ ARGANTA                                     │
│ Your HTML Game World                        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Hi Baginda 👋                               │
│ Level 1: Game Builder                       │
│ XP: 120                                     │
│ Games Built: 1                              │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ FEATURED EXPERIENCE                         │
│                                             │
│ Strike Zone 3D                              │
│ First product built with AI + HTML          │
│                                             │
│ [Play] [How It Works]                       │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ ALL WORLDS                                  │
│                                             │
│ [Strike Zone 3D] [Obby]                     │
│ [Clicker]        [Pet Catcher]              │
└─────────────────────────────────────────────┘
```

### 10.5 Game Player Wireframe

```txt
┌─────────────────────────────────────────────┐
│ ← Back to Arganta                           │
│ Now Playing: Strike Zone 3D                 │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│                                             │
│               GAME IFRAME                   │
│                                             │
│       AppGame_Strike_Zone_3D.html           │
│                                             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ How this works                              │
│ index.html opened another HTML file using   │
│ an iframe.                                  │
└─────────────────────────────────────────────┘
```

---

## 11. Tab 2 — Web Quest

### 11.1 Purpose

Teach the foundations of the web and how ArgantaLab works.

### 11.2 Submodules

```txt
1. Internet Map
2. App Machine
3. Build Map
4. System Chain
```

---

### 11.3 Internet Map

Teaches:

```txt
Web
Website
Web app
Browser
URL
Domain
Hosting
HTML file
```

Cinematic scene:

```txt
A glowing browser window floats in 3D space.
Website files fly into the browser.
A domain sign appears.
A hosting island appears under the website.
```

Kid explanation:

```txt
Website = a house
Domain = the address
Hosting = the land
Browser = the car that takes you there
```

---

### 11.4 App Machine

Teaches:

```txt
Frontend
Backend
Database
API
localStorage
Game state
```

Cinematic scene:

```txt
A 3D arcade machine appears.
The screen is labeled Frontend.
The hidden engine is labeled Backend.
A glowing vault is labeled Database.
A messenger robot is labeled API.
```

Simple explanation:

```txt
Frontend = what users see
Backend = hidden helper
Database = memory
API = messenger
```

Arganta example:

```txt
Player clicks Play
↓
index.html changes iframe source
↓
Game HTML opens
↓
User plays the game
```

Strike Zone example:

```txt
Player wins
↓
Coins increase
↓
Browser saves coins
↓
Shop can read saved coins
```

---

### 11.5 Build Map

Teaches:

```txt
Architecture
Components
Files
iframe
Data flow
App shell
```

Cinematic scene:

```txt
index.html appears in the center.
Game files orbit around it.
Lessons orbit around it.
iframe beam connects index.html to AppGame files.
```

Simple architecture:

```txt
index.html
├── Arganta
├── Web Quest
├── AI Forge
├── Data Lab
├── Launch Studio
└── iframe
    └── AppGame_*.html
```

---

### 11.6 System Chain

Teaches:

```txt
Input
Process
Output
State
Feedback loop
Cause and effect
```

Example:

```txt
Click Play
↓
JavaScript changes iframe source
↓
Game opens
↓
Player sees game
```

Another example:

```txt
Finish lesson
↓
XP increases
↓
Badge unlocks
↓
Profile updates
```

---

## 12. Tab 3 — AI Forge

### 12.1 Purpose

Teach the child how to speak with AI and how AI tools help build products.

### 12.2 Submodules

```txt
1. Prompt Power
2. ChatGPT Brain
3. Codex Builder
4. Agent Command
```

---

### 12.3 Prompt Power

Teaches:

```txt
Prompt engineering
Requirements
Design first
Build later
Iteration
Bug reports
```

Cinematic scene:

```txt
A bad prompt explodes into messy blocks.
A structured prompt becomes a clean 3D blueprint.
```

Prompt formula:

```txt
1. What are we building?
2. Who is it for?
3. What is the goal?
4. What are the rules?
5. What are the controls?
6. What should it look like?
7. What format?
8. Design first or build now?
```

Example bad prompt:

```txt
make a random game that is fun
```

Example better prompt:

```txt
Create a 3D arena game for age 8-14.
The player uses keyboard and mouse.
Add score, health, coins, and weapon skins.
Single HTML file.
Design first.
```

---

### 12.4 ChatGPT Brain

Teaches:

```txt
ChatGPT as idea partner
Explainer
Designer
Reviewer
Prompt helper
```

Key message:

```txt
ChatGPT helps you think, but you are still the director.
```

---

### 12.5 Codex Builder

Teaches:

```txt
Codex as coding teammate
File editing
Bug fixing
Code review
Explanation of changes
```

Good Codex prompt example:

```txt
In AppGame_Strike_Zone_3D.html, fix the movement bug.

Expected:
A moves left and D moves right.

Actual:
Left and right feel swapped.

Only change the movement control logic.
Do not redesign the whole game.
Explain what changed.
```

---

### 12.6 Agent Command

Teaches:

```txt
AI
LLM
Tool
Memory
Goal
Agent
Workflow
```

Simple explanation:

```txt
LLM = understands language
Tool = something AI can use
Memory = what it remembers
Goal = what it tries to finish
Agent = LLM + tools + memory + goal
```

Example agent workflow:

```txt
Goal: Improve Arganta
1. Read current game files
2. Find problems
3. Suggest fixes
4. Write better prompt
5. Explain changes
```

---

## 13. Tab 4 — Data Lab

### 13.1 Purpose

Teach statistics, analytics, business intelligence, data science, and basic machine learning using game data.

### 13.2 Submodules

```txt
1. Game Stats
2. Chart Magic
3. Boss Dashboard
4. Prediction Bot
```

---

### 13.3 Game Stats

Use sample game data first.

Example data:

```txt
Matches played
Wins
Losses
Coins earned
Win streak
Best weapon
Damage dealt
Headshots
Deaths
Time played
Favorite game
```

Statistics concepts:

```txt
Count = how many
Average = normal value
Maximum = best value
Minimum = lowest value
Percentage = part of total
Trend = going up or down
```

---

### 13.4 Chart Magic

Use:

```txt
Chart.js for standard charts
D3.js for one special wow visual
```

Chart types:

```txt
Line chart = coins over time
Bar chart = score by weapon
Pie chart = weapon usage
Scatter chart = accuracy vs win chance
Heatmap = activity by day
```

---

### 13.5 Boss Dashboard

Teaches business intelligence.

Dashboard wireframe:

```txt
┌─────────────────────────────────────────────┐
│ DATA LAB                                    │
│ Game Analytics Dashboard                    │
└─────────────────────────────────────────────┘

┌────────────┬────────────┬────────────┬──────┐
│ Matches    │ Win Rate   │ Coins      │ XP   │
│ 12         │ 67%        │ 620        │ 240  │
└────────────┴────────────┴────────────┴──────┘

┌─────────────────────────────────────────────┐
│ Coins Over Time                             │
│ [Animated line chart]                       │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Weapon Performance                          │
│ [Bar chart: Rifle / Pistol / Marksman]      │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Insight                                     │
│ You win more often with the Marksman.       │
└─────────────────────────────────────────────┘
```

Business intelligence explanation:

```txt
BI is a dashboard that helps product owners make decisions.
```

---

### 13.6 Prediction Bot

Teaches basic data science and machine learning.

Simple rule-based prediction first:

```txt
Win chance =
accuracy score
+ streak bonus
+ low death bonus
+ weapon bonus
```

Kid explanation:

```txt
Data science means using data to find patterns.
Machine learning means the computer learns patterns from examples.
```

Do not build complex ML in v1.  
Use a fun “Prediction Bot” simulator.

---

## 14. Tab 5 — Launch Studio

### 14.1 Purpose

Teach product presentation, selling, GitHub, publishing, PWA, domain, and reflection.

### 14.2 Submodules

```txt
1. Builder Log
2. GitHub Trail
3. Launch Pad
4. Pitch Studio
5. Demo Stage
```

---

### 14.3 Builder Log

Shows:

```txt
XP
Badges
Games built
Lessons completed
Bugs fixed
Prompt history
```

Reflection questions:

```txt
What did I build?
What did I learn?
What broke?
How did I fix it?
What should I improve next?
```

---

### 14.4 GitHub Trail

Teaches:

```txt
Repository
Commit
Branch
README
Version history
```

Simple explanation:

```txt
GitHub is like Google Drive for code, but every save has a story.
A commit is a save point.
```

---

### 14.5 Launch Pad

Teaches:

```txt
Deploy
Hosting
GitHub Pages
Domain
PWA
DevOps
```

Simple explanation:

```txt
Deploy means publish to the web.
Hosting is where the app lives.
Domain is the app address.
PWA means the website can feel like an installed app.
```

---

### 14.6 Pitch Studio

Teaches how to explain and sell the product.

Pitch formula:

```txt
1. Hello
2. Product name
3. Who it is for
4. What it does
5. Why it is fun or useful
6. Demo the product
7. Explain how I built it
8. Show what I learned
9. Ask for feedback
```

Example pitch script:

```txt
Hi, my name is Baginda.

Today I want to show you Arganta.

Arganta is my HTML game world where I can play games that I build myself.

The first game is Strike Zone 3D. It has health, weapons, coins, and a shop.

I built it by learning how to speak with AI, how to improve prompts, and how to fix bugs.

The cool thing is that Arganta is not only a game hub. It also teaches how websites, databases, AI, and data dashboards work.

Next, I want to add more games, better mobile controls, and a leaderboard.

Please try it and tell me what I should improve.
```

---

### 14.7 Demo Stage

Presentation module with cinematic slide-like experience.

Demo Stage wireframe:

```txt
┌─────────────────────────────────────────────┐
│ DEMO STAGE                                  │
│ Practice your product presentation          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ SLIDE 1: Product Name                       │
│ Arganta                                     │
│ Your HTML Game World                        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ SLIDE 2: What It Does                       │
│ Arganta opens HTML games in one hub.        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ SLIDE 3: Live Demo                          │
│ [Open Strike Zone 3D]                       │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ SLIDE 4: What I Learned                     │
│ Web, AI, data, GitHub, product thinking     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ SLIDE 5: What Comes Next                    │
│ More games, leaderboard, mobile controls    │
└─────────────────────────────────────────────┘
```

Cinematic theme:

```txt
A 3D stage appears.
Spotlight turns on.
Arganta logo rises from the floor.
Game cards float behind the presenter.
Charts appear as holograms.
Demo screen opens like a portal.
Final slide launches a small rocket.
```

---

## 15. Learning Progression

Recommended learning flow:

```txt
1. Open ArgantaLab
2. Enter Arganta
3. Play Strike Zone 3D
4. Learn what a web app is
5. Learn frontend/backend/database
6. Learn how to speak with AI
7. Learn architecture and system thinking
8. Learn how game data becomes charts
9. Learn what AI agents are
10. Prepare a product pitch
11. Present Arganta to family
12. Improve based on feedback
```

---

## 16. Required LocalStorage State

Use localStorage for first build.

Suggested state:

```js
const defaultState = {
  learnerName: "Baginda",
  xp: 0,
  level: 1,
  badges: [],
  completedLessons: [],
  gamesPlayed: [],
  gamesBuilt: 1,
  bugsFixed: 0,
  lastTab: "arganta",
  pitchCompleted: false
};
```

Save key:

```txt
argantalab_state_v1
```

---

## 17. Lesson Completion Rules

Each submodule should have:

```txt
- Watch cinematic
- Read simple explanation
- Try mini mission
- Mark complete
- Earn XP
- Unlock badge
```

Example:

```txt
Complete Prompt Power
↓
+40 XP
Badge unlocked: Prompt Rookie
```

Badge examples:

```txt
Web Explorer
App Machine Rookie
Prompt Rookie
Codex Builder
Data Detective
Chart Wizard
Agent Commander
GitHub Pilot
Launch Rookie
Pitch Hero
```

---

## 18. MVP Build Scope

The first build should include:

```txt
- Single index.html app shell
- PWA manifest and service worker
- Arganta tab
- Game cards
- iframe game player
- 5 main tabs
- Web Quest cinematic placeholder
- AI Forge cinematic placeholder
- Data Lab dashboard placeholder
- Launch Studio pitch placeholder
- responsive desktop/iPad/mobile layouts
- localStorage progress
- inline SVG ArgantaLab logo/icon
```

Do not overbuild the first version.

Use placeholder cinematic scenes if necessary, but make them polished:

```txt
- 3D floating cube for ArgantaLab identity
- 3D browser for Web Quest
- AI orb for AI Forge
- chart dashboard for Data Lab
- presentation stage for Launch Studio
```

---

## 19. Recommended Libraries

Use CDN for first build unless fully offline is required.

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
```

Usage:

```txt
GSAP = transitions and cinematic scenes
Three.js = 3D hero objects
Chart.js = normal dashboard charts
D3.js = one special visual such as data flow or heatmap
```

If CDN is not allowed, build graceful fallback using CSS-only visuals.

---

## 20. Main Components

```txt
AppShell
TopBar
ResponsiveNav
DesktopDrawer
BottomGlassDock
ArgantaHome
GameGrid
GameCard
GamePlayer
LessonShell
CinematicScene
ExplanationCard
MissionChecklist
ProgressStore
DataDashboard
PredictionBot
PitchStudio
DemoStage
PWAInstallHint
ToastSystem
BadgeUnlockModal
```

---

## 21. Text Wireframe — Mobile

```txt
┌─────────────────────────────┐
│ ArgantaLab                  │
│ Build. Learn. Pitch.        │
└─────────────────────────────┘

┌─────────────────────────────┐
│ ARGANTA                     │
│ Your HTML Game World        │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Featured Experience         │
│ Strike Zone 3D              │
│ [Play] [How It Works]       │
└─────────────────────────────┘

┌─────────────────────────────┐
│ All Worlds                  │
│ [Strike] [Obby]             │
│ [Clicker] [Pet]             │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Bottom Glass Dock           │
│ Arganta Web AI Data Launch  │
└─────────────────────────────┘
```

---

## 22. Text Wireframe — iPad

```txt
┌──────────────────────────────────────┐
│ ArgantaLab              Baginda XP   │
└──────────────────────────────────────┘

┌─────────────────────┬────────────────┐
│ Main content         │ Lesson card    │
│ Arganta game grid    │ Key idea       │
│ or cinematic scene   │ Mini mission   │
└─────────────────────┴────────────────┘

┌──────────────────────────────────────┐
│ Arganta | Web | AI | Data | Launch   │
└──────────────────────────────────────┘
```

---

## 23. Text Wireframe — Desktop 1920x1080

```txt
┌──────────────────────────────────────────────────────────────┐
│ ArgantaLab                                Baginda  XP 120     │
├───────────────┬──────────────────────────────┬───────────────┤
│ LEFT DRAWER   │ MAIN SCENE                    │ SIDE PANEL    │
│               │                              │               │
│ Arganta       │ Arganta game grid / iframe    │ Key idea      │
│ Web Quest     │ 3D lesson scene               │ Vocabulary    │
│ AI Forge      │ AI cinematic scene            │ Mission       │
│ Data Lab      │ Dashboard                     │ Notes         │
│ Launch Studio │ Pitch stage                   │ Speaker tips  │
└───────────────┴──────────────────────────────┴───────────────┘
```

---

## 24. Acceptance Criteria

The build is successful when:

```txt
- index.html opens without build tools
- App is responsive on desktop, iPad, and mobile
- Mobile/iPad use bottom glass nav
- Desktop uses left drawer
- Arganta tab shows game cards
- Clicking Play loads AppGame_*.html in iframe
- Web Quest explains web/frontend/backend/database
- AI Forge explains ChatGPT/Codex/prompts/agents
- Data Lab shows charts and prediction concept
- Launch Studio teaches pitching and publishing
- PWA manifest exists
- Service worker exists
- App can be added to home screen where supported
- Progress saves in localStorage
- Visual design is cinematic, premium, and engaging
```

---

## 25. Non-Goals for First Build

Do not build these in v1:

```txt
- Real multiplayer
- Real login
- Real backend
- Real database server
- Payment system
- Complex machine learning
- Real AI agent execution
- Full game editor
- Too many games
```

These are later upgrades.

---

## 26. Future Upgrade Path

```txt
V1: Single HTML PWA hub + iframe games + cinematic lessons
V2: GitHub Action auto game registry
V3: Real backend with Supabase/Firebase
V4: User login and cloud progress
V5: Shared leaderboards
V6: Real analytics from played games
V7: AI-assisted game creator
V8: Parent dashboard
V9: Publish to app stores using wrapper technology
```

---

## 27. Final Product Statement

**ArgantaLab is a cinematic PWA learning app where a child builds Arganta, a Roblox-inspired HTML game world, while learning how to code, use AI, understand web systems, analyze data, publish with GitHub, and present the product like a young founder.**

