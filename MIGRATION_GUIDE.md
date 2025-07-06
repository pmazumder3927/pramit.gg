# Migration Guide: Slug-Based URLs

This guide explains how to migrate from UUID-based URLs to slug-based URLs for posts.

## Overview

The application now supports human-readable URLs based on post titles instead of UUIDs:
- Old format: `/post/550e8400-e29b-41d4-a716-446655440000`
- New format: `/post/my-awesome-post-title`

## Database Changes

A new `slug` column has been added to the `posts` table:

```sql
ALTER TABLE posts ADD COLUMN slug TEXT;
CREATE INDEX idx_posts_slug ON posts(slug);
```

## Migration Process

### 1. Update Database Schema
Add the slug column to your posts table in Supabase:

```sql
ALTER TABLE posts ADD COLUMN slug TEXT;
CREATE INDEX idx_posts_slug ON posts(slug);
```

### 2. Run Migration Script
The migration script will:
- Generate slugs for all existing posts
- Handle duplicate slugs by appending numbers
- Update posts with their new slug values

```bash
# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run the migration
npm run migrate-slugs
```

### 3. Features

#### Image Preview Enhancement
- Posts with images in markdown content now show image previews on the homepage
- Images are displayed with elegant styling and hover effects
- Proper aspect ratios and responsive design

#### URL Backward Compatibility
- Old UUID-based URLs still work
- Automatic redirection to new slug-based URLs
- Existing bookmarks and links continue to work

#### Slug Generation
- Automatically generates SEO-friendly slugs from post titles
- Handles special characters and spaces
- Prevents duplicate slugs

## Testing

1. Verify existing posts load correctly
2. Check that new slug-based URLs work
3. Confirm image previews display properly
4. Test backward compatibility with old URLs

## Rollback

If you need to rollback:
1. Remove the slug column: `ALTER TABLE posts DROP COLUMN slug;`
2. Revert the PostCard component to use UUID-based URLs
3. Update the post page to only fetch by ID