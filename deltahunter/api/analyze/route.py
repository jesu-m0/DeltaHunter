"""
DeltaHunter – MoTeC i2 (.ld) telemetry parser and analysis endpoint.

Supports .ld files from Telemetrick, ACTI, and other MoTeC-compatible loggers.
Channel data is decoded using the standard header scaling: (raw / scale * 10^(-dec) + shift) * mul.
"""

from http.server import BaseHTTPRequestHandler
import json
import struct
import re
import gzip
import numpy as np


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
    """Find a channel by partial case-insensitive match on all keywords.
    Prefers shorter (more exact) channel names to avoid e.g. 'Gearbox Damage' when looking for 'Gear'."""
    matches = []
    for name, ch in channels.items():
        lower = name.lower()
        if all(k.lower() in lower for k in keywords):
            matches.append((name, ch))
    if not matches:
        return None, None
    # Return shortest match (most specific)
    matches.sort(key=lambda m: len(m[0]))
    return matches[0]



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

def extract_all_laps(channels: dict):
    """Extract all complete laps from the session. Returns (laps_list, best_index)."""
    # --- Lap number channel ---
    lap_data, lap_freq = None, 0
    for kw in [("lap", "number"), ("lap", "count"), ("session", "lap", "count")]:
        lap_data, lap_freq = get_channel_data(channels, *kw)
        if lap_data is not None:
            break
    if lap_data is None:
        for name, ch in channels.items():
            lower = name.lower()
            if "lap" in lower and ("num" in lower or "count" in lower or lower == "lap number"):
                lap_data, lap_freq = get_channel_data(channels, name)
                if lap_data is not None:
                    break

    # --- Distance channel ---
    dist_data, dist_freq = get_channel_data(channels, "lap", "dist")
    if dist_data is None:
        dist_data, dist_freq = get_channel_data(channels, "distance")

    # --- Speed channel ---
    speed_data, speed_freq = get_channel_data(channels, "ground", "speed")
    if speed_data is None:
        speed_data, speed_freq = get_channel_data(channels, "speed")
    if speed_data is None:
        speed_data, speed_freq = get_channel_data(channels, "gnd", "spd")
    if speed_data is None:
        raise ValueError("Missing essential channel: speed")

    # --- Compute distance from speed if needed ---
    if dist_data is None:
        dt = 1.0 / speed_freq if speed_freq > 0 else 1.0 / 20.0
        speed_ms = speed_data / 3.6
        dist_data = np.cumsum(speed_ms * dt)
        dist_freq = speed_freq

    # --- Detect lap boundaries ---
    resets = [0]
    for i in range(1, len(dist_data)):
        if dist_data[i] < dist_data[i - 1] - 50:
            resets.append(i)

    if len(resets) <= 1:
        lt_data, lt_freq = get_channel_data(channels, "lap", "time")
        if lt_data is not None and lt_freq > 0:
            resets = [0]
            for i in range(1, len(lt_data)):
                if lt_data[i] < lt_data[i - 1] - 1.0:
                    di = int(i * dist_freq / lt_freq)
                    if 0 < di < len(dist_data):
                        resets.append(di)

    if len(resets) <= 1 and lap_data is not None:
        resets = [0]
        for i in range(1, len(lap_data)):
            if lap_data[i] != lap_data[i - 1]:
                di = int(i * dist_freq / lap_freq)
                if 0 < di < len(dist_data):
                    resets.append(di)

    raw_laps = {}
    base_freq = dist_freq
    for idx in range(len(resets)):
        s = resets[idx]
        e = (resets[idx + 1] - 1) if idx + 1 < len(resets) else len(dist_data) - 1
        raw_laps[idx] = {"start": s, "end": e, "freq": base_freq}

    if len(raw_laps) == 0:
        raise ValueError("No laps detected in telemetry data")

    # Calculate distances and filter complete laps
    max_dist = 0
    for ln, info in raw_laps.items():
        s = min(int(info["start"]), len(dist_data) - 1)
        e = min(int(info["end"]), len(dist_data) - 1)
        dist_slice = dist_data[s : e + 1]
        lap_dist = float(np.max(dist_slice)) - float(np.min(dist_slice)) if len(dist_slice) > 0 else 0
        info["distance"] = lap_dist
        if lap_dist > max_dist:
            max_dist = lap_dist

    threshold = max_dist * 0.9
    complete_laps = {ln: info for ln, info in raw_laps.items() if info["distance"] > threshold}
    if len(complete_laps) == 0:
        complete_laps = raw_laps

    # --- Resolve channels once ---
    thr, thr_f = get_channel_data(channels, "throttle", "pos")
    if thr is None:
        thr, thr_f = get_channel_data(channels, "throttle")
    if thr is None:
        thr, thr_f = get_channel_data(channels, "thr")

    brk_name, brk_ch = find_channel(channels, "brake", "pos")
    if brk_ch is None:
        brk_name, brk_ch = find_channel(channels, "brake")
        if brk_name and any(x in brk_name.lower() for x in ["bias", "temp", "torque"]):
            brk_name, brk_ch = None, None
    if brk_ch is None:
        brk_name, brk_ch = find_channel(channels, "brk")
    brk = brk_ch["data"].copy() if brk_ch else None
    brk_f = brk_ch["freq"] if brk_ch else 0

    gear, gear_f = get_channel_data(channels, "gear")
    steer, steer_f = get_channel_data(channels, "steer")

    rpm, rpm_f = get_channel_data(channels, "engine", "rpm")
    if rpm is None:
        rpm, rpm_f = get_channel_data(channels, "rpm")

    fuel, fuel_f = get_channel_data(channels, "fuel", "level")
    if fuel is None:
        fuel, fuel_f = get_channel_data(channels, "fuel")

    g_lat, g_lat_f = get_channel_data(channels, "accel", "lateral")
    if g_lat is None:
        g_lat, g_lat_f = get_channel_data(channels, "cg", "accel", "lat")
    g_lon, g_lon_f = get_channel_data(channels, "accel", "longitudinal")
    if g_lon is None:
        g_lon, g_lon_f = get_channel_data(channels, "cg", "accel", "lon")

    abs_data, abs_f = get_channel_data(channels, "abs", "active")
    if abs_data is None:
        abs_data, abs_f = get_channel_data(channels, "abs")

    tc_data, tc_f = get_channel_data(channels, "tc", "active")
    if tc_data is None:
        tc_data, tc_f = get_channel_data(channels, "traction", "control")

    cx, cx_f = get_channel_data(channels, "car", "coord", "x")
    cy, cy_f = get_channel_data(channels, "car", "coord", "y")
    if cx is None or cy is None:
        cx, cx_f = get_channel_data(channels, "pos", "x")
        cy, cy_f = get_channel_data(channels, "pos", "y")

    # --- Extract each complete lap ---
    results = []
    best_index = 0
    best_samples = float("inf")

    for lap_idx, (ln, info) in enumerate(sorted(complete_laps.items())):
        n_samples = info["end"] - info["start"]
        if n_samples <= 0:
            continue
        lap_time = n_samples / base_freq

        def extract(data, freq):
            s = int(info["start"] * freq / base_freq)
            e = int(info["end"] * freq / base_freq)
            s = max(0, min(s, len(data) - 1))
            e = max(s + 1, min(e, len(data)))
            return data[s:e]

        lap_result = {"lap_time": lap_time, "lap_number": ln}

        lap_result["speed"] = extract(speed_data, speed_freq)

        # Distance — unwrap resets
        raw_d = extract(dist_data, dist_freq)
        if len(raw_d) > 1:
            unwrapped = np.empty_like(raw_d)
            unwrapped[0] = raw_d[0]
            offset = 0.0
            for i in range(1, len(raw_d)):
                if raw_d[i] < raw_d[i - 1] - 50:
                    offset += raw_d[i - 1]
                unwrapped[i] = raw_d[i] + offset
            raw_d = unwrapped
        if len(raw_d) > 0:
            raw_d = raw_d - raw_d[0]
        lap_result["dist"] = raw_d

        lap_result["throttle"] = extract(thr, thr_f) if thr is not None else np.zeros_like(lap_result["speed"])
        lap_result["brake"] = extract(brk, brk_f) if brk is not None else np.zeros_like(lap_result["speed"])
        lap_result["gear"] = extract(gear, gear_f) if gear is not None else np.ones_like(lap_result["speed"])
        lap_result["steering"] = extract(steer, steer_f) if steer is not None else np.zeros_like(lap_result["speed"])

        if cx is not None and cy is not None:
            lap_result["coord_x"] = extract(cx, cx_f)
            lap_result["coord_y"] = extract(cy, cy_f)
        else:
            lap_result["coord_x"] = None
            lap_result["coord_y"] = None

        lap_result["rpm"] = extract(rpm, rpm_f) if rpm is not None else None
        lap_result["fuel"] = extract(fuel, fuel_f) if fuel is not None else None
        lap_result["g_lat"] = extract(g_lat, g_lat_f) if g_lat is not None else None
        lap_result["g_lon"] = extract(g_lon, g_lon_f) if g_lon is not None else None
        lap_result["abs"] = extract(abs_data, abs_f) if abs_data is not None else None
        lap_result["tc"] = extract(tc_data, tc_f) if tc_data is not None else None

        if n_samples < best_samples:
            best_samples = n_samples
            best_index = len(results)

        results.append(lap_result)

    if len(results) == 0:
        raise ValueError("No complete laps found")

    return results, best_index


