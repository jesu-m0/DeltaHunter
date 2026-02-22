"""
DeltaHunter – MoTeC i2 (.ld) telemetry parser and analysis endpoint.

Supports .ld files from Telemetrick, ACTI, and other MoTeC-compatible loggers.
Channel data is decoded using the standard header scaling: (raw / scale * 10^(-dec) + shift) * mul.
"""

from http.server import BaseHTTPRequestHandler
import json
import struct
import re
import numpy as np
from typing import Any


# ---------------------------------------------------------------------------
# Circuit database
# ---------------------------------------------------------------------------

CIRCUITS = {
    "imola": {
        "name": "Autodromo Enzo e Dino Ferrari (Imola)",
        "length": 4909,
        "sectors": [
            {"name": "Variante Tamburello", "start": 450, "end": 850},
            {"name": "Villeneuve", "start": 1150, "end": 1450},
            {"name": "Tosa", "start": 1550, "end": 1800},
            {"name": "Piratella", "start": 2150, "end": 2400},
            {"name": "Acque Minerali", "start": 2400, "end": 2950},
            {"name": "Variante Alta", "start": 3150, "end": 3500},
            {"name": "Rivazza 1 & 2", "start": 3900, "end": 4500},
        ],
    },
    "sepang": {
        "name": "Sepang International Circuit",
        "length": 5475,
        "sectors": [
            {"name": "T1", "start": 400, "end": 640},
            {"name": "T2", "start": 640, "end": 760},
            {"name": "T3", "start": 760, "end": 900},
            {"name": "T4", "start": 900, "end": 1080},
            {"name": "T5 Hairpin", "start": 1350, "end": 1650},
            {"name": "T6", "start": 1650, "end": 1870},
            {"name": "T7", "start": 1870, "end": 2080},
            {"name": "T8", "start": 2080, "end": 2300},
            {"name": "T9", "start": 2300, "end": 2580},
            {"name": "T10", "start": 2580, "end": 2760},
            {"name": "T11", "start": 2900, "end": 3220},
            {"name": "T12", "start": 3300, "end": 3560},
            {"name": "T13", "start": 3650, "end": 3870},
            {"name": "T14", "start": 3900, "end": 4260},
            {"name": "T15", "start": 4850, "end": 5200},
        ],
    },
}


def match_circuit(track_name: str):
    name = track_name.lower().replace("_", " ").replace("-", " ")
    for key, circuit in CIRCUITS.items():
        if key in name:
            return circuit
    return None


# ---------------------------------------------------------------------------
# .ld binary parser
# ---------------------------------------------------------------------------

def read_str(buf: bytes, offset: int, length: int) -> str:
    raw = buf[offset : offset + length]
    end = raw.find(b"\x00")
    if end != -1:
        raw = raw[:end]
    return raw.decode("latin-1", errors="replace").strip()




