"""
HSR GTFS static feed scraper.
Downloads the ZIP, parses stop_times.txt and routes.txt,
and upserts into the transit_departures table.

Run weekly (or on demand) via GitHub Actions.
"""
import io
import os
import zipfile
import csv
import time
from dotenv import load_dotenv
from supabase import create_client # type: ignore

load_dotenv()

GTFS_URL = "https://opendata.hamilton.ca/GTFS-Static/google_transit.zip"
def run():
    import requests
    print("Downloading HSR GTFS feed ...")
    resp = requests.get(GTFS_URL, timeout=60)
    resp.raise_for_status()

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
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

        # Parse stop_times — only keep routes we care about (or all of them)
        rows = []
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
                if len(rows) >= 50_000:
                    _flush(sb, rows)
                    rows = []

        if rows:
            _flush(sb, rows)

    print("HSR GTFS import complete.")


def _flush(sb, rows):
    # Upsert in batches of 1000
    for i in range(0, len(rows), 1000):
        sb.table("transit_departures").upsert(rows[i:i+1000]).execute()
        time.sleep(0.1)
    print(f"  Flushed {len(rows)} rows.")


if __name__ == "__main__":
    run()