def extract_best_lap(channels: dict):
    """Legacy wrapper — returns only the best lap."""
    laps, best_idx = extract_all_laps(channels)
    return laps[best_idx]


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
        if len(arr) == len(mask):
            arr = arr[mask]
        else:
            # Different length (different freq) — resample to match dist length
            orig_len = len(arr)
            target_len = len(d)
            if orig_len > 1 and target_len > 1:
                x_old = np.linspace(0, 1, orig_len)
                x_new = np.linspace(0, 1, target_len)
                arr = np.interp(x_new, x_old, arr)
            elif target_len > 0:
                arr = np.full(target_len, arr[0] if len(arr) > 0 else 0.0)
        if len(arr) < len(d):
            arr = np.pad(arr, (0, len(d) - len(arr)), mode="edge")
        elif len(arr) > len(d):
            arr = arr[: len(d)]
        return np.interp(grid, d, arr)

    result = {}
    for key in ["speed", "throttle", "brake", "gear", "steering", "rpm", "fuel", "g_lat", "g_lon", "abs", "tc"]:
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

def generate_tip(sector_name: str, user_min_speed: float, ref_min_speed: float,
                  user_trail: float = 0.0, ref_trail: float = 0.0) -> str:
    delta_speed = ref_min_speed - user_min_speed
    trail_diff = ref_trail - user_trail

    trail_tip = ""
    if trail_diff > 20:
        trail_tip = (
            f" Reference trails the brake {trail_diff:.0f}% more into the corner. "
            f"Try maintaining light brake pressure while turning in."
        )
    elif trail_diff < -20:
        trail_tip = (
            f" You trail brake more than the reference here — "
            f"make sure you're not overloading the front tyres."
        )

    if delta_speed > 15:
        return (
            f"Huge gap: {delta_speed:.0f} kph less minimum speed. "
            f"You're braking too hard. Try braking a bit earlier with less pressure, "
            f"and keep some brake while turning (trail braking).{trail_tip}"
        )
    elif delta_speed > 8:
        return (
            f"You lose {delta_speed:.0f} kph at the apex. "
            f"Brake a bit earlier with less pressure and carry more speed through the corner.{trail_tip}"
        )
    elif delta_speed > 3:
        return (
            f"Moderate gap: {delta_speed:.0f} kph. "
            f"A small braking and line adjustment can fix this.{trail_tip}"
        )
    elif delta_speed > 0:
        return (
            f"Minimal difference ({delta_speed:.0f} kph). "
            f"This sector is pretty good. Focus on other sectors first.{trail_tip}"
        )
    else:
        return (
            f"You're faster here by {-delta_speed:.0f} kph! "
            f"Great job on this corner. Keep it consistent.{trail_tip}"
        )