def parse_channels(buf: bytes):
    """Parse all channel metadata + data from the .ld binary."""
    meta_ptr = struct.unpack_from("<I", buf, 8)[0]
    data_ptr = struct.unpack_from("<I", buf, 12)[0]

    channels = {}
    ptr = meta_ptr
    visited = set()

    while ptr != 0 and ptr < len(buf) and ptr not in visited:
        visited.add(ptr)
        if ptr + 124 > len(buf):
            break

        prev = struct.unpack_from("<I", buf, ptr + 0)[0]
        nxt = struct.unpack_from("<I", buf, ptr + 4)[0]
        ch_data_ptr = struct.unpack_from("<I", buf, ptr + 8)[0]
        data_count = struct.unpack_from("<I", buf, ptr + 12)[0]
        # ptr+16 is "counter" (skip)
        dtype_a = struct.unpack_from("<H", buf, ptr + 18)[0]
        dtype_v = struct.unpack_from("<H", buf, ptr + 20)[0]
        freq = struct.unpack_from("<H", buf, ptr + 22)[0]
        shift = struct.unpack_from("<h", buf, ptr + 24)[0]
        mul = struct.unpack_from("<h", buf, ptr + 26)[0]
        scale = struct.unpack_from("<h", buf, ptr + 28)[0]
        dec = struct.unpack_from("<h", buf, ptr + 30)[0]

        name = read_str(buf, ptr + 32, 32)
        short_name = read_str(buf, ptr + 64, 8)
        units = read_str(buf, ptr + 72, 12)

        if data_count == 0 or ch_data_ptr == 0:
            ptr = nxt
            continue

        if freq == 0:
            freq = 1

        # Determine numpy dtype from dtype_a (family) and dtype_v (variant)
        if dtype_a in (0x07,):
            # Float family
            if dtype_v == 3:
                np_dtype, sample_size = "<f4", 4
            elif dtype_v == 1:
                np_dtype, sample_size = "<f2", 2
            else:
                np_dtype, sample_size = "<f4", 4
        elif dtype_a in (0, 0x03, 0x05):
            # Integer family
            if dtype_v == 3:
                np_dtype, sample_size = "<i4", 4
            else:
                np_dtype, sample_size = "<i2", 2
        else:
            np_dtype, sample_size = "<i2", 2

        end = ch_data_ptr + data_count * sample_size
        if end > len(buf):
            data_count = (len(buf) - ch_data_ptr) // sample_size
            end = ch_data_ptr + data_count * sample_size
        data = np.frombuffer(buf[ch_data_ptr:end], dtype=np_dtype).astype(
            np.float64
        )
        # Apply ldparser scaling: (raw / scale * 10^(-dec) + shift) * mul
        safe_scale = scale if scale != 0 else 1
        safe_mul = mul if mul != 0 else 1
        data = data / safe_scale * (10.0 ** (-dec)) * safe_mul + shift

        channels[name] = {
            "data": data,
            "freq": freq,
            "shift": shift,
            "mul": mul,
            "scale": scale,
            "dec": dec,
            "dtype_a": dtype_a,
            "dtype_v": dtype_v,
            "units": units,
            "short_name": short_name,
        }

        ptr = nxt

    return channels


def find_channel(channels: dict, *keywords):
    """Find a channel by partial case-insensitive match on all keywords."""
    for name, ch in channels.items():
        lower = name.lower()
        if all(k.lower() in lower for k in keywords):
            return name, ch
    return None, None



def get_channel_data(channels: dict, *keywords):
    """Find a channel. Returns (data_array, freq) or (None, 0)."""
    name, ch = find_channel(channels, *keywords)
    if ch is None:
        return None, 0
    data = ch["data"].copy()
    return data, ch["freq"]


def parse_header(buf: bytes):
    driver = read_str(buf, 158, 64)
    car = read_str(buf, 222, 64)
    track = read_str(buf, 350, 64)
    return driver, car, track


# ---------------------------------------------------------------------------
# Lap detection and extraction
# ---------------------------------------------------------------------------

