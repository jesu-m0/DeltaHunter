# DeltaHunter

Telemetry comparison tool for sim racing. Upload two MoTeC `.ld` telemetry files and get a detailed lap-by-lap breakdown of where you're gaining or losing time against a reference driver.

Built for **Assetto Corsa Competizione** — it's the sim I race on and the only one I've tested with. The `.ld` format is standard MoTeC, so it *might* work with other sims that export MoTeC telemetry, but no guarantees.

## How it works

1. Upload your `.ld` file and a reference driver's `.ld` file
2. DeltaHunter parses the binary telemetry, extracts all laps, and auto-selects the best lap from each session
3. You get a full comparison dashboard with charts, sector breakdowns, and coaching tips

You can also switch between laps from each session using the lap selector — no need to re-upload.

## Getting your telemetry

In **Assetto Corsa Competizione**, MoTeC telemetry logging is enabled by default. Your `.ld` files are saved to:

```
Documents\Assetto Corsa Competizione\MoTeC\
```

Each session generates an `.ld` file (the telemetry data) and an `.ldx` file (metadata). You only need the `.ld` file.

### Getting reference telemetry

DeltaHunter does **not** have a telemetry database. To compare against another driver, you need them to share their `.ld` file with you directly. This is common in sim racing teams and leagues — just ask your teammate or a faster driver for their file.

## Charts & analysis

| Chart | Description |
|-------|-------------|
| **Circuit Overview** | GPS track map with color-coded sectors showing time gain/loss |
| **Sector Table** | Time delta per sector with min speed comparison |
| **Speed** | Speed trace for both drivers across the full lap |
| **Time Delta** | Cumulative time delta — see exactly where you gain or lose |
| **Gear** | Gear trace comparison — spot late/early shifts |
| **RPM & Gear** | RPM trace with gear overlay and upshift point markers for optimal shift timing analysis |
| **Throttle** | Throttle application comparison |
| **Brake** | Brake pressure comparison |
| **Trail Braking** | Brake % + steering angle overlay with shaded trail braking zones |
| **Telemetry Card** | Live readout at marker position: speed, throttle, brake, gear, RPM, steering, fuel, G-forces, ABS/TC status |
| **Playback Bar** | Animate the marker along the circuit at real driving speed with adjustable playback rate (0.25x–8x) |
| **Sector Detail** | Zoomed-in HD view of any sector with racing line comparison |
| **Findings** | Auto-generated coaching tips per sector based on the telemetry data |

## Supported circuits

Circuits with full sector definitions (named corners, accurate sector boundaries):

| Circuit | Sectors |
|---------|---------|
| **Autodromo Enzo e Dino Ferrari (Imola)** | Variante Tamburello, Villeneuve, Tosa, Piratella, Acque Minerali, Variante Alta, Rivazza 1 & 2 |
| **Sepang International Circuit** | T1–T15 |

### Unknown circuits

Any circuit **will still work** — DeltaHunter auto-detects braking zones and creates generic sectors (Corner 1, Corner 2, etc.) based on speed, brake, and throttle data. The analysis is fully functional, but sector names won't match real corner names and the boundaries may not be as precise as hand-tuned circuits.

## Why only Assetto Corsa Competizione?

It's what I race. I built DeltaHunter to compare my laps against faster drivers in my league and understand where I was losing time. ACC uses the MoTeC `.ld` binary format for telemetry logging, which is what DeltaHunter parses.

Other sims that export MoTeC `.ld` files (iRacing with third-party tools, rFactor 2, etc.) might work but are untested. If you try it and it works (or doesn't), let me know.

## Project structure

```
DeltaHunter/
  deltahunter/              # Next.js project root
    api/analyze/             # Python backend (Vercel serverless)
      route.py               # MoTeC parser + telemetry comparison engine
      dev_server.py          # Local Flask dev server
    app/                     # Next.js pages
      page.tsx               # Upload page
      analysis/page.tsx      # Analysis dashboard
    components/              # React components (charts, maps, controls)
    lib/                     # Zustand store, types, chart utilities
    public/                  # Sample telemetry files
```

## Tech stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, Zustand
- **Backend**: Python (NumPy) running as Vercel serverless functions
- **Charts**: Custom canvas-based rendering (no charting library)
- **Deployment**: Vercel
