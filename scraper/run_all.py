"""
run_all.py — called by GitHub Actions with a --group flag.

Groups:
  hourly   → time-sensitive pages (snow days, announcements)
  semester → slow-changing pages (tuition, housing, OSAP, etc.)
  weekly   → transit data

Usage:
  python run_all.py --group hourly
  python run_all.py --group semester
  python run_all.py --group weekly
"""
import argparse
import sys

from scrapers.pages import (
    # Hourly
    SnowDayScraper,
    AnnouncementsScraper,
    # Semester
    TuitionScraper,
    CourseSelectionScraper,
    OSAPScraper,
    HousingDeadlinesScraper,
    DentalPlanScraper,
    AcademicCalendarScraper,
    DatesAndDeadlinesScraper,
    ExamsScraper,
    GradesScraper,
    TranscriptScraper,
    MosaicScraper,
    ScholarshipsScraper,
    StudentWellnessScraper,
    MentalHealthScraper,
    StudentHealthScraper,
    AccessibilityScraper,
    LibraryHoursScraper,
    LibraryServicesScraper,
    RecCentreScraper,
    CareerServicesScraper,
    ParkingTransportScraper,
    ITHelpScraper,
    MSUServicesScraper,
    InternationalStudentsScraper,
    AcademicIntegrityScraper,
)
from scrapers.hsr import run as run_hsr

HOURLY = [SnowDayScraper, AnnouncementsScraper]

SEMESTER = [
    TuitionScraper,
    CourseSelectionScraper,
    OSAPScraper,
    HousingDeadlinesScraper,
    DentalPlanScraper,
    AcademicCalendarScraper,
    DatesAndDeadlinesScraper,
    ExamsScraper,
    GradesScraper,
    TranscriptScraper,
    MosaicScraper,
    ScholarshipsScraper,
    StudentWellnessScraper,
    MentalHealthScraper,
    StudentHealthScraper,
    AccessibilityScraper,
    LibraryHoursScraper,
    LibraryServicesScraper,
    RecCentreScraper,
    CareerServicesScraper,
    ParkingTransportScraper,
    ITHelpScraper,
    MSUServicesScraper,
    InternationalStudentsScraper,
    AcademicIntegrityScraper,
]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--group", choices=["hourly", "semester", "weekly", "all"], default="all")
    args = parser.parse_args()

    errors = []

    if args.group in ("hourly", "all"):
        for Cls in HOURLY:
            try:
                Cls().run()
            except Exception as e:
                print(f"ERROR [{Cls.source_name}]: {e}", file=sys.stderr)
                errors.append(str(e))

    if args.group in ("semester", "all"):
        for Cls in SEMESTER:
            try:
                Cls().run()
            except Exception as e:
                print(f"ERROR [{Cls.source_name}]: {e}", file=sys.stderr)
                errors.append(str(e))

    if args.group in ("weekly", "all"):
        try:
            run_hsr()
        except Exception as e:
            print(f"ERROR [HSR GTFS]: {e}", file=sys.stderr)
            errors.append(str(e))

    if errors:
        print(f"\n{len(errors)} scraper(s) failed.", file=sys.stderr)
        sys.exit(1)
    else:
        print("\nAll scrapers completed successfully.")

if __name__ == "__main__":
    main()