def extract_best_lap(channels: dict):
    """Find the best (fastest complete) lap and return channel slices."""
    # --- Lap number channel ---
    # Try specific names first, then fallback
    lap_data, lap_freq = None, 0
    for kw in [("lap", "number"), ("lap", "count"), ("session", "lap", "count")]:
        lap_data, lap_freq = get_channel_data(channels,*kw)
        if lap_data is not None:
            break
    if lap_data is None:
        # Last resort: find any channel with "lap" that looks like a counter
        for name, ch in channels.items():
            lower = name.lower()
            if "lap" in lower and ("num" in lower or "count" in lower or lower == "lap number"):
                lap_data, lap_freq = get_channel_data(channels,name)
                if lap_data is not None:
                    break

    # --- Distance channel ---
    dist_data, dist_freq = get_channel_data(channels,"lap", "dist")
    if dist_data is None:
        dist_data, dist_freq = get_channel_data(channels,"distance")

    # --- Speed channel ---
    speed_data, speed_freq = get_channel_data(channels,"ground", "speed")
    if speed_data is None:
        speed_data, speed_freq = get_channel_data(channels,"speed")
    if speed_data is None:
        speed_data, speed_freq = get_channel_data(channels,"gnd", "spd")

    if speed_data is None:
        raise ValueError("Missing essential channel: speed")

    # --- Compute distance from speed if no distance channel ---
    if dist_data is None and speed_data is not None:
        print(f"[DEBUG] No distance channel found, computing from speed")
        print(f"[DEBUG] Speed stats: min={speed_data.min():.2f}, max={speed_data.max():.2f}, mean={speed_data.mean():.2f}, freq={speed_freq}")
        dt = 1.0 / speed_freq if speed_freq > 0 else 1.0 / 20.0
        # speed is kph, convert to m/s and integrate
        speed_ms = speed_data / 3.6
        dist_data = np.cumsum(speed_ms * dt)
        dist_freq = speed_freq
        print(f"[DEBUG] Computed distance: total={dist_data[-1]:.1f}m")

    if dist_data is None:
        raise ValueError("Missing essential channels (could not determine distance)")

    # --- Detect lap boundaries ---
    # Priority: 1) distance resets, 2) Lap Time channel resets, 3) Session Lap Count changes
    # The "Lap Number" channel in AC/Telemetrick counts *completed* laps,
    # so it stays at 0 for the entire first lap.  Distance resets and Lap Time
    # resets are the reliable signals.
    print(f"[DEBUG] Resolved: dist_freq={dist_freq}, speed_freq={speed_freq}")
    print(f"[DEBUG] Samples: dist={len(dist_data)}, speed={len(speed_data)}")

    # 1) Try distance resets (works when Lap Distance channel exists)
    resets = [0]
    for i in range(1, len(dist_data)):
        if dist_data[i] < dist_data[i - 1] - 50:
            resets.append(i)

    # 2) If no distance resets, try Lap Time channel resets
    if len(resets) <= 1:
        lt_data, lt_freq = get_channel_data(channels, "lap", "time")
        if lt_data is not None and lt_freq > 0:
            resets = [0]
            # Convert Lap Time indices to dist_data indices
            for i in range(1, len(lt_data)):
                if lt_data[i] < lt_data[i - 1] - 1.0:
                    # Map from lt_data index to dist_data index
                    di = int(i * dist_freq / lt_freq)
                    if di > 0 and di < len(dist_data):
                        resets.append(di)
            if len(resets) > 1:
                print(f"[DEBUG] Using Lap Time resets for lap boundaries")

    # 3) If still no splits, try Session Lap Count / Lap Number changes
    if len(resets) <= 1 and lap_data is not None:
        resets = [0]
        for i in range(1, len(lap_data)):
            if lap_data[i] != lap_data[i - 1]:
                di = int(i * dist_freq / lap_freq)
                if di > 0 and di < len(dist_data):
                    resets.append(di)
        if len(resets) > 1:
            print(f"[DEBUG] Using Lap Number changes for lap boundaries")

    laps = {}
    lap_freq = dist_freq
    for idx in range(len(resets)):
        s = resets[idx]
        # The reset sample belongs to the NEXT lap, so end one sample before it
        e = (resets[idx + 1] - 1) if idx + 1 < len(resets) else len(dist_data) - 1
        laps[idx] = {"start": s, "end": e, "freq": lap_freq}

    print(f"[DEBUG] Split into {len(laps)} laps by resets at samples {resets}")

    if len(laps) == 0:
        raise ValueError("No laps detected in telemetry data")

    # Calculate lap distances using peak distance within each lap segment
    # (handles distance resets that occur at lap boundaries)
    max_dist = 0
    for ln, info in laps.items():
        s = int(info["start"] * dist_freq / lap_freq)
        e = int(info["end"] * dist_freq / lap_freq)
        e = min(e, len(dist_data) - 1)
        s = min(s, len(dist_data) - 1)
        dist_slice = dist_data[s : e + 1]
        lap_dist = float(np.max(dist_slice)) - float(np.min(dist_slice)) if len(dist_slice) > 0 else 0
        info["distance"] = lap_dist
        if lap_dist > max_dist:
            max_dist = lap_dist

    lap_dists = [(ln, round(info["distance"])) for ln, info in sorted(laps.items())[:10]]
    print(f"[DEBUG] Lap distances: {lap_dists}")

    # Filter complete laps (>90% of max distance)
    threshold = max_dist * 0.9
    complete_laps = {
        ln: info for ln, info in laps.items() if info["distance"] > threshold
    }

    if len(complete_laps) == 0:
        complete_laps = laps

    # Find fastest lap by sample count (proportional to time)
    best_lap = None
    best_samples = float("inf")
    for ln, info in complete_laps.items():
        n_samples = info["end"] - info["start"]
        if n_samples < best_samples and n_samples > 0:
            best_samples = n_samples
            best_lap = ln

    if best_lap is None:
        best_lap = list(complete_laps.keys())[0]

    info = complete_laps[best_lap]
    lap_time = best_samples / lap_freq

    # Extract all channels for this lap
    def extract(data, freq):
        s = int(info["start"] * freq / lap_freq)
        e = int(info["end"] * freq / lap_freq)
        s = max(0, min(s, len(data) - 1))
        e = max(s + 1, min(e, len(data)))
        return data[s:e]

    result = {"lap_time": lap_time, "lap_number": best_lap}

    # Speed
    result["speed"] = extract(speed_data, speed_freq)

    # Distance — unwrap resets so distance is monotonically increasing
    raw_dist = extract(dist_data, dist_freq)
    if len(raw_dist) > 1:
        # Unwrap distance resets: when distance drops, add the previous max
        unwrapped = np.empty_like(raw_dist)
        unwrapped[0] = raw_dist[0]
        offset = 0.0
        for i in range(1, len(raw_dist)):
            if raw_dist[i] < raw_dist[i - 1] - 50:
                offset += raw_dist[i - 1]
            unwrapped[i] = raw_dist[i] + offset
        raw_dist = unwrapped
    if len(raw_dist) > 0:
        raw_dist = raw_dist - raw_dist[0]
    result["dist"] = raw_dist

    # Throttle
    thr, thr_f = get_channel_data(channels,"throttle", "pos")
    if thr is None:
        thr, thr_f = get_channel_data(channels,"throttle")
    if thr is None:
        thr, thr_f = get_channel_data(channels,"thr")
    if thr is not None:
        result["throttle"] = extract(thr, thr_f)
    else:
        result["throttle"] = np.zeros_like(result["speed"])

    # Brake
    brk_name, brk_ch = find_channel(channels, "brake", "pos")
    if brk_ch is None:
        brk_name, brk_ch = find_channel(channels, "brake")
        # Skip "Brake Bias" / "Brake Temp" — we need actual pedal input
        if brk_name and any(x in brk_name.lower() for x in ["bias", "temp", "torque"]):
            brk_name, brk_ch = None, None
    if brk_ch is None:
        brk_name, brk_ch = find_channel(channels, "brk")
    if brk_ch is not None:
        brk = brk_ch["data"].copy()
        brk_f = brk_ch["freq"]
        print(f"[DEBUG] Brake channel '{brk_name}': freq={brk_f}, units='{brk_ch['units']}', "
              f"shift={brk_ch['shift']}, mul={brk_ch['mul']}, scale={brk_ch['scale']}, dec={brk_ch['dec']}, "
              f"dtype_a=0x{brk_ch['dtype_a']:02x}, dtype_v={brk_ch['dtype_v']}")
        print(f"[DEBUG] Brake raw data: min={brk.min():.4f}, max={brk.max():.4f}, mean={brk.mean():.4f}, std={brk.std():.4f}, samples={len(brk)}")
        print(f"[DEBUG] Brake first 20 values: {brk[:20].tolist()}")
        result["brake"] = extract(brk, brk_f)
    else:
        print(f"[DEBUG] No brake channel found!")
        result["brake"] = np.zeros_like(result["speed"])

    # Gear
    gear, gear_f = get_channel_data(channels,"gear")
    if gear is not None:
        result["gear"] = extract(gear, gear_f)
    else:
        result["gear"] = np.ones_like(result["speed"])

    # Steering
    steer, steer_f = get_channel_data(channels,"steer")
    if steer is not None:
        result["steering"] = extract(steer, steer_f)
    else:
        result["steering"] = np.zeros_like(result["speed"])

    # Coordinates XY
    cx, cx_f = get_channel_data(channels,"car", "coord", "x")
    cy, cy_f = get_channel_data(channels,"car", "coord", "y")
    if cx is not None and cy is not None:
        result["coord_x"] = extract(cx, cx_f)
        result["coord_y"] = extract(cy, cy_f)
    else:
        # Fallback: try pos x / pos y
        cx, cx_f = get_channel_data(channels,"pos", "x")
        cy, cy_f = get_channel_data(channels,"pos", "y")
        if cx is not None and cy is not None:
            result["coord_x"] = extract(cx, cx_f)
            result["coord_y"] = extract(cy, cy_f)
        else:
            result["coord_x"] = None
            result["coord_y"] = None

    return result


