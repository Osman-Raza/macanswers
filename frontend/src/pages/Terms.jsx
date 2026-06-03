import ReactMarkdown from "react-markdown";
import styles from "./LegalPage.module.css";

const TERMS = `# Terms of Service

**Last updated:** June 2, 2026

Welcome to MacAnswers. These terms govern your use of the website at macanswers.ca. By using MacAnswers, you agree to these terms. If you don't agree with any of them, please don't use the site.

## What MacAnswers is

MacAnswers is an independent, student-built tool that helps McMaster University students find information about university life. It includes three features:

- A search engine that answers questions using publicly available McMaster web pages
- A Campus Issue Tracker where signed-in users can report and upvote campus issues on a map
- A Transit lookup for HSR bus times and the McMaster shuttle schedule

MacAnswers is **not** affiliated with, endorsed by, or operated by McMaster University. It is built and maintained by a McMaster student as an independent project.

## Who can use MacAnswers

- The search and transit features are open to anyone.
- The Campus Issue Tracker requires you to sign in with a McMaster email address. You must be the rightful owner of that email address.
- If you are under 13 years old, please do not sign in.

## How you may use MacAnswers

You may use MacAnswers for personal, non-commercial purposes. You agree not to:

- Use the service for any unlawful purpose
- Attempt to bypass rate limits, scrape the service, or otherwise abuse it
- Submit campus issues that are fake, malicious, harassing, defamatory, or that target individuals
- Submit issues that contain personal information about other people (names, photos, license plates, etc.)
- Impersonate another person or misrepresent your affiliation with anyone
- Attempt to disrupt the service, probe for vulnerabilities, or interfere with other users
- Use automated tools (bots, scripts, scrapers) to interact with the service
- Reverse engineer, decompile, or attempt to extract the underlying algorithms or data structures of the service

## Content you submit

When you report a campus issue or upvote one, the content you submit (title, description, category, location, building) becomes publicly visible on the issue map to all users. You are responsible for what you submit.

You grant MacAnswers a non-exclusive, royalty-free license to display, store, and distribute the content you submit, solely for the purpose of operating the service.

You retain ownership of what you submit. You can delete your own issue reports at any time using the delete button.

We reserve the right to remove any content that violates these terms or that we judge, in good faith, to be harmful, illegal, or off-topic. We may also restrict or terminate access for users who repeatedly violate these terms.

## Accuracy of information

MacAnswers provides information drawn from public McMaster web pages and from the City of Hamilton's open transit data. We use automated tools and an AI language model to generate answers and we do our best to keep the underlying data current, but we cannot guarantee that any specific answer is accurate, complete, or up to date.

**You should always verify important information directly with McMaster University before making decisions based on it.** This is especially true for:

- Tuition and fees
- Academic deadlines, exam schedules, and course requirements
- OSAP and financial aid information
- Safety alerts and emergency announcements
- Anything where being wrong has real consequences

MacAnswers is provided as a convenience. It is not a substitute for official McMaster sources, Mosaic, the Registrar's Office, or any other authoritative service.

## Snow day and closure information

MacAnswers includes a feature that tries to determine whether McMaster has announced a weather-related closure. This works by checking McMaster's Daily News feed. The information may be delayed by up to one hour and may not reflect the very latest announcements.

**Do not rely solely on MacAnswers to decide whether it is safe to travel to campus during severe weather.** Always check official McMaster channels, the McMaster Safety App, and your own judgment about local road conditions.

## Campus Issue Tracker

The Campus Issue Tracker is intended for non-urgent campus maintenance issues such as broken outlets, printer problems, or accessibility concerns. It is not a substitute for:

- **Emergencies.** If something is on fire, someone is hurt, or there is a safety threat, call McMaster Security Services at 905-522-4135 or 911.
- **Official maintenance requests.** Issues reported through MacAnswers are not automatically forwarded to any McMaster department.
- **Reporting individuals or incidents.** Do not use the tracker to report or identify specific people, harassment, or misconduct. Use the appropriate official McMaster channels for those concerns.

We are not responsible for any consequences of issues that are reported on MacAnswers but never reach a McMaster department capable of resolving them.

## Service availability

MacAnswers is provided on an "as is" and "as available" basis. We do not guarantee uptime, response times, or that the service will be free from errors, bugs, or interruptions. We may modify, suspend, or discontinue any part of the service at any time without notice.

## Third-party services

MacAnswers relies on third-party services including Supabase, Google Gemini, Groq, and Hamilton's open transit data feed. The availability and behaviour of MacAnswers depends partly on these services. We are not responsible for failures, outages, or changes in those services.

Links to external sites (including McMaster pages) are provided for convenience. We are not responsible for the content of external sites.

## Intellectual property

The MacAnswers code is owned by the developer. The content displayed in MacAnswers is drawn from publicly available sources and remains the property of those sources (McMaster University, the City of Hamilton, etc.).

You may not copy, modify, distribute, sell, or lease any part of MacAnswers or its source code without prior written permission, except as expressly allowed by the project's open-source license (if one is in effect at the time of use).

## Disclaimers

To the maximum extent permitted by law:

- MacAnswers makes no warranties, express or implied, about the service or its content.
- MacAnswers is not liable for any direct, indirect, incidental, consequential, or punitive damages arising from your use of the service.
- This includes any decisions you make based on information from MacAnswers — financial, academic, transit-related, weather-related, or otherwise.

If you live in a jurisdiction that does not allow the exclusion of certain warranties or liabilities, the above limitations apply only to the extent permitted by that jurisdiction's law.

## Changes to these terms

We may update these terms from time to time. If we change them in a material way, we will update the "Last updated" date at the top of this page and post a notice on the home page for at least 14 days before the changes take effect. Continued use of MacAnswers after changes take effect means you accept the new terms.

## Termination

You may stop using MacAnswers at any time. If you have a sign-in record from the Campus Issue Tracker, you can request deletion as described in the Privacy Policy.

We may suspend or terminate your access to MacAnswers — including the Campus Issue Tracker — at any time, with or without notice, if we reasonably believe you have violated these terms.

## Governing law

These terms are governed by the laws of the Province of Ontario, Canada, and the laws of Canada applicable in Ontario. Any dispute arising from these terms or from your use of MacAnswers will be resolved exclusively in the courts of Ontario.

## Contact

For any question about these terms:

**Email:** razao2@mcmaster.ca

Please use "MacAnswers Terms" in the subject line.
`;

export default function Terms() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <ReactMarkdown>{TERMS}</ReactMarkdown>
      </div>
    </div>
  );
}