# ---------------------------------------------------------------------------
# Main analysis pipeline
# ---------------------------------------------------------------------------

def parse_single(buf: bytes, label: str = "File") -> dict:
    """Parse a single .ld file and return all laps as serializable data."""
    stripped = buf.lstrip()[:10]
    if stripped.startswith(b"<?xml") or stripped.startswith(b"<LDXFile"):
        raise ValueError(
            f"{label} file appears to be an .ldx (XML) companion file. "
            "Please upload the .ld telemetry file instead."
        )

    channels = parse_channels(buf)
    driver, car, track = parse_header(buf)
    all_laps, best_index = extract_all_laps(channels)

    def arr_to_list(arr):
        if arr is None:
            return None
        return [round(float(v), 4) for v in arr]

    laps = []
    for i, lap in enumerate(all_laps):
        laps.append({
            "lap_time": float(lap["lap_time"]),
            "lap_number": int(lap["lap_number"]),
            "is_best": i == best_index,
            "speed": arr_to_list(lap["speed"]),
            "dist": arr_to_list(lap["dist"]),
            "throttle": arr_to_list(lap["throttle"]),
            "brake": arr_to_list(lap["brake"]),
            "gear": arr_to_list(lap["gear"]),
            "steering": arr_to_list(lap["steering"]),
            "coord_x": arr_to_list(lap.get("coord_x")),
            "coord_y": arr_to_list(lap.get("coord_y")),
            "rpm": arr_to_list(lap.get("rpm")),
            "fuel": arr_to_list(lap.get("fuel")),
            "g_lat": arr_to_list(lap.get("g_lat")),
            "g_lon": arr_to_list(lap.get("g_lon")),
            "abs": arr_to_list(lap.get("abs")),
            "tc": arr_to_list(lap.get("tc")),
        })

    return {
        "driver": driver,
        "car": car,
        "track": track,
        "best_index": best_index,
        "laps": laps,
    }


