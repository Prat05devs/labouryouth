import asyncio

from sqlalchemy import select

from .db import SessionLocal
from .models import City, Locality, ServiceArea, ServiceCategory

CATEGORIES = [
    ("House Maid", "घरेलू सहायक", "house-maid", "home"),
    ("Driver", "ड्राइवर", "driver", "car"),
    ("Security Guard", "सुरक्षा गार्ड", "security-guard", "shield"),
    ("Babysitter", "बच्चों की देखभाल", "babysitter", "heart"),
    ("Patient Care", "मरीज़ की देखभाल", "patient-care", "medical"),
    ("Event Staff", "कार्यक्रम कर्मचारी", "event-staff", "people"),
    ("Mason", "राजमिस्त्री", "mason", "construct"),
    ("Carpenter", "बढ़ई", "carpenter", "hammer"),
    ("Painter", "पेंटर", "painter", "brush"),
    ("Electrician", "इलेक्ट्रीशियन", "electrician", "flash"),
    ("Plumber", "प्लंबर", "plumber", "water"),
    ("Welder", "वेल्डर", "welder", "flame"),
    ("Helper", "हेल्पर", "helper", "people"),
    ("Cook", "रसोइया", "cook", "restaurant"),
    ("Waiter", "वेटर", "waiter", "cafe"),
    ("Housekeeping", "हाउसकीपिंग", "housekeeping", "sparkles"),
    ("Delivery Worker", "डिलीवरी", "delivery", "bicycle"),
    ("AC and Refrigerator Technician", "एसी और फ्रिज टेक्नीशियन", "ac-technician", "snow"),
    ("Beautician", "ब्यूटीशियन", "beautician", "flower"),
    ("Mechanic", "मैकेनिक", "mechanic", "build"),
    ("Construction Supervisor", "निर्माण सुपरवाइज़र", "construction-supervisor", "clipboard"),
    ("Hotel and Resort Staff", "होटल और रिज़ॉर्ट स्टाफ", "hotel-staff", "bed"),
    ("Other", "अन्य", "other", "grid"),
]
# Owner-configurable: the original household categories need identity and police checks; the new trade
# categories default to identity only so daily work can start. Change per service in the database.
STRICT = {"house-maid", "driver", "security-guard", "babysitter", "patient-care", "event-staff", "other"}

# Names only. Coordinates are NULL until the owner supplies verified points (no invented geodata).
LOCALITIES = [
    ("ISBT", "आईएसबीटी", "isbt"),
    ("Patel Nagar", "पटेल नगर", "patel-nagar"),
    ("Sahastradhara", "सहस्रधारा", "sahastradhara"),
    ("Raipur", "रायपुर", "raipur"),
    ("Clement Town", "क्लेमेंट टाउन", "clement-town"),
    ("Prem Nagar", "प्रेम नगर", "prem-nagar"),
    ("Selaqui", "सेलाकुई", "selaqui"),
    ("Vikasnagar", "विकासनगर", "vikasnagar"),
    ("Doiwala", "डोईवाला", "doiwala"),
]


async def seed():
    async with SessionLocal.begin() as db:
        city = await db.scalar(select(City).where(City.slug == "dehradun"))
        if not city:
            city = City(name="Dehradun", state="Uttarakhand", slug="dehradun")
            db.add(city)
            await db.flush()
        if not await db.scalar(select(ServiceArea).where(ServiceArea.slug == "dehradun-central")):
            db.add(
                ServiceArea(
                    city_id=city.id,
                    name="Dehradun",
                    slug="dehradun-central",
                    center="SRID=4326;POINT(78.0322 30.3165)",
                    radius_m=20000,
                )
            )
        for order, (name, hi, slug, icon) in enumerate(CATEGORIES):
            if not await db.scalar(select(ServiceCategory).where(ServiceCategory.slug == slug)):
                db.add(
                    ServiceCategory(
                        name=name,
                        name_hi=hi,
                        slug=slug,
                        icon=icon,
                        sort_order=order,
                        verification_types=(["IDENTITY", "POLICE"] if slug in STRICT else ["IDENTITY"])
                        + (["DRIVING_LICENSE"] if slug == "driver" else []),
                        requirement_schema={
                            "type": "object",
                            "properties": {
                                "experience_years": {"type": "integer", "minimum": 0, "maximum": 60},
                                "language": {"type": "string", "enum": ["hi", "en"]},
                            },
                            "additionalProperties": False,
                        },
                    )
                )
        for order, (name, hi, slug) in enumerate(LOCALITIES):
            if not await db.scalar(select(Locality).where(Locality.slug == slug)):
                db.add(Locality(city_id=city.id, name=name, name_hi=hi, slug=slug, sort_order=order))


if __name__ == "__main__":
    asyncio.run(seed())
