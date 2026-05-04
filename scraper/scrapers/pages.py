"""
One class per McMaster source page.
Add new sources here — just extend BaseScraper and register in run_all.py.
"""
from .base import BaseScraper, clean_html
from bs4 import BeautifulSoup


# ── Existing scrapers (bug fixes preserved) ───────────────────────────────────

class TuitionScraper(BaseScraper):
    source_name = "Tuition & Fees"
    source_url = "https://registrar.mcmaster.ca/tuition-fees/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class SnowDayScraper(BaseScraper):
    source_name = "Snow Day Alerts"
    source_url = "https://www.mcmaster.ca/emergency/snow.html"

    def parse(self, html: str) -> str:
        return clean_html(html)


class CourseSelectionScraper(BaseScraper):
    source_name = "Course Selection & Registration"
    source_url = "https://registrar.mcmaster.ca/build-degree/mytimetable/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class OSAPScraper(BaseScraper):
    source_name = "OSAP & Financial Aid"
    source_url = "https://registrar.mcmaster.ca/aid-awards/osap-government-aid/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class HousingDeadlinesScraper(BaseScraper):
    source_name = "Housing & Residence Deadlines"
    source_url = "https://housing.mcmaster.ca/apply/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class DentalPlanScraper(BaseScraper):
    source_name = "Dental & Health Plan"
    source_url = "https://msumcmaster.ca/services/dental-health-plan/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class AcademicCalendarScraper(BaseScraper):
    source_name = "Academic Calendar Key Dates"
    source_url = "https://registrar.mcmaster.ca/dates/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class AnnouncementsScraper(BaseScraper):
    """Scrapes the main McMaster news/announcements feed — runs hourly."""
    source_name = "McMaster Announcements"
    source_url = "https://dailynews.mcmaster.ca/"

    def parse(self, html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        articles = soup.select("article")
        lines = []
        for a in articles[:20]:
            title = a.find(["h2", "h3"])
            summary = a.find("p")
            link = a.find("a", href=True)
            if title:
                lines.append(title.get_text(strip=True))
            if summary:
                lines.append(summary.get_text(strip=True))
            if link and link["href"].startswith("http"):
                lines.append(f"Read more: {link['href']}")
            lines.append("")
        return "\n".join(lines)


# ── New scrapers ──────────────────────────────────────────────────────────────

class DatesAndDeadlinesScraper(BaseScraper):
    source_name = "Dates & Deadlines"
    source_url = "https://registrar.mcmaster.ca/dates-and-deadlines/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class ExamsScraper(BaseScraper):
    source_name = "Exams — Schedule & Info"
    source_url = "https://registrar.mcmaster.ca/exams-grades/exams/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class GradesScraper(BaseScraper):
    source_name = "Grades & GPA"
    source_url = "https://registrar.mcmaster.ca/exams-grades/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class TranscriptScraper(BaseScraper):
    source_name = "Transcripts & Enrolment Verification"
    source_url = "https://registrar.mcmaster.ca/transcripts-enrolment/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class MosaicScraper(BaseScraper):
    source_name = "Mosaic Student Portal Help"
    source_url = "https://registrar.mcmaster.ca/mosaic/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class ScholarshipsScraper(BaseScraper):
    source_name = "Scholarships & Bursaries"
    source_url = "https://registrar.mcmaster.ca/aid-awards/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class StudentWellnessScraper(BaseScraper):
    source_name = "Student Wellness Centre"
    source_url = "https://wellness.mcmaster.ca/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class MentalHealthScraper(BaseScraper):
    source_name = "Mental Health & Counselling"
    source_url = "https://wellness.mcmaster.ca/mental-health/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class StudentHealthScraper(BaseScraper):
    source_name = "Student Health Services"
    source_url = "https://shs.mcmaster.ca/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class AccessibilityScraper(BaseScraper):
    source_name = "Student Accessibility Services"
    source_url = "https://sas.mcmaster.ca/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class LibraryHoursScraper(BaseScraper):
    source_name = "Library Hours"
    source_url = "https://library.mcmaster.ca/about/hours"

    def parse(self, html: str) -> str:
        return clean_html(html)


class LibraryServicesScraper(BaseScraper):
    source_name = "Library Services"
    source_url = "https://library.mcmaster.ca/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class RecCentreScraper(BaseScraper):
    source_name = "Recreation Centre & Fitness"
    source_url = "https://rec.mcmaster.ca/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class CareerServicesScraper(BaseScraper):
    source_name = "Career Services & Co-op"
    source_url = "https://careers.mcmaster.ca/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class ParkingTransportScraper(BaseScraper):
    source_name = "Parking & Transportation"
    source_url = "https://parking.mcmaster.ca/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class ITHelpScraper(BaseScraper):
    source_name = "IT Help & Technology Services"
    source_url = "https://uwts.mcmaster.ca/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class MSUServicesScraper(BaseScraper):
    source_name = "MSU Student Union Services"
    source_url = "https://msumcmaster.ca/services/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class InternationalStudentsScraper(BaseScraper):
    source_name = "International Student Services"
    source_url = "https://international.mcmaster.ca/current-students/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class AcademicIntegrityScraper(BaseScraper):
    source_name = "Academic Integrity Policy"
    source_url = "https://secretariat.mcmaster.ca/university-policies-procedures-guidelines/academic-integrity/"

    def parse(self, html: str) -> str:
        return clean_html(html)