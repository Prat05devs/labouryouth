import asyncio

from sqlalchemy import select

from .db import SessionLocal
from .models import City, ServiceArea, ServiceCategory

CATEGORIES = [
    ("House Maid", "घरेलू सहायक", "house-maid", "home"),
    ("Driver", "ड्राइवर", "driver", "car"),
    ("Security Guard", "सुरक्षा गार्ड", "security-guard", "shield"),
    ("Babysitter", "बच्चों की देखभाल", "babysitter", "heart"),
    ("Patient Care", "मरीज़ की देखभाल", "patient-care", "medical"),
    ("Event Staff", "कार्यक्रम कर्मचारी", "event-staff", "people"),
    ("Other", "अन्य", "other", "grid"),
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
                        verification_types=["IDENTITY", "POLICE"]
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


if __name__ == "__main__":
    asyncio.run(seed())
