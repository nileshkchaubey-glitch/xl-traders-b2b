#!/usr/bin/env python3
"""
XL Traders B2B - Product Import Script
Imports products from Google Sheets and downloads images from Google Drive to Supabase Storage

Usage:
    python3 import_products.py --sheets-id <SHEET_ID> --supabase-url <URL> --supabase-key <KEY>
"""

import os
import sys
import json
import argparse
import requests
from pathlib import Path
from typing import List, Dict, Optional
from urllib.parse import urlparse
import mimetypes

# Google Sheets API
try:
    from google.colab import auth
    from googleapiclient.discovery import build
    HAS_GOOGLE_API = True
except ImportError:
    HAS_GOOGLE_API = False
    print("⚠️  Google API libraries not installed. Install with: pip install google-auth-oauthlib google-auth-httplib2 google-api-python-client")

# Supabase
try:
    from supabase import create_client, Client
    HAS_SUPABASE = True
except ImportError:
    HAS_SUPABASE = False
    print("⚠️  Supabase library not installed. Install with: pip install supabase")


class ProductImporter:
    """Handles importing products from Google Sheets to Supabase"""
    
    def __init__(self, supabase_url: str, supabase_key: str):
        """Initialize Supabase client"""
        if not HAS_SUPABASE:
            raise ImportError("Supabase library not installed")
        
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        
    def get_google_sheets_data(self, sheet_id: str, sheet_name: str = "products") -> List[Dict]:
        """Fetch data from Google Sheets"""
        if not HAS_GOOGLE_API:
            raise ImportError("Google API libraries not installed")
        
        try:
            # Authenticate with Google
            auth.authenticate_user()
            sheets = build('sheets', 'v4')
            
            # Read sheet
            result = sheets.spreadsheets().values().get(
                spreadsheetId=sheet_id,
                range=f"{sheet_name}!A1:Z1000"
            ).execute()
            
            values = result.get('values', [])
            if not values:
                print("❌ No data found in sheet")
                return []
            
            # Convert to list of dicts
            headers = values[0]
            products = []
            for row in values[1:]:
                if len(row) > 0 and row[0]:  # Skip empty rows
                    product = {}
                    for i, header in enumerate(headers):
                        product[header.lower().strip()] = row[i] if i < len(row) else ""
                    products.append(product)
            
            print(f"✅ Fetched {len(products)} products from Google Sheets")
            return products
            
        except Exception as e:
            print(f"❌ Error fetching Google Sheets data: {e}")
            return []
    
    def download_image_from_url(self, url: str, filename: str, max_retries: int = 3) -> Optional[bytes]:
        """Download image from URL with retries"""
        for attempt in range(max_retries):
            try:
                response = requests.get(url, timeout=10)
                response.raise_for_status()
                return response.content
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"  ⚠️  Retry {attempt + 1}/{max_retries} for {filename}")
                else:
                    print(f"  ❌ Failed to download {filename}: {e}")
                    return None
    
    def upload_image_to_supabase(self, image_data: bytes, bucket: str, path: str) -> Optional[str]:
        """Upload image to Supabase Storage"""
        try:
            # Determine content type
            content_type = mimetypes.guess_type(path)[0] or "image/jpeg"
            
            # Upload to Supabase Storage
            response = self.supabase.storage.from_(bucket).upload(
                path,
                image_data,
                {"content-type": content_type}
            )
            
            # Get public URL
            public_url = self.supabase.storage.from_(bucket).get_public_url(path)
            return public_url
            
        except Exception as e:
            print(f"  ❌ Error uploading to Supabase: {e}")
            return None
    
    def get_or_create_category(self, category_name: str) -> Optional[str]:
        """Get or create category and return its ID"""
        try:
            # Check if category exists
            result = self.supabase.table('categories').select('id').eq('name', category_name).execute()
            
            if result.data:
                return result.data[0]['id']
            
            # Create new category
            slug = category_name.lower().replace(' ', '-')
            new_category = self.supabase.table('categories').insert({
                'name': category_name,
                'slug': slug,
                'is_active': True
            }).execute()
            
            if new_category.data:
                print(f"  ✅ Created category: {category_name}")
                return new_category.data[0]['id']
            
            return None
            
        except Exception as e:
            print(f"  ❌ Error with category {category_name}: {e}")
            return None
    
    def import_products(self, products: List[Dict], download_images: bool = True) -> int:
        """Import products to Supabase"""
        imported_count = 0
        
        for i, product in enumerate(products, 1):
            try:
                print(f"\n[{i}/{len(products)}] Processing: {product.get('item_name', 'Unknown')}")
                
                # Get category ID
                category_name = product.get('category', 'Uncategorized')
                category_id = self.get_or_create_category(category_name)
                
                if not category_id:
                    print(f"  ❌ Skipped: Could not create/find category")
                    continue
                
                # Parse price
                price_str = product.get('price', '0').replace('₹', '').replace(',', '').strip()
                try:
                    price = float(price_str)
                except ValueError:
                    price = 0.0
                
                # Download and upload image
                image_url = None
                if download_images and product.get('image_download_link'):
                    print(f"  📥 Downloading image...")
                    image_data = self.download_image_from_url(
                        product['image_download_link'],
                        product.get('image_file_name', 'image.jpg')
                    )
                    
                    if image_data:
                        # Create unique path
                        image_filename = product.get('image_file_name', f"product_{i}.jpg")
                        image_path = f"products/{image_filename}"
                        
                        print(f"  📤 Uploading to Supabase Storage...")
                        image_url = self.upload_image_to_supabase(
                            image_data,
                            "product-images",
                            image_path
                        )
                        
                        if image_url:
                            print(f"  ✅ Image uploaded: {image_url}")
                
                # Prepare product data
                product_data = {
                    'name': product.get('item_name', ''),
                    'category_id': category_id,
                    'description': product.get('description', ''),
                    'price': price,
                    'image_url': image_url,
                    'image_alt_text': product.get('item_name', ''),
                    'is_active': True,
                    'sku': product.get('image_file_name', f"SKU-{i}").replace('.jpeg', '').replace('.jpg', '')
                }
                
                # Check if product already exists
                existing = self.supabase.table('products').select('id').eq('name', product_data['name']).execute()
                
                if existing.data:
                    print(f"  ⏭️  Product already exists, skipping...")
                    continue
                
                # Insert product
                result = self.supabase.table('products').insert(product_data).execute()
                
                if result.data:
                    print(f"  ✅ Product imported successfully")
                    imported_count += 1
                else:
                    print(f"  ❌ Failed to insert product")
                    
            except Exception as e:
                print(f"  ❌ Error processing product: {e}")
                continue
        
        return imported_count
    
    def create_storage_buckets(self) -> bool:
        """Create storage buckets if they don't exist"""
        try:
            buckets = self.supabase.storage.list_buckets()
            bucket_names = [b.name for b in buckets]
            
            if 'product-images' not in bucket_names:
                print("📦 Creating product-images bucket...")
                self.supabase.storage.create_bucket('product-images', {
                    'public': True,
                    'file_size_limit': 52428800  # 50MB
                })
                print("✅ Created product-images bucket")
            
            return True
        except Exception as e:
            print(f"⚠️  Could not create buckets (they may already exist): {e}")
            return True


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Import products from Google Sheets to Supabase'
    )
    parser.add_argument('--sheets-id', required=True, help='Google Sheets ID')
    parser.add_argument('--supabase-url', required=True, help='Supabase project URL')
    parser.add_argument('--supabase-key', required=True, help='Supabase anon key')
    parser.add_argument('--skip-images', action='store_true', help='Skip image download/upload')
    parser.add_argument('--sheet-name', default='products', help='Sheet name to import from')
    
    args = parser.parse_args()
    
    print("🚀 XL Traders Product Importer")
    print("=" * 50)
    
    try:
        # Initialize importer
        importer = ProductImporter(args.supabase_url, args.supabase_key)
        
        # Create storage buckets
        print("\n📦 Setting up storage buckets...")
        importer.create_storage_buckets()
        
        # Fetch products from Google Sheets
        print("\n📊 Fetching products from Google Sheets...")
        products = importer.get_google_sheets_data(args.sheets_id, args.sheet_name)
        
        if not products:
            print("❌ No products to import")
            return 1
        
        # Import products
        print(f"\n📥 Importing {len(products)} products...")
        imported = importer.import_products(products, download_images=not args.skip_images)
        
        print("\n" + "=" * 50)
        print(f"✅ Import complete! {imported}/{len(products)} products imported")
        return 0
        
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