# ---------------------------------------------------------------------------
# Interpolation to common distance grid
# ---------------------------------------------------------------------------

def interp_to_dist(lap: dict, grid: np.ndarray) -> dict:
    """Interpolate all lap channels onto a common distance grid."""
    d = lap["dist"]
    if len(d) < 2:
        raise ValueError("Lap has too few samples")

    # Ensure distance is monotonically increasing
    # Remove any decreasing points
    mask = np.ones(len(d), dtype=bool)
    for i in range(1, len(d)):
        if d[i] <= d[i - 1]:
            mask[i] = False
    d = d[mask]

    def interp_ch(ch_name):
        arr = lap.get(ch_name)
        if arr is None:
            return None
        arr = arr[mask[: len(arr)]] if len(arr) >= len(mask) else arr
        if len(arr) < len(d):
            arr = np.pad(arr, (0, len(d) - len(arr)), mode="edge")
        elif len(arr) > len(d):
            arr = arr[: len(d)]
        return np.interp(grid, d, arr)

    result = {}
    for key in ["speed", "throttle", "brake", "gear", "steering"]:
        result[key] = interp_ch(key)
    for key in ["coord_x", "coord_y"]:
        result[key] = interp_ch(key)

    return result


# ---------------------------------------------------------------------------
# Procrustes piecewise alignment for XY coordinates
# ---------------------------------------------------------------------------