def _lap_from_parsed(parsed: dict) -> dict:
    """Reconstruct numpy lap dict from parsed JSON data."""
    def to_arr(lst):
        if lst is None:
            return None
        return np.array(lst, dtype=np.float64)

    return {
        "lap_time": parsed["lap_time"],
        "lap_number": parsed["lap_number"],
        "speed": to_arr(parsed["speed"]),
        "dist": to_arr(parsed["dist"]),
        "throttle": to_arr(parsed["throttle"]),
        "brake": to_arr(parsed["brake"]),
        "gear": to_arr(parsed["gear"]),
        "steering": to_arr(parsed["steering"]),
        "coord_x": to_arr(parsed.get("coord_x")),
        "coord_y": to_arr(parsed.get("coord_y")),
        "rpm": to_arr(parsed.get("rpm")),
        "fuel": to_arr(parsed.get("fuel")),
        "g_lat": to_arr(parsed.get("g_lat")),
        "g_lon": to_arr(parsed.get("g_lon")),
        "abs": to_arr(parsed.get("abs")),
        "tc": to_arr(parsed.get("tc")),
    }


def analyze_from_parsed(user_parsed: dict, ref_parsed: dict,
                        user_lap_index: int = -1, ref_lap_index: int = -1) -> dict:
    """Run comparison analysis from pre-parsed session data.

    Supports both old single-lap format and new multi-lap format.
    user_lap_index/ref_lap_index: -1 means use best lap.
    """
    # Support new multi-lap format
    if "laps" in user_parsed:
        idx = user_lap_index if user_lap_index >= 0 else user_parsed.get("best_index", 0)
        user_lap_data = user_parsed["laps"][idx]
    else:
        user_lap_data = user_parsed

    if "laps" in ref_parsed:
        idx = ref_lap_index if ref_lap_index >= 0 else ref_parsed.get("best_index", 0)
        ref_lap_data = ref_parsed["laps"][idx]
    else:
        ref_lap_data = ref_parsed

    user_lap = _lap_from_parsed(user_lap_data)
    ref_lap = _lap_from_parsed(ref_lap_data)

    user_driver = user_parsed.get("driver", "Driver")
    user_car = user_parsed.get("car", "")
    user_track = user_parsed.get("track", "")
    ref_driver = ref_parsed.get("driver", "Reference")
    ref_car = ref_parsed.get("car", "")
    ref_track = ref_parsed.get("track", "")

    return _compare_laps(
        user_lap, ref_lap,
        user_driver, ref_driver,
        user_car, ref_car,
        user_track, ref_track,
    )


