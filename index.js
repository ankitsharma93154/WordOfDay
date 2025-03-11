const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" })); // Limit payload size
require("dotenv").config();
app.use(
  express.static("public", {
    maxAge: "1y",
    etag: false,
    immutable: true, // Add immutable flag for better caching
  })
);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Root route with minimal processing
app.get("/", (_, res) => res.send("Express on Vercel"));

// MERGED ROUTE: Word of the day endpoint
app.get("/get-wordofday", async (req, res) => {
  try {
    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // Query the database for today's word
    const { data, error } = await supabase
      .from("words_of_the_day")
      .select("*")
      .eq("display_date", today)
      .single();

    if (error) {
      // If no word found for today, return the most recent word
      if (error.code === "PGRST116") {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("words_of_the_day")
          .select("*")
          .lte("display_date", today)
          .order("display_date", { ascending: false })
          .limit(1)
          .single();

        if (fallbackError) throw fallbackError;

        return res.status(200).json(fallbackData);
      }

      throw error;
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = app;
