# Bangalore PG dataset regeneration steps

1. Open a terminal in this project folder.
2. Set your environment variables for the live data source:
   ```bash
   export GOOGLE_API_KEY="your-google-api-key"
   export TAVILY_API_KEY="your-tavily-key"
   ```
   On Windows PowerShell:
   ```powershell
   $env:GOOGLE_API_KEY = "your-google-api-key"
   $env:TAVILY_API_KEY = "your-tavily-key"
   ```
3. Run:
   ```bash
   node scripts/generate-bangalore-pgs.js
   ```
4. Verify output is generated in:
   - `data/bangalore-pgs.js`
   - `data/photos/`
5. Refresh the app or reload the browser tab.
6. The script will automatically use the best downloaded Google photo as the card cover and keep the remaining photos in the PG gallery.
7. If the API keys are missing, it falls back to curated placeholder images so the app still works.

Useful notes:
- This script searches Bangalore PGs, extracts Google Places metadata, downloads the first available Place photos, and keeps the local file paths in the dataset.
- You can rerun the command anytime after updating the API keys or adding new targeting logic.
- Do not commit the raw API keys into source control. Keep them only in your shell or a local `.env` file ignored by git.
