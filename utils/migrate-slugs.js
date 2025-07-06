const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function migratePostSlugs() {
  try {
    console.log('Starting slug migration...');
    
    // Fetch all posts without slugs
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .or('slug.is.null,slug.eq.""');

    if (error) {
      console.error('Error fetching posts:', error);
      return;
    }

    console.log(`Found ${posts.length} posts without slugs`);

    // Update each post with a generated slug
    const updatePromises = posts.map(async (post) => {
      const slug = generateSlug(post.title);
      
      // Check if slug already exists
      const { data: existing } = await supabase
        .from('posts')
        .select('id')
        .eq('slug', slug)
        .neq('id', post.id);

      let finalSlug = slug;
      
      // If slug exists, append a number
      if (existing && existing.length > 0) {
        let counter = 1;
        let tempSlug = `${slug}-${counter}`;
        
        while (true) {
          const { data: existingTemp } = await supabase
            .from('posts')
            .select('id')
            .eq('slug', tempSlug);
            
          if (!existingTemp || existingTemp.length === 0) {
            finalSlug = tempSlug;
            break;
          }
          
          counter++;
          tempSlug = `${slug}-${counter}`;
        }
      }

      const { error: updateError } = await supabase
        .from('posts')
        .update({ slug: finalSlug })
        .eq('id', post.id);

      if (updateError) {
        console.error(`Error updating post ${post.id}:`, updateError);
        return { success: false, post: post.title };
      }

      console.log(`Updated "${post.title}" with slug: ${finalSlug}`);
      return { success: true, post: post.title, slug: finalSlug };
    });

    const results = await Promise.all(updatePromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`\nMigration completed:`);
    console.log(`  Successfully updated: ${successful.length} posts`);
    console.log(`  Failed: ${failed.length} posts`);

    if (failed.length > 0) {
      console.log('\nFailed posts:');
      failed.forEach(f => console.log(`  - ${f.post}`));
    }

  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
migratePostSlugs();