from io import BytesIO

from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def build_report_rows(transactions):
    rows = [["Date", "Type", "Category", "Description", "Amount", "Balance After"]]
    for item in transactions:
        rows.append([
            item.get("date").strftime("%Y-%m-%d") if item.get("date") else "",
            item.get("type", "").title(),
            item.get("category", ""),
            item.get("description", ""),
            item.get("amount", 0),
            item.get("balance_after", 0),
        ])
    return rows


def excel_file(rows):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Finance Report"
    for row in rows:
        sheet.append(row)
    stream = BytesIO()
    workbook.save(stream)
    stream.seek(0)
    return stream


def pdf_file(rows, title):
    stream = BytesIO()
    pdf = canvas.Canvas(stream, pagesize=A4)
    width, height = A4
    y = height - 50
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawString(40, y, title)
    y -= 35
    pdf.setFont("Helvetica", 9)
    for row in rows[:45]:
        text = " | ".join(str(cell) for cell in row)
        pdf.drawString(40, y, text[:115])
        y -= 16
        if y < 40:
            pdf.showPage()
            y = height - 45
            pdf.setFont("Helvetica", 9)
    pdf.save()
    stream.seek(0)
    return stream