def _compare_laps(
    user_lap, ref_lap,
    user_driver, ref_driver,
    user_car, ref_car,
    user_track, ref_track,
) -> dict:
    """Core comparison logic shared by both analyze paths."""
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

    has_coords = (
        user_hd["coord_x"] is not None
        and user_hd["coord_y"] is not None
        and ref_hd["coord_x"] is not None
        and ref_hd["coord_y"] is not None
    )

    if has_coords:
        ref_aligned_x, ref_aligned_y = align_xy_procrustes(
            user_hd["coord_x"], user_hd["coord_y"],
            ref_hd["coord_x"], ref_hd["coord_y"],
            hd_grid,
        )
        ref_hd["coord_x"] = ref_aligned_x
        ref_hd["coord_y"] = ref_aligned_y

        ref_chart_aligned_x, ref_chart_aligned_y = align_xy_procrustes(
            user_chart["coord_x"], user_chart["coord_y"],
            ref_chart["coord_x"], ref_chart["coord_y"],
            chart_grid,
        )
        ref_chart["coord_x"] = ref_chart_aligned_x
        ref_chart["coord_y"] = ref_chart_aligned_y

    time_delta = calc_time_delta(user_chart["speed"], ref_chart["speed"], chart_grid)

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

    sectors = []
    for i, (ss, se) in enumerate(raw_sectors):
        mask = (chart_grid >= ss) & (chart_grid <= se)
        if not np.any(mask):
            continue
        idx = np.where(mask)[0]
        delta = float(time_delta[idx[-1]] - time_delta[idx[0]])
        u_min = float(np.min(user_chart["speed"][idx]))
        r_min = float(np.min(ref_chart["speed"][idx]))

        # Trail braking: % of braking zone where brake > 5% AND |steering| > 5 deg
        u_brk_s = user_chart["brake"][idx] if user_chart["brake"] is not None else np.zeros(len(idx))
        u_str_s = user_chart["steering"][idx] if user_chart["steering"] is not None else np.zeros(len(idx))
        r_brk_s = ref_chart["brake"][idx] if ref_chart["brake"] is not None else np.zeros(len(idx))
        r_str_s = ref_chart["steering"][idx] if ref_chart["steering"] is not None else np.zeros(len(idx))

        u_braking = u_brk_s > 5
        u_trail = u_braking & (np.abs(u_str_s) > 5)
        u_trail_score = float(np.sum(u_trail) / max(np.sum(u_braking), 1) * 100)

        r_braking = r_brk_s > 5
        r_trail = r_braking & (np.abs(r_str_s) > 5)
        r_trail_score = float(np.sum(r_trail) / max(np.sum(r_braking), 1) * 100)

        # Braking point: first distance in sector where brake > 5%
        sector_dist = chart_grid[idx]
        def brake_point(brk):
            hits = np.where(brk > 5)[0]
            return float(sector_dist[hits[0]]) if len(hits) > 0 else None

        # Throttle-on point: first distance after min-speed where throttle > 95%
        def throttle_on_point(thr, spd):
            min_idx = int(np.argmin(spd))
            after = thr[min_idx:]
            hits = np.where(after > 95)[0]
            return float(sector_dist[min_idx + hits[0]]) if len(hits) > 0 else None

        u_thr_s = user_chart["throttle"][idx] if user_chart["throttle"] is not None else np.zeros(len(idx))
        r_thr_s = ref_chart["throttle"][idx] if ref_chart["throttle"] is not None else np.zeros(len(idx))

        u_brake_point = brake_point(u_brk_s)
        r_brake_point = brake_point(r_brk_s)
        u_throttle_on = throttle_on_point(u_thr_s, user_chart["speed"][idx])
        r_throttle_on = throttle_on_point(r_thr_s, ref_chart["speed"][idx])

        tip = generate_tip(sector_names[i], u_min, r_min, u_trail_score, r_trail_score)
        sectors.append({
            "id": i,
            "name": sector_names[i],
            "start": float(ss),
            "end": float(se),
            "delta": round(delta, 3),
            "user_min_speed": round(u_min, 1),
            "ref_min_speed": round(r_min, 1),
            "user_trail_score": round(u_trail_score, 1),
            "ref_trail_score": round(r_trail_score, 1),
            "user_brake_point": round(u_brake_point, 1) if u_brake_point is not None else None,
            "ref_brake_point": round(r_brake_point, 1) if r_brake_point is not None else None,
            "user_throttle_on": round(u_throttle_on, 1) if u_throttle_on is not None else None,
            "ref_throttle_on": round(r_throttle_on, 1) if r_throttle_on is not None else None,
            "tip": tip,
        })

    map_x = user_chart["coord_x"]
    map_y = user_chart["coord_y"]
    if map_x is None:
        map_x = np.zeros(len(chart_grid))
        map_y = np.zeros(len(chart_grid))

    total_delta = float(time_delta[-1]) if len(time_delta) > 0 else 0.0

    def to_list(arr):
        if arr is None:
            return [0.0] * len(chart_grid)
        return [round(float(v), 3) for v in arr]

    def to_list_hd(arr):
        if arr is None:
            return [0.0] * len(hd_grid)
        return [round(float(v), 3) for v in arr]

    return {
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
            "user_steering": to_list(user_chart["steering"]),
            "ref_steering": to_list(ref_chart["steering"]),
            "user_rpm": to_list(user_chart.get("rpm")),
            "ref_rpm": to_list(ref_chart.get("rpm")),
            "user_fuel": to_list(user_chart.get("fuel")),
            "ref_fuel": to_list(ref_chart.get("fuel")),
            "user_g_lat": to_list(user_chart.get("g_lat")),
            "ref_g_lat": to_list(ref_chart.get("g_lat")),
            "user_g_lon": to_list(user_chart.get("g_lon")),
            "ref_g_lon": to_list(ref_chart.get("g_lon")),
            "user_abs": to_list(user_chart.get("abs")),
            "ref_abs": to_list(ref_chart.get("abs")),
            "user_tc": to_list(user_chart.get("tc")),
            "ref_tc": to_list(ref_chart.get("tc")),
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
            "user_steering": to_list_hd(user_hd["steering"]),
            "ref_steering": to_list_hd(ref_hd["steering"]),
            "user_rpm": to_list_hd(user_hd.get("rpm")),
            "ref_rpm": to_list_hd(ref_hd.get("rpm")),
            "user_g_lat": to_list_hd(user_hd.get("g_lat")),
            "ref_g_lat": to_list_hd(ref_hd.get("g_lat")),
            "user_g_lon": to_list_hd(user_hd.get("g_lon")),
            "ref_g_lon": to_list_hd(ref_hd.get("g_lon")),
            "user_abs": to_list_hd(user_hd.get("abs")),
            "ref_abs": to_list_hd(ref_hd.get("abs")),
            "user_tc": to_list_hd(user_hd.get("tc")),
            "ref_tc": to_list_hd(ref_hd.get("tc")),
        },
        "sectors": sectors,
    }


