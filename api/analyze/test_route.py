"""
Parser and comparison tests against the sample .ld files bundled in public/.
Run from the repo root: python -m pytest api/analyze/
"""

import glob
import os

import pytest

from route import analyze_from_parsed, parse_single, validate_ld

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PUBLIC = os.path.join(REPO_ROOT, "public")

SAMPLES = sorted(glob.glob(os.path.join(PUBLIC, "**", "*.ld"), recursive=True))

IMOLA_USER = glob.glob(os.path.join(PUBLIC, "imola", "jesu_m0", "*.ld"))[0]
IMOLA_REF = glob.glob(os.path.join(PUBLIC, "imola", "cavalli", "*.ld"))[0]


def read_sample(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


# ---------------------------------------------------------------------------
# parse_single
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("path", SAMPLES, ids=[os.path.basename(p) for p in SAMPLES])
def test_parse_sample(path):
    parsed = parse_single(read_sample(path))

    assert parsed["driver"]
    assert parsed["track"]
    assert len(parsed["laps"]) >= 1
    assert 0 <= parsed["best_index"] < len(parsed["laps"])

    best = parsed["laps"][parsed["best_index"]]
    assert best["is_best"]
    # Best lap must actually be the fastest
    assert best["lap_time"] == min(lap["lap_time"] for lap in parsed["laps"])

    for lap in parsed["laps"]:
        # Sane lap time for a racing circuit
        assert 30 < lap["lap_time"] < 600
        # Core channels present and consistent
        assert len(lap["dist"]) > 100
        assert len(lap["speed"]) > 100
        for ch in ("throttle", "brake", "gear", "steering"):
            assert lap[ch] is not None and len(lap[ch]) > 0
        # Distance covers a full lap and starts at 0
        assert lap["dist"][0] == 0
        assert lap["dist"][-1] > 3000


def test_parse_detects_known_circuits():
    imola = parse_single(read_sample(IMOLA_USER))
    assert "imola" in imola["track"].lower()


# ---------------------------------------------------------------------------
# validate_ld
# ---------------------------------------------------------------------------

def test_validate_rejects_garbage():
    with pytest.raises(ValueError, match="doesn't look like a MoTeC"):
        validate_ld(b"\x00" * 4096)


def test_validate_rejects_short_buffer():
    with pytest.raises(ValueError, match="doesn't look like a MoTeC"):
        validate_ld(b"tiny")


def test_validate_rejects_ldx_xml():
    ldx = b'<?xml version="1.0"?><LDXFile></LDXFile>' + b" " * 2000
    with pytest.raises(ValueError, match="ldx"):
        validate_ld(ldx)


def test_validate_accepts_real_ld():
    validate_ld(read_sample(IMOLA_USER))


# ---------------------------------------------------------------------------
# analyze_from_parsed
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def imola_sessions():
    return (
        parse_single(read_sample(IMOLA_USER)),
        parse_single(read_sample(IMOLA_REF)),
    )


def test_compare_response_shape(imola_sessions):
    user, ref = imola_sessions
    result = analyze_from_parsed(user, ref)

    assert set(result.keys()) == {"meta", "chart", "hd", "sectors"}

    meta = result["meta"]
    assert meta["user_lap_time"] > 30
    assert meta["ref_lap_time"] > 30
    # Named circuit resolved
    assert meta["circuit_name"] and "Imola" in meta["circuit_name"]

    chart = result["chart"]
    n = len(chart["dist"])
    assert n > 100
    for key in ("user_speed", "ref_speed", "time_delta", "map_x", "map_y"):
        assert len(chart[key]) == n

    # Imola has 7 hand-tuned sectors
    assert len(result["sectors"]) == 7
    for s in result["sectors"]:
        assert s["end"] > s["start"]
        assert s["user_min_speed"] > 0
        assert s["ref_min_speed"] > 0
        assert s["tip"]


def test_compare_delta_matches_lap_times(imola_sessions):
    user, ref = imola_sessions
    result = analyze_from_parsed(user, ref)
    meta = result["meta"]
    lap_diff = meta["user_lap_time"] - meta["ref_lap_time"]
    # The delta trace is reconciled to end at the real lap-time difference
    assert result["chart"]["time_delta"][-1] == pytest.approx(lap_diff, abs=0.01)
    assert meta["total_delta"] == pytest.approx(lap_diff, abs=0.01)


def test_compare_single_lap_payload(imola_sessions):
    """The frontend sends bare lap dicts (no 'laps' wrapper) to keep the
    compare payload small — that path must produce the same result."""
    user, ref = imola_sessions
    user_lap = user["laps"][user["best_index"]]
    ref_lap = ref["laps"][ref["best_index"]]

    slim_user = {**user_lap, "driver": user["driver"], "car": user["car"], "track": user["track"]}
    slim_ref = {**ref_lap, "driver": ref["driver"], "car": ref["car"], "track": ref["track"]}

    full = analyze_from_parsed(user, ref)
    slim = analyze_from_parsed(slim_user, slim_ref)

    assert slim["meta"] == full["meta"]
    assert slim["chart"]["time_delta"] == full["chart"]["time_delta"]
    assert len(slim["sectors"]) == len(full["sectors"])


def test_compare_lap_index_out_of_range(imola_sessions):
    user, ref = imola_sessions
    with pytest.raises(ValueError, match="out of range"):
        analyze_from_parsed(user, ref, user_lap_index=999)
    with pytest.raises(ValueError, match="out of range"):
        analyze_from_parsed(user, ref, ref_lap_index=999)


def test_compare_lap_index_wrong_type(imola_sessions):
    user, ref = imola_sessions
    with pytest.raises(ValueError, match="integer"):
        analyze_from_parsed(user, ref, user_lap_index="2")
