const express = require("express");
const compression = require("compression");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

// Initialize Express app
const app = express();

// Middleware optimization
app.use(compression()); // Add compression for faster response times
app.use(cors());
app.use(express.json({ limit: "1mb" })); // Use express.json instead of bodyParser

// Static file serving with optimized caching
app.use(
  express.static("public", {
    maxAge: "1y",
    etag: false,
    immutable: true,
    // Cache control headers for better caching
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  })
);

// Initialize Supabase client - create once, reuse everywhere
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Memoization for word of the day
const wordCache = {
  data: null,
  date: null,
  expiresAt: null,
};

// Root route with minimal processing
app.get("/", (_, res) => {
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send("Express on Vercel");
});

// Optimized Word of the day endpoint
app.get("/get-wordofday", async (req, res) => {
  try {
    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // Check if we have a valid cached response
    if (
      wordCache.data &&
      wordCache.date === today &&
      wordCache.expiresAt > Date.now()
    ) {
      return res.status(200).json(wordCache.data);
    }

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

        // Cache the result for 1 hour
        wordCache.data = fallbackData;
        wordCache.date = today;
        wordCache.expiresAt = Date.now() + 3600000; // 1 hour cache

        return res.status(200).json(fallbackData);
      }

      throw error;
    }

    // Cache the result for 1 hour
    wordCache.data = data;
    wordCache.date = today;
    wordCache.expiresAt = Date.now() + 3600000; // 1 hour cache

    return res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching word of the day:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get("/health", (_, res) => {
  res.status(200).send("OK");
});

module.exports = app;
