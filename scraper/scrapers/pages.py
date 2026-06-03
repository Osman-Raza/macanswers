"""
One class per McMaster source page.

All scrapers now return raw HTML by default — the base class handles
smart parsing (tables → prose, FAQs → Q+A pairs, etc.) automatically.

For sources where the page is too sparse or JS-rendered to give useful
output, override parse() to inject extra context manually.
"""
from .base import BaseScraper
from bs4 import BeautifulSoup


# ── Default behavior ──────────────────────────────────────────────────────────
class _StandardScraper(BaseScraper):
    """Common case: just return raw HTML and let the smart parser handle it."""
    def parse(self, html: str) -> str:
        return html


# ── Registrar ─────────────────────────────────────────────────────────────────

class TuitionScraper(_StandardScraper):
    source_name = "Tuition & Fees"
    source_url = "https://registrar.mcmaster.ca/fees/undergraduate/"


class CourseSelectionScraper(_StandardScraper):
    source_name = "Course Selection & Registration"
    source_url = "https://registrar.mcmaster.ca/build-degree/mytimetable/"


class OSAPScraper(_StandardScraper):
    source_name = "OSAP & Financial Aid"
    source_url = "https://registrar.mcmaster.ca/aid-awards/osap-government-aid/"


class HousingDeadlinesScraper(_StandardScraper):
    source_name = "Housing & Residence Deadlines"
    source_url = "https://housing.mcmaster.ca/apply/"


class ResidenceFAQScraper(_StandardScraper):
    source_name = "Residence FAQ"
    source_url = "https://housing.mcmaster.ca/residence-faq/"


class DentalPlanScraper(_StandardScraper):
    source_name = "Dental & Health Plan"
    source_url = "https://msumcmaster.ca/services/dental-health-plan/"


class AcademicCalendarScraper(_StandardScraper):
    source_name = "Academic Calendar Key Dates"
    source_url = "https://registrar.mcmaster.ca/dates/"


class DatesAndDeadlinesScraper(_StandardScraper):
    source_name = "Dates & Deadlines"
    source_url = "https://registrar.mcmaster.ca/dates-and-deadlines/"


class ExamsScraper(_StandardScraper):
    source_name = "Exams — Schedule & Info"
    source_url = "https://registrar.mcmaster.ca/exams-grades/exams/"


class GradesScraper(_StandardScraper):
    source_name = "Grades & GPA"
    source_url = "https://registrar.mcmaster.ca/exams-grades/"


class MosaicScraper(_StandardScraper):
    source_name = "Mosaic Student Portal Help"
    source_url = "https://registrar.mcmaster.ca/mosaic/"


class ScholarshipsScraper(_StandardScraper):
    source_name = "Scholarships & Bursaries"
    source_url = "https://registrar.mcmaster.ca/aid-awards/"


class GradingSystemScraper(_StandardScraper):
    source_name = "Grading System & GPA Scale"
    source_url = "https://registrar.mcmaster.ca/exams-grades/grades/"


# ── Faculty FAQs ──────────────────────────────────────────────────────────────

class EngineeringFAQScraper(_StandardScraper):
    source_name = "Engineering FAQ"
    source_url = "https://www.eng.mcmaster.ca/future-students/future-undergraduate-students/how-to-apply/faqs/"


class EngineeringCoopFAQScraper(_StandardScraper):
    source_name = "Engineering Co-op FAQ"
    source_url = "https://www.eng.mcmaster.ca/co-op-career-experience/how-co-op-works/frequently-asked-questions/"


class ScienceFAQScraper(_StandardScraper):
    source_name = "Science FAQ"
    source_url = "https://undergraduate.science.mcmaster.ca/contact/frequently-asked-questions/"


# ── Student Wellness ──────────────────────────────────────────────────────────

class StudentWellnessScraper(_StandardScraper):
    source_name = "Student Wellness Centre"
    source_url = "https://wellness.mcmaster.ca/"


class MentalHealthScraper(_StandardScraper):
    source_name = "Mental Health & Counselling"
    source_url = "https://wellness.mcmaster.ca/mental-health/"


class AccessibilityScraper(_StandardScraper):
    source_name = "Student Accessibility Services"
    source_url = "https://sas.mcmaster.ca/"


# ── Campus & Student Life ─────────────────────────────────────────────────────

class RecCentreScraper(_StandardScraper):
    source_name = "Recreation Centre & Fitness"
    source_url = "https://rec.mcmaster.ca/"


class CareerServicesScraper(_StandardScraper):
    source_name = "Career Services & Co-op"
    source_url = "https://careers.mcmaster.ca/"


class ParkingTransportScraper(_StandardScraper):
    source_name = "Parking & Transportation"
    source_url = "https://parking.mcmaster.ca/"


class MSUServicesScraper(_StandardScraper):
    source_name = "MSU Student Union Services"
    source_url = "https://msumcmaster.ca/services/"


class AcademicIntegrityScraper(_StandardScraper):
    source_name = "Academic Integrity Policy"
    source_url = "https://secretariat.mcmaster.ca/university-policies-procedures-guidelines/academic-integrity/"


# ── NEW SOURCES (added to fill coverage gaps) ─────────────────────────────────

class OffCampusScraper(_StandardScraper):
    """Off-Campus Resource Centre — for students living off-campus, renting, etc."""
    source_name = "Off-Campus Housing & Resources"
    source_url = "https://offcampus.mcmaster.ca/"


class MealPlansScraper(_StandardScraper):
    """Hospitality Services — meal plans, dining halls, food on campus."""
    source_name = "Meal Plans & Dining"
    source_url = "https://hospitality.mcmaster.ca/meal-plans/"


class LibraryScraper(_StandardScraper):
    """Library Services — hours, study spaces, borrowing, research help."""
    source_name = "McMaster Library"
    source_url = "https://library.mcmaster.ca/services"


# ── Announcements (special: parses article cards, not the full page) ──────────

class AnnouncementsScraper(BaseScraper):
    """
    Daily News landing page. Uses targeted DOM extraction because the homepage
    is mostly navigation + article cards rather than article content. We pull
    title + summary + link for the latest articles.
    """
    source_name = "McMaster Announcements"
    source_url = "https://dailynews.mcmaster.ca/"

    # We're hand-building the chunks here, so disable the smart parser
    smart_parse = False

    def parse(self, html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        articles = soup.select("article")
        sections: list[str] = []
        for a in articles[:20]:
            title_tag = a.find(["h2", "h3"])
            summary_tag = a.find("p")
            link_tag = a.find("a", href=True)

            title = title_tag.get_text(" ", strip=True) if title_tag else ""
            summary = summary_tag.get_text(" ", strip=True) if summary_tag else ""
            link = (
                link_tag["href"]
                if link_tag and link_tag["href"].startswith("http")
                else ""
            )

            if not title:
                continue
            entry = f"{title}\n{summary}"
            if link:
                entry += f"\nRead more: {link}"
            sections.append(entry)

        return "\n\n".join(sections)