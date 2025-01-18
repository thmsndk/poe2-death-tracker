# Death Tracker Implementation Plan 📋

## Phase 1: Core Implementation 🎯

### Architecture

```
src/
├── core/
│   ├── LogParser.ts       # Reads and parses client.txt
│   ├── EventManager.ts    # Processes game events
│   └── StateManager.ts    # Manages application state
│
├── types/                 # Shared type definitions
│   └── index.ts
│
└── outputs/
    └── files/            # File-based output generation
```

### Implementation Steps

1. **Log Parser**

   - Watch client.txt for changes
   - Parse known event types:
     - Deaths
     - Level ups
     - Item identification
     - Area generation
     - NPC interactions
     - Session markers

2. **Event Manager**

   - Process raw log events
   - Categorize and enrich events
   - Maintain event history
   - Track active sessions

3. **State Manager**

   - Maintain current state
   - Track character progression
   - Calculate statistics
   - Handle state persistence

4. **File Outputs**
   - Generate stat files
   - Update files on state changes
   - Support multiple formats (txt/json)

## Phase 2: Web Server & UI 🌐

_To be implemented after Phase 1 is stable_

### Planned Architecture

```
src/
├── [Phase 1 structure]
│
├── server/
│   ├── api/            # REST endpoints
│   └── ws/             # WebSocket updates
│
└── client/             # React Application
    ├── components/
    │   └── widgets/    # Stream overlay widgets
    ├── hooks/          # Data hooks
    └── styles/         # Tailwind styles
```

### Future Features

- React-based widgets
- Real-time updates
- Customizable styling
- OBS integration
- Analytics dashboard

## Phase 3: OCR Integration 🔍

_To be implemented after Phase 2 is stable_

### Features

- Screen capture using screenshot-desktop:
  - Capture specific display regions
  - Support for multiple monitors
  - No external dependencies on Windows/Mac
- Text recognition using Tesseract.js:
  - Support for 100+ languages
  - Extract text from captured images
  - High accuracy text detection
- Parse additional information not available in logs:
  - Current zone/area name
  - Boss health bars
  - Item drops
  - Trade window contents
  - Chat messages

### Technical Implementation

```typescript
interface OCRConfig {
  captureRegions: {
    zoneName: { x: number; y: number; width: number; height: number };
    bossHealth: { x: number; y: number; width: number; height: number };
    // ... other regions
  };
  refreshRate: number; // How often to capture (ms)
  language: string; // OCR language model
}
```

### Enhanced Analytics

- Zone progression tracking
- Boss fight duration
- Death locations
- Item acquisition timeline
- Trade history

## Data Flow 🔄

### Phase 1

```
LogParser -> EventManager -> StateManager -> File Outputs
```

### Phase 2

```
LogParser -> EventManager -> StateManager -> [File Outputs]
                                        -> WebSocket -> React Widgets
```

### Phase 3

```
LogParser -----> EventManager -> StateManager -> [All Outputs]
OCR Parser --/
```

## Event Types 📝

- Deaths
- Level ups
- Area transitions
- Boss encounters
- Item identification
- Trade/vendor interactions
- Session boundaries
- Screen-captured events (Phase 3)

## State Structure 📊

```typescript
interface State {
  characters: Record<string, CharacterInfo>;
  sessions: SessionData[];
  currentSession?: Session;
  globalStats: GlobalStats;
  ocrData?: OCRData; // Phase 3
}
```

---

_Note: This plan will be updated as implementation progresses and requirements evolve._
