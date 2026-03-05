import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo

from bleak import BleakScanner

TZ = ZoneInfo("America/Los_Angeles")

BEACON_MAC = "C8:5B:DF:4A:E0:24"
SERVICE_UUID = "00005242-0000-1000-8000-00805f9b34fb"
MOTION_BYTE_INDEX = 11

last_motion_flag = None
motion_start = None


def beacon_callback(device, ad):
    global last_motion_flag, motion_start

    if device.address.upper() != BEACON_MAC.upper():
        return

    if not ad.service_data or SERVICE_UUID not in ad.service_data:
        return

    service_data = ad.service_data[SERVICE_UUID]
    ts = datetime.now(TZ).strftime("%H:%M:%S")

    if len(service_data) <= MOTION_BYTE_INDEX:
        print(f"[{ts}] Service data too short: {len(service_data)} bytes")
        return

    motion_flag = service_data[MOTION_BYTE_INDEX]

    # Only print when motion flag changes
    if motion_flag != last_motion_flag:
        if motion_flag == 1:
            motion_start = datetime.now(TZ)
            print(f"[{ts}] MOTION FLAG: 1 (motion started)")
        else:
            if motion_start:
                duration = (datetime.now(TZ) - motion_start).total_seconds()
                print(f"[{ts}] MOTION FLAG: 0 (motion ended after {duration:.1f}s)")
            else:
                print(f"[{ts}] MOTION FLAG: 0")
            motion_start = None
        last_motion_flag = motion_flag


async def main():
    print("=== BEACON TEST MODE ===")
    print(f"Listening for beacon {BEACON_MAC}")
    print("Move the beacon and watch the motion flag changes...")
    print("Press Ctrl+C to stop\n")

    scanner = BleakScanner(beacon_callback)
    await scanner.start()

    try:
        start_time = datetime.now(TZ)
        while True:
            elapsed = (datetime.now(TZ) - start_time).total_seconds()
            ts = datetime.now(TZ).strftime("%H:%M:%S")
            status = "IN_MOTION" if last_motion_flag == 1 else "idle"
            print(f"[{ts}] {elapsed:.0f}s elapsed - status: {status}", flush=True)
            await asyncio.sleep(5)
    finally:
        await scanner.stop()


asyncio.run(main())
