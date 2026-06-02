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
    ResidenceFAQScraper,
    DentalPlanScraper,
    AcademicCalendarScraper,
    DatesAndDeadlinesScraper,
    ExamsScraper,
    GradesScraper,
    MosaicScraper,
    ScholarshipsScraper,
    GradingSystemScraper,
    EngineeringFAQScraper,
    EngineeringCoopFAQScraper,
    ScienceFAQScraper,
    StudentWellnessScraper,
    MentalHealthScraper,
    AccessibilityScraper,
    RecCentreScraper,
    CareerServicesScraper,
    ParkingTransportScraper,
    MSUServicesScraper,
    AcademicIntegrityScraper,
    # NOTE: ProgramRequirementsScraper removed — was returning a hardcoded
    # "go look it up yourself" blurb that polluted search results. Re-add only
    # after implementing real scraping of the academic calendar.
)
from scrapers.hsr import run as run_hsr

HOURLY = [AnnouncementsScraper]

SEMESTER = [
    TuitionScraper,
    CourseSelectionScraper,
    OSAPScraper,
    HousingDeadlinesScraper,
    ResidenceFAQScraper,
    DentalPlanScraper,
    AcademicCalendarScraper,
    DatesAndDeadlinesScraper,
    ExamsScraper,
    GradesScraper,
    MosaicScraper,
    ScholarshipsScraper,
    GradingSystemScraper,
    EngineeringFAQScraper,
    EngineeringCoopFAQScraper,
    ScienceFAQScraper,
    StudentWellnessScraper,
    MentalHealthScraper,
    AccessibilityScraper,
    RecCentreScraper,
    CareerServicesScraper,
    ParkingTransportScraper,
    MSUServicesScraper,
    AcademicIntegrityScraper,
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--group",
        choices=["hourly", "semester", "weekly", "all"],
        default="all",
    )
    args = parser.parse_args()

    errors = []

    if args.group in ("hourly", "all"):
        for Cls in HOURLY:
            try:
                Cls().run()
            except Exception as e:
                print(f"ERROR [{Cls.source_name}]: {e}", file=sys.stderr)
                errors.append(f"{Cls.source_name}: {e}")

    if args.group in ("semester", "all"):
        for Cls in SEMESTER:
            try:
                Cls().run()
            except Exception as e:
                print(f"ERROR [{Cls.source_name}]: {e}", file=sys.stderr)
                errors.append(f"{Cls.source_name}: {e}")

    if args.group in ("weekly", "all"):
        try:
            run_hsr()
        except Exception as e:
            print(f"ERROR [HSR GTFS]: {e}", file=sys.stderr)
            errors.append(f"HSR GTFS: {e}")

    if errors:
        print(f"\n{len(errors)} scraper(s) failed.", file=sys.stderr)
        sys.exit(1)
    print("\nAll scrapers completed successfully.")


if __name__ == "__main__":
    main()
