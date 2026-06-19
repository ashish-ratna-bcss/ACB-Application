"""
PDF report assembler for formatted investigation reports.

Takes AI-generated sections (with embedded HTML tables) and assembles into
a formatted, numbered final report with proper section hierarchy, page breaks,
and table formatting.
"""


def assemble_html_report(sections: list[dict], case_id: str) -> str:
    """
    Assemble sections into formatted HTML for PDF conversion.

    Each section has: number, heading, subsections (with number, heading, content).
    Returns HTML ready for weasyprint or similar PDF generation.
    """
    html_parts = [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '  <meta charset="UTF-8">',
        '  <style>',
        _get_css_styles(),
        '  </style>',
        '</head>',
        '<body>',
    ]

    # Title page
    html_parts.append(
        f'''
        <div class="title-page">
            <h1>FORMAT FOR FINAL REPORT IN TRAP CASES</h1>
            <p class="case-number">Case ID: {case_id}</p>
            <p class="report-type">Anti-Corruption Bureau Investigation Report</p>
            <p class="date">Date: _______________</p>
        </div>
        <div class="page-break"></div>
        '''
    )

    # Add sections
    for section in sections:
        section_num = section.get("number", "")
        section_heading = section.get("heading", "")

        # Section header
        html_parts.append(f'<div class="section-header">')
        html_parts.append(f'  <h2>{section_num}. {section_heading}</h2>')
        html_parts.append(f'</div>')

        # Subsections
        for sub in section.get("subsections", []):
            sub_num = sub.get("number", "")
            sub_heading = sub.get("heading", "")
            content = sub.get("content", "TO DO")

            html_parts.append(f'<div class="subsection">')
            if sub_heading:
                html_parts.append(f'  <h3>{sub_num}. {sub_heading}</h3>')
            html_parts.append(f'  <div class="subsection-content">')
            html_parts.append(_format_content_html(content))
            html_parts.append(f'  </div>')
            html_parts.append(f'</div>')

    html_parts.extend(['</body>', '</html>'])

    return "\n".join(html_parts)


def _format_content_html(content: str) -> str:
    """Format content: preserve HTML tables, escape plain text, format lists."""
    if not content:
        return "<p>TO DO</p>"

    # If content contains HTML tables, preserve them
    if "<table" in content:
        return content

    # Preserve ➢ bullets and format as list
    if "➢" in content:
        lines = content.split("\n")
        result = []
        for line in lines:
            line = line.strip()
            if line.startswith("➢"):
                bullet_text = line[1:].strip()
                result.append(f"<li>{bullet_text}</li>")
            elif line:
                result.append(f"<p>{line}</p>")
        return "<ul>" + "".join(result) + "</ul>" if any(line.startswith("<li>") for line in result) else "\n".join(result)

    # Plain text: wrap in paragraphs
    paragraphs = content.split("\n\n")
    return "\n".join(f"<p>{para.strip()}</p>" for para in paragraphs if para.strip())


def _get_css_styles() -> str:
    """Return embedded CSS for formatted report styling."""
    return """
    body {
        font-family: 'Calibri', Arial, sans-serif;
        font-size: 11pt;
        line-height: 1.5;
        margin: 1in;
        color: #000;
    }

    .title-page {
        text-align: center;
        padding: 3in 0;
    }

    .title-page h1 {
        font-size: 18pt;
        font-weight: bold;
        margin-bottom: 1in;
    }

    .case-number {
        font-size: 12pt;
        margin: 0.5in 0;
    }

    .report-type {
        font-size: 12pt;
        margin: 0.5in 0;
    }

    .page-break {
        page-break-after: always;
    }

    .section-header {
        margin-top: 0.5in;
        margin-bottom: 0.25in;
        page-break-inside: avoid;
    }

    .section-header h2 {
        font-size: 13pt;
        font-weight: bold;
        margin: 0;
        padding: 0;
    }

    .subsection {
        margin-bottom: 0.25in;
        padding-left: 0.25in;
    }

    .subsection h3 {
        font-size: 11pt;
        font-weight: bold;
        margin: 0.1in 0;
        padding: 0;
    }

    .subsection-content {
        margin-left: 0.25in;
    }

    .subsection-content p {
        margin: 0.1in 0;
        text-align: justify;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        margin: 0.2in 0;
        font-size: 10pt;
    }

    table th {
        background-color: #f0f0f0;
        border: 1px solid #999;
        padding: 0.1in;
        text-align: left;
        font-weight: bold;
    }

    table td {
        border: 1px solid #999;
        padding: 0.08in;
        text-align: left;
    }

    ul {
        margin: 0.1in 0;
        padding-left: 0.5in;
    }

    li {
        margin: 0.05in 0;
    }

    b, strong {
        font-weight: bold;
    }

    .to-do {
        color: #999;
        font-style: italic;
    }

    /* Page layout */
    @page {
        size: A4;
        margin: 1in;
    }
    """


def format_section_for_display(section: dict) -> str:
    """Format a single section for web display (non-PDF)."""
    html = f'<div class="report-section">\n'
    html += f'  <h2>{section.get("number", "")}. {section.get("heading", "")}</h2>\n'

    for sub in section.get("subsections", []):
        html += f'  <div class="subsection">\n'
        if sub.get("heading"):
            html += f'    <h3>{sub.get("number", "")}. {sub.get("heading", "")}</h3>\n'
        html += f'    <div class="content">{_format_content_html(sub.get("content", ""))}</div>\n'
        html += f'  </div>\n'

    html += f'</div>\n'
    return html
