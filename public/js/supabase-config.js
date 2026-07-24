// Public marketing-site Supabase client.
//
// The anon key is designed to ship in the browser — it is safe here and is
// useless without the Row Level Security policies in supabase/migrations.
// (createClient comes from the vendored UMD bundle loaded just before this.)
window.pmSupabase = window.supabase.createClient(
  'https://mjkkrgpntlqbioevxdvw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qa2tyZ3BudGxxYmlvZXZ4ZHZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3NDM4MjAsImV4cCI6MjEwMDMxOTgyMH0.F8yB4_xKUcrNL7sKYQIn3cn1408bDD6fzzN2wZaJWuE'
);
