"""
Smart HTML parser for McMaster pages.

Walks the BeautifulSoup tree and emits semantic chunks instead of flattening
to text. Each output chunk is a small, focused unit of meaning that embeds
well: a table row rendered as prose, a single FAQ Q+A, a heading with its
following paragraph, etc.

Returns a list of strings. Each string is one chunk ready to embed.
"""
from __future__ import annotations
import re
from bs4 import BeautifulSoup, NavigableString, Tag


# ── Public entrypoint ──────────────────────────────────────────────────────
def parse_html(html: str) -> list[str]:
    """
    Walk the page DOM and return a list of semantic chunks (strings).
    Each chunk is one focused unit of content with surrounding context.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Strip nav/footer/script/style/header up front
    for tag in soup(["nav", "footer", "script", "style", "header", "noscript", "form"]):
        tag.decompose()

    # Try to narrow to the main content area to avoid sidebars
    main = (
        soup.find("main")
        or soup.find(attrs={"role": "main"})
        or soup.find("article")
        or soup.find("div", class_=re.compile(r"(content|main|article|post)", re.I))
        or soup.body
        or soup
    )

    builder = ChunkBuilder()
    builder.walk(main)
    return builder.finalize()


# ── Internal: ChunkBuilder ─────────────────────────────────────────────────
class ChunkBuilder:
    """
    Walks the DOM and accumulates chunks. Maintains a stack of headings so
    every emitted chunk knows what section it lives under.
    """

    # Roughly target this chunk size in characters. Tables and FAQs become
    # one chunk each regardless; this only governs flowing prose accumulation.
    PROSE_CHAR_TARGET = 600
    PROSE_CHAR_MAX = 1100

    def __init__(self):
        self.heading_stack: list[tuple[int, str]] = []  # (level, text)
        self.chunks: list[str] = []
        self._prose_buf: list[str] = []  # in-progress prose paragraph buffer

    # ── Main DOM walk ─────────────────────────────────────────────────────
    def walk(self, node: Tag) -> None:
        for child in node.children:
            if isinstance(child, NavigableString):
                text = str(child).strip()
                if text:
                    self._prose_buf.append(text)
                continue
            if not isinstance(child, Tag):
                continue

            name = child.name.lower()

            # Headings update the breadcrumb stack and flush any pending prose
            if name in ("h1", "h2", "h3", "h4", "h5", "h6"):
                self._flush_prose()
                level = int(name[1])
                heading_text = _collapse(child.get_text(" ", strip=True))
                if heading_text:
                    # Pop deeper-or-equal headings off the stack
                    while self.heading_stack and self.heading_stack[-1][0] >= level:
                        self.heading_stack.pop()
                    self.heading_stack.append((level, heading_text))
                continue

            # Tables get a dedicated extraction path that produces prose
            if name == "table":
                self._flush_prose()
                table_chunks = self._render_table(child)
                self.chunks.extend(table_chunks)
                continue

            # Definition list (often used for FAQs)
            if name == "dl":
                self._flush_prose()
                self.chunks.extend(self._render_definition_list(child))
                continue

            # Lists: collect each item as a bullet line
            if name in ("ul", "ol"):
                self._flush_prose()
                list_text = self._render_list(child)
                if list_text:
                    self._emit_with_context(list_text)
                continue

            # Paragraphs and block elements: collect their text into prose buffer
            if name in ("p", "blockquote", "div", "section", "article",
                        "aside", "details", "summary"):
                # If it's a block that itself has tables/headings/lists nested,
                # we need to recurse rather than just slurp text.
                if _has_structured_children(child):
                    self._flush_prose()
                    self.walk(child)
                else:
                    text = _collapse(child.get_text(" ", strip=True))
                    if text:
                        self._prose_buf.append(text)
                        self._maybe_flush_prose()
                continue

            # Default: recurse so we don't lose nested structure
            self.walk(child)

        # When done walking a node, flush any pending prose so it doesn't
        # bleed across heading boundaries.
        self._flush_prose()

    # ── Prose accumulation ────────────────────────────────────────────────
    def _maybe_flush_prose(self):
        """Flush the in-progress prose if it's getting long enough."""
        total = sum(len(p) for p in self._prose_buf)
        if total >= self.PROSE_CHAR_TARGET:
            self._flush_prose()

    def _flush_prose(self):
        """Emit accumulated prose as one chunk with heading context."""
        if not self._prose_buf:
            return
        body = " ".join(self._prose_buf).strip()
        body = _collapse(body)
        if len(body) < 40:
            # Too short to be meaningful on its own
            self._prose_buf = []
            return

        # If the body is unusually long, split on sentence boundaries near target
        if len(body) > self.PROSE_CHAR_MAX:
            parts = _split_long_prose(body, self.PROSE_CHAR_TARGET, self.PROSE_CHAR_MAX)
            for p in parts:
                self._emit_with_context(p)
        else:
            self._emit_with_context(body)

        self._prose_buf = []

    # ── Emission with heading context ─────────────────────────────────────
    def _emit_with_context(self, body: str):
        """Prepend the current heading breadcrumb so embeddings have topic context."""
        breadcrumb = self._heading_breadcrumb()
        if breadcrumb:
            chunk = f"[{breadcrumb}]\n{body}"
        else:
            chunk = body
        self.chunks.append(chunk)

    def _heading_breadcrumb(self) -> str:
        if not self.heading_stack:
            return ""
        return " › ".join(h[1] for h in self.heading_stack)

    # ── Table rendering ───────────────────────────────────────────────────
    def _render_table(self, table: Tag) -> list[str]:
        """
        Turn a table into a list of natural-language chunks — one per row.
        Uses the table's first row as headers (or thead if available), and the
        first cell of each subsequent row as the row label.

        Example:
            | Program        | Ontario | OOP    | International |
            | CS Level 1     | $303    | $333   | $1874         |

        Becomes:
            [Section › Subsection]
            For CS Level 1: Ontario $303, OOP $333, International $1874.
        """
        rows = table.find_all("tr")
        if not rows:
            return []

        # Identify header row
        thead = table.find("thead")
        if thead and thead.find("tr"):
            header_cells = thead.find("tr").find_all(["th", "td"])
            data_rows = [r for r in rows if r.parent and r.parent.name != "thead"]
        else:
            first = rows[0]
            header_cells = first.find_all(["th", "td"])
            data_rows = rows[1:]

        headers = [_collapse(c.get_text(" ", strip=True)) for c in header_cells]

        # If headers don't look like headers (e.g. all blank or first cell is
        # also data), fall back to generic column labels.
        if not any(h for h in headers[1:]):
            headers = ["Column 1"] + [f"Column {i+1}" for i in range(1, len(header_cells))]

        breadcrumb = self._heading_breadcrumb()
        chunks: list[str] = []

        # Emit a table overview chunk so queries about the table's topic match
        if breadcrumb:
            chunks.append(
                f"[{breadcrumb}]\n"
                f"This section contains a table with the following columns: "
                f"{', '.join(h for h in headers if h)}."
            )

        for row in data_rows:
            cells = row.find_all(["th", "td"])
            if not cells:
                continue
            cell_texts = [_collapse(c.get_text(" ", strip=True)) for c in cells]

            # Skip rows that look like sub-headers (single-cell or row that
            # mirrors a header pattern)
            if all(not t for t in cell_texts):
                continue

            row_label = cell_texts[0] or "Row"
            pairs = []
            for h, v in zip(headers[1:], cell_texts[1:]):
                if not v or v == "|":
                    continue
                # Skip dollar-sign-only cells that have no number
                if h:
                    pairs.append(f"{h}: {v}")
                else:
                    pairs.append(v)

            if not pairs:
                # Single-column row, just emit the label
                if breadcrumb:
                    text = f"[{breadcrumb}]\n{row_label}"
                else:
                    text = row_label
                chunks.append(text)
                continue

            sentence = f"{row_label} — " + "; ".join(pairs) + "."
            if breadcrumb:
                chunks.append(f"[{breadcrumb}]\n{sentence}")
            else:
                chunks.append(sentence)

        return chunks

    # ── Definition list (FAQ-style) ───────────────────────────────────────
    def _render_definition_list(self, dl: Tag) -> list[str]:
        chunks = []
        breadcrumb = self._heading_breadcrumb()
        terms = dl.find_all("dt")
        for dt in terms:
            term = _collapse(dt.get_text(" ", strip=True))
            # Gather following <dd>s until next <dt>
            definitions = []
            for sib in dt.find_next_siblings():
                if sib.name == "dt":
                    break
                if sib.name == "dd":
                    definitions.append(_collapse(sib.get_text(" ", strip=True)))
            definition = " ".join(definitions)
            if term and definition:
                body = f"Q: {term}\nA: {definition}"
                if breadcrumb:
                    chunks.append(f"[{breadcrumb}]\n{body}")
                else:
                    chunks.append(body)
        return chunks

    # ── List rendering ────────────────────────────────────────────────────
    def _render_list(self, lst: Tag) -> str:
        items = lst.find_all("li", recursive=False)
        rendered = []
        for li in items:
            text = _collapse(li.get_text(" ", strip=True))
            if text:
                rendered.append(f"• {text}")
        return "\n".join(rendered)

    # ── Final cleanup ─────────────────────────────────────────────────────
    def finalize(self) -> list[str]:
        self._flush_prose()
        # Drop chunks that are too short to embed usefully
        return [c for c in self.chunks if _useful(c)]


