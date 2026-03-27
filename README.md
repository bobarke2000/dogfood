# WOOF — Wireless Observation Of Feeding

A BLE-based dog feeding tracker. A motion beacon on the food container detects when the bowl is being used. A Raspberry Pi listens for the beacon and logs feeding events to a CSV, which gets pushed to GitHub. A Next.js web app reads the CSV directly from GitHub and shows whether breakfast and dinner have happened today.

## How it works

```
[BLE Beacon on food bowl]
        ↓ BLE advertisement
[Raspberry Pi]
  → listen_always.py detects motion bursts
  → logs feeding event to beacon_events.csv
  → sync_csv_api.sh pushes CSV to GitHub
        ↓ raw CSV via GitHub
[Next.js web app]
  → polls GitHub every 2 minutes
  → shows breakfast (7am–12pm) and dinner (4pm–10pm) status
```

## Hardware

- **Beacon:** Holy-IOT BLE beacon (MAC: update `BEACON_MAC` in `listen_always.py` to match yours)
- **Pi:** Raspberry Pi with built-in Bluetooth (tested on RPi 3/4)
- Mount the beacon on or near the food bowl so it detects motion when the bowl is picked up/handled

## Raspberry Pi Setup

**1. Install dependencies**

```bash
pip3 install bleak
```

**2. Clone the repo**

```bash
git clone https://github.com/yourusername/yourrepo.git ~/beacon
cd ~/beacon
```

**3. Configure your beacon MAC**

Edit `listen_always.py` and set `BEACON_MAC` to your beacon's MAC address.

**4. Set up GitHub push access**

The sync script commits and pushes `beacon_events.csv` to GitHub. Set up SSH access or a personal access token so the Pi can push without a password prompt.

**5. Start the listener**

```bash
cd ~/beacon && nohup python3 listen_always.py >> listener.log 2>&1 &
```

**6. Set up cron for reliability**

The BLE adapter can get stuck and needs a periodic reset. Add this to crontab (`crontab -e`):

```
0 4,16 * * * sudo hciconfig hci0 reset && sleep 2 && kill $(pgrep -f listen_always.py) && sleep 1 && cd /home/youruser/beacon && nohup python3 listen_always.py >> listener.log 2>&1 &
```

This resets the BLE adapter and restarts the script at 4am and 4pm daily.

## Feeding detection

The script looks for **4 or more distinct motion bursts** (0→1 transitions in the beacon's motion flag) within a single motion period. A single bump produces 1–2 bursts; an actual feeding produces many more as the lid is removed, bowl handled, and lid replaced.

You can tune this in `listen_always.py`:

```python
MIN_BURSTS_FOR_FEEDING = 4   # increase to reduce false positives
MOTION_TIMEOUT_SECONDS = 7.0 # how long with no motion before a period ends
```

## CSV format

`beacon_events.csv` has one row per confirmed feeding:

```
timestamp,beacon_mac,duration_seconds,event
2026-03-25T14:50:09-07:00,C8:5B:DF:4A:E0:24,4,feeding
```

## Web app

The Next.js app fetches the raw CSV from GitHub and determines:
- **Breakfast:** any feeding event between 7am–12pm today
- **Dinner:** any feeding event between 4pm–10pm today
- **Day resets** at 2am

**Deploy to Vercel:**

```bash
npm install
npm run dev        # local dev
```

Push to GitHub and connect the repo to Vercel for automatic deploys. No environment variables needed — the app reads directly from the public GitHub raw URL. Update the URL in `app/page.tsx` to point to your repo.

## Troubleshooting

**Beacon not detected (`flags=0` constantly)**

The BLE adapter may be stuck. Run:

```bash
sudo hciconfig hci0 reset
```

Then restart the listener script.

**GitHub push failing**

The Pi's local repo may be behind the remote (e.g. after web UI changes are pushed from another machine). Fix:

```bash
cd ~/beacon && git fetch origin && git rebase origin/main
git push origin main
```

Also ensure `sync_csv_api.sh` includes `git pull --rebase origin main` before the commit step.

**Checking listener status**

```bash
ps aux | grep listen_always      # confirm script is running
tail -f ~/beacon/listener.log    # live log output
tail -20 ~/beacon/sync.log       # GitHub sync history
```