def align_xy_procrustes(
    target_x: np.ndarray,
    target_y: np.ndarray,
    source_x: np.ndarray,
    source_y: np.ndarray,
    dist_grid: np.ndarray,
    anchor_spacing: float = 20.0,
    window_radius: float = 300.0,
):
    """
    Piecewise Procrustes alignment of source coordinates onto target.
    """
    n = len(dist_grid)
    total_dist = dist_grid[-1]

    # Create anchor points
    n_anchors = max(2, int(total_dist / anchor_spacing))
    anchor_dists = np.linspace(0, total_dist, n_anchors)

    mapped_x = np.zeros(n)
    mapped_y = np.zeros(n)

    anchor_results_x = np.zeros(n_anchors)
    anchor_results_y = np.zeros(n_anchors)

    for ai, ad in enumerate(anchor_dists):
        # Gaussian weights centered on anchor
        weights = np.exp(-0.5 * ((dist_grid - ad) / (window_radius / 3)) ** 2)
        weights /= weights.sum() + 1e-12

        # Weighted least squares: [sx, sy, 1] -> tx
        A = np.column_stack([source_x, source_y, np.ones(n)])

        try:
            # Element-wise weighting (avoids creating n×n diagonal matrix)
            AW = A.T * weights
            coeffs_x = np.linalg.lstsq(AW @ A, AW @ target_x, rcond=None)[0]
            coeffs_y = np.linalg.lstsq(AW @ A, AW @ target_y, rcond=None)[0]
        except np.linalg.LinAlgError:
            coeffs_x = np.array([1.0, 0.0, 0.0])
            coeffs_y = np.array([0.0, 1.0, 0.0])

        # Find closest grid point to anchor
        idx = np.argmin(np.abs(dist_grid - ad))
        anchor_results_x[ai] = (
            coeffs_x[0] * source_x[idx]
            + coeffs_x[1] * source_y[idx]
            + coeffs_x[2]
        )
        anchor_results_y[ai] = (
            coeffs_y[0] * source_x[idx]
            + coeffs_y[1] * source_y[idx]
            + coeffs_y[2]
        )

    # Interpolate between anchor results
    mapped_x = np.interp(dist_grid, anchor_dists, anchor_results_x)
    mapped_y = np.interp(dist_grid, anchor_dists, anchor_results_y)

    return mapped_x, mapped_y


# ---------------------------------------------------------------------------
# Sector detection
# ---------------------------------------------------------------------------

