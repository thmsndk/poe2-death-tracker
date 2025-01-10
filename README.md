# POE2 Death Tracker

A death and leveling tracker for Path of Exile 2. This tool monitors your game logs and tracks your character deaths and level progression. Perfect for streamers who want to display death counts and level progression on their stream!

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/B0B71865NT)

## Quick Start (For Streamers & Users)

1. Install [Node.js](https://nodejs.org/) (v18 or higher)
2. Download this repository as ZIP (green "Code" button above)
3. Extract the ZIP file
4. Open a terminal/command prompt in the extracted folder
5. Run these commands:
   ```bash
   npm install
   npm start
   ```

The tracker will create a `death-stats` folder (or your specified output directory) containing:

### Basic Stats

- `stats.json` - Complete tracking data (all characters, deaths, and leveling info)
- `total_deaths.txt` - Total death count across all characters
- `character_stats.json` - Detailed JSON stats for all characters
- `recent_deaths.txt` - Log of all deaths
- `last_five_deaths.txt` - Most recent 5 deaths

### Current Character Stats

- `current_character.json` - Full JSON stats for current character
- `current_character_recent_levels.txt` - Recent level progression (horizontal format)
- `current_character_all_levels.txt` - All levels in compact format
- `current_character_all_levels_vertical.txt` - All levels in vertical format
- `current_character_records.txt` - Speed records and averages
- `current_character_session.txt` - Current session statistics
- `current_character_basic1.txt` - Simple stats format 1
- `current_character_basic2.txt` - Simple stats format 2
- `current_character_basic3.txt` - Simple stats format 3
- `current_character_basic4.txt` - Simple stats format 4
- `current_character_recent_levels_vertical.txt` - Recent levels in vertical format

### Using with OBS

1. Add a "Text (GDI+)" source to your scene
2. Check "Read from file"
3. Browse to your output directory and select any of the .txt files above
4. Style the text as needed in OBS

### Custom Settings

By default, the tracker looks for your Path of Exile 2 logs in:
`D:\SteamLibrary\steamapps\common\Path of Exile 2\logs\Client.txt`

If your game is installed elsewhere, you can specify the path:

```bash
npm start -- --path "C:\Games\Path of Exile 2\logs\Client.txt"
```

You can also change the output folder (default is "death-stats"):

```bash
npm start -- --output "my-stats"
```

## For Developers

### Prerequisites

- Node.js (v18 or higher)
- pnpm (or npm/yarn)

### Development Setup

```bash
git clone https://github.com/yourusername/poe2-death-tracker.git
cd poe2-death-tracker
pnpm install
```

### Running in Development Mode

```bash
pnpm dev
```

### Building for Production

```bash
pnpm build
pnpm start:prod
```
