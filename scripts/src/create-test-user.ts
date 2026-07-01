import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(url, key);

const { data, error } = await supabase.auth.signUp({
  email: "test@yahoo.com",
  password: "testtest",
});

if (error) {
  console.error("Error:", error.message);
} else {
  console.log("User created:", data.user?.id, data.user?.email);
  console.log("Email confirmation required?", !data.session);
}