def detect_sectors(speed: np.ndarray, brake: np.ndarray, throttle: np.ndarray, dist: np.ndarray):
    """Auto-detect braking zones as sectors."""
    n = len(speed)
    step = float(dist[1] - dist[0]) if n > 1 else 2.0

    # Smooth speed
    kernel = 10
    if n > kernel:
        smooth = np.convolve(speed, np.ones(kernel) / kernel, mode="same")
    else:
        smooth = speed

    # Find braking zones: brake > 15% for > 30m
    min_samples = max(1, int(30 / step))
    in_brake = brake > 15
    zones = []
    i = 0
    while i < n:
        if in_brake[i]:
            start = i
            while i < n and in_brake[i]:
                i += 1
            end = i
            if (end - start) >= min_samples:
                zones.append((start, end))
        i += 1

    # Expand zones
    sectors = []
    expand_before = max(1, int(50 / step))
    for zs, ze in zones:
        s = max(0, zs - expand_before)
        # Find where throttle returns to > 80%
        e = ze
        while e < n and throttle[e] < 80:
            e += 1
        e = min(e, n - 1)
        sectors.append((s, e))

    # Merge close sectors (< 100m gap)
    merge_gap = max(1, int(100 / step))
    merged = []
    for s, e in sectors:
        if merged and (s - merged[-1][1]) < merge_gap:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))

    return [(float(dist[s]), float(dist[e])) for s, e in merged]


# ---------------------------------------------------------------------------
# Delta calculation
# ---------------------------------------------------------------------------

def calc_time_delta(user_speed: np.ndarray, ref_speed: np.ndarray, dist: np.ndarray):
    """
    Calculate cumulative time delta.
    Positive = user is slower (losing time).
    """
    step = np.diff(dist, prepend=dist[0])
    # Time = distance / speed  (speed in kph -> m/s = speed / 3.6)
    user_spd = np.maximum(user_speed, 1.0)
    ref_spd = np.maximum(ref_speed, 1.0)

    user_dt = step / (user_spd / 3.6)
    ref_dt = step / (ref_spd / 3.6)

    delta = np.cumsum(user_dt - ref_dt)
    return delta


# ---------------------------------------------------------------------------
# Tips generation
# ---------------------------------------------------------------------------

def generate_tip(sector_name: str, user_min_speed: float, ref_min_speed: float) -> str:
    delta_speed = ref_min_speed - user_min_speed

    if delta_speed > 15:
        return (
            f"Huge gap: {delta_speed:.0f} kph less minimum speed. "
            f"You're braking too hard. Try braking a bit earlier with less pressure, "
            f"and keep some brake while turning (trail braking)."
        )
    elif delta_speed > 8:
        return (
            f"You lose {delta_speed:.0f} kph at the apex. "
            f"Brake a bit earlier with less pressure and carry more speed through the corner. "
            f"Trail braking will help load the front axle."
        )
    elif delta_speed > 3:
        return (
            f"Moderate gap: {delta_speed:.0f} kph. "
            f"A small braking and line adjustment can fix this. Study the reference line."
        )
    elif delta_speed > 0:
        return (
            f"Minimal difference ({delta_speed:.0f} kph). "
            f"This sector is pretty good. Focus on other sectors first."
        )
    else:
        return (
            f"You're faster here by {-delta_speed:.0f} kph! "
            f"Great job on this corner. Keep it consistent."
        )


# ---------------------------------------------------------------------------
# Main analysis pipeline
# ---------------------------------------------------------------------------

