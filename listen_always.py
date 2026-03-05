import asyncio
import csv
import subprocess
import time
from collections import deque
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from bleak import BleakScanner

TZ = ZoneInfo("America/Los_Angeles")

BEACON_MAC = "C8:5B:DF:4A:E0:24"
CSV_FILE = Path.home() / "beacon_events.csv"
SYNC_SCRIPT = Path(__file__).parent / "sync_csv_api.sh"

# Beacon service data
SERVICE_UUID = "00005242-0000-1000-8000-00805f9b34fb"
MOTION_BYTE_INDEX = 11

# Detection settings
MOTION_TIMEOUT_SECONDS = 7.0    # No flags for 7s = motion ended (handles sporadic late flags)
MIN_FLAGS_FOR_MOTION = 2        # Motion flags needed to confirm motion started

# Feeding detection: a motion period > 25s indicates actual feeding (not a bump)
# Single bump = ~20s (beacon timeout), so 25s requires at least some sustained activity
MIN_DURATION_FOR_FEEDING = 25.0  # Motion must last this long to count as feeding

# Track motion state
motion_detections: deque = deque()  # Timestamps of motion flag detections
in_motion = False                   # Currently detecting motion?
motion_start_ts = 0.0               # When current motion period started


def ensure_csv():
    if not CSV_FILE.exists():
        with open(CSV_FILE, "w", newline="") as f:
            csv.writer(f).writerow(
                ["timestamp", "beacon_mac", "duration_seconds", "event"]
            )


def log_feeding(duration_seconds: int):
    """Log a confirmed feeding event to CSV and trigger sync."""
    ensure_csv()
    ts = datetime.now(TZ).isoformat(timespec="seconds")
    with open(CSV_FILE, "a", newline="") as f:
        csv.writer(f).writerow(
            [ts, BEACON_MAC.upper(), duration_seconds, "feeding"]
        )
    print(f"[FEEDING LOGGED] {ts} - {duration_seconds}s of activity!", flush=True)

    # Trigger sync to GitHub
    if SYNC_SCRIPT.exists():
        try:
            subprocess.Popen(
                ["/bin/bash", str(SYNC_SCRIPT)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            print("[SYNC] Triggered GitHub upload", flush=True)
        except Exception as e:
            print(f"[SYNC ERROR] {e}", flush=True)


def beacon_callback(device, ad):
    """Called for each BLE advertisement received."""
    if device.address.upper() != BEACON_MAC.upper():
        return

    if not ad.service_data or SERVICE_UUID not in ad.service_data:
        return

    service_data = ad.service_data[SERVICE_UUID]

    if len(service_data) <= MOTION_BYTE_INDEX:
        return

    motion_flag = service_data[MOTION_BYTE_INDEX]

    if motion_flag == 1:
        motion_detections.append(time.time())


async def main():
    global in_motion, motion_start_ts

    print("Listening for feeding events (motion flag detection)...", flush=True)
    print(f"  - Motion timeout: {MOTION_TIMEOUT_SECONDS}s (motion must stop this long)", flush=True)
    print(f"  - Feeding: motion period > {MIN_DURATION_FOR_FEEDING}s", flush=True)

    scanner = BleakScanner(beacon_callback)
    await scanner.start()

    try:
        last_status_print = 0.0

        while True:
            now = time.time()

            # Remove old motion flag detections (keep last 5 seconds)
            while motion_detections and motion_detections[0] < now - 5.0:
                motion_detections.popleft()

            recent_flags = len(motion_detections)

            # State machine: detect motion start and stop
            if not in_motion:
                # Not currently in motion - check if motion started
                if recent_flags >= MIN_FLAGS_FOR_MOTION:
                    in_motion = True
                    motion_start_ts = now
                    print(f"[MOTION START] {datetime.now(TZ).strftime('%H:%M:%S')}", flush=True)
            else:
                # Currently in motion - check if motion stopped
                # Motion stops when we haven't seen flags for MOTION_TIMEOUT_SECONDS
                last_flag_ts = motion_detections[-1] if motion_detections else motion_start_ts
                time_since_last_flag = now - last_flag_ts

                if time_since_last_flag >= MOTION_TIMEOUT_SECONDS:
                    # Motion ended
                    in_motion = False
                    duration = now - motion_start_ts - MOTION_TIMEOUT_SECONDS
                    print(f"[MOTION END] Duration ~{duration:.1f}s", flush=True)

                    # If motion lasted long enough, it's a feeding
                    if duration >= MIN_DURATION_FOR_FEEDING:
                        log_feeding(int(duration))
                    else:
                        print(f"  (too short for feeding, need >{MIN_DURATION_FOR_FEEDING}s)", flush=True)

            # Status print every 10 seconds
            if now - last_status_print >= 10:
                ts = datetime.now(TZ).strftime("%Y-%m-%d %H:%M:%S")
                motion_status = "IN_MOTION" if in_motion else "idle"
                current_duration = now - motion_start_ts if in_motion else 0
                print(
                    f"[{ts}] flags={recent_flags} status={motion_status} duration={current_duration:.0f}s",
                    flush=True,
                )
                last_status_print = now

            await asyncio.sleep(0.2)

    finally:
        await scanner.stop()


asyncio.run(main())
