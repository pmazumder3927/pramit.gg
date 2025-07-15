// Setup script for Supabase storage buckets
// Run this script to ensure the videos bucket exists

const { createClient } = require('@supabase/supabase-js');

// You'll need to set these environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorage() {
  try {
    console.log('Setting up Supabase storage buckets...');

    // List existing buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }

    console.log('Existing buckets:', buckets.map(b => b.name));

    // Check if videos bucket exists
    const videosBucketExists = buckets.some(bucket => bucket.name === 'videos');
    
    if (!videosBucketExists) {
      console.log('Creating videos bucket...');
      
      const { data, error } = await supabase.storage.createBucket('videos', {
        public: true,
        allowedMimeTypes: ['video/mp4'],
        fileSizeLimit: 100 * 1024 * 1024, // 100MB
      });

      if (error) {
        console.error('Error creating videos bucket:', error);
      } else {
        console.log('✅ Videos bucket created successfully');
      }
    } else {
      console.log('✅ Videos bucket already exists');
    }

    // Check if images bucket exists
    const imagesBucketExists = buckets.some(bucket => bucket.name === 'images');
    
    if (!imagesBucketExists) {
      console.log('Creating images bucket...');
      
      const { data, error } = await supabase.storage.createBucket('images', {
        public: true,
        allowedMimeTypes: ['image/*'],
        fileSizeLimit: 25 * 1024 * 1024, // 25MB
      });

      if (error) {
        console.error('Error creating images bucket:', error);
      } else {
        console.log('✅ Images bucket created successfully');
      }
    } else {
      console.log('✅ Images bucket already exists');
    }

    console.log('Storage setup complete!');
  } catch (error) {
    console.error('Setup failed:', error);
  }
}

setupStorage();