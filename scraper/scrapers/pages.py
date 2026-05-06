"""
One class per McMaster source page.
Add new sources here — just extend BaseScraper and register in run_all.py.
"""
from .base import BaseScraper, clean_html
from bs4 import BeautifulSoup


# ── Registrar ─────────────────────────────────────────────────────────────────

class TuitionScraper(BaseScraper):
    source_name = "Tuition & Fees"
    source_url = "https://registrar.mcmaster.ca/fees/undergraduate/"

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


class ResidenceFAQScraper(BaseScraper):
    source_name = "Residence FAQ"
    source_url = "https://housing.mcmaster.ca/residence-faq/"

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


class GradingSystemScraper(BaseScraper):
    source_name = "Grading System & GPA Scale"
    source_url = "https://registrar.mcmaster.ca/exams-grades/grades/"

    def parse(self, html: str) -> str:
        return clean_html(html)


# ── Faculty FAQs ──────────────────────────────────────────────────────────────

class EngineeringFAQScraper(BaseScraper):
    source_name = "Engineering FAQ"
    source_url = "https://www.eng.mcmaster.ca/future-students/future-undergraduate-students/how-to-apply/faqs/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class EngineeringCoopFAQScraper(BaseScraper):
    source_name = "Engineering Co-op FAQ"
    source_url = "https://www.eng.mcmaster.ca/co-op-career-experience/how-co-op-works/frequently-asked-questions/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class ScienceFAQScraper(BaseScraper):
    source_name = "Science FAQ"
    source_url = "https://undergraduate.science.mcmaster.ca/contact/frequently-asked-questions/"

    def parse(self, html: str) -> str:
        return clean_html(html)


# ── Student Wellness ──────────────────────────────────────────────────────────

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


class AccessibilityScraper(BaseScraper):
    source_name = "Student Accessibility Services"
    source_url = "https://sas.mcmaster.ca/"

    def parse(self, html: str) -> str:
        return clean_html(html)


# ── Campus & Student Life ─────────────────────────────────────────────────────

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


class MSUServicesScraper(BaseScraper):
    source_name = "MSU Student Union Services"
    source_url = "https://msumcmaster.ca/services/"

    def parse(self, html: str) -> str:
        return clean_html(html)


class AcademicIntegrityScraper(BaseScraper):
    source_name = "Academic Integrity Policy"
    source_url = "https://secretariat.mcmaster.ca/university-policies-procedures-guidelines/academic-integrity/"

    def parse(self, html: str) -> str:
        return clean_html(html)


# ── Announcements ─────────────────────────────────────────────────────────────

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
    
class ProgramRequirementsScraper(BaseScraper):
    source_name = "Program Requirements & Required Courses"
    source_url = "https://academiccalendars.romcmaster.ca/content.php?catoid=53&navoid=10776"

    def parse(self, html: str) -> str:
        return ""

    def run(self):
        text = """
        McMaster University program requirements and required courses for all programs
        can be found in the Academic Calendar.

        To find required courses for your program:
        1. Go to: https://academiccalendars.romcmaster.ca/content.php?catoid=53&navoid=10776
        2. Find your faculty (Engineering, Science, Business, Humanities, Social Sciences, Health Sciences)
        3. Click on your specific program name
        4. You will see all required courses, electives, and degree requirements listed

        This page is updated every academic year and contains the official course requirements
        for every undergraduate program at McMaster University including co-op variants.

        Common programs and their faculties:
        - Software Engineering, Computer Engineering, Mechanical Engineering → Faculty of Engineering
        - Computer Science, Biology, Chemistry, Physics, Mathematics → Faculty of Science
        - Commerce, MBA → DeGroote School of Business
        - Nursing, Health Sciences → Faculty of Health Sciences
        - English, History, Philosophy → Faculty of Humanities
        - Economics, Political Science, Sociology, Psychology → Faculty of Social Sciences
        """
        from .base import chunk_text, embed_texts, get_supabase
        chunks = chunk_text(text)
        print(f"[{self.source_name}] {len(chunks)} chunks — embedding ...")
        embeddings = embed_texts(chunks)
        sb = get_supabase()
        sb.table("knowledge_chunks").delete().eq("source_url", self.source_url).execute()
        rows = [
            {"source_url": self.source_url, "source_name": self.source_name, "content": chunk, "embedding": emb}
            for chunk, emb in zip(chunks, embeddings)
        ]
        sb.table("knowledge_chunks").insert(rows).execute()
        print(f"[{self.source_name}] ✓ {len(rows)} chunks saved.")