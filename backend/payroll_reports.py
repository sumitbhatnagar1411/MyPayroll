#!/usr/bin/env python3
"""
Payroll Reports Generator
Generates annual payroll reports in CSV, JSON, or PDF format.
"""

import json
import sys
import csv
from io import StringIO, BytesIO
from decimal import Decimal
from typing import Any
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch


def format_currency(value: Any) -> str:
    """Format number as USD currency."""
    if value is None:
        return "$0"
    try:
        return f"${float(value):,.2f}"
    except (ValueError, TypeError):
        return "$0"


def generate_payroll_summary(employees_data: list[dict]) -> list[dict]:
    """
    Generate yearly payroll summary from employee data.
    Each employee dict should have: name, total_wages, total_payments, ira_contributions, payroll_runs_count
    """
    return [
        {
            "Employee Name": emp.get("name", ""),
            "Total Wages": float(emp.get("total_wages", 0)),
            "Total Payments": float(emp.get("total_payments", 0)),
            "IRA Contributions": float(emp.get("ira_contributions", 0)),
            "Number of Payroll Runs": int(emp.get("payroll_runs_count", 0)),
        }
        for emp in employees_data
    ]


def export_csv(summary: list[dict]) -> str:
    """Export payroll summary as CSV string."""
    if not summary:
        return "Employee Name,Total Wages,Total Payments,IRA Contributions,Number of Payroll Runs\n"
    output = StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["Employee Name", "Total Wages", "Total Payments", "IRA Contributions", "Number of Payroll Runs"],
        extrasaction="ignore",
    )
    writer.writeheader()
    for row in summary:
        row_copy = row.copy()
        row_copy["Total Wages"] = format_currency(row_copy.get("Total Wages", 0))
        row_copy["Total Payments"] = format_currency(row_copy.get("Total Payments", 0))
        row_copy["IRA Contributions"] = format_currency(row_copy.get("IRA Contributions", 0))
        writer.writerow(row_copy)
    return output.getvalue()


def export_json(summary: list[dict]) -> str:
    """Export payroll summary as JSON string."""
    return json.dumps(summary, indent=2)


def export_pdf(summary: list[dict], year: int) -> bytes:
    """Export payroll summary as PDF using reportlab."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.75 * inch, bottomMargin=0.75 * inch)
    elements = []

    styles = getSampleStyleSheet()
    title = Paragraph(f"<b>Payroll Report - {year}</b>", styles["Title"])
    elements.append(title)
    elements.append(Spacer(1, 0.25 * inch))

    # Table data
    headers = ["Employee Name", "Total Wages", "Total Payments", "IRA Contributions", "Payroll Runs"]
    data = [headers]
    for row in summary:
        data.append([
            str(row.get("Employee Name", "")),
            format_currency(row.get("Total Wages", 0)),
            format_currency(row.get("Total Payments", 0)),
            format_currency(row.get("IRA Contributions", 0)),
            str(row.get("Number of Payroll Runs", 0)),
        ])

    table = Table(data, colWidths=[1.5 * inch, 1.2 * inch, 1.2 * inch, 1.4 * inch, 1 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
        ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
    ]))
    elements.append(table)

    doc.build(elements)
    return buffer.getvalue()


def main():
    """CLI entry: reads JSON from stdin, outputs in requested format."""
    if len(sys.argv) < 3:
        print("Usage: payroll_reports.py <year> <format>", file=sys.stderr)
        print("  format: csv | json | pdf", file=sys.stderr)
        sys.exit(1)

    year = int(sys.argv[1])
    fmt = sys.argv[2].lower()

    try:
        raw = sys.stdin.read()
        employees_data = json.loads(raw) if raw.strip() else []
    except json.JSONDecodeError as e:
        print(f"Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    summary = generate_payroll_summary(employees_data)

    if fmt == "csv":
        print(export_csv(summary))
    elif fmt == "json":
        print(export_json(summary))
    elif fmt == "pdf":
        pdf_bytes = export_pdf(summary, year)
        sys.stdout.buffer.write(pdf_bytes)
    else:
        print(f"Unknown format: {fmt}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