def analyze(user_buf: bytes, ref_buf: bytes) -> dict:
    """Full analysis from two raw .ld buffers (used by dev server)."""
    user_parsed = parse_single(user_buf, "User")
    ref_parsed = parse_single(ref_buf, "Reference")
    return analyze_from_parsed(user_parsed, ref_parsed)


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

def _maybe_decompress(data: bytes) -> bytes:
    """Decompress gzip data if detected, otherwise return as-is."""
    if data[:2] == b'\x1f\x8b':
        return gzip.decompress(data)
    return data


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            content_type = self.headers.get("Content-Type", "")
            path = self.path.split("?")[0].rstrip("/")

            if content_length > 20 * 1024 * 1024:
                self._error(413, "File too large (max 10MB)")
                return

            body = self.rfile.read(content_length)

            if path.endswith("/parse"):
                # Step 1: parse a single .ld file
                files = parse_multipart(body, content_type)
                ld_file = files.get("file")
                if not ld_file:
                    self._error(400, "Missing 'file' field")
                    return
                ld_file = _maybe_decompress(ld_file)
                result = parse_single(ld_file)

            elif path.endswith("/compare"):
                # Step 2: compare two pre-parsed laps (JSON)
                payload = json.loads(body)
                user_parsed = payload.get("user_lap")
                ref_parsed = payload.get("ref_lap")
                if not user_parsed or not ref_parsed:
                    self._error(400, "Both user_lap and ref_lap are required")
                    return
                user_lap_index = payload.get("user_lap_index", -1)
                ref_lap_index = payload.get("ref_lap_index", -1)
                result = analyze_from_parsed(user_parsed, ref_parsed,
                                             user_lap_index, ref_lap_index)

            else:
                # Legacy: both files in one request
                files = parse_multipart(body, content_type)
                user_file = files.get("user_file")
                ref_file = files.get("ref_file")
                if not user_file or not ref_file:
                    self._error(400, "Both user_file and ref_file are required")
                    return
                user_file = _maybe_decompress(user_file)
                ref_file = _maybe_decompress(ref_file)
                result = analyze(user_file, ref_file)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())

        except ValueError as e:
            self._error(400, str(e))
        except Exception as e:
            self._error(500, f"Analysis failed: {str(e)}")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _error(self, code: int, msg: str):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"error": msg}).encode())
