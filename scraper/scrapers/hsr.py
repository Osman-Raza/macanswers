"""
HSR GTFS static feed scraper.
Downloads the ZIP, parses stop_times.txt and routes.txt,
and replaces the transit_departures table contents.

Run weekly (or on demand) via GitHub Actions.

Safety guarantees:
- Downloads and parses ALL data into memory first.
- Only deletes existing rows AFTER parse succeeds.
- If the download or parse fails, the old data is left intact.
"""
import io
import os
import zipfile
import csv
import time
from dotenv import load_dotenv
from supabase import create_client  # type: ignore

load_dotenv()

GTFS_URL = "https://opendata.hamilton.ca/GTFS-Static/google_transit.zip"

# Minimum row count expected from a healthy GTFS feed. If we get fewer than
# this, something is wrong and we should NOT wipe the existing data.
MIN_EXPECTED_ROWS = 100_000


def run():
    import requests

    print("Downloading HSR GTFS feed ...")
    resp = requests.get(GTFS_URL, timeout=60)
    resp.raise_for_status()

    # ── Parse all data into memory before touching the database ─────────────
    all_rows = _parse_gtfs(resp.content)

    if len(all_rows) < MIN_EXPECTED_ROWS:
        raise RuntimeError(
            f"GTFS parse returned only {len(all_rows)} rows (expected at least "
            f"{MIN_EXPECTED_ROWS}). Aborting to avoid wiping existing data."
        )

    print(f"Parsed {len(all_rows)} departure rows.")

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    # ── Wipe old data only after parse succeeded ────────────────────────────
    print("Clearing existing transit_departures ...")
    # Supabase requires a filter on delete; use a tautology.
    sb.table("transit_departures").delete().neq("id", -1).execute()

    # ── Insert fresh data ───────────────────────────────────────────────────
    print("Inserting new departures ...")
    _flush(sb, all_rows)

    print("HSR GTFS import complete.")


def _parse_gtfs(zip_bytes: bytes) -> list[dict]:
    """Parse the GTFS zip and return a list of departure rows."""
    rows = []
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        # Build route_id -> route_short_name map
        routes = {}
        with zf.open("routes.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f))
            for row in reader:
                routes[row["route_id"]] = row["route_short_name"]

        # Build stop_id -> stop_name map
        stops = {}
        with zf.open("stops.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f))
            for row in reader:
                stops[row["stop_id"]] = row["stop_name"]

        # Build trip_id -> route_id + headsign
        trips = {}
        with zf.open("trips.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f))
            for row in reader:
                trips[row["trip_id"]] = {
                    "route_id": row["route_id"],
                    "trip_headsign": row.get("trip_headsign", ""),
                }

        # Parse stop_times
        with zf.open("stop_times.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f))
            for row in reader:
                trip = trips.get(row["trip_id"])
                if not trip:
                    continue
                route_short = routes.get(trip["route_id"], "")
                rows.append({
                    "route_short_name": route_short,
                    "trip_headsign": trip["trip_headsign"],
                    "stop_id": row["stop_id"],
                    "stop_name": stops.get(row["stop_id"], ""),
                    "departure_time": row["departure_time"],
                })

    return rows


def _flush(sb, rows: list[dict]):
    """Insert in batches of 1000."""
    total = len(rows)
    for i in range(0, total, 1000):
        sb.table("transit_departures").insert(rows[i:i + 1000]).execute()
        time.sleep(0.1)
        if (i // 1000) % 50 == 0:
            print(f"  Inserted {min(i + 1000, total):,} / {total:,} rows")
    print(f"  ✓ All {total:,} rows inserted.")


if __name__ == "__main__":
    run()