def analyze(user_buf: bytes, ref_buf: bytes) -> dict:
    # Detect .ldx companion files (XML, not telemetry data)
    for label, buf in [("User", user_buf), ("Reference", ref_buf)]:
        stripped = buf.lstrip()[:10]
        if stripped.startswith(b"<?xml") or stripped.startswith(b"<LDXFile"):
            raise ValueError(
                f"{label} file appears to be an .ldx (XML) companion file. "
                "Please upload the .ld telemetry file instead."
            )

    print(f"[DEBUG] User file: {len(user_buf)} bytes")
    print(f"[DEBUG] Ref file: {len(ref_buf)} bytes")

    user_channels = parse_channels(user_buf)
    ref_channels = parse_channels(ref_buf)

    print(f"[DEBUG] User channels ({len(user_channels)}): {list(user_channels.keys())}")
    print(f"[DEBUG] Ref channels ({len(ref_channels)}): {list(ref_channels.keys())}")

    user_driver, user_car, user_track = parse_header(user_buf)
    ref_driver, ref_car, ref_track = parse_header(ref_buf)

    print("[DEBUG] --- Extracting user lap ---")
    user_lap = extract_best_lap(user_channels)
    print(f"[DEBUG] User lap: time={user_lap['lap_time']:.3f}s, dist range=[{user_lap['dist'][0]:.1f}, {user_lap['dist'][-1]:.1f}]m, samples={len(user_lap['dist'])}")

    print("[DEBUG] --- Extracting ref lap ---")
    ref_lap = extract_best_lap(ref_channels)
    print(f"[DEBUG] Ref lap: time={ref_lap['lap_time']:.3f}s, dist range=[{ref_lap['dist'][0]:.1f}, {ref_lap['dist'][-1]:.1f}]m, samples={len(ref_lap['dist'])}")

    # Create common distance grid (2m resolution for HD, 6m for charts)
    max_dist = min(
        float(user_lap["dist"][-1]) if len(user_lap["dist"]) > 0 else 0,
        float(ref_lap["dist"][-1]) if len(ref_lap["dist"]) > 0 else 0,
    )
    if max_dist < 100:
        raise ValueError("Lap distance too short (< 100m)")

    hd_grid = np.arange(0, max_dist, 2.0)
    chart_grid = np.arange(0, max_dist, 6.0)

    user_hd = interp_to_dist(user_lap, hd_grid)
    ref_hd = interp_to_dist(ref_lap, hd_grid)
    user_chart = interp_to_dist(user_lap, chart_grid)
    ref_chart = interp_to_dist(ref_lap, chart_grid)

    # Align XY coordinates (Procrustes alignment for cross-file comparison)
    has_coords = (
        user_hd["coord_x"] is not None
        and user_hd["coord_y"] is not None
        and ref_hd["coord_x"] is not None
        and ref_hd["coord_y"] is not None
    )

    if has_coords:
        ref_aligned_x, ref_aligned_y = align_xy_procrustes(
            user_hd["coord_x"],
            user_hd["coord_y"],
            ref_hd["coord_x"],
            ref_hd["coord_y"],
            hd_grid,
        )
        ref_hd["coord_x"] = ref_aligned_x
        ref_hd["coord_y"] = ref_aligned_y

        ref_chart_aligned_x, ref_chart_aligned_y = align_xy_procrustes(
            user_chart["coord_x"],
            user_chart["coord_y"],
            ref_chart["coord_x"],
            ref_chart["coord_y"],
            chart_grid,
        )
        ref_chart["coord_x"] = ref_chart_aligned_x
        ref_chart["coord_y"] = ref_chart_aligned_y

    # Calculate time delta
    time_delta = calc_time_delta(user_chart["speed"], ref_chart["speed"], chart_grid)

    # Detect or match sectors
    track_name = user_track or ref_track
    circuit = match_circuit(track_name)

    if circuit:
        raw_sectors = [(s["start"], s["end"]) for s in circuit["sectors"]]
        sector_names = [s["name"] for s in circuit["sectors"]]
        circuit_name = circuit["name"]
    else:
        raw_sectors = detect_sectors(
            user_chart["speed"], user_chart["brake"], user_chart["throttle"], chart_grid
        )
        sector_names = [f"Corner {i + 1}" for i in range(len(raw_sectors))]
        circuit_name = None

    # Build sector info
    sectors = []
    for i, (ss, se) in enumerate(raw_sectors):
        # Find indices in chart grid
        mask = (chart_grid >= ss) & (chart_grid <= se)
        if not np.any(mask):
            continue
        idx = np.where(mask)[0]

        # Delta for this sector
        delta = float(time_delta[idx[-1]] - time_delta[idx[0]])

        # Min speeds
        u_min = float(np.min(user_chart["speed"][idx]))
        r_min = float(np.min(ref_chart["speed"][idx]))

        tip = generate_tip(sector_names[i], u_min, r_min)

        sectors.append(
            {
                "id": i,
                "name": sector_names[i],
                "start": float(ss),
                "end": float(se),
                "delta": round(delta, 3),
                "user_min_speed": round(u_min, 1),
                "ref_min_speed": round(r_min, 1),
                "tip": tip,
            }
        )

    # Build map coordinates (use user coords for circuit outline)
    map_x = user_chart["coord_x"]
    map_y = user_chart["coord_y"]
    if map_x is None:
        map_x = np.zeros(len(chart_grid))
        map_y = np.zeros(len(chart_grid))

    total_delta = float(time_delta[-1]) if len(time_delta) > 0 else 0.0

    # Build response
    def to_list(arr):
        if arr is None:
            return [0.0] * len(chart_grid)
        return [round(float(v), 3) for v in arr]

    def to_list_hd(arr):
        if arr is None:
            return [0.0] * len(hd_grid)
        return [round(float(v), 3) for v in arr]

    response = {
        "meta": {
            "user_driver": user_driver or "Driver",
            "ref_driver": ref_driver or "Reference",
            "car": user_car or ref_car or "Unknown",
            "track": track_name or "Unknown",
            "circuit_name": circuit_name,
            "user_lap_time": round(float(user_lap["lap_time"]), 3),
            "ref_lap_time": round(float(ref_lap["lap_time"]), 3),
            "total_delta": round(total_delta, 3),
        },
        "chart": {
            "dist": to_list(chart_grid),
            "user_speed": to_list(user_chart["speed"]),
            "ref_speed": to_list(ref_chart["speed"]),
            "user_throttle": to_list(user_chart["throttle"]),
            "ref_throttle": to_list(ref_chart["throttle"]),
            "user_brake": to_list(user_chart["brake"]),
            "ref_brake": to_list(ref_chart["brake"]),
            "user_gear": to_list(user_chart["gear"]),
            "ref_gear": to_list(ref_chart["gear"]),
            "delta_speed": to_list(user_chart["speed"] - ref_chart["speed"]
                                    if user_chart["speed"] is not None
                                    else None),
            "time_delta": to_list(time_delta),
            "map_x": to_list(map_x),
            "map_y": to_list(map_y),
        },
        "hd": {
            "dist": to_list_hd(hd_grid),
            "user_x": to_list_hd(user_hd["coord_x"]),
            "user_y": to_list_hd(user_hd["coord_y"]),
            "ref_x": to_list_hd(ref_hd["coord_x"]),
            "ref_y": to_list_hd(ref_hd["coord_y"]),
            "user_speed": to_list_hd(user_hd["speed"]),
            "ref_speed": to_list_hd(ref_hd["speed"]),
            "user_brake": to_list_hd(user_hd["brake"]),
            "ref_brake": to_list_hd(ref_hd["brake"]),
            "user_throttle": to_list_hd(user_hd["throttle"]),
            "ref_throttle": to_list_hd(ref_hd["throttle"]),
        },
        "sectors": sectors,
    }

    return response