# ── Helpers ────────────────────────────────────────────────────────────────
_WHITESPACE_RE = re.compile(r"\s+")

def _collapse(s: str) -> str:
    return _WHITESPACE_RE.sub(" ", s).strip()


def _has_structured_children(tag: Tag) -> bool:
    """True if the tag contains tables/headings/lists/dls anywhere inside."""
    return bool(tag.find(["table", "h1", "h2", "h3", "h4", "h5", "h6",
                          "ul", "ol", "dl"]))


def _useful(chunk: str) -> bool:
    """Drop near-empty, navigation-y, or duplicate-header-only chunks."""
    body = chunk.split("\n", 1)[1] if "\n" in chunk else chunk
    body = body.strip()
    if len(body) < 30:
        return False
    # Drop chunks that are basically just menu items
    if body.count("•") >= 4 and len(body) < 200:
        return False
    return True


_SENT_END_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z])")

def _split_long_prose(text: str, target: int, hard_max: int) -> list[str]:
    """Split a long prose blob into roughly target-sized pieces on sentence boundaries."""
    sentences = _SENT_END_RE.split(text)
    parts: list[str] = []
    current = ""
    for s in sentences:
        if not current:
            current = s
        elif len(current) + len(s) + 1 <= hard_max:
            current = current + " " + s
        else:
            parts.append(current.strip())
            current = s
    if current.strip():
        parts.append(current.strip())
    return parts


