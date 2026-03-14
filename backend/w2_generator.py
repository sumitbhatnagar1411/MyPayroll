#!/usr/bin/env python3
"""
W-2 Form Generator
Generates IRS-style W-2 PDF using reportlab.
Supports child employee rule: under 18 (sole proprietor) = Social Security 0, Medicare 0.
"""

import json
import sys
from io import BytesIO
from decimal import Decimal
from datetime import date
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor


# W-2 box positions (approximate IRS layout - Letter size)
# Left copy (for employee) - standard positioning
BOX_LEFT = 1.2 * inch
BOX_WIDTH = 2.2 * inch
BOX_HEIGHT = 0.35 * inch
LABEL_HEIGHT = 0.2 * inch
ROW_GAP = 0.45 * inch
START_Y = 7.2 * inch  # Top of form


def format_currency(val) -> str:
    if val is None:
        return "0.00"
    try:
        return f"{float(val):.2f}"
    except (ValueError, TypeError):
        return "0.00"


def draw_w2_box(c: canvas.Canvas, x: float, y: float, label: str, value: str, box_num: str = ""):
    """Draw a single W-2 box with label and value."""
    c.setFont("Helvetica", 7)
    c.setFillColor(colors.black)
    c.drawString(x, y + BOX_HEIGHT + 2, f"{box_num} {label}" if box_num else label)
    c.setFont("Helvetica", 10)
    c.rect(x, y, BOX_WIDTH, BOX_HEIGHT, stroke=1, fill=0)
    c.drawString(x + 4, y + 10, value[:28])  # Truncate if too long


def generate_w2_pdf(
    employee_name: str,
    employee_address: str,
    employee_city_state_zip: str,
    employer_name: str,
    employer_ein: str,
    wages: float,
    federal_tax_withheld: float,
    social_security_wages: float,
    social_security_tax: float,
    medicare_wages: float,
    medicare_tax: float,
    tax_year: int,
) -> bytes:
    """
    Generate W-2 PDF with IRS-style box layout.
    Box 1: Wages, tips, other comp
    Box 2: Federal income tax withheld
    Box 3: Social Security wages
    Box 4: Social Security tax withheld
    Box 5: Medicare wages and tips
    Box 6: Medicare tax withheld
    """
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # Title
    c.setFont("Helvetica-Bold", 14)
    c.drawString(2.5 * inch, 7.8 * inch, "Form W-2")
    c.setFont("Helvetica", 10)
    c.drawString(2.5 * inch, 7.6 * inch, f"Wage and Tax Statement - {tax_year}")

    # Employer info (left side)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(BOX_LEFT, 7.35 * inch, "Employer's name, address, and ZIP code")
    c.setFont("Helvetica", 9)
    c.drawString(BOX_LEFT, 7.2 * inch, employer_name[:50])
    c.drawString(BOX_LEFT, 7.0 * inch, employer_ein)

    # Employee info
    c.setFont("Helvetica-Bold", 9)
    c.drawString(BOX_LEFT, 6.5 * inch, "Employee's name")
    c.setFont("Helvetica", 9)
    c.drawString(BOX_LEFT, 6.3 * inch, employee_name[:50])
    c.drawString(BOX_LEFT, 6.1 * inch, "Employee's address and ZIP code")
    c.drawString(BOX_LEFT, 5.9 * inch, employee_address[:50] if employee_address else "")
    c.drawString(BOX_LEFT, 5.7 * inch, employee_city_state_zip[:50] if employee_city_state_zip else "")

    # Box positions - two columns
    col1_x = BOX_LEFT
    col2_x = BOX_LEFT + BOX_WIDTH + 0.3 * inch

    y = 5.2 * inch

    # Box 1: Wages
    draw_w2_box(c, col1_x, y, "Wages, tips, other compensation", format_currency(wages), "1")
    # Box 2: Federal tax withheld
    draw_w2_box(c, col2_x, y, "Federal income tax withheld", format_currency(federal_tax_withheld), "2")
    y -= ROW_GAP

    # Box 3: Social Security wages
    draw_w2_box(c, col1_x, y, "Social security wages", format_currency(social_security_wages), "3")
    # Box 4: Social Security tax
    draw_w2_box(c, col2_x, y, "Social security tax withheld", format_currency(social_security_tax), "4")
    y -= ROW_GAP

    # Box 5: Medicare wages
    draw_w2_box(c, col1_x, y, "Medicare wages and tips", format_currency(medicare_wages), "5")
    # Box 6: Medicare tax
    draw_w2_box(c, col2_x, y, "Medicare tax withheld", format_currency(medicare_tax), "6")

    # Employer EIN
    c.setFont("Helvetica", 8)
    c.drawString(BOX_LEFT, 3.5 * inch, f"Employer identification number (EIN): {employer_ein}")
    c.drawString(BOX_LEFT, 3.3 * inch, f"Tax year: {tax_year}")

    c.save()
    return buffer.getvalue()


def is_child_employee(birth_date_str: str | None, tax_year: int) -> bool:
    """Check if employee is under 18 (sole proprietor child employee rule)."""
    if not birth_date_str:
        return False
    try:
        from datetime import datetime
        bd = datetime.strptime(birth_date_str[:10], "%Y-%m-%d").date()
        age_at_year_end = tax_year - bd.year
        return age_at_year_end < 18
    except (ValueError, TypeError):
        return False


def main():
    """CLI: read JSON from stdin, output PDF to stdout."""
    if len(sys.argv) < 2:
        print("Usage: w2_generator.py", file=sys.stderr)
        print("  Reads JSON from stdin, outputs PDF to stdout", file=sys.stderr)
        sys.exit(1)

    try:
        raw = sys.stdin.read()
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)

    tax_year = int(data.get("tax_year", date.today().year))
    birth_date = data.get("birth_date")
    is_child = is_child_employee(birth_date, tax_year)

    wages = float(data.get("wages", 0))
    federal_tax = float(data.get("federal_tax_withheld", 0))

    if is_child:
        ss_wages = 0.0
        ss_tax = 0.0
        medicare_wages = 0.0
        medicare_tax = 0.0
    else:
        ss_wages = float(data.get("social_security_wages", wages))
        ss_tax = float(data.get("social_security_tax", 0))
        medicare_wages = float(data.get("medicare_wages", wages))
        medicare_tax = float(data.get("medicare_tax", 0))

    pdf_bytes = generate_w2_pdf(
        employee_name=data.get("employee_name", ""),
        employee_address=data.get("employee_address", ""),
        employee_city_state_zip=data.get("employee_city_state_zip", ""),
        employer_name=data.get("employer_name", ""),
        employer_ein=data.get("employer_ein", ""),
        wages=wages,
        federal_tax_withheld=federal_tax,
        social_security_wages=ss_wages,
        social_security_tax=ss_tax,
        medicare_wages=medicare_wages,
        medicare_tax=medicare_tax,
        tax_year=tax_year,
    )
    sys.stdout.buffer.write(pdf_bytes)


if __name__ == "__main__":
    main()