# ---------------------------------------------------------------------------
# Multipart form data parser (minimal, for serverless)
# ---------------------------------------------------------------------------

def parse_multipart(body: bytes, content_type: str):
    """Parse multipart/form-data to extract file uploads."""
    # Extract boundary
    m = re.search(r"boundary=([^\s;]+)", content_type)
    if not m:
        raise ValueError("No boundary in content-type")
    boundary = m.group(1).encode()

    parts = body.split(b"--" + boundary)
    files = {}

    for part in parts:
        if b"Content-Disposition" not in part:
            continue
        # Find the header/body split
        header_end = part.find(b"\r\n\r\n")
        if header_end == -1:
            continue
        header = part[:header_end].decode("latin-1", errors="replace")
        file_data = part[header_end + 4 :]
        # Remove trailing \r\n
        if file_data.endswith(b"\r\n"):
            file_data = file_data[:-2]
        if file_data.endswith(b"--\r\n"):
            file_data = file_data[:-4]
        if file_data.endswith(b"--"):
            file_data = file_data[:-2]

        # Extract field name
        nm = re.search(r'name="([^"]+)"', header)
        if nm:
            files[nm.group(1)] = file_data

    return files


# ---------------------------------------------------------------------------
# Vercel serverless handler
# ---------------------------------------------------------------------------

def handler(request: Any) -> dict:
    """Vercel serverless function handler"""
    # Handle CORS preflight
    if request.method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        }

    if request.method != "POST":
        return {
            "statusCode": 405,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Method not allowed"}),
        }

    try:
        content_length = int(request.headers.get("Content-Length", 0))

        if content_length > 20 * 1024 * 1024:
            return {
                "statusCode": 413,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Files too large (max 10MB each)"}),
            }

        body = request.get_data()
        content_type = request.headers.get("Content-Type", "")
        files = parse_multipart(body, content_type)

        user_file = files.get("user_file")
        ref_file = files.get("ref_file")

        if not user_file or not ref_file:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Both user_file and ref_file are required"}),
            }

        result = analyze(user_file, ref_file)

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps(result),
        }

    except ValueError as e:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)}),
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": f"Analysis failed: {str(e)}"}),
        }
