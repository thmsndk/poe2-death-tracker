# Death Tracker - Feature Ideas 💀

## Current Data Points 📊

- Death timestamps from client.txt
  - Log format: `2024/12/07 12:21:41 1617794609 3ef2336d [INFO Client 35484] : Zahrek has been slain.`
- Level up events from client.txt
  - Log format: `2024/12/07 09:30:49 1607543015 3ef2336d [INFO Client 35484] : Zahrek (Monk) is now level 2`
- Passive skill allocation events
  - Log format: `2025/01/17 22:19:01 104679734 f4ab40f7 [INFO Client 33512] Successfully allocated passive skill id: spells18, name: Spell Damage`
  - Track build progression
  - Skill allocation patterns
  - Build completion timing
- AFK status events
  - Log format:
    ```
    2025/01/17 22:34:18 105597359 3ef2336b [INFO Client 33512] : AFK mode is now ON. Autoreply "This player is AFK."
    2025/01/17 23:21:50 108448921 3ef2336b [INFO Client 33512] : AFK mode is now OFF.
    ```
  - Track actual play time vs idle time
  - Session activity analysis
  - AFK patterns during progression
- Session tracking
  - Session start detection:
    - `***** LOG FILE OPENING *****`
    - `[ENGINE] Init`
    - Hardware info logging
    - Directory initialization
  - Active session determination:
    - Track timestamp of most recent event
    - Consider session active if last event within X minutes
    - New session starts if:
      - Explicit game start markers found
      - Time gap between events exceeds threshold
      - Different character name detected
    - Session end implied by:
      - Long period of inactivity
      - New session start markers
      - Last event > X minutes old
  - Multiple sessions per log file possible
- Item identification events
  - Log format: `2025/01/16 21:06:31 13930062 3ef2336f [INFO Client 13776] : 4 Items identified`
  - Track inventory management patterns
  - Time spent identifying items
  - Items identified per session/area
- Campaign Progress Events
  - Boss dialogue tracking:
    - Log format: `2025/01/16 21:56:00 16899656 3ef2336f [INFO Client 13776] The Executioner: You have been sentenced to death.`
  - Can detect:
    - Boss encounters
    - Campaign progression
    - Time spent on boss fights
    - Deaths per boss encounter
  - Known bosses:
    - The Executioner
      // ... can add more as we discover them
- NPC Trade Interface Events
  - Buy/Sell tab detection via Una's dialogue:
    ```
    Una: I've collected these over time. What do you think?
    Una: Finn makes fun of my collection, but I think it's charming.
    Una: These are just some odds and ends of mine.
    Una: Please, take your time.
    ```
  - Trade window events:
    - Cancel: `[INFO Client xxxxx] : Trade cancelled.`
    - Accept: `[INFO Client xxxxx] : Trade accepted.`
  - Potential analysis:
    - Time spent in trade windows
    - Trading patterns
    - Frequency of vendor visits
    - Correlation with deaths (died during trade?)
- Area Generation Events
  - Log format: `2025/01/16 21:04:54 13832703 2caa1679 [DEBUG Client 13776] Generating level 15 area "G1_town" with seed 1`
  - Track zone transitions
  - Area levels and names
  - Time spent in each area
  - Deaths per area/level
  - Area revisit patterns

### Trial of Sekhmet Events

- Death Crystal Events

  - Log format: `2025/01/20 00:51:38 286639656 3ef2336b [INFO Client 18400] : 6 Death Crystals remaining`
  - Track:
    - Crystal consumption rate
    - Time between crystal uses
    - Crystal usage patterns per session
    - Deaths vs crystal availability
    - Crystal efficiency (time alive per crystal)
    - Crystal depletion warnings (low/empty)
    - Session impact of crystal availability
    - Crystal usage by:
      - Time of day
      - Area level
      - Character level
      - Content type

- Key Collection Events
  - Log format: `2025/01/20 00:53:22 286743640 3ef2336b [INFO Client 18400] : Collected a {Bronze|Silver} key`
  - Track:
    - Key collection rate
    - Time between keys
    - Key types distribution
    - Keys collected per run
    - Run completion time
    - Success rate analysis
    - Trial efficiency metrics:
      - Keys per minute
      - Keys per death
      - Keys vs crystal usage
      - Optimal path analysis
      - Run completion patterns
    - Progress tracking:
      - Bronze vs Silver key ratios
      - Keys collected before failure
      - Best/worst performing runs
      - Learning curve analysis

## Twitch Integration 🎥

- Auto-create stream markers on deaths for highlight reels
- Stream marker after being afk (no file events for a long time?)
- Clip creation on deaths (last 30 seconds)
- Death announcements in chat
- Chat commands for death stats
- Channel point redemptions for death predictions

## Visual Analytics 📈

### Death Heatmap

- Time of day heatmap (When do you die most?)
- Session timeline heatmap (Early/mid/late session deaths)

### Statistical Analysis

- Deaths per hour trends
- Survival time distribution
  - Track time intervals between deaths
  - Identify common survival durations (0-5m, 5-30m, 30m+)
  - Analyze peak survival periods vs dangerous timeframes
  - Compare survival patterns across different:
    - Times of day
    - Content types (mapping, bossing, etc)
    - Character levels
  - Visualize distribution curves for survival analytics
- Session performance comparisons
- Death clusters analysis (multiple deaths in short time)
- Progress between deaths

## OCR Enhancement Possibilities 🔍

### Boss/Enemy Detection

- Boss name recognition
- Boss-specific death counters
- Most deadly boss statistics
- Progress tracking per boss

### Character State

- Health/ES values at death
- Buff/debuff detection
- Level/XP progress
- Location/zone detection

## Advanced Analytics 📊

### Session Analysis

- Death frequency by time played
- Fatigue analysis (deaths vs session length)
- Best/worst performing hours
- Recovery time after deaths
- Time played enrichment
  - Total time played per character
  - Active vs idle time breakdown
  - Session duration distribution
  - Time between sessions
  - Peak activity periods
  - Time played milestones (first death, level 10, etc.)
  - Deaths per hour of playtime
  - XP efficiency (levels per hour played)
  - Session start/end patterns
  - Longest/shortest sessions
  - Average session length by:
    - Time of day
    - Day of week
    - Character level range
    - Content type

### Progress Tracking

- XP/hour vs death correlation
- Level progression impact
- Zone progression analysis
- Character progression efficiency

### Comparative Stats

- Day vs night performance
- Weekday vs weekend stats
- Session start vs end performance
- Historical trends

## Community Features 👥

- Death prediction games
- Session death total betting
- Survival time challenges
- Progress vs death leaderboards

## Future Ideas 🚀

- Integration with POE API if available
