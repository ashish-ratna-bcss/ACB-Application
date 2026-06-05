from app.database import SessionLocal
from app.models import Document, PageContent

db = SessionLocal()

doc = db.query(Document).filter(Document.id == 29).first()
print(f"Doc 29: {doc.file_name}")
print(f"Marked as: {doc.total_pages} pages\n")

pages = db.query(PageContent).filter(PageContent.document_id == 29).all()
print(f"Actual PageContent entries: {len(pages)}")

# Group by page number
page_nums = {}
for p in pages:
    if p.page_number not in page_nums:
        page_nums[p.page_number] = 0
    page_nums[p.page_number] += 1

for pn in sorted(page_nums.keys()):
    print(f"  Page {pn}: {page_nums[pn]} entries")

db.close()
