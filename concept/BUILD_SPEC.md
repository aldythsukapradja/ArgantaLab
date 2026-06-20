# ArgantaLab: Complete Build Specification

**Status:** Concept → Development Ready  
**Tech Stack:** React 18 + TypeScript + Supabase + Vercel  
**Start Date:** 2025-06-20  
**Target Launch:** Q3 2025

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Supabase Schema](#supabase-schema)
4. [Component Specification](#component-specification)
5. [Build Phases](#build-phases)
6. [Deployment Pipeline](#deployment-pipeline)
7. [API & Integration Points](#api--integration-points)
8. [Development Guidelines](#development-guidelines)

---

## Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    ARGANTALAB (React)                       │
├─────────────────────────────────────────────────────────────┤
│
│  ┌──────────────────────────────────────────────────────┐
│  │         Frontend Layer (React Components)            │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  │  Arganta    │ │   Learn     │ │   Studio    │   │
│  │  │  (Games)    │ │ (Carousel)  │ │  (Builder)  │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  │   Launch    │ │   Pitch     │ │ Demo Stage  │   │
│  │  │   Studio    │ │   Studio    │ │  Builder    │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │
│  └──────────────────────────────────────────────────────┘
│                          ↓
│  ┌──────────────────────────────────────────────────────┐
│  │    Presentation Engine (Universal)                  │
│  │  ┌────────────────────────────────────────────────┐ │
│  │  │ <PresentationEngine>                           │ │
│  │  │  - Slide rendering                            │ │
│  │  │  - 3D scene management (Three.js)             │ │
│  │  │  - Exercise evaluation                        │ │
│  │  │  - Progress tracking                          │ │
│  │  │  - State management (Redux or Zustand)       │ │
│  │  └────────────────────────────────────────────────┘ │
│  └──────────────────────────────────────────────────────┘
│                          ↓
│  ┌──────────────────────────────────────────────────────┐
│  │       Supabase Client (Real-time Sync)              │
│  │  - Authentication (OAuth + Email)                  │
│  │  - Database queries (TypeScript client)            │
│  │  - File storage (images, videos, game files)       │
│  │  - Real-time subscriptions (leaderboards)          │
│  └──────────────────────────────────────────────────────┘
│                          ↓
│  ┌──────────────────────────────────────────────────────┐
│  │  Supabase Backend (PostgreSQL + Functions)          │
│  │  - 11 tables + row-level security                   │
│  │  - Real-time triggers                              │
│  │  - Edge functions for Claude API calls              │
│  └──────────────────────────────────────────────────────┘
│
└─────────────────────────────────────────────────────────────┘
```

### Core Principles

- **Single Presentation Engine** — One component powers lessons, demos, studio
- **Data-Driven** — All content as JSON, no hardcoded strings
- **Real-time Sync** — Supabase subscriptions for multiplayer (later phase)
- **Type-Safe** — TypeScript throughout, Supabase types auto-generated
- **Modular** — Each feature (Learn, Studio, Pitch) is independent feature module
- **Offline-Ready** — PWA with service worker, sync on reconnect

---

## Project Structure

### GitHub Repo: `arganthsukapradja/ArgantaLab`

```
arganta-lab/
│
├─ package.json                    # Monorepo root (pnpm workspaces)
├─ pnpm-workspace.yaml
├─ turbo.json                      # Turbo build orchestration
├─ vercel.json                     # Vercel deployment config
│
├─ apps/
│   └─ web/                        # Main React app
│       ├─ src/
│       │   ├─ pages/              # Route pages
│       │   │   ├─ index.tsx       # Landing (Arganta home)
│       │   │   ├─ learn/[tab].tsx # Learn carousel
│       │   │   ├─ studio/index.tsx # Studio builder
│       │   │   ├─ pitch/index.tsx # Pitch studio
│       │   │   └─ admin/          # Admin panel (future)
│       │   │
│       │   ├─ components/         # Shared components
│       │   │   ├─ layout/
│       │   │   │   ├─ TopBar.tsx
│       │   │   │   ├─ Sidebar.tsx
│       │   │   │   └─ Dock.tsx    # Mobile nav
│       │   │   │
│       │   │   ├─ presentation/   # Presentation engine
│       │   │   │   ├─ PresentationEngine.tsx
│       │   │   │   ├─ SlideRenderer.tsx
│       │   │   │   ├─ SceneRenderer.tsx (Three.js)
│       │   │   │   ├─ ExerciseLayer.tsx
│       │   │   │   └─ ProgressTracker.tsx
│       │   │   │
│       │   │   ├─ 3d/
│       │   │   │   ├─ SceneFactory.tsx
│       │   │   │   ├─ CameraAnimator.tsx
│       │   │   │   └─ ModelLoader.tsx
│       │   │   │
│       │   │   ├─ exercises/
│       │   │   │   ├─ InputExercise.tsx
│       │   │   │   ├─ MatchExercise.tsx
│       │   │   │   ├─ DragExercise.tsx
│       │   │   │   ├─ SliderExercise.tsx
│       │   │   │   └─ LiveRenderExercise.tsx
│       │   │   │
│       │   │   ├─ builder/
│       │   │   │   ├─ PresentationBuilder.tsx
│       │   │   │   ├─ SlideListPanel.tsx
│       │   │   │   ├─ EditorPanel.tsx
│       │   │   │   ├─ PreviewPane.tsx
│       │   │   │   └─ VisualEditor.tsx
│       │   │   │
│       │   │   ├─ studio/
│       │   │   │   ├─ GameCanvas.tsx
│       │   │   │   ├─ GamePreview.tsx
│       │   │   │   ├─ CodePanel.tsx
│       │   │   │   ├─ ChatPanel.tsx
│       │   │   │   └─ ComponentLibrary.tsx
│       │   │   │
│       │   │   ├─ games/
│       │   │   │   ├─ GameCard.tsx
│       │   │   │   ├─ GameGrid.tsx
│       │   │   │   └─ GameModal.tsx
│       │   │   │
│       │   │   └─ common/
│       │   │       ├─ Button.tsx
│       │   │       ├─ Card.tsx
│       │   │       ├─ Modal.tsx
│       │   │       └─ Input.tsx
│       │   │
│       │   ├─ hooks/
│       │   │   ├─ useLesson.ts      # Lesson state
│       │   │   ├─ usePresentation.ts # Builder state
│       │   │   ├─ useStudio.ts      # Studio state
│       │   │   ├─ useUser.ts        # Auth + profile
│       │   │   └─ useScene.ts       # 3D scene lifecycle
│       │   │
│       │   ├─ lib/
│       │   │   ├─ supabase.ts       # Client config
│       │   │   ├─ presentation/     # Presentation logic
│       │   │   │   ├─ schema.ts     # TypeScript types
│       │   │   │   ├─ registry.ts   # Scene/exercise registry
│       │   │   │   └─ validator.ts  # JSON validation
│       │   │   ├─ three/            # Three.js utilities
│       │   │   │   ├─ sceneLibrary.ts
│       │   │   │   ├─ cameraPath.ts
│       │   │   │   └─ loader.ts
│       │   │   ├─ api/              # API calls
│       │   │   │   ├─ lessons.ts
│       │   │   │   ├─ presentations.ts
│       │   │   │   ├─ games.ts
│       │   │   │   ├─ chat.ts       # Claude API
│       │   │   │   └─ user.ts
│       │   │   └─ utils/
│       │   │       ├─ analytics.ts
│       │   │       ├─ storage.ts
│       │   │       └─ validation.ts
│       │   │
│       │   ├─ data/
│       │   │   ├─ lessons/
│       │   │   │   ├─ web-quest.json        (Lesson data)
│       │   │   │   ├─ ai-forge.json
│       │   │   │   ├─ data-lab.json
│       │   │   │   └─ launch-studio.json
│       │   │   ├─ scenes/
│       │   │   │   └─ sceneConfig.json     (3D scene definitions)
│       │   │   └─ exercises/
│       │   │       └─ exerciseRegistry.json (Exercise types)
│       │   │
│       │   ├─ context/
│       │   │   ├─ AuthContext.tsx
│       │   │   ├─ ThemeContext.tsx
│       │   │   └─ AppContext.tsx
│       │   │
│       │   ├─ store/              # State management (Zustand)
│       │   │   ├─ userStore.ts
│       │   │   ├─ lessonStore.ts
│       │   │   ├─ studioStore.ts
│       │   │   └─ uiStore.ts
│       │   │
│       │   ├─ styles/
│       │   │   ├─ globals.css     # Global + CSS variables
│       │   │   ├─ theme.css
│       │   │   └─ animations.css
│       │   │
│       │   ├─ App.tsx            # Root component
│       │   ├─ main.tsx           # Entry point
│       │   └─ vite-env.d.ts
│       │
│       ├─ public/
│       │   ├─ assets/
│       │   │   ├─ 3d-models/     # .glb files
│       │   │   │   ├─ city.glb
│       │   │   │   ├─ house.glb
│       │   │   │   └─ ...
│       │   │   ├─ icons/
│       │   │   │   └─ *.svg
│       │   │   └─ sounds/
│       │   │       └─ *.mp3
│       │   └─ sw.js              # Service worker
│       │
│       ├─ .env.local             # (gitignored)
│       ├─ .env.example
│       ├─ package.json
│       ├─ tsconfig.json
│       ├─ vite.config.ts
│       └─ vitest.config.ts       # Unit tests
│
├─ packages/
│   ├─ presentation-engine/       # Shared library (NPM pkg)
│   │   ├─ src/
│   │   │   ├─ types.ts           # Presentation schema
│   │   │   ├─ components/
│   │   │   ├─ hooks/
│   │   │   └─ utils/
│   │   ├─ package.json
│   │   └─ tsconfig.json
│   │
│   └─ ui-library/               # Shared UI components (future)
│       └─ src/
│
├─ supabase/
│   ├─ migrations/               # Database migrations
│   │   ├─ 001_init.sql
│   │   ├─ 002_lessons.sql
│   │   └─ ...
│   ├─ functions/
│   │   ├─ chat-with-claude/
│   │   │   └─ index.ts          # Edge function
│   │   └─ generate-game/
│   │       └─ index.ts
│   └─ seed.sql                  # Initial data
│
├─ docs/
│   ├─ API.md
│   ├─ ARCHITECTURE.md
│   ├─ DEPLOYMENT.md
│   └─ CONTRIBUTING.md
│
├─ .github/
│   └─ workflows/
│       ├─ test.yml              # Run tests on PR
│       ├─ lint.yml              # ESLint + TypeScript check
│       └─ deploy.yml            # Deploy to Vercel on main
│
├─ .gitignore
├─ README.md
└─ BUILD_SPEC.md                 # This file
```

### Key Directories Explained

| Directory | Purpose |
|-----------|---------|
| `apps/web` | Main React application |
| `packages/presentation-engine` | Reusable library for all lesson/demo/studio rendering |
| `supabase/` | Database migrations, functions, seed data |
| `docs/` | Architecture, API, deployment docs |
| `.github/workflows/` | CI/CD pipelines |

---

## Supabase Schema

### 11 Core Tables

#### **1. users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR NOT NULL UNIQUE,
  name VARCHAR,
  avatar_url TEXT,
  theme 'light'|'dark' DEFAULT 'light',
  level INT DEFAULT 1,
  total_xp INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  last_login TIMESTAMP
);
```

#### **2. lessons** (static content)
```sql
CREATE TABLE lessons (
  id VARCHAR PRIMARY KEY,  -- 'web/internet-map'
  tab 'web'|'ai'|'data'|'launch',
  num VARCHAR,             -- '01', '02', etc.
  title VARCHAR NOT NULL,
  blurb TEXT,
  keyline TEXT,
  content JSONB,           -- Full lesson JSON (5-6 slides)
  xp_reward INT DEFAULT 40,
  unlock_next VARCHAR REFERENCES lessons(id),
  prerequisites VARCHAR[] DEFAULT '{}',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### **3. user_progress**
```sql
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id VARCHAR NOT NULL REFERENCES lessons(id),
  status 'started'|'in_progress'|'completed' DEFAULT 'started',
  current_slide INT DEFAULT 0,
  exercises_done JSONB DEFAULT '{}',  -- {slide_0: true, slide_1: false, ...}
  xp_earned INT DEFAULT 0,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);
```

#### **4. badges**
```sql
CREATE TABLE badges (
  id VARCHAR PRIMARY KEY,  -- 'web_explorer', 'prompt_master', etc.
  name VARCHAR NOT NULL,
  description TEXT,
  icon_url TEXT,
  requirement_type 'lessons'|'games'|'xp_threshold',
  requirement_value JSONB,  -- {lessons: ['web/...', 'web/...', ...]}
  created_at TIMESTAMP
);
```

#### **5. user_badges** (junction)
```sql
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id VARCHAR NOT NULL REFERENCES badges(id),
  earned_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, badge_id)
);
```

#### **6. games**
```sql
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  description TEXT,
  game_type 'tetris'|'invader'|'custom',
  base_template VARCHAR,   -- 'tetris', 'space_invaders', 'blank'
  code JSONB,              -- {html: "...", css: "...", js: "..."}
  thumbnail_url TEXT,
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  plays_count INT DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

#### **7. game_versions**
```sql
CREATE TABLE game_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  version_num INT,
  code JSONB,              -- snapshot of {html, css, js}
  changelog TEXT,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(game_id, version_num)
);
```

#### **8. presentations** (Pitch Studio)
```sql
CREATE TABLE presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,   -- 'My Pitch', 'Demo Stage', etc.
  type 'demo'|'pitch'|'custom',
  content JSONB,           -- Full presentation JSON (slides array)
  status 'draft'|'published',
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

#### **9. chat_messages** (Studio AI conversations)
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role 'user'|'assistant',
  content TEXT NOT NULL,
  code_suggestions JSONB DEFAULT '[]',  -- [{id, type, code, description}]
  created_at TIMESTAMP DEFAULT now()
);
```

#### **10. analytics_events**
```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR,      -- 'lesson_started', 'exercise_completed', etc.
  lesson_id VARCHAR REFERENCES lessons(id),
  game_id UUID REFERENCES games(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now()
);
```

#### **11. leaderboards** (Materialized view)
```sql
CREATE MATERIALIZED VIEW leaderboards AS
SELECT
  u.id,
  u.name,
  u.total_xp,
  COUNT(DISTINCT ub.badge_id) as badges_count,
  COUNT(DISTINCT g.id) as games_built,
  COUNT(DISTINCT g.id) FILTER (WHERE g.published) as games_published,
  RANK() OVER (ORDER BY u.total_xp DESC) as xp_rank,
  RANK() OVER (ORDER BY COUNT(DISTINCT g.id) DESC) as builder_rank
FROM users u
LEFT JOIN user_badges ub ON u.id = ub.user_id
LEFT JOIN games g ON u.id = g.user_id
GROUP BY u.id, u.name, u.total_xp;
```

### Row-Level Security (RLS) Policies

```sql
-- users: public read, owner write
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read public profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE 
  USING (auth.uid() = auth_id);

-- user_progress: owner read/write only
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own progress" ON user_progress FOR SELECT 
  USING (auth.uid() = (SELECT auth_id FROM users WHERE id = user_id));
CREATE POLICY "Users update own progress" ON user_progress FOR UPDATE 
  USING (auth.uid() = (SELECT auth_id FROM users WHERE id = user_id));

-- games: owner read/write, others read if published
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Games visible if published or owner" ON games FOR SELECT 
  USING (published = true OR auth.uid() = (SELECT auth_id FROM users WHERE id = user_id));
CREATE POLICY "Owner can update own games" ON games FOR UPDATE 
  USING (auth.uid() = (SELECT auth_id FROM users WHERE id = user_id));

-- Similar policies for presentations, chat_messages, etc.
```

### Real-time Subscriptions

```typescript
// TypeScript client subscriptions
supabase
  .channel(`user_progress:${userId}`)
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'user_progress', filter: `user_id=eq.${userId}` },
    (payload) => {
      // Update local state on progress change
      setProgress(payload.new);
    }
  )
  .subscribe();

// Leaderboard updates (every 60 seconds)
supabase
  .channel('leaderboards')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'leaderboards' },
    (payload) => {
      // Refresh leaderboard
    }
  )
  .subscribe();
```

---

## Component Specification

### Presentation Engine (Core)

#### **<PresentationEngine /> — Universal Renderer**

```typescript
interface PresentationEngineProps {
  config: PresentationConfig;           // JSON presentation spec
  userProgress?: UserProgress;          // Current user state
  onExerciseComplete?: (slide, result) => void;
  onLessonComplete?: () => void;
  onSave?: (presentation) => void;
  isEditing?: boolean;                  // Editor mode
  mode: 'view' | 'edit';
}

interface PresentationConfig {
  id: string;
  type: 'lesson' | 'demo' | 'studio';
  title: string;
  slides: Slide[];
  theme: 'light' | 'dark';
  progression: {
    total_slides: number;
    xp_reward: number;
    estimated_time_min: number;
  };
}

interface Slide {
  id: string;
  type: 'intro' | 'concept' | 'interactive' | 'capstone' | 'done';
  duration_sec: number;
  content: ContentLayer;
  visual: VisualLayer;
  exercise?: ExerciseLayer;
  interaction?: InteractionLayer;
  analytics?: AnalyticsLayer;
}
```

**Responsibilities:**
- Render slides sequentially
- Manage slide state (current, completed, exercises done)
- Trigger 3D scenes
- Evaluate exercises
- Track progress → save to Supabase
- Handle keyboard/click navigation

---

#### **<SlideRenderer /> — Per-Slide Layout**

```typescript
interface SlideRendererProps {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  onNext: () => void;
  onPrev: () => void;
  onExerciseSubmit: (result: ExerciseResult) => void;
}
```

**Renders:**
- Header (slide number, progress bar, title)
- Visual area (3D scene, video, image, split cards)
- Content area (headline, body, keyline)
- Exercise area (if present)
- Footer (Back, Next buttons)

---

#### **<SceneRenderer /> — Three.js Integration**

```typescript
interface SceneRendererProps {
  scene: SceneConfig;
  onReady?: () => void;
  interactive?: boolean;           // Allow user interaction
  duration: number;
  autoPlay?: boolean;
}

interface SceneConfig {
  model: string;                   // 'city', 'house', etc.
  camera_path: string;             // 'zoom_out', 'fly_in', etc.
  duration: number;
  particles?: boolean;
  lighting?: 'warm' | 'cool' | 'neutral';
  bg_color: string;
}
```

**Responsibilities:**
- Initialize Three.js scene
- Load 3D models from `/public/assets/3d-models/`
- Animate camera along path
- Handle particle effects
- Cleanup on unmount
- Responsive resizing

---

#### **<ExerciseLayer /> — Exercise Dispatcher**

```typescript
interface ExerciseLayerProps {
  exercise: ExerciseConfig;
  onSubmit: (answer: any, isCorrect: boolean) => void;
  onSkip?: () => void;
}

// Routes to correct exercise component
const exerciseComponents = {
  input: <InputExercise />,
  match: <MatchExercise />,
  drag: <DragExercise />,
  slider: <SliderExercise />,
  multiple_choice: <MultipleChoiceExercise />,
  live_render: <LiveRenderExercise />
};
```

**Each exercise component:**
- Renders UI for interaction
- Validates answer
- Shows feedback
- Tracks time spent
- Records to Supabase

---

### Presentation Builder (For Pitch Studio)

#### **<PresentationBuilder /> — Visual Editor**

```typescript
interface PresentationBuilderProps {
  initialPresentation?: PresentationConfig;
  onSave: (presentation: PresentationConfig) => void;
  onPublish?: (presentation: PresentationConfig) => void;
}
```

**Child Components:**
- `<SlideListPanel />` — Slide thumbnails, add/delete/reorder
- `<EditorPanel />` — Content editor (headline, body, visual, exercise, settings)
- `<PreviewPane />` — Live slide preview using `<PresentationEngine />`
- `<ComponentPicker />` — Scene picker, exercise type selector

**State Management (Zustand):**
```typescript
const usePresentationBuilder = create((set) => ({
  presentation: {} as PresentationConfig,
  currentSlideIndex: 0,
  isDirty: false,
  
  updateSlide: (index, updates) => set(state => ({...})),
  addSlide: () => set(state => ({...})),
  deleteSlide: (index) => set(state => ({...})),
  reorderSlides: (fromIndex, toIndex) => set(state => ({...})),
  save: async () => { /* POST to Supabase */ },
}));
```

---

### Studio (Game Builder)

#### **<Studio /> — Main Component**

```typescript
interface StudioProps {
  gameId?: string;          // If editing existing game
  templateType?: 'tetris' | 'invader' | 'blank';
}
```

**Layout:**
```tsx
<div className="studio-split">
  <LeftPanel>
    <GameCanvas>
      <GamePreview gameCode={code} />
      <GameControls />
    </GameCanvas>
    <CodePanel code={code} />
  </LeftPanel>
  
  <RightPanel>
    <ChatPanel 
      gameTemplate={template}
      gameCode={code}
      onSuggestionApply={applyCodeChange}
    />
  </RightPanel>
</div>
```

---

#### **<GamePreview /> — Live Game Runner**

```typescript
interface GamePreviewProps {
  gameCode: { html: string; css: string; js: string };
  template: string;
  onError?: (error: Error) => void;
}
```

**Renders:**
- `<iframe sandbox>` with live game
- Game plays based on HTML/CSS/JS in `gameCode`
- Auto-updates on code change (debounced)
- Shows score/stats overlay

---

#### **<ChatPanel /> — AI Assistant**

```typescript
interface ChatPanelProps {
  gameId: string;
  gameTemplate: string;
  currentCode: GameCode;
  onCodeApply: (newCode: GameCode) => void;
}
```

**Features:**
- Display chat history
- Suggestion cards (auto-generated by Claude)
- Text input + Send button
- Code snippets with [Copy] [Apply] buttons
- Loading states (thinking dots)

**Backend:** Supabase Edge Function calls Claude API

---

## Build Phases

### Phase 1: Foundation (Weeks 1-4)

**Goal:** Core presentation engine + first lesson (Web Quest)

**Deliverables:**
- [ ] GitHub repo setup (monorepo with pnpm)
- [ ] Supabase project + schema migration
- [ ] React app scaffold (Vite + TypeScript)
- [ ] Auth flow (GitHub OAuth + Email)
- [ ] `<PresentationEngine />` base component
- [ ] Web Quest Lesson 1 (Internet Map) with 6 slides
- [ ] 3 reusable 3D scenes (city_zoom, house_fly_in, domain_sign)
- [ ] 3 exercise types (input, match, live_render)
- [ ] Progress tracking (local + Supabase sync)
- [ ] Unit tests (50% coverage)
- [ ] Deployment to Vercel (preview + main)

**Tech:**
- React 18, TypeScript, Vite
- Three.js for 3D scenes
- GSAP for animations
- Supabase client (realtime)
- Zustand for state
- Vitest for unit tests

**Success Criteria:**
- Web Quest Lesson 1 plays smoothly (60fps, 3D scenes render)
- Exercises validate correctly
- XP awarded and saved to Supabase
- Kids can replay slides

---

### Phase 2: Lesson Templates (Weeks 5-8)

**Goal:** Templatize presentation engine, build all 16 lessons

**Deliverables:**
- [ ] `presentation-engine` NPM package (reusable)
- [ ] Lesson JSON schema finalized
- [ ] All 16 lesson data written + validated
- [ ] Remaining 3D scenes (server_rack, browser_car, arcade, etc.)
- [ ] All 6 exercise types implemented
- [ ] Carousel navigation (coverflow)
- [ ] Concept drawer (sidebar info)
- [ ] Light/dark theme toggle
- [ ] Mobile responsive (carousel adapts)
- [ ] Analytics logging
- [ ] E2E tests for lesson flow

**Tech:**
- Shared `presentation-engine` package
- Lesson JSON in Supabase (not hardcoded)
- Real-time progress sync

**Success Criteria:**
- All 16 lessons render from JSON
- Kids can progress through Web Quest → AI Forge → Data Lab
- XP + badges unlock correctly
- Carousel works on mobile

---

### Phase 3: Presentation Builder (Weeks 9-12)

**Goal:** Kids create custom Demo Stage presentations

**Deliverables:**
- [ ] `<PresentationBuilder />` component
- [ ] Slide editor (drag, reorder, delete)
- [ ] Content editor (headline, body, visual picker)
- [ ] Scene picker UI (visual carousel)
- [ ] Exercise builder (conditional UI per type)
- [ ] Live preview (in-editor)
- [ ] Save to Supabase
- [ ] Share link generation
- [ ] Export as HTML
- [ ] Template gallery (starter presentations)

**Tech:**
- Drag-and-drop (dnd-kit or react-beautiful-dnd)
- Form state (react-hook-form)
- Code editor (Monaco or CodeMirror for code snippets)

**Success Criteria:**
- Kids can build 5-slide demo in <10 minutes
- Preview matches what gets saved
- Shared links work
- Export downloads playable HTML file

---

### Phase 4: Studio - Game Builder (Weeks 13-18)

**Goal:** Kids build and share HTML games with AI help

**Deliverables:**
- [ ] `<Studio />` main component
- [ ] Game templates (Tetris, Space Invaders, blank)
- [ ] `<GamePreview />` (iframe sandbox)
- [ ] `<CodePanel />` (syntax highlight, edit)
- [ ] `<ChatPanel />` (Claude integration)
- [ ] Supabase Edge Function for Claude API
- [ ] Game save/publish workflow
- [ ] Game library (My Games)
- [ ] Play counter + rating system
- [ ] Code version control (game_versions table)
- [ ] Suggestion card generation (Claude prompts)

**Tech:**
- Supabase Edge Functions (Node.js, call Claude API)
- Claude Prompt Engineering (game code generation)
- iframe sandboxing (security)
- Monaco Editor (code editing)

**Success Criteria:**
- Kids start with template, customize via chat
- Code generated by Claude is working
- Games save and play correctly
- Ratings/leaderboards show popularity

---

### Phase 5: Polish & Launch (Weeks 19-22)

**Goal:** Production-ready, tested, performant

**Deliverables:**
- [ ] Performance optimization (bundle size, 3D performance)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Mobile testing on real devices
- [ ] Security audit (XSS, CSRF, injection)
- [ ] Load testing (1000 concurrent users)
- [ ] Bug fixes from beta
- [ ] Documentation (API, architecture, deployment)
- [ ] Launch marketing materials
- [ ] Analytics dashboard (admin)

**Success Criteria:**
- Lighthouse score > 90
- <3 second load time
- <50ms input latency on 3D scenes
- 99.9% uptime on Vercel

---

## Deployment Pipeline

### GitHub Workflow: `.github/workflows/`

#### **test.yml** — Run on Every Push
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm run lint
      - run: pnpm run type-check
      - run: pnpm run test
```

#### **deploy.yml** — Deploy to Vercel on Main Merge
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm run build
      - uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### Vercel Config: `vercel.json`

```json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": "apps/web/dist",
  "env": {
    "VITE_SUPABASE_URL": "@supabase_url",
    "VITE_SUPABASE_ANON_KEY": "@supabase_anon_key",
    "VITE_CLAUDE_API_KEY": "@claude_api_key"
  },
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Environment Variables

```bash
# .env.local (local development)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=ey...
VITE_CLAUDE_API_KEY=sk-...

# Vercel: Set in Settings > Environment Variables
# (same keys, pulled from GitHub Secrets)
```

### Deployment Environments

| Environment | Branch | URL | Purpose |
|-------------|--------|-----|---------|
| **Preview** | `feature/*` | `pr-123.argantalab.vercel.app` | PR preview |
| **Staging** | `develop` | `staging.argantalab.vercel.app` | QA testing |
| **Production** | `main` | `argantalab.vercel.app` | Live app |

---

## API & Integration Points

### Supabase Edge Function: `chat-with-claude`

```typescript
// supabase/functions/chat-with-claude/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Anthropic } from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
})

serve(async (req) => {
  const { messages, gameCode, gameTemplate } = await req.json()

  const response = await anthropic.messages.create({
    model: "claude-opus-4-1",
    max_tokens: 1024,
    system: `You are an AI game coding assistant for kids age 8-14.
    The user is building an HTML5 game using Canvas API.
    Current template: ${gameTemplate}
    Current code: ${JSON.stringify(gameCode)}
    
    Keep explanations simple. Show code before explaining.
    Suggest next features after each change.`,
    messages: messages,
  })

  return new Response(
    JSON.stringify({
      content: response.content[0].text,
      stop_reason: response.stop_reason,
    }),
    { headers: { "Content-Type": "application/json" } }
  )
})
```

### Client API Calls: `lib/api/`

```typescript
// lib/api/chat.ts
export async function chatWithClaude(
  messages: Message[],
  gameCode: GameCode,
  gameTemplate: string
): Promise<string> {
  const response = await supabase.functions.invoke("chat-with-claude", {
    body: { messages, gameCode, gameTemplate }
  })
  return response.data.content
}

// lib/api/lessons.ts
export async function fetchLesson(lessonId: string): Promise<Lesson> {
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .single()
  if (error) throw error
  return data
}

export async function trackProgress(
  userId: string,
  lessonId: string,
  slideIndex: number,
  exerciseDone: boolean
): Promise<void> {
  await supabase
    .from("user_progress")
    .upsert({
      user_id: userId,
      lesson_id: lessonId,
      current_slide: slideIndex,
      exercises_done: { [`slide_${slideIndex}`]: exerciseDone }
    })
}

// lib/api/games.ts
export async function saveGame(
  userId: string,
  name: string,
  code: GameCode,
  template: string
): Promise<string> {
  const { data, error } = await supabase
    .from("games")
    .insert({
      user_id: userId,
      name,
      code,
      base_template: template
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

// lib/api/presentations.ts
export async function savePresentation(
  userId: string,
  presentation: PresentationConfig
): Promise<string> {
  const { data, error } = await supabase
    .from("presentations")
    .insert({
      user_id: userId,
      name: presentation.title,
      content: presentation,
      type: presentation.type
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}
```

---

## Development Guidelines

### Code Style & Standards

```typescript
// Use TypeScript for all files
// File naming: camelCase for .ts files, PascalCase for .tsx files
// Folder naming: kebab-case

// Example: src/components/presentation/SlideRenderer.tsx
// Export named default:
export default function SlideRenderer({ slide, onNext }: Props) {
  return (...)
}

// No hardcoded strings — use constants
const ANIMATION_DURATION = 0.6 // seconds
const SLIDE_TYPES = ['intro', 'concept', 'capstone', 'done'] as const
```

### Component Structure

```typescript
// Every component: Props interface, component function, exports

interface SlideRendererProps {
  slide: Slide
  index: number
  onNext: () => void
}

/**
 * Renders a single slide in presentation mode.
 * Handles 3D scenes, exercises, and user interaction.
 */
export default function SlideRenderer({ 
  slide, 
  index, 
  onNext 
}: SlideRendererProps): JSX.Element {
  // Hooks at top
  const [isReady, setIsReady] = useState(false)
  const { user } = useUser()
  
  // Effects
  useEffect(() => {
    // Setup
    return () => {
      // Cleanup
    }
  }, [])
  
  // Handlers
  const handleExerciseSubmit = async (answer: any) => {
    // Logic
  }
  
  // Render
  return (
    <div className="slide-renderer">
      {/* Content */}
    </div>
  )
}
```

### Testing Pattern

```typescript
// tests/SlideRenderer.test.tsx
import { render, screen } from '@testing-library/react'
import SlideRenderer from '...'

describe('SlideRenderer', () => {
  it('renders slide title', () => {
    const slide = { id: '1', type: 'intro', content: { headline: 'Test' } as any }
    render(<SlideRenderer slide={slide} index={0} onNext={() => {}} />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('calls onNext when Next button clicked', async () => {
    const onNext = vi.fn()
    const slide = { /* ... */ }
    render(<SlideRenderer slide={slide} index={0} onNext={onNext} />)
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(onNext).toHaveBeenCalled()
  })
})
```

### Commit Message Convention

```
feat: add presentation builder for pitch studio
fix: resolve XP not saving to supabase
docs: update API documentation
test: add tests for exercise validation
chore: bump Three.js to v0.160.0

// Always reference issue
feat: add presentation builder (#123)
```

### Documentation

- **API changes** → Update `docs/API.md`
- **Architecture changes** → Update `docs/ARCHITECTURE.md`
- **New features** → Add to `README.md` features list
- **Component logic** → JSDoc comments on complex functions

---

## Success Criteria & Metrics

### By End of Phase 1 (Week 4)
- Web Quest Lesson 1 fully playable
- 3D scenes render smoothly (>55fps)
- Progress syncs to Supabase in <1 second
- Unit test coverage >60%

### By End of Phase 2 (Week 8)
- All 16 lessons accessible from Carousel
- Carousel navigation smooth on mobile
- XP + badge system working
- Analytics showing lesson completion rates

### By End of Phase 3 (Week 12)
- 50% of beta users create custom Demo Stage
- Shared presentations open correctly
- Export downloads work

### By End of Phase 4 (Week 18)
- 100+ games created in Studio
- Average game code generation <3 seconds
- Chat suggestions accepted >70% of time

### At Launch (Week 22)
- <2000 bundle size (main.js gzipped)
- Lighthouse score >90
- 99.5% uptime
- <50ms 3D scene frame drop
- 1000+ registered users

---

## Getting Started

### Local Development Setup

```bash
# 1. Clone repo
git clone https://github.com/aldythsukapradja/ArgantaLab.git
cd ArgantaLab

# 2. Install dependencies
pnpm install

# 3. Setup environment
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local with Supabase credentials

# 4. Supabase setup
# a. Create project at supabase.com
# b. Run migrations:
supabase db push

# c. Seed initial data:
psql postgresql://user:pass@host/db < supabase/seed.sql

# 5. Start dev server
pnpm dev

# 6. Navigate to http://localhost:5173
```

### First Task: Create Web Quest Lesson 1 JSON

```bash
# 1. Create lesson file
touch apps/web/src/data/lessons/web-quest.json

# 2. Add lesson data (6 slides) matching PresentationConfig schema

# 3. Validate JSON
pnpm run validate-lessons

# 4. Run component with hardcoded lesson
# Then switch to Supabase query

# 5. Test with real kid — iterate on feedback
```

---

## Q&A

**Q: Can multiple kids collaborate on one game?**  
A: Phase 1-4 is single-user. Real-time collab added in Phase 5+ using Supabase channels.

**Q: How do we prevent kids from copying code from each other?**  
A: Version history shows original author. Can flag plagiarism if identical commits appear.

**Q: What if Claude API calls are expensive?**  
A: Monitor usage, add per-user rate limits, use prompt caching for repeated game templates.

**Q: Can kids share games across other platforms?**  
A: Export generates standalone HTML file. Can host anywhere. Published games linked from Arganta.

**Q: How do we handle inappropriate content?**  
A: Moderation queue (admin UI) for published games. Auto-filter for keywords. Manual review.

**Q: Mobile offline support?**  
A: Service worker caches lessons locally. Studio requires internet (Claude API). Sync on reconnect.

---

## References

- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)
- [Three.js Docs](https://threejs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Vercel Docs](https://vercel.com/docs)

---

**Last Updated:** 2025-06-20  
**Status:** Ready for Development  
**Next Step:** Initialize repo, set up Supabase project, scaffold React app
