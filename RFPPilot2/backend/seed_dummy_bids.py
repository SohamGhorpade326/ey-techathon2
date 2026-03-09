"""
Seed script for dummybid collection
Run this with: python RFPPilot2/backend/seed_dummy_bids.py
"""

from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

sample_bids = [
    {
        "bid_id": "BID-001",
        "buyer": "HPCL",
        "buyer_type": "PSU",
        "domain": "Cables",
        "bid_value_cr": 12.5,
        "status": "Won",
        "pricing_strategy": "Premium",
        "delivery_duration_days": 120,
        "remarks": "Successfully delivered on time with quality certifications",
    },
    {
        "bid_id": "BID-002",
        "buyer": "BHEL",
        "buyer_type": "PSU",
        "domain": "Transformers",
        "bid_value_cr": 25.3,
        "status": "Won",
        "pricing_strategy": "Competitive",
        "delivery_duration_days": 180,
        "remarks": "Long-term partnership outcome",
    },
    {
        "bid_id": "BID-003",
        "buyer": "Reliance",
        "buyer_type": "Private",
        "domain": "Cables",
        "bid_value_cr": 8.7,
        "status": "Won",
        "pricing_strategy": "Value",
        "delivery_duration_days": 90,
        "remarks": "Fast delivery execution",
    },
    {
        "bid_id": "BID-004",
        "buyer": "PGCIL",
        "buyer_type": "PSU",
        "domain": "Switchgear",
        "bid_value_cr": 18.2,
        "status": "Won",
        "pricing_strategy": "Premium",
        "delivery_duration_days": 150,
        "remarks": "Technical excellence recognized",
    },
    {
        "bid_id": "BID-005",
        "buyer": "MSEDCL",
        "buyer_type": "PSU",
        "domain": "Cables",
        "bid_value_cr": 15.8,
        "status": "Lost",
        "pricing_strategy": "Competitive",
        "delivery_duration_days": 200,
        "remarks": "Price was higher than competitors",
    },
    {
        "bid_id": "BID-006",
        "buyer": "Tata Power",
        "buyer_type": "Private",
        "domain": "Transformers",
        "bid_value_cr": 22.1,
        "status": "Won",
        "pricing_strategy": "Premium",
        "delivery_duration_days": 160,
        "remarks": "Strong technical proposal",
    },
    {
        "bid_id": "BID-007",
        "buyer": "NTPC",
        "buyer_type": "PSU",
        "domain": "Cables",
        "bid_value_cr": 30.5,
        "status": "Lost",
        "pricing_strategy": "Premium",
        "delivery_duration_days": 250,
        "remarks": "Timeline too long, lost to faster competitor",
    },
    {
        "bid_id": "BID-008",
        "buyer": "BPCL",
        "buyer_type": "PSU",
        "domain": "Switchgear",
        "bid_value_cr": 14.3,
        "status": "Won",
        "pricing_strategy": "Competitive",
        "delivery_duration_days": 130,
        "remarks": "Good balance of price and quality",
    },
    {
        "bid_id": "BID-009",
        "buyer": "Adani Power",
        "buyer_type": "Private",
        "domain": "Transformers",
        "bid_value_cr": 19.7,
        "status": "Won",
        "pricing_strategy": "Value",
        "delivery_duration_days": 140,
        "remarks": "Excellent relationship building",
    },
    {
        "bid_id": "BID-010",
        "buyer": "IOCL",
        "buyer_type": "PSU",
        "domain": "Cables",
        "bid_value_cr": 11.2,
        "status": "Won",
        "pricing_strategy": "Competitive",
        "delivery_duration_days": 110,
        "remarks": "Met all technical specifications",
    },
]

def seed_dummy_bids():
    try:
        # Get MongoDB URI
        MONGO_URI = os.getenv("MONGO_URI2") or os.getenv("MONGO_URI")
        if not MONGO_URI:
            print("❌ MONGO_URI2 or MONGO_URI not found in environment variables")
            print("   Please check your .env file in RFPPilot2/backend/")
            return
        
        print(f"🔗 Connecting to MongoDB...")
        
        # Connect to MongoDB
        client = MongoClient(MONGO_URI)
        db = client["agentic_rfp"]
        collection = db["dummybid"]
        
        # Check existing data
        existing_count = collection.count_documents({})
        print(f"📊 Found {existing_count} existing bids in collection")
        
        if existing_count > 0:
            print("\n⚠️  Collection already has data.")
            response = input("Do you want to clear and reseed? (yes/no): ")
            if response.lower() == 'yes':
                collection.delete_many({})
                print("🗑️  Cleared existing data")
            else:
                print("✅ Keeping existing data")
                return
        
        # Insert sample data
        result = collection.insert_many(sample_bids)
        print(f"\n✅ Successfully seeded {len(result.inserted_ids)} dummy bids")
        
        # Show statistics
        won_count = len([b for b in sample_bids if b["status"] == "Won"])
        lost_count = len([b for b in sample_bids if b["status"] == "Lost"])
        
        print(f"   • Won: {won_count}")
        print(f"   • Lost: {lost_count}")
        print(f"   • Win Rate: {(won_count / len(sample_bids) * 100):.1f}%")
        
        # Show domain breakdown
        domains = {}
        for bid in sample_bids:
            domain = bid["domain"]
            domains[domain] = domains.get(domain, 0) + 1
        
        print(f"\n📈 Domain breakdown:")
        for domain, count in domains.items():
            print(f"   • {domain}: {count} bids")
        
        print("\n🎉 Seeding complete! You can now:")
        print("   1. Restart your FastAPI server (if running)")
        print("   2. Visit http://localhost:8080/strategic-insights")
        print("   3. View the populated historical data")
        
    except Exception as e:
        print(f"❌ Error seeding dummy bids: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    seed_dummy_bids()