# ── Sanity test stub when run directly ─────────────────────────────────────
if __name__ == "__main__":
    sample = """
    <html><body>
      <main>
        <h2>Tuition fees 2025-26</h2>
        <p>Tuition is charged at a board-approved base rate per unit.</p>
        <h3>Engineering Computer Science</h3>
        <table>
          <thead>
            <tr><th>Program</th><th>Ontario students</th><th>Out of province</th><th>International</th></tr>
          </thead>
          <tbody>
            <tr><td>Engineering Computer Science Level 1</td><td>$303.60 per unit</td><td>$333.72 per unit</td><td>$1,874.42 per unit</td></tr>
            <tr><td>Engineering Computer Science Level 2</td><td>$303.60 per unit</td><td>$324.00 per unit</td><td>$1,874.42 per unit</td></tr>
          </tbody>
        </table>
        <h3>Nursing</h3>
        <table>
          <thead>
            <tr><th>Program</th><th>Ontario students</th><th>Out of province</th><th>International</th></tr>
          </thead>
          <tbody>
            <tr><td>Nursing Level 1</td><td>$201.42 per unit</td><td>$252.15 per unit</td><td>$1,724.48 per unit</td></tr>
          </tbody>
        </table>
      </main>
    </body></html>
    """
    chunks = parse_html(sample)
    for i, c in enumerate(chunks, 1):
        print(f"── Chunk {i} ─────────────────────────────")
        print(c)
